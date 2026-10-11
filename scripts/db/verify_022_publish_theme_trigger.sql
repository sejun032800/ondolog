-- 022 발행 시 테마 복사 트리거 실증 (SCHEMA §9-D-9 "테마 복사 트리거" 행, §9-C-6 방식).
-- 실행: 022를 원격에 적용한 뒤, 사람의 확인을 거쳐 메인 세션이 실행한다. 파일 전체를 한 번에 실행.
-- 실행 도구: Supabase MCP execute_sql. 마지막 select 한 개가 결과 표다.
--
-- 방식 (§9-D-9):
--   * 진짜 public.fn_issues_theme_on_publish 와 public.fn_issues_theme_immutable 를
--     `like public.issues` 임시 테이블에 건다. 함수 사본·문자열 치환은 쓰지 않는다.
--   * couple_id 는 원격 public.couples 의 실제 행에서 읽어 쓴다(읽기만).
--   * 초안 행의 theme 를 그 커플의 magazine_theme 와 다른 값으로 먼저 넣고, published_at 을 채운다.
--     -> 커플 값으로 바뀌어야 한다. 이어 발행된 행의 theme 변경 -> 예외여야 한다.
--   * 원격 public.couples 가 0행이면 실증하지 않고 그 사실만 출력한다(48- C 로 미룸).
--     임시 couples 를 만들어 함수 사본을 거는 방식은 쓰지 않는다.
--
-- 쓰기: 임시 테이블(t_issues, t_report)뿐이다. 원격 실제 테이블은 읽기만 한다. 세션이 끝나면 사라진다.

create temp table t_report (
  n          serial,
  check_name text,
  expected   text,
  actual     text,
  verdict    text
);

create temp table t_issues (like public.issues including defaults);
-- issue_number 는 022 적용 후 public.issues 에서 nullable 이라 like 가 그대로 복사한다.
-- 022 적용 전에 돌리면 아래 do 블록의 존재 확인에서 멈추고 그 사실을 출력한다.

do $$
declare
  v_couple     uuid;
  v_theme      text;
  v_other      text;
  v_other2     text;
  v_issue      uuid := gen_random_uuid();
  v_got        text;
  v_err        text;
begin
  if to_regproc('public.fn_issues_theme_on_publish') is null
     or to_regproc('public.fn_issues_theme_immutable') is null then
    insert into t_report (check_name, expected, actual, verdict)
    values ('전제: 함수 존재', 'public.fn_issues_theme_on_publish / _immutable 존재',
            '없음 - 022(또는 021)가 적용되지 않았다. 실증하지 않고 끝낸다', 'STOPPED');
    return;
  end if;

  select id, magazine_theme into v_couple, v_theme
    from public.couples order by created_at limit 1;

  if v_couple is null then
    insert into t_report (check_name, expected, actual, verdict)
    values ('전제: 원격 couples 행', '1행 이상',
            '0행 - 실증하지 않는다. 48- C(로컬 supabase start 또는 브랜치)로 미룬다 (§9-D-9)', 'DEFERRED');
    return;
  end if;

  -- 커플 값과 다른 값 둘(초안 초기값, 발행 후 변경 시도값)
  select t into v_other  from unnest(array['basic','hip','neon','lovely','night','ondol']) t
   where t <> v_theme order by t limit 1;
  select t into v_other2 from unnest(array['basic','hip','neon','lovely','night','ondol']) t
   where t <> v_theme and t <> v_other order by t limit 1;

  insert into t_report (check_name, expected, actual, verdict)
  values ('입력: 원격 couples 실제 행(읽기)', 'couple_id 와 magazine_theme 를 읽음',
          'couple=' || v_couple || ' magazine_theme=' || v_theme, 'INFO');

  -- 실제 함수 두 개를 임시 테이블에 건다. 이름 순서는 실제와 같다(immutable -> on_publish).
  create trigger tg_a_immutable before update on t_issues
    for each row execute function public.fn_issues_theme_immutable();
  create trigger tg_b_on_publish before update on t_issues
    for each row execute function public.fn_issues_theme_on_publish();

  -- 초안: theme 를 커플 값과 다른 값으로 먼저 넣는다
  insert into t_issues (id, couple_id, issue_type, issue_number, period_start, period_end, theme, published_at)
  values (v_issue, v_couple, 'monthly', null, current_date, current_date, v_other, null);

  select theme into v_got from t_issues where id = v_issue;
  insert into t_report (check_name, expected, actual, verdict)
  values ('초안 입력 상태', 'theme=' || v_other || ' (커플 값 ' || v_theme || ' 과 다름)',
          'theme=' || v_got, case when v_got = v_other then 'OK' else 'FAIL' end);

  -- 발행: published_at 을 채운다 -> 커플 값으로 바뀌어야 한다
  update t_issues set issue_number = 1, published_at = now() where id = v_issue;
  select theme into v_got from t_issues where id = v_issue;
  insert into t_report (check_name, expected, actual, verdict)
  values ('발행 시 theme 복사', 'theme=' || v_theme || ' (실제 커플의 magazine_theme)',
          'theme=' || v_got, case when v_got = v_theme then 'OK' else 'FAIL' end);

  -- 발행된 행의 theme 변경 -> 예외여야 한다
  begin
    update t_issues set theme = v_other2 where id = v_issue;
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  insert into t_report (check_name, expected, actual, verdict)
  values ('발행 후 theme 변경 거부', '예외, 메시지에 issue ' || v_issue,
          coalesce('예외: ' || v_err, '예외 없음 (결함)'),
          case when v_err is not null and position(v_issue::text in v_err) > 0 then 'OK' else 'FAIL' end);
end
$$;

select n, check_name, expected, actual, verdict from t_report order by n;
