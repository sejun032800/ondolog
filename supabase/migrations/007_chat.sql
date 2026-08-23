-- ─────────────────────────────────────────────
-- 7-1. messages
-- ─────────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id)  on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete restrict,

  body            text,
  media_path      text,

  sent_at         timestamptz not null default now(),
  read_at         timestamptz,

  -- AI 태깅 (배치 처리). 다정한 말들 선별 + 연애 온도 산출 입력
  warmth_score    numeric(4, 3) check (warmth_score between 0 and 1),
  sentiment       jsonb,
  analyzed_at     timestamptz,

  -- 클라이언트 생성 ID: 오프라인 큐잉 후 재전송 시 중복 방지
  client_msg_id   uuid,

  deleted_at      timestamptz,

  constraint chk_message_payload check (body is not null or media_path is not null)
);

create index idx_messages_thread
  on public.messages (couple_id, sent_at desc)
  where deleted_at is null;

-- 다정한 말들 선별용
create index idx_messages_warmth
  on public.messages (couple_id, warmth_score desc, sent_at desc)
  where deleted_at is null and warmth_score is not null;

-- 미분석 메시지 배치 처리용
create index idx_messages_unanalyzed
  on public.messages (sent_at)
  where analyzed_at is null and deleted_at is null;

create index idx_messages_sender on public.messages (sender_id)
  where deleted_at is null;

create unique index uq_messages_client_id
  on public.messages (couple_id, client_msg_id)
  where client_msg_id is not null;

comment on column public.messages.client_msg_id is
  '오프라인 큐잉 → 네트워크 복구 시 재전송에서 중복 삽입을 막는 멱등 키.';
comment on column public.messages.warmth_score is
  '다정함 점수. 다정한 말들 코너의 선별 기준이자 연애 DNA 채팅 변동분의 입력.';

alter table public.messages enable row level security;

-- > 규모 참고: 메시지는 증가 속도가 가장 빠른 테이블이다. MVP에서는 단일 테이블로
-- 충분하나, 커플당 수십만 건 규모가 되면 sent_at 기준 range 파티셔닝을 검토한다.

-- ─────────────────────────────────────────────
-- 7-2. stories
-- ─────────────────────────────────────────────
create table public.stories (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id)  on delete cascade,
  author_id           uuid not null references public.profiles(id) on delete restrict,

  media_path          text not null,
  caption             text,

  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,               -- created_at + 24h

  -- 만료 처리 결과
  resolved_at         timestamptz,
  archived_entry_id   uuid references public.data_entries(id) on delete set null,
  resolution          text check (resolution in ('archived', 'discarded')),

  constraint chk_story_expiry     check (expires_at > created_at),
  constraint chk_story_resolution check (
    (resolved_at is null and resolution is null) or
    (resolved_at is not null and resolution is not null)
  )
);

create index idx_stories_active
  on public.stories (couple_id, created_at desc)
  where resolved_at is null;

-- 만료 배치용
create index idx_stories_expiring
  on public.stories (expires_at)
  where resolved_at is null;

comment on column public.stories.resolution is
  'archived = 사진앱 미연동 → 아카이브로 편입 / discarded = 연동됨 → 소멸(원본이 사진앱에 있고 피드가 자동 인식하므로 중복 방지).';

alter table public.stories enable row level security;

-- messages/stories의 정책(§10-5)은 is_couple_member() 헬퍼(011_rls_helpers.sql)에
-- 의존하므로 012_rls_policies.sql에서 생성한다.
