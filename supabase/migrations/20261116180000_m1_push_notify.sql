-- 78-m1 (ROADMAP R100-4 · R101-5 · R109-1 ①): 푸시 알림 - 기기 토큰 · 알림 설정(H10) · 새 메시지 / 변경 안내 발송 트리거 · 닉네임 바꾼 사람 칸.
--
-- 흐름: 메시지 INSERT · 커플 날짜 / 닉네임 UPDATE -> 트리거가 받는 사람을 고른다(연결된 커플의 상대 · 탈퇴 유예 아님 · 그 알림 켬 · 토큰 있음)
--       -> pg_net 으로 발송 함수(push-send)를 부른다(비밀 헤더). 함수는 같은 판정을 push_context 로 다시 하고 FCM V1 으로 보낸다.
--       앱은 발송을 직접 부르지 않는다(남에게 알림을 보내는 구멍 0).
-- 값: 함수 주소(ondolog_push_url) · 호출 비밀(ondolog_push_secret)은 Vault(vault.decrypted_secrets)에서 읽는다. 이 파일에 값 0.
--     둘 중 하나라도 없으면 트리거는 조용히 아무것도 하지 않는다(메시지 저장은 그대로).
-- 알림은 덤이다: 발송 준비 중 어떤 오류도 메시지 저장 · 커플 수정을 막지 않는다(예외를 삼킨다 - 숫자 · 원문을 남기지 않는다).
-- 본문 원문은 보내지 않는다: 트리거가 넘기는 것은 종류 · 커플 · 보낸 사람 · 사진 여부뿐이다.
--
-- 76-g 원칙: 사람이 지워지면 토큰 · 설정이 함께 지워진다(on delete cascade). 닉네임 바꾼 사람 칸은 비운다(set null).
-- 이 파일이 하지 않는 것: 기존 테이블 · 함수 본문 변경(트리거 추가와 couples 칸 하나만) · demo_responses · 렌더.

-- ---------------------------------------------------------------------------
-- 0) pg_net: 쓸 수 있는 곳(Supabase)에서만 켠다. 함수는 net 스키마에 생긴다.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) 기기 토큰 - 사람 · 기기(앱이 만든 무작위 값) · 토큰 · 플랫폼 · 마지막 확인 시각. 본인만 읽기 · 지우기, 쓰기는 push_register 로만.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  device_id     text not null check (char_length(device_id) between 8 and 64),
  token         text not null check (char_length(token) between 1 and 4096),
  platform      text not null check (platform in ('android', 'ios')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint uq_push_tokens_token unique (token),
  constraint uq_push_tokens_user_device unique (user_id, device_id)
);

alter table public.push_tokens enable row level security;

create policy push_tokens_select on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

comment on table public.push_tokens is
  '78-m1 푸시 기기 토큰. 본인만 읽기 · 지우기(로그아웃 · 탈퇴 요청 · 해제 요청 때 앱이 이 기기 행을 지운다). 쓰기는 push_register 만 - 같은 토큰 · 같은 기기가 다른 사람에게 오면(계정 전환) 이전 행을 지운다.';

-- ---------------------------------------------------------------------------
-- 2) 알림 설정(H10) - 메시지 · 변경 안내. 행이 없으면 둘 다 켬(기본 켬). 본인만 읽기 · 쓰기. 상대는 읽지 못한다.
-- ---------------------------------------------------------------------------
create table public.notification_settings (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  messages    boolean not null default true,
  changes     boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy notification_settings_select on public.notification_settings
  for select to authenticated using (user_id = auth.uid());
create policy notification_settings_insert on public.notification_settings
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_settings_update on public.notification_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notification_settings from anon, authenticated;
grant select, insert, update on public.notification_settings to authenticated;

create trigger tg_notification_settings_updated
  before update on public.notification_settings
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) 커플 닉네임을 바꾼 사람(R101-5 앱 안 안내) - 이미 있던 닉네임이 바뀔 때만 요청 사용자로 채운다(처음 정하기는 "바꿈"이 아니다).
--    앱은 이 칸을 쓸 수 없다(couples UPDATE 는 026 의 다섯 칸만) - 트리거만 채운다. 새 초대 행에는 늘 비어 있다.
-- ---------------------------------------------------------------------------
alter table public.couples
  add column nickname_changed_by uuid references public.profiles(id) on delete set null;

create or replace function public.tg_couples_nickname_changed_by()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.nickname_changed_by := null;
  elsif old.nickname is not null and new.nickname is distinct from old.nickname then
    new.nickname_changed_by := auth.uid();
  end if;
  -- 그 밖의 UPDATE 는 값을 그대로 둔다(앱은 이 칸 권한이 없다). 되돌리지 않는다 - 사람이 지워질 때 set null 이 되돌려지면 외래 키가 깨진다(76-g m3 교훈).
  return new;
end $$;

create trigger tg_couples_nickname_changed_by
  before insert or update on public.couples
  for each row execute function public.tg_couples_nickname_changed_by();

-- ---------------------------------------------------------------------------
-- 4) 받는 사람 판정(트리거 · 발송 함수 공용) - 연결된(active) 커플에서 보낸 사람의 상대 · 탈퇴 유예 아님 · 그 알림 켬. 아니면 null.
--    해제 유예(dissolving) · 해제(dissolved) · 연결 전(pending) 커플은 null. 보낸 사람이 없으면(배치 · 운영) null.
-- ---------------------------------------------------------------------------
create or replace function public.push_recipient(p_kind text, p_couple uuid, p_actor uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_to uuid;
  v_on boolean;
begin
  if p_actor is null or p_couple is null or p_kind not in ('message', 'date', 'nickname') then
    return null;
  end if;
  select case when c.user_a_id = p_actor then c.user_b_id when c.user_b_id = p_actor then c.user_a_id end
    into v_to
    from public.couples c
   where c.id = p_couple and c.status = 'active';
  if v_to is null then
    return null;
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_to and p.deleted_at is null) then
    return null;
  end if;
  select case when p_kind = 'message' then s.messages else s.changes end
    into v_on
    from public.notification_settings s
   where s.user_id = v_to;
  if v_on is false then
    return null;
  end if;
  return v_to;
end $$;

-- ---------------------------------------------------------------------------
-- 5) 발송 함수 부르기 - Vault 의 주소 · 비밀로 pg_net 요청 하나. 받는 사람이 없거나 토큰이 없거나 값이 없으면 0.
-- ---------------------------------------------------------------------------
create or replace function public.push_enqueue(p_kind text, p_couple uuid, p_actor uuid, p_photo boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_to uuid;
  v_url text;
  v_secret text;
begin
  begin
    v_to := public.push_recipient(p_kind, p_couple, p_actor);
    if v_to is null or not exists (select 1 from public.push_tokens t where t.user_id = v_to) then
      return;
    end if;
    select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'ondolog_push_url';
    select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'ondolog_push_secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
      return;
    end if;
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('kind', p_kind, 'couple_id', p_couple, 'actor_id', p_actor, 'photo', coalesce(p_photo, false)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-ondolog-push', v_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    -- 알림은 덤 - 저장을 막지 않는다. 내용은 남기지 않는다.
    return;
  end;
end $$;

-- 새 메시지: 지운 채로 들어온 행 0. 사진 = media_path 가 있는 메시지.
create or replace function public.tg_messages_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is null then
    perform public.push_enqueue('message', new.couple_id, new.sender_id, new.media_path is not null);
  end if;
  return null;
end $$;

create trigger tg_messages_push
  after insert on public.messages
  for each row execute function public.tg_messages_push();

-- 변경 안내: 이미 있던 사귄 날짜 · 닉네임이 바뀔 때만. 바꾼 사람 = 요청 사용자(상대에게만 간다 - push_recipient 가 상대를 고른다).
create or replace function public.tg_couples_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.relationship_start_date is not null and new.relationship_start_date is distinct from old.relationship_start_date then
    perform public.push_enqueue('date', new.id, auth.uid());
  end if;
  if old.nickname is not null and new.nickname is distinct from old.nickname then
    perform public.push_enqueue('nickname', new.id, auth.uid());
  end if;
  return null;
end $$;

create trigger tg_couples_push
  after update of relationship_start_date, nickname on public.couples
  for each row execute function public.tg_couples_push();

-- ---------------------------------------------------------------------------
-- 6) 발송 함수가 부르는 두 RPC(service_role 만). 첫 인자 = 받은 비밀 헤더 - Vault 값과 다르면 거부(앱 키로 함수를 불러도 여기서 막힌다).
--    push_context: 다시 판정 -> 받는 사람의 토큰 · 보낸 사람 이름. push_drop_token: FCM 이 "등록 안 된 토큰"이라 한 행을 지운다.
-- ---------------------------------------------------------------------------
create or replace function public.push_secret_ok(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
begin
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'ondolog_push_secret';
  return coalesce(v_secret, '') <> '' and p_secret is not null and p_secret = v_secret;
exception when others then
  return false;
end $$;

create or replace function public.push_context(p_secret text, p_kind text, p_couple uuid, p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_to uuid;
begin
  if not public.push_secret_ok(p_secret) then
    return jsonb_build_object('ok', false);
  end if;
  v_to := public.push_recipient(p_kind, p_couple, p_actor);
  if v_to is null then
    return jsonb_build_object('ok', true, 'tokens', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'ok', true,
    'sender_name', (select p.display_name from public.profiles p where p.id = p_actor),
    'tokens', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'token', t.token, 'platform', t.platform) order by t.created_at)
        from public.push_tokens t where t.user_id = v_to
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.push_drop_token(p_secret text, p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.push_secret_ok(p_secret) then
    return false;
  end if;
  delete from public.push_tokens t where t.id = p_token_id;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 7) 앱이 부르는 등록 RPC - 이 기기의 토큰을 내 것으로 둔다(갱신 포함). 같은 토큰 · 같은 기기의 다른 사람 행은 지운다(계정 전환).
--    같은 토큰이 내 다른 기기 칸에 있으면 그 행도 지운다(앱을 지웠다 다시 깔아 기기 값이 바뀐 경우).
-- ---------------------------------------------------------------------------
create or replace function public.push_register(p_device_id text, p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_platform not in ('android', 'ios') or coalesce(char_length(p_token), 0) not between 1 and 4096
     or coalesce(char_length(p_device_id), 0) not between 8 and 64 then
    raise exception 'invalid push registration' using errcode = '22023';
  end if;
  delete from public.push_tokens t
   where (t.token = p_token and not (t.user_id = v_uid and t.device_id = p_device_id))
      or (t.device_id = p_device_id and t.user_id <> v_uid);
  insert into public.push_tokens (user_id, device_id, token, platform, last_seen_at)
  values (v_uid, p_device_id, p_token, p_platform, now())
  on conflict (user_id, device_id) do update
     set token = excluded.token, platform = excluded.platform, last_seen_at = now();
end $$;

-- 계정 전환: 이 기기에 남은 다른 사람의 토큰 행을 지운다(이전 사람이 로그아웃하지 못하고 다른 계정으로 들어온 경우). 앱이 로그인마다 부른다.
create or replace function public.push_claim_device(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from public.push_tokens t where t.device_id = p_device_id and t.user_id <> v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- 8) 실행 권한(025 방식): 기본 권한으로 붙은 것을 회수하고 필요한 역할에만.
-- ---------------------------------------------------------------------------
revoke execute on function public.push_recipient(text, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.push_enqueue(text, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.push_secret_ok(text) from public, anon, authenticated, service_role;
revoke execute on function public.tg_messages_push() from public, anon, authenticated, service_role;
revoke execute on function public.tg_couples_push() from public, anon, authenticated, service_role;
revoke execute on function public.tg_couples_nickname_changed_by() from public, anon, authenticated, service_role;
revoke execute on function public.push_context(text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.push_drop_token(text, uuid) from public, anon, authenticated;
grant execute on function public.push_context(text, text, uuid, uuid) to service_role;
grant execute on function public.push_drop_token(text, uuid) to service_role;
revoke execute on function public.push_register(text, text, text) from public, anon;
grant execute on function public.push_register(text, text, text) to authenticated;
revoke execute on function public.push_claim_device(text) from public, anon;
grant execute on function public.push_claim_device(text) to authenticated;
