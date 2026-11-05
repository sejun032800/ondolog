/**
 * H19 문의하기 - `mailto:` 주소 만들기(순수 함수).
 *
 * 받는 주소는 `SUPPORT_EMAIL` 상수 하나다. 제목은 `[온도록 문의]`.
 * 본문 머리는 **세 줄**: 앱 버전 · OS(+ OS 버전) · "발행물 정정 요청이면 몇 월호 몇 쪽인지 적어 주세요".
 * **계정 id · 이메일 · 이름 · 커플 정보는 넣지 않는다** - 이 함수는 앱 버전과 OS 값만 받는다(받는 값이 없으니 새어 나갈 수 없다).
 */
import { SUPPORT_EMAIL, SUPPORT_MAIL_SUBJECT } from '../constants/support'

export interface SupportMailFacts {
  /** 앱 버전(예: `1.0.0`). 읽지 못하면 null. */
  appVersion: string | null
  /** `Platform.OS`. */
  os: string
  /** `Platform.Version` - iOS는 `17.4`, Android는 API 레벨 숫자. */
  osVersion: string | number | null
}

export const SUPPORT_CORRECTION_LINE = '발행물 정정 요청이면 몇 월호 몇 쪽인지 적어 주세요.'

/** `iOS 17.4` · `Android API 34`. 모르는 OS는 이름 그대로. */
export function osLabel(os: string, osVersion: string | number | null): string {
  const name = os === 'ios' ? 'iOS' : os === 'android' ? 'Android' : os
  if (osVersion === null || osVersion === '') return name
  return os === 'android' ? `${name} API ${osVersion}` : `${name} ${osVersion}`
}

/** 본문 머리 세 줄(뒤에 빈 줄을 둬 사용자가 그 아래에 쓴다). */
export function supportMailBody(facts: SupportMailFacts): string {
  const lines = [
    `앱 버전: ${facts.appVersion ?? '알 수 없음'}`,
    `OS: ${osLabel(facts.os, facts.osVersion)}`,
    SUPPORT_CORRECTION_LINE,
  ]
  return `${lines.join('\n')}\n\n`
}

export function buildSupportMailto(facts: SupportMailFacts): string {
  const query = `subject=${encodeURIComponent(SUPPORT_MAIL_SUBJECT)}&body=${encodeURIComponent(supportMailBody(facts))}`
  return `mailto:${SUPPORT_EMAIL}?${query}`
}
