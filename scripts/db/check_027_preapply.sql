-- 027 적용 전 확인 (위임 68- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql). 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 OK. STOP 이 하나라도 있으면 적용하지 않는다. (13번은 값을 적어 두는 행 - 적용 뒤 verify_027_privileges.sql 의 같은 값과 비교한다)
--  1) 027 함수 다섯 · 트리거 함수가 아직 없다 (있으면 이미 적용된 것)
--  2) profiles · personality_profiles · couple_dissolutions 에 RLS 가 켜져 있다
--  3) 027 이 지우는 정책(dissolutions_insert · dissolutions_update)과 바꾸는 정책(profiles_insert · pprofiles_write)이 있다
--  4) authenticated 가 세 테이블에 테이블 단위 UPDATE 를 가진다 (027 이 회수할 대상), couple_dissolutions 는 INSERT 도
--  5) 027 이 회수에 쓰는 칸 이름이 전부 있다 (profiles 20 · personality_profiles 12 · couple_dissolutions 9 — 없는 칸 이름이면 revoke 가 실패한다)
--  6) 얼굴 임베딩류 칸이 없다
--  7) 지금 사용자가 postgres 다 (마이그레이션 실행 역할)
--  8) dissolution_reason enum 에 unlink · withdrawal 이 있다 (탈퇴 사유로 쓴다 - enum 을 새로 바꾸지 않는다)
--  9) pg_cron 작업 execute-dissolutions 가 있다 (027 이 건드리지 않는다)
-- 10) love_type_labels 가 36행이다 (재검사 복구 경로가 코드를 읽는다). 아니면 WARN: 적용은 막지 않는다 - 2026-10-26 원격 개발은 0행이었다
-- 11) 027 이 쓰는 기존 정책 SELECT(dissolutions_select)가 있다 (그대로 남는다)
-- 12) tg_set_updated_at 이 있다 (두 테이블의 기존 트리거)
-- 13) 건드리지 않는 것의 지문: execute_dissolution · apply_retention_policy 본문 md5, cron 작업 세 개의 schedule+command md5
with cols as (
  select table_name t, column_name c from information_schema.columns where table_schema = 'public' and table_name in ('profiles', 'personality_profiles', 'couple_dissolutions')
), expected(t, c) as (values
  ('profiles','id'),('profiles','display_name'),('profiles','gender'),('profiles','birth_date'),('profiles','mbti'),('profiles','onboarding_step'),
  ('profiles','photo_sync_enabled'),('profiles','photo_scan_completed_at'),('profiles','photo_scan_cursor'),('profiles','biometric_consent_at'),
  ('profiles','biometric_consent_revoked_at'),('profiles','reference_photo_path'),('profiles','terms_agreed_at'),('profiles','privacy_agreed_at'),
  ('profiles','ai_usage_agreed_at'),('profiles','deleted_at'),('profiles','purge_scheduled_at'),('profiles','created_at'),('profiles','updated_at'),('profiles','marketing_agreed_at'),
  ('personality_profiles','user_id'),('personality_profiles','active_assessment_id'),('personality_profiles','enneagram_inferred'),('personality_profiles','enneagram_override'),
  ('personality_profiles','override_updated_at'),('personality_profiles','override_count'),('personality_profiles','enneagram_effective'),('personality_profiles','attachment'),
  ('personality_profiles','love_type_code'),('personality_profiles','retest_used'),('personality_profiles','created_at'),('personality_profiles','updated_at'),
  ('couple_dissolutions','id'),('couple_dissolutions','couple_id'),('couple_dissolutions','initiated_by'),('couple_dissolutions','reason'),('couple_dissolutions','requested_at'),
  ('couple_dissolutions','purge_scheduled_at'),('couple_dissolutions','cancelled_at'),('couple_dissolutions','executed_at'),('couple_dissolutions','partner_notified_at'))
select 1 as n, '027 함수 · 트리거 함수 없음' as what,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest','tg_profiles_onboarding_step_guard'))::text as found,
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest','tg_profiles_onboarding_step_guard')) then 'OK' else 'STOP' end as verdict
union all
select 2, '세 테이블 RLS 켜짐',
       (select string_agg(relname || '=' || relrowsecurity::text, ',' order by relname) from pg_class where oid in ('public.profiles'::regclass, 'public.personality_profiles'::regclass, 'public.couple_dissolutions'::regclass)),
       case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.profiles'::regclass, 'public.personality_profiles'::regclass, 'public.couple_dissolutions'::regclass)) then 'OK' else 'STOP' end
union all
select 3, '지우거나 바꿀 정책이 있다',
       (select string_agg(tablename || '.' || policyname, ',' order by tablename, policyname) from pg_policies
         where schemaname = 'public' and policyname in ('dissolutions_insert','dissolutions_update','profiles_insert','pprofiles_write')),
       case when (select count(*) from pg_policies where schemaname = 'public' and policyname in ('dissolutions_insert','dissolutions_update','profiles_insert','pprofiles_write')) = 4 then 'OK' else 'STOP' end
union all
select 4, 'authenticated 테이블 단위 쓰기 권한 있음 (회수 대상)',
       'profiles.U=' || has_table_privilege('authenticated', 'public.profiles', 'UPDATE')::text
         || ' pp.U=' || has_table_privilege('authenticated', 'public.personality_profiles', 'UPDATE')::text
         || ' diss.I=' || has_table_privilege('authenticated', 'public.couple_dissolutions', 'INSERT')::text
         || ' diss.U=' || has_table_privilege('authenticated', 'public.couple_dissolutions', 'UPDATE')::text,
       case when has_table_privilege('authenticated', 'public.profiles', 'UPDATE') and has_table_privilege('authenticated', 'public.personality_profiles', 'UPDATE')
             and has_table_privilege('authenticated', 'public.couple_dissolutions', 'INSERT') and has_table_privilege('authenticated', 'public.couple_dissolutions', 'UPDATE')
            then 'OK' else 'STOP' end
union all
select 5, 'revoke 에 쓰는 칸 전부 있음 (41칸)',
       (select count(*) from cols)::text || '칸, 부족 [' || coalesce((select string_agg(t || '.' || c, ',') from expected e where not exists (select 1 from cols x where x.t = e.t and x.c = e.c)), '') || ']',
       case when not exists (select 1 from expected e where not exists (select 1 from cols x where x.t = e.t and x.c = e.c)) then 'OK' else 'STOP' end
union all
select 6, '얼굴 임베딩류 칸 없음 (public 전체)',
       (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))::text,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0 then 'OK' else 'STOP' end
union all
select 7, 'current_user = postgres', current_user::text, case when current_user = 'postgres' then 'OK' else 'STOP' end
union all
select 8, 'dissolution_reason 에 unlink · withdrawal', (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = 'public.dissolution_reason'::regtype),
       case when (select count(*) from pg_enum where enumtypid = 'public.dissolution_reason'::regtype and enumlabel in ('unlink', 'withdrawal')) = 2 then 'OK' else 'STOP' end
union all
select 9, 'pg_cron execute-dissolutions 있음', coalesce((select schedule from cron.job where jobname = 'execute-dissolutions'), '(없음)'),
       case when exists (select 1 from cron.job where jobname = 'execute-dissolutions') then 'OK' else 'STOP' end
union all
select 10, 'love_type_labels 36행 (아니면 WARN - 적용은 막지 않지만 재검사 복구 경로가 P0002 로 끝난다)', (select count(*) from public.love_type_labels)::text, case when (select count(*) from public.love_type_labels) = 36 then 'OK' else 'WARN' end
union all
select 11, 'dissolutions_select 있음 (그대로 남는다)', (select qual from pg_policies where schemaname = 'public' and policyname = 'dissolutions_select'),
       case when exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'dissolutions_select') then 'OK' else 'STOP' end
union all
select 12, 'tg_set_updated_at 있음', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'tg_set_updated_at')::text,
       case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'tg_set_updated_at') then 'OK' else 'STOP' end
union all
select 13, '지문(적용 뒤 같아야 함) execute_dissolution / apply_retention_policy / cron',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job),
       'OK'
order by n;
