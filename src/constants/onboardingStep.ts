/**
 * `profiles.onboarding_step` 정수 값의 의미 매핑.
 *
 * 근거: `supabase/migrations/003_profiles.sql`
 *   `onboarding_step smallint not null default 0 check (onboarding_step between 0 and 3)`
 *   주석: "세이브포인트 (가입 이후 구간만. 0=가입직후 … 3=온보딩완료)"
 *
 * DB가 0~3 범위를 CHECK 제약으로 강제하므로 이 파일의 값도 그 범위
 * 안에서만 정의한다(docs/ONDOLOG_MASTER.md Part 11-1은 "완료/미완료"
 * 개념만 규정하고 구체 정수는 스키마 쪽 원문을 따른다).
 *
 *   0 AUTH     → 화면 6 완료 직후("가입직후"). profiles +
 *                personality_assessments 저장됨. 다음: 화면 7.
 *   1 RESULT   → 화면 7 완료. personality_profiles 생성됨. 다음: 화면 8.
 *   2 INVITE   → 화면 8 완료(스킵/솔로/코드 입력 무엇이든). 커플이
 *                방금 연결됐고 사귄 날짜가 아직 없으면 화면 +(사귄 날짜)로
 *                간다. 아니면 곧바로 3으로 넘어간다.
 *   3 COMPLETE → 온보딩 전체 완료("온보딩완료"). 메인 탭으로 간다.
 */
export const ONBOARDING_STEP = {
  AUTH: 0,
  RESULT: 1,
  INVITE: 2,
  COMPLETE: 3,
} as const

export type OnboardingStepValue =
  (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP]
