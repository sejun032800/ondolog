-- 실행 도구: Supabase MCP execute_sql, 파일 전체를 한 번에 실행.
-- 기대: 에러 메시지의 issue id가 ...0001 (발행 행). ...0002면 결함.
create temp table t_issues (like public.issues including defaults);
create trigger tg_t before update on t_issues
  for each row execute function public.fn_issues_theme_immutable();

insert into t_issues (id, couple_id, issue_type, issue_number, period_start, period_end, published_at)
values ('00000000-0000-0000-0000-000000000001', gen_random_uuid(), 'monthly', 1, current_date, current_date, now()),
       ('00000000-0000-0000-0000-000000000002', gen_random_uuid(), 'monthly', 2, current_date, current_date, null);

update t_issues set theme = 'lovely' where issue_number = 2;  -- 통과해야 한다
select issue_number, published_at is not null as published, theme
  from t_issues order by issue_number;
update t_issues set theme = 'lovely' where issue_number = 1;  -- 예외여야 한다
