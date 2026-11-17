-- 80-m1 (ROADMAP R114-3 ② · R115-4 · R112-3): 앱 오류 기록 - 우리 서버 · 사람을 가릴 수 없는 하루 집계 · 외부 서비스 0.
--
-- 표 하나(app_error_daily): 행 = 묶음(KST 하루 · 화면 이름 · 오류 종류 · 앱 버전 · 플랫폼), 칸 = 건수뿐.
--   사용자 id · 커플 id · 기기 id · IP · 메시지 · 스택 · 자유 글 칸 0. 받는 값은 모두 정해진 목록 · 형식 안의 짧은 글자다.
-- 넣기는 RPC 하나(log_app_error)로만 - 로그인 전(온보딩) 오류도 받도록 anon · authenticated 모두 실행 가능.
--   화면 · 종류는 허용 목록 밖이면 'other', 버전 · 플랫폼은 형식 · 길이 검사(밖이면 'other'), 건수는 1~1000으로 자른다.
--   날짜는 서버가 정한다(지금의 KST 날짜) - 앱이 날짜를 보내지 않는다.
--   묶음 하나의 하루 건수 상한 10,000 - 넘으면 더하지 않는다(폭주 · 악용 방어).
-- 표 직접 읽기 · 쓰기: 앱 역할(anon · authenticated) 0. 운영 키(service_role)만 읽기 · 지우기(월요일 정리 - 90일 지난 행).
-- 이 파일이 하지 않는 것: 기존 테이블 · 함수 변경 · 데모 응답 표 · 트리거 · 외부 호출.

-- ---------------------------------------------------------------------------
-- 1) 하루 집계 표
-- ---------------------------------------------------------------------------
create table public.app_error_daily (
  day date not null,
  screen text not null check (char_length(screen) between 1 and 40),
  kind text not null check (char_length(kind) between 1 and 40),
  app_version text not null check (char_length(app_version) between 1 and 20),
  platform text not null check (platform in ('android', 'ios', 'web', 'other')),
  count integer not null default 0 check (count between 0 and 10000),
  primary key (day, screen, kind, app_version, platform)
);

comment on table public.app_error_daily is '80-m1 앱 오류 하루 집계(사람 · 기기 · 내용 칸 0). 넣기는 log_app_error 로만. 90일 지난 행은 월요일 정리(purgeWithdrawn)가 지운다.';

alter table public.app_error_daily enable row level security;
-- 정책 0: 앱 역할은 RLS 로도 막히고, 권한 자체도 없다(아래 revoke). service_role 은 RLS 를 건너뛴다.

revoke all on public.app_error_daily from public, anon, authenticated, service_role;
grant select, delete on public.app_error_daily to service_role;

-- ---------------------------------------------------------------------------
-- 2) 넣기 RPC - 허용 목록 · 형식 검사 · 상한. 돌려주는 값 없음(무엇이 들어갔는지 앱이 알 필요 없음).
-- ---------------------------------------------------------------------------
create or replace function public.log_app_error(p_screen text, p_kind text, p_version text, p_platform text, p_count integer default 1)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_screen text;
  v_kind text;
  v_version text;
  v_platform text;
  v_count integer;
begin
  -- 화면 이름 = 앱 라우트 이름(web/src/app/routes.ts ALL_ROUTES) + 'unknown'. 앱 시험이 두 목록이 같은지 본다.
  v_screen := case when p_screen in (
      'intro', 'basic', 'mbti', 'quiz', 'brief', 'share-card', 'consent', 'underage', 'auth', 'callback', 'detail', 'invite', 'start-date',
      'main', 'chat', 'feed', 'magazine', 'settings',
      'couple-invite', 'start-date-recheck', 'date-detail', 'stop-edit',
      'settings-profile', 'settings-couple', 'settings-unlink', 'settings-personality', 'settings-result', 'retest',
      'settings-privacy', 'settings-about', 'settings-withdraw', 'withdraw-cancel',
      'sky', 'push-permission', 'settings-notify', 'nickname-recheck',
      'unknown'
    ) then p_screen else 'other' end;
  -- 오류 종류 = 앱이 보내는 고정 값(web/src/errorLog/errorLogRules.ts ERROR_KINDS).
  v_kind := case when p_kind in (
      'uncaught', 'unhandled_rejection', 'render_crash',
      'upload_fail', 'queue_giveup', 'push_register_fail', 'cache_fail', 'auth_return_fail'
    ) then p_kind else 'other' end;
  v_version := case when p_version is not null and char_length(p_version) <= 20 and p_version ~ '^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$'
    then p_version else 'other' end;
  v_platform := case when p_platform in ('android', 'ios', 'web') then p_platform else 'other' end;
  v_count := greatest(1, least(coalesce(p_count, 1), 1000));

  insert into public.app_error_daily as d (day, screen, kind, app_version, platform, count)
  values ((now() at time zone 'Asia/Seoul')::date, v_screen, v_kind, v_version, v_platform, least(v_count, 10000))
  on conflict (day, screen, kind, app_version, platform)
  do update set count = least(d.count + excluded.count, 10000)
  where d.count < 10000;
end;
$$;

revoke execute on function public.log_app_error(text, text, text, text, integer) from public;
grant execute on function public.log_app_error(text, text, text, text, integer) to anon, authenticated;
