-- ─────────────────────────────────────────────
-- 12. Storage 버킷
-- ─────────────────────────────────────────────
-- | 버킷            | 공개   | 용도                     | 접근                              |
-- |-----------------|--------|--------------------------|-----------------------------------|
-- | avatars         | 비공개 | 프로필·대표사진          | 커플 구성원                       |
-- | entries         | 비공개 | 피드 사진·드로잉         | 커플 구성원 (잠금 반영)           |
-- | messages        | 비공개 | 채팅 미디어              | 커플 구성원                       |
-- | stories         | 비공개 | 스토리 미디어            | 커플 구성원                       |
-- | magazine        | 비공개 | 표지 + 디지털 PDF        | 커플 구성원                       |
-- | magazine-print  | 비공개 | 인쇄용 PDF               | service_role 전용 — 클라이언트 정책 없음 |

insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        false),
  ('entries',         'entries',        false),
  ('messages',        'messages',       false),
  ('stories',         'stories',        false),
  ('magazine',        'magazine',       false),
  ('magazine-print',  'magazine-print', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- entries — 경로 규칙 {couple_id}/{entry_id}.{ext} (SCHEMA.md §12 원문 예시)
-- ─────────────────────────────────────────────
create policy entries_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'entries'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy entries_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entries'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- ─────────────────────────────────────────────
-- messages / stories / magazine — SCHEMA.md §12 "Storage 정책도 동일 원칙"에 따라
-- entries와 동일한 {couple_id}/... 경로 규칙 + is_couple_member 패턴을 적용한다.
-- 이 세 버킷은 커플 단위 리소스로 개인 단독 접근 케이스가 없어 entries와 동형이다.
-- ─────────────────────────────────────────────
create policy messages_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy messages_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messages'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy stories_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'stories'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy stories_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'stories'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy magazine_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'magazine'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy magazine_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'magazine'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- ─────────────────────────────────────────────
-- avatars — 의도적으로 정책을 만들지 않는다 (deny-by-default).
--
-- profiles.reference_photo_path(개인, 커플 매칭 이전에도 존재 가능)와
-- couples.reference_photo_path(커플)가 이 버킷을 공유하는데, 경로 규칙이
-- {couple_id}/... 인지 {user_id}/... 인지 SCHEMA.md에 명시되어 있지 않다.
-- 미확정 상태에서 임의로 정책을 만들면 잘못된 경로 규칙으로 인한 접근 오류
-- 또는 교차 커플 노출 위험이 있으므로, RLS는 걸되(테이블 생성 시 이미 활성화)
-- 정책 없이 전면 차단 상태로 둔다. Phase 3(온보딩) 착수 전 경로 규칙을
-- 확정하고 정책을 추가해야 한다. (.claude/state/HANDOFF.md 기록)
-- ─────────────────────────────────────────────

-- magazine-print: 정책을 만들지 않는다 = 클라이언트 접근 불가 (service_role 전용)
