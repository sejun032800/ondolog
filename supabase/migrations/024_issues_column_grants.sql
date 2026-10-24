-- issues 열 단위 SELECT 권한: authenticated가 issues_public 뷰를 읽을 수 있게 한다.
-- 근거: SCHEMA 10-7 결함 기록, ROADMAP R32-1, 절대 규칙 3. 위임 59- A.
-- 001~023은 이미 적용된 것이라 고치지 않는다. 024는 권한 한 줄만 얹는다.
--
-- 결함: issues_public은 security_invoker = true 뷰라서 호출자 권한으로 issues를 읽는다.
-- 그런데 009가 issues의 anon/authenticated 권한을 모두 회수했다(revoke all). 그래서 사용자 권한으로는
-- 009 이후 발행물을 한 줄도 읽지 못했다(permission denied for table issues).
--
-- 고침: 뷰가 내보내는 14칸에만 열 단위로 select를 준다.
--   - pdf_print_path(인쇄용 300DPI+ 경로), publish_mode, updated_at 등 목록 밖 칸은 주지 않는다.
--     그래서 select pdf_print_path / select * 는 열 권한 때문에 거부된다.
--   - 행 거르기는 기존 RLS issues_select(커플 구성원 + 발행됨)가 그대로 한다. 접근 조건은 한 곳에만 있다.
--   - anon에는 아무것도 주지 않는다. INSERT/UPDATE/DELETE 권한도 주지 않는다.
--   - 뷰를 security definer로 바꾸지 않는다. 정책·뷰·버킷 정책은 바꾸지 않는다.
-- 뷰에 칸을 더할 때는 같은 마이그레이션에서 이 열 권한도 더한다. 목록의 원본은 SCHEMA 9-C-4.
--
-- 새 테이블이 없으므로 RLS 설정은 없다(issues는 009에서 RLS가 켜져 있고 정책 issues_select가 있다).

grant select (
  id, couple_id, issue_type, issue_number, title, cover_path,
  period_start, period_end,
  pdf_digital_path,
  page_count, is_trial, published_at, created_at,
  theme
) on public.issues to authenticated;
