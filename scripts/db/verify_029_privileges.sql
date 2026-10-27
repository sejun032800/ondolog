-- 029 적용 뒤 정책 · 권한 · 데이터 확인 (위임 70- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션. 작성만 했고 실행하지 않았다.
-- 기대: verdict 가 전부 ok. (10 은 check_029_preapply.sql 9번과 같은 값이어야 한다 - 눈으로 비교)
-- description_ko 36행의 원본(docs/ONDOLOG_36_descriptions.md, ** 제외) 글자 단위 대조는 실증 스크립트(verifyDescriptions70.ts)와 jest(loveTypeDescriptionsSeed.test.ts)가 한다. 여기서는 DB 쪽 지문이다.
select 1 as n, '029 적용 기록' as what, (select string_agg(version || ' ' || name, ',') from supabase_migrations.schema_migrations where version = '029') as found,
       case when exists (select 1 from supabase_migrations.schema_migrations where version = '029') then 'ok' else 'FAIL' end as verdict
union all select 2, 'love_type_labels 36행 · description_ko 36행 채워짐 · 빈 문자열 0',
       (select count(*)::text || ' / ' || count(description_ko)::text || ' / ' || (count(*) filter (where description_ko = ''))::text from public.love_type_labels),
       case when (select count(*) = 36 and count(description_ko) = 36 and count(*) filter (where description_ko = '') = 0 from public.love_type_labels) then 'ok' else 'FAIL' end
union all select 3, 'description_ko 내용 지문 (029 문구에서 계산한 md5 와 같아야 한다)',
       (select md5(string_agg(code || '~' || coalesce(description_ko, ''), '|' order by code collate "C")) from public.love_type_labels),
       case when (select md5(string_agg(code || '~' || coalesce(description_ko, ''), '|' order by code collate "C")) from public.love_type_labels) = '03d2cc54396b78f595fb2574d4f7e62e' then 'ok' else 'FAIL' end
union all select 4, '별표(**)가 남은 행 0 · 문단 구분(빈 줄)이 없는 행 0',
       (select (count(*) filter (where description_ko like '%**%'))::text || ' / ' || (count(*) filter (where description_ko not like E'%\n\n%'))::text from public.love_type_labels),
       case when (select count(*) filter (where description_ko like '%**%') = 0 and count(*) filter (where description_ko not like E'%\n\n%') = 0 from public.love_type_labels) then 'ok' else 'FAIL' end
union all select 5, '라벨 8칸 내용 지문 그대로 (028 의 값)',
       (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels),
       case when (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels) = '7e985f9dcea285df65af8571ac53c7ed' then 'ok' else 'FAIL' end
union all select 6, 'love_type_labels: RLS 켜짐 · 정책 labels_select 하나뿐',
       (select relrowsecurity::text from pg_class where oid = 'public.love_type_labels'::regclass) || ' / '
         || coalesce((select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels'), '(없음)'),
       case when (select relrowsecurity from pg_class where oid = 'public.love_type_labels'::regclass)
             and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels') = 1
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_type_labels' and policyname = 'labels_select' and cmd = 'SELECT') then 'ok' else 'FAIL' end
union all select 7, 'assessments_insert with check 그대로 (user_id = auth.uid() 와 seq = 1)',
       (select with_check from pg_policies where schemaname = 'public' and policyname = 'assessments_insert'),
       case when (select with_check ~ 'auth.uid' and with_check ~ 'seq = 1' from pg_policies where schemaname = 'public' and policyname = 'assessments_insert') then 'ok' else 'FAIL' end
union all select 8, '027 fn_complete_retest 권한 그대로: anon 불가 · authenticated 가능 · service_role 불가 · PUBLIC 몫 없음 · definer · search_path 비움',
       (select 'anon=' || has_function_privilege('anon', oid, 'execute')::text || ' authenticated=' || has_function_privilege('authenticated', oid, 'execute')::text || ' service_role=' || has_function_privilege('service_role', oid, 'execute')::text
               || ' definer=' || prosecdef::text || ' config=' || coalesce(proconfig::text, '(없음)') from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_complete_retest'),
       case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'fn_complete_retest'
                           and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('service_role', p.oid, 'execute')
                           and p.prosecdef and p.proconfig @> array['search_path=""']
                           and p.proacl is not null and not exists (select 1 from unnest(p.proacl) a where a::text like '=%')) then 'ok' else 'FAIL' end
union all select 9, 'pg_cron execute-dissolutions 그대로 있음', coalesce((select schedule from cron.job where jobname = 'execute-dissolutions'), '(없음)'),
       case when exists (select 1 from cron.job where jobname = 'execute-dissolutions') then 'ok' else 'FAIL' end
union all select 10, '지문: check_029_preapply.sql 9번과 같은 값이어야 한다(눈으로 비교) - 배치 함수 둘 / cron / 027 함수 다섯 / 모든 public 정책 / 테이블 권한',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job) || ' / '
         || (select md5(string_agg(proname || ':' || md5(prosrc) || ':' || coalesce(proacl::text, ''), '|' order by proname)) from pg_proc
              where pronamespace = 'public'::regnamespace and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest')) || ' / '
         || (select md5(string_agg(tablename || '.' || policyname || ':' || cmd || ':' || coalesce(roles::text, '') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by tablename, policyname))
               from pg_policies where schemaname = 'public') || ' / '
         || (select md5(string_agg(table_name || ':' || grantee || ':' || privilege_type, '|' order by table_name, grantee, privilege_type))
               from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')),
       'ok'
union all select 11, 'RLS 미적용 테이블 0행 / 얼굴 임베딩류 칸 0행 / issues_public.pdf_print_path 0',
       (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path') = 0 then 'ok' else 'FAIL' end
order by n;
