-- 024 권한 확인 (위임 59- A 산출 4). 읽기 전용 SELECT 하나. 024를 원격에 적용한 뒤 메인 세션이 실행한다.
-- 도구: Supabase MCP execute_sql. 작성만 했고 실행하지 않았다.
--
-- 확인 항목:
--   1) authenticated의 issues SELECT 열 = 정확히 14칸 (SCHEMA 9-C-4)
--   2) 그 14칸은 issues_public 뷰 칸과 같다
--   3) pdf_print_path 에 권한 없음 (authenticated · anon · PUBLIC) (절대 규칙 3)
--   4) authenticated 의 SELECT 외 열 권한(INSERT/UPDATE/REFERENCES) 없음
--   5) anon 의 issues 열 권한 0건
--   6) 테이블 단위 권한 없음 (anon·authenticated·PUBLIC - 열 권한만 있어야 함)
--   7) 뷰 security_invoker 유지 (뷰를 바꾸지 않았다)
--   8) 정책 issues_select 그대로 (구성원 + 발행됨, 정책은 이것 하나)
--   9) issues_public 뷰에 pdf_print_path 칸 없음 (SCHEMA 14 검증 쿼리와 같은 것)
-- 참고: 뷰 issues_public 자체에 anon/authenticated 의 INSERT/UPDATE/DELETE 등이 보이는 것은 024 이전부터다
--   (Supabase 기본 권한). 뒤의 issues 에 쓰기 권한이 없어 실제로는 거부된다. 이 파일은 그걸 바꾸지 않는다.

with
allowed(col) as (values
  ('id'),('couple_id'),('issue_type'),('issue_number'),('title'),('cover_path'),
  ('period_start'),('period_end'),('pdf_digital_path'),('page_count'),('is_trial'),
  ('published_at'),('created_at'),('theme')),
auth_cols as (
  select column_name from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'issues'
     and grantee = 'authenticated' and privilege_type = 'SELECT'
),
rows_ as (
  select 1 as n, 'authenticated SELECT 열 = 허용 14칸 (과부족 없음)' as check_name, '14칸, 차이 없음' as expected,
         (select count(*)::text from auth_cols) || '칸, 부족 [' ||
           coalesce((select string_agg(col, ',') from allowed where col not in (select column_name from auth_cols)), '') ||
           '] 초과 [' || coalesce((select string_agg(column_name, ',') from auth_cols where column_name not in (select col from allowed)), '') || ']' as actual,
         (select count(*) = 14 from auth_cols)
           and not exists (select 1 from allowed where col not in (select column_name from auth_cols))
           and not exists (select 1 from auth_cols where column_name not in (select col from allowed)) as ok
  union all
  select 2, '허용 14칸 = issues_public 뷰 칸', '같음',
         (select string_agg(attname, ',' order by attnum) from pg_attribute where attrelid = 'public.issues_public'::regclass and attnum > 0 and not attisdropped),
         (select count(*) = 14 from pg_attribute where attrelid = 'public.issues_public'::regclass and attnum > 0 and not attisdropped)
           and not exists (select 1 from pg_attribute a where a.attrelid = 'public.issues_public'::regclass and a.attnum > 0 and not a.attisdropped
                             and a.attname not in (select col from allowed))
  union all
  select 3, 'pdf_print_path 에 대한 anon/authenticated/PUBLIC 권한', '0건',
         (select count(*)::text || '건' from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path' and grantee in ('authenticated', 'anon', 'PUBLIC')),
         (select count(*) = 0 from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path' and grantee in ('authenticated', 'anon', 'PUBLIC'))
  union all
  select 4, 'authenticated 의 SELECT 외 열 권한', '0건',
         (select count(*)::text || '건' from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee = 'authenticated' and privilege_type <> 'SELECT'),
         (select count(*) = 0 from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee = 'authenticated' and privilege_type <> 'SELECT')
  union all
  select 5, 'anon 의 issues 열 권한', '0건',
         (select count(*)::text || '건' from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee = 'anon'),
         (select count(*) = 0 from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee = 'anon')
  union all
  select 6, 'issues 테이블 단위 권한 (anon·authenticated·PUBLIC)', '0건',
         (select count(*)::text || '건' from information_schema.table_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee in ('anon', 'authenticated', 'PUBLIC')),
         (select count(*) = 0 from information_schema.table_privileges
           where table_schema = 'public' and table_name = 'issues' and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all
  select 7, 'issues_public security_invoker', 'true',
         coalesce((select array_to_string(reloptions, ',') from pg_class where oid = 'public.issues_public'::regclass), ''),
         exists (select 1 from pg_class where oid = 'public.issues_public'::regclass and 'security_invoker=true' = any (reloptions))
  union all
  select 8, 'issues_select 정책 (select, 구성원 + 발행됨) 하나뿐', '1개',
         (select count(*)::text || '개: ' || coalesce(string_agg(qual, ''), '') from pg_policies where schemaname = 'public' and tablename = 'issues'),
         (select count(*) = 1 and bool_and(policyname = 'issues_select' and cmd = 'SELECT' and qual like '%is_couple_member%' and qual like '%published_at IS NOT NULL%')
            from pg_policies where schemaname = 'public' and tablename = 'issues')
  union all
  select 9, 'issues_public 의 pdf_print_path 칸 수', '0',
         (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path'),
         (select count(*) = 0 from information_schema.columns where table_schema = 'public' and table_name = 'issues_public' and column_name = 'pdf_print_path')
)
select n, check_name, expected, actual, case when ok then 'OK' else 'FAIL' end as verdict
  from rows_
 order by n;
