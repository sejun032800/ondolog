/**
 * 입력 전처리 - 의미 없는 조각 제거 (docs/ONDOLOG_MASTER.md §17-0-9-F-2, r59).
 * 위임: .claude/state/prompts/phase-7/52r2-corner-pipeline-m1b-finish.md
 *
 * 규칙 기반 전처리는 이것 하나뿐이다(`52-`의 sel-a). 다툼 어휘로 날을 지우는 규칙, 다정 단서만 남기는 규칙,
 * 하루·월 N건 절단은 **쓰지 않는다**(F-2). 내용을 보고 고르는 일은 LLM(6-7 Haiku 태깅)의 몫이다.
 *
 * 순수 함수다(시간·난수 없음). 입력 조립(`inputAssembly.ts`)이 메시지 레코드를 만들 때 부르고, 뺀 건수는
 * `InputExclusions.trivialMessages`로 센다. 하네스(`scripts/ops/m1InputCandidates.ts`)의 sel-a도 같은 함수를 쓴다 -
 * 두 곳의 규칙이 어긋나지 않게 하려는 것이다.
 */

/** 공백·구두점·기호·이모지를 지운 본문. */
function core(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, '')
}

/**
 * 의미 없는 조각인가 - 기호를 뺀 본문이 한 글자 이하(빈 문자열 포함, 기호·이모지뿐인 것 포함)이거나,
 * ㅋ·ㅠ 같은 자모뿐이거나, 링크뿐이면 참이다.
 */
export function isTrivialMessageText(text: string): boolean {
  const c = core(text)
  if (c.length <= 1) return true
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/u.test(c)) return true
  if (/^https?:\/\/\S+$/u.test(text.trim())) return true
  return false
}
