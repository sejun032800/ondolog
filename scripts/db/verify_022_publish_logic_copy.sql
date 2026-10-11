-- 022 fn_publish_issue 논리 확인 (SCHEMA §9-D-9 "fn_publish_issue 논리" 행, 방식 A).
-- 실행: 022를 원격에 적용한 뒤, 사람의 확인을 거쳐 메인 세션이 실행한다. 파일 전체를 한 번에 실행.
-- 실행 도구: Supabase MCP execute_sql. 마지막 select 한 개가 결과 표다.
--
-- ############################################################################
-- #  이것은 "논리 확인"이며 실제 함수의 증명이 아니다.                         #
-- #  시험 대상은 pg_temp 사본이다. 실제 public.fn_publish_issue, FK, RLS,      #
-- #  security invoker 의미, 동시 발행 잠금은 증명하지 못한다 -> 48- C.          #
-- ############################################################################
--
-- 사본 만드는 법 (손으로 고치지 않는다, 기계적 치환 한 번뿐):
--   pg_get_functiondef('public.fn_publish_issue'::regproc) 의 문자열에서
--   replace(def, 'public.', 'pg_temp.')  -- 이 한 줄이 치환 명령 전부다
--   (sed 로 쓰면 s/public\./pg_temp./g). 아래 do 블록의 v_def 한 줄이 그것이다.
--   원본은 022 본문이 원격에 적용된 결과(함수 정의)다. 치환 뒤 'public.' 가 하나도 남지 않았는지,
--   사본이 pg_temp 테이블을 가리키는지 첫 두 행에서 확인한다.
--   사본에는 §9-D-4 테마 트리거를 걸지 않는다(테마는 verify_022_publish_theme_trigger.sql 담당).
--
-- 쓰기: pg_temp 의 임시 테이블·임시 함수뿐이다. 원격 실제 테이블은 건드리지 않는다
--   (pg_get_functiondef 와 `like public.X` 는 카탈로그 읽기). 픽스처 id 는 전부 임시 테이블 안의
--   합성 값이며 FK 가 없다. 세션이 끝나면 사라진다.
--
-- 확인 범위(§9-D-9): 분기, 번호, is_trial, feature_count 논리.

create temp table t_report (
  n          serial,
  check_name text,
  expected   text,
  actual     text,
  verdict    text
);

-- 사본이 읽고 쓰는 테이블. 이름이 실제와 같고 pg_temp 에 있다.
create temp table issues     (like public.issues     including defaults including constraints);
create temp table couples    (like public.couples    including defaults);
create temp table corners    (like public.corners    including defaults including constraints);
create temp table dates      (like public.dates      including defaults);
create temp table ops_alerts (like public.ops_alerts including defaults);

create function pg_temp.rec(p_name text, p_expected text, p_actual text, p_ok boolean)
returns void language plpgsql as $f$
begin
  insert into pg_temp.t_report (check_name, expected, actual, verdict)
  values (p_name, p_expected, p_actual, case when p_ok then 'OK' else 'FAIL' end);
end
$f$;

create function pg_temp.try_publish(p_id uuid)
returns text language plpgsql as $f$
begin
  perform pg_temp.fn_publish_issue(p_id);
  return 'no exception';
exception when others then
  return sqlerrm;
end
$f$;

do $$
declare
  v_def   text;
  v_a     uuid := gen_random_uuid();  -- active 커플
  v_b     uuid := gen_random_uuid();  -- active 커플(다른 커플)
  v_n     uuid := gen_random_uuid();  -- active 아님
  v_da1   uuid := gen_random_uuid();
  v_da2   uuid := gen_random_uuid();
  v_da3   uuid := gen_random_uuid();
  v_db1   uuid := gen_random_uuid();
  v_i1    uuid := gen_random_uuid();  -- A monthly, 첫 발행
  v_i2    uuid := gen_random_uuid();  -- A monthly, 두 번째
  v_i3    uuid := gen_random_uuid();  -- A weekly
  v_i4    uuid := gen_random_uuid();  -- A monthly, 경보 있음 -> 해소 후 발행
  v_i5    uuid := gen_random_uuid();  -- A monthly, ready 코너 없음
  v_ib    uuid := gen_random_uuid();  -- B monthly
  v_in    uuid := gen_random_uuid();  -- 비활성 커플
  v_alert uuid := gen_random_uuid();
  v_x     uuid := gen_random_uuid();  -- 없는 id
  v_res   text;
  v_s     text;
begin
  if to_regproc('public.fn_publish_issue') is null then
    insert into t_report (check_name, expected, actual, verdict)
    values ('전제: 함수 존재', 'public.fn_publish_issue 존재',
            '없음 - 022가 적용되지 않았다. 실증하지 않고 끝낸다', 'STOPPED');
    return;
  end if;

  -- ── 사본 생성: 기계적 치환 한 줄 ──────────────────────────────
  v_def := replace(pg_get_functiondef('public.fn_publish_issue'::regproc), 'public.', 'pg_temp.');
  execute v_def;

  perform pg_temp.rec('사본: 치환 뒤 남은 public.', '0',
    (length(v_def) - length(replace(v_def, 'public.', '')))::text,
    position('public.' in v_def) = 0);
  perform pg_temp.rec('사본: pg_temp 테이블을 가리킴', 'pg_temp.issues 포함',
    case when position('pg_temp.issues' in v_def) > 0 then '포함' else '없음' end,
    position('pg_temp.issues' in v_def) > 0);

  -- ── 픽스처(임시 테이블에만) ───────────────────────────────────
  insert into pg_temp.couples (id, user_a_id, invite_code, status) values
    (v_a, gen_random_uuid(), 'AAAAAA', 'active'),
    (v_b, gen_random_uuid(), 'BBBBBB', 'active'),
    (v_n, gen_random_uuid(), 'NNNNNN', 'dissolving');

  insert into pg_temp.dates (id, couple_id, date_on) values
    (v_da1, v_a, current_date - 4), (v_da2, v_a, current_date - 3),
    (v_da3, v_a, current_date - 2), (v_db1, v_b, current_date - 4);

  insert into pg_temp.issues (id, couple_id, issue_type, issue_number, period_start, period_end, published_at) values
    (v_i1, v_a, 'monthly', null, current_date,     current_date,     null),
    (v_i2, v_a, 'monthly', null, current_date + 1, current_date + 1, null),
    (v_i3, v_a, 'weekly',  null, current_date,     current_date,     null),
    (v_i4, v_a, 'monthly', null, current_date + 2, current_date + 2, null),
    (v_i5, v_a, 'monthly', null, current_date + 3, current_date + 3, null),
    (v_ib, v_b, 'monthly', null, current_date,     current_date,     null),
    (v_in, v_n, 'monthly', null, current_date,     current_date,     null);

  insert into pg_temp.corners (couple_id, issue_id, corner_type, period_start, period_end, content, source_date_ids, status, skip_reason) values
    (v_a, v_i1, 'date_archive',  current_date, current_date, '{"k":1}', array[v_da1, v_da2], 'ready',   null),
    (v_a, v_i1, 'love_dna',      current_date, current_date, '{"k":1}', array[v_da3],        'ready',   null),
    (v_a, v_i1, 'league_weekly', current_date, current_date, '{}',      '{}',                'skipped', 'insufficient_input'),
    (v_a, v_i2, 'date_archive',  current_date, current_date, '{"k":1}', array[v_da1],        'ready',   null),
    (v_a, v_i3, 'love_dna',      current_date, current_date, '{"k":1}', '{}',                'ready',   null),
    (v_a, v_i4, 'date_archive',  current_date, current_date, '{"k":1}', array[v_da2],        'ready',   null),
    (v_a, v_i5, 'date_archive',  current_date, current_date, '{}',      array[v_da3],        'pending', null),
    -- B 의 코너가 A 의 날짜(v_da3)를 가리켜도 A 의 날짜는 오르지 않아야 한다(couple_id 범위)
    (v_b, v_ib, 'date_archive',  current_date, current_date, '{"k":1}', array[v_db1, v_da3], 'ready',   null),
    (v_n, v_in, 'love_dna',      current_date, current_date, '{"k":1}', '{}',                'ready',   null);

  insert into pg_temp.ops_alerts (id, kind, couple_id, issue_id, detail) values
    (v_alert, 'usage_over', v_a, v_i4, '{}');

  -- ── P1: 첫 발행 ───────────────────────────────────────────────
  v_res := pg_temp.try_publish(v_i1);
  perform pg_temp.rec('P1 첫 발행 호출', 'no exception', v_res, v_res = 'no exception');

  select 'issue_number=' || issue_number || ' is_trial=' || is_trial || ' published=' || (published_at is not null)
    into v_s from pg_temp.issues where id = v_i1;
  perform pg_temp.rec('P1 번호·is_trial', 'issue_number=1 is_trial=true published=true', v_s,
    v_s = 'issue_number=1 is_trial=true published=true');

  select 'ready->published ' || count(*) filter (where status = 'published' and corner_type in ('date_archive','love_dna'))
         || ', skipped 유지 ' || count(*) filter (where status = 'skipped')
    into v_s from pg_temp.corners where issue_id = v_i1;
  perform pg_temp.rec('P1 코너 상태', 'ready->published 2, skipped 유지 1', v_s,
    v_s = 'ready->published 2, skipped 유지 1');

  select 'da1=' || d1.feature_count || (case when d1.last_featured_at is not null then '+ts' else '' end)
      || ' da2=' || d2.feature_count || (case when d2.last_featured_at is not null then '+ts' else '' end)
      || ' da3=' || d3.feature_count || (case when d3.last_featured_at is not null then '+ts' else '' end)
    into v_s from pg_temp.dates d1, pg_temp.dates d2, pg_temp.dates d3
   where d1.id = v_da1 and d2.id = v_da2 and d3.id = v_da3;
  perform pg_temp.rec('P1 feature_count (date_archive 코너의 날짜만)', 'da1=1+ts da2=1+ts da3=0', v_s,
    v_s = 'da1=1+ts da2=1+ts da3=0');

  -- ── P2: 같은 커플·같은 유형 두 번째 ───────────────────────────
  v_res := pg_temp.try_publish(v_i2);
  select 'issue_number=' || issue_number || ' is_trial=' || is_trial into v_s from pg_temp.issues where id = v_i2;
  perform pg_temp.rec('P2 번호 증가·is_trial 해제', 'no exception / issue_number=2 is_trial=false',
    v_res || ' / ' || v_s, v_res = 'no exception' and v_s = 'issue_number=2 is_trial=false');

  select 'da1=' || (select feature_count from pg_temp.dates where id = v_da1)
      || ' da2=' || (select feature_count from pg_temp.dates where id = v_da2)
    into v_s;
  perform pg_temp.rec('P2 feature_count 누적', 'da1=2 da2=1', v_s, v_s = 'da1=2 da2=1');

  -- ── P3: 다른 유형은 번호가 따로 ────────────────────────────────
  v_res := pg_temp.try_publish(v_i3);
  select 'issue_number=' || issue_number || ' is_trial=' || is_trial into v_s from pg_temp.issues where id = v_i3;
  perform pg_temp.rec('P3 유형별 번호', 'no exception / issue_number=1 is_trial=false',
    v_res || ' / ' || v_s, v_res = 'no exception' and v_s = 'issue_number=1 is_trial=false');

  -- ── P4: 다른 커플은 번호·체험이 독립, 남의 날짜는 오르지 않음 ──
  v_res := pg_temp.try_publish(v_ib);
  select 'issue_number=' || issue_number || ' is_trial=' || is_trial into v_s from pg_temp.issues where id = v_ib;
  perform pg_temp.rec('P4 다른 커플 첫 발행', 'no exception / issue_number=1 is_trial=true',
    v_res || ' / ' || v_s, v_res = 'no exception' and v_s = 'issue_number=1 is_trial=true');

  select 'db1=' || (select feature_count from pg_temp.dates where id = v_db1)
      || ' da3=' || (select feature_count from pg_temp.dates where id = v_da3)
    into v_s;
  perform pg_temp.rec('P4 날짜는 같은 커플 것만', 'db1=1 da3=0', v_s, v_s = 'db1=1 da3=0');

  -- ── E: 분기(예외) ─────────────────────────────────────────────
  v_res := pg_temp.try_publish(v_i1);
  perform pg_temp.rec('E1 이미 발행됨', 'issue ' || v_i1 || ' already published', v_res,
    position('issue ' || v_i1 || ' already published' in v_res) > 0);

  v_res := pg_temp.try_publish(v_x);
  perform pg_temp.rec('E2 없는 호', 'issue ' || v_x || ' not found', v_res,
    position('issue ' || v_x || ' not found' in v_res) > 0);

  v_res := pg_temp.try_publish(v_in);
  perform pg_temp.rec('E3 커플이 active 아님', 'couple ' || v_n || ' is not active', v_res,
    position('couple ' || v_n || ' is not active' in v_res) > 0);

  v_res := pg_temp.try_publish(v_i4);
  select 'published_at ' || (case when published_at is null then 'null' else 'set' end)
    into v_s from pg_temp.issues where id = v_i4;
  perform pg_temp.rec('E4 미해소 경보', 'issue ' || v_i4 || ' has an open alert / published_at null',
    v_res || ' / ' || v_s,
    position('issue ' || v_i4 || ' has an open alert' in v_res) > 0 and v_s = 'published_at null');

  v_res := pg_temp.try_publish(v_i5);
  perform pg_temp.rec('E5 ready 코너 없음', 'issue ' || v_i5 || ' has no ready corner', v_res,
    position('issue ' || v_i5 || ' has no ready corner' in v_res) > 0);

  -- ── E4 이어서: 경보를 해소하면 발행된다 ───────────────────────
  update pg_temp.ops_alerts set resolved_at = now() where id = v_alert;
  v_res := pg_temp.try_publish(v_i4);
  select 'issue_number=' || issue_number || ' is_trial=' || is_trial into v_s from pg_temp.issues where id = v_i4;
  perform pg_temp.rec('E4 경보 해소 뒤 발행', 'no exception / issue_number=3 is_trial=false',
    v_res || ' / ' || v_s, v_res = 'no exception' and v_s = 'issue_number=3 is_trial=false');
end
$$;

insert into t_report (check_name, expected, actual, verdict)
values ('주의', '논리 확인이며 실제 함수의 증명이 아니다',
        'pg_temp 사본으로 확인했다. 실제 함수·FK·RLS·동시 발행 잠금은 48- C(로컬/브랜치)에서 증명한다', 'NOTE');

select n, check_name, expected, actual, verdict from t_report order by n;
