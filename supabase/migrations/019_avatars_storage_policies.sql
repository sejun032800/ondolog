-- avatars 버킷 RLS 정책 — 개인/커플 대표사진(reference photo) 실제 업로드를
-- 위해 015_storage_policies.sql이 의도적으로 비워둔 정책을 채운다.
--
-- 근거: docs/ONDOLOG_MASTER.md "연인 인식용 대표사진"
--   "등록: 개인 1장 + 커플 1장, 프로필처럼 관리" / "수정: 설정 탭에서 언제든 교체"
--   Part 9-4 얼굴 인식 아키텍처 보강 "원본 사진 | 유저 기기(Storage 업로드는
--   유저가 선택한 사진만)" — 여기서 저장하는 것은 사진 원본 파일뿐이다.
--   얼굴 임베딩 벡터는 이 버킷에도, 어떤 컬럼에도 저장하지 않는다
--   (CLAUDE.md 절대 규칙 1).
--
-- 015가 미확정으로 남겼던 것: "경로 규칙이 {couple_id}/... 인지
-- {user_id}/... 인지 SCHEMA.md에 명시되어 있지 않다."
-- 이번 작업(대표사진 등록 화면)에서 다음과 같이 확정한다:
--   개인 대표사진(profiles.reference_photo_path) → {user_id}/reference
--     커플 매칭 이전에도 존재해야 하므로(MASTER "혼자서도 기록 가능")
--     couple_id에 의존할 수 없다 — auth.uid()로 직접 판정한다.
--   커플 대표사진(couples.reference_photo_path)   → {couple_id}/reference
--     entries/messages/stories/magazine과 동일하게 is_couple_member()로 판정한다.
-- 두 규칙은 서로 다른 UUID 계열(auth.users.id vs couples.id)을 1번째
-- 경로 세그먼트로 쓰므로 충돌하지 않는다 — permissive 정책은 OR로
-- 합쳐지므로 한 버킷에 두 정책을 그대로 공존시킬 수 있다.
--
-- 확장자를 경로에 포함하지 않고 고정 파일명 `reference`를 쓴다(콘텐츠
-- 타입은 업로드 시 메타데이터로 전달) — "교체 가능"(upsert)을 반복해도
-- 과거 확장자가 다른 파일이 고아로 남지 않게 하기 위함. `src/services/
-- referencePhotoApi.ts`가 이 규칙 그대로 업로드한다.

create policy avatars_personal_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_personal_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- update 정책은 이 버킷에만 있다(entries/messages/stories/magazine은 없음)
-- — 대표사진은 "교체 가능"이 명시적 요구사항이라 upsert를 지원해야 한다.
create policy avatars_personal_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_couple_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy avatars_couple_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy avatars_couple_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'avatars'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );
