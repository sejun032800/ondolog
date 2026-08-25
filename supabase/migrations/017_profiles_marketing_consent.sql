-- 화면 6(약관 동의) 개정판 반영.
-- 근거: docs/ONDOLOG_MASTER.md "MASTER Part 9-1 보강 — 화면 6 약관 동의 명세"
--   "스키마 변경 필요" 절 원문 그대로.

-- 5번 항목(마케팅 정보 수신, 선택)은 컬럼이 없었다. 신설한다.
alter table public.profiles
  add column marketing_agreed_at timestamptz;

comment on column public.profiles.marketing_agreed_at is
  '선택 동의. null = 미동의. 철회 시 null로 되돌린다.';

-- terms_agreed_at/privacy_agreed_at의 default now()를 제거한다.
-- 이유(MASTER.md 원문): "기본값이 있으면 동의 없이도 레코드가 생성되어
-- [화면 6 6-6 완료기준] '동의 없이 profiles 레코드가 생성되지 않는다'를
-- 강제할 수 없다." 두 컬럼 모두 not null 제약은 그대로 유지 — 값을
-- 명시적으로 넘기지 않는 insert는 이제 제약 위반으로 실패한다(의도된
-- 동작). 기존 행의 값은 영향받지 않는다.
alter table public.profiles
  alter column terms_agreed_at drop default,
  alter column privacy_agreed_at drop default;
