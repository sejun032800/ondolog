/**
 * MASTER 9-1 화면 3 "간이 4문항(초안)" 원문 - RN 앱 `app/(onboarding)/mbti.tsx`의 `QUICK_QUESTIONS`와 문장이 같다(B8).
 * 선택지 A는 `kicker`의 앞 글자, B는 뒤 글자다(예: "E · I"의 A = E, B = I). 이 대응은 정본 `QUICK_MBTI_AXIS_MAP`과 같아야 하고,
 * 16조합 전수 시험(`quickMbti.vitest.ts`)이 둘이 같은지 본다.
 */
export type Axis = 'ei' | 'sn' | 'ft' | 'jp'

export interface QuickQuestion {
  axis: Axis
  kicker: string
  prompt: string
  a: string
  b: string
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  { axis: 'ei', kicker: 'E · I', prompt: '친구들과의 모임에서 나는?', a: '여러 사람과 어울리며 에너지를 얻는다', b: '소수와 깊게 대화할 때 더 편하다' },
  { axis: 'sn', kicker: 'S · N', prompt: '새로운 걸 배울 때 나는?', a: '구체적인 사실과 경험을 먼저 확인한다', b: '전체 흐름과 가능성을 먼저 상상한다' },
  { axis: 'ft', kicker: 'F · T', prompt: '결정을 내릴 때 나는?', a: '사람들의 감정과 관계를 먼저 고려한다', b: '논리와 원칙을 먼저 고려한다' },
  { axis: 'jp', kicker: 'J · P', prompt: '계획을 세울 때 나는?', a: '미리 정해두고 그대로 진행하는 게 편하다', b: '상황에 따라 유연하게 바꾸는 게 편하다' },
]
