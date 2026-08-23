create table public.couples (
  id                        uuid primary key default gen_random_uuid(),

  user_a_id                 uuid not null references public.profiles(id) on delete restrict,
  user_b_id                 uuid      references public.profiles(id) on delete restrict,

  invite_code               text not null unique
                              check (invite_code ~ '^[A-Z0-9]{6,10}$'),
  invite_expires_at         timestamptz,

  nickname                  text check (char_length(nickname) between 1 and 20),

  -- 사귄 날짜: 먼저 입력한 값이 확정. 상대는 확인만.
  relationship_start_date   date,
  start_date_set_by         uuid references public.profiles(id),
  start_date_confirmed_by   uuid references public.profiles(id),

  -- 커플 대표사진 (원본만. 임베딩 저장 금지)
  reference_photo_path      text,

  subscription_tier         subscription_tier not null default 'free',
  status                    couple_status     not null default 'pending',

  connected_at              timestamptz,
  dissolved_at              timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint chk_not_self          check (user_b_id is null or user_a_id <> user_b_id),
  constraint chk_active_needs_pair check (status <> 'active' or user_b_id is not null),
  constraint chk_start_date_owner  check (relationship_start_date is null or start_date_set_by is not null)
);

-- 한 사람이 동시에 두 개의 활성 커플에 속할 수 없다
create unique index uq_couple_active_user_a
  on public.couples (user_a_id)
  where status in ('pending', 'active', 'dissolving');
create unique index uq_couple_active_user_b
  on public.couples (user_b_id)
  where user_b_id is not null and status in ('pending', 'active', 'dissolving');

create index idx_couples_invite
  on public.couples (invite_code)
  where status = 'pending';

create trigger tg_couples_updated
  before update on public.couples
  for each row execute function public.tg_set_updated_at();

comment on column public.couples.relationship_start_date is
  '양측이 다른 날짜를 입력하면 먼저 입력한 값(start_date_set_by)이 확정되고, 상대는 확인만 한다.';

alter table public.couples enable row level security;

-- couples 자체의 정책(§10-4 couples_select/insert/update)은 auth.uid()만으로
-- 성립하므로 헬퍼 함수 의존이 없다. 다만 파일 순서 일관성을 위해
-- 012_rls_policies.sql에서 다른 정책들과 함께 SCHEMA.md 원문 그대로 생성한다.

-- ─────────────────────────────────────────────
-- 5-1. couple_dissolutions — 7일 유예
-- ─────────────────────────────────────────────
create table public.couple_dissolutions (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,
  initiated_by        uuid not null references public.profiles(id),
  reason              dissolution_reason not null,

  requested_at        timestamptz not null default now(),
  purge_scheduled_at  timestamptz not null,          -- requested_at + 7일
  cancelled_at        timestamptz,
  executed_at         timestamptz,

  partner_notified_at timestamptz,

  constraint chk_grace_period check (purge_scheduled_at > requested_at)
);

create index idx_dissolution_pending
  on public.couple_dissolutions (purge_scheduled_at)
  where cancelled_at is null and executed_at is null;

comment on table public.couple_dissolutions is
  '연결 해제/탈퇴 7일 유예. 실행 시 개시자 파생 데이터만 파기하고 상대 데이터와 발행 매거진은 보존한다.';

alter table public.couple_dissolutions enable row level security;

-- ─────────────────────────────────────────────
-- 5-2. subscriptions — 결제 이력
-- ─────────────────────────────────────────────
create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,
  tier                subscription_tier not null,
  platform            text not null check (platform in ('ios', 'android', 'web')),
  external_txn_id     text,
  started_at          timestamptz not null default now(),
  current_period_end  timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_subscriptions_couple on public.subscriptions (couple_id, started_at desc);
create unique index uq_subscription_txn on public.subscriptions (platform, external_txn_id)
  where external_txn_id is not null;

alter table public.subscriptions enable row level security;

-- couple_dissolutions/subscriptions의 정책(§10-4)은 is_couple_member() 헬퍼
-- (011_rls_helpers.sql)에 의존하므로 012_rls_policies.sql에서 생성한다.
