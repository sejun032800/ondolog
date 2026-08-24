/**
 * 온보딩 비로그인 구간(화면 2~5) 전용 메모리 스토어.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 "데이터 생명주기 2구간 정책"
 *   화면 2~5(비로그인) → 저장 위치: 메모리 → 앱 종료 시: **소멸**
 *
 * ⚠️ 절대 규칙: 이 파일은 영속 저장소(AsyncStorage 등)를 import하지
 * 않는다. zustand의 `persist` 미들웨어도 쓰지 않는다 — 앱 재시작 시
 * 이 스토어가 초기값으로 되돌아가는 것이 의도된 설계다(정적 검사:
 * `__tests__/store/sessionStore.test.ts`가 이 파일 소스에 AsyncStorage/
 * persist 문자열이 없는지 검사한다).
 *
 * 화면 6(로그인) 성공 후에는 이 메모리 값들을 서버(profiles /
 * personality_assessments / personality_profiles)에 귀속시키고, 그
 * 이후로는 이 스토어를 더 신뢰하지 않는다(서버가 세이브포인트가 된다) —
 * 로그인 성공 콜백에서 `resetSession()`을 호출해 비운다.
 */

import { create } from 'zustand'
import type { QuickMbtiAnswers } from '../constants/quickMbti'
import type { MbtiType, QuizChoice } from '../constants/quizTypes'
import {
  inferLoveType,
  resolveMbtiFromQuickQuiz,
  type LoveTypeInferenceResult,
} from '../engine/loveTypeInference'

/** DB `gender_type` enum(male/female/other)과 동일해야 한다 — Part 9-1 화면 2. */
export type Gender = 'male' | 'female' | 'other'

export interface BasicInfo {
  name: string
  gender: Gender
  /** ISO 'YYYY-MM-DD'. 나이 확인용 — 사귄 일수 계산과 무관(Part 9-1 화면 2). */
  birthDate: string
}

interface SessionState {
  // ── 화면 2. 기본정보 입력 ──
  name: string
  gender: Gender | null
  birthDate: string | null

  // ── 화면 3. MBTI 입력 ──
  /** true = "알아요"(4글자 직접 선택), false = "몰라요"(간이 4문항) */
  mbtiKnown: boolean | null
  quickMbtiAnswers: Partial<QuickMbtiAnswers>
  /** 두 경로가 공통으로 수렴하는 최종 4글자 코드. */
  mbti: MbtiType | null
  mbtiSelfReported: boolean

  // ── 화면 4. 연애유형 5문항 ──
  q1: QuizChoice | null
  q2: QuizChoice | null
  q3: QuizChoice | null
  q4: QuizChoice | null
  q5: QuizChoice | null

  // ── 화면 5. 간략 결과 ──
  /** 클라이언트 로컬 순수 함수 산출값 — 서버 호출 없음(Part 9-1 화면 5). */
  result: LoveTypeInferenceResult | null

  // ── 액션 ──
  setBasicInfo: (info: BasicInfo) => void
  setName: (name: string) => void
  setGender: (gender: Gender) => void
  setBirthDate: (birthDate: string | null) => void
  setMbtiKnown: (known: boolean) => void
  setMbtiSelfReported: (mbti: MbtiType) => void
  setQuickMbtiAnswer: (axis: keyof QuickMbtiAnswers, choice: 'A' | 'B') => void
  setQuizAnswer: (q: 1 | 2 | 3 | 4 | 5, choice: QuizChoice) => void
  /** q1~q5, mbti가 모두 채워졌을 때만 채점하고 저장한다. 아니면 null 유지. */
  computeResult: () => LoveTypeInferenceResult | null
  /** 화면 6 로그인 성공 후 서버 귀속이 끝나면 호출해 메모리를 비운다. */
  resetSession: () => void
}

const initialState = {
  name: '',
  gender: null,
  birthDate: null,
  mbtiKnown: null,
  quickMbtiAnswers: {},
  mbti: null,
  mbtiSelfReported: false,
  q1: null,
  q2: null,
  q3: null,
  q4: null,
  q5: null,
  result: null,
} satisfies Omit<
  SessionState,
  | 'setBasicInfo'
  | 'setName'
  | 'setGender'
  | 'setBirthDate'
  | 'setMbtiKnown'
  | 'setMbtiSelfReported'
  | 'setQuickMbtiAnswer'
  | 'setQuizAnswer'
  | 'computeResult'
  | 'resetSession'
>

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setBasicInfo: ({ name, gender, birthDate }) =>
    set({ name, gender, birthDate }),
  setName: (name) => set({ name }),
  setGender: (gender) => set({ gender }),
  setBirthDate: (birthDate) => set({ birthDate }),

  setMbtiKnown: (known) => set({ mbtiKnown: known }),

  setMbtiSelfReported: (mbti) =>
    set({ mbti, mbtiSelfReported: true, quickMbtiAnswers: {} }),

  setQuickMbtiAnswer: (axis, choice) => {
    const answers = { ...get().quickMbtiAnswers, [axis]: choice }
    const next: { quickMbtiAnswers: Partial<QuickMbtiAnswers>; mbti?: MbtiType } =
      { quickMbtiAnswers: answers }

    // 4개 축이 모두 채워지면 즉시 4글자 코드로 수렴시킨다(Part 9-1 화면 3).
    if (answers.ei && answers.sn && answers.ft && answers.jp) {
      next.mbti = resolveMbtiFromQuickQuiz(answers as QuickMbtiAnswers)
    }

    set((state) => ({
      quickMbtiAnswers: answers,
      mbti: next.mbti ?? state.mbti,
      mbtiSelfReported: false,
    }))
  },

  setQuizAnswer: (q, choice) =>
    set({ [`q${q}`]: choice } as Pick<SessionState, 'q1' | 'q2' | 'q3' | 'q4' | 'q5'>),

  computeResult: () => {
    const { mbti, q1, q2, q3, q4, q5 } = get()
    if (!mbti || !q1 || !q2 || !q3 || !q4 || !q5) return null

    const result = inferLoveType({ mbti, q1, q2, q3, q4, q5 })
    set({ result })
    return result
  },

  resetSession: () => set({ ...initialState }),
}))
