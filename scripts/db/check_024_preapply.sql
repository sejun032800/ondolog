-- 024 적용 전 확인 (위임 59- A 산출 4). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql).
-- 기대: 모든 행 OK. 같은 권한이 이미 있거나(1~2) 뷰가 14칸이 아니면(3) 멈춘다.

select 1 as n, 'authenticated의 issues 열 권한 (0이어야 함)' as what,
       (select count(*) from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and grantee = 'authenticated')::text as found,
       case when (select count(*) from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and grantee = 'authenticated') = 0 then 'OK' else 'STOP' end as verdict
union all
select 2, 'anon의 issues 열 권한 (0이어야 함)',
       (select count(*) from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and grantee = 'anon')::text,
       case when (select count(*) from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and grantee = 'anon') = 0 then 'OK' else 'STOP' end
union all
select 3, 'issues_public 칸 (SCHEMA 9-C-4의 14칸, 순서까지 같아야 함)',
       (select string_agg(attname, ',' order by attnum) from pg_attribute
         where attrelid = 'public.issues_public'::regclass and attnum > 0 and not attisdropped),
       case when (select string_agg(attname, ',' order by attnum) from pg_attribute
         where attrelid = 'public.issues_public'::regclass and attnum > 0 and not attisdropped)
         = 'id,couple_id,issue_type,issue_number,title,cover_path,period_start,period_end,pdf_digital_path,page_count,is_trial,published_at,created_at,theme'
         then 'OK' else 'STOP' end
union all
select 4, 'issues_public security_invoker (true여야 함)',
       coalesce((select array_to_string(reloptions, ',') from pg_class where oid = 'public.issues_public'::regclass), ''),
       case when exists (select 1 from pg_class where oid = 'public.issues_public'::regclass
         and 'security_invoker=true' = any (reloptions)) then 'OK' else 'STOP' end
union all
select 5, 'issues RLS 켜짐 + 정책 issues_select 있음',
       (select relrowsecurity::text from pg_class where oid = 'public.issues'::regclass) || ' / '
         || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'issues' and policyname = 'issues_select')::text,
       case when (select relrowsecurity from pg_class where oid = 'public.issues'::regclass)
         and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'issues' and policyname = 'issues_select')
         then 'OK' else 'STOP' end
union all
select 6, 'issues에 pdf_print_path 칸 존재 (있어야 함 - 막을 대상 확인)',
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path')::text,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path') then 'OK' else 'STOP' end
order by n;
