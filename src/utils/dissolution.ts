/**
 * 연결 해제(H14) · 회원 탈퇴(H16) 순수 규칙 - 화면과 시험이 같은 함수를 쓴다.
 *
 * - 문구 직접 입력(MASTER 9-6 안전장치): 탈퇴 문구는 보드(`N-S-H3-Settings` H16)의 `탈퇴합니다`.
 *   연결 해제 문구는 보드 · MASTER에 없어 같은 형식으로 `연결 해제합니다`를 정했다(내부 결정, 보고).
 * - 남은 날짜는 서버의 `purge_scheduled_at`을 KST 달력 날짜로 바꿔 오늘과의 차이로 센다. 앱이 7일을 따로 더하지 않는다.
 */
import { kstToday } from './magazine'

export const UNLINK_PHRASE = '연결 해제합니다'
export const WITHDRAW_PHRASE = '탈퇴합니다'

/** 문구가 정확히 일치하는가 - 앞뒤 공백만 무시한다. 비어 있으면 거짓. */
export function isPhraseMatch(input: string, phrase: string): boolean {
  const typed = input.trim().normalize('NFC')
  return typed.length > 0 && typed === phrase.normalize('NFC')
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function kstDayNumber(d: Date): number {
  const [y, m, day] = kstToday(d).split('-').map(Number)
  return Date.UTC(y, m - 1, day) / MS_PER_DAY
}

/** 서버 `purge_scheduled_at`(ISO)까지 남은 KST 달력 일수. 지났으면 0. */
export function graceDaysLeft(purgeScheduledAt: string, now: Date = new Date()): number {
  return Math.max(0, kstDayNumber(new Date(purgeScheduledAt)) - kstDayNumber(now))
}

/** `10월 26일` - 서버 값의 KST 날짜. */
export function graceDateLabel(purgeScheduledAt: string): string {
  const [, m, d] = kstToday(new Date(purgeScheduledAt)).split('-').map(Number)
  return `${m}월 ${d}일`
}

export type DissolutionReason = 'unlink' | 'withdrawal'

export interface DissolutionState {
  dissolutionId: string
  coupleId: string
  /** 상대 profiles.id. */
  partnerId: string
  reason: DissolutionReason
  initiatedByMe: boolean
  /** 서버가 정한 파기 예정 시각(ISO). */
  purgeScheduledAt: string
}

/** [해제 취소하기]가 보이는가 - 내가 직접 요청한 해제(unlink)만. 탈퇴로 생긴 해제는 탈퇴 취소로만 되돌린다. 상대는 취소할 수 없다. */
export function canCancelDissolution(state: Pick<DissolutionState, 'initiatedByMe' | 'reason'>): boolean {
  return state.initiatedByMe && state.reason === 'unlink'
}

/** 탈퇴 유예 중인가(로그인 직후 탈퇴 취소 화면을 먼저 보일 판정). */
export function isWithdrawalPending(profile: { deleted_at?: string | null } | null | undefined): boolean {
  return !!profile?.deleted_at
}
