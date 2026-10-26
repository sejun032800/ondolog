-- 026 적용 전 확인 (위임 66- 산출 5). 읽기 전용 SELECT 하나. 실행은 메인 세션(Supabase MCP execute_sql). 작성만 했고 실행하지 않았다.
-- 기대: 모든 행 OK. STOP 이 하나라도 있으면 적용하지 않는다.
--  1) fn_connect_couple 이 아직 없다 (있으면 이미 적용된 것)
--  2) couples 에 RLS 가 켜져 있다
--  3) couples 정책이 3개이고, update 정책에 아직 pending 가지가 있다 (026 이 지울 대상)
--  4) authenticated 가 couples 에 테이블 단위 UPDATE 를 가진다 (026 이 회수할 대상)
--  5) 026 이 회수에 쓰는 couples 칸 17개가 전부 있다 (없는 칸 이름이면 revoke 가 실패한다)
--  6) 얼굴 임베딩류 칸이 없다
--  7) 지금 사용자가 postgres 다 (마이그레이션 실행 역할)
--  8) public.profiles 가 있다 (함수가 잠그는 대상)
with cols as (
  select column_name from information_schema.columns where table_schema = 'public' and table_name = 'couples'
), expected(c) as (values
  ('id'), ('user_a_id'), ('user_b_id'), ('invite_code'), ('invite_expires_at'), ('nickname'), ('relationship_start_date'), ('start_date_set_by'),
  ('start_date_confirmed_by'), ('reference_photo_path'), ('subscription_tier'), ('status'), ('connected_at'), ('dissolved_at'), ('magazine_theme'),
  ('created_at'), ('updated_at'))
select 1 as n, 'fn_connect_couple 없음' as what,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_connect_couple')::text as found,
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'fn_connect_couple') then 'OK' else 'STOP' end as verdict
union all
select 2, 'couples RLS 켜짐', (select relrowsecurity::text from pg_class where oid = 'public.couples'::regclass),
       case when (select relrowsecurity from pg_class where oid = 'public.couples'::regclass) then 'OK' else 'STOP' end
union all
select 3, 'couples 정책 3개 · update 에 pending 가지 있음',
       (select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'couples'),
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'couples') = 3
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'couples' and policyname = 'couples_update' and qual ~ 'pending')
            then 'OK' else 'STOP' end
union all
select 4, 'authenticated 테이블 단위 UPDATE 있음 (회수 대상)',
       has_table_privilege('authenticated', 'public.couples', 'UPDATE')::text,
       case when has_table_privilege('authenticated', 'public.couples', 'UPDATE') then 'OK' else 'STOP' end
union all
select 5, 'couples 칸 17개 전부 있음',
       (select count(*) from cols)::text || '칸, 부족 [' || coalesce((select string_agg(c, ',') from expected where c not in (select column_name from cols)), '') || ']',
       case when not exists (select 1 from expected where c not in (select column_name from cols)) then 'OK' else 'STOP' end
union all
select 6, '얼굴 임베딩류 칸 없음 (public 전체)',
       (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%'))::text,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%embedding%' or column_name ilike '%face_vector%' or column_name ilike '%descriptor%')) = 0 then 'OK' else 'STOP' end
union all
select 7, 'current_user = postgres', current_user::text, case when current_user = 'postgres' then 'OK' else 'STOP' end
union all
select 8, 'public.profiles 있음', to_regclass('public.profiles')::text, case when to_regclass('public.profiles') is not null then 'OK' else 'STOP' end
order by n;
