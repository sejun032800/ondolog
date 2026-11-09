/**
 * H04 커플 · H14 해제 유예 - 설정 > 연인 · 커플 닉네임. 보드 `N-S-H1-Settings`(H04) · `N-S-H3-Settings`(H14) + patch7 ⓓ ⓔ. RN `app/settings-couple.tsx`의 웹판. 푸시 화면.
 *
 * 연결된 커플에게만 열린다 - 미연결이면 I01 안내 카드(`<CoupleGate>`)가 잠긴 문(초대하기)을 보인다(빈 화면 아님).
 * 연결 상태 카드 + 사귄 날짜 · 커플 닉네임 두 줄. 줄을 누르면 같은 화면이 입력 모습으로 바뀐다(← · 하드웨어 뒤로 가기 모두 줄 목록으로 돌아온다).
 *
 * **사귄 날짜를 바꾸면 한 번의 UPDATE로 `start_date_set_by` = 나 · `start_date_confirmed_by` = null**(`updateStartDateByMe`) - 상대는 다음에 앱에 들어올 때 A20 확인을 다시 본다(`useStartDateRecheck`).
 * 날짜 규칙은 A19와 같다(실제 있는 날짜 · KST 오늘까지). 안내("저장하면 상대가 다음에 앱에 들어올 때 날짜를 확인해요")는 patch7 ⓓ대로 **날짜 줄 바로 아래**에 둔다 - 바꾸기 전에 읽히게.
 * 커플 닉네임은 1~20자. 쓰는 칸은 `couples`의 이 네 칸뿐이다(`settingsCore` 표).
 *
 * **연결 해제(H14)**: [연결 해제] -> `settings-unlink`(문구 입력). 해제가 진행 중(유예 7일)이면 이 화면 자체가 유예 화면으로 바뀐다 - 개시자는 남은 날짜 + [해제 취소하기],
 * 상대는 남은 날짜 + 안내(취소 버튼 없음, 이유 문장). 해제 중 커플은 `couples.status = 'dissolving'`이라 `coupleStore`(active만)에는 잡히지 않으므로 유예 상태는 `dissolutionStore`가 따로 읽는다.
 * 취소는 `fn_cancel_dissolution` 호출 하나이고, 성공하면 토스트 "해제를 취소했어요"(B15).
 * B14: 커플 · 해제 상태를 읽기 전에는 I03 뼈대(빈 화면 뒤에 카드가 나타나지 않는다).
 */
import { useEffect, useState } from 'react'
import { cancelDissolution, DissolutionError, type DissolutionDb } from '@/services/dissolutionCore'
import { updateCoupleNickname, updateStartDateByMe } from '@/services/settingsCore'
import {
  NICKNAME_MAX, formatStartDateInput, isValidNickname, nicknameLength, parseStartDateInput, startDateIsoToInput, withGwa,
} from '@/utils/coupleStart'
import { canCancelDissolution } from '@/utils/dissolution'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { dotDate } from '@/utils/settingsRules'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { CoupleGate } from '../../components/CoupleGate'
import type { Nav } from '../../navigation'
import { useBackHandler } from '../../platform/backStack'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { showToast } from '../../stores/toastStore'
import { PrimaryButton } from '../../ui'
import { DissolutionGraceBody, GRACE_COPY } from './DissolutionGrace'
import { DangerButton, ListGroup, ListRow, SettingsFrame, SettingsSkeletonBlock } from './parts'

export const COUPLE_COPY = {
  title: '커플',
  save: '저장',
  dateLabel: '사귄 날짜',
  datePlaceholder: 'YYYY.MM.DD',
  dateHint: '저장하면 상대가 다음에 앱에 들어올 때 날짜를 확인해요',
  dateInvalid: '오늘까지의 날짜를 입력해주세요',
  nicknameLabel: '커플 닉네임',
  nicknameHint: '메인 화면 위에 보여요',
  nicknameTooLong: `${NICKNAME_MAX}자까지 쓸 수 있어요`,
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  retry: '다시 불러오기',
  unlink: '연결 해제',
  unlinkHint: (name: string) => `해제를 요청하면 7일 동안 취소할 수 있어요. 7일이 지나면 내가 남긴 기록만 지워지고 ${name}의 기록은 남아요.`,
  cancelDone: '해제를 취소했어요',
} as const

type Mode = 'view' | 'date' | 'nickname'

export function CoupleScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const coupleStatus = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const dissolution = useDissolutionStore((s) => s.dissolution)
  const dissolutionStatus = useDissolutionStore((s) => s.status)

  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [dateText, setDateText] = useState('')
  const [nicknameText, setNicknameText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    if (!userId) return
    void useCoupleStore.getState().refresh(userId)
    void useDissolutionStore.getState().refresh(userId)
  }
  // 열릴 때마다 다시 읽는다(RN useFocusEffect). 이미 읽은 값은 비우지 않는다.
  useEffect(reload, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const namedPartnerId = dissolution?.partnerId ?? partnerId
  useEffect(() => {
    const db = getSupabase()
    if (!namedPartnerId || !db) return
    let cancelled = false
    fetchProfile(db, namedPartnerId)
      .then((p) => { if (!cancelled) setPartnerName(p?.display_name ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [namedPartnerId])

  const backToRows = () => { setMode('view'); setError(null) }
  // 입력 모습에서는 하드웨어 뒤로 가기도 줄 목록으로(← 와 같다).
  useBackHandler(mode !== 'view' ? backToRows : undefined)

  const coupleKnown = coupleStatus === 'connected' || coupleStatus === 'disconnected'
  const dissolutionKnown = dissolutionStatus === 'loaded' || dissolutionStatus === 'error'

  // ── 읽는 중(B14) · 해제 상태를 못 읽음 ──
  if (!coupleKnown || !dissolutionKnown) {
    return (
      <SettingsFrame title={COUPLE_COPY.title} onBack={nav.back} testId="settings-couple">
        <SettingsSkeletonBlock rows={4} />
      </SettingsFrame>
    )
  }
  if (dissolutionStatus === 'error' && !dissolution) {
    return (
      <SettingsFrame title={COUPLE_COPY.title} onBack={nav.back} testId="settings-couple">
        <p className="t-sub c-sub" role="alert" data-testid="couple-load-error">{COUPLE_COPY.loadFailed}</p>
        <PrimaryButton label={COUPLE_COPY.retry} variant="ghost" onClick={reload} />
      </SettingsFrame>
    )
  }

  // ── 해제 유예 중(H14) - 개시자 · 상대 모두 ──
  if (dissolution) {
    const cancelNow = async () => {
      const db = getSupabase()
      if (!userId || !db || busy) return
      setBusy(true)
      setError(null)
      try {
        await cancelDissolution(db as unknown as DissolutionDb, dissolution.dissolutionId)
        await Promise.all([useDissolutionStore.getState().refresh(userId), useCoupleStore.getState().refresh(userId)])
        showToast(COUPLE_COPY.cancelDone)
      } catch (e) {
        setError(e instanceof DissolutionError ? e.message : '처리하지 못했어요. 다시 시도해주세요.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <SettingsFrame
        title={COUPLE_COPY.title}
        onBack={nav.back}
        testId="settings-couple"
        footer={
          canCancelDissolution(dissolution)
            ? <PrimaryButton label={GRACE_COPY.cancel} onClick={() => void cancelNow()} disabled={busy} />
            : <p className="t-sub c-mute graceReason" data-testid="grace-cancel-reason">{GRACE_COPY.cancelOnlyRequester}</p>
        }
      >
        <DissolutionGraceBody state={dissolution} partnerName={partnerName} onOpenPdf={() => nav.replace('magazine')} />
        {error ? <p className="t-sub c-sub" role="alert" data-testid="couple-error">{error}</p> : null}
      </SettingsFrame>
    )
  }

  // ── 입력 모습 ──
  const dateIso = parseStartDateInput(dateText, new Date())
  const nicknameOk = isValidNickname(nicknameText)

  const saveDate = async () => {
    const db = getSupabase()
    if (!userId || !coupleId || !db || dateIso === null) return
    setBusy(true)
    setError(null)
    try {
      await updateStartDateByMe(db, coupleId, userId, dateIso)
      await useCoupleStore.getState().refresh(userId)
      backToRows()
    } catch {
      setError(COUPLE_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const saveNickname = async () => {
    const db = getSupabase()
    if (!userId || !coupleId || !db || !nicknameOk) return
    setBusy(true)
    setError(null)
    try {
      await updateCoupleNickname(db, coupleId, nicknameText)
      await useCoupleStore.getState().refresh(userId)
      backToRows()
    } catch {
      setError(COUPLE_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'date') {
    const complete = dateText.length === 10
    return (
      <SettingsFrame
        title={COUPLE_COPY.dateLabel}
        onBack={backToRows}
        action={{ label: COUPLE_COPY.save, onPress: () => void saveDate(), disabled: dateIso === null || busy, testId: 'couple-date-save' }}
        testId="settings-couple-date"
      >
        <div className="fieldGroup">
          <label className="t-sub c-mute" htmlFor="couple-date">{COUPLE_COPY.dateLabel}</label>
          <input
            id="couple-date"
            className="setInput"
            value={dateText}
            inputMode="numeric"
            maxLength={10}
            placeholder={COUPLE_COPY.datePlaceholder}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setDateText(formatStartDateInput(e.target.value))}
            data-testid="couple-date-input"
          />
          <p className="t-sub c-mute" data-testid="couple-date-hint">{complete && dateIso === null ? COUPLE_COPY.dateInvalid : COUPLE_COPY.dateHint}</p>
        </div>
        {error ? <p className="t-sub c-sub" role="alert" data-testid="couple-error">{error}</p> : null}
      </SettingsFrame>
    )
  }

  if (mode === 'nickname') {
    return (
      <SettingsFrame
        title={COUPLE_COPY.nicknameLabel}
        onBack={backToRows}
        action={{ label: COUPLE_COPY.save, onPress: () => void saveNickname(), disabled: !nicknameOk || busy, testId: 'couple-nickname-save' }}
        testId="settings-couple-nickname"
      >
        <div className="fieldGroup">
          <label className="t-sub c-mute" htmlFor="couple-nickname">{COUPLE_COPY.nicknameLabel}</label>
          <input
            id="couple-nickname"
            className="setInput"
            value={nicknameText}
            placeholder="예) 늘봄"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => setNicknameText(e.target.value)}
            data-testid="couple-nickname-input"
          />
          <p className="t-sub c-mute" data-testid="couple-nickname-hint">
            {nicknameLength(nicknameText) > NICKNAME_MAX ? COUPLE_COPY.nicknameTooLong : COUPLE_COPY.nicknameHint}
          </p>
        </div>
        {error ? <p className="t-sub c-sub" role="alert" data-testid="couple-error">{error}</p> : null}
      </SettingsFrame>
    )
  }

  // ── 줄 목록(또는 미연결 I01 카드) ──
  const days = startDate ? computeDaysTogetherKst(startDate) : null
  const statusLine = partnerName ? `${withGwa(partnerName)} 연결됨` : '연결됨'
  const sinceLine = [days !== null ? `D+${days}` : null, startDate ? `${dotDate(startDate)}부터` : null].filter(Boolean).join(' · ')

  return (
    <SettingsFrame title={COUPLE_COPY.title} onBack={nav.back} testId="settings-couple">
      <CoupleGate>
        <div className="coupleCard" data-testid="couple-card">
          <div className="startCircles coupleCircles" aria-hidden="true"><i className="self" /><i className="other" /></div>
          <div className="coupleCardText">
            <p className="t-title c-text" data-testid="couple-status">{statusLine}</p>
            {sinceLine ? <p className="t-sub c-sub" data-testid="couple-since">{sinceLine}</p> : null}
          </div>
        </div>

        <ListGroup>
          <ListRow
            label={COUPLE_COPY.dateLabel}
            value={startDate ? startDateIsoToInput(startDate) : ''}
            description={COUPLE_COPY.dateHint}
            onPress={() => { setDateText(startDate ? startDateIsoToInput(startDate) : ''); setError(null); setMode('date') }}
            testId="couple-row-date"
          />
          <ListRow
            label={COUPLE_COPY.nicknameLabel}
            value={nickname ?? ''}
            onPress={() => { setNicknameText(nickname ?? ''); setError(null); setMode('nickname') }}
            testId="couple-row-nickname"
          />
        </ListGroup>

        <div className="fieldGroup">
          <DangerButton label={COUPLE_COPY.unlink} onClick={() => nav.push('settings-unlink')} testId="couple-unlink" />
          <p className="t-sub c-mute" data-testid="couple-unlink-hint">{COUPLE_COPY.unlinkHint(partnerName ?? '상대')}</p>
        </div>
      </CoupleGate>
    </SettingsFrame>
  )
}
