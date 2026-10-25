/**
 * A19 사귄 날짜 + 커플 닉네임 · A20 상대가 정한 날짜 확인의 순수 규칙 - 화면과 시험이 같은 함수를 쓴다.
 *
 * - 사귄 날짜: 실제 있는 날짜이고 **KST 오늘까지**(미래는 고를 수 없다). 입력은 "YYYY.MM.DD"(A03 생년월일과 같은 입력 방식).
 * - 커플 닉네임: 1~20자(`couples.nickname` check). 글자 수는 서버(Postgres `char_length`)와 같게 코드 포인트로 센다. 앞뒤 공백만 있으면 0자다.
 * - 한국어 조사: 이름 뒤에 붙는 "과/와" · "이/가"(받침으로 가른다).
 */
import { birthIsoToInput, formatBirthInput } from './onboardingRules'
import { kstToday } from './magazine'

export const NICKNAME_MIN = 1
export const NICKNAME_MAX = 20
/** 사귄 날짜로 받는 가장 이른 해(A03 생년월일 하한과 같다). */
export const START_DATE_MIN_YEAR = 1930

/** 닉네임의 글자 수(앞뒤 공백 제외, 코드 포인트). */
export function nicknameLength(raw: string): number {
  return [...raw.trim()].length
}

export function isValidNickname(raw: string): boolean {
  const n = nicknameLength(raw)
  return n >= NICKNAME_MIN && n <= NICKNAME_MAX
}

/** 저장할 닉네임(앞뒤 공백 제거). */
export function normalizeNickname(raw: string): string {
  return raw.trim()
}

/** 사귄 날짜 입력 글자: 숫자만 최대 8자리를 "YYYY.MM.DD" 모양으로 보여준다. */
export const formatStartDateInput = formatBirthInput
export const startDateIsoToInput = birthIsoToInput

/** ISO('YYYY-MM-DD')가 실제 있는 날짜인가. */
function isRealIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const probe = new Date(Date.UTC(y, mo - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
}

/** 이 날짜를 사귄 날짜로 고를 수 있는가 - 실제 있는 날짜이고, 1930년 이후이며, KST 오늘 이전(오늘 포함). */
export function isStartDateSelectable(iso: string, now: Date): boolean {
  if (!isRealIsoDate(iso)) return false
  if (Number(iso.slice(0, 4)) < START_DATE_MIN_YEAR) return false
  return iso <= kstToday(now)
}

/** 입력 글자("YYYY.MM.DD")가 고를 수 있는 날짜면 ISO, 아니면 null. */
export function parseStartDateInput(text: string, now: Date): string | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(text)
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}`
  return isStartDateSelectable(iso, now) ? iso : null
}

function lastHangul(name: string): number | null {
  const ch = name.trim().slice(-1)
  if (!ch) return null
  const code = ch.charCodeAt(0)
  return code >= 0xac00 && code <= 0xd7a3 ? code : null
}

/** 이름 뒤에 붙이는 "과"(받침 있음) / "와"(없음). 한글이 아니면 "와". */
export function withGwa(name: string): string {
  const code = lastHangul(name)
  const hasBatchim = code !== null && (code - 0xac00) % 28 !== 0
  return `${name}${hasBatchim ? '과' : '와'}`
}

/** 이름 뒤에 붙이는 "이"(받침 있음) / "가"(없음). 한글이 아니면 "가". */
export function withIga(name: string): string {
  const code = lastHangul(name)
  const hasBatchim = code !== null && (code - 0xac00) % 28 !== 0
  return `${name}${hasBatchim ? '이' : '가'}`
}
