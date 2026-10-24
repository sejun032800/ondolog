-- 025 적용 전 확인 (위임 60- 산출 5). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql). 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 OK. STOP 이 하나라도 있으면 적용하지 않고 분류표를 다시 본다.
--
-- 1) public 스키마의 (확장 소유가 아닌) 함수가 정확히 14개이고 이름이 025가 다루는 것과 같다
-- 2) 025 가 쓰는 시그니처 14개가 모두 있다 (revoke/grant/alter 가 "function does not exist" 로 끝나지 않게)
-- 3) pg_cron 작업 3개가 expire_stories · apply_retention_policy · execute_dissolution 을 부른다 (배치 분류의 근거)
-- 4) 기본 권한 항목: postgres 소유 · public 스키마 · 함수 용(f)이 있다 (alter default privileges for role postgres 가 걸리는 곳)
-- 5) 지금 현재 사용자가 postgres 다 (마이그레이션 실행 역할)
-- 6) issues_public 에 anon 권한이 있다 (025 가 회수할 대상. 없으면 이미 적용된 것)
-- 7) 아직 적용 전: anon 이 expire_stories 를 실행할 수 있다 (적용 후에는 false)

with
fns as (
  select p.oid, p.oid::regprocedure::text as sig
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
expected(sig) as (values
  ('expire_stories()'), ('apply_retention_policy()'), ('execute_dissolution(uuid)'),
  ('is_couple_member(uuid)'), ('is_entry_visible(uuid,boolean)'), ('partner_id()'), ('current_couple_id()'),
  ('fn_issue_progress()'), ('fn_delete_own_entry(uuid)'), ('fn_publish_issue(uuid)'),
  ('tg_set_updated_at()'), ('unlock_on_upgrade()'), ('fn_issues_theme_immutable()'), ('fn_issues_theme_on_publish()')
)
select 1 as n, '확장 소유가 아닌 public 함수 = 025가 다루는 14개 (과부족 없음)' as what,
       (select count(*) from fns)::text || '개, 부족 [' ||
         coalesce((select string_agg(sig, ',') from expected where sig not in (select sig from fns)), '') || '] 초과 [' ||
         coalesce((select string_agg(sig, ',') from fns where sig not in (select sig from expected)), '') || ']' as found,
       case when (select count(*) from fns) = 14
             and not exists (select 1 from expected where sig not in (select sig from fns))
             and not exists (select 1 from fns where sig not in (select sig from expected))
            then 'OK' else 'STOP' end as verdict
union all
select 2, 'pg_cron 작업 3개가 배치 함수 셋을 부른다',
       (select string_agg(jobname, ',' order by jobname) from cron.job),
       case when (select count(*) from cron.job where command ~ 'public\.expire_stories\(\)') = 1
             and (select count(*) from cron.job where command ~ 'public\.apply_retention_policy\(\)') = 1
             and (select count(*) from cron.job where command ~ 'public\.execute_dissolution\(') = 1
            then 'OK' else 'STOP' end
union all
select 3, '기본 권한 항목: postgres 소유 · public 스키마 · 함수(f)',
       coalesce((select defaclacl::text from pg_default_acl
                  where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'), '없음'),
       case when exists (select 1 from pg_default_acl
                  where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f')
            then 'OK' else 'STOP' end
union all
select 4, '현재 역할 (마이그레이션 실행 역할: postgres 여야 for role postgres 와 일치)',
       current_user::text,
       case when current_user = 'postgres' then 'OK' else 'STOP' end
union all
select 5, 'issues_public 에 anon 권한이 있다 (적용 전 상태)',
       (select count(*) from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'issues_public' and grantee = 'anon')::text,
       case when (select count(*) from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'issues_public' and grantee = 'anon') > 0 then 'OK' else 'STOP' end
union all
select 6, '적용 전: anon 이 expire_stories() 를 실행할 수 있다 (true 가 정상. 이미 false 면 025 가 적용된 것)',
       has_function_privilege('anon', 'public.expire_stories()', 'execute')::text,
       case when has_function_privilege('anon', 'public.expire_stories()', 'execute') then 'OK' else 'STOP' end
order by n;
