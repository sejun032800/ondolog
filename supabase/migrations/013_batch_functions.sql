-- ─────────────────────────────────────────────
-- 11-1. 스토리 만료 — 연동 여부로 분기
-- ─────────────────────────────────────────────
create or replace function public.expire_stories()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_entry_id uuid;
  v_synced boolean;
begin
  for r in
    select s.* from public.stories s
    where s.resolved_at is null and s.expires_at <= now()
    limit 500
  loop
    select p.photo_sync_enabled into v_synced
    from public.profiles p where p.id = r.author_id;

    if coalesce(v_synced, false) then
      -- 사진 앱 연동됨 → 소멸 (원본이 사진앱에 있고 피드가 자동 인식)
      update public.stories
        set resolved_at = now(), resolution = 'discarded'
        where id = r.id;
    else
      -- 미연동 → 아카이브 편입
      insert into public.data_entries
        (couple_id, author_id, entry_type, storage_path, text_content, captured_at)
      values
        (r.couple_id, r.author_id, 'photo', r.media_path, r.caption, r.created_at)
      returning id into v_entry_id;

      update public.stories
        set resolved_at = now(), resolution = 'archived', archived_entry_id = v_entry_id
        where id = r.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ─────────────────────────────────────────────
-- 11-2. 보관 정책 — 3개월 초과 저해상도 전환 + 잠금
-- ─────────────────────────────────────────────
create or replace function public.apply_retention_policy()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_count  integer;
begin
  select (value->>'freeTierMonths')::integer into v_months
  from public.app_config where key = 'retention';

  with target as (
    select e.id
    from public.data_entries e
    join public.couples c on c.id = e.couple_id
    where c.subscription_tier = 'free'
      and e.resolution_tier = 'original'
      and e.deleted_at is null
      and e.captured_at < (now() - make_interval(months => v_months))
    limit 1000
  )
  update public.data_entries e
     set access_locked = true          -- 삭제하지 않는다. 잠글 뿐이다.
   from target t
  where e.id = t.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 위 함수는 잠금 플래그만 처리한다. 실제 저해상도 변환·원본 삭제는 Storage
-- 작업이므로 Edge Function에서 수행하고, 완료 후 resolution_tier='low',
-- downgraded_at=now()로 갱신한다. 유료 전환 시에는 access_locked=false로
-- 되돌리면 저해상도 사본이 즉시 열람 가능해진다.

-- 유료 전환 시 잠금 해제
create or replace function public.unlock_on_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subscription_tier = 'paid' and old.subscription_tier = 'free' then
    update public.data_entries
       set access_locked = false
     where couple_id = new.id and access_locked = true;
  end if;
  return new;
end;
$$;

create trigger tg_unlock_on_upgrade
  after update of subscription_tier on public.couples
  for each row execute function public.unlock_on_upgrade();

-- ─────────────────────────────────────────────
-- 11-3. 7일 유예 파기 — 개시자 파생 데이터만
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
         biometric_consent_revoked_at = coalesce(biometric_consent_revoked_at, now())
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

revoke execute on function public.expire_stories()             from public;
revoke execute on function public.apply_retention_policy()     from public;
revoke execute on function public.execute_dissolution(uuid)    from public;
-- 배치 함수는 service_role(pg_cron, Edge Function)만 실행한다. 클라이언트 grant 없음.
