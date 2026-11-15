-- 75-m1 (R94-1): 유예 중 초대 발급 · 연결 서버 거부.
-- 기존 001~030 · 20261103142031 파일은 고치지 않는다. 새 테이블 없음(RLS는 couples에 이미 켜져 있고 이 파일은 건드리지 않는다).
-- fn_request_dissolution / fn_cancel_dissolution / fn_request_withdrawal / fn_cancel_withdrawal / execute_dissolution 은 바꾸지 않는다.
--
-- 막는 두 상태와 앱이 읽는 고정 SQLSTATE:
--   OG002  탈퇴 유예: profiles.deleted_at is not null (본인, 연결 때는 초대한 사람도)
--   OG001  해제 유예: 'dissolving' 커플의 구성원(user_a_id 또는 user_b_id 어느 쪽이든)
--   둘 다 해당하면 OG002 가 먼저다(탈퇴 요청은 커플도 dissolving 으로 만들기 때문에 탈퇴 안내가 더 정확하다).
--
-- 1) 초대 발급 = 앱의 couples INSERT(정책 couples_insert, 026). BEFORE INSERT 트리거로 거부한다.
--    service_role · 운영 스크립트(scripts/ops/seedTestData.ts) 는 면제한다: auth.uid() 가 null 이면(요청 JWT 의 sub 없음) 검사하지 않는다.
--    시드가 active 커플을 service_role 로 직접 넣기 때문이다. 앱 사용자 요청은 항상 auth.uid() 가 있어 검사 대상이다.
--    검사 대상 사용자 = auth.uid() (정책이 user_a_id = auth.uid() 를 이미 강제한다).
-- 2) fn_connect_couple: 026 본문 그대로, "이미 커플" 23505 검사 앞에 위 두 검사를 더했다(부르는 사람과 초대한 사람 모두).
--    active 커플이면 기존대로 23505.

create or replace function public.tg_couples_block_grace_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new; -- service_role · 운영 시드 면제
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.deleted_at is not null) then
    raise exception 'couples insert: withdrawal grace' using errcode = 'OG002';
  end if;

  if exists (
    select 1 from public.couples c
     where c.status = 'dissolving' and (c.user_a_id = v_uid or c.user_b_id = v_uid)
  ) then
    raise exception 'couples insert: dissolution grace' using errcode = 'OG001';
  end if;

  return new;
end;
$$;

revoke all on function public.tg_couples_block_grace_invite() from public, anon, authenticated, service_role;

comment on function public.tg_couples_block_grace_invite() is
  '유예 중 초대 발급 거부(75-m1). 탈퇴 유예 OG002 · 해제 유예 OG001(user_a/user_b 모두). auth.uid() null(service_role · 시드)은 면제.';

drop trigger if exists tg_couples_block_grace_invite on public.couples;
create trigger tg_couples_block_grace_invite
  before insert on public.couples
  for each row execute function public.tg_couples_block_grace_invite();


create or replace function public.fn_connect_couple(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_a       uuid;
  v_id      uuid;
  v_row     public.couples%rowtype;
begin
  -- 1) 비로그인
  if v_uid is null then
    raise exception 'fn_connect_couple: not authenticated' using errcode = '28000';
  end if;

  -- 2) 코드 정규화: 공백 제거 + 대문자. null 은 빈 문자열이 되어 아래에서 "없는 코드"가 된다.
  v_code := upper(regexp_replace(coalesce(p_invite_code, ''), '\s', '', 'g'));

  -- 3) 멱등: 이미 이 사람이 user_b 인 같은 코드의 active 행이면 그 id 를 그대로 돌려준다(응답만 끊긴 재시도).
  select c.id into v_id
    from public.couples c
   where c.invite_code = v_code and c.status = 'active' and c.user_b_id = v_uid;
  if found then
    return v_id;
  end if;

  -- 4) 초대한 사람을 찾는다(잠그기 전, 두 사람의 잠금 순서를 정하려는 읽기).
  select c.user_a_id into v_a
    from public.couples c
   where c.invite_code = v_code and c.status = 'pending' and c.user_b_id is null
     and (c.invite_expires_at is null or c.invite_expires_at > now());
  if not found then
    raise exception 'fn_connect_couple: invalid invite code' using errcode = 'P0002';
  end if;

  -- 5) 직렬화: 두 사람의 profiles 행을 id 순서로 잠근다 - 같은 사람이 두 코드를 동시에 쓰는 경합을 막는다.
  perform 1 from public.profiles p where p.id in (v_uid, v_a) order by p.id for update;

  -- 6) 잠금을 잡은 사이 같은 사람의 재시도가 먼저 성공했을 수 있다 -> 멱등 다시 확인.
  select c.id into v_id
    from public.couples c
   where c.invite_code = v_code and c.status = 'active' and c.user_b_id = v_uid;
  if found then
    return v_id;
  end if;

  -- 7) 같은 조건의 행을 잠그고 가져온다. 그 사이 쓰였거나 만료됐으면 같은 오류.
  select * into v_row
    from public.couples c
   where c.invite_code = v_code and c.status = 'pending' and c.user_b_id is null
     and (c.invite_expires_at is null or c.invite_expires_at > now())
   for update;
  if not found then
    raise exception 'fn_connect_couple: invalid invite code' using errcode = 'P0002';
  end if;

  -- 8) 자기 코드
  if v_row.user_a_id = v_uid then
    raise exception 'fn_connect_couple: own invite code' using errcode = '22023';
  end if;

  -- 8-1) 75-m1: 탈퇴 유예(OG002) 먼저, 해제 유예(OG001) 다음. 부르는 사람 · 초대한 사람 모두.
  if exists (select 1 from public.profiles p where p.id in (v_uid, v_row.user_a_id) and p.deleted_at is not null) then
    raise exception 'fn_connect_couple: withdrawal grace' using errcode = 'OG002';
  end if;
  if exists (
    select 1 from public.couples c
     where c.status = 'dissolving'
       and (c.user_a_id in (v_uid, v_row.user_a_id) or c.user_b_id in (v_uid, v_row.user_a_id))
  ) then
    raise exception 'fn_connect_couple: dissolution grace' using errcode = 'OG001';
  end if;

  -- 9) 부르는 사람 · 초대한 사람 각각 active · dissolving 커플에 속하면 거부
  if exists (
    select 1 from public.couples c
     where c.status in ('active', 'dissolving')
       and (c.user_a_id in (v_uid, v_row.user_a_id) or c.user_b_id in (v_uid, v_row.user_a_id))
  ) then
    raise exception 'fn_connect_couple: already in a couple' using errcode = '23505';
  end if;

  -- 10) 부르는 사람이 user_a 인 다른 pending 행(아직 데이터가 붙지 않은 빈 초대)을 지운다 - 남기면 열/열 교차 이중 소속이 된다.
  --     초대한 사람의 다른 pending 행은 고유 인덱스(uq_couple_active_user_a)상 없다.
  delete from public.couples c
   where c.user_a_id = v_uid and c.status = 'pending' and c.user_b_id is null and c.id <> v_row.id;

  -- 11) 연결
  update public.couples c
     set user_b_id = v_uid, status = 'active', connected_at = now()
   where c.id = v_row.id;

  return v_row.id;
end;
$$;

revoke all on function public.fn_connect_couple(text) from public, anon, authenticated, service_role;
grant execute on function public.fn_connect_couple(text) to authenticated;

comment on function public.fn_connect_couple(text) is
  '초대 코드로 커플을 연결한다(사용자 권한 호출). 반환=커플 id. 비로그인 28000, 없는·만료·이미 쓴 코드 P0002(구분 안 함), 자기 코드 22023, 탈퇴 유예(본인·초대한 사람) OG002, 해제 유예(본인·초대한 사람) OG001, 이미 active 커플 23505. 같은 사람의 같은 코드 재호출은 같은 id(멱등). couples 연결 칸은 이 함수만 쓴다(026, 75-m1 갱신).';
