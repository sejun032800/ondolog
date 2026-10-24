-- 025 실증 ③ (위임 60- 2부): 소유자(postgres) 권한으로 배치 함수 하나를 안전하게 실행. 025 적용 뒤 메인 세션이 실행한다. 작성만 했고 실행하지 않았다.
-- 도구: Supabase MCP execute_sql (postgres 역할 - pg_cron 이 쓰는 역할과 같다).
--
-- expire_stories() 는 "만료됐고 아직 처리 안 된" 스토리가 0건일 때만 부른다 (아래 case 가 0건이 아니면 함수를 부르지 않고 null 을 돌려준다).
--   기대: executed = true, result = 0 (처리 0건), pending_before = 0.
--   pending_before 가 0이 아니면 result 는 null 이고 아무것도 실행되지 않았다 - 이 경우 메인 세션이 판단한다.
-- execute_dissolution · apply_retention_policy 는 이 파일에서 실행하지 않는다 (데이터를 지울 수 있다). 소유자 권한 확인은 has_function_privilege 로 대신한다.

select (select count(*) from public.stories where resolved_at is null and expires_at <= now()) as pending_before,
       case when (select count(*) from public.stories where resolved_at is null and expires_at <= now()) = 0
            then public.expire_stories() end as result,
       (select count(*) from public.stories where resolved_at is null and expires_at <= now()) = 0 as executed,
       (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname) from cron.job) as cron_jobs,
       has_function_privilege('postgres', 'public.execute_dissolution(uuid)', 'execute') as owner_can_dissolve,
       has_function_privilege('postgres', 'public.apply_retention_policy()', 'execute') as owner_can_retain;
