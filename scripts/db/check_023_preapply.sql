-- 023 적용 전 확인 (위임 57- A 산출 5). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql).
-- 기대: fn_delete_own_entry 가 이미 있으면 안 된다(0행). 사전 의존물 is_couple_member·data_entries·dates 는 있어야 한다.

select 'fn_delete_own_entry (있으면 안 됨)' as what,
       count(*)::text as found,
       case when count(*) = 0 then 'OK' else 'STOP' end as verdict
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'fn_delete_own_entry'
union all
select 'is_couple_member (있어야 함)', count(*)::text, case when count(*) = 1 then 'OK' else 'STOP' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'is_couple_member'
union all
select 'data_entries · dates 테이블 (둘 다 있어야 함)', count(*)::text, case when count(*) = 2 then 'OK' else 'STOP' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('data_entries', 'dates');
