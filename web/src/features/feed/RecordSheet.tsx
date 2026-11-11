/**
 * E11 데이트 기록 쓰기 - 전체 높이 시트(손잡이 + ✕). 보드 `N-E11-Date-Write` + CURRENT.md 바뀐 점(시간 칸은 조건부 · 안내 문구 2종).
 * RN `app/(modals)/upload.tsx`의 웹판. E10(사진 직접 추가) 화면은 없앴다 - 이미 있는 데이트에 사진을 더하는 길은 E03 [사진 더하기]의 시스템 사진 선택기다.
 *
 * - 사진(여러 장)은 시스템 사진 선택기(웹 입력)에서 고른다. 촬영 시각은 EXIF(`photoPicker.ts`)에서, 위치는 읽지 않는다.
 * - 날짜 기본값은 사진 중 가장 이른 촬영 시각의 날짜(KST), 없으면 오늘. 사용자가 바꾸면 더는 덮어쓰지 않는다(규칙 2).
 * - **시간 칸은 조건부**: stop을 만들 장소가 없고(이름 있는 장소 0) 고른 사진에 촬영 시각이 하나도 없을 때만 보인다 - 그때만 도착 시각을 사람이 정해야 해서다(R30-2).
 *   그 밖에는 시각이 사진 · 장소에서 정해지므로 칸이 없다. 칸을 누르면 장소 칸이 열린다(장소 이름 + 도착 시각).
 * - 안내 문구 2종(사진 아래): 촬영 시각이 있으면 "사진의 촬영 시각으로 날짜를 먼저 채웠어요", 없으면 "촬영 시각이 없어 오늘 날짜로 채웠어요".
 * - stop 도착 시각은 늘 실제 시각이다(R30-2): 첫 장소는 비우면 가장 이른 촬영 시각, 둘째부터는 필수, 사진도 시각도 없으면 필수.
 *   정할 수 없으면 이유를 글로 적고 기록 버튼을 비활성으로 둔다(`planStops`).
 * - 메모는 데이트 단위다. 기록할 커플 행이 없으면(규칙 6) 기록 버튼은 비활성이고 이유를 글로 적는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Db } from '@/services/dateRecordApi'
import {
  defaultDateOn, formatClockInput, formatDateDotted, formatDateInput, isValidDateOn, planStops, stopTimeErrorMessage, todayKst, type PlaceInput,
} from '@/utils/dateRecord'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { PhotoDiag } from '../../components/PhotoDiag'
import { PhotoSourceSheet } from '../../components/PhotoSourceSheet'
import { useSheetClose } from '../../components/Sheet'
import { IS_TRIAL_BUILD } from '../../config/env'
import { useTrialDiag } from '../../platform/trialDiag'
import { showToast } from '../../stores/toastStore'
import { PrimaryButton } from '../../ui'
import { isRecordable, useFeedSignal, useRecordingCouple } from './feedData'
import { SOLO_CLOSED_TITLE } from './FeedView'
import { openInvite } from '../../app/inviteEntry'
import { pickFeedPhotos, releaseStaged, type StagedPhoto } from './feedPhotoStage'
import { saveFeedRecord, savablePhotos } from './feedSave'

export const RECORD_COPY = {
  title: '데이트 기록',
  exifFilled: '사진의 촬영 시각으로 날짜를 먼저 채웠어요',
  noExif: '촬영 시각이 없어 오늘 날짜로 채웠어요',
  timeNeeded: '장소와 도착 시각이 필요해요',
  /** 연결 전 닫힘(R30-3) - 이유 + 초대 안내. */
  closedTitle: SOLO_CLOSED_TITLE,
  closedBody: '연결하면 두 사람 기록이 하나로 합쳐져요',
  closedInvite: '초대하러 가기',
} as const

function placesLabel(places: readonly PlaceInput[]): string {
  const names = places.map((p) => p.name.trim()).filter((n) => n.length > 0)
  if (names.length === 0) return '정하지 않았어요'
  return names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}곳`
}

type Panel = null | 'date' | 'places'

function Row({ label, value, onPress, testId }: { label: string; value: string; onPress?: () => void; testId?: string }) {
  const body = (
    <>
      <span className="t-body c-sub">{label}</span>
      <span className="listValue t-body c-text">{value}{onPress ? <span className="c-mute" aria-hidden="true"> →</span> : null}</span>
    </>
  )
  return onPress ? (
    <button type="button" className="listRow press" onClick={onPress} data-testid={testId}>{body}</button>
  ) : (
    <div className="listRow" data-testid={testId}>{body}</div>
  )
}

export function RecordSheetBody() {
  const close = useSheetClose()
  const userId = useAuthStore((s) => s.userId)
  const recording = useRecordingCouple(userId)
  const bump = useFeedSignal((s) => s.bump)

  const [photos, setPhotos] = useState<StagedPhoto[]>([])
  const [dateOn, setDateOn] = useState<string>(() => todayKst(new Date()))
  const [dateTouched, setDateTouched] = useState(false)
  const [places, setPlaces] = useState<PlaceInput[]>([])
  const [memo, setMemo] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [dateText, setDateText] = useState('')
  const [saving, setSaving] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)

  // 시트가 닫힐 때 복사본 · 미리보기 주소를 놓는다(올리는 중에 닫혔다면 올리기가 끝난 뒤 `save`가 놓는다).
  const photosRef = useRef(photos)
  photosRef.current = photos
  const savingRef = useRef(false)
  savingRef.current = saving
  useEffect(() => () => { if (!savingRef.current) releaseStaged(photosRef.current) }, [])

  // 규칙 2 - 날짜 기본값은 사진 중 가장 이른 촬영 시각의 날짜. 사용자가 바꾸기 전까지만 따라간다.
  const capturedAts = useMemo(() => savablePhotos(photos).map((p) => p.capturedAt), [photos])
  const exifDate = useMemo(() => defaultDateOn(capturedAts, new Date()), [capturedAts])
  useEffect(() => { if (!dateTouched) setDateOn(exifDate) }, [dateTouched, exifDate])

  const hasExif = capturedAts.some((c) => c !== null)
  // 연결(active) 전에는 기록 쓰기가 닫힌다(R30-3 · R77-1). 대기(pending) 행이 있어도 닫힌다.
  const recordable = isRecordable(recording.couple)
  const coupleId = recordable ? recording.couple!.id : null
  const hasNamedPlace = places.some((p) => p.name.trim().length > 0)
  // 시간 칸 조건: stop 없음(이름 있는 장소 0) + 촬영 시각 전무(사진은 있다).
  const showTimeRow = savablePhotos(photos).length > 0 && !hasNamedPlace && !hasExif

  const stopPlan = useMemo(() => planStops(places, dateOn, capturedAts), [places, dateOn, capturedAts])
  const stopError = !stopPlan.ok ? stopTimeErrorMessage(stopPlan.error) : null
  const hasContent = savablePhotos(photos).length > 0 || memo.trim().length > 0
  const canSave = hasContent && coupleId !== null && userId !== null && isValidDateOn(dateOn) && stopError === null && !saving
  const closed = !recording.loading && !recordable

  const addPhotos = async (capture: boolean) => {
    if (IS_TRIAL_BUILD) useTrialDiag.getState().clearPhoto()
    try {
      const picked = await pickFeedPhotos(capture)
      if (picked.length === 0) return
      setPhotos((prev) => {
        const known = new Set(prev.filter((p) => !p.failed).map((p) => p.fileKey))
        const fresh = picked.filter((p) => !known.has(p.fileKey))
        releaseStaged(picked.filter((p) => known.has(p.fileKey))) // 이미 있는 사진의 새 복사본 · 미리보기 주소는 바로 놓는다
        // 같은 파일을 다시 골랐다면 읽기 실패 자리표시는 새 것으로 바뀐다.
        const freshKeys = new Set(fresh.map((p) => p.fileKey))
        return [...prev.filter((p) => !(p.failed && freshKeys.has(p.fileKey))), ...fresh]
      })
    } catch {
      showToast('사진을 고르지 못했어요')
    }
  }

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      releaseStaged(prev.filter((p) => p.fileKey === key))
      return prev.filter((p) => p.fileKey !== key)
    })
  }

  /** 읽기에 실패한 칸: 그 칸을 빼고 입구 시트를 다시 연다. */
  const repick = (key: string) => {
    removePhoto(key)
    setSourceOpen(true)
  }

  const updatePlace = (index: number, patch: Partial<PlaceInput>) =>
    setPlaces((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const save = async () => {
    const db = getSupabase() as unknown as Db | null
    if (!canSave || !coupleId || !userId || !db) return
    setSaving(true)
    try {
      const result = await saveFeedRecord(db, { coupleId, userId, dateOn, places, photos: savablePhotos(photos), memo })
      if (result.failedPhotos > 0) showToast(`일부 사진은 올리지 못했어요. ${result.failedPhotos}장은 다시 올려 주세요`)
      releaseStaged(photos)
      bump()
      close()
    } catch {
      showToast('기록하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  const confirmDate = () => {
    if (!isValidDateOn(dateText)) return
    setDateOn(dateText)
    setDateTouched(true)
    setPanel(null)
  }

  const openPlaces = () => {
    if (places.length === 0) setPlaces([{ name: '', arrivalClock: '' }])
    setPanel(panel === 'places' ? null : 'places')
  }

  if (closed) {
    return (
      <div className="recordSheet" data-testid="record-sheet-closed">
        <div className="sheetHeader">
          <button type="button" className="sheetClose press" aria-label="닫기" onClick={close}>✕</button>
          <h2 className="t-title c-text">{RECORD_COPY.title}</h2>
          <span className="sheetHeaderSpacer" aria-hidden="true" />
        </div>
        <div className="recordClosed">
          <p className="t-title c-text" data-testid="record-closed-title">{RECORD_COPY.closedTitle}</p>
          <p className="t-sub c-mute">{RECORD_COPY.closedBody}</p>
          <PrimaryButton label={RECORD_COPY.closedInvite} onClick={() => openInvite('intro')} />
        </div>
      </div>
    )
  }

  return (
    <div className="recordSheet" data-testid="record-sheet">
      <div className="sheetHeader">
        <button type="button" className="sheetClose press" aria-label="닫기" onClick={close}>✕</button>
        <h2 className="t-title c-text">{RECORD_COPY.title}</h2>
        <span className="sheetHeaderSpacer" aria-hidden="true" />
      </div>

      <div className="recordScroll">
        <div className="fieldGroup">
          <div className="rowBetween">
            <span className="t-kicker c-mute">PHOTOS</span>
            <span className="t-caption c-mute" data-testid="photo-count">{savablePhotos(photos).length > 0 ? `${savablePhotos(photos).length}장 골랐어요` : '사진을 골라 주세요'}</span>
          </div>
          <div className="thumbGrid">
            {photos.map((p) => p.failed ? (
              <button key={p.fileKey} type="button" className="thumb press" aria-label="다시 고르기" data-testid="repick-photo" onClick={() => repick(p.fileKey)}>
                <span className="t-caption c-sub">다시 고르기</span>
              </button>
            ) : (
              <button key={p.fileKey} type="button" className="thumb press" aria-label="이 사진 빼기" onClick={() => removePhoto(p.fileKey)}>
                <img src={p.uri} alt="" draggable={false} />
                <span className="thumbX" aria-hidden="true">✕</span>
              </button>
            ))}
            <button type="button" className="thumb addTile press" aria-label="사진 더 고르기" data-testid="pick-photos" onClick={() => setSourceOpen(true)}>
              <span aria-hidden="true">+</span>
            </button>
          </div>
          {savablePhotos(photos).length > 0 ? (
            <p className="t-caption c-mute" data-testid="exif-note">
              {hasExif && !dateTouched ? RECORD_COPY.exifFilled : hasExif ? '' : RECORD_COPY.noExif}
            </p>
          ) : null}
        </div>

        <div className="listGroup">
          <Row
            label="날짜"
            value={formatDateDotted(dateOn)}
            onPress={() => { setDateText(dateOn); setPanel(panel === 'date' ? null : 'date') }}
            testId="row-date"
          />
          {showTimeRow ? <Row label="시간" value={RECORD_COPY.timeNeeded} onPress={openPlaces} testId="row-time" /> : null}
          <Row label="장소" value={placesLabel(places)} onPress={openPlaces} testId="row-places" />
        </div>

        {panel === 'date' ? (
          <div className="fieldGroup">
            <input
              className="pillInput"
              value={dateText}
              onChange={(e) => setDateText(formatDateInput(e.target.value))}
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
              maxLength={10}
              aria-label="날짜"
              data-testid="date-input"
            />
            <button type="button" className="btn ghost press" disabled={!isValidDateOn(dateText)} onClick={confirmDate}>날짜 정하기</button>
          </div>
        ) : null}

        {panel === 'places' ? (
          <div className="fieldGroup" data-testid="places-panel">
            {places.map((p, i) => (
              <div key={i} className="placeRow">
                <input
                  className="pillInput placeName"
                  value={p.name}
                  onChange={(e) => updatePlace(i, { name: e.target.value })}
                  placeholder="장소 이름"
                  aria-label={`장소 ${i + 1} 이름`}
                />
                <input
                  className="pillInput placeClock"
                  value={p.arrivalClock ?? ''}
                  onChange={(e) => updatePlace(i, { arrivalClock: formatClockInput(e.target.value) })}
                  placeholder="14:20"
                  inputMode="numeric"
                  maxLength={5}
                  aria-label={`장소 ${i + 1} 도착 시각`}
                />
                <button type="button" className="placeRemove press" aria-label={`장소 ${i + 1} 빼기`} onClick={() => setPlaces((prev) => prev.filter((_, k) => k !== i))}>✕</button>
              </div>
            ))}
            <p className="t-caption c-mute">
              첫 장소는 도착 시각을 비우면 사진의 가장 이른 촬영 시각이 돼요. 둘째 장소부터는 도착 시각이 필요해요. 사진은 촬영 시각에 가장 가까운 앞선 장소에 붙어요
            </p>
            <button type="button" className="btn ghost press" onClick={() => setPlaces((prev) => [...prev, { name: '', arrivalClock: '' }])}>장소 더하기</button>
          </div>
        ) : null}

        <div className="fieldGroup">
          <span className="t-kicker c-mute">MEMO</span>
          <textarea
            className="memoInput"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="그날 남기고 싶은 말"
            aria-label="메모"
            data-testid="memo-input"
          />
        </div>
      </div>

      <div className="recordFooter">
        {hasContent && stopError !== null ? <p className="t-caption c-mute" data-testid="stop-time-error">{stopError}</p> : null}
        <PrimaryButton label={saving ? '남기는 중이에요' : '기록 남기기'} onClick={() => void save()} disabled={!canSave} />
        {IS_TRIAL_BUILD ? <PhotoDiag /> : null}
      </div>
      {sourceOpen ? (
        <PhotoSourceSheet testId="feed-attach-sheet" onAlbum={() => void addPhotos(false)} onCamera={() => void addPhotos(true)} onClosed={() => setSourceOpen(false)} />
      ) : null}
    </div>
  )
}
