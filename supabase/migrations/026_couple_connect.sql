-- 커플 연결 함수 + couples 직접 쓰기 회수 (026).
-- 근거: SCHEMA 9-F, 10-0, ROADMAP R40-2 · R40-3 · R33-1. 위임 `66-` 1부.
-- 001~025는 이미 적용된 것이라 고치지 않는다.
--
-- 발견(65- 원격 실증): 앱의 초대 코드 입력이 couples를 직접 UPDATE했다. UPDATE의 WHERE·RETURNING에는 SELECT 정책이 걸려서,
-- 아직 구성원이 아닌 B에게는 대기 행이 보이지 않는다 -> 오류 없이 0행 갱신. 사용자 권한으로는 연결이 한 번도 성립하지 않았다.
-- SELECT 정책을 넓히면 모든 초대 코드가 노출되므로 넓히지 않는다(이 파일은 SELECT 정책을 건드리지 않는다).
-- 함께 찾은 구멍: couples_update / couples_insert가 구성원에게 연결 칸을 마음대로 쓰게 열려 있었다(동의 없는 강제 연결, subscription_tier 지정).
--
-- 이 파일이 하는 일 (couples 외 테이블 · 다른 정책 · 024 issues 칸 권한 · 025의 기존 함수 권한은 바꾸지 않는다):
--   1) 연결 함수 public.fn_connect_couple(p_invite_code text) 생성
--   2) 그 함수의 실행 권한: public · anon · authenticated · service_role 회수 후 authenticated만 부여 (SCHEMA 10-0 클라이언트 RPC)
--   3) couples UPDATE 권한: anon · authenticated 테이블 단위 회수 -> 앱이 실제로 쓰는 다섯 칸만 authenticated에 칸 단위 부여
--   4) couples_update 정책: (user_b_id is null and status = 'pending') 가지 삭제 - 연결은 함수만 한다
--   5) couples_insert 정책: with check에 user_b_id is null and status = 'pending' and subscription_tier = 'free' 추가 - 초대 발급만 허용
--   6) RLS: couples는 005에서 이미 enable row level security. 이 파일은 끄지도 바꾸지도 않는다. 새 테이블이 없다.
--
-- 앱이 couples에 쓰는 칸 (src/ app/ 전수 조사, 위임 `66-` 산출 1):
--   UPDATE  src/services/coupleApi.ts  setOrConfirmStartDate : relationship_start_date, start_date_set_by
--           src/services/coupleApi.ts  setOrConfirmStartDate : start_date_confirmed_by
--           src/services/coupleApi.ts  saveStartDateAndNickname      : nickname
--           src/services/referencePhotoApi.ts                 : reference_photo_path
--           => 부여하는 다섯 칸 = relationship_start_date, start_date_set_by, start_date_confirmed_by, nickname, reference_photo_path
--           src/services/coupleApi.ts redeemInviteCode 는 user_b_id · status · connected_at 을 직접 UPDATE 한다 -> 이 파일의 연결 함수로 바뀐다
--           (앱 쪽 전환은 같은 66-의 ui-builder 몫. 이 마이그레이션을 적용하면 옛 직접 UPDATE는 거부된다.)
--   INSERT  src/services/coupleApi.ts  getOrCreateInvite     : user_a_id, invite_code (나머지는 칸 기본값: user_b_id null · status pending · subscription_tier free)
--           => 5)의 with check를 그대로 통과한다.
--   UPDATE 권한이 없는 칸(클라이언트 불가): user_a_id, user_b_id, status, connected_at, dissolved_at, invite_code, subscription_tier
--           그리고 invite_expires_at, magazine_theme, id, created_at, updated_at.
--           magazine_theme은 앱이 지금 쓰지 않아 주지 않는다. 잠금은 M4-5에서 다시 정한다(SCHEMA 9-C-8, 알려진 구멍 - 이 파일의 범위 밖).
--           updated_at은 tg_couples_updated 트리거가 NEW를 직접 바꾸므로 칸 권한이 필요 없다.
--   scripts/ops 의 couples INSERT 는 service_role 이라 권한 · 정책과 무관하다(고치지 않는다).

-- ---------------------------------------------------------------------------
-- 1) 연결 함수
--    확인 순서: 로그인(28000) -> 코드 정규화 -> 멱등 확인 -> (pending · user_b null · 만료 전) 행 찾기 -> 두 사람의 profiles 행을 id 순서로 잠금
--             -> 같은 조건의 행을 for update 로 다시 잡기 -> 없으면 P0002 -> 자기 코드 22023 -> 둘 중 하나가 active · dissolving 커플이면 23505
--    없는 코드 · 만료 · 이미 사용은 같은 P0002 · 같은 메시지 하나다(어느 경우인지 알려 주지 않는다).
--    만료 조건: invite_expires_at 이 null 이면 "만료 없음"(앱의 발급 INSERT가 이 칸을 채우지 않아 기존 코드는 전부 null).
--              값이 있으면 지금보다 뒤여야 한다. 실제 만료 시간 정책은 M4(초대 시도 횟수 제한과 함께).
--    본문의 테이블 이름에는 public. 접두사를 붙이고 search_path 는 비운다(SCHEMA 9-E 관례 + 10-0).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2) 실행 권한: authenticated만 (SCHEMA 10-0). 025 이후 새 함수는 권한 없이 태어나지만 명시적으로 다시 회수한다.
-- ---------------------------------------------------------------------------
revoke all on function public.fn_connect_couple(text) from public, anon, authenticated, service_role;
grant execute on function public.fn_connect_couple(text) to authenticated;

comment on function public.fn_connect_couple(text) is
  '초대 코드로 커플을 연결한다(사용자 권한 호출). 반환=커플 id. 비로그인 28000, 없는·만료·이미 쓴 코드 P0002(구분 안 함), 자기 코드 22023, 이미 커플 23505. 같은 사람의 같은 코드 재호출은 같은 id(멱등). couples 연결 칸은 이 함수만 쓴다(026).';

-- ---------------------------------------------------------------------------
-- 3) couples UPDATE 권한: 테이블 단위 회수 -> 다섯 칸만 칸 단위 부여.
--    원격은 anon · authenticated 에 테이블 단위 UPDATE 가 있다(읽기 전용 조회로 확인). 테이블 단위 권한이 있으면 칸 단위 회수는 효과가 없으므로
--    테이블 단위를 먼저 회수한다. 칸 단위로 따로 부여된 권한이 있을 경우를 위해 칸 단위도 함께 회수한다(없으면 무해).
--    service_role 은 건드리지 않는다.
-- ---------------------------------------------------------------------------
revoke update on public.couples from anon, authenticated;
revoke update (
  id, user_a_id, user_b_id, invite_code, invite_expires_at, nickname,
  relationship_start_date, start_date_set_by, start_date_confirmed_by,
  reference_photo_path, subscription_tier, status, connected_at, dissolved_at,
  magazine_theme, created_at, updated_at
) on public.couples from anon, authenticated;

grant update (
  relationship_start_date, start_date_set_by, start_date_confirmed_by,
  nickname, reference_photo_path
) on public.couples to authenticated;

-- ---------------------------------------------------------------------------
-- 4) couples_update: 대기 행에 들어가는 가지 삭제. using 은 구성원 본인 행만. with check 는 그대로.
-- ---------------------------------------------------------------------------
alter policy couples_update on public.couples
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) couples_insert: 초대 발급만 허용 (연결된 행 · active · 유료 등급으로 처음부터 넣을 수 없다).
-- ---------------------------------------------------------------------------
alter policy couples_insert on public.couples
  with check (
    user_a_id = auth.uid()
    and user_b_id is null
    and status = 'pending'
    and subscription_tier = 'free'
  );
