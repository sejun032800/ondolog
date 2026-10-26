-- 연결 해제 · 탈퇴 · 재검사 함수 + profiles / personality_profiles / couple_dissolutions 직접 쓰기 회수 (027).
-- 근거: SCHEMA 9-G, 10-0, 11-3, ROADMAP R42-6 · R43-1~6 · R34-3. 위임 `68-` 1부.
-- 001~026은 이미 적용된 것이라 고치지 않는다.
--
-- 발견(PM 검토, R42-6):
--   1) couple_dissolutions 의 INSERT · UPDATE 가 클라이언트에 열려 있어 purge_scheduled_at(7일 유예) 과 executed_at 을 클라이언트가 정한다.
--   2) profiles_update 가 자기 행의 모든 칸을 연다(deleted_at · purge_scheduled_at · 동의 시각 · birth_date · onboarding_step).
--   3) 026 뒤 클라이언트는 couples.status 를 못 써서 dissolving 을 세울 길이 없다.
--   4) 재검사가 INSERT 와 UPDATE 두 번으로 나뉘어, 사이에서 끊기면 영구히 막힌다(67-).
--
-- 이 파일이 하는 일 (execute_dissolution · apply_retention_policy 본문 · pg_cron 작업 · 다른 테이블 · 024 · 025 · 026 권한 · SELECT 정책은 바꾸지 않는다):
--   1) 함수 다섯 (모두 security definer · set search_path = '' · 본문 public. 접두사 · authenticated 만 실행)
--        fn_request_dissolution()                 해제 요청     -> couple_dissolutions.id
--        fn_cancel_dissolution(uuid)              해제 취소     -> void
--        fn_request_withdrawal()                  탈퇴 요청     -> purge_scheduled_at
--        fn_cancel_withdrawal()                   탈퇴 취소     -> void
--        fn_complete_retest(...)                  재검사 완료   -> (out_assessment_id, out_recovered)
--   2) couple_dissolutions: INSERT · UPDATE 정책 삭제, anon · authenticated 의 INSERT · UPDATE · DELETE 권한 회수. SELECT 그대로.
--   3) profiles UPDATE: 테이블 단위 회수 -> 아래 일곱 칸만 authenticated 에 칸 단위 부여.
--   4) profiles.onboarding_step 감소 거부 BEFORE UPDATE 트리거(22023). 모든 역할에 걸린다.
--   5) profiles INSERT with check 에 deleted_at is null and purge_scheduled_at is null 추가.
--   6) personality_profiles UPDATE: 테이블 단위 회수 -> 오버라이드 경로의 네 칸만 부여. INSERT with check 에 retest_used = false 추가.
--   7) service_role 의 테이블 권한은 건드리지 않는다(운영자 스크립트).
--   8) RLS: profiles · personality_profiles · couple_dissolutions 는 003 · 004 · 005 에서 이미 enable row level security 이고
--      이 파일은 끄지도 바꾸지도 않는다. 새 테이블이 없다. (이 파일이 바꾸는 정책: profiles_insert · pprofiles_write 의 with check, dissolutions_insert · dissolutions_update 삭제)
--
-- 앱이 쓰는 칸 (src/ app/ 전수 조사, 위임 `68-` §0-d):
--   profiles UPDATE
--     src/services/onboardingStepCore.ts:22  advanceOnboardingStep          : onboarding_step           (.lt 로 올리기만)
--     src/services/settingsCore.ts:45        updateProfileBasics            : display_name, gender
--     src/services/referencePhotoApi.ts:74   uploadReferencePhoto(personal) : reference_photo_path
--     src/store/profileStore.ts:95           agreeBiometricConsent          : biometric_consent_at, biometric_consent_revoked_at
--     src/store/profileStore.ts:106          revokeBiometricConsent         : biometric_consent_revoked_at, reference_photo_path
--     marketing_agreed_at: 앱이 UPDATE 하는 곳은 아직 없다(가입 INSERT 에서만 씀, personalityCore.ts:117). SCHEMA 9-G 가 칸 단위로 열라고 지정했고
--                          설정 화면의 켜기 · 끄기가 쓸 칸이라 부여한다.
--     => 부여하는 일곱 칸 = display_name, gender, onboarding_step, marketing_agreed_at, biometric_consent_at, biometric_consent_revoked_at, reference_photo_path
--     부여하지 않는 칸(클라이언트 UPDATE 불가): id, birth_date, mbti(재검사 함수만, R43-3), photo_sync_enabled, photo_scan_completed_at, photo_scan_cursor,
--       terms_agreed_at, privacy_agreed_at, ai_usage_agreed_at, deleted_at, purge_scheduled_at(탈퇴 함수만), created_at, updated_at(트리거가 NEW 를 직접 바꿔 칸 권한 불필요)
--   profiles INSERT   src/services/personalityCore.ts:107 : 가입 한 번(없을 때만). deleted_at · purge_scheduled_at 은 넣지 않는다 -> 5)의 with check 통과.
--   personality_profiles UPDATE
--     src/services/personalityCore.ts:201 overrideEnneagramCore : enneagram_override, override_count, override_updated_at, love_type_code
--     => 부여하는 네 칸 = enneagram_override, override_updated_at, override_count, love_type_code
--     부여하지 않는 칸: user_id, active_assessment_id, enneagram_inferred, enneagram_effective(생성 칸), attachment, retest_used, created_at, updated_at
--       (재검사가 쓰던 active_assessment_id · enneagram_inferred · attachment · retest_used 는 fn_complete_retest 만 쓴다. 앱의 옛 직접 UPDATE
--        src/services/settingsCore.ts:154 retestPersonality 는 이 마이그레이션을 적용하면 거부된다 - 앱 쪽 전환은 같은 68- 의 ui-builder 몫)
--   personality_profiles INSERT  src/services/personalityCore.ts:164 : user_id, active_assessment_id, enneagram_inferred, attachment, love_type_code (retest_used 는 기본 false) -> 통과.
--   couple_dissolutions: 앱이 쓰는 곳 0 (조사로 확인). SELECT 만 남는다.
--
-- 내부 결정 (지시서 표에서 정하지 않은 부분):
--   a) 해제 요청: couples 를 active · dissolving 에서 잠근다. 그 커플에 진행 중 해제(executed_at · cancelled_at 모두 null)가 있으면 23505,
--      진행 중이 없는데 active 도 아니면(없거나 dissolving 인데 해제 행이 없는 불일치) P0002. (표 그대로 active 만 잠그면 dissolving 커플의 재요청이 P0002 가 되어 23505 가 닿지 않는다.)
--   b) 해제 취소: 개시자 확인(42501)을 멱등 확인보다 먼저 한다. 이미 취소된 해제는 조용히 반환(멱등). 이미 실행된 해제는 22023. 없는 id 는 P0002.
--      탈퇴로 생긴 해제(reason = 'withdrawal')는 22023 으로 거부한다 - 탈퇴는 그대로인데 커플만 active 로 되돌아가는 불일치를 막는다. 그것은 fn_cancel_withdrawal 몫.
--   c) 탈퇴 요청: profiles 행을 잠근 뒤(없으면 P0002) 이미 deleted_at 이 있으면 그 purge_scheduled_at 을 그대로 돌려준다(멱등). 커플은 active 일 때만 같은 트랜잭션에서 해제 요청
--      (reason = 'withdrawal' - 002 의 dissolution_reason enum 값 unlink · withdrawal 중 기존 값). 이미 dissolving 이면 새 해제를 만들지 않는다.
--   d) 탈퇴 취소: deleted_at 이 없으면 아무것도 안 한다(멱등). 유예가 이미 끝났으면(purge_scheduled_at <= now()) 22023.
--      탈퇴로 생긴 해제(reason = 'withdrawal', 진행 중)만 취소하고 그 커플을 dissolving -> active 로 되돌린다. 직접 요청한 unlink 해제는 그대로 둔다.
--   e) 재검사 완료 반환: (out_assessment_id uuid, out_recovered boolean). out_recovered = true 이면 이미 있던 seq 2 행으로 마저 끝낸 것(인자의 결과는 쓰지 않음),
--      false 이면 이번 호출의 인자로 새로 만든 것.
--      복구 경로의 love_type_code 는 love_type_labels(enneagram_core, attachment 로 고유)에서 읽는다 - 서버에는 채점 엔진이 없고 그 표가 엔진의 코드 매핑과 같은 36칸이다(016).
--      재검사가 쓰는 칸: 오버라이드 null 은 enneagram_override 만 - override_count · override_updated_at 은 이력이라 그대로 둔다(옛 앱 코드와 같음).
--   f) 락 순서: 탈퇴 = profiles -> couples, 연결(026) = profiles -> couples, 해제 요청 · 취소 = couples 만. 서로 거꾸로 잡는 길이 없다.
--   g) 유예 7일은 서버가 now() + interval '7 days' 로 정한다. 함수에 기간 인자가 없다.
--
-- 파괴적 배치 함수(execute_dissolution · apply_retention_policy)는 이 파일이 부르지도 바꾸지도 않는다(R34-3).
-- 얼굴 임베딩 · 특징 벡터류 칸은 만들지 않는다.

-- ---------------------------------------------------------------------------
-- 1-1) 해제 요청
-- ---------------------------------------------------------------------------
create or replace function public.fn_request_dissolution()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_c    public.couples%rowtype;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'fn_request_dissolution: not authenticated' using errcode = '28000';
  end if;

  select * into v_c
    from public.couples c
   where c.status in ('active', 'dissolving')
     and (c.user_a_id = v_uid or c.user_b_id = v_uid)
   for update;

  if found and exists (
    select 1 from public.couple_dissolutions d
     where d.couple_id = v_c.id and d.executed_at is null and d.cancelled_at is null
  ) then
    raise exception 'fn_request_dissolution: dissolution already in progress' using errcode = '23505';
  end if;

  if not found or v_c.status <> 'active' then
    raise exception 'fn_request_dissolution: no active couple' using errcode = 'P0002';
  end if;

  insert into public.couple_dissolutions (couple_id, initiated_by, reason, purge_scheduled_at)
  values (v_c.id, v_uid, 'unlink', now() + interval '7 days')
  returning id into v_id;

  update public.couples c set status = 'dissolving' where c.id = v_c.id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1-2) 해제 취소
-- ---------------------------------------------------------------------------
create or replace function public.fn_cancel_dissolution(p_dissolution_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d     public.couple_dissolutions%rowtype;
begin
  if v_uid is null then
    raise exception 'fn_cancel_dissolution: not authenticated' using errcode = '28000';
  end if;

  -- couples 를 먼저 잠그려면 couple_id 를 알아야 한다: 읽고 -> couples 잠금 -> 해제 행 잠금(락 순서 couples -> 해제).
  select * into d from public.couple_dissolutions x where x.id = p_dissolution_id;
  if not found then
    raise exception 'fn_cancel_dissolution: dissolution not found' using errcode = 'P0002';
  end if;

  perform 1 from public.couples c where c.id = d.couple_id for update;
  select * into d from public.couple_dissolutions x where x.id = p_dissolution_id for update;
  if not found then
    raise exception 'fn_cancel_dissolution: dissolution not found' using errcode = 'P0002';
  end if;

  if d.initiated_by <> v_uid then
    raise exception 'fn_cancel_dissolution: only the initiator can cancel' using errcode = '42501';
  end if;

  if d.cancelled_at is not null then
    return; -- 멱등
  end if;
  if d.executed_at is not null then
    raise exception 'fn_cancel_dissolution: dissolution already executed' using errcode = '22023';
  end if;
  if d.reason = 'withdrawal' then
    raise exception 'fn_cancel_dissolution: cancel the withdrawal instead' using errcode = '22023';
  end if;

  update public.couple_dissolutions x set cancelled_at = now() where x.id = d.id;
  update public.couples c set status = 'active' where c.id = d.couple_id and c.status = 'dissolving';
end;
$$;

-- ---------------------------------------------------------------------------
-- 1-3) 탈퇴 요청
-- ---------------------------------------------------------------------------
create or replace function public.fn_request_withdrawal()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_p     public.profiles%rowtype;
  v_c     public.couples%rowtype;
  v_purge timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'fn_request_withdrawal: not authenticated' using errcode = '28000';
  end if;

  select * into v_p from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'fn_request_withdrawal: no profile' using errcode = 'P0002';
  end if;

  if v_p.deleted_at is not null then
    return v_p.purge_scheduled_at; -- 멱등
  end if;

  update public.profiles p set deleted_at = now(), purge_scheduled_at = v_purge where p.id = v_uid;

  select * into v_c
    from public.couples c
   where c.status = 'active' and (c.user_a_id = v_uid or c.user_b_id = v_uid)
   for update;
  if found then
    insert into public.couple_dissolutions (couple_id, initiated_by, reason, purge_scheduled_at)
    values (v_c.id, v_uid, 'withdrawal', v_purge);
    update public.couples c set status = 'dissolving' where c.id = v_c.id;
  end if;

  return v_purge;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1-4) 탈퇴 취소
-- ---------------------------------------------------------------------------
create or replace function public.fn_cancel_withdrawal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'fn_cancel_withdrawal: not authenticated' using errcode = '28000';
  end if;

  select * into v_p from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'fn_cancel_withdrawal: no profile' using errcode = 'P0002';
  end if;

  if v_p.deleted_at is null then
    return; -- 멱등
  end if;
  if v_p.purge_scheduled_at is not null and v_p.purge_scheduled_at <= now() then
    raise exception 'fn_cancel_withdrawal: grace period is over' using errcode = '22023';
  end if;

  -- 탈퇴로 생긴 진행 중 해제만 취소하고 그 커플을 되돌린다(직접 요청한 unlink 해제는 둔다).
  perform 1 from public.couples c
   where c.id in (select d.couple_id from public.couple_dissolutions d
                   where d.initiated_by = v_uid and d.reason = 'withdrawal'
                     and d.cancelled_at is null and d.executed_at is null)
   for update;

  update public.couples c set status = 'active'
   where c.status = 'dissolving'
     and c.id in (select d.couple_id from public.couple_dissolutions d
                   where d.initiated_by = v_uid and d.reason = 'withdrawal'
                     and d.cancelled_at is null and d.executed_at is null);

  update public.couple_dissolutions d set cancelled_at = now()
   where d.initiated_by = v_uid and d.reason = 'withdrawal'
     and d.cancelled_at is null and d.executed_at is null;

  update public.profiles p set deleted_at = null, purge_scheduled_at = null where p.id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1-5) 재검사 완료 - 채점 결과는 클라이언트(결정론 엔진, 절대 규칙 2)가 계산해 인자로 넘긴다.
--      한 트랜잭션: retest_used 잠금 확인(23505) -> seq 2 INSERT -> personality_profiles 갱신 -> profiles.mbti 갱신.
--      이미 seq 2 행이 있고 retest_used = false 이면(67- 이전 방식으로 끊긴 상태) 인자가 아니라 그 행의 값으로 마저 끝낸다. out_recovered = true.
-- ---------------------------------------------------------------------------
create or replace function public.fn_complete_retest(
  p_mbti              text,
  p_mbti_self_reported boolean,
  p_q1                public.quiz_choice,
  p_q2                public.quiz_choice,
  p_q3                public.quiz_choice,
  p_q4                public.quiz_choice,
  p_q5                public.quiz_choice,
  p_enneagram_core    smallint,
  p_big_o             smallint,
  p_big_c             smallint,
  p_big_e             smallint,
  p_big_a             smallint,
  p_big_n             smallint,
  p_stern_intimacy    smallint,
  p_stern_passion     smallint,
  p_stern_commitment  smallint,
  p_attach_anxiety    smallint,
  p_attach_avoidance  smallint,
  p_attachment        public.attachment_type,
  p_engine_version    text,
  p_love_type_code    text
)
returns table (out_assessment_id uuid, out_recovered boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_pp   public.personality_profiles%rowtype;
  v_a    public.personality_assessments%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'fn_complete_retest: not authenticated' using errcode = '28000';
  end if;

  select * into v_pp from public.personality_profiles pp where pp.user_id = v_uid for update;
  if not found then
    raise exception 'fn_complete_retest: no personality profile' using errcode = 'P0002';
  end if;
  if v_pp.retest_used then
    raise exception 'fn_complete_retest: retest already used' using errcode = '23505';
  end if;

  select * into v_a from public.personality_assessments a where a.user_id = v_uid and a.seq = 2;

  if found then
    -- 복구: 검사는 이미 1회 끝났다. 기존 seq 2 행의 값으로 마저 끝낸다.
    select l.code into v_code
      from public.love_type_labels l
     where l.enneagram_core = v_a.enneagram_core and l.attachment = v_a.attachment;
    if v_code is null then
      raise exception 'fn_complete_retest: no love type label for the existing assessment' using errcode = 'P0002';
    end if;

    update public.personality_profiles pp
       set active_assessment_id = v_a.id,
           enneagram_inferred   = v_a.enneagram_core,
           attachment           = v_a.attachment,
           love_type_code       = v_code,
           enneagram_override   = null,
           retest_used          = true
     where pp.user_id = v_uid;

    update public.profiles p set mbti = v_a.mbti where p.id = v_uid;

    out_assessment_id := v_a.id;
    out_recovered := true;
    return next;
    return;
  end if;

  insert into public.personality_assessments (
    user_id, seq, mbti, mbti_self_reported, q1, q2, q3, q4, q5,
    enneagram_core, big_o, big_c, big_e, big_a, big_n,
    stern_intimacy, stern_passion, stern_commitment, attach_anxiety, attach_avoidance,
    attachment, engine_version
  ) values (
    v_uid, 2, p_mbti, coalesce(p_mbti_self_reported, true), p_q1, p_q2, p_q3, p_q4, p_q5,
    p_enneagram_core, p_big_o, p_big_c, p_big_e, p_big_a, p_big_n,
    p_stern_intimacy, p_stern_passion, p_stern_commitment, p_attach_anxiety, p_attach_avoidance,
    p_attachment, p_engine_version
  ) returning * into v_a;

  update public.personality_profiles pp
     set active_assessment_id = v_a.id,
         enneagram_inferred   = v_a.enneagram_core,
         attachment           = v_a.attachment,
         love_type_code       = p_love_type_code,
         enneagram_override   = null,
         retest_used          = true
   where pp.user_id = v_uid;

  update public.profiles p set mbti = v_a.mbti where p.id = v_uid;

  out_assessment_id := v_a.id;
  out_recovered := false;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1-6) 트리거 함수: onboarding_step 감소 거부 (R38-3 "되돌리지 않음"을 서버가 강제). 모든 역할에 걸린다.
-- ---------------------------------------------------------------------------
create or replace function public.tg_profiles_onboarding_step_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarding_step < old.onboarding_step then
    raise exception 'profiles.onboarding_step cannot decrease (% -> %)', old.onboarding_step, new.onboarding_step
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger tg_profiles_onboarding_step_guard
  before update of onboarding_step on public.profiles
  for each row execute function public.tg_profiles_onboarding_step_guard();

-- ---------------------------------------------------------------------------
-- 2) 실행 권한 (SCHEMA 10-0): 클라이언트 RPC 다섯은 authenticated 만, 트리거 함수는 모두 회수.
--    025 이후 새 함수는 권한 없이 태어나지만 명시적으로 다시 회수한다.
-- ---------------------------------------------------------------------------
revoke all on function public.fn_request_dissolution()                from public, anon, authenticated, service_role;
revoke all on function public.fn_cancel_dissolution(uuid)             from public, anon, authenticated, service_role;
revoke all on function public.fn_request_withdrawal()                 from public, anon, authenticated, service_role;
revoke all on function public.fn_cancel_withdrawal()                  from public, anon, authenticated, service_role;
revoke all on function public.fn_complete_retest(
  text, boolean, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  public.attachment_type, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.tg_profiles_onboarding_step_guard()     from public, anon, authenticated, service_role;

grant execute on function public.fn_request_dissolution()    to authenticated;
grant execute on function public.fn_cancel_dissolution(uuid) to authenticated;
grant execute on function public.fn_request_withdrawal()     to authenticated;
grant execute on function public.fn_cancel_withdrawal()      to authenticated;
grant execute on function public.fn_complete_retest(
  text, boolean, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  public.attachment_type, text, text
) to authenticated;

comment on function public.fn_request_dissolution() is
  '내 active 커플의 연결 해제를 요청한다(사용자 권한 호출). 유예 7일은 서버가 정한다. 반환=couple_dissolutions.id. 비로그인 28000, 진행 중 해제 23505, active 커플 없음 P0002 (027).';
comment on function public.fn_cancel_dissolution(uuid) is
  '해제 요청을 개시자가 취소한다. 개시자 아님 42501, 없는 id P0002, 이미 실행됨 · 탈퇴로 생긴 해제 22023, 이미 취소됨은 조용히 반환(멱등) (027).';
comment on function public.fn_request_withdrawal() is
  '회원 탈퇴를 요청한다: profiles.deleted_at · purge_scheduled_at(7일, 서버). 커플이 active 면 같은 트랜잭션에서 사유 withdrawal 로 해제 요청. 반환=purge_scheduled_at. 이미 요청됨은 그대로 반환(멱등) (027).';
comment on function public.fn_cancel_withdrawal() is
  '탈퇴 유예 중 취소: deleted_at · purge_scheduled_at 을 null 로, 탈퇴로 생긴 해제가 있으면 함께 취소하고 커플을 active 로. 유예 끝남 22023, 요청 없으면 조용히 반환(멱등) (027).';
comment on function public.fn_complete_retest(
  text, boolean, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice, public.quiz_choice,
  smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint,
  public.attachment_type, text, text
) is
  '재검사 완료(한 트랜잭션): seq 2 INSERT + personality_profiles 갱신 + profiles.mbti 갱신. 이미 사용 23505. 기존 seq 2 행이 있고 retest_used=false 면 그 행의 값으로 마저 끝내고 out_recovered=true (027).';

-- ---------------------------------------------------------------------------
-- 3) couple_dissolutions: INSERT · UPDATE 정책 삭제, 쓰기 권한 회수. SELECT 정책(dissolutions_select)은 그대로 - 상대도 진행 중 해제를 본다.
--    service_role 은 건드리지 않는다.
-- ---------------------------------------------------------------------------
drop policy dissolutions_insert on public.couple_dissolutions;
drop policy dissolutions_update on public.couple_dissolutions;

revoke insert, update, delete on public.couple_dissolutions from anon, authenticated;
revoke insert (id, couple_id, initiated_by, reason, requested_at, purge_scheduled_at, cancelled_at, executed_at, partner_notified_at),
       update (id, couple_id, initiated_by, reason, requested_at, purge_scheduled_at, cancelled_at, executed_at, partner_notified_at)
  on public.couple_dissolutions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) profiles UPDATE: 테이블 단위 회수 -> 일곱 칸만 칸 단위 부여. (칸 단위로 따로 부여된 것이 있으면 함께 회수한다 - 없으면 무해.)
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
revoke update (
  id, display_name, gender, birth_date, mbti, onboarding_step,
  photo_sync_enabled, photo_scan_completed_at, photo_scan_cursor,
  biometric_consent_at, biometric_consent_revoked_at, reference_photo_path,
  terms_agreed_at, privacy_agreed_at, ai_usage_agreed_at,
  deleted_at, purge_scheduled_at, created_at, updated_at, marketing_agreed_at
) on public.profiles from anon, authenticated;

grant update (
  display_name, gender, onboarding_step, marketing_agreed_at,
  biometric_consent_at, biometric_consent_revoked_at, reference_photo_path
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 5) profiles INSERT: 가입 INSERT 로 탈퇴 칸을 채울 수 없다.
-- ---------------------------------------------------------------------------
alter policy profiles_insert on public.profiles
  with check (id = auth.uid() and deleted_at is null and purge_scheduled_at is null);

-- ---------------------------------------------------------------------------
-- 6) personality_profiles: UPDATE 는 오버라이드 경로의 네 칸만, INSERT 는 retest_used = false 일 때만.
--    enneagram_effective 는 생성 칸이라 어느 쪽으로도 쓰지 않는다.
-- ---------------------------------------------------------------------------
revoke update on public.personality_profiles from anon, authenticated;
revoke update (
  user_id, active_assessment_id, enneagram_inferred, enneagram_override, override_updated_at, override_count,
  enneagram_effective, attachment, love_type_code, retest_used, created_at, updated_at
) on public.personality_profiles from anon, authenticated;

grant update (enneagram_override, override_updated_at, override_count, love_type_code)
  on public.personality_profiles to authenticated;

alter policy pprofiles_write on public.personality_profiles
  with check (user_id = auth.uid() and retest_used = false);
