-- 해제 배치(pg_cron execute-dissolutions) 진단 - 2026-11-03 메인 세션 작성. 읽기 전용 SELECT 하나. 작성만 했고 실행하지 않았다(실행은 사람).
-- 배경: test-68-purge 해제(purge_scheduled_at 2026-11-02T13:00Z)가 2026-11-03 05:00 UTC(14:00 KST) 실행 예정 시각 뒤에도 executed_at 이 없다.
-- 아무것도 쓰지 않는다. execute_dissolution · apply_retention_policy 를 부르지 않는다(R34-3). cron 예약을 바꾸지 않는다.
-- 출력에 키 · 토큰 · URL · 프로젝트 ref 가 없다(식별자는 uuid 앞 8자만).
--
-- 저장소 근거:
--   supabase/migrations/014_cron.sql:14-18      cron.schedule('execute-dissolutions', '0 5 * * *', select public.execute_dissolution(id) from couple_dissolutions where ... purge_scheduled_at <= now())
--   supabase/migrations/013_batch_functions.sql:114-167  execute_dissolution 본문 - 개시자 profiles 에 biometric_consent_revoked_at = coalesce(..., now())
--   supabase/migrations/003_profiles.sql:40-42  chk_biometric_revoke_order: biometric_consent_revoked_at is null or biometric_consent_at is not null
--   supabase/migrations/025_function_execute_grants.sql:25-26  배치 함수 EXECUTE 를 public · anon · authenticated · service_role 에서 회수(소유자 postgres 가 cron 으로 부른다는 전제)
--
-- 행 설명:
--   1) cron 작업 세 개의 예약 · 활성 · 실행 역할
--   2) execute-dissolutions 최근 실행 기록 10건(시각 · 상태 · 메시지 앞 300자) - 11-02 · 11-03 05:00 UTC 전후가 핵심
--   3) expire-stories 최근 3건 - 스케줄러 자체가 도는지
--   4) 지금 실행 대상인 해제(취소 안 됨 · 미실행 · 유예 끝)
--   5) 4)의 개시자 중 biometric_consent_at 이 없고 revoked_at 도 없는 수 = execute_dissolution 이 chk_biometric_revoke_order 에 걸릴 후보
--   6) execute_dissolution 소유자 · definer · 설정(search_path) · 제약 정의 확인
select 1 as n, 'cron 작업' as what,
       coalesce((select string_agg(jobname || ' | ' || schedule || ' | active=' || active || ' | user=' || username, E'\n' order by jobname)
                   from cron.job where jobname in ('execute-dissolutions', 'retention-policy', 'expire-stories')), '(없음)') as detail
union all
select 2, 'execute-dissolutions 실행 기록(최근 10)',
       coalesce((select string_agg(to_char(r.start_time at time zone 'UTC', 'MM-DD HH24:MI:SS') || 'Z | ' || r.status || ' | ' || left(coalesce(r.return_message, ''), 300), E'\n' order by r.start_time desc)
                   from (select d.* from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                          where j.jobname = 'execute-dissolutions' order by d.start_time desc limit 10) r), '(기록 없음)')
union all
select 3, 'expire-stories 실행 기록(최근 3)',
       coalesce((select string_agg(to_char(r.start_time at time zone 'UTC', 'MM-DD HH24:MI:SS') || 'Z | ' || r.status, E'\n' order by r.start_time desc)
                   from (select d.* from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                          where j.jobname = 'expire-stories' order by d.start_time desc limit 3) r), '(기록 없음)')
union all
select 4, '실행 대상 해제(취소 안 됨 · 미실행 · 유예 끝)',
       coalesce((select string_agg(left(id::text, 8) || ' | couple ' || left(couple_id::text, 8) || ' | purge ' || to_char(purge_scheduled_at at time zone 'UTC', 'MM-DD HH24:MI') || 'Z | reason ' || coalesce(reason::text, '-'), E'\n' order by purge_scheduled_at)
                   from public.couple_dissolutions
                  where cancelled_at is null and executed_at is null and purge_scheduled_at <= now()), '(없음)')
union all
select 5, '4)의 개시자 중 biometric_consent_at · revoked_at 둘 다 없음(제약 위반 후보) / 4)의 전체',
       (select count(*) filter (where p.biometric_consent_at is null and p.biometric_consent_revoked_at is null)::text
               || ' / ' || count(*)::text
          from public.couple_dissolutions d join public.profiles p on p.id = d.initiated_by
         where d.cancelled_at is null and d.executed_at is null and d.purge_scheduled_at <= now())
union all
select 6, 'execute_dissolution 소유자 · definer · 설정 / chk_biometric_revoke_order 정의',
       (select pg_get_userbyid(proowner) || ' | definer=' || prosecdef || ' | ' || coalesce(array_to_string(proconfig, ','), '-')
          from pg_proc where oid = 'public.execute_dissolution(uuid)'::regprocedure)
       || E'\n' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'chk_biometric_revoke_order' and conrelid = 'public.profiles'::regclass), '(제약 없음)')
order by n;
