/**
 * 입력 전처리 - 본문 없는 조각 제거 (docs/ONDOLOG_MASTER.md §17-0-9-F-2, r61 좁힘).
 * 위임: .claude/state/prompts/phase-7/52r3-corner-pipeline-sel-a-narrow.md
 *
 * 규칙 기반 전처리는 이것 하나뿐이다(`52-`의 sel-a): **본문이 비었거나 공백뿐인 메시지**만 뺀다.
 * 자음만("ㅋㅋㅋ")·이모티콘 단독("❤️")·한 음절 답("응?", "콜 🍺")·링크뿐인 본문은 남긴다 -
 * 17-4 우선순위 ②(상대의 반응이 좋았던 것)의 반응 신호다. 다툼 어휘로 날을 지우는 규칙, 다정 단서만
 * 남기는 규칙, 하루·월 N건 절단도 쓰지 않는다. 내용을 보고 고르는 일은 LLM(6-7 Haiku 태깅)의 몫이다.
 *
 * 순수 함수다(시간·난수 없음). 입력 조립(`inputAssembly.ts`)이 메시지 레코드를 만들 때 부르고, 뺀 건수는
 * `InputExclusions.trivialMessages`로 센다. 하네스(`scripts/ops/m1InputCandidates.ts`)의 sel-a도 같은 함수를 쓴다 -
 * 두 곳의 규칙이 어긋나지 않게 하려는 것이다.
 */

/**
 * 본문이 비었거나 공백(줄바꿈 포함)뿐이면 참이다. 그 밖에는 기호·이모지·한 글자여도 거짓이다.
 * `null` 본문은 여기 오기 전에 입력 조립이 `messagesWithoutBody`로 센다 - 이중으로 세지 않는다.
 */
export function isTrivialMessageText(text: string): boolean {
  return text.trim().length === 0
}
