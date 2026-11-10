/**
 * A17 연인 초대 + A18 초대 코드 입력 (MASTER 9-1 화면 8). 보드 `N-S-A3-Onboarding` · A18은 patch7(`N-R43-App-States`)이 덮음.
 * RN `app/(onboarding)/invite.tsx` · `InviteSheet`(`couple-gate`)의 웹판 - 서버 일은 `couple/coupleApi.ts`(같은 RPC · 같은 순서).
 *
 * 두 모양: `mode='onboarding'`(로그인 직후 단계 1, [나중에 할게요] · [솔로예요]가 있다) · `mode='gate'`(I01에서 탭 위로 열림, ← 로 돌아가고 건너뛰기 없음).
 *  - 열기만 해서는 커플 행을 만들지 않는다(읽기만). 사람이 [초대 코드 만들기]를 눌러야 발급한다. 단 gate에서 [초대 코드 보내기]로 들어왔으면 이미 요청한 것이라 바로 발급한다(B12: 같은 문구를 한 번 더 묻지 않는다).
 *  - 코드를 보여 둔 채 기다리면 4초마다 읽어 상대가 입력했는지 안다. 연결되면(내가 입력했든 상대가 입력했든) 사귄 날짜(A19)로 간다. 두 번 가지 않는다.
 *  - 오류 문구는 `ConnectCoupleError.message` 그대로(A18 보드 문구).
 *  - 공유 문구는 브랜드 "온도록"(B6). 코드 입력 칸은 영문 대문자 키보드 + 자동 대문자(B9).
 *  - [나중에 할게요] · [솔로예요]는 같다: 진행 단계 COMPLETE를 올린 뒤 메인. 커플 행은 만들지 않는다(RN 그대로 - 솔로 기록 문제는 HANDOFF 열린 항목).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectCoupleError } from '@/services/coupleConnectCore'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { INVITE_CODE_LENGTH } from '../../codeInput'
import { completeOnboardingWithoutCouple, fetchExistingInvite, getOrCreateInvite, markInviteDoneAwaitingStartDate, redeemInviteCode } from '../../couple/coupleApi'
import { CodeBoxes } from './CodeBoxes'
import type { Nav } from '../../navigation'
import type { InviteStep } from '../../app/inviteEntry'
import type { NativeBridge } from '../../platform/bridge'
import { showToast } from '../../stores/toastStore'
import { OnboardingScreen, PrimaryButton } from '../../ui'

export const INVITE_POLL_MS = 4000

export const INVITE_COPY = {
  title: '연인을 초대해요',
  subtitle: '상대가 이 코드를 입력하면 두 사람이 연결돼요',
  myCode: 'MY CODE',
  make: '초대 코드 만들기',
  copy: '복사하기',
  share: '공유하기',
  received: '상대에게 코드를 받았어요',
  later: '나중에 할게요',
  solo: '솔로예요',
  enterTitle: '받은 코드를\n입력해주세요',
  connect: '연결하기',
  redeemError: '연결하지 못했어요. 다시 시도해주세요.',
  issueFailed: '코드를 만들지 못했어요. 다시 시도해주세요.',
  stepFailed: '처리하지 못했어요. 다시 시도해주세요.',
  copied: '코드를 복사했어요',
} as const

/** 공유 문구(B6 - 브랜드는 "온도록"). */
export function inviteShareMessage(code: string): string {
  return `온도록에서 연결해요! 초대 코드: ${code}`
}

type CodeState = { kind: 'checking' } | { kind: 'none' } | { kind: 'code'; code: string }

export function InviteScreen({ nav, bridge, mode = 'onboarding', initialStep = 'intro' }: {
  nav: Nav
  bridge: NativeBridge
  mode?: 'onboarding' | 'gate'
  initialStep?: InviteStep
}) {
  const userId = useAuthStore((s) => s.userId)
  const db = getSupabase()
  const [view, setView] = useState<'invite' | 'enter'>(initialStep === 'enter' ? 'enter' : 'invite')
  const [codeState, setCodeState] = useState<CodeState>({ kind: 'checking' })
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const movingRef = useRef(false)
  const navRef = useRef(nav)
  navRef.current = nav
  const gate = mode === 'gate'

  // 로그인이 없으면 이 화면에서 할 일이 없다(RN: 첫 화면으로).
  useEffect(() => {
    if (!userId) navRef.current.reset('intro')
  }, [userId])

  /** 연결이 확인됐다 - (온보딩이면) 진행 단계를 올리고 사귄 날짜(A19)로. 두 번 가지 않는다. */
  const goConnected = useCallback(async () => {
    if (!userId || !db || movingRef.current) return
    movingRef.current = true
    try {
      if (!gate) await markInviteDoneAwaitingStartDate(db, userId)
      navRef.current.enterAccount('start-date')
    } catch {
      movingRef.current = false
      setError(INVITE_COPY.stepFailed)
    }
  }, [userId, db, gate])

  const issue = useCallback(async () => {
    if (!userId || !db) return
    setBusy(true)
    setError(null)
    try {
      const result = await getOrCreateInvite(db, userId)
      if (result.status === 'connected') {
        void goConnected()
        return
      }
      setCodeState({ kind: 'code', code: result.couple.invite_code })
    } catch {
      setCodeState((s) => (s.kind === 'checking' ? { kind: 'none' } : s))
      setError(INVITE_COPY.issueFailed)
    } finally {
      setBusy(false)
    }
  }, [userId, db, goConnected])

  // 처음 열 때: 이미 발급한 코드가 있으면 보이고, 이미 연결됐으면 건너간다. 읽기만 한다(gate의 [초대 코드 보내기]로 왔으면 없을 때 바로 발급).
  useEffect(() => {
    if (!userId || !db) return
    let cancelled = false
    fetchExistingInvite(db, userId)
      .then((existing) => {
        if (cancelled) return
        if (existing?.status === 'connected') {
          void goConnected()
          return
        }
        if (existing) {
          setCodeState({ kind: 'code', code: existing.couple.invite_code })
          return
        }
        setCodeState({ kind: 'none' })
        if (gate && initialStep === 'intro') void issue()
      })
      .catch(() => {
        if (!cancelled) setCodeState({ kind: 'none' })
      })
    return () => { cancelled = true }
    // issue는 userId · db · goConnected에만 기대고, 처음 한 번만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, db])

  // 코드를 만들어 둔 채 기다리는 동안: 상대가 입력해 연결됐는지 4초마다 읽는다.
  const hasCode = codeState.kind === 'code'
  useEffect(() => {
    if (!userId || !db || !hasCode) return
    const timer = window.setInterval(() => {
      fetchExistingInvite(db, userId)
        .then((existing) => { if (existing?.status === 'connected') void goConnected() })
        .catch(() => { /* 일시 오류 - 다음 주기에 다시 읽는다. */ })
    }, INVITE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [userId, db, hasCode, goConnected])

  const code = codeState.kind === 'code' ? codeState.code : null

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      showToast(INVITE_COPY.copied)
    } catch {
      showToast(`내 코드: ${code}`)
    }
  }

  const shareCode = async () => {
    if (!code) return
    const result = await bridge.shareText(inviteShareMessage(code), INVITE_COPY.share)
    if (result === 'failed') showToast(`내 코드: ${code}`)
  }

  const redeem = async () => {
    if (!userId || !db || entered.length < INVITE_CODE_LENGTH || busy) return
    setBusy(true)
    setError(null)
    try {
      await redeemInviteCode(db, entered)
      await goConnected()
    } catch (e) {
      setError(e instanceof ConnectCoupleError ? e.message : INVITE_COPY.redeemError)
    } finally {
      setBusy(false)
    }
  }

  const skippingRef = useRef(false)
  const skip = async () => {
    if (!userId || !db || skippingRef.current) return
    skippingRef.current = true
    setError(null)
    try {
      await completeOnboardingWithoutCouple(db, userId)
      navRef.current.enterAccount('main')
    } catch {
      skippingRef.current = false
      setError(INVITE_COPY.stepFailed)
    }
  }

  if (!userId) return <div className="screen solid" />

  if (view === 'enter') {
    return (
      <OnboardingScreen
        animKey="enter"
        onBack={() => {
          setError(null)
          if (gate && initialStep === 'enter') nav.back()
          else setView('invite')
        }}
        title={INVITE_COPY.enterTitle}
        footer={<PrimaryButton label={INVITE_COPY.connect} onClick={() => void redeem()} disabled={busy || entered.length < INVITE_CODE_LENGTH} />}
      >
        <CodeBoxes value={entered} onChange={setEntered} />
        {error ? <p className="t-sub c-sub" style={{ marginTop: 14 }} role="alert" data-testid="invite-error">{error}</p> : null}
      </OnboardingScreen>
    )
  }

  return (
    <OnboardingScreen
      animKey="invite"
      onBack={gate ? nav.back : undefined}
      title={INVITE_COPY.title}
      subtitle={INVITE_COPY.subtitle}
      footer={gate ? undefined : (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28 }}>
          <button className="link press" style={{ color: 'var(--textSub)' }} onClick={() => void skip()}>{INVITE_COPY.later}</button>
          <button className="link press" style={{ color: 'var(--textSub)' }} onClick={() => void skip()}>{INVITE_COPY.solo}</button>
        </div>
      )}
    >
      <div className="codeBox">
        <p className="t-kicker c-mute" style={{ textAlign: 'center', fontSize: 11 }}>{INVITE_COPY.myCode}</p>
        {code ? (
          <>
            <p className="code c-text" style={{ userSelect: 'all' }} data-testid="invite-code" aria-label={`초대 코드 ${code}`}>{code.slice(0, 3)} {code.slice(3)}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton label={INVITE_COPY.copy} variant="ghost" onClick={() => void copyCode()} />
              <PrimaryButton label={INVITE_COPY.share} onClick={() => void shareCode()} />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 22 }}>
            <PrimaryButton label={INVITE_COPY.make} onClick={() => void issue()} disabled={busy || codeState.kind === 'checking'} />
          </div>
        )}
      </div>
      <button className="rowBtn press" onClick={() => { setError(null); setView('enter') }}>
        <span className="t-body c-text" style={{ fontSize: 15.5 }}>{INVITE_COPY.received}</span>
        <span className="c-mute">→</span>
      </button>
      {error ? <p className="t-sub c-sub" style={{ marginTop: 14 }} role="alert" data-testid="invite-error">{error}</p> : null}
    </OnboardingScreen>
  )
}
