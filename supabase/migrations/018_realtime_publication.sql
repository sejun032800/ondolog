-- messages/stories를 supabase_realtime publication에 등록한다.
-- 근거: .claude/state/HANDOFF.md "여전히 필요한 처리" 1번,
--   .claude/state/PROGRESS.md 2026-08-26 Phase 5 완료 절
--   "Realtime publication 미설정" 참조.
--   Phase 5(ui-builder)가 원격 프로젝트에 직접 조회
--   (`select * from pg_publication_tables where pubname =
--   'supabase_realtime'`)한 결과 두 테이블 다 등록되어 있지 않았다.
--   `src/hooks/useRealtimeMessages.ts`의 Realtime 구독이 실제로 이벤트를
--   받으려면 이 등록이 선행돼야 한다.

-- messages는 이미 등록된 상태로 확인됨(코디네이터 확인) — `alter publication
-- ... add table`은 이미 멤버인 테이블을 다시 추가하려 하면 "already member
-- of publication" 에러(duplicate_object, SQLSTATE 42710)를 던진다. 두
-- 테이블을 한 ALTER PUBLICATION 문에 같이 넣으면 하나만 실패해도 문 전체가
-- 실패하므로, 테이블별로 DO 블록을 나눠 멱등하게(이미 등록돼 있어도 에러
-- 없이 통과하게) 만든다.

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then
    null; -- 이미 등록되어 있음 — 정상, 넘어간다.
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.stories;
exception
  when duplicate_object then
    null; -- 이미 등록되어 있음 — 정상, 넘어간다.
end
$$;
