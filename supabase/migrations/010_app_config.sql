create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger tg_app_config_updated
  before update on public.app_config
  for each row execute function public.tg_set_updated_at();

-- 초기값
insert into public.app_config (key, value, description) values
  ('publish',
   '{"mode":"compressed","compressionRatio":1,"dailyTrigger":"daily","weeklyTrigger":"daily","monthlyTrigger":"every_5_issues"}'::jsonb,
   'MVP 압축 시뮬레이션. 정식 전환 시 mode=production, weeklyTrigger=weekly, monthlyTrigger=monthly'),
  ('pdf_profiles',
   '{"digital":{"dpi":150,"scale":1.5},"print":{"dpi":300,"scale":3,"bleedMm":3}}'::jsonb,
   '이중 렌더링 프로필'),
  ('retention',
   '{"freeTierMonths":3,"lowResMaxEdgePx":1280,"lowResQuality":70}'::jsonb,
   '무료 티어 보관 정책 — 삭제가 아니라 저해상도 전환 + 열람 잠금'),
  ('map_provider', '"kakao"'::jsonb, '난항 시 google로 교체'),
  ('llm_provider', '{"provider":"tbd","model":"tbd"}'::jsonb, '선정 예정');

alter table public.app_config enable row level security;

-- app_config의 정책(§10-6, 전체 authenticated 읽기)은 012_rls_policies.sql에서
-- 다른 정책들과 함께 일괄 생성한다 (헬퍼 의존은 없으나 파일 배치 일관성 유지).
