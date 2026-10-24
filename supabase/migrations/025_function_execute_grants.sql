-- 함수 실행 권한 최소화 + issues_public 권한 회수 + search_path 고정 (025).
-- 근거: SCHEMA 10-0, ROADMAP R33-1 · R33-2. 위임 `60-` 1부.
-- 001~024는 이미 적용된 것이라 고치지 않는다.
--
-- 발견: 새 함수는 EXECUTE를 PUBLIC에 받고, Supabase 기본 권한(postgres 소유 public 스키마)은 anon·authenticated·service_role에도 준다.
-- 그래서 공개 anon 키만으로 /rest/v1/rpc/ 를 통해 definer 배치 함수(expire_stories · apply_retention_policy · execute_dissolution)를 부를 수 있었다.
--
-- 이 파일이 하는 일 (정책·RLS·테이블 권한(024 열 권한 포함)·함수 동작은 바꾸지 않는다):
--   1~5) 함수 14개의 EXECUTE 권한을 SCHEMA 10-0 분류대로 다시 정한다. 각 묶음 머리에 "부르는 곳"을 적었다.
--   6)   새 함수의 기본 권한 회수 (postgres 소유, public 스키마).
--   7)   issues_public 뷰: anon 전부 회수, authenticated는 SELECT만.
--   8)   fn_delete_own_entry 정의를 다시 쓴다 (본문 동작 변경 없음).
-- 새 테이블이 없으므로 RLS 설정은 없다.
--
-- 트리거 함수의 EXECUTE: 트리거가 불릴 때는 EXECUTE를 검사하지 않는다(CREATE TRIGGER 때만 검사). 그래서 모든 클라이언트 역할에서
-- 회수해도 트리거는 그대로 동작한다. 마이그레이션은 소유자(postgres)가 실행하므로 이후 트리거를 만들 때도 막히지 않는다.

-- ---------------------------------------------------------------------------
-- 1) 배치 전용 (pg_cron이 소유자 postgres 권한으로 부른다). Edge Function·운영자 명령은 부르지 않으므로 service_role도 회수.
--    expire_stories()          : cron expire-stories      */15 * * * *
--    apply_retention_policy()  : cron retention-policy    0 4 * * *
--    execute_dissolution(uuid) : cron execute-dissolutions 0 5 * * *
-- ---------------------------------------------------------------------------
revoke execute on function public.expire_stories()          from public, anon, authenticated, service_role;
revoke execute on function public.apply_retention_policy()  from public, anon, authenticated, service_role;
revoke execute on function public.execute_dissolution(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) RLS 헬퍼 - authenticated만 (헬퍼를 쓰는 정책은 전부 to authenticated라 anon이 평가할 일이 없다. service_role은 RLS를 우회한다)
--    is_couple_member(uuid)         : 정책 다수 + 저장소 정책 + fn_issue_progress · fn_delete_own_entry 본문
--    is_entry_visible(uuid,boolean) : data_entries.entries_select
--    partner_id()                   : profiles · personality_assessments · personality_profiles 의 select 정책
--    current_couple_id()            : 지금 부르는 곳 없음. SCHEMA 10-1이 헬퍼로 정의했고 011이 authenticated에만 부여했다. 문서 그대로 둔다
-- ---------------------------------------------------------------------------
revoke execute on function public.is_couple_member(uuid)          from public, anon, authenticated, service_role;
revoke execute on function public.is_entry_visible(uuid, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.partner_id()                    from public, anon, authenticated, service_role;
revoke execute on function public.current_couple_id()             from public, anon, authenticated, service_role;
grant  execute on function public.is_couple_member(uuid)          to authenticated;
grant  execute on function public.is_entry_visible(uuid, boolean) to authenticated;
grant  execute on function public.partner_id()                    to authenticated;
grant  execute on function public.current_couple_id()             to authenticated;

-- ---------------------------------------------------------------------------
-- 3) 클라이언트 RPC - authenticated만
--    fn_issue_progress()       : src/services/magazineApi.ts
--    fn_delete_own_entry(uuid) : src/services/dateRecordApi.ts (권한은 8)에서 정의와 함께 다시 쓴다)
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_issue_progress() from public, anon, authenticated, service_role;
grant  execute on function public.fn_issue_progress() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) 발행 경로 - service_role만 (scripts/ops/supabaseOps.ts 의 rpc('fn_publish_issue'))
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_publish_issue(uuid) from public, anon, authenticated;
grant  execute on function public.fn_publish_issue(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5) 트리거 전용 - 직접 부르는 곳 없음. 모든 클라이언트 역할에서 회수
--    tg_set_updated_at()          : 10개 테이블의 *_updated 트리거
--    unlock_on_upgrade()          : couples.tg_unlock_on_upgrade (definer)
--    fn_issues_theme_immutable()  : issues.tg_issues_theme_immutable
--    fn_issues_theme_on_publish() : issues.tg_issues_theme_on_publish
-- search_path 미고정이던 3개(tg_set_updated_at · fn_issues_theme_immutable · fn_issues_theme_on_publish)에 고정한다.
-- 본문은 이미 public. 접두사를 쓰거나 내장 함수만 쓰므로 동작이 바뀌지 않는다 (ALTER FUNCTION - 본문을 건드리지 않는다).
-- ---------------------------------------------------------------------------
alter function public.tg_set_updated_at()          set search_path = public;
alter function public.fn_issues_theme_immutable()  set search_path = public;
alter function public.fn_issues_theme_on_publish() set search_path = public;
revoke execute on function public.tg_set_updated_at()          from public, anon, authenticated, service_role;
revoke execute on function public.unlock_on_upgrade()          from public, anon, authenticated, service_role;
revoke execute on function public.fn_issues_theme_immutable()  from public, anon, authenticated, service_role;
revoke execute on function public.fn_issues_theme_on_publish() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) 새 함수의 기본 권한 회수.
--    마이그레이션(supabase db push)은 postgres 역할로 실행되고, 원격의 기본 권한 항목(pg_default_acl)도 postgres 소유 · public 스키마다
--    (anon · authenticated · service_role 에 EXECUTE). 그래서 for role postgres 를 명시한다.
--    service_role 항목은 남긴다 - 이번 범위가 public · anon · authenticated 회수이기 때문이다.
--    supabase_admin 소유 항목(확장 설치용)은 postgres 가 바꿀 수 없고, 이 프로젝트의 마이그레이션이 만드는 함수에는 걸리지 않는다.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) issues_public: anon 전부 회수, authenticated 는 SELECT 만 (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN 회수).
--    뷰는 security_invoker 이고 쓰기는 issues 권한에서 이미 막히지만, 뷰 자체에도 남기지 않는다.
--    024의 issues 열 권한과 정책은 건드리지 않는다. service_role 권한도 그대로다.
-- ---------------------------------------------------------------------------
revoke all on public.issues_public from public, anon;
revoke all on public.issues_public from authenticated;
grant select on public.issues_public to authenticated;

-- ---------------------------------------------------------------------------
-- 8) fn_delete_own_entry: 정의를 다시 쓴다. 동작 변경 없음.
--    SCHEMA 9-E 는 본문 테이블 이름에 public. 접두사를 붙이라고 했으나, 원격 정의를 확인해 보니 023 본문의 테이블 참조는
--    이미 모두 public. 접두사가 붙어 있다(data_entries · dates · is_couple_member). 그래서 아래 본문은 023과 글자 그대로 같다.
-- ---------------------------------------------------------------------------
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

revoke all on function public.fn_delete_own_entry(uuid) from public, anon, authenticated, service_role;
grant execute on function public.fn_delete_own_entry(uuid) to authenticated;

comment on function public.fn_delete_own_entry(uuid) is
  '작성자 본인의 data_entries 소프트 삭제 + 붙은 dates 파생 칸 재계산. true=지움, false=이미 지워져 있어 변화 없음. 작성자 아님/커플 아님/없음/비로그인은 예외. 저장소 원본은 지우지 않는다.';
