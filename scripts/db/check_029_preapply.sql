-- 029 적용 전 확인 (위임 70- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql). 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 OK. STOP 이 하나라도 있으면 적용하지 않는다. (8·9번은 값을 적어 두는 행 - 적용 뒤 verify_029_privileges.sql 3번·10번의 같은 값과 비교한다)
--  1) 029 가 아직 적용되지 않았고 028 까지 적용돼 있다
--  2) love_type_labels 에 RLS 가 켜져 있고 정책은 labels_select 하나뿐이다 (029 는 정책을 바꾸지 않는다)
--  3) love_type_labels 36행 · 내용 지문이 028 의 값(7e985f9d…)과 같다 (029 가 update 할 행이 다 있다)
--  4) description_ko 가 채워진 행 수 (0 이 정상 - 아니면 WARN: 029 는 같은 값으로 덮어쓰므로 안전하지만 눈으로 본다)
--  5) RLS 미적용 테이블 0 / 얼굴 임베딩류 칸 0 / issues_public.pdf_print_path 0
--  6) 지금 사용자가 postgres 다 (마이그레이션 실행 역할)
--  7) 020 이 원격에 적용돼 있고 적용 당시 update 문장이 36개다 (0건 갱신의 원인 확인)
--  8) 지금 description_ko 내용 지문 (정보 - 적용 전에는 칸이 전부 null 인 값)
--  9) 건드리지 않는 것의 지문: 배치 함수 본문 md5 둘 / cron 작업 / 027 함수 다섯 본문+권한 / 모든 public 정책 / anon·authenticated·service_role 의 테이블 권한
select 1 as n, '029 미적용 · 028 적용됨' as what,
       (select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations where version in ('028', '029')) as found,
       case when exists (select 1 from supabase_migrations.schema_migrations where version = '028')
             and not exists (select 1 from supabase_migrations.schema_migrations where version = '029') then 'OK' else 'STOP' end as verdict
union all select 2, 'love_type_labels: RLS 켜짐 · 정책 labels_select 하나뿐',
       (select relrowsecurity::text from pg_class where oid = 'public.love_type_labels'::regclass) || ' / '
         || coalesce((select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels'), '(없음)'),
       case when (select relrowsecurity from pg_class where oid = 'public.love_type_labels'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels') = 1
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_type_labels' and policyname = 'labels_select' and cmd = 'SELECT') then 'OK' else 'STOP' end
union all select 3, 'love_type_labels 36행 · 내용 지문 = 028 의 값',
       (select count(*)::text from public.love_type_labels) || ' / ' || (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels),
       case when (select count(*) from public.love_type_labels) = 36 and (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels) = '7e985f9dcea285df65af8571ac53c7ed' then 'OK' else 'STOP' end
union all select 4, 'description_ko 채워진 행 수 (0 이 정상 - 아니면 WARN)',
       (select count(description_ko)::text from public.love_type_labels),
       case when (select count(description_ko) from public.love_type_labels) = 0 then 'OK' else 'WARN' end
union all select 5, 'RLS 미적용 테이블 0행 / 얼굴 임베딩류 칸 0행 / issues_public.pdf_print_path 0',
       (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path') = 0 then 'OK' else 'STOP' end
union all select 6, 'current_user = postgres', current_user::text, case when current_user = 'postgres' then 'OK' else 'STOP' end
union all select 7, '020 적용됨 · 적용 당시 update 문장 36개',
       (select count(*)::text from supabase_migrations.schema_migrations m, unnest(m.statements) s where m.version = '020' and s ilike '%update public.love_type_labels set description_ko%'),
       case when (select count(*) from supabase_migrations.schema_migrations m, unnest(m.statements) s where m.version = '020' and s ilike '%update public.love_type_labels set description_ko%') = 36 then 'OK' else 'WARN' end
union all select 8, '현재 description_ko 내용 지문 (정보)', (select md5(string_agg(code || '~' || coalesce(description_ko, ''), '|' order by code collate "C")) from public.love_type_labels), 'OK'
union all select 9, '지문(적용 뒤 같아야 함) 배치 함수 둘 / cron / 027 함수 다섯 / 모든 public 정책 / 테이블 권한',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job) || ' / '
         || (select md5(string_agg(proname || ':' || md5(prosrc) || ':' || coalesce(proacl::text, ''), '|' order by proname)) from pg_proc
              where pronamespace = 'public'::regnamespace and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest')) || ' / '
         || (select md5(string_agg(tablename || '.' || policyname || ':' || cmd || ':' || coalesce(roles::text, '') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by tablename, policyname))
               from pg_policies where schemaname = 'public') || ' / '
         || (select md5(string_agg(table_name || ':' || grantee || ':' || privilege_type, '|' order by table_name, grantee, privilege_type))
               from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')),
       'OK'
order by n;
