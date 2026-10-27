-- 028 적용 전 확인 (위임 69- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql). 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 OK. STOP 이 하나라도 있으면 적용하지 않는다. (11번은 값을 적어 두는 행 - 적용 뒤 verify_028_privileges.sql 13번의 같은 값과 비교한다)
--  1) 028 이 아직 적용되지 않았다 - assessments_insert 의 with check 에 seq 가 없다
--  2) personality_assessments · love_type_labels 에 RLS 가 켜져 있다
--  3) personality_assessments 의 정책이 select(assessments_select) · insert(assessments_insert) 둘뿐이다 (UPDATE · DELETE 정책 없음 = 불변 로그)
--  4) love_type_labels 의 정책이 labels_select 하나뿐이다 (쓰기 정책 없음)
--  5) love_type_labels 의 primary key(code) · unique(enneagram_core, attachment) 가 있다 (on conflict (code) 가 쓴다)
--  6) love_type_labels 의 행 수 (0 이어야 정상 - 이미 있으면 WARN: 적용은 on conflict 로 안전하지만 어긋난 행이 있는지 눈으로 본다) / description_ko 가 채워진 행 수
--  7) 얼굴 임베딩류 칸이 없다
--  8) 지금 사용자가 postgres 다 (마이그레이션 실행 역할)
--  9) 027 재검사 함수가 있고 authenticated 만 실행한다 (028 이 바꾸지 않는다)
-- 10) personality_assessments 의 seq = 2 행 수 (정보 - 028 은 INSERT 정책만 바꾸므로 기존 행은 그대로다)
-- 11) 건드리지 않는 것의 지문: 배치 함수 본문 md5 둘, cron 작업 md5, 027 함수 다섯 본문 md5, assessments_insert 를 뺀 모든 public 정책 md5
select 1 as n, 'assessments_insert with check 에 seq 없음 (028 미적용)' as what,
       (select with_check from pg_policies where schemaname = 'public' and policyname = 'assessments_insert') as found,
       case when (select with_check from pg_policies where schemaname = 'public' and policyname = 'assessments_insert') is not null
             and (select with_check from pg_policies where schemaname = 'public' and policyname = 'assessments_insert') !~ 'seq' then 'OK' else 'STOP' end as verdict
union all
select 2, '두 테이블 RLS 켜짐',
       (select string_agg(relname || '=' || relrowsecurity::text, ',' order by relname) from pg_class where oid in ('public.personality_assessments'::regclass, 'public.love_type_labels'::regclass)),
       case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.personality_assessments'::regclass, 'public.love_type_labels'::regclass)) then 'OK' else 'STOP' end
union all
select 3, 'personality_assessments 정책 = assessments_select(SELECT) · assessments_insert(INSERT) 둘뿐',
       (select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'personality_assessments'),
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'personality_assessments') = 2
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'personality_assessments' and policyname = 'assessments_select' and cmd = 'SELECT')
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'personality_assessments' and policyname = 'assessments_insert' and cmd = 'INSERT') then 'OK' else 'STOP' end
union all
select 4, 'love_type_labels 정책 = labels_select 하나뿐',
       (select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels'),
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels') = 1
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_type_labels' and policyname = 'labels_select' and cmd = 'SELECT') then 'OK' else 'STOP' end
union all
select 5, 'love_type_labels: primary key(code) · unique(enneagram_core, attachment)',
       (select string_agg(contype::text || ':' || pg_get_constraintdef(oid), ' ; ' order by contype, oid) from pg_constraint where conrelid = 'public.love_type_labels'::regclass and contype in ('p', 'u')),
       case when exists (select 1 from pg_constraint where conrelid = 'public.love_type_labels'::regclass and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (code)')
             and exists (select 1 from pg_constraint where conrelid = 'public.love_type_labels'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (enneagram_core, attachment)') then 'OK' else 'STOP' end
union all
select 6, 'love_type_labels 행 수 / description_ko 채워진 행 수 (0 이 정상 - 아니면 WARN)',
       (select count(*) from public.love_type_labels)::text || ' / ' || (select count(*) from public.love_type_labels where description_ko is not null)::text,
       case when (select count(*) from public.love_type_labels) = 0 then 'OK' else 'WARN' end
union all
select 7, '얼굴 임베딩류 칸 없음 (public 전체)',
       (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))::text,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0 then 'OK' else 'STOP' end
union all
select 8, 'current_user = postgres', current_user::text, case when current_user = 'postgres' then 'OK' else 'STOP' end
union all
select 9, '027 fn_complete_retest 있음 · authenticated 만 실행',
       (select 'anon=' || has_function_privilege('anon', oid, 'execute')::text || ' authenticated=' || has_function_privilege('authenticated', oid, 'execute')::text || ' service_role=' || has_function_privilege('service_role', oid, 'execute')::text
          from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_complete_retest'),
       case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_complete_retest'
                           and not has_function_privilege('anon', oid, 'execute') and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('service_role', oid, 'execute')) then 'OK' else 'STOP' end
union all
select 10, 'personality_assessments seq = 2 행 수 (정보)', (select count(*) from public.personality_assessments where seq = 2)::text, 'OK'
union all
select 11, '지문(적용 뒤 같아야 함) 배치 함수 둘 / cron / 027 함수 다섯 / assessments_insert 뺀 정책 전체',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job) || ' / '
         || (select md5(string_agg(proname || ':' || md5(prosrc) || ':' || coalesce(proacl::text, ''), '|' order by proname)) from pg_proc
              where pronamespace = 'public'::regnamespace and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest')) || ' / '
         || (select md5(string_agg(tablename || '.' || policyname || ':' || cmd || ':' || coalesce(roles::text, '') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by tablename, policyname))
               from pg_policies where schemaname = 'public' and policyname <> 'assessments_insert'),
       'OK'
order by n;
