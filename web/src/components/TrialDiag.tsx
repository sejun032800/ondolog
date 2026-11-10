/**
 * 시험 빌드 전용 진단 줄(74-h2 ①-c): 마지막 실패의 단계 이름 · 짧은 분류 · 접수 순번. 작은 글씨. 코드 · 주소 · 토큰 · 이메일은 없다.
 * 부르는 쪽은 `{IS_TRIAL_BUILD ? <TrialDiag /> : null}`로만 쓴다 - 운영 빌드에서는 이 파일 전체가 번들에서 빠진다.
 */
import { useTrialDiag, type DiagStep } from '../platform/trialDiag'

const STEP_LABEL: Record<DiagStep, string> = {
  link: '링크 받음',
  exchange: '코드 교환',
  finalize: '계정 마무리',
  state: '상태 읽기',
  detail: '결과 읽기',
}

export function TrialDiag() {
  const last = useTrialDiag((s) => s.last)
  if (!last) return null
  return (
    <p className="trialDiag" data-testid="trial-diag">
      {`진단 · ${STEP_LABEL[last.step]} · ${last.kind} · #${last.seq}`}
    </p>
  )
}
