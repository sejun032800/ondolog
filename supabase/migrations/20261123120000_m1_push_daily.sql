-- 87-m1 (ROADMAP R148-3 · R148-2 · R111-5 정정): 알림 날짜별 숫자 표 - 80-m1 app_error_daily 와 같은 틀(하루 · 갈래 · 건수뿐).
--
-- 왜: Free 플랜 로그 보존은 1일이라 "지난 7일 push-send 상태별 건수"를 로그로 볼 수 없다. 알림이 조용히 멈추면(11/16 함수 비밀 누락 -> 503 x22)
--     커플은 모른 채 지나간다 -> 날짜별 숫자를 DB 에 남겨 월요일 점검을 SQL 읽기 질의 하나로 한다.
--
-- 표 하나(push_daily): 행 = (KST 하루 · 알림 종류 · 결과 갈래), 칸 = 건수뿐.
--   내용 · 메시지 id · 사용자 · 커플 · 토큰 · 주소 · 자유 글 칸 0. 갈래 이름은 정해진 목록 · 형식 안의 짧은 글자다.
-- 두 길로 센다:
--   (a) 함수가 끝까지 돌았을 때 - push-send 가 응답 직전에 push_count(종류, 갈래, 건수)를 부른다(먼저 보내고, 기록 실패는 함수가 삼킨다).
--       갈래: sent · dropped · fcm_NNN · send_error(토큰마다) / no_tokens · ring · collapse · realert_err(요청마다) /
--             unauthorized · bad_request · method · internal · config(함수가 DB 에 쓸 수 있을 때만).
--   (b) 함수가 돌지 못했을 때(비밀 없음 503 · 게이트웨이 401 · 시간 초과 · 연결 실패) - 함수는 DB 에 못 쓸 수 있다.
--       그래서 DB 쪽: push_enqueue 가 pg_net 요청 번호를 push_net_pending 에 적고(번호 · 종류 · 시각뿐),
--       pg_cron 이 1시간마다 push_net_collect() 로 pg_net 응답(net._http_response, 보존 6시간)과 맞춰 http_NNN · timeout · net_error 로 센 뒤
--       그 번호를 지운다(같은 응답을 두 번 세지 않는다). 6시간이 지나도 응답이 없는 번호는 lost 로 센다(응답이 사라졌거나 오지 않음).
--       1시간 주기 = pg_net 보존 6시간보다 짧고, 한두 번 빠져도 응답이 남아 있다. 앱이 부르는 경로 0.
-- 표 직접 읽기 · 쓰기: 앱 역할(anon · authenticated) 0(RLS 켬 · 정책 0 · 권한 회수). 운영(service_role · 대시보드 SQL)만 읽기 · 지우기
--   (월요일 정리 purgeWithdrawn - 90일 지난 행).
-- 이 파일이 바꾸는 기존 것: push_enqueue 본문(요청 번호 한 줄 적기 - 나머지 78-m1 그대로) · cron 예약 하나 추가.
-- 이 파일이 하지 않는 것: 다른 테이블 · 트리거 변경 · 데모 응답 표 · 외부 호출.

-- ---------------------------------------------------------------------------
-- 1) 하루 집계 표
-- ---------------------------------------------------------------------------
create table public.push_daily (
  day date not null,
  kind text not null check (kind in ('message', 'date', 'nickname', 'unknown')),
  status text not null check (char_length(status) between 1 and 24 and status ~ '^[a-z0-9_]+$'),
  count integer not null default 0 check (count between 0 and 100000),
  primary key (day, kind, status)
);

comment on table public.push_daily is '87-m1 알림 하루 집계(내용 · id · 사람 · 토큰 칸 0). 쓰기는 push_count(함수) · push_net_collect(DB 예약)로만. 90일 지난 행은 월요일 정리(purgeWithdrawn)가 지운다.';

alter table public.push_daily enable row level security;
-- 정책 0: 앱 역할은 RLS 로도 막히고 권한 자체도 없다. service_role 은 RLS 를 건너뛴다.
revoke all on public.push_daily from public, anon, authenticated, service_role;
grant select, delete on public.push_daily to service_role;

-- 갈래 이름 정리(두 쓰기 길 공용) - 목록 · 형식 밖이면 'other'.
create or replace function public.push_status_name(p_status text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_status in (
      'sent', 'dropped', 'send_error', 'no_tokens', 'ring', 'collapse', 'realert_err',
      'unauthorized', 'bad_request', 'method', 'internal', 'config',
      'timeout', 'net_error', 'lost'
    ) then p_status
    when p_status ~ '^(fcm|http)_[0-9]{3}$' then p_status
    else 'other'
  end
$$;

-- 한 줄 더하기(두 쓰기 길 공용). 하루 · 종류 · 갈래 상한 100,000.
create or replace function public.push_daily_add(p_day date, p_kind text, p_status text, p_count integer)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text := case when p_kind in ('message', 'date', 'nickname') then p_kind else 'unknown' end;
  v_count integer := greatest(0, least(coalesce(p_count, 0), 100000));
begin
  if v_count = 0 or p_day is null then
    return;
  end if;
  insert into public.push_daily as d (day, kind, status, count)
  values (p_day, v_kind, public.push_status_name(p_status), v_count)
  on conflict (day, kind, status)
  do update set count = least(d.count + excluded.count, 100000)
  where d.count < 100000;
end $$;

-- ---------------------------------------------------------------------------
-- 2) (a) 함수가 부르는 RPC - service_role(함수 전용 키)만. 날짜는 서버가 정한다(지금의 KST 날짜). 건수 1~1000.
-- ---------------------------------------------------------------------------
create or replace function public.push_count(p_kind text, p_status text, p_count integer default 1)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.push_daily_add((now() at time zone 'Asia/Seoul')::date, p_kind, p_status, greatest(1, least(coalesce(p_count, 1), 1000)));
end $$;

-- ---------------------------------------------------------------------------
-- 3) (b) pg_net 요청 번호 - 번호 · 종류 · 시각뿐(본문 · 주소 · 헤더 0). push_net_collect 가 센 뒤 지운다.
-- ---------------------------------------------------------------------------
create table public.push_net_pending (
  id bigint primary key,
  kind text not null check (kind in ('message', 'date', 'nickname')),
  created_at timestamptz not null default now()
);

comment on table public.push_net_pending is '87-m1 알림 요청 번호(pg_net) - 응답을 세면 지운다. 내용 칸 0.';

alter table public.push_net_pending enable row level security;
revoke all on public.push_net_pending from public, anon, authenticated, service_role;
grant select on public.push_net_pending to service_role;

-- 78-m1 push_enqueue 그대로 + 요청 번호 한 줄. 적기에 실패해도 알림 요청은 이미 나갔다(예외 삼킴 - 78-m1 과 같다).
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
  v_req bigint;
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
    v_req := net.http_post(
      url := v_url,
      body := jsonb_build_object('kind', p_kind, 'couple_id', p_couple, 'actor_id', p_actor, 'photo', coalesce(p_photo, false)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-ondolog-push', v_secret),
      timeout_milliseconds := 5000
    );
    -- 87-: 응답을 나중에 세려고 번호만 적는다.
    if v_req is not null then
      insert into public.push_net_pending (id, kind) values (v_req, p_kind) on conflict (id) do nothing;
    end if;
  exception when others then
    -- 알림은 덤 - 저장을 막지 않는다. 내용은 남기지 않는다.
    return;
  end;
end $$;

-- 응답이 온 번호 -> http_NNN · timeout · net_error 로 세고 지운다. 6시간 넘게 응답이 없는 번호 -> lost 로 세고 지운다.
-- 날짜 = 요청을 적은 시각의 KST 날짜. 같은 번호는 지운 뒤라 다시 세지 않는다(지우기와 더하기가 한 문장 - 함께 되거나 함께 안 된다).
-- 돌려주는 값 = 이번에 센 요청 수(응답 온 것 + lost).
create or replace function public.push_net_collect()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  v_k integer := 0;
begin
  with done as (
    delete from public.push_net_pending p
     using net._http_response h
     where h.id = p.id
    returning p.kind, p.created_at,
      case
        when h.timed_out is true then 'timeout'
        when h.status_code is null then 'net_error'
        else 'http_' || lpad(h.status_code::text, 3, '0')
      end as status
  ), agg as (
    select (created_at at time zone 'Asia/Seoul')::date as day, kind, public.push_status_name(status) as status, count(*)::int as n
      from done group by 1, 2, 3
  ), added as (
    insert into public.push_daily as d (day, kind, status, count)
    select day, kind, status, least(n, 100000) from agg
    on conflict (day, kind, status)
    do update set count = least(d.count + excluded.count, 100000)
    where d.count < 100000
    returning 1
  )
  select coalesce(sum(n), 0)::int into v_n from agg;

  with gone as (
    delete from public.push_net_pending p
     where p.created_at < now() - interval '6 hours'
    returning p.kind, p.created_at
  ), agg as (
    select (created_at at time zone 'Asia/Seoul')::date as day, kind, count(*)::int as n
      from gone group by 1, 2
  ), added as (
    insert into public.push_daily as d (day, kind, status, count)
    select day, kind, 'lost', least(n, 100000) from agg
    on conflict (day, kind, status)
    do update set count = least(d.count + excluded.count, 100000)
    where d.count < 100000
    returning 1
  )
  select coalesce(sum(n), 0)::int into v_k from agg;

  return v_n + v_k;
end $$;

-- ---------------------------------------------------------------------------
-- 4) 실행 권한(025 방식): 기본 권한을 회수하고 필요한 경로에만.
-- ---------------------------------------------------------------------------
revoke execute on function public.push_status_name(text) from public, anon, authenticated, service_role;
revoke execute on function public.push_daily_add(date, text, text, integer) from public, anon, authenticated, service_role;
revoke execute on function public.push_count(text, text, integer) from public, anon, authenticated;
grant execute on function public.push_count(text, text, integer) to service_role;
revoke execute on function public.push_net_collect() from public, anon, authenticated, service_role;
revoke execute on function public.push_enqueue(text, uuid, uuid, boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) 1시간마다 pg_net 응답 세기(pg_net 보존 6시간보다 짧게). 같은 이름이면 pg_cron 이 갱신한다(014 · 030 과 같은 방식).
-- ---------------------------------------------------------------------------
select cron.schedule('push-net-count', '7 * * * *', $$ select public.push_net_collect(); $$);
