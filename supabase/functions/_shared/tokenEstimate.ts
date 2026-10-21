/**
 * 입력 토큰 추정 - API를 부르지 않는다 (docs/ONDOLOG_MASTER.md §17-0-9-F-2 안전 정지).
 * 위임: .claude/state/prompts/phase-7/52r2-corner-pipeline-m1b-finish.md
 *
 * 글자 종류별 가중치의 합으로 토큰 수를 추정한다(`52-`에서 보고한 방법). 공급자 토크나이저·토큰 세기 API는 쓰지
 * 않는다. **측정값이 아니다** - 한글이 토큰당 몇 글자로 묶이는지를 모르므로 하한·중간·상한 세 벌을 둔다.
 * 실제 토큰 수는 M1c에서 응답의 `usage`로 확인한다. 순수 함수(시간·난수 없음).
 */

import type { LlmRequest } from './llmRequest.ts'

export interface TokenWeights {
  readonly hangul: number // 완성형 한글 음절
  readonly jamo: number // ㅋ ㅎ ㅠ 같은 자모 단독
  readonly alnum: number // ASCII 영문·숫자
  readonly space: number // 공백·개행
  readonly punct: number // ASCII 구두점·JSON 기호
  readonly other: number // 이모지·한자·기타
}

export const TOKEN_WEIGHTS = {
  low: { hangul: 0.6, jamo: 0.5, alnum: 0.2, space: 0.15, punct: 0.35, other: 1.0 },
  mid: { hangul: 1.0, jamo: 1.0, alnum: 0.25, space: 0.25, punct: 0.5, other: 2.0 },
  high: { hangul: 1.5, jamo: 1.5, alnum: 0.35, space: 0.35, punct: 0.8, other: 3.0 },
} as const satisfies Record<string, TokenWeights>

export type TokenBand = keyof typeof TOKEN_WEIGHTS

export function estimateTokens(text: string, band: TokenBand): number {
  const w = TOKEN_WEIGHTS[band]
  let sum = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c >= 0xac00 && c <= 0xd7a3) sum += w.hangul
    else if ((c >= 0x3131 && c <= 0x318e) || (c >= 0x1100 && c <= 0x11ff)) sum += w.jamo
    else if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) sum += w.alnum
    else if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) sum += w.space
    else if (c < 0x80) sum += w.punct
    else sum += w.other
  }
  return Math.ceil(sum)
}

/** 요청 전체(system·user 블록 전부)의 추정 입력 토큰. 블록 사이의 구분은 개행 둘로 센다. */
export function estimateRequestTokens(request: LlmRequest, band: TokenBand): number {
  const text = [...request.system, ...request.user].map((b) => b.text).join('\n\n')
  return estimateTokens(text, band)
}

/**
 * 안전 정지 상한 - 코너 하나의 추정 입력 토큰이 이 값을 **넘으면**(초과) 생성하지 않는다. 이 값 자체는 생성한다.
 * 근거: §17-0-9-F-2(6-7 비용 가정의 약 2배). 상한의 최종 값은 베타 실데이터 분포(ROADMAP M3)와 M1c 실제 토큰으로
 * 정해지므로 그때까지의 임시 상수다 - `app_config` 값이 아니다(이번 범위는 설정 변경을 하지 않는다).
 */
export const INPUT_TOKEN_STOP_LIMIT = 40_000

/** 안전 정지의 비교에 쓰는 추정 구간. 하한·상한은 보고용이고 비교에는 중간값을 쓴다. */
export const INPUT_TOKEN_STOP_BAND: TokenBand = 'mid'
