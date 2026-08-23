-- couples에도 RLS가 걸리므로, 자식 테이블 정책에서 couples를 직접 서브쿼리하면
-- 재귀 평가가 발생한다. SECURITY DEFINER로 이를 우회한다.

-- 현재 사용자가 해당 커플의 구성원인가
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.couples c
    where c.id = p_couple_id
      and c.status <> 'dissolved'
      and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  );
$$;

-- 현재 사용자의 활성 커플 id
create or replace function public.current_couple_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.id
  from public.couples c
  where c.status in ('pending', 'active', 'dissolving')
    and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  limit 1;
$$;

-- 상대방 id (프로필 상호 열람용)
create or replace function public.partner_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case when c.user_a_id = auth.uid() then c.user_b_id else c.user_a_id end
  from public.couples c
  where c.status in ('active', 'dissolving')
    and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  limit 1;
$$;

-- 무료 티어 잠금 여부 (열람 차단 판정)
create or replace function public.is_entry_visible(
  p_couple_id uuid, p_access_locked boolean
) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (not p_access_locked)
      or exists (
        select 1 from public.couples c
        where c.id = p_couple_id and c.subscription_tier = 'paid'
      );
$$;

revoke execute on function public.is_couple_member(uuid)   from public;
revoke execute on function public.current_couple_id()      from public;
revoke execute on function public.partner_id()             from public;
revoke execute on function public.is_entry_visible(uuid, boolean) from public;
grant  execute on function public.is_couple_member(uuid)   to authenticated;
grant  execute on function public.current_couple_id()      to authenticated;
grant  execute on function public.partner_id()             to authenticated;
grant  execute on function public.is_entry_visible(uuid, boolean) to authenticated;
