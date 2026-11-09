/**
 * H06 재검사 흐름(A04~A07 재사용) - 설정 > 성격 프로필 > [5문항 다시 하기] 확인 뒤. RN `mbti?retest=1` -> `love-quiz?retest=1` + `useRetestFinalize`의 웹판.
 * 경로 `retest` **하나** 안에서 두 단계(MBTI -> 5문항)를 온보딩의 같은 화면 부품(`MbtiScreen` · `LoveQuizScreen`)으로 보인다 - 마지막 문항 뒤 A08(간략 결과)으로 가는 대신 **바로 저장**한다.
 * 한 경로 안이라 끝나면 `nav.back()` 한 번으로 H05로 돌아온다(RN `dismissTo('/settings-personality')`와 같은 자리).
 *
 * 저장은 `@/services/settingsCore.retestPersonality` = 027 `fn_complete_retest` **함수 호출 하나**(채점은 결정론 엔진이 이미 했고 결과를 인자로 넘긴다).
 * 앱은 `personality_assessments` · `personality_profiles`를 직접 쓰지 않는다. `23505` = 이미 사용(`already-used`, 다시 시도 없음 - 돌아가기만).
 * 끊겼던 재검사를 서버가 기존 행으로 마저 끝낸 경우(`recovered`)에는 "이전에 하던 재검사를 마저 저장했어요" 알림을 먼저 보인다 - 저장된 결과가 방금 답한 것과 다를 수 있다(내부 결정, RN 그대로).
 * 화면 상태는 글자로만 보인다(스피너 없음). 저장 중에는 뒤로 가기를 삼킨다. 성공하면 메모리 답을 비운다(저장소에 남기지 않는다).
 */
import { useMemo, useRef, useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { RetestError, retestPersonality, type RetestErrorKind } from '@/services/settingsCore'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import type { Nav, ScreenName } from '../../navigation'
import { useBackHandler } from '../../platform/backStack'
import { LoveQuizScreen, MbtiScreen } from '../../screens'
import { OnboardingScreen, PrimaryButton } from '../../ui'

export const RETEST_COPY = {
  saving: '결과를 저장하고 있어요',
  failed: '저장하지 못했어요. 다시 시도해주세요.',
  retry: '다시 시도',
  back: '돌아가기',
  recoveredTitle: '이전에 하던 재검사를 마저 저장했어요',
  recoveredNote: '방금 답한 내용과 저장된 결과가 다를 수 있어요. 성격 프로필에서 확인해주세요.',
  ok: '확인',
} as const

type Phase =
  | { kind: 'flow'; step: 'mbti' | 'quiz' }
  | { kind: 'saving' }
  | { kind: 'error'; errorKind: RetestErrorKind; message: string }
  | { kind: 'recovered' }

export function RetestScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const [phase, setPhase] = useState<Phase>({ kind: 'flow', step: 'mbti' })
  const savingRef = useRef(false)

  // 저장 중에는 뒤로 가기를 삼킨다(저장이 끝나기 전에 화면을 떠나지 않는다).
  useBackHandler(phase.kind === 'saving' ? () => {} : undefined)

  const run = async () => {
    const db = getSupabase()
    const { mbti, mbtiSelfReported, q1, q2, q3, q4, q5, result } = useSessionStore.getState()
    if (!db || !userId || savingRef.current) return
    if (!mbti || !q1 || !q2 || !q3 || !q4 || !q5 || !result) return // 답이 덜 찼으면 아무것도 보내지 않는다.
    savingRef.current = true
    setPhase({ kind: 'saving' })
    try {
      const outcome = await retestPersonality(db, userId, { mbti, mbtiSelfReported, q1, q2, q3, q4, q5, result })
      useSessionStore.getState().resetSession()
      if (outcome.recovered) setPhase({ kind: 'recovered' })
      else nav.back()
    } catch (e) {
      const err = e instanceof RetestError ? e : new RetestError('failed')
      setPhase({ kind: 'error', errorKind: err.kind, message: err.message })
    } finally {
      savingRef.current = false
    }
  }

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // 온보딩 화면 부품이 `nav.push('quiz')` · `nav.push('brief')`로 다음을 부르는 것을 이 경로 안의 단계 이동 · 저장으로 바꿔 받는다.
  const flowNav = useMemo<Nav>(() => ({
    ...nav,
    push: (name: ScreenName) => {
      if (name === 'quiz') setPhase({ kind: 'flow', step: 'quiz' })
      else if (name === 'brief') void run()
    },
    // 5문항 첫 문항에서 ← = MBTI 단계로. MBTI 단계에서 ← = 앞 화면(H05).
    back: () => {
      const p = phaseRef.current
      if (p.kind === 'flow' && p.step === 'quiz') setPhase({ kind: 'flow', step: 'mbti' })
      else nav.back()
    },
    // run은 매 렌더 새로 만들어지지만 userId · nav · 저장소만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nav, userId])

  if (phase.kind === 'recovered') {
    return (
      <OnboardingScreen title={RETEST_COPY.recoveredTitle} footer={<PrimaryButton label={RETEST_COPY.ok} onClick={nav.back} />}>
        <p className="t-body c-sub" style={{ marginTop: 16 }} data-testid="retest-recovered-note">{RETEST_COPY.recoveredNote}</p>
      </OnboardingScreen>
    )
  }
  if (phase.kind === 'saving') {
    return <OnboardingScreen title={RETEST_COPY.saving} />
  }
  if (phase.kind === 'error') {
    return (
      <OnboardingScreen
        title={phase.message}
        footer={
          phase.errorKind === 'failed'
            ? <PrimaryButton label={RETEST_COPY.retry} onClick={() => void run()} />
            : <PrimaryButton label={RETEST_COPY.back} onClick={nav.back} />
        }
      />
    )
  }
  return phase.step === 'mbti' ? <MbtiScreen nav={flowNav} /> : <LoveQuizScreen nav={flowNav} />
}
