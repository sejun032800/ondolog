/**
 * 애니어그램 코어의 호나이·하모닉 그룹 라벨 (화면 7 "③ 애니어그램 코어
 * 설명"용, 표시 전용 파생값).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-6-2 "산출 근거 — 3가지 구조" 원문.
 *   호나이 삼분법: 주장형(3·7·8) · 순응형(1·2·6) · 후퇴형(4·5·9)
 *   하모닉 삼분법: 역량형(1·3·5) · 긍정형(2·7·9) · 반응형(4·6·8)
 *
 * `src/constants/enneagram.ts`의 `HORNEVIAN_HARMONIC_TABLE`과 같은 원문
 * 근거에서 나온 값이며, 이 파일은 채점에 관여하지 않고(코어를 입력받아
 * 그룹 이름만 붙이는 표시 전용 함수) 오직 화면 설명 문구용이다.
 */
import type { EnneagramCore } from '../constants/enneagram'

export const HORNEVIAN_GROUP_KO: Readonly<Record<EnneagramCore, string>> = {
  3: '주장형',
  7: '주장형',
  8: '주장형',
  1: '순응형',
  2: '순응형',
  6: '순응형',
  4: '후퇴형',
  5: '후퇴형',
  9: '후퇴형',
}

export const HARMONIC_GROUP_KO: Readonly<Record<EnneagramCore, string>> = {
  1: '역량형',
  3: '역량형',
  5: '역량형',
  2: '긍정형',
  7: '긍정형',
  9: '긍정형',
  4: '반응형',
  6: '반응형',
  8: '반응형',
}
