-- ─────────────────────────────────────────────
-- 10-2. 전 테이블 RLS 활성화
-- ─────────────────────────────────────────────
-- 각 테이블은 003~010에서 생성 즉시 이미 활성화되었다.
-- 아래는 SCHEMA.md 원문 그대로이며, 이미 활성화된 테이블에 대해서는
-- 안전한 no-op으로 동작한다 (재실행 가능).
alter table public.profiles                 enable row level security;
alter table public.personality_assessments  enable row level security;
alter table public.personality_profiles     enable row level security;
alter table public.love_type_labels         enable row level security;
alter table public.couples                  enable row level security;
alter table public.couple_dissolutions      enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.dates                    enable row level security;
alter table public.date_stops               enable row level security;
alter table public.data_entries             enable row level security;
alter table public.messages                 enable row level security;
alter table public.stories                  enable row level security;
alter table public.daily_temperature        enable row level security;
alter table public.stat_snapshots           enable row level security;
alter table public.match_reports            enable row level security;
alter table public.dna_scores               enable row level security;
alter table public.issues                   enable row level security;
alter table public.corners                  enable row level security;
alter table public.app_config               enable row level security;

-- ─────────────────────────────────────────────
-- 10-3. 프로필 · 성격
-- ─────────────────────────────────────────────
-- 본인 + 파트너만 조회
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or id = public.partner_id());

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 삭제는 애플리케이션(7일 유예 배치)만. 직접 DELETE 금지 → 정책 미생성

create policy assessments_select on public.personality_assessments
  for select to authenticated
  using (user_id = auth.uid() or user_id = public.partner_id());

create policy assessments_insert on public.personality_assessments
  for insert to authenticated
  with check (user_id = auth.uid());
-- UPDATE/DELETE 정책 없음 = 불변 로그

create policy pprofiles_select on public.personality_profiles
  for select to authenticated
  using (user_id = auth.uid() or user_id = public.partner_id());

create policy pprofiles_write on public.personality_profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy pprofiles_update on public.personality_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 36종 라벨: 전체 공개 읽기 (비로그인 결과 카드에서도 사용)
create policy labels_select on public.love_type_labels
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────
-- 10-4. 커플
-- ─────────────────────────────────────────────
create policy couples_select on public.couples
  for select to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy couples_insert on public.couples
  for insert to authenticated
  with check (user_a_id = auth.uid());

-- 초대 코드 입력을 통한 참여: 빈 슬롯에 본인을 넣는 경우만 허용
create policy couples_update on public.couples
  for update to authenticated
  using (
    user_a_id = auth.uid()
    or user_b_id = auth.uid()
    or (user_b_id is null and status = 'pending')
  )
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

create policy dissolutions_select on public.couple_dissolutions
  for select to authenticated using (public.is_couple_member(couple_id));

create policy dissolutions_insert on public.couple_dissolutions
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and initiated_by = auth.uid());

-- 유예 기간 내 취소
create policy dissolutions_update on public.couple_dissolutions
  for update to authenticated
  using (initiated_by = auth.uid() and executed_at is null)
  with check (initiated_by = auth.uid());

create policy subscriptions_select on public.subscriptions
  for select to authenticated using (public.is_couple_member(couple_id));
-- 쓰기는 서비스 역할(결제 웹훅)만

-- ─────────────────────────────────────────────
-- 10-5. 커플 공유 데이터 — 공통 패턴
-- ─────────────────────────────────────────────
-- dates
create policy dates_all on public.dates
  for all to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- date_stops
create policy date_stops_all on public.date_stops
  for all to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- data_entries: 조회 시 무료 티어 잠금까지 반영
create policy entries_select on public.data_entries
  for select to authenticated
  using (
    public.is_couple_member(couple_id)
    and deleted_at is null
    and public.is_entry_visible(couple_id, access_locked)
  );

create policy entries_insert on public.data_entries
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

-- 본인이 올린 것만 수정. 단 위치 보정은 상대도 가능해야 하므로 커플 전체 허용
create policy entries_update on public.data_entries
  for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- messages
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_couple_member(couple_id) and deleted_at is null);

create policy messages_insert on public.messages
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and sender_id = auth.uid());

-- 읽음 표시는 수신자가, 삭제는 발신자가
create policy messages_update on public.messages
  for update to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- stories
create policy stories_select on public.stories
  for select to authenticated using (public.is_couple_member(couple_id));

create policy stories_insert on public.stories
  for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

create policy stories_delete on public.stories
  for delete to authenticated
  using (public.is_couple_member(couple_id) and author_id = auth.uid());

-- ─────────────────────────────────────────────
-- 10-6. 산출 데이터 — 읽기 전용
-- ─────────────────────────────────────────────
-- 배치·Edge Function이 service_role로 쓰고, 클라이언트는 읽기만 한다.
create policy temperature_select on public.daily_temperature
  for select to authenticated using (public.is_couple_member(couple_id));

create policy stats_select on public.stat_snapshots
  for select to authenticated using (public.is_couple_member(couple_id));

create policy match_reports_select on public.match_reports
  for select to authenticated using (public.is_couple_member(couple_id));

create policy dna_scores_select on public.dna_scores
  for select to authenticated using (public.is_couple_member(couple_id));

create policy corners_select on public.corners
  for select to authenticated
  using (public.is_couple_member(couple_id) and status = 'published');

-- issues: 인쇄용 PDF 경로는 뷰로 차단 (issues_public, 009_magazine.sql에서 생성됨)
create policy issues_select on public.issues
  for select to authenticated
  using (public.is_couple_member(couple_id) and published_at is not null);

create policy app_config_select on public.app_config
  for select to authenticated using (true);
