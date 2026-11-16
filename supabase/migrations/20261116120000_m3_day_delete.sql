-- 76-m3 (ROADMAP R101-4 · R98-8): 피드 "이 날 기록 지우기"(D2).
--
-- 왜: 하루 지우기는 "그날 내가 남긴 장소 · 사진 · 메모만" 지우고 상대 것은 남긴다는 약속이다.
-- data_entries 에는 author_id 가 있지만 date_stops(장소)에는 작성자가 없어 서버가 "내 장소"를 가를 수 없었다.
--
-- 이 파일이 하는 것(세 가지):
--   1) date_stops.author_id 칸. 기존 행은 비워 둔다(옛 장소). 새 행은 **서버가 넣는다**:
--      BEFORE INSERT 트리거가 앱이 보낸 값을 버리고 auth.uid() 로 덮는다. BEFORE UPDATE 는 원래 값을 지킨다(바꿀 수 없음).
--      프로필이 지워지면(탈퇴 배치) 장소는 남고 작성자만 비운다(on delete set null - 탈퇴 배치를 막지 않는다).
--   2) date_stops 정책: 기존 date_stops_all(for all) 하나를 넷으로 나눈다. 읽기 · 고치기 · 지우기는 그대로(커플 구성원),
--      **넣기만 "본인"**(author_id = auth.uid()). 트리거가 먼저 돌아 author_id 를 채우므로 앱의 기존 insert 는 그대로 통과한다.
--      고치기를 커플 전체로 두는 이유: 두 사람의 앱이 같은 날의 장소 순서(seq)를 다시 매긴다(resequenceStops).
--   3) RPC fn_delete_my_day(p_date_id): 그날 내가 남긴 것을 한 번에 지운다(함수 하나 = 한 트랜잭션, 중간 실패 시 0건).
--        - 내 data_entries(사진 · 메모 · 그림): 소프트 삭제(deleted_at). 023 fn_delete_own_entry 와 같은 방식 -
--          저장소 원본 파일은 지우지 않는다(보관 정책 §11-2, 기존 사진 삭제 경로와 같음).
--        - 내 date_stops: 지운다(이 테이블에는 소프트 삭제 칸이 없다 - 기존 앱의 장소 지우기와 같음).
--        - 작성자가 비어 있는 옛 장소: **그날 남은 것(상대의 항목 · 작성자 있는 장소)이 하나도 없을 때만** 지운다.
--        - 남은 것이 없으면 dates 행을 소프트 삭제(deleted_at) - 피드 카드가 사라진다. 같은 날 다시 기록하면 앱이 되살린다(기존 규칙).
--        - 남은 것이 있으면 dates 파생 칸(photo_count · has_user_note · duration_minutes)을 남은 항목으로 다시 맞춘다(023 과 같은 식).
--      확인하는 것: 로그인 · 날짜 행 존재 · 같은 커플(is_couple_member - 해제 완료 'dissolved' 는 거부, 유예 중은 허용).
--
-- 이 파일이 하지 않는 것: issues · issue_* · corners 등 발행물 변경(이미 발행된 호는 그대로), 다른 테이블 정책 변경,
-- 저장소(storage) 객체 삭제, 기존 행의 author_id 채우기, 배치 함수 호출.

-- ─────────────────────────────────────────────
-- 1) 작성자 칸
-- ─────────────────────────────────────────────
alter table public.date_stops
  add column author_id uuid references public.profiles(id) on delete set null;

comment on column public.date_stops.author_id is
  '장소를 남긴 사람. 76-m3 이전 행은 null(옛 장소). 새 행은 트리거가 auth.uid() 로 넣는다(앱이 보낸 값 무시). 바꿀 수 없다.';

create index idx_date_stops_author on public.date_stops (date_id, author_id);

create or replace function public.tg_date_stops_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
  else
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;

revoke all on function public.tg_date_stops_author() from public, anon, authenticated;

create trigger tg_date_stops_author
  before insert or update on public.date_stops
  for each row execute function public.tg_date_stops_author();

-- ─────────────────────────────────────────────
-- 2) 정책: 넣기만 본인
-- ─────────────────────────────────────────────
drop policy if exists date_stops_all on public.date_stops;

create policy date_stops_select on public.date_stops
  for select to authenticated
  using (public.is_couple_member(couple_id));

create policy date_stops_insert on public.date_stops
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

create policy date_stops_update on public.date_stops
  for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create policy date_stops_delete on public.date_stops
  for delete to authenticated
  using (public.is_couple_member(couple_id));

-- ─────────────────────────────────────────────
-- 3) 하루 지우기 RPC
-- ─────────────────────────────────────────────
create or replace function public.fn_delete_my_day(p_date_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_date          public.dates%rowtype;
  v_entries       integer := 0;
  v_stops         integer := 0;
  v_old_stops     integer := 0;
  v_left_entries  integer;
  v_left_stops    integer;
  v_photo_count   integer;
  v_memo_count    integer;
  v_timed_count   integer;
  v_first_at      timestamptz;
  v_last_at       timestamptz;
begin
  -- 1) 비로그인
  if v_uid is null then
    raise exception 'fn_delete_my_day: not authenticated' using errcode = '28000';
  end if;

  -- 2) 없는 날짜. 같은 날을 동시에 지우는 호출이 겹치지 않게 날짜 행을 잠근다.
  select * into v_date from public.dates where id = p_date_id for update;
  if not found then
    raise exception 'fn_delete_my_day: date % not found', p_date_id using errcode = 'P0002';
  end if;

  -- 3) 남의 커플 · 해제 완료 커플
  if not public.is_couple_member(v_date.couple_id) then
    raise exception 'fn_delete_my_day: caller is not a member of the couple that owns date %', p_date_id
      using errcode = '42501';
  end if;

  -- 4) 멱등: 이미 지워진 날이면 아무것도 바꾸지 않는다.
  if v_date.deleted_at is not null then
    return jsonb_build_object('entries', 0, 'stops', 0, 'old_stops', 0, 'day_removed', true);
  end if;

  -- 5) 내 항목(사진 · 메모 · 그림) 소프트 삭제
  update public.data_entries
     set deleted_at = now()
   where date_id = p_date_id and author_id = v_uid and deleted_at is null;
  get diagnostics v_entries = row_count;

  -- 6) 내 장소
  delete from public.date_stops where date_id = p_date_id and author_id = v_uid;
  get diagnostics v_stops = row_count;

  -- 7) 남은 것: 상대(그 밖 작성자)의 지우지 않은 항목 · 작성자가 있는 장소
  select count(*) into v_left_entries from public.data_entries where date_id = p_date_id and deleted_at is null;
  select count(*) into v_left_stops from public.date_stops where date_id = p_date_id and author_id is not null;

  if v_left_entries = 0 and v_left_stops = 0 then
    -- 옛 장소(작성자 없음)는 남은 것이 하나도 없을 때만 지운다. 그날 카드는 사라진다.
    delete from public.date_stops where date_id = p_date_id and author_id is null;
    get diagnostics v_old_stops = row_count;
    update public.dates
       set deleted_at = now(), photo_count = 0, has_user_note = false, duration_minutes = null
     where id = p_date_id;
    return jsonb_build_object('entries', v_entries, 'stops', v_stops, 'old_stops', v_old_stops, 'day_removed', true);
  end if;

  -- 8) 남은 항목으로 파생 칸을 다시 맞춘다(023 fn_delete_own_entry 와 같은 식).
  select
    count(*) filter (where e.entry_type = 'photo'),
    count(*) filter (where e.entry_type = 'memo'),
    count(*) filter (where e.entry_type = 'photo' and e.captured_at is not null
                       and (e.captured_at at time zone 'Asia/Seoul')::date = v_date.date_on),
    min(e.captured_at) filter (where e.entry_type = 'photo' and e.captured_at is not null
                       and (e.captured_at at time zone 'Asia/Seoul')::date = v_date.date_on),
    max(e.captured_at) filter (where e.entry_type = 'photo' and e.captured_at is not null
                       and (e.captured_at at time zone 'Asia/Seoul')::date = v_date.date_on)
  into v_photo_count, v_memo_count, v_timed_count, v_first_at, v_last_at
  from public.data_entries e
  where e.date_id = p_date_id and e.deleted_at is null;

  update public.dates
     set photo_count      = v_photo_count,
         has_user_note    = v_memo_count > 0,
         duration_minutes = case
                              when v_timed_count >= 2
                              then round(extract(epoch from (v_last_at - v_first_at)) / 60)::integer
                              else null
                            end
   where id = p_date_id;

  return jsonb_build_object('entries', v_entries, 'stops', v_stops, 'old_stops', 0, 'day_removed', false);
end;
$$;

-- 권한: authenticated만. anon·public 회수(Supabase 기본 권한이 anon에도 주어지므로 명시한다).
revoke all on function public.fn_delete_my_day(uuid) from public, anon;
grant execute on function public.fn_delete_my_day(uuid) to authenticated;

comment on function public.fn_delete_my_day(uuid) is
  '76-m3 하루 지우기: 그날 내가 남긴 장소(삭제) · 사진 · 메모(소프트 삭제)를 한 번에. 작성자 없는 옛 장소는 남은 것이 없을 때만 지우고, 그때 dates 를 소프트 삭제한다. 남은 것이 있으면 파생 칸 재계산. 발행물 · 저장소 원본은 건드리지 않는다.';
