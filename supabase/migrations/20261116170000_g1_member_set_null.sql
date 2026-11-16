-- 76-g-m1 (ROADMAP R105-2 · R105-5): 상대가 남은 사람의 탈퇴 최종 삭제를 막던 외래 키를 "비움 허용 · 사람이 지워지면 비움"으로.
--
-- 왜: couples.user_a_id · user_b_id 가 profiles 를 ON DELETE RESTRICT 로 가리켜(005), 상대가 남아 커플 행을 지울 수 없을 때
--     떠난 사람의 프로필 · 인증 사용자(이메일)도 지울 수 없었다 -> 처리방침 "탈퇴 7일 뒤 지웁니다"와 어긋남(76-f P2).
-- 원칙: 남은 사람의 것은 그대로 · 떠난 사람을 가리키던 칸은 비움(on delete set null + not null 해제).
--
-- 바꾸는 칸(전부 profiles(id)를 가리킴):
--   couples.user_a_id              not null · restrict   -> null 허용 · set null
--   couples.user_b_id              restrict              -> set null
--   couples.start_date_set_by      no action             -> set null
--   couples.start_date_confirmed_by no action            -> set null
--   couple_dissolutions.initiated_by not null · no action -> null 허용 · set null
--
-- 바꾸지 않는 칸(이유):
--   data_entries.author_id · messages.sender_id · stories.author_id (restrict) - 떠난 사람의 기록 행은 지운다(처리방침 "올린 기록을 지웁니다").
--     해제 실행(030)이 요청자 것을 지우고, purgeWithdrawn 이 인증 사용자를 지우기 전에 떠난 사람 것을 지운다. restrict 는 빠뜨린 행이 있을 때 계정 삭제를 막는 안전망.
--   date_stops.author_id (76-m3, 이미 set null) · stat_snapshots.user_id · personality_assessments · personality_profiles (cascade) · profiles.id -> auth.users (cascade).
--
-- 견딤(76-g ②): 이 칸이 비는 것은 해제가 끝난(status 'dissolved') 커플뿐이다 - purgeWithdrawn 은 상대가 남은 커플이 'dissolved' 가 아니면 기다린다.
--   앱은 pending · active · dissolving 만 읽고, is_couple_member(011)는 dissolved 를 제외한다. 030 본문은 고치지 않는다.
--
-- 함께 바꾸는 검사 하나(같은 원칙 - 비운 칸이 막히지 않게):
--   couples.chk_start_date_owner: "사귄 날짜가 있으면 정한 사람이 있다"(005). 정한 사람이 떠나 칸이 비면 이 검사가 계정 삭제를 막는다.
--   -> 해제가 끝난(status 'dissolved') 커플에서만 비어도 되게 한다. 연결 · 유예 중인 커플에는 그대로 걸린다.
--
-- 함께 고치는 트리거 하나(같은 원칙):
--   76-m3 tg_date_stops_author 는 UPDATE 때 author_id 를 원래 값으로 되돌린다(앱이 바꾸지 못하게). 그런데 프로필이 지워질 때의
--   on delete set null 도 UPDATE 라서 되돌려져, 지워진 사람을 가리키는 값이 남는다(PGlite 시험으로 확인).
--   -> 비우는 것은 "가리키던 프로필이 이미 없을 때"만 허용한다. 앱이 살아 있는 사람의 작성자를 바꾸거나 비우는 길은 그대로 막힌다.
--
-- 이 파일이 하지 않는 것: 데이터 변경 · 정책 변경 · 그 밖의 함수 변경 · 다른 표 변경.

alter table public.couples alter column user_a_id drop not null;

alter table public.couples drop constraint couples_user_a_id_fkey;
alter table public.couples add constraint couples_user_a_id_fkey
  foreign key (user_a_id) references public.profiles(id) on delete set null;

alter table public.couples drop constraint couples_user_b_id_fkey;
alter table public.couples add constraint couples_user_b_id_fkey
  foreign key (user_b_id) references public.profiles(id) on delete set null;

alter table public.couples drop constraint couples_start_date_set_by_fkey;
alter table public.couples add constraint couples_start_date_set_by_fkey
  foreign key (start_date_set_by) references public.profiles(id) on delete set null;

alter table public.couples drop constraint couples_start_date_confirmed_by_fkey;
alter table public.couples add constraint couples_start_date_confirmed_by_fkey
  foreign key (start_date_confirmed_by) references public.profiles(id) on delete set null;

alter table public.couple_dissolutions alter column initiated_by drop not null;

alter table public.couple_dissolutions drop constraint couple_dissolutions_initiated_by_fkey;
alter table public.couple_dissolutions add constraint couple_dissolutions_initiated_by_fkey
  foreign key (initiated_by) references public.profiles(id) on delete set null;

alter table public.couples drop constraint chk_start_date_owner;
alter table public.couples add constraint chk_start_date_owner
  check (relationship_start_date is null or start_date_set_by is not null or status = 'dissolved');

create or replace function public.tg_date_stops_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
  elsif new.author_id is null and old.author_id is not null
        and not exists (select 1 from public.profiles p where p.id = old.author_id) then
    new.author_id := null; -- 작성자 프로필이 지워짐(on delete set null)
  else
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;

revoke all on function public.tg_date_stops_author() from public, anon, authenticated;
