-- 022 권한·설정 확인 (SCHEMA §9-D-9 "권한·설정" 행, 방식 B).
-- 실행: 022를 원격에 적용한 뒤, 사람의 확인을 거쳐 메인 세션이 실행한다.
-- 실행 도구: Supabase MCP execute_sql. 아래는 SELECT 한 개이며 읽기 전용이다(쓰기·임시 객체 없음).
--
-- 확인 항목(§9-D-9):
--   1~3) fn_publish_issue 실행 권한: anon 불가, authenticated 불가, service_role 가능
--   4)   pg_proc.prosecdef = false (security invoker)
--   5)   proconfig 에 search_path=public
--   6)   magazine 버킷 정책이 SELECT 하나만 남았는지 (INSERT·UPDATE·DELETE·ALL 없음)
-- 증명하는 것: 022가 의도대로 걸렸음. 함수 논리는 다루지 않는다.

with
fn as (
  select p.oid, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_publish_issue'
),
mag as (
  -- magazine 버킷을 가리키는 storage.objects 정책. 'magazine-print' 는 따옴표가 달라 걸리지 않는다.
  select policyname, cmd
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') like '%''magazine''%' or coalesce(with_check, '') like '%''magazine''%')
),
rows_ as (
  select 1 as n, 'fn_publish_issue 존재' as check_name, '1개' as expected,
         (select count(*)::text || '개' from fn) as actual,
         (select count(*) = 1 from fn) as ok
  union all
  select 2, 'anon 실행 권한', 'false',
         (select has_function_privilege('anon', f.oid, 'execute')::text from fn f),
         (select not has_function_privilege('anon', f.oid, 'execute') from fn f)
  union all
  select 3, 'authenticated 실행 권한', 'false',
         (select has_function_privilege('authenticated', f.oid, 'execute')::text from fn f),
         (select not has_function_privilege('authenticated', f.oid, 'execute') from fn f)
  union all
  select 4, 'service_role 실행 권한', 'true',
         (select has_function_privilege('service_role', f.oid, 'execute')::text from fn f),
         (select has_function_privilege('service_role', f.oid, 'execute') from fn f)
  union all
  select 5, 'prosecdef (security invoker)', 'false',
         (select prosecdef::text from fn),
         (select not prosecdef from fn)
  union all
  select 6, 'proconfig 의 search_path', 'search_path=public 포함',
         (select coalesce(array_to_string(proconfig, ', '), '(없음)') from fn),
         (select coalesce('search_path=public' = any(proconfig), false) from fn)
  union all
  select 7, 'magazine 버킷 정책 목록', 'magazine_storage_select (SELECT) 하나',
         (select coalesce(string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname), '(없음)') from mag),
         (select count(*) = 1 and bool_and(cmd = 'SELECT' and policyname = 'magazine_storage_select') from mag)
  union all
  select 8, 'magazine 버킷 쓰기 정책(INSERT·UPDATE·DELETE·ALL) 수', '0',
         (select count(*)::text from mag where cmd <> 'SELECT'),
         (select count(*) = 0 from mag where cmd <> 'SELECT')
)
select n, check_name, expected, actual,
       case when ok then 'OK' else 'FAIL' end as verdict
  from rows_
 order by n;
