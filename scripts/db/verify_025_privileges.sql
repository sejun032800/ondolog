-- 025 권한 확인 (위임 60- 산출 5). 읽기 전용 SELECT 하나. 025 를 원격에 적용한 뒤 메인 세션이 실행한다. 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 ok = true.
--
-- A) 함수 14개의 EXECUTE 표: (public, anon, authenticated, service_role) 가 분류와 일치
-- B) 확장 소유가 아닌 public 함수 중 anon 이 실행 가능한 것 0개, PUBLIC 이 실행 가능한 것 0개 (보안 점검 anon 경고 0의 근거)
-- C) search_path 고정: 14개 모두 proconfig 에 search_path 가 있다 (fn_publish_issue 포함)
-- D) 기본 권한: pg_default_acl(postgres · public · f) 에 anon · authenticated · PUBLIC 항목 없음
-- E) issues_public: anon 권한 0, authenticated 는 SELECT 만, 뷰 security_invoker 유지
-- F) 024 열 권한 그대로: authenticated 의 issues SELECT 열 14칸, pdf_print_path 권한 0 (절대 규칙 3)
-- G) pg_cron 작업 3개 그대로 (이름 · 일정 · 명령)
-- H) 정책 수 그대로는 적용 전 값을 모르므로 여기서 비교하지 않는다 (025 는 정책 DDL 이 없다 - 마이그레이션 파일에서 확인)

with
spec(sig, want_pub, want_anon, want_auth, want_svc, klass) as (values
  ('expire_stories()',                false, false, false, false, 'batch'),
  ('apply_retention_policy()',        false, false, false, false, 'batch'),
  ('execute_dissolution(uuid)',       false, false, false, false, 'batch'),
  ('is_couple_member(uuid)',          false, false, true,  false, 'rls_helper'),
  ('is_entry_visible(uuid,boolean)',  false, false, true,  false, 'rls_helper'),
  ('partner_id()',                    false, false, true,  false, 'rls_helper'),
  ('current_couple_id()',             false, false, true,  false, 'rls_helper'),
  ('fn_issue_progress()',             false, false, true,  false, 'client_rpc'),
  ('fn_delete_own_entry(uuid)',       false, false, true,  false, 'client_rpc'),
  ('fn_publish_issue(uuid)',          false, false, false, true,  'publish'),
  ('tg_set_updated_at()',             false, false, false, false, 'trigger'),
  ('unlock_on_upgrade()',             false, false, false, false, 'trigger'),
  ('fn_issues_theme_immutable()',     false, false, false, false, 'trigger'),
  ('fn_issues_theme_on_publish()',    false, false, false, false, 'trigger')
),
fn as (
  select s.sig, s.klass, p.oid, p.proconfig,
         has_function_privilege('public',        p.oid, 'execute') as pub,
         has_function_privilege('anon',          p.oid, 'execute') as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as auth,
         has_function_privilege('service_role',  p.oid, 'execute') as svc,
         s.want_pub, s.want_anon, s.want_auth, s.want_svc
    from spec s
    join pg_proc p on p.oid = to_regprocedure('public.' || s.sig)
),
issues_cols as (
  select column_name from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'issues' and grantee = 'authenticated' and privilege_type = 'SELECT'
)
-- A) 함수별 한 줄
select 'A' as sect, f.sig || ' [' || f.klass || ']' as what,
       'pub=' || f.pub || ' anon=' || f.anon || ' auth=' || f.auth || ' svc=' || f.svc as actual,
       'pub=' || f.want_pub || ' anon=' || f.want_anon || ' auth=' || f.want_auth || ' svc=' || f.want_svc as expected,
       (f.pub = f.want_pub and f.anon = f.want_anon and f.auth = f.want_auth and f.svc = f.want_svc) as ok
  from fn f
union all
select 'A', '14개가 모두 있다', (select count(*) from fn)::text, '14', (select count(*) = 14 from fn)
union all
-- B) 외부에서 실행 가능한 함수 0
select 'B', 'anon 이 실행 가능한 (확장 소유가 아닌) public 함수',
       coalesce((select string_agg(p.oid::regprocedure::text, ',') from pg_proc p
          where p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
            and has_function_privilege('anon', p.oid, 'execute')), '없음'), '없음',
       not exists (select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
            and has_function_privilege('anon', p.oid, 'execute'))
union all
select 'B', 'PUBLIC 이 실행 가능한 (확장 소유가 아닌) public 함수',
       coalesce((select string_agg(p.oid::regprocedure::text, ',') from pg_proc p
          where p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
            and has_function_privilege('public', p.oid, 'execute')), '없음'), '없음',
       not exists (select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
            and has_function_privilege('public', p.oid, 'execute'))
union all
-- C) search_path
select 'C', 'search_path 미고정 함수',
       coalesce((select string_agg(sig, ',') from fn where not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')), '없음'), '없음',
       not exists (select 1 from fn where not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%'))
union all
-- D) 기본 권한
select 'D', 'pg_default_acl(postgres · public · f)',
       coalesce((select defaclacl::text from pg_default_acl
                  where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'), '항목 없음'),
       'anon · authenticated · PUBLIC(=X 빈 grantee) 없음',
       not exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
                    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'
                      and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole)))
union all
-- E) issues_public
select 'E', 'issues_public anon 권한 수',
       (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'issues_public' and grantee = 'anon')::text, '0',
       (select count(*) = 0 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'issues_public' and grantee = 'anon')
union all
select 'E', 'issues_public authenticated 권한',
       coalesce((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
                  where table_schema = 'public' and table_name = 'issues_public' and grantee = 'authenticated'), '없음'), 'SELECT',
       coalesce((select string_agg(privilege_type, ',') from information_schema.role_table_grants
                  where table_schema = 'public' and table_name = 'issues_public' and grantee = 'authenticated'), '') = 'SELECT'
union all
select 'E', 'issues_public security_invoker 유지',
       coalesce((select array_to_string(reloptions, ',') from pg_class where oid = 'public.issues_public'::regclass), ''), 'security_invoker=true',
       exists (select 1 from pg_class where oid = 'public.issues_public'::regclass and 'security_invoker=true' = any (reloptions))
union all
-- F) 024 열 권한 그대로
select 'F', 'authenticated 의 issues SELECT 열 수', (select count(*) from issues_cols)::text, '14', (select count(*) = 14 from issues_cols)
union all
select 'F', 'pdf_print_path 열 권한 (authenticated · anon)',
       (select count(*) from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path' and grantee in ('authenticated', 'anon', 'PUBLIC'))::text, '0',
       (select count(*) = 0 from information_schema.column_privileges
         where table_schema = 'public' and table_name = 'issues' and column_name = 'pdf_print_path' and grantee in ('authenticated', 'anon', 'PUBLIC'))
union all
-- G) pg_cron
select 'G', 'cron 작업',
       (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname) from cron.job),
       'execute-dissolutions 0 5 * * * | expire-stories */15 * * * * | retention-policy 0 4 * * *',
       (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname) from cron.job)
         = 'execute-dissolutions 0 5 * * * | expire-stories */15 * * * * | retention-policy 0 4 * * *'
order by 1, 2;
