-- ─────────────────────────────────────────────
-- 11-4. pg_cron 스케줄
-- ─────────────────────────────────────────────
-- SCHEMA.md §1에는 없으나 cron.schedule() 사용을 위한 필수 선행 조건.
-- Supabase 관리형 프로젝트는 pg_cron 확장을 지원하며, extensions 스키마에 설치한다.
create extension if not exists pg_cron with schema extensions;

select cron.schedule('expire-stories',    '*/15 * * * *',
  $$ select public.expire_stories(); $$);

select cron.schedule('retention-policy',  '0 4 * * *',
  $$ select public.apply_retention_policy(); $$);

select cron.schedule('execute-dissolutions', '0 5 * * *', $$
  select public.execute_dissolution(id)
  from public.couple_dissolutions
  where cancelled_at is null and executed_at is null and purge_scheduled_at <= now();
$$);

-- 연애 온도 산출, 스탯 계산, 코너 생성, PDF 렌더링은 LLM·Playwright가 필요하므로
-- pg_cron이 아니라 Edge Function 스케줄러로 실행한다. (SCHEMA.md §11 각주)
