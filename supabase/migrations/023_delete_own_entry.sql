-- 본인 기록 삭제 RPC: fn_delete_own_entry(p_entry_id).
-- 근거: ROADMAP R30-1, MASTER 9-4(r68 "본인 기록 삭제") · 17-0-10-D. 위임 `57-` A.
-- 001~022는 이미 적용된 것이라 고치지 않는다. 023은 함수 하나만 얹는다.
--
-- 왜 RPC인가: entries_select 정책이 `deleted_at is null`을 요구해서, 갱신 직후 행이 SELECT에서 사라진다.
-- 그래서 평범한 UPDATE(소프트 삭제)는 RLS가 거부한다. DELETE 정책은 만들지 않는다(소프트 삭제).
-- 이 함수는 RLS를 우회하려는 것이 아니라, 정책으로 못 쓰는 "작성자 본인의 소프트 삭제"를 함수 안의 확인으로 대신한다.
-- 함수 본문이 반드시 확인하는 것: 로그인(auth.uid()) · 항목 존재 · 같은 커플(is_couple_member) · 작성자 = 호출자.
--
-- 하지 않는 것: RLS·정책 변경, 다른 테이블 변경, 저장소 원본 파일 삭제(보관 정책 §11-2), 데이트 삭제.
-- 새 테이블이 없으므로 RLS 설정은 없다(기존 data_entries·dates의 정책이 그대로다).

create or replace function public.fn_delete_own_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_entry        public.data_entries%rowtype;
  v_date_on      date;
  v_photo_count  integer;
  v_memo_count   integer;
  v_timed_count  integer;
  v_first_at     timestamptz;
  v_last_at      timestamptz;
begin
  -- 1) 비로그인
  if v_uid is null then
    raise exception 'fn_delete_own_entry: not authenticated' using errcode = '28000';
  end if;

  -- 2) 없는 항목. 같은 항목을 동시에 지우는 호출이 겹치지 않게 행을 잠근다.
  select * into v_entry from public.data_entries where id = p_entry_id for update;
  if not found then
    raise exception 'fn_delete_own_entry: entry % not found', p_entry_id using errcode = 'P0002';
  end if;

  -- 3) 커플 아님
  if not public.is_couple_member(v_entry.couple_id) then
    raise exception 'fn_delete_own_entry: caller is not a member of the couple that owns entry %', p_entry_id
      using errcode = '42501';
  end if;

  -- 4) 작성자 아님(같은 커플이어도 상대의 기록은 못 지운다)
  if v_entry.author_id <> v_uid then
    raise exception 'fn_delete_own_entry: entry % was not uploaded by the caller', p_entry_id
      using errcode = '42501';
  end if;

  -- 5) 멱등: 이미 지운 항목은 아무것도 바꾸지 않는다(deleted_at·파생 칸 모두 그대로).
  if v_entry.deleted_at is not null then
    return false;
  end if;

  update public.data_entries set deleted_at = now() where id = p_entry_id;

  -- 6) 붙은 데이트의 파생 칸을 남은 항목 기준으로 다시 맞춘다. 데이트는 지우지 않는다(사진 0장이어도).
  --    계산은 앱의 refreshDateDerived / deriveDateFields(src/utils/dateRecord.ts)와 같다:
  --      photo_count      = 지우지 않은 사진 수
  --      has_user_note    = 지우지 않은 메모가 하나라도 있는가
  --      duration_minutes = 그 날짜(KST, dates.date_on)에 촬영 시각이 있는 사진이 둘 이상이면 첫~마지막 폭(분), 아니면 null
  if v_entry.date_id is not null then
    select d.date_on into v_date_on from public.dates d where d.id = v_entry.date_id for update;
    if found then
      select
        count(*) filter (where e.entry_type = 'photo'),
        count(*) filter (where e.entry_type = 'memo'),
        count(*) filter (where e.entry_type = 'photo' and e.captured_at is not null
                           and (e.captured_at at time zone 'Asia/Seoul')::date = v_date_on),
        min(e.captured_at) filter (where e.entry_type = 'photo' and e.captured_at is not null
                           and (e.captured_at at time zone 'Asia/Seoul')::date = v_date_on),
        max(e.captured_at) filter (where e.entry_type = 'photo' and e.captured_at is not null
                           and (e.captured_at at time zone 'Asia/Seoul')::date = v_date_on)
      into v_photo_count, v_memo_count, v_timed_count, v_first_at, v_last_at
      from public.data_entries e
      where e.date_id = v_entry.date_id and e.deleted_at is null;

      update public.dates
         set photo_count      = v_photo_count,
             has_user_note    = v_memo_count > 0,
             duration_minutes = case
                                  when v_timed_count >= 2
                                  then round(extract(epoch from (v_last_at - v_first_at)) / 60)::integer
                                  else null
                                end
       where id = v_entry.date_id;
    end if;
  end if;

  return true;
end;
$$;

-- 권한: authenticated만. anon·public 회수(Supabase 기본 권한이 anon에도 주어지므로 명시한다).
revoke all on function public.fn_delete_own_entry(uuid) from public, anon;
grant execute on function public.fn_delete_own_entry(uuid) to authenticated;

comment on function public.fn_delete_own_entry(uuid) is
  '작성자 본인의 data_entries 소프트 삭제 + 붙은 dates 파생 칸 재계산. true=지움, false=이미 지워져 있어 변화 없음. 작성자 아님/커플 아님/없음/비로그인은 예외. 저장소 원본은 지우지 않는다.';
