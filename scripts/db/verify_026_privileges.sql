-- 026 적용 뒤 권한 · 정책 확인 (위임 66- 산출 5). 읽기 전용 SELECT 하나. 실행은 메인 세션. 작성만 했고 실행하지 않았다.
-- 기대: verdict 가 전부 ok. (16~18 은 SCHEMA 14 검증 쿼리와 같은 기준)
with fn as (
  select * from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_connect_couple'
), c_update_cols as (
  select r.rolname as role, a.attname as col
    from pg_attribute a, pg_roles r
   where a.attrelid = 'public.couples'::regclass and a.attnum > 0 and not a.attisdropped
     and r.rolname in ('anon', 'authenticated', 'service_role')
     and has_column_privilege(r.rolname, 'public.couples', a.attname, 'UPDATE')
), pol as (
  select policyname, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'couples'
)
select 1 as n, 'fn: anon 실행 불가' as what, has_function_privilege('anon', 'public.fn_connect_couple(text)', 'execute')::text as found,
       case when not has_function_privilege('anon', 'public.fn_connect_couple(text)', 'execute') then 'ok' else 'FAIL' end as verdict
union all select 2, 'fn: authenticated 실행 가능', has_function_privilege('authenticated', 'public.fn_connect_couple(text)', 'execute')::text,
       case when has_function_privilege('authenticated', 'public.fn_connect_couple(text)', 'execute') then 'ok' else 'FAIL' end
union all select 3, 'fn: service_role 실행 불가', has_function_privilege('service_role', 'public.fn_connect_couple(text)', 'execute')::text,
       case when not has_function_privilege('service_role', 'public.fn_connect_couple(text)', 'execute') then 'ok' else 'FAIL' end
union all select 4, 'fn: PUBLIC 몫 실행 없음 (proacl 에 "=" 로 시작하는 항목 없음)',
       coalesce((select proacl::text from fn), '(acl null = 기본 = PUBLIC 실행)'),
       case when (select proacl from fn) is not null and not exists (select 1 from fn, unnest(fn.proacl) a where a::text like '=%') then 'ok' else 'FAIL' end
union all select 5, 'fn: security definer', (select prosecdef::text from fn), case when (select prosecdef from fn) then 'ok' else 'FAIL' end
union all select 6, 'fn: proconfig 에 search_path 가 빈 값으로 고정', (select proconfig::text from fn),
       case when (select proconfig from fn) @> array['search_path=""'] then 'ok' else 'FAIL' end
union all select 7, 'couples: RLS 켜짐', (select relrowsecurity::text from pg_class where oid = 'public.couples'::regclass),
       case when (select relrowsecurity from pg_class where oid = 'public.couples'::regclass) then 'ok' else 'FAIL' end
union all select 8, 'couples: 테이블 단위 UPDATE anon/authenticated 없음',
       has_table_privilege('anon', 'public.couples', 'UPDATE')::text || '/' || has_table_privilege('authenticated', 'public.couples', 'UPDATE')::text,
       case when not has_table_privilege('anon', 'public.couples', 'UPDATE') and not has_table_privilege('authenticated', 'public.couples', 'UPDATE') then 'ok' else 'FAIL' end
union all select 9, 'couples: authenticated 가 UPDATE 할 수 있는 칸 = 정확히 다섯 칸',
       (select string_agg(col, ',' order by col) from c_update_cols where role = 'authenticated'),
       case when (select string_agg(col, ',' order by col) from c_update_cols where role = 'authenticated')
                 = 'nickname,reference_photo_path,relationship_start_date,start_date_confirmed_by,start_date_set_by' then 'ok' else 'FAIL' end
union all select 10, 'couples: anon 이 UPDATE 할 수 있는 칸 없음', (select count(*)::text from c_update_cols where role = 'anon'),
       case when (select count(*) from c_update_cols where role = 'anon') = 0 then 'ok' else 'FAIL' end
union all select 11, 'couples: 연결 7칸 + magazine_theme 은 authenticated UPDATE 불가',
       (select count(*)::text from c_update_cols where role = 'authenticated' and col in ('user_a_id', 'user_b_id', 'status', 'connected_at', 'dissolved_at', 'invite_code', 'subscription_tier', 'magazine_theme')),
       case when (select count(*) from c_update_cols where role = 'authenticated' and col in ('user_a_id', 'user_b_id', 'status', 'connected_at', 'dissolved_at', 'invite_code', 'subscription_tier', 'magazine_theme')) = 0 then 'ok' else 'FAIL' end
union all select 12, 'couples_update: using 에 pending 가지 없음 · with check 그대로',
       (select qual || ' ## ' || with_check from pol where policyname = 'couples_update'),
       case when (select qual !~ 'pending' and qual ~ 'user_a_id' and qual ~ 'user_b_id' and with_check ~ 'user_a_id' from pol where policyname = 'couples_update') then 'ok' else 'FAIL' end
union all select 13, 'couples_insert: with check 에 user_a_id · user_b_id IS NULL · pending · free',
       (select with_check from pol where policyname = 'couples_insert'),
       case when (select with_check ~ 'user_a_id' and with_check ~ 'user_b_id IS NULL' and with_check ~ 'pending' and with_check ~ 'free' from pol where policyname = 'couples_insert') then 'ok' else 'FAIL' end
union all select 14, 'couples_select: 구성원만 (넓히지 않음)',
       (select qual from pol where policyname = 'couples_select'),
       case when (select qual !~ 'pending' and qual !~ 'IS NULL' and qual ~ 'user_a_id' and qual ~ 'user_b_id' from pol where policyname = 'couples_select') then 'ok' else 'FAIL' end
union all select 15, 'couples 정책 정확히 3개', (select count(*)::text from pol), case when (select count(*) from pol) = 3 then 'ok' else 'FAIL' end
union all select 16, 'RLS 미적용 테이블 0행', (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0 then 'ok' else 'FAIL' end
union all select 17, '얼굴 임베딩류 칸 0행', (select count(*)::text from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')),
       case when (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0 then 'ok' else 'FAIL' end
union all select 18, 'issues_public.pdf_print_path 노출 0', (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path') = 0 then 'ok' else 'FAIL' end
order by n;
