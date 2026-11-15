/**
 * R98-4 (a) - 초안 호가 없을 때의 "0%": 앱이 **이번 달(KST 1일~말일) 경과율**을 초안이 있을 때와 같은 공식(`periodElapsedPercent`)으로 직접 계산한다.
 * 서버 변경 0. 이 앱 · 루트에 "이번 달 기간을 만드는 기존 함수 · 설정"이 없다(`app_config.issue_cycle`은 압축 시뮬레이션 모드 값이고 기간이 아니다) -
 * 그래서 월간 호의 기간 정의(역월: 1일~말일, KST)를 여기 한 곳에서만 만든다. 발행 주기를 바꿀 때(config화)는 이 함수만 바꾼다.
 */
import { addDays, periodElapsedPercent } from '@/utils/magazine'

/** KST 오늘이 속한 달의 첫날 · 마지막 날 `YYYY-MM-DD`. */
export function monthPeriodOf(todayKst: string): { periodStart: string; periodEnd: string } {
  const [y, m] = todayKst.split('-').map(Number)
  const periodStart = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const nextMonthStart = m === 12 ? `${String(y + 1).padStart(4, '0')}-01-01` : `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-01`
  return { periodStart, periodEnd: addDays(nextMonthStart, -1) }
}

/** 초안이 없을 때 쓰는 이번 달 경과율(0~100 정수). 초안이 이번 달 월간 호면 `periodElapsedPercent(draft...)`와 같은 값이다. */
export function monthElapsedPercent(todayKst: string): number {
  const { periodStart, periodEnd } = monthPeriodOf(todayKst)
  return periodElapsedPercent(periodStart, periodEnd, todayKst)
}

/** 카드에 쓸 경과율: 초안이 있으면 초안 값, 없으면 이번 달 값. */
export function issuePercent(next: { percent: number } | null, todayKst: string): number {
  return next ? next.percent : monthElapsedPercent(todayKst)
}
