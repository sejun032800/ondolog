-- 022 발행 시 테마 복사 트리거 실증 (SCHEMA §9-D-4, §9-C-6 방식).
-- 실행: 022를 원격에 적용한 뒤, 사람이 실행한다. 파일 전체를 한 번에 실행.
-- 실행 도구: Supabase MCP execute_sql (021 실증과 같다).
--
-- 함수는 public.couples를 스키마 한정으로 읽으므로, 임시 테이블 t_couples로 바꿔 임시 함수로 만든다.
-- 실제 함수 정의(pg_get_functiondef)에서 문자열만 치환한다 -> 로직은 원본과 같다.
-- 원격 auth.users·public.couples는 건드리지 않는다. 임시 객체는 세션이 끝나면 사라진다.
--
-- 기대:
--   1) 첫 select: 발행 전이 행(...0002)의 theme = 'lovely' (couple A의 magazine_theme),
--      published = true. 초안으로 남은 행(...0003)은 theme = 'basic', published = false.
--   2) 마지막 update(발행된 행의 theme 변경)는 예외. 에러 메시지의 issue id가 ...0002여야 한다.
--      ...0003이면 결함.

create temp table t_couples (id uuid primary key, magazine_theme text not null);
insert into t_couples values
  ('00000000-0000-0000-0000-00000000000a', 'lovely');

create temp table t_issues (like public.issues including defaults);

do $$
declare d text;
begin
  d := pg_get_functiondef('public.fn_issues_theme_on_publish'::regproc);
  d := replace(d, 'public.fn_issues_theme_on_publish', 'pg_temp.fn_t_on_publish');
  d := replace(d, 'public.couples', 'pg_temp.t_couples');
  execute d;
end
$$;

-- 이름 순서는 실제와 같게(immutable -> on_publish)
create trigger tg_a_immutable before update on t_issues
  for each row execute function public.fn_issues_theme_immutable();
create trigger tg_b_on_publish before update on t_issues
  for each row execute function pg_temp.fn_t_on_publish();

insert into t_issues (id, couple_id, issue_type, issue_number, period_start, period_end, published_at)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'monthly', null, current_date, current_date, null),
       ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'monthly', null, current_date + 1, current_date + 1, null);
-- issue_number null: 022 적용 후 public.issues.issue_number가 nullable이라 like가 그대로 복사한다.
-- 022 적용 전에 돌리면 여기서 not null 위반으로 멈춘다(함수도 아직 없다).

-- 초안 행에 published_at을 채운다 -> theme가 couple A의 magazine_theme가 되어야 한다
update t_issues set issue_number = 1, published_at = now()
 where id = '00000000-0000-0000-0000-000000000002';

select right(id::text, 4) as issue, published_at is not null as published, theme
  from t_issues order by id;

-- 발행된 행의 theme 변경 -> 예외여야 한다
update t_issues set theme = 'neon'
 where id = '00000000-0000-0000-0000-000000000002';
