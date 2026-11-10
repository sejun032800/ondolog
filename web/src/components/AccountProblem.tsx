/**
 * 안내 화면(빈 화면 0 원칙, 74-h2 ⓪-c): 로그인은 돼 있는데 서버 상태를 못 읽었거나 이 화면이 모르는 상태일 때, 바탕만 보이는 대신 이 화면을 보인다.
 * [다시 시도] · [로그아웃]. 시험 빌드에서만 단계 이름이 작게 보인다(`TrialDiag`).
 * `AccountProblemView`는 그리는 부분(A14가 자기 화면 안에서도 쓴다), `AccountProblemHost`는 앱 전체 덮개(부팅 · 로그인 뒤 라우팅 실패).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { IS_TRIAL_BUILD } from '../config/env'
import { safeKind, useTrialDiag } from '../platform/trialDiag'
import { logoutToStart } from '../features/settings/accountActions'
import type { Nav } from '../navigation'
import { useAccountProblemStore } from '../stores/accountProblemStore'
import { PrimaryButton } from '../ui'
import { TrialDiag } from './TrialDiag'

export const ACCOUNT_PROBLEM_COPY = {
  title: '계정 정보를 불러오지 못했어요',
  body: '잠시 뒤에 다시 시도해주세요. 계속 안 되면 로그아웃했다가 다시 로그인해주세요.',
  retry: '다시 시도',
  logout: '로그아웃',
} as const

export function AccountProblemView({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return (
    <div className="screen solid" data-testid="account-problem">
      <div className="content" style={{ paddingTop: 'calc(var(--top) + 96px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 className="t-display c-text pre" style={{ fontSize: 26, lineHeight: '36px' }}>{ACCOUNT_PROBLEM_COPY.title}</h1>
        <p className="t-sub c-sub" role="alert" style={{ lineHeight: '23px' }}>{ACCOUNT_PROBLEM_COPY.body}</p>
        {IS_TRIAL_BUILD ? <TrialDiag /> : null}
      </div>
      <div className="footer">
        <PrimaryButton label={ACCOUNT_PROBLEM_COPY.retry} onClick={onRetry} />
        <PrimaryButton label={ACCOUNT_PROBLEM_COPY.logout} variant="ghost" onClick={onLogout} />
      </div>
    </div>
  )
}

/** 앱 전체 덮개. 문제가 있을 때만 그려진다. */
export function AccountProblemHost({ nav }: { nav: Nav }) {
  const problem = useAccountProblemStore((s) => s.problem)
  if (!problem) return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40 }} data-testid="account-problem-host">
      <AccountProblemView
        onRetry={() => { useAccountProblemStore.getState().clear(); problem.retry() }}
        onLogout={() => { useAccountProblemStore.getState().clear(); void logoutToStart(nav) }}
      />
    </div>
  )
}

/**
 * 화면 그리기 중에 예상 못 한 오류가 나도 바탕만 남지 않게 한다(빈 화면 0 원칙의 마지막 그물). 오류 내용은 남기지 않는다(시험 빌드는 분류만).
 * [다시 시도]는 같은 화면을 다시 그리고, [로그아웃]은 로그아웃한다.
 */
export class RenderGuard extends Component<{ nav: Nav; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (IS_TRIAL_BUILD) useTrialDiag.getState().record('state', `render_${safeKind(error)}`)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <AccountProblemView
        onRetry={() => this.setState({ failed: false })}
        onLogout={() => { this.setState({ failed: false }); void logoutToStart(this.props.nav) }}
      />
    )
  }
}
