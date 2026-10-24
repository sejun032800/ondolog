-- 023 권한·설정 확인 (위임 57- A 6번). 022 verify_022_privileges_and_settings.sql 과 같은 방식.
-- 실행: 023을 원격에 적용한 뒤, 사람의 확인을 거쳐 메인 세션이 실행한다. (작성만 했고 실행하지 않았다)
-- 실행 도구: Supabase MCP execute_sql. 아래는 SELECT 한 개이며 읽기 전용이다(쓰기·임시 객체 없음).
--
-- 확인 항목:
--   1) fn_delete_own_entry(uuid) 가 정확히 하나 있다
--   2) anon 실행 권한 없음
--   3) authenticated 실행 권한 있음
--   4) prosecdef = true (security definer)
--   5) proconfig 에 search_path=public
--   6) PUBLIC(모든 롤) 실행 권한 없음 (aclexplode 의 grantee = 0)
--   7) data_entries 의 DELETE 정책 없음 (소프트 삭제 - 정책을 만들지 않았다)
--   8) data_entries RLS 켜짐
-- 증명하는 것: 023이 의도대로 걸렸음. 함수 논리는 verifyDeleteOwnEntry.ts 가 다룬다.

with
fn as (
  select p.oid, p.prosecdef, p.proconfig, p.proacl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_delete_own_entry'
),
rows_ as (
  select 1 as n, 'fn_delete_own_entry 존재' as check_name, '1개' as expected,
         (select count(*)::text || '개' from fn) as actual,
         (select count(*) = 1 from fn) as ok
  union all
  select 2, 'anon 실행 권한', 'false',
         (select has_function_privilege('anon', f.oid, 'execute')::text from fn f),
         (select not has_function_privilege('anon', f.oid, 'execute') from fn f)
  union all
  select 3, 'authenticated 실행 권한', 'true',
         (select has_function_privilege('authenticated', f.oid, 'execute')::text from fn f),
         (select has_function_privilege('authenticated', f.oid, 'execute') from fn f)
  union all
  select 4, 'prosecdef (security definer)', 'true',
         (select prosecdef::text from fn),
         (select prosecdef from fn)
  union all
  select 5, 'proconfig 의 search_path', 'search_path=public 포함',
         (select coalesce(array_to_string(proconfig, ', '), '(없음)') from fn),
         (select coalesce('search_path=public' = any(proconfig), false) from fn)
  union all
  select 6, 'PUBLIC 실행 권한', 'false',
         (select exists (select 1 from fn f, aclexplode(coalesce(f.proacl, acldefault('f', (select proowner from pg_proc where oid = f.oid)))) a
                          where a.grantee = 0 and a.privilege_type = 'EXECUTE')::text),
         (select not exists (select 1 from fn f, aclexplode(coalesce(f.proacl, acldefault('f', (select proowner from pg_proc where oid = f.oid)))) a
                              where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  union all
  select 7, 'data_entries DELETE 정책 수', '0',
         (select count(*)::text from pg_policies
           where schemaname = 'public' and tablename = 'data_entries' and cmd in ('DELETE', 'ALL')),
         (select count(*) = 0 from pg_policies
           where schemaname = 'public' and tablename = 'data_entries' and cmd in ('DELETE', 'ALL'))
  union all
  select 8, 'data_entries RLS', 'true',
         (select relrowsecurity::text from pg_class where oid = 'public.data_entries'::regclass),
         (select relrowsecurity from pg_class where oid = 'public.data_entries'::regclass)
)
select n, check_name, expected, actual,
       case when ok then 'OK' else 'FAIL' end as verdict
  from rows_
 order by n;
