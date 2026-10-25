/**
 * 온보딩(U6 1부) 순수 규칙 - 화면과 시험이 같은 함수를 쓴다.
 *
 * - 만 14세 자동 판정(MASTER 6-3 ①): 생년월일(A03)로 KST 날짜 기준. 생일 당일이면 만 14세.
 * - 동의 버튼 활성(MASTER 6-6): 필수 셋(이용약관·개인정보·AI 활용)이 전부 체크 + 만 14세 이상.
 *   마케팅(선택)은 영향 없다. ① 만 14세는 직접 체크하는 항목이 아니다.
 * - 생년월일 입력 글자("2004.03.28")와 ISO 변환.
 */
import { MIN_AGE_YEARS } from '../constants/consent'
import { calculateAgeKst } from './age'
import { kstToday } from './magazine'

export interface ConsentFlags {
  terms: boolean
  privacy: boolean
  aiUsage: boolean
  marketing: boolean
}

export const EMPTY_CONSENT: ConsentFlags = { terms: false, privacy: false, aiUsage: false, marketing: false }

/** 생년월일(ISO)이 있고 만 14세(`MIN_AGE_YEARS`) 이상인가. 없거나 형식이 틀리면 false. */
export function isAgeEligible(birthDateIso: string | null, now: Date): boolean {
  if (!birthDateIso) return false
  try {
    return calculateAgeKst(birthDateIso, now) >= MIN_AGE_YEARS
  } catch {
    return false
  }
}

/** [동의하고 시작하기] 활성 조건. 필수 하나라도 빠지거나 만 14세 미만이면 false. */
export function canAgree(consent: ConsentFlags, ageEligible: boolean): boolean {
  return ageEligible && consent.terms && consent.privacy && consent.aiUsage
}

/** 전체 동의가 켜져 있는가(개별 네 항목이 전부 체크). */
export function isAllConsented(consent: ConsentFlags): boolean {
  return consent.terms && consent.privacy && consent.aiUsage && consent.marketing
}

/** 전체 동의 한 번 누름: 전부 켜져 있으면 전부 끄고, 아니면 전부 켠다. */
export function toggleAllConsent(consent: ConsentFlags): ConsentFlags {
  const next = !isAllConsented(consent)
  return { terms: next, privacy: next, aiUsage: next, marketing: next }
}

/**
 * 로그인 화면(A11)에 들어갈 수 있는가 - 동의 없이는 못 간다(MASTER 6-1, R24-4).
 * 생년월일이 없거나(앞 화면 답이 사라짐) 필수 동의가 빠지면 false.
 */
export function canEnterLogin(birthDateIso: string | null, consent: ConsentFlags, now: Date): boolean {
  return canAgree(consent, isAgeEligible(birthDateIso, now))
}

/** 생년월일 입력: 숫자만 최대 8자리를 "YYYY.MM.DD" 모양으로 보여준다. */
export function formatBirthInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}

export const BIRTH_MIN_YEAR = 1930

/** 입력 글자가 실제 존재하는 지난 날짜면 ISO('YYYY-MM-DD'), 아니면 null. 오늘은 KST 날짜. */
export function parseBirthInput(text: string, now: Date): string | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(text)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < BIRTH_MIN_YEAR) return null
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}`
  if (iso > kstToday(now)) return null
  return iso
}

/** ISO('YYYY-MM-DD') -> 입력 칸 글자("YYYY.MM.DD"). 없으면 빈 글자. */
export function birthIsoToInput(iso: string | null): string {
  return iso ? iso.replace(/-/g, '.') : ''
}
