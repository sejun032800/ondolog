-- 해제 배치 결함 수정 (030). 위임 `71-`, ROADMAP R53-3 · R53-4 · R53-5, MASTER 9-6, SCHEMA 11-3 · 11-4 · 9-D-5.
-- 001~029는 이미 적용된 것이라 고치지 않는다(R45-2).
--
-- 결함: 013의 execute_dissolution이 개시자의 biometric_consent_revoked_at을 무조건 채워, 생체 동의를 한 적 없는 개시자에서
--       chk_biometric_revoke_order(003: revoked_at is null or consent_at is not null) 위반(23514)으로 실패했다.
--       014의 cron 문장은 대상 전체를 한 문장으로 불러 한 건의 실패가 그날 전부를 롤백했다.
--
-- 1) execute_dissolution: 철회 시각 한 줄만 조건부로 바꾼다. 나머지 본문 · security definer · search_path · 권한은 그대로.
-- 2) ops_alerts.kind check 제약 교체: 'dissolution_failed' 추가(기존 두 값 유지, 기존 행 영향 없음).
--    제약 이름 ops_alerts_kind_check = 022의 열 인라인 check의 PostgreSQL 기본 이름(<표>_<열>_check).
-- 3) run_due_dissolutions(): 배치 전용 래퍼. 대상을 한 건씩 begin..exception 으로 실행하고, 실패는 ops_alerts 한 행.
--    detail에는 해제 id · SQLSTATE · 제약 이름 · SQLERRM 앞 120자만 넣는다. PG_EXCEPTION_DETAIL은 넣지 않는다
--    (check 위반의 DETAIL에는 "Failing row contains (...)"로 행의 값 전체가 담긴다).
-- 4) cron 'execute-dissolutions': 같은 이름으로 cron.schedule을 다시 부르면 pg_cron이 그 작업을 갱신한다(014와 같은 방식).
--    작업 이름과 예약 시각 '0 5 * * *'은 그대로. 명령만 래퍼 호출로 바뀐다.

-- ─────────────────────────────────────────────
-- 1. execute_dissolution 재정의 (바뀐 곳은 biometric_consent_revoked_at 한 줄)
-- ─────────────────────────────────────────────
create or replace function public.execute_dissolution(p_dissolution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d           record;
  v_partner   uuid;
  v_both_gone boolean;
begin
  select * into d from public.couple_dissolutions
   where id = p_dissolution_id
     and cancelled_at is null and executed_at is null
     and purge_scheduled_at <= now();
  if not found then return; end if;

  -- 개시자 파생 데이터만 파기. 상대 데이터는 유지.
  delete from public.data_entries where couple_id = d.couple_id and author_id = d.initiated_by;
  delete from public.messages     where couple_id = d.couple_id and sender_id = d.initiated_by;
  delete from public.stories      where couple_id = d.couple_id and author_id = d.initiated_by;
  delete from public.stat_snapshots where couple_id = d.couple_id and user_id = d.initiated_by;

  update public.profiles
     set reference_photo_path = null,
         biometric_consent_revoked_at = case when biometric_consent_at is not null then coalesce(biometric_consent_revoked_at, now()) else null end
   where id = d.initiated_by;

  -- 발행 매거진(issues/corners)은 보존한다.
  -- corners.content가 스냅샷이므로 원본 삭제와 무관하게 무결하다.

  select case when c.user_a_id = d.initiated_by then c.user_b_id else c.user_a_id end
    into v_partner
    from public.couples c where c.id = d.couple_id;

  select (v_partner is null)
      or exists (select 1 from public.profiles p
                  where p.id = v_partner and p.deleted_at is not null)
    into v_both_gone;

  if v_both_gone then
    -- 양쪽 모두 이탈 → 매거진까지 전부 파기
    delete from public.corners where couple_id = d.couple_id;
    delete from public.issues  where couple_id = d.couple_id;
    delete from public.dates   where couple_id = d.couple_id;
    delete from public.couples where id = d.couple_id;
  else
    update public.couples
       set status = 'dissolved', dissolved_at = now()
     where id = d.couple_id;
  end if;

  update public.couple_dissolutions set executed_at = now() where id = d.id;
end;
$$;

revoke execute on function public.execute_dissolution(uuid) from public, anon, authenticated, service_role;

-- ─────────────────────────────────────────────
-- 2. ops_alerts.kind 제약 교체 — 'dissolution_failed' 추가
-- ─────────────────────────────────────────────
alter table public.ops_alerts drop constraint ops_alerts_kind_check;
alter table public.ops_alerts add constraint ops_alerts_kind_check
  check (kind in ('couple_membership', 'usage_over', 'dissolution_failed'));

-- ─────────────────────────────────────────────
-- 3. 배치 래퍼 — 한 건씩 실행, 실패는 ops_alerts
-- ─────────────────────────────────────────────
create or replace function public.run_due_dissolutions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r            record;
  v_sqlstate   text;
  v_constraint text;
begin
  for r in
    select id, couple_id from public.couple_dissolutions
     where cancelled_at is null and executed_at is null and purge_scheduled_at <= now()
     order by purge_scheduled_at, id
  loop
    begin
      perform public.execute_dissolution(r.id);
    exception when others then
      -- 이 건의 변경은 위 begin 블록 단위로 되돌려졌다. 다음 건으로 넘어간다.
      get stacked diagnostics v_constraint = constraint_name;
      v_sqlstate := sqlstate;
      begin
        insert into public.ops_alerts (kind, couple_id, detail)
        values ('dissolution_failed', r.couple_id,
                jsonb_build_object('dissolution_id', r.id,
                                   'sqlstate',       v_sqlstate,
                                   'constraint',     v_constraint,
                                   'message',        left(sqlerrm, 120)));
      exception when others then
        raise warning 'dissolution % failed (%) and the alert row could not be written (%)', r.id, v_sqlstate, sqlstate;
      end;
    end;
  end loop;
end;
$$;

revoke execute on function public.run_due_dissolutions() from public, anon, authenticated, service_role;
-- 배치 전용(025 분류 1): pg_cron이 소유자 postgres 권한으로 부른다.

-- ─────────────────────────────────────────────
-- 4. cron 작업 교체 (같은 이름 -> 갱신, 둘이 생기지 않는다)
-- ─────────────────────────────────────────────
select cron.schedule('execute-dissolutions', '0 5 * * *',
  $$ select public.run_due_dissolutions(); $$);
