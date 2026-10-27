-- 028 적용 뒤 정책 · 권한 · 데이터 확인 (위임 69- 산출). 읽기 전용 SELECT 하나. 실행은 메인 세션. 작성만 했고 실행하지 않았다.
-- 기대: verdict 가 전부 ok. (13 은 check_028_preapply.sql 11번과 같은 값이어야 한다 - 눈으로 비교)
-- 라벨 36행의 MASTER 글자 단위 대조는 실증 스크립트(verifyLabels69.ts)와 jest(loveTypeLabelsSeed.test.ts)가 한다. 여기 1~4 는 DB 쪽 지문이다.
select 1 as n, 'love_type_labels 36행' as what, (select count(*)::text from public.love_type_labels) as found,
       case when (select count(*) from public.love_type_labels) = 36 then 'ok' else 'FAIL' end as verdict
union all select 2, '(enneagram_core, attachment) 36쌍 · code 36개 고유',
       (select count(distinct (enneagram_core, attachment))::text || ' / ' || count(distinct code)::text from public.love_type_labels),
       case when (select count(distinct (enneagram_core, attachment)) = 36 and count(distinct code) = 36 from public.love_type_labels) then 'ok' else 'FAIL' end
union all select 3, '36행 내용 지문 (028 의 값에서 계산한 md5 와 같아야 한다)',
       (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels),
       case when (select md5(string_agg(code || '~' || enneagram_core || '~' || attachment || '~' || core_en || '~' || suffix_en || '~' || label_en || '~' || label_ko || '~' || copy_ko, '|' order by code collate "C")) from public.love_type_labels)
                 = '7e985f9dcea285df65af8571ac53c7ed' then 'ok' else 'FAIL' end
union all select 4, '엘리전: MSE = MUSEMBER · LRE = LOREMBER · MUSEEMBER / LOREEMBER 없음',
       (select string_agg(code || '=' || label_en, ',' order by code) from public.love_type_labels where code in ('MSE', 'LRE')),
       case when (select label_en from public.love_type_labels where code = 'MSE') = 'MUSEMBER' and (select label_en from public.love_type_labels where code = 'LRE') = 'LOREMBER'
             and not exists (select 1 from public.love_type_labels where label_en in ('MUSEEMBER', 'LOREEMBER')) then 'ok' else 'FAIL' end
union all select 5, 'assessments_insert with check: user_id = auth.uid() 와 seq = 1',
       (select with_check from pg_policies where schemaname = 'public' and policyname = 'assessments_insert'),
       case when (select with_check ~ 'auth.uid' and with_check ~ 'seq = 1' from pg_policies where schemaname = 'public' and policyname = 'assessments_insert') then 'ok' else 'FAIL' end
union all select 6, 'assessments_insert 는 INSERT 정책 · authenticated 대상',
       (select cmd || ' ' || roles::text from pg_policies where schemaname = 'public' and policyname = 'assessments_insert'),
       case when exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'assessments_insert' and cmd = 'INSERT' and roles = '{authenticated}') then 'ok' else 'FAIL' end
union all select 7, 'personality_assessments 정책은 여전히 select · insert 둘뿐 (UPDATE · DELETE 정책 없음)',
       (select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'personality_assessments'),
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'personality_assessments') = 2
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'personality_assessments' and policyname = 'assessments_select' and cmd = 'SELECT') then 'ok' else 'FAIL' end
union all select 8, 'love_type_labels 정책은 여전히 labels_select 하나뿐',
       (select string_agg(policyname || ' ' || cmd, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels'),
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'love_type_labels') = 1
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'love_type_labels' and policyname = 'labels_select') then 'ok' else 'FAIL' end
union all select 9, '두 테이블 RLS 켜짐',
       (select string_agg(relname || '=' || relrowsecurity::text, ',' order by relname) from pg_class where oid in ('public.personality_assessments'::regclass, 'public.love_type_labels'::regclass)),
       case when (select bool_and(relrowsecurity) from pg_class where oid in ('public.personality_assessments'::regclass, 'public.love_type_labels'::regclass)) then 'ok' else 'FAIL' end
union all select 10, '027 fn_complete_retest 권한 그대로: anon 불가 · authenticated 가능 · service_role 불가 · PUBLIC 몫 없음 · definer · search_path 비움',
       (select 'anon=' || has_function_privilege('anon', oid, 'execute')::text || ' authenticated=' || has_function_privilege('authenticated', oid, 'execute')::text || ' service_role=' || has_function_privilege('service_role', oid, 'execute')::text
               || ' definer=' || prosecdef::text || ' config=' || coalesce(proconfig::text, '(없음)') from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_complete_retest'),
       case when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'fn_complete_retest'
                           and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('service_role', p.oid, 'execute')
                           and p.prosecdef and p.proconfig @> array['search_path=""']
                           and p.proacl is not null and not exists (select 1 from unnest(p.proacl) a where a::text like '=%')) then 'ok' else 'FAIL' end
union all select 11, 'pg_cron execute-dissolutions 그대로 있음', coalesce((select schedule from cron.job where jobname = 'execute-dissolutions'), '(없음)'),
       case when exists (select 1 from cron.job where jobname = 'execute-dissolutions') then 'ok' else 'FAIL' end
union all select 12, 'RLS 미적용 테이블 0행 / 얼굴 임베딩류 칸 0행 / issues_public.pdf_print_path 0',
       (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))
         || ' / ' || (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0
             and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path') = 0 then 'ok' else 'FAIL' end
union all select 13, '지문: check_028_preapply.sql 11번과 같은 값이어야 한다(눈으로 비교) - 배치 함수 둘 / cron / 027 함수 다섯 / assessments_insert 뺀 정책 전체',
       (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'execute_dissolution') || ' / '
         || (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'apply_retention_policy') || ' / '
         || (select md5(string_agg(jobname || schedule || command, '|' order by jobname)) from cron.job) || ' / '
         || (select md5(string_agg(proname || ':' || md5(prosrc) || ':' || coalesce(proacl::text, ''), '|' order by proname)) from pg_proc
              where pronamespace = 'public'::regnamespace and proname in ('fn_request_dissolution','fn_cancel_dissolution','fn_request_withdrawal','fn_cancel_withdrawal','fn_complete_retest')) || ' / '
         || (select md5(string_agg(tablename || '.' || policyname || ':' || cmd || ':' || coalesce(roles::text, '') || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by tablename, policyname))
               from pg_policies where schemaname = 'public' and policyname <> 'assessments_insert'),
       'ok'
order by n;
