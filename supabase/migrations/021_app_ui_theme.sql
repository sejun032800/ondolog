-- 앱 UI 테마: magazine_theme · issues.theme · dates.sky_color.
-- 근거: docs/ONDOLOG_SCHEMA.md §9-C (MASTER Part 9-7 결정 7·8·9·11).
-- 001~020은 이미 적용된 것이라 고치지 않는다. 021은 alter로 얹는다.

-- ─────────────────────────────────────────────
-- 9-C-2. 컬럼
-- ─────────────────────────────────────────────

-- 다음 호에 적용될 테마. 구독 만료 시 'basic'으로 되돌린다(MASTER 9-7-3).
alter table public.couples
  add column magazine_theme text not null default 'basic'
    check (magazine_theme in ('basic','hip','neon','lovely','night','ondol'));

-- 발행 시점 고정값. 불변(아래 트리거).
alter table public.issues
  add column theme text not null default 'basic'
    check (theme in ('basic','hip','neon','lovely','night','ondol'));

-- 대표 사진 평균색. 기기에서 계산, 사진 없는 날은 null.
alter table public.dates
  add column sky_color text
    check (sky_color is null or sky_color ~ '^#[0-9A-Fa-f]{6}$');

-- ─────────────────────────────────────────────
-- 9-C-3. issues.theme 불변 트리거
-- ─────────────────────────────────────────────

create or replace function public.fn_issues_theme_immutable()
returns trigger language plpgsql as $$
begin
  if old.published_at is not null and new.theme is distinct from old.theme then
    raise exception 'issues.theme은 발행 후 바꿀 수 없다 (issue %)', old.id;
  end if;
  return new;
end;
$$;

create trigger tg_issues_theme_immutable
  before update on public.issues
  for each row execute function public.fn_issues_theme_immutable();

-- ─────────────────────────────────────────────
-- 9-C-4. issues_public 뷰 재생성
-- ─────────────────────────────────────────────

create or replace view public.issues_public
with (security_invoker = true) as
select
  id, couple_id, issue_type, issue_number, title, cover_path,
  period_start, period_end,
  pdf_digital_path,
  page_count, is_trial, published_at, created_at,
  theme
from public.issues;

-- ─────────────────────────────────────────────
-- 9-C-5. pdf_profiles 정리
-- ─────────────────────────────────────────────

update public.app_config
set value = '{"digital":{"dpi":150},"print":{"dpi":300,"bleedMm":3}}'::jsonb
where key = 'pdf_profiles';
