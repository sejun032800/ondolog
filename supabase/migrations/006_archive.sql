-- ─────────────────────────────────────────────
-- 6-1. dates — 데이트 단위 클러스터
-- ─────────────────────────────────────────────
create table public.dates (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,

  date_on             date not null,                    -- 데이트가 있었던 날
  region              text,                             -- '연남동' 등 대표 지역
  title               text,                             -- AI 생성 제목
  narrative           text,                             -- AI 생성 코스 서사

  photo_count         integer not null default 0,
  duration_minutes    integer,                          -- 첫~마지막 EXIF 시각 폭
  has_user_note       boolean not null default false,   -- 유저 글/그림 존재 여부
  is_new_region       boolean not null default false,   -- 첫 방문 지역 여부

  source              text not null default 'auto' check (source in ('auto', 'manual')),
  user_confirmed      boolean not null default false,

  -- "그때 그 시절" 재소환 규칙: 재등장 최소 6개월 간격
  last_featured_at    timestamptz,
  feature_count       integer not null default 0,

  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (couple_id, date_on)
);

create index idx_dates_couple_date
  on public.dates (couple_id, date_on desc)
  where deleted_at is null;

-- 재소환 후보 조회용: 아직 실린 적 없거나 6개월 지난 것
create index idx_dates_feature_pool
  on public.dates (couple_id, last_featured_at nulls first)
  where deleted_at is null;

create trigger tg_dates_updated
  before update on public.dates
  for each row execute function public.tg_set_updated_at();

comment on table public.dates is
  '데이트 아카이브 코너의 기사 단위. 선별 로직은 photo_count / has_user_note / is_new_region / duration_minutes를 우선순위로 사용한다.';

alter table public.dates enable row level security;

-- ─────────────────────────────────────────────
-- 6-2. date_stops — 타임라인 블록 (장소 단위)
-- ─────────────────────────────────────────────
create table public.date_stops (
  id                uuid primary key default gen_random_uuid(),
  date_id           uuid not null references public.dates(id) on delete cascade,
  couple_id         uuid not null references public.couples(id) on delete cascade,  -- RLS용 비정규화

  seq               smallint not null,                  -- 타임라인 순서 (0부터)
  arrived_at        timestamptz not null,               -- EXIF 기반 도착 시각

  place_name        text,
  place_provider_id text,                               -- 카카오맵 place id
  lat               numeric(10, 7),
  lng               numeric(10, 7),
  location_verified boolean not null default false,     -- 유저가 직접 수정했는지

  caption           text,                               -- AI 캡션 (유저 기록 없는 구간만)

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (date_id, seq),
  constraint chk_latlng_pair check ((lat is null) = (lng is null))
);

create index idx_date_stops_date on public.date_stops (date_id, seq);
create index idx_date_stops_geo  on public.date_stops (couple_id, lat, lng)
  where lat is not null;

create trigger tg_date_stops_updated
  before update on public.date_stops
  for each row execute function public.tg_set_updated_at();

alter table public.date_stops enable row level security;

-- ─────────────────────────────────────────────
-- 6-3. data_entries — 업로드 원본
-- ─────────────────────────────────────────────
create table public.data_entries (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  author_id         uuid not null references public.profiles(id) on delete restrict,

  date_id           uuid references public.dates(id)      on delete set null,
  date_stop_id      uuid references public.date_stops(id) on delete set null,

  entry_type        entry_type not null,

  -- 미디어
  storage_path      text,
  thumb_path        text,
  byte_size         bigint,
  width             integer,
  height            integer,

  -- 텍스트/드로잉
  text_content      text,
  drawing_path      text,

  -- EXIF (보관 정책의 기준일은 uploaded_at이 아니라 captured_at)
  captured_at       timestamptz,
  lat               numeric(10, 7),
  lng               numeric(10, 7),
  place_name        text,
  location_verified boolean not null default false,

  hashtags          text[] not null default '{}',
  ai_tags           jsonb  not null default '{}'::jsonb,

  -- 무료 티어 3개월 정책
  resolution_tier   resolution_tier not null default 'original',
  access_locked     boolean not null default false,
  downgraded_at     timestamptz,

  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_entry_payload check (
    (entry_type = 'photo'   and storage_path is not null) or
    (entry_type = 'memo'    and text_content is not null) or
    (entry_type = 'drawing' and drawing_path is not null)
  ),
  constraint chk_entry_latlng check ((lat is null) = (lng is null)),
  constraint chk_downgrade_state check (
    (resolution_tier = 'original' and downgraded_at is null) or
    (resolution_tier = 'low'      and downgraded_at is not null)
  )
);

-- 피드 타임라인 (가장 빈번한 조회)
create index idx_entries_feed
  on public.data_entries (couple_id, captured_at desc nulls last)
  where deleted_at is null;

create index idx_entries_date_stop on public.data_entries (date_stop_id)
  where deleted_at is null;

-- 보관 정책 배치: 3개월 초과 원본 탐색
create index idx_entries_retention
  on public.data_entries (captured_at)
  where resolution_tier = 'original' and deleted_at is null;

-- 탈퇴자 파생 데이터 판정
create index idx_entries_author on public.data_entries (author_id)
  where deleted_at is null;

create index idx_entries_hashtags on public.data_entries using gin (hashtags);
create index idx_entries_ai_tags  on public.data_entries using gin (ai_tags);

create trigger tg_data_entries_updated
  before update on public.data_entries
  for each row execute function public.tg_set_updated_at();

comment on column public.data_entries.captured_at is
  '무료 티어 3개월 보관 정책의 기준일. 업로드일이 아니라 촬영일이다.';
comment on column public.data_entries.access_locked is
  '무료 티어에서 3개월 초과 시 true. 목록에는 보이되 열람은 차단. 삭제하지 않고 잠글 뿐이다.';

alter table public.data_entries enable row level security;

-- dates/date_stops/data_entries의 정책(§10-5)은 is_couple_member() / is_entry_visible()
-- 헬퍼(011_rls_helpers.sql)에 의존하므로 012_rls_policies.sql에서 생성한다.
