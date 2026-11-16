/**
 * A19 사귄 날짜 + 커플 닉네임 · A20 상대가 정한 날짜 확인 (MASTER 9-1 화면 +). 보드 `N-S-A4-Onboarding`.
 * RN `app/(onboarding)/start-date.tsx`의 웹판 - 서버 일은 `couple/coupleApi.ts`(같은 규칙: 먼저 입력한 값 적용, 상대는 확인만).
 *
 * 열 때 커플 행을 읽어 셋 중 하나를 보인다:
 *   - 사귄 날짜가 아직 없다 -> A19: 날짜(KST 오늘까지, 미래 불가) + 커플 닉네임(1~20자). [시작하기]는 둘 다 맞을 때만 켜진다.
 *   - 상대가 이미 정했다(`start_date_set_by`가 내가 아니다) -> A20: 먼저 정한 값이 적용돼 있고 나는 확인만 한다([확인했어요]).
 *   - 내가 이미 정했다 -> 이 화면에서 할 일이 없다. 마무리만 하고 메인으로.
 * 연결된 커플이 없으면(해제 등) 메인으로.
 *
 * `mode='recheck'`(스택 `start-date-recheck`): 상대가 설정 > 커플에서 날짜를 고친 뒤 내가 다음에 앱에 들어올 때 `useStartDateRecheck`가 연다.
 * 이미 온보딩을 마친 사람이라 진행 단계는 쓰지 않는다 - 확인(`start_date_confirmed_by`)만 기록하고 메인으로 돌아간다. A19(입력)는 없다.
 * 마무리 = 진행 단계 COMPLETE(`advanceOnboardingStep`, 올리기만) 뒤 메인.
 */
import { useEffect, useRef, useState } from 'react'
import {
  NICKNAME_MAX, formatStartDateInput, isValidNickname, nicknameLength, parseStartDateInput, startDateIsoToInput, withGwa,
} from '@/utils/coupleStart'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { needsStartDateConfirm } from '@/utils/settingsRules'
import { getSupabase } from '../../auth/client'
import { fetchProfile } from '../../auth/finalize'
import { useAuthStore } from '../../auth/stores'
import { readCache } from '../../cache/deviceCache'
import { fetchCouple, markStartDateOnboardingComplete, saveStartDateAndNickname, setOrConfirmStartDate, startDateConflictKind, type StartConflictKind } from '../../couple/coupleApi'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { OnboardingScreen, PrimaryButton } from '../../ui'

export const START_COPY = {
  subtitle: '두 가지만 정하면 시작이에요',
  dateLabel: '사귄 날짜',
  datePlaceholder: 'YYYY.MM.DD',
  dateEmpty: '시작한 날이 1일째예요',
  dateInvalid: '오늘까지의 날짜를 입력해주세요',
  nicknameLabel: '커플 닉네임',
  nicknameHint: '메인 화면 위에 보여요',
  nicknameTooLong: `${NICKNAME_MAX}자까지 쓸 수 있어요`,
  start: '시작하기',
  confirmSubtitle: '먼저 정한 날짜로 시작해요',
  // R99-1: 조사 판정 없이 "님이"로 통일(이름 끝 글자에 따라 바뀌지 않는다).
  firstSetDate: (name: string) => `${name}님이 사귄 날짜를 먼저 정했어요`,
  firstSetNickname: (name: string) => `${name}님이 커플 닉네임을 먼저 정했어요`,
  firstSetBoth: (name: string) => `${name}님이 먼저 정했어요`,
  changedDate: (name: string) => `${name}님이 사귄 날짜를 바꿨어요`,
  confirm: '확인했어요',
  confirmNote: '날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  retry: '다시 시도',
} as const

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'enter' }
  | { kind: 'confirm'; date: string; nickname: string | null; differs?: StartConflictKind }

export function StartDateScreen({ nav, mode = 'onboarding' }: { nav: Nav; mode?: 'onboarding' | 'recheck' }) {
  const recheck = mode === 'recheck'
  const userId = useAuthStore((s) => s.userId)
  const db = getSupabase()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [coupleId, setCoupleId] = useState<string | null>(null)
  // 76-r F1: 기기에 남긴 상대 이름이 있으면 처음부터 그 이름으로(서버 이름이 오면 바꾼다).
  const [partnerName, setPartnerName] = useState(() => {
    const pid = useCoupleStore.getState().partnerId
    return (pid ? readCache<{ name: string }>(useAuthStore.getState().userId, 'name', pid)?.name : null) ?? '상대'
  })
  const [dateText, setDateText] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const finishingRef = useRef(false)
  const navRef = useRef(nav)
  navRef.current = nav

  useEffect(() => {
    if (!userId) navRef.current.reset('intro')
  }, [userId])

  /** 메인으로. 연결 정보(날짜 · 닉네임)는 메인이 바로 보이게 다시 읽는다. */
  const leaveToMain = async (uid: string) => {
    // A-4: 읽기가 끝난 뒤에 넘어간다 - 낡은 값(날짜 · 닉네임 없음)으로 메인을 그렸다가 1초 뒤에 바뀌지 않게.
    await useCoupleStore.getState().refresh(uid).catch(() => undefined)
    if (recheck) navRef.current.reset('main')
    else navRef.current.enterAccount('main')
  }

  /** 마무리 - (온보딩이면) 진행 단계 COMPLETE 뒤 메인. 재표시 길은 진행 단계를 쓰지 않는다. */
  const finish = async (uid: string) => {
    if (finishingRef.current || !db) return
    finishingRef.current = true
    try {
      if (!recheck) await markStartDateOnboardingComplete(db, uid)
      await leaveToMain(uid)
    } catch {
      finishingRef.current = false
      throw new Error('finish-failed')
    }
  }

  useEffect(() => {
    if (!userId || !db) return
    let cancelled = false
    setPhase({ kind: 'loading' })
    ;(async () => {
      try {
        await useCoupleStore.getState().refresh(userId)
        if (cancelled) return
        const couple = useCoupleStore.getState()
        if (couple.status !== 'connected' || !couple.coupleId) {
          // 연결된 커플이 없다(해제 등) - 이 화면에서 할 일이 없다.
          navRef.current.reset('main')
          return
        }
        setCoupleId(couple.coupleId)
        if (couple.partnerId) {
          const partner = await fetchProfile(db, couple.partnerId).catch(() => null)
          if (!cancelled && partner?.display_name) setPartnerName(partner.display_name)
        }
        const row = await fetchCouple(db, couple.coupleId)
        if (cancelled) return
        if (recheck) {
          // 재표시 길 - 확인할 것이 남아 있을 때만 A20. 아니면 할 일이 없다(진행 단계는 건드리지 않는다).
          if (needsStartDateConfirm(row, userId)) {
            setPhase({ kind: 'confirm', date: row.relationship_start_date as string, nickname: row.nickname })
          } else {
            navRef.current.reset('main')
          }
          return
        }
        if (row.relationship_start_date && row.start_date_set_by !== userId) {
          setPhase({ kind: 'confirm', date: row.relationship_start_date, nickname: row.nickname })
          return
        }
        if (row.relationship_start_date) {
          // 내가 이미 정했다.
          await finish(userId)
          return
        }
        if (row.nickname) setNickname(row.nickname) // 이미 저장된 값이 있으면 미리 채운다
        setPhase({ kind: 'enter' })
      } catch {
        if (!cancelled) setPhase({ kind: 'error' })
      }
    })()
    return () => { cancelled = true }
    // finish는 ref · db · recheck만 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadKey])

  if (!userId || phase.kind === 'loading') return <div className="screen solid" />

  if (phase.kind === 'error') {
    return (
      <OnboardingScreen
        title={START_COPY.loadFailed}
        footer={<PrimaryButton label={START_COPY.retry} onClick={() => setReloadKey((k) => k + 1)} />}
      />
    )
  }

  if (phase.kind === 'confirm') {
    const days = computeDaysTogetherKst(phase.date)
    // R99-1: 설정에서 바뀐 값이면(재표시 길) "바꿨어요", 처음 연결이면 "먼저 정했어요"(내 입력과 무엇이 달랐는지에 맞춤 - 달랐던 게 없으면 상대가 이미 정해 둔 값: 닉네임이 있으면 둘 다).
    const firstKind: StartConflictKind = phase.differs ?? (phase.nickname ? 'both' : 'date')
    const confirmTitle = recheck
      ? START_COPY.changedDate(partnerName)
      : firstKind === 'nickname' ? START_COPY.firstSetNickname(partnerName) : firstKind === 'both' ? START_COPY.firstSetBoth(partnerName) : START_COPY.firstSetDate(partnerName)
    const confirm = async () => {
      if (!db || !coupleId || busy) return
      setBusy(true)
      setError(null)
      try {
        // 기존 규칙: 이미 날짜가 있으면 확인만 기록한다(`start_date_confirmed_by`).
        await setOrConfirmStartDate(db, coupleId, userId, phase.date)
        await finish(userId)
      } catch {
        setError(START_COPY.saveFailed)
      } finally {
        setBusy(false)
      }
    }
    return (
      <OnboardingScreen
        animKey="confirm"
        title={confirmTitle}
        subtitle={recheck ? startDateIsoToInput(phase.date) : START_COPY.confirmSubtitle}
        footer={
          <>
            {error ? <p className="t-sub c-sub" style={{ textAlign: 'center' }} role="alert" data-testid="start-error">{error}</p> : null}
            <PrimaryButton label={START_COPY.confirm} onClick={() => void confirm()} disabled={busy} />
          </>
        }
      >
        <div className="codeBox" style={{ marginTop: 32, textAlign: 'center' }}>
          <p className="t-kicker c-mute" style={{ fontSize: 11 }}>SINCE</p>
          {/* 재표시 길은 새 날짜가 제목 아래 둘째 줄에 이미 있다 - 같은 값을 두 번 보이지 않는다. */}
          {recheck ? null : <p className="code c-text" style={{ fontSize: 40, letterSpacing: -1, paddingLeft: 0, margin: '14px 0' }} data-testid="start-since-date">{startDateIsoToInput(phase.date)}</p>}
          <p className="t-body c-sub" data-testid="start-since-sub">{`오늘 D+${days}${phase.nickname ? ` · ${phase.nickname}` : ''}`}</p>
        </div>
        <p className="t-sub c-mute" style={{ marginTop: 24 }} data-testid="start-confirm-note">{START_COPY.confirmNote}</p>
      </OnboardingScreen>
    )
  }

  // A19
  const now = new Date()
  const iso = parseStartDateInput(dateText, now)
  const dateComplete = dateText.length === 10
  const nicknameOk = isValidNickname(nickname)
  const canStart = iso !== null && nicknameOk && !busy
  const dateHint = iso !== null
    ? `${START_COPY.dateEmpty} · 오늘 D+${computeDaysTogetherKst(iso, now)}`
    : dateComplete ? START_COPY.dateInvalid : START_COPY.dateEmpty

  const start = async () => {
    if (!db || !coupleId || iso === null || !nicknameOk || busy) return
    setBusy(true)
    setError(null)
    try {
      const row = await saveStartDateAndNickname(db, coupleId, userId, iso, nickname)
      const differs = startDateConflictKind(row, { userId, date: iso, nickname })
      if (differs && row.relationship_start_date) {
        // 상대가 먼저 정했고 내 입력과 다르다 - 조용히 버리지 않고 적용된 값을 알린 뒤 확인받는다.
        setPhase({ kind: 'confirm', date: row.relationship_start_date, nickname: row.nickname, differs })
        return
      }
      await finish(userId)
    } catch {
      setError(START_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingScreen
      animKey="enter"
      footer={
        <>
          {error ? <p className="t-sub c-sub" style={{ textAlign: 'center' }} role="alert" data-testid="start-error">{error}</p> : null}
          <PrimaryButton label={START_COPY.start} onClick={() => void start()} disabled={!canStart} />
        </>
      }
    >
      <div className="startCircles" aria-hidden="true"><i className="self" /><i className="other" /></div>
      <h1 className="t-display c-text" style={{ textAlign: 'center', marginTop: 28 }} data-testid="start-headline">{`${withGwa(partnerName)} 연결됐어요`}</h1>
      <p className="t-sub c-sub" style={{ textAlign: 'center', marginTop: 12 }}>{START_COPY.subtitle}</p>

      <div className="group">
        <p className="t-sub c-mute label">{START_COPY.dateLabel}</p>
        <input
          className="input"
          value={dateText}
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={START_COPY.datePlaceholder}
          aria-label={START_COPY.dateLabel}
          data-testid="start-date-input"
          onChange={(e) => setDateText(formatStartDateInput(e.target.value))}
        />
        <p className="t-sub c-mute" style={{ marginTop: 10 }} data-testid="start-date-hint">{dateHint}</p>
      </div>

      <div className="group">
        <p className="t-sub c-mute label">{START_COPY.nicknameLabel}</p>
        <input
          className="input"
          value={nickname}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="예) 늘봄"
          // A-18: 한글 기본 자판 · 자동 대문자 끔(코드 칸의 영문 속성이 옮겨 붙지 않게 명시한다)
          lang="ko"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={START_COPY.nicknameLabel}
          data-testid="start-nickname-input"
          onChange={(e) => setNickname(e.target.value)}
        />
        <p className="t-sub c-mute" style={{ marginTop: 10 }} data-testid="start-nickname-hint">
          {nicknameLength(nickname) > NICKNAME_MAX ? START_COPY.nicknameTooLong : START_COPY.nicknameHint}
        </p>
      </div>
    </OnboardingScreen>
  )
}
