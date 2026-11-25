/**
 * 어림짐작 8번 「이달의 어림짐작」 주제 풀 12종 (MASTER 17-9 "8. 이달의 어림짐작 — 주제 풀" 표 순서 그대로, `id` = 표의 #).
 *
 * **v0 초안 — 문장(`phrase`)과 성향 방향(`traits`)은 PM 승인 대상**(계약 `rough_guess.json` open_questions "주제 풀 12종 문장을
 * 상수 파일로 확정할 PM 승인"). MASTER 표의 입력 열(성향 두 가지)을 그대로 쓰고, 출력은 모든 주제를 **"누가 먼저 ~할 확률"** 한 꼴로
 * 맞췄다 — MASTER 출력 예 가운데 "세준님 2분 · 서영님 11분"처럼 데이터에 없는 시간 · 자리를 지어내는 꼴은 쓰지 않는다(CLAUDE.md
 * "없는 걸 지어내지 않는다").
 *
 * ⚠️ 풀에 주제를 더하거나 순서를 바꾸면 `hash % length`가 바뀌어 과거 호를 다시 만들 때 다른 주제가 나온다(MASTER 17-9). 발행된
 * 코너는 `corners.content` 스냅샷이라 안전하다.
 */

/** 성향 하나(0~1로 바꾼 값). `invert`면 1 − 값. 이름은 `roughGuess.ts` `TraitKey`. */
export interface TopicTrait {
  readonly key: 'o' | 'c' | 'e' | 'a' | 'n' | 'passion' | 'commitment' | 'avoidance' | 'assertive' | 'withdrawn' | 'judging'
  readonly invert?: boolean
}

export interface RoughGuessTopic {
  readonly id: number
  /** 주제 제목(MASTER 표 "주제" 열 그대로). */
  readonly title: string
  /** "{이름}님이 {phrase} {n}%"의 가운데. */
  readonly phrase: string
  readonly traits: readonly TopicTrait[]
}

export const ROUGH_GUESS_TOPICS: readonly RoughGuessTopic[] = [
  { id: 1, title: '여행 계획을 세운다면', phrase: '숙소를 먼저 정할 확률', traits: [{ key: 'judging' }, { key: 'c' }] },
  { id: 2, title: '메뉴 고르는 시간', phrase: '메뉴를 먼저 고를 확률', traits: [{ key: 'o', invert: true }, { key: 'c' }] },
  { id: 3, title: '영화관에서 앉는 자리', phrase: '자리를 먼저 고를 확률', traits: [{ key: 'e' }, { key: 'o' }] },
  { id: 4, title: '짐 싸는 시점', phrase: '짐을 먼저 싸 둘 확률', traits: [{ key: 'c' }, { key: 'judging' }] },
  { id: 5, title: '길 잃었을 때', phrase: '먼저 지도를 켤 확률', traits: [{ key: 'assertive' }, { key: 'e' }] },
  { id: 6, title: '노래방에서', phrase: '먼저 마이크를 잡을 확률', traits: [{ key: 'e' }, { key: 'assertive' }] },
  { id: 7, title: '사진 찍을 때', phrase: '포즈를 먼저 정할 확률', traits: [{ key: 'o' }, { key: 'e' }] },
  { id: 8, title: '장 보러 가면', phrase: '목록대로 살 확률', traits: [{ key: 'c' }, { key: 'o', invert: true }] },
  { id: 9, title: '리모컨을 쥐는 쪽', phrase: '리모컨을 먼저 쥘 확률', traits: [{ key: 'assertive' }, { key: 'e' }] },
  { id: 10, title: '새 카페에 가면', phrase: '메뉴판을 더 오래 볼 확률', traits: [{ key: 'o' }, { key: 'n' }] },
  { id: 11, title: '늦잠 잔 아침', phrase: '먼저 일어날 확률', traits: [{ key: 'n', invert: true }, { key: 'c' }] },
  { id: 12, title: '짐 정리 방식', phrase: '물건을 종류별로 나눠 둘 확률', traits: [{ key: 'c' }, { key: 'o', invert: true }] },
]
