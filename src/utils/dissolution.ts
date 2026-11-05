/**
 * 연결 해제(H14) · 회원 탈퇴(H16) 순수 규칙 - 화면과 시험이 같은 함수를 쓴다.
 *
 * - 문구 직접 입력(MASTER 9-6 안전장치, I05): H14 `해제합니다` · H16 `탈퇴합니다`(디자인 patch7 ⓖ, R44-5). **서로 달라야 한다** -
 *   같으면 한 번 쳐 본 손이 다른 화면에서도 그대로 움직여 안전장치가 타자 연습이 된다. 사용자가 직접 입력하는 확인어라 해요체 정리 대상이 아니다.
 * - 남은 날짜는 서버의 `purge_scheduled_at`을 KST 달력 날짜로 바꿔 오늘과의 차이로 센다. 앱이 7일을 따로 더하지 않는다.
 */
import { kstToday } from './magazine'

export const UNLINK_PHRASE = '해제합니다'
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

/**
 * 이름 + 주격 조사(받침이 있으면 "이", 없으면 "가" - "세준이" · "서아가"). patch7 H14 상대 쪽 문장의 주어 - "세준이 연결 해제를 요청했어요".
 * 한글이 아닌 글자로 끝나는 이름은 받침을 알 수 없어 "님이"를 붙인다.
 */
export function nameWithSubject(name: string): string {
  const last = name.trim().slice(-1)
  const code = last.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return `${name.trim()}${(code - 0xac00) % 28 === 0 ? '가' : '이'}`
  return `${name.trim()}님이`
}
