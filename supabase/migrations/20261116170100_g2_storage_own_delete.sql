-- 76-g-m2 (ROADMAP R105-4 · R105-5): 저장소 본인 파일 삭제 정책 - 앱이 사진 하나 · 하루를 지운 순간 내 파일도 지운다.
--
-- 왜: storage.objects 에 DELETE 정책이 어느 마이그레이션에도 없어(015 · 019 는 읽기 · 올리기 · 바꾸기만) 로그인 사용자의 remove() 가
--     오류 없이 0건으로 끝났다(76-f P1).
-- 대상: 앱이 올리는 버킷 entries · messages · stories 만. avatars 는 웹 앱이 올리지 않아 넣지 않는다. magazine · magazine-print 0.
-- 조건: 올린 사람 본인(owner = auth.uid()) + 같은 커플 경로(첫 폴더가 내 커플 - 015 의 select · insert 와 같은 모양).
--       상대 파일은 owner 가 달라 거부된다. 해제 완료 커플은 is_couple_member 가 거짓이라 거부(그 파일은 월요일 정리가 받는다).
-- owner: storage.objects 의 업로더 칸(uuid). 저장소 API 가 올릴 때 요청 사용자로 채운다.
--
-- 이 파일이 하지 않는 것: 다른 버킷 · 다른 명령(select · insert · update) 정책 변경 · 데이터 변경.

create policy storage_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('entries', 'messages', 'stories')
    and owner = auth.uid()
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );
