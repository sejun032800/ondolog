/**
 * E03 데이트 상세 - 스택 화면(왼쪽 위 ←). 보드 `N-E03-Date-Detail` + CURRENT.md 바뀐 점(사진 · 메모에 `⋯` 삭제 진입점 + 확인 시트).
 * RN `app/date/[id]/index.tsx`의 웹판. 경로 `date-detail?id=`.
 *
 * - 머리: 날짜 말로 · 지역(있을 때) · 제목 · "14:20-20:05 · 사진 N · 메모 N". `dates.title`은 생성 단계가 쓰는 값이라 앱이 지어내지 않는다.
 * - stop별 타임라인: 시각(저장된 도착 시각 그대로) · 장소 · 사진. 사진 배치는 규칙 4로 다시 계산한다(`feedData.ts`). 장소 줄 -> E15.
 * - 메모는 데이트 단위(규칙 5) - 머리 아래 한 블록.
 * - 사진을 누르면 크게 보기(`PhotoViewer`, 확대 직접 구현).
 * - 사진 더하기: E10 화면은 없앴다(CURRENT.md) - 버튼이 바로 시스템 사진 선택기를 열고, 고른 사진은 이 데이트에 곧바로 올린다(날짜 고정, 장소 · 메모 없음).
 * - 본인 기록 삭제(R30-1): **내가 올린** 사진 · 메모에만 `⋯`가 보인다(남의 것에는 진입점 0). `⋯` -> 확인 시트(되돌릴 수 없고, 이미 발행된 호에서는 지워지지 않는다) -> `fn_delete_own_entry` RPC만.
 */
import { useState } from 'react'
import { canDeleteEntry, deleteOwnEntry, StopTimeInputError, type Db } from '@/services/dateRecordApi'
import { buildDateHead, kstTimeOf } from '@/utils/dateRecord'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { PhotoDiag } from '../../components/PhotoDiag'
import { PhotoSourceSheet } from '../../components/PhotoSourceSheet'
import { Sheet, useSheetClose } from '../../components/Sheet'
import { Skeleton } from '../../components/Skeleton'
import { PhotoViewer, type ViewerPhoto } from '../../components/PhotoViewer'
import { IS_TRIAL_BUILD } from '../../config/env'
import { useTrialDiag } from '../../platform/trialDiag'
import { useRouteParams, type Nav } from '../../navigation'
import { showToast } from '../../stores/toastStore'
import { useSheetStore } from '../../stores/sheetStore'
import { isRecordable, useDateDetail, useFeedSignal, useRecordingCouple, type DetailStop } from './feedData'
import { SOLO_CLOSED_TITLE } from './FeedView'
import { pickFeedPhotos, releaseStaged, type StagedPhoto } from './feedPhotoStage'
import { saveFeedRecord, savablePhotos } from './feedSave'

type Pending = { id: string; kind: 'photo' | 'memo' }

export const DELETE_COPY = {
  photoTitle: '이 사진을 지울까요?',
  memoTitle: '이 메모를 지울까요?',
  note: (kind: Pending['kind']) => `지운 ${kind === 'memo' ? '메모는' : '사진은'} 되돌릴 수 없어요. 이미 발행된 호에서는 지워지지 않아요.`,
} as const

/** 확인 시트 본문(I05 문구). `⋯`를 누르면 열린다. */
function DeleteSheetBody({ kind, busy, onConfirm }: { kind: Pending['kind']; busy: boolean; onConfirm: () => void }) {
  const close = useSheetClose()
  return (
    <div className="deleteSheet" data-testid="delete-confirm">
      <h2 className="dialogTitle">{kind === 'memo' ? DELETE_COPY.memoTitle : DELETE_COPY.photoTitle}</h2>
      <p className="dialogMsg">{DELETE_COPY.note(kind)}</p>
      <div className="dialogBtns">
        <button type="button" className="dBtn danger press" disabled={busy} onClick={onConfirm} data-testid="confirm-yes">지우기</button>
        <button type="button" className="dBtn press" disabled={busy} onClick={close} data-testid="confirm-no">취소</button>
      </div>
    </div>
  )
}

/** 내 기록의 `⋯`. 눌러도 아래 카드(사진 보기)가 같이 눌리지 않는다. */
function MoreButton({ label, testId, onOpen }: { label: string; testId: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="moreBtn press"
      aria-label={label}
      data-testid={testId}
      onClick={(e) => { e.stopPropagation(); onOpen() }}
    >
      <span aria-hidden="true">⋯</span>
    </button>
  )
}

function StopPhotos({ stop, urls, viewerId, onView, onMore }: {
  stop: DetailStop
  urls: Record<string, string>
  viewerId: string | null
  onView: (entryId: string) => void
  onMore: (entryId: string) => void
}) {
  if (stop.photos.length === 0) return null
  const single = stop.photos.length === 1
  return (
    <div className="stopPhotos">
      {stop.photos.map((p) => {
        const url = p.storage_path ? urls[p.storage_path] : undefined
        return (
          <div key={p.id} className={`stopPhoto ${single ? 'single' : 'pair'}`}>
            <button type="button" className="stopPhotoOpen press" aria-label="사진 크게 보기" data-testid={`photo-${p.id}`} onClick={() => onView(p.id)}>
              {url ? <img src={url} alt="사진" draggable={false} /> : null}
            </button>
            {canDeleteEntry(p, viewerId) ? <MoreButton label="내 사진 더보기" testId={`more-photo-${p.id}`} onOpen={() => onMore(p.id)} /> : null}
          </div>
        )
      })}
    </div>
  )
}

export function DateDetailScreen({ nav }: { nav: Nav }) {
  const param = useRouteParams()
  const dateId = param('id')
  const viewerId = useAuthStore((s) => s.userId)
  const detail = useDateDetail(dateId, viewerId)
  const bump = useFeedSignal((s) => s.bump)
  const [pending, setPending] = useState<Pending | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [viewerAt, setViewerAt] = useState<number | null>(null)

  // 연결(active) 전에는 사진 더하기도 닫힌다(R30-3 · R77-1) - 이미 저장된 기록은 보이되 새 기록은 쓰지 않는다.
  const recording = useRecordingCouple(viewerId)
  const canAdd = isRecordable(recording.couple)

  const date = detail.date
  const allPhotos = detail.stops.flatMap((s) => s.photos)
  const cover = allPhotos.find((p) => p.storage_path && detail.urls[p.storage_path])
  const coverUrl = cover?.storage_path ? detail.urls[cover.storage_path] : undefined
  const head = date ? buildDateHead(date, detail.photoCapturedAts, detail.photoTotal, detail.memos.length) : null
  const viewerPhotos: ViewerPhoto[] = allPhotos.map((p) => ({ id: p.id, url: p.storage_path ? detail.urls[p.storage_path] : undefined, label: '사진' }))

  const confirmDelete = async () => {
    if (!pending || deleting) return
    const db = getSupabase() as unknown as Db | null
    setDeleting(true)
    try {
      if (!db) throw new Error('연결할 수 없어요')
      await deleteOwnEntry(db, pending.id)
      setPending(null)
      bump()
      await detail.reload()
    } catch {
      setPending(null)
      showToast('지우지 못했어요')
    } finally {
      setDeleting(false)
    }
  }

  const addPhotos = async (capture: boolean) => {
    if (!date || adding || !canAdd) return
    const db = getSupabase() as unknown as Db | null
    if (!db || !viewerId) return
    if (IS_TRIAL_BUILD) useTrialDiag.getState().clearPhoto()
    let picked: StagedPhoto[] = []
    try {
      picked = await pickFeedPhotos(capture)
    } catch {
      showToast('사진을 고르지 못했어요')
      return
    }
    if (picked.length === 0) return
    const usable = savablePhotos(picked)
    if (usable.length === 0) {
      showToast('사진을 고르지 못했어요')
      return
    }
    setAdding(true)
    try {
      const result = await saveFeedRecord(db, { coupleId: date.couple_id, userId: viewerId, dateOn: date.date_on, places: [], photos: usable, memo: '' })
      const failed = result.failedPhotos + (picked.length - usable.length)
      if (failed > 0) showToast(`일부 사진은 올리지 못했어요. ${failed}장은 다시 올려 주세요`)
      bump()
      await detail.reload()
    } catch (e) {
      showToast(e instanceof StopTimeInputError ? e.message : '사진을 올리지 못했어요')
    } finally {
      releaseStaged(picked)
      setAdding(false)
    }
  }

  const viewPhoto = (entryId: string) => {
    const i = allPhotos.findIndex((p) => p.id === entryId)
    if (i >= 0) setViewerAt(i)
  }

  return (
    <div className="screen solid detailScreen" data-testid="date-detail">
      <div className="detailScroll">
        <div className="detailHero">
          {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : null}
          <div className="detailHeroFade" aria-hidden="true" />
        </div>

        <div className="detailHead">
          {detail.loading ? (
            <div className="detailSkeleton" data-testid="detail-skeleton">
              <Skeleton width="40%" height={12} />
              <Skeleton width="70%" height={28} />
            </div>
          ) : detail.notFound ? (
            <p className="t-body c-sub">이 데이트를 찾을 수 없어요</p>
          ) : detail.error ? (
            <p className="t-body c-sub">데이트를 불러오지 못했어요</p>
          ) : head && date ? (
            <div className="detailHeadText">
              {head.kicker ? <span className="t-caption c-sub">{head.kicker}</span> : null}
              <h1 className="t-display c-text" data-testid="detail-title">{head.title}</h1>
              <span className="t-sub c-mute">{head.meta}</span>
            </div>
          ) : null}
        </div>

        {date && !detail.loading ? (
          <div className="detailBody">
            {detail.memos.length > 0 ? (
              <div className="detailMemos" data-testid="detail-memos">
                <span className="t-kicker c-mute">MEMO</span>
                {detail.memos.map((m) => (
                  <div key={m.id} className="memoItem">
                    <div className="memoQuote">
                      <span className="memoRule" aria-hidden="true" />
                      <div className="memoBody">
                        <p className="memoText">{m.text_content ?? ''}</p>
                        {detail.names[m.author_id] ? <span className="t-caption c-mute">{`— ${detail.names[m.author_id]}`}</span> : null}
                      </div>
                      {canDeleteEntry(m, viewerId) ? (
                        <MoreButton label="내 메모 더보기" testId={`more-memo-${m.id}`} onOpen={() => setPending({ id: m.id, kind: 'memo' })} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="stopTimeline" data-testid="stop-timeline">
              {detail.stops.map((stop) => (
                <div key={stop.id} className="stopRow" data-testid={`stop-${stop.seq}`}>
                  <span className="stopTime">{kstTimeOf(stop.arrived_at) ?? ''}</span>
                  <div className="stopRail"><i className="stopDot" /><i className="stopLine" /></div>
                  <div className="stopBody">
                    <button
                      type="button"
                      className="stopName press"
                      aria-label={stop.place_name ? `${stop.place_name} 장소 고치기` : '장소 이름 더하기'}
                      onClick={() => nav.push('stop-edit', { params: { id: date.id, stop: stop.id } })}
                    >
                      {stop.place_name ? <span className="stopNameText">{stop.place_name}</span> : <span className="stopNameEmpty">장소 이름 더하기</span>}
                      <span className="t-caption c-mute">고치기</span>
                    </button>
                    <StopPhotos stop={stop} urls={detail.urls} viewerId={viewerId} onView={viewPhoto} onMore={(id) => setPending({ id, kind: 'photo' })} />
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn ghost press" disabled={adding} aria-disabled={!canAdd || undefined} onClick={() => { if (canAdd) setSourceOpen(true); else if (!recording.loading) useSheetStore.getState().open('record') }} data-testid="detail-add-photos">
              {adding ? '올리는 중이에요' : '사진 더하기'}
            </button>
            {IS_TRIAL_BUILD ? <PhotoDiag /> : null}
            {!canAdd && !recording.loading ? <p className="t-caption c-mute" data-testid="detail-add-closed">{SOLO_CLOSED_TITLE}</p> : null}
          </div>
        ) : null}
      </div>

      <button type="button" className="detailBack press" aria-label="뒤로" onClick={nav.back}>←</button>

      {viewerAt !== null ? <PhotoViewer photos={viewerPhotos} startIndex={viewerAt} title={head?.title} onClose={() => setViewerAt(null)} /> : null}

      {sourceOpen ? (
        <PhotoSourceSheet testId="detail-attach-sheet" onAlbum={() => void addPhotos(false)} onCamera={() => void addPhotos(true)} onClosed={() => setSourceOpen(false)} />
      ) : null}

      {pending ? (
        <Sheet variant="auto" testId="sheet-delete-entry" onClosed={() => setPending(null)}>
          <DeleteSheetBody kind={pending.kind} busy={deleting} onConfirm={() => void confirmDelete()} />
        </Sheet>
      ) : null}
    </div>
  )
}
