-- 027 적용 뒤 권한 · 정책 · 칸 확인 (위임 68- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션. 작성만 했고 실행하지 않았다.
-- 기대: verdict 가 전부 ok. (17~19 는 SCHEMA 14 검증 쿼리와 같은 기준, 20 은 check_027_preapply.sql 13번과 같은 값이어야 한다 - 눈으로 비교)
with fns(sig) as (values
  ('public.fn_request_dissolution()'),
  ('public.fn_cancel_dissolution(uuid)'),
  ('public.fn_request_withdrawal()'),
  ('public.fn_cancel_withdrawal()'),
  ('public.fn_complete_retest(text,boolean,public.quiz_choice,public.quiz_choice,public.quiz_choice,public.quiz_choice,public.quiz_choice,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,smallint,public.attachment_type,text,text)')
), five as (
  select f.sig, p.oid, p.prosecdef, p.proconfig, p.proacl from fns f join pg_proc p on p.oid = to_regprocedure(f.sig)
), trg as (
  select * from pg_proc where pronamespace = 'public'::regnamespace and proname = 'tg_profiles_onboarding_step_guard'
), upd as (
  select c.relname as tbl, r.rolname as role, a.attname as col
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join pg_roles r
   where c.oid in ('public.profiles'::regclass, 'public.personality_profiles'::regclass)
     and r.rolname in ('anon', 'authenticated', 'service_role')
     and has_column_privilege(r.rolname, c.oid, a.attname, 'UPDATE')
), pol as (
  select tablename, policyname, cmd, qual, with_check from pg_policies
   where schemaname = 'public' and tablename in ('profiles', 'personality_profiles', 'couple_dissolutions')
)
select 1 as n, '함수 5개 존재' as what, (select count(*)::text from five) as found, case when (select count(*) from five) = 5 then 'ok' else 'FAIL' end as verdict
union all select 2, 'anon 실행 가능한 함수 수 (기대 0)', (select count(*)::text from five where has_function_privilege('anon', oid, 'execute')),
       case when (select count(*) from five where has_function_privilege('anon', oid, 'execute')) = 0 then 'ok' else 'FAIL' end
union all select 3, 'authenticated 실행 가능한 함수 수 (기대 5)', (select count(*)::text from five where has_function_privilege('authenticated', oid, 'execute')),
       case when (select count(*) from five where has_function_privilege('authenticated', oid, 'execute')) = 5 then 'ok' else 'FAIL' end
union all select 4, 'service_role 실행 가능한 함수 수 (기대 0)', (select count(*)::text from five where has_function_privilege('service_role', oid, 'execute')),
       case when (select count(*) from five where has_function_privilege('service_role', oid, 'execute')) = 0 then 'ok' else 'FAIL' end
union all select 5, 'PUBLIC 몫 실행 있는 함수 수 (proacl 에 "=" 로 시작하는 항목, 기대 0 · acl null 도 실패)',
       (select count(*)::text from five f where f.proacl is null or exists (select 1 from unnest(f.proacl) a where a::text like '=%')),
       case when (select count(*) from five f where f.proacl is null or exists (select 1 from unnest(f.proacl) a where a::text like '=%')) = 0 then 'ok' else 'FAIL' end
union all select 6, 'security definer 인 함수 수 (기대 5)', (select count(*)::text from five where prosecdef),
       case when (select count(*) from five where prosecdef) = 5 then 'ok' else 'FAIL' end
union all select 7, 'proconfig 에 search_path 가 빈 값으로 고정된 함수 수 (기대 5)', (select count(*)::text from five where proconfig @> array['search_path=""']),
       case when (select count(*) from five where proconfig @> array['search_path=""']) = 5 then 'ok' else 'FAIL' end
union all select 8, '트리거 함수: 세 역할 + PUBLIC 모두 실행 불가',
       coalesce((select proacl::text from trg), '(없음)'),
       case when exists (select 1 from trg)
             and not has_function_privilege('anon', (select oid from trg), 'execute')
             and not has_function_privilege('authenticated', (select oid from trg), 'execute')
             and not has_function_privilege('service_role', (select oid from trg), 'execute')
             and (select proacl from trg) is not null
             and not exists (select 1 from trg, unnest(trg.proacl) a where a::text like '=%') then 'ok' else 'FAIL' end
union all select 9, '트리거 tg_profiles_onboarding_step_guard 가 profiles 에 있다 (BEFORE UPDATE OF onboarding_step)',
       (select pg_get_triggerdef(t.oid) from pg_trigger t where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'tg_profiles_onboarding_step_guard'),
       case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'tg_profiles_onboarding_step_guard' and not t.tgisinternal
                           and pg_get_triggerdef(t.oid) ~ 'BEFORE UPDATE OF onboarding_step') then 'ok' else 'FAIL' end
union all select 10, '세 테이블 RLS 켜짐',
       (select string_agg(relname || '=' || relrowsecurity::text, ',' order by relname) from pg_class where oid in ('public.profiles'::regclass, 'public.personality_profiles'::regclass, 'public.couple_dissolutions'::regclass)),
       case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.profiles'::regclass, 'public.personality_profiles'::regclass, 'public.couple_dissolutions'::regclass)) then 'ok' else 'FAIL' end
union all select 11, 'couple_dissolutions: anon · authenticated 의 INSERT · UPDATE · DELETE 없음 · SELECT 있음',
       (select string_agg(r || ':' || p || '=' || has_table_privilege(r, 'public.couple_dissolutions', p)::text, ' ' order by r, p)
          from (values ('anon'), ('authenticated')) a(r), (values ('INSERT'), ('UPDATE'), ('DELETE'), ('SELECT')) b(p)),
       case when not exists (select 1 from (values ('anon'), ('authenticated')) a(r), (values ('INSERT'), ('UPDATE'), ('DELETE')) b(p) where has_table_privilege(r, 'public.couple_dissolutions', p))
             and has_table_privilege('authenticated', 'public.couple_dissolutions', 'SELECT') then 'ok' else 'FAIL' end
union all select 12, 'couple_dissolutions: 정책은 dissolutions_select 하나만',
       (select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pol where tablename = 'couple_dissolutions'),
       case when (select count(*) from pol where tablename = 'couple_dissolutions') = 1
             and exists (select 1 from pol where tablename = 'couple_dissolutions' and policyname = 'dissolutions_select' and cmd = 'SELECT') then 'ok' else 'FAIL' end
union all select 13, 'profiles: 테이블 단위 UPDATE anon/authenticated 없음',
       has_table_privilege('anon', 'public.profiles', 'UPDATE')::text || '/' || has_table_privilege('authenticated', 'public.profiles', 'UPDATE')::text,
       case when not has_table_privilege('anon', 'public.profiles', 'UPDATE') and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then 'ok' else 'FAIL' end
union all select 14, 'profiles: authenticated 가 UPDATE 할 수 있는 칸 = 정확히 일곱 칸 · anon 은 0',
       (select string_agg(col, ',' order by col) from upd where tbl = 'profiles' and role = 'authenticated') || ' / anon ' || (select count(*)::text from upd where tbl = 'profiles' and role = 'anon'),
       case when (select string_agg(col, ',' order by col) from upd where tbl = 'profiles' and role = 'authenticated')
                 = 'biometric_consent_at,biometric_consent_revoked_at,display_name,gender,marketing_agreed_at,onboarding_step,reference_photo_path'
             and (select count(*) from upd where tbl = 'profiles' and role = 'anon') = 0 then 'ok' else 'FAIL' end
union all select 15, 'profiles: deleted_at · purge_scheduled_at · 동의 시각 3칸 · birth_date · mbti 는 authenticated UPDATE 불가',
       (select count(*)::text from upd where tbl = 'profiles' and role = 'authenticated' and col in ('deleted_at', 'purge_scheduled_at', 'terms_agreed_at', 'privacy_agreed_at', 'ai_usage_agreed_at', 'birth_date', 'mbti')),
       case when (select count(*) from upd where tbl = 'profiles' and role = 'authenticated' and col in ('deleted_at', 'purge_scheduled_at', 'terms_agreed_at', 'privacy_agreed_at', 'ai_usage_agreed_at', 'birth_date', 'mbti')) = 0 then 'ok' else 'FAIL' end
union all select 16, 'personality_profiles: 테이블 단위 UPDATE 없음 · authenticated 칸 = 정확히 네 칸 · anon 0',
       has_table_privilege('anon', 'public.personality_profiles', 'UPDATE')::text || '/' || has_table_privilege('authenticated', 'public.personality_profiles', 'UPDATE')::text
         || ' ' || (select string_agg(col, ',' order by col) from upd where tbl = 'personality_profiles' and role = 'authenticated') || ' / anon ' || (select count(*)::text from upd where tbl = 'personality_profiles' and role = 'anon'),
       case when not has_table_privilege('anon', 'public.personality_profiles', 'UPDATE') and not has_table_privilege('authenticated', 'public.personality_profiles', 'UPDATE')
             and (select string_agg(col, ',' order by col) from upd where tbl = 'personality_profiles' and role = 'authenticated') = 'enneagram_override,love_type_code,override_count,override_updated_at'
             and (select count(*) from upd where tbl = 'personality_profiles' and role = 'anon') = 0 then 'ok' else 'FAIL' end
union all select 17, 'profiles_insert with check: id · deleted_at IS NULL · purge_scheduled_at IS NULL',
       (select with_check from pol where policyname = 'profiles_insert'),
       case when (select with_check ~ 'auth.uid' and with_check ~ 'deleted_at IS NULL' and with_check ~ 'purge_scheduled_at IS NULL' from pol where policyname = 'profiles_insert') then 'ok' else 'FAIL' end
union all select 18, 'pprofiles_write(INSERT) with check: user_id · retest_used = false',
       (select with_check from pol where policyname = 'pprofiles_write'),
       case when (select with_check ~ 'auth.uid' and with_check ~ 'retest_used = false' from pol where policyname = 'pprofiles_write') then 'ok' else 'FAIL' end
union all select 19, 'SELECT 정책 그대로 (profiles_select · pprofiles_select · dissolutions_select 각 1개)',
       (select string_agg(policyname, ',' order by policyname) from pol where cmd = 'SELECT'),
       case when (select count(*) from pol where cmd = 'SELECT') = 3
             and (select count(*) from pol where policyname in ('profiles_select', 'pprofiles_select', 'dissolutions_select')) = 3 then 'ok' else 'FAIL' end
union all select 20, 'RLS 미적용 테이블 0행', (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0 then 'ok' else 'FAIL' end
union all select 21, '얼굴 임베딩류 칸 0행', (select count(*)::text from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')),
       case when (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0 then 'ok' else 'FAIL' end
union all select 22, 'issues_public.pdf_print_path 노출 0', (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path') = 0 then 'ok' else 'FAIL' end
union all select 23, '지문: execute_dissolution / apply_retention_policy / cron - check_027_preapply.sql 13번과 같은 값이어야 한다(눈으로 비교)',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job),
       'ok'
order by n;
