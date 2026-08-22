# ONDOLOG 데이터베이스 물리 스키마

> Supabase (PostgreSQL 15+) 기준 전체 DDL
> Part 8 논리 초안을 대체하는 확정 스키마
> 모든 테이블에 RLS 필수 적용

---

## 0. 설계 판단 요약

초안 대비 바뀐 핵심 결정 7가지와 그 이유.

### 0-1. `dates` / `date_stops` 신설 — 클러스터링 결과의 영속화

**문제**: 데이트 아카이브 코너가 "하루 = 한 기사" 구조인데, 초안에는 데이트를 나타내는 엔티티가 없었다. 매 발행마다 EXIF를 다시 클러스터링해야 하고, 유저가 수정한 장소명이 어디에 붙는지도 불분명했다.

**결정**: 클러스터링 결과를 `dates`(하루 단위)와 `date_stops`(장소 단위)로 영속화한다. `data_entries`는 `date_stop_id`를 참조한다.

**이점**: 재클러스터링 비용 제거, 유저 보정값의 귀속 지점 명확화, "그때 그 시절" 재소환 시 `last_featured_at`으로 6개월 규칙 판정 가능.

### 0-2. `personality_assessments` / `personality_profiles` 분리

**문제**: 재검사 1회 + 애니어그램 오버라이드 무제한 + 원본 추론값 보존이라는 세 요구를 한 테이블로 담으면 어느 값이 "현재"인지 모호해진다.

**결정**:
- `personality_assessments` — 불변 로그. 5문항 제출마다 1행 (계정당 최대 2행: 최초 + 재검사)
- `personality_profiles` — 현재 상태 1:1. 활성 assessment를 참조하고, 오버라이드를 별도 컬럼에 보관

**이점**: 추론 정확도 분석(원본 vs 오버라이드)이 단순 조인으로 가능하고, 재검사 1회 제한은 assessment 행 수로 강제된다.

### 0-3. `stat_snapshots` 신설 — 연애리그 시계열

**문제**: 월간판의 핵심이 "왜 스탯이 변했나"인데, 스탯을 저장할 곳 자체가 없었다. 매번 재계산하면 과거 시점 값을 복원할 수 없다.

**결정**: 주기(weekly/monthly)별로 6각 스탯 + OVR + 기여도(`inputs`) + 증감(`delta`)을 스냅샷으로 적재한다.

**이점**: 월간판의 "능력치 배분표"와 "변동 해설"이 조회만으로 생성되고, 재현성이 보장된다.

### 0-4. 매거진 콘텐츠는 **스냅샷**으로 저장 (참조 아님)

**문제**: "탈퇴자 파생 데이터는 삭제하되 발행된 매거진은 보존"이라는 정책은, 코너가 원본을 *참조*만 하면 성립하지 않는다. 원본이 사라지면 코너가 깨진다.

**결정**: `corners.content`(jsonb)에 렌더링에 필요한 모든 값을 **복사해서** 저장한다. `source_*_ids`는 감사·표시용 참고 배열일 뿐 FK가 아니다.

**이점**: 발행된 매거진은 PDF와 함께 **동결된 산출물**이 되어, 원본 삭제와 무관하게 보존된다. 정책과 구조가 일치한다.

### 0-5. 얼굴 데이터 — 사진은 저장, 임베딩은 금지

**구분이 필요한 지점**: "대표사진 등록"과 "얼굴 특징 벡터 저장"은 다른 얘기다.

| 대상 | 처리 |
|---|---|
| 대표 사진 원본 (개인 1장 / 커플 1장) | Storage 저장 **허용** — 일반 사진과 동일 |
| 얼굴 임베딩 / 특징점 벡터 | **DB·Storage 어디에도 저장 금지.** 기기 보안 저장소에만 |

파트너 기기에서도 커플 사진으로 인식해야 하므로 사진 자체는 동기화되어야 한다. 임베딩은 각 기기가 로컬에서 재계산한다. 스키마에 임베딩 컬럼을 **의도적으로 두지 않았다.**

### 0-6. RLS는 `SECURITY DEFINER` 헬퍼로 통일

**문제**: `couples` 테이블에 RLS를 걸고 자식 테이블 정책에서 `couples`를 서브쿼리하면 재귀 평가가 발생한다.

**결정**: `is_couple_member(uuid)`를 `SECURITY DEFINER STABLE`로 정의해 RLS를 우회 조회하고, 모든 자식 테이블은 이 함수만 호출한다.

**부수 이점**: 자식 테이블에 `couple_id`를 비정규화해 두면 정책이 인덱스 한 번으로 끝난다.

### 0-7. 채점 룩업은 코드, 표시 라벨은 DB

| 대상 | 위치 | 이유 |
|---|---|---|
| 호나이×하모닉 9칸, 애착 2×2, 빅5 가중치 | `src/constants/` (코드) | **결정론 계약** — DB가 바뀌면 과거 결과가 재현되지 않는다 |
| 36종 라벨·카피 텍스트 | `love_type_labels` 테이블 | 문구는 앱 배포 없이 고쳐야 한다 |

코드(3자)는 코드가 산출하고, DB는 그 코드로 표시 문자열만 조회한다.

---

## 1. 확장 및 공통

```sql
-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- 텍스트 검색 (해시태그/장소명)
create extension if not exists "btree_gist";    -- 배제 제약(커플 중복 방지)

-- ─────────────────────────────────────────────
-- updated_at 자동 갱신 트리거 함수
-- ─────────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
```

---

## 2. ENUM 타입

```sql
create type gender_type        as enum ('male', 'female', 'other');

-- 애착 4유형: 안정 / 불안 / 회피 / 혼란
create type attachment_type    as enum ('secure', 'anxious', 'avoidant', 'fearful');

create type subscription_tier  as enum ('free', 'paid');

create type couple_status      as enum ('pending', 'active', 'dissolving', 'dissolved');

create type entry_type         as enum ('photo', 'memo', 'drawing');

-- 무료 티어 3개월 초과분은 'low'로 다운그레이드
create type resolution_tier    as enum ('original', 'low');

create type issue_type         as enum ('daily', 'weekly', 'monthly');

create type corner_status      as enum ('pending', 'generating', 'ready', 'published', 'skipped', 'failed');

-- 12종 코너
create type corner_type as enum (
  'date_archive',      -- 1. 데이트 아카이브       (월간, MVP)
  'love_dna',          -- 2. 우리의 연애 DNA        (월간, MVP)
  'league_weekly',     -- 3. 연애리그 - 주간판       (주간, MVP)
  'league_monthly',    -- 3. 연애리그 - 월간판       (월간, MVP)
  'sweet_words',       -- 4. 다정한 말들            (일간/MVP는 월간)
  'offline_setlog',    -- 5. 오프라인 셋로그         (주간)
  'couple_interview',  -- 6. 우리 사이 인터뷰        (주간)
  'this_month',        -- 7. 이달의 우리            (월간, MVP)
  'special_guest',     -- 8. 특별 게스트(무물)       (월간)
  'over_shoulder',     -- 9. 어깨너머 열람실         (월간)
  'appendix',          -- 10. 잡지 부록             (월간)
  'sponsored',         -- 11. 협찬면                (월간)
  'rough_guess'        -- 12. 얼렁뚱땅 어림짐작      (월간)
);

create type stat_period_type   as enum ('weekly', 'monthly');

create type dissolution_reason as enum ('unlink', 'withdrawal');

-- 5문항 응답: 전 문항 3지선다
create type quiz_choice        as enum ('A', 'B', 'C');
```

---

## 3. 사용자 (profiles)

`auth.users`를 확장하는 공개 프로필. Supabase Auth가 카카오·구글·애플을 처리한다.

```sql
create table public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,

  -- 온보딩 화면 2
  display_name              text        not null check (char_length(display_name) between 1 and 20),
  gender                    gender_type not null,
  birth_date                date        not null,          -- 나이 확인용. 사귄 일수와 무관

  -- 온보딩 화면 3
  mbti                      char(4)     check (mbti ~ '^[EI][NS][TF][JP]$'),

  -- 세이브포인트 (가입 이후 구간만. 0=가입직후 … 3=온보딩완료)
  onboarding_step           smallint    not null default 0 check (onboarding_step between 0 and 3),

  -- 사진 앱 연동 (스토리 만료 분기에도 사용)
  photo_sync_enabled        boolean     not null default false,
  photo_scan_completed_at   timestamptz,
  photo_scan_cursor         timestamptz,                   -- 증분 스캔 기준점

  -- 생체정보 별도 동의 (개인정보보호법 민감정보)
  -- ※ 얼굴 임베딩은 어떤 컬럼에도 저장하지 않는다. 기기 보안저장소 전용.
  biometric_consent_at      timestamptz,
  biometric_consent_revoked_at timestamptz,

  -- 얼굴 인식 기준 '개인 대표사진' 1장 (사진 원본만. 벡터 아님)
  reference_photo_path      text,

  -- 약관
  terms_agreed_at           timestamptz not null default now(),
  privacy_agreed_at         timestamptz not null default now(),
  ai_usage_agreed_at        timestamptz,                   -- 채팅 AI 활용 고지 동의

  -- 탈퇴 (7일 유예 → 하드 삭제)
  deleted_at                timestamptz,
  purge_scheduled_at        timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint chk_biometric_revoke_order
    check (biometric_consent_revoked_at is null
           or biometric_consent_at is not null),
  constraint chk_purge_after_delete
    check (purge_scheduled_at is null or deleted_at is not null)
);

create index idx_profiles_purge
  on public.profiles (purge_scheduled_at)
  where deleted_at is not null;

create trigger tg_profiles_updated
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

comment on column public.profiles.reference_photo_path is
  '얼굴 인식 기준 사진 원본 경로. 얼굴 특징 벡터는 절대 서버에 저장하지 않는다 (온디바이스 전용).';
comment on column public.profiles.onboarding_step is
  '가입 이후 진행도 세이브포인트. 비로그인 구간(화면 2~5)은 서버에 저장하지 않는다.';
```

---

## 4. 성격 프로필

### 4-1. `personality_assessments` — 불변 제출 로그

```sql
create table public.personality_assessments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,

  seq               smallint not null check (seq in (1, 2)),  -- 1=최초, 2=재검사(계정당 1회)

  -- 입력 원본
  mbti              char(4) not null check (mbti ~ '^[EI][NS][TF][JP]$'),
  mbti_self_reported boolean not null default true,           -- false = 간이 4문항으로 산출
  q1                quiz_choice not null,   -- 호나이 삼분법
  q2                quiz_choice not null,   -- 하모닉 삼분법
  q3                quiz_choice not null,   -- 신경성 / 애착 불안
  q4                quiz_choice not null,   -- 스턴버그 우세 성분
  q5                quiz_choice not null,   -- 애착 회피

  -- 산출 결과 (결정론적 순수 함수 출력의 스냅샷)
  enneagram_core    smallint not null check (enneagram_core between 1 and 9),
  big_o             smallint not null check (big_o between 0 and 100),
  big_c             smallint not null check (big_c between 0 and 100),
  big_e             smallint not null check (big_e between 0 and 100),
  big_a             smallint not null check (big_a between 0 and 100),
  big_n             smallint not null check (big_n between 0 and 100),
  stern_intimacy    smallint not null check (stern_intimacy   between 0 and 100),
  stern_passion     smallint not null check (stern_passion    between 0 and 100),
  stern_commitment  smallint not null check (stern_commitment between 0 and 100),
  attach_anxiety    smallint not null check (attach_anxiety   between 0 and 100),
  attach_avoidance  smallint not null check (attach_avoidance between 0 and 100),
  attachment        attachment_type not null,

  engine_version    text not null,   -- 채점 로직 버전. 로직 변경 시 과거 결과 재현 근거

  created_at        timestamptz not null default now(),

  unique (user_id, seq)
);

comment on table public.personality_assessments is
  '5문항 제출 로그(불변). 계정당 최대 2행 = 최초 1 + 재검사 1. 재검사 제한은 이 행 수로 강제한다.';
comment on column public.personality_assessments.engine_version is
  '동일 입력·동일 버전 → 반드시 동일 출력. 결정론 계약의 감사 근거.';
```

### 4-2. `personality_profiles` — 현재 상태 (1:1)

```sql
create table public.personality_profiles (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  active_assessment_id uuid not null references public.personality_assessments(id),

  -- 추론값 (assessment 사본. 조회 편의를 위한 의도적 비정규화)
  enneagram_inferred  smallint not null check (enneagram_inferred between 1 and 9),

  -- "결과와 달라요" 수동 선택 (무제한 변경 가능)
  enneagram_override  smallint check (enneagram_override between 1 and 9),
  override_updated_at timestamptz,
  override_count      integer not null default 0,

  -- 실효 코어 = COALESCE(override, inferred)
  enneagram_effective smallint generated always as
    (coalesce(enneagram_override, enneagram_inferred)) stored,

  attachment          attachment_type not null,

  -- 3자 코드 (예: 'MSF'). 코어 변경 시 애플리케이션이 재계산해 갱신
  love_type_code      char(3) not null,

  retest_used         boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_personality_love_type on public.personality_profiles (love_type_code);

create trigger tg_personality_profiles_updated
  before update on public.personality_profiles
  for each row execute function public.tg_set_updated_at();

comment on column public.personality_profiles.enneagram_effective is
  '표시·산출에 쓰이는 실효 코어. 오버라이드가 있으면 그것을, 없으면 추론값을 따른다.';
```

### 4-3. `love_type_labels` — 36종 표시 마스터 (참조 데이터)

```sql
create table public.love_type_labels (
  code            char(3) primary key,           -- KLE, MSF …
  enneagram_core  smallint not null check (enneagram_core between 1 and 9),
  attachment      attachment_type not null,
  core_en         text not null,                 -- KEEL, MUSE …
  suffix_en       text not null,                 -- EMBER / FLARE / FROST / TIDE
  label_en        text not null,                 -- KEELEMBER …
  label_ko        text not null,                 -- 온돌 같은 원칙주의자
  copy_ko         text not null,                 -- 늘 같은 온도로 곁에 있는 사람
  description_ko  text,                          -- 상세 결과 화면용 장문
  updated_at      timestamptz not null default now(),

  unique (enneagram_core, attachment)
);

create trigger tg_love_type_labels_updated
  before update on public.love_type_labels
  for each row execute function public.tg_set_updated_at();

comment on table public.love_type_labels is
  '표시 전용 참조 데이터. 채점 룩업(호나이×하모닉 등)은 코드(src/constants)에 있으며 DB에 두지 않는다.';
```

---

## 5. 커플

```sql
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
```

### 5-1. `couple_dissolutions` — 7일 유예

```sql
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
```

### 5-2. `subscriptions` — 결제 이력

```sql
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
```

---

## 6. 아카이브 (피드 탭)

### 6-1. `dates` — 데이트 단위 클러스터

"하루 = 한 기사" 구조의 최상위 엔티티. EXIF 시공간 클러스터링 결과를 영속화한다.

```sql
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
```

### 6-2. `date_stops` — 타임라인 블록 (장소 단위)

```sql
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
```

### 6-3. `data_entries` — 업로드 원본

```sql
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
```

---

## 7. 채팅 탭

### 7-1. `messages`

채팅은 유저에게는 프라이빗 SNS이자, 기획 관점에서는 연애 온도·다정한 말들·매치 리포트의 **원재료 파이프**다.

```sql
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
```

> **규모 참고**: 메시지는 증가 속도가 가장 빠른 테이블이다. MVP에서는 단일 테이블로 충분하나, 커플당 수십만 건 규모가 되면 `sent_at` 기준 range 파티셔닝을 검토한다.

### 7-2. `stories`

24시간 후 동작이 **사진 앱 연동 여부에 따라 갈린다**.

```sql
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
```

---

## 8. 연애 온도 · 연애리그 · 연애 DNA

### 8-1. `daily_temperature` — 메인 탭 지표

```sql
create table public.daily_temperature (
  couple_id     uuid not null references public.couples(id) on delete cascade,
  date_on       date not null,

  temperature   numeric(4, 1) not null default 36.5
                  check (temperature between 0 and 100),
  factors       jsonb not null default '{}'::jsonb,   -- 대화량/응답속도/활동빈도 등 산출 근거

  computed_at   timestamptz not null default now(),

  primary key (couple_id, date_on)
);

create index idx_temperature_recent on public.daily_temperature (couple_id, date_on desc);

comment on table public.daily_temperature is
  '일 단위 배치(자정 Edge Function)로만 갱신된다. 앱은 읽기 전용 — 실시간 계산 금지.';
comment on column public.daily_temperature.temperature is
  '미연결 커플은 36.5 고정. 데이터 없는 평온한 기본 체온이라는 의미.';
```

### 8-2. `stat_snapshots` — 연애리그 6각 스탯 시계열

```sql
create table public.stat_snapshots (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id)  on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,

  period_type     stat_period_type not null,
  period_start    date not null,
  period_end      date not null,

  -- 6각 스탯 (0~100)
  pus             smallint not null check (pus between 0 and 100),  -- 연애 추진력
  emp             smallint not null check (emp between 0 and 100),  -- 감정 공감력
  att             smallint not null check (att between 0 and 100),  -- 질투·집착력
  def             smallint not null check (def between 0 and 100),  -- 멘탈 회복력
  tac             smallint not null check (tac between 0 and 100),  -- 밀당 지능
  rea             smallint not null check (rea between 0 and 100),  -- 현실 타협력

  -- OVR (120점 만점, 규준집단 백분위 매핑 = 상대평가 유지)
  ovr             smallint not null check (ovr between 0 and 120),
  ovr_percentile  numeric(5, 2) check (ovr_percentile between 0 and 100),
  position_code   text,                                  -- 연애 포지션 (네이밍 체계 미확정)

  -- 월간판 "능력치 배분표"용: 각 스탯의 입력별 기여도
  inputs          jsonb not null default '{}'::jsonb,
  -- 전기 대비 증감 (주간판 ▲▼ 표시 / 월간판 변동 해설 근거)
  delta           jsonb not null default '{}'::jsonb,

  engine_version  text not null,
  computed_at     timestamptz not null default now(),

  unique (user_id, period_type, period_start),
  constraint chk_stat_period check (period_end >= period_start)
);

create index idx_stats_timeline
  on public.stat_snapshots (couple_id, period_type, period_start desc);

comment on table public.stat_snapshots is
  '연애리그 스탯 시계열. 월간판의 "왜 스탯이 변했나" 해설은 이 테이블의 delta/inputs만으로 생성된다.';
comment on column public.stat_snapshots.ovr_percentile is
  '연애리그는 규준집단 상대평가를 유지한다(게임적 재미). 연애 DNA만 절대평가.';
```

### 8-3. `match_reports` — 주간 매치 리포트 11항목

```sql
create table public.match_reports (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,

  period_start    date not null,
  period_end      date not null,

  -- 11개 항목 (점유율/유효슈팅/패스성공률/파울/옐로카드/스코어/교체/극장골/VAR/어시스트/오프사이드)
  metrics         jsonb not null,
  -- 실측 채팅 데이터로 계산된 항목과 성격 추정 항목의 구분
  measured_keys   text[] not null default '{}',

  engine_version  text not null,
  computed_at     timestamptz not null default now(),

  unique (couple_id, period_start),
  constraint chk_match_period check (period_end >= period_start)
);

create index idx_match_reports_timeline
  on public.match_reports (couple_id, period_start desc);

comment on column public.match_reports.measured_keys is
  '실제 채팅 로그로 산출된 항목 키 목록(점유율·티키타카·어시스트 등). 나머지는 성격 벡터 추정치.';
```

### 8-4. `dna_scores` — 연애 DNA 일치율 이력

```sql
create table public.dna_scores (
  id              uuid primary key default gen_random_uuid(),
  couple_id       uuid not null references public.couples(id) on delete cascade,

  period_month    date not null,                          -- 해당 월 1일

  -- 성격 기반 고정 기저 + 채팅 변동분
  base_score      numeric(5, 2) not null check (base_score  between 50 and 100),
  chat_delta      numeric(5, 2) not null default 0,
  total_score     numeric(5, 2) not null check (total_score between 50 and 100),

  breakdown       jsonb not null default '{}'::jsonb,     -- 빅5/스턴버그/애착 축별 기여
  chat_factors    jsonb not null default '{}'::jsonb,     -- 다정 발화 비율, 왕복 자연스러움 등

  engine_version  text not null,
  computed_at     timestamptz not null default now(),

  unique (couple_id, period_month)
);

create index idx_dna_scores_timeline on public.dna_scores (couple_id, period_month desc);

comment on table public.dna_scores is
  '절대평가. 규준집단 백분위를 사용하지 않는다 — 다른 커플과 비교하는 순간 관계가 경쟁이 되기 때문.';
comment on column public.dna_scores.chat_factors is
  '양이 아닌 질 중심. 단순 메시지 수는 가중치를 낮게 두어 도배로 점수를 올리지 못하게 한다.';
```

---

## 9. 매거진

### 9-1. `issues` — 발행물

```sql
create table public.issues (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,

  issue_type          issue_type not null,
  issue_number        integer not null check (issue_number > 0),

  title               text,
  cover_path          text,                               -- 자동 생성 표지

  period_start        date not null,
  period_end          date not null,

  -- 이중 렌더링 프로필
  pdf_digital_path    text,                               -- 약 150DPI, 앱 열람용
  pdf_print_path      text,                               -- 300DPI+, 앱 접근 불가
  page_count          smallint,

  is_trial            boolean not null default false,     -- 첫 호 무료 체험
  published_at        timestamptz,

  -- 압축 시뮬레이션 추적 (MVP: 1일 = 1주차)
  publish_mode        text not null default 'production'
                        check (publish_mode in ('compressed', 'production')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (couple_id, issue_type, issue_number),
  constraint chk_issue_period check (period_end >= period_start)
);

create index idx_issues_shelf
  on public.issues (couple_id, published_at desc nulls last)
  where published_at is not null;

create trigger tg_issues_updated
  before update on public.issues
  for each row execute function public.tg_set_updated_at();

comment on column public.issues.pdf_print_path is
  '인쇄용 300DPI+ PDF. RLS/Storage 정책으로 클라이언트 접근을 차단한다. 실물 구독의 가치를 보호하기 위한 조치.';
comment on column public.issues.publish_mode is
  'compressed = MVP 검증 모드(하루를 한 주차로 취급). 발행 트리거 config와 연동된다.';
```

### 9-2. `corners` — 코너 (내용 스냅샷 보관)

```sql
create table public.corners (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid not null references public.couples(id) on delete cascade,
  issue_id            uuid references public.issues(id) on delete set null,

  corner_type         corner_type not null,
  seq                 smallint,                           -- 지면 순서

  period_start        date not null,
  period_end          date not null,

  -- ★ 렌더링에 필요한 모든 값을 복사해 담는다 (참조 아님).
  --   원본이 삭제되어도 발행 매거진이 깨지지 않게 하기 위한 핵심 설계.
  content             jsonb not null default '{}'::jsonb,

  -- 감사·표시용 참고 배열 (FK 아님. 원본 삭제 시 dangling 허용)
  source_entry_ids    uuid[] not null default '{}',
  source_message_ids  uuid[] not null default '{}',
  source_date_ids     uuid[] not null default '{}',

  status              corner_status not null default 'pending',
  skip_reason         text,                               -- 예: 다정한 발화 없음 → 스킵
  generation_attempts smallint not null default 0,
  last_error          text,

  engine_version      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint chk_corner_period check (period_end >= period_start),
  constraint chk_corner_ready  check (status <> 'ready' or content <> '{}'::jsonb)
);

create index idx_corners_issue on public.corners (issue_id, seq);
create index idx_corners_lookup
  on public.corners (couple_id, corner_type, period_start desc);
create index idx_corners_pipeline
  on public.corners (status, created_at)
  where status in ('pending', 'generating', 'failed');

create trigger tg_corners_updated
  before update on public.corners
  for each row execute function public.tg_set_updated_at();

comment on column public.corners.content is
  '원본 스냅샷. "탈퇴자 파생 데이터는 삭제하되 발행 매거진은 보존"이라는 정책은 이 스냅샷 구조 위에서만 성립한다.';
comment on column public.corners.skip_reason is
  '데이터가 없으면 억지로 만들지 않는다. 다정한 말들은 스킵, 이달의 우리는 분량 축소.';
```

### 9-3. `app_config` — 전역 설정

```sql
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger tg_app_config_updated
  before update on public.app_config
  for each row execute function public.tg_set_updated_at();

-- 초기값
insert into public.app_config (key, value, description) values
  ('publish',
   '{"mode":"compressed","compressionRatio":1,"dailyTrigger":"daily","weeklyTrigger":"daily","monthlyTrigger":"every_5_issues"}'::jsonb,
   'MVP 압축 시뮬레이션. 정식 전환 시 mode=production, weeklyTrigger=weekly, monthlyTrigger=monthly'),
  ('pdf_profiles',
   '{"digital":{"dpi":150,"scale":1.5},"print":{"dpi":300,"scale":3,"bleedMm":3}}'::jsonb,
   '이중 렌더링 프로필'),
  ('retention',
   '{"freeTierMonths":3,"lowResMaxEdgePx":1280,"lowResQuality":70}'::jsonb,
   '무료 티어 보관 정책 — 삭제가 아니라 저해상도 전환 + 열람 잠금'),
  ('map_provider', '"kakao"'::jsonb, '난항 시 google로 교체'),
  ('llm_provider', '{"provider":"tbd","model":"tbd"}'::jsonb, '선정 예정');
```

---

## 10. RLS (Row Level Security)

### 10-1. 헬퍼 함수

`couples`에도 RLS가 걸리므로, 자식 테이블 정책에서 `couples`를 직접 서브쿼리하면 재귀 평가가 발생한다. `SECURITY DEFINER`로 이를 우회한다.

```sql
-- 현재 사용자가 해당 커플의 구성원인가
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.couples c
    where c.id = p_couple_id
      and c.status <> 'dissolved'
      and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  );
$$;

-- 현재 사용자의 활성 커플 id
create or replace function public.current_couple_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.id
  from public.couples c
  where c.status in ('pending', 'active', 'dissolving')
    and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  limit 1;
$$;

-- 상대방 id (프로필 상호 열람용)
create or replace function public.partner_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case when c.user_a_id = auth.uid() then c.user_b_id else c.user_a_id end
  from public.couples c
  where c.status in ('active', 'dissolving')
    and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
  limit 1;
$$;

-- 무료 티어 잠금 여부 (열람 차단 판정)
create or replace function public.is_entry_visible(
  p_couple_id uuid, p_access_locked boolean
) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select (not p_access_locked)
      or exists (
        select 1 from public.couples c
        where c.id = p_couple_id and c.subscription_tier = 'paid'
      );
$$;

revoke execute on function public.is_couple_member(uuid)   from public;
revoke execute on function public.current_couple_id()      from public;
revoke execute on function public.partner_id()             from public;
revoke execute on function public.is_entry_visible(uuid, boolean) from public;
grant  execute on function public.is_couple_member(uuid)   to authenticated;
grant  execute on function public.current_couple_id()      to authenticated;
grant  execute on function public.partner_id()             to authenticated;
grant  execute on function public.is_entry_visible(uuid, boolean) to authenticated;
```

### 10-2. 전 테이블 RLS 활성화

```sql
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
```

### 10-3. 프로필 · 성격

```sql
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
```

### 10-4. 커플

```sql
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
```

### 10-5. 커플 공유 데이터 — 공통 패턴

```sql
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
```

### 10-6. 산출 데이터 — 읽기 전용

배치·Edge Function이 `service_role`로 쓰고, 클라이언트는 읽기만 한다.

```sql
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

-- issues: 인쇄용 PDF 경로는 뷰로 차단 (아래 10-7)
create policy issues_select on public.issues
  for select to authenticated
  using (public.is_couple_member(couple_id) and published_at is not null);

create policy app_config_select on public.app_config
  for select to authenticated using (true);
```

### 10-7. 인쇄용 PDF 차단

RLS는 행 단위라 컬럼을 숨길 수 없다. 클라이언트에는 **뷰만 노출**한다.

```sql
create view public.issues_public
with (security_invoker = true) as
select
  id, couple_id, issue_type, issue_number, title, cover_path,
  period_start, period_end,
  pdf_digital_path,          -- 인쇄용(pdf_print_path)은 의도적으로 제외
  page_count, is_trial, published_at, created_at
from public.issues;

revoke all on public.issues from anon, authenticated;
grant select on public.issues_public to authenticated;

comment on view public.issues_public is
  '클라이언트 전용 뷰. pdf_print_path(300DPI+)를 노출하지 않아 실물 구독의 가치를 보호한다.';
```

> **Storage 정책도 동일 원칙**: 인쇄용 PDF는 별도 비공개 버킷(`magazine-print`)에 두고, 클라이언트 접근 정책을 만들지 않는다. 인쇄 발주 파이프라인만 `service_role`로 접근한다.

---

## 11. 배치 작업 (Edge Function / pg_cron)

### 11-1. 스토리 만료 — 연동 여부로 분기

```sql
create or replace function public.expire_stories()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_entry_id uuid;
  v_synced boolean;
begin
  for r in
    select s.* from public.stories s
    where s.resolved_at is null and s.expires_at <= now()
    limit 500
  loop
    select p.photo_sync_enabled into v_synced
    from public.profiles p where p.id = r.author_id;

    if coalesce(v_synced, false) then
      -- 사진 앱 연동됨 → 소멸 (원본이 사진앱에 있고 피드가 자동 인식)
      update public.stories
        set resolved_at = now(), resolution = 'discarded'
        where id = r.id;
    else
      -- 미연동 → 아카이브 편입
      insert into public.data_entries
        (couple_id, author_id, entry_type, storage_path, text_content, captured_at)
      values
        (r.couple_id, r.author_id, 'photo', r.media_path, r.caption, r.created_at)
      returning id into v_entry_id;

      update public.stories
        set resolved_at = now(), resolution = 'archived', archived_entry_id = v_entry_id
        where id = r.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
```

### 11-2. 보관 정책 — 3개월 초과 저해상도 전환 + 잠금

```sql
create or replace function public.apply_retention_policy()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_count  integer;
begin
  select (value->>'freeTierMonths')::integer into v_months
  from public.app_config where key = 'retention';

  with target as (
    select e.id
    from public.data_entries e
    join public.couples c on c.id = e.couple_id
    where c.subscription_tier = 'free'
      and e.resolution_tier = 'original'
      and e.deleted_at is null
      and e.captured_at < (now() - make_interval(months => v_months))
    limit 1000
  )
  update public.data_entries e
     set access_locked = true          -- 삭제하지 않는다. 잠글 뿐이다.
   from target t
  where e.id = t.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

> ⚠️ 위 함수는 **잠금 플래그만** 처리한다. 실제 저해상도 변환·원본 삭제는 Storage 작업이므로 Edge Function에서 수행하고, 완료 후 `resolution_tier='low'`, `downgraded_at=now()`로 갱신한다. 유료 전환 시에는 `access_locked=false`로 되돌리면 저해상도 사본이 즉시 열람 가능해진다.

```sql
-- 유료 전환 시 잠금 해제
create or replace function public.unlock_on_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subscription_tier = 'paid' and old.subscription_tier = 'free' then
    update public.data_entries
       set access_locked = false
     where couple_id = new.id and access_locked = true;
  end if;
  return new;
end;
$$;

create trigger tg_unlock_on_upgrade
  after update of subscription_tier on public.couples
  for each row execute function public.unlock_on_upgrade();
```

### 11-3. 7일 유예 파기 — 개시자 파생 데이터만

```sql
create or replace function public.execute_dissolution(p_dissolution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d           record;
  v_partner   uuid;
  v_both_gone boolean;
begin
  select * into d from public.couple_dissolutions
   where id = p_dissolution_id
     and cancelled_at is null and executed_at is null
     and purge_scheduled_at <= now();
  if not found then return; end if;

  -- 개시자 파생 데이터만 파기. 상대 데이터는 유지.
  delete from public.data_entries where couple_id = d.couple_id and author_id = d.initiated_by;
  delete from public.messages     where couple_id = d.couple_id and sender_id = d.initiated_by;
  delete from public.stories      where couple_id = d.couple_id and author_id = d.initiated_by;
  delete from public.stat_snapshots where couple_id = d.couple_id and user_id = d.initiated_by;

  update public.profiles
     set reference_photo_path = null,
         biometric_consent_revoked_at = coalesce(biometric_consent_revoked_at, now())
   where id = d.initiated_by;

  -- 발행 매거진(issues/corners)은 보존한다.
  -- corners.content가 스냅샷이므로 원본 삭제와 무관하게 무결하다.

  select case when c.user_a_id = d.initiated_by then c.user_b_id else c.user_a_id end
    into v_partner
    from public.couples c where c.id = d.couple_id;

  select (v_partner is null)
      or exists (select 1 from public.profiles p
                  where p.id = v_partner and p.deleted_at is not null)
    into v_both_gone;

  if v_both_gone then
    -- 양쪽 모두 이탈 → 매거진까지 전부 파기
    delete from public.corners where couple_id = d.couple_id;
    delete from public.issues  where couple_id = d.couple_id;
    delete from public.dates   where couple_id = d.couple_id;
    delete from public.couples where id = d.couple_id;
  else
    update public.couples
       set status = 'dissolved', dissolved_at = now()
     where id = d.couple_id;
  end if;

  update public.couple_dissolutions set executed_at = now() where id = d.id;
end;
$$;
```

### 11-4. pg_cron 스케줄

```sql
select cron.schedule('expire-stories',    '*/15 * * * *',
  $$ select public.expire_stories(); $$);

select cron.schedule('retention-policy',  '0 4 * * *',
  $$ select public.apply_retention_policy(); $$);

select cron.schedule('execute-dissolutions', '0 5 * * *', $$
  select public.execute_dissolution(id)
  from public.couple_dissolutions
  where cancelled_at is null and executed_at is null and purge_scheduled_at <= now();
$$);
```

> 연애 온도 산출, 스탯 계산, 코너 생성, PDF 렌더링은 LLM·Playwright가 필요하므로 pg_cron이 아니라 **Edge Function 스케줄러**로 실행한다.

---

## 12. Storage 버킷

| 버킷 | 공개 | 용도 | 접근 |
|---|---|---|---|
| `avatars` | 비공개 | 프로필·대표사진 | 커플 구성원 |
| `entries` | 비공개 | 피드 사진·드로잉 | 커플 구성원 (잠금 반영) |
| `messages` | 비공개 | 채팅 미디어 | 커플 구성원 |
| `stories` | 비공개 | 스토리 미디어 | 커플 구성원 |
| `magazine` | 비공개 | 표지 + **디지털 PDF** | 커플 구성원 |
| `magazine-print` | 비공개 | **인쇄용 PDF** | **service_role 전용 — 클라이언트 정책 없음** |

```sql
-- 예시: entries 버킷 (경로 규칙 = {couple_id}/{entry_id}.{ext})
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

-- magazine-print: 정책을 만들지 않는다 = 클라이언트 접근 불가
```

---

## 13. 마이그레이션 순서

의존성 순서대로 파일을 나눈다.

```
supabase/migrations/
├── 001_extensions_and_helpers.sql   -- 확장, tg_set_updated_at
├── 002_enums.sql                    -- 전체 ENUM
├── 003_profiles.sql                 -- profiles
├── 004_personality.sql              -- assessments, profiles, love_type_labels
├── 005_couples.sql                  -- couples, dissolutions, subscriptions
├── 006_archive.sql                  -- dates, date_stops, data_entries
├── 007_chat.sql                     -- messages, stories
├── 008_metrics.sql                  -- daily_temperature, stat_snapshots,
│                                    --   match_reports, dna_scores
├── 009_magazine.sql                 -- issues, corners, issues_public 뷰
├── 010_app_config.sql               -- app_config + 초기값
├── 011_rls_helpers.sql              -- is_couple_member 등
├── 012_rls_policies.sql             -- 전 테이블 정책
├── 013_batch_functions.sql          -- expire_stories 등
├── 014_cron.sql                     -- pg_cron 스케줄
├── 015_storage_policies.sql         -- 버킷 정책
└── 016_seed_love_type_labels.sql    -- 36종 라벨 시드
```

---

## 14. 검증 쿼리 (Part 13 완료 기준 대응)

```sql
-- [13-8-1] RLS 미적용 테이블 탐지 → 결과가 0행이어야 한다
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- [13-7-4] 보관 정책이 촬영일 기준인지 (업로드일 기준이면 위반)
select count(*) as violations
from public.data_entries e
join public.couples c on c.id = e.couple_id
where c.subscription_tier = 'free'
  and e.access_locked = true
  and e.captured_at >= now() - interval '3 months';

-- [13-5-5] 클라이언트에 인쇄용 PDF가 노출되지 않는지
select count(*) as leaked
from information_schema.columns
where table_schema = 'public'
  and table_name  = 'issues_public'
  and column_name = 'pdf_print_path';   -- 0이어야 한다

-- [13-6-1] 재검사 1회 제한 위반 탐지
select user_id, count(*)
from public.personality_assessments
group by user_id having count(*) > 2;

-- [13-6-4] 파기 후 상대 데이터 잔존 확인 (보존되어야 정상)
select author_id, count(*)
from public.data_entries
where couple_id = :couple_id
group by author_id;

-- [0-5] 얼굴 임베딩 컬럼이 존재하지 않는지 → 0행이어야 한다
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (column_name ilike '%embedding%'
    or column_name ilike '%face_vector%'
    or column_name ilike '%descriptor%');
```

---

## 15. 초안 대비 변경 요약

| 초안 | 확정 | 사유 |
|---|---|---|
| `users` | `profiles` (auth.users 확장) | Supabase Auth 표준 |
| `personality_profiles` 단일 | `assessments` + `profiles` 분리 | 재검사 1회 제한 + 원본 보존 |
| — | `dates`, `date_stops` 신설 | 클러스터링 영속화, "하루=한 기사" |
| — | `stat_snapshots` 신설 | 연애리그 변동 해설의 근거 |
| — | `match_reports` 신설 | 주간 기록의 월간 집계 |
| — | `dna_scores` 신설 | 채팅 변동성 반영 이력 |
| `messages` 단일 | `messages` + `stories` 분리 | 만료·분기 로직이 다름 |
| `corners.source_entry_ids` 참조 | `content` 스냅샷 | 원본 삭제와 매거진 보존의 양립 |
| `issues` 직접 노출 | `issues_public` 뷰 | 인쇄용 PDF 차단 |
| — | `app_config` 신설 | 발행 주기·프로필·프로바이더 config화 |
| — | `love_type_labels` 신설 | 36종 라벨. 채점 룩업은 코드에 유지 |
| 3개월 초과 삭제 | `access_locked` + 저해상도 | 지우지 않고 잠근다 |
| — | `couple_dissolutions` 신설 | 7일 유예 + 파생 데이터만 파기 |

---

## 16. 남은 결정

- [ ] `stat_snapshots.position_code` — 연애 포지션(애니어그램×빅5) 네이밍 체계 미확정
- [ ] `corners.content` 스키마 — 코너 타입별 jsonb 구조 정의 (12종 각각)
- [ ] `messages` 파티셔닝 임계치 — 커플당 메시지 수가 어느 규모에서 필요한지
- [ ] 저해상도 변환 실제 파라미터 — 현재 `app_config`에 1280px/quality 70으로 임시 설정
- [ ] `engine_version` 관리 정책 — 로직 변경 시 과거 결과 재계산 여부
