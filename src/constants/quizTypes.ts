/**
 * 5문항 채점 시스템 전역에서 쓰는 원시 타입.
 *
 * `QuizChoice`는 supabase의 `quiz_choice` enum(A|B|C, src/types/database.ts)과
 * 반드시 동일해야 한다 — DB 저장값과 엔진 입력값이 어긋나면 결정론이 깨진다.
 */
export type QuizChoice = 'A' | 'B' | 'C'

/** 16 MBTI 유형 코드. */
export type MbtiType =
  | 'INTJ'
  | 'INTP'
  | 'ENTJ'
  | 'ENTP'
  | 'INFJ'
  | 'INFP'
  | 'ENFJ'
  | 'ENFP'
  | 'ISTJ'
  | 'ISFJ'
  | 'ESTJ'
  | 'ESFJ'
  | 'ISTP'
  | 'ISFP'
  | 'ESTP'
  | 'ESFP'

export const MBTI_TYPES: readonly MbtiType[] = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const
