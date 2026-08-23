-- ─────────────────────────────────────────────
-- 4-1. personality_assessments — 불변 제출 로그
-- ─────────────────────────────────────────────
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

alter table public.personality_assessments enable row level security;

-- ─────────────────────────────────────────────
-- 4-2. personality_profiles — 현재 상태 (1:1)
-- ─────────────────────────────────────────────
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

alter table public.personality_profiles enable row level security;

-- ─────────────────────────────────────────────
-- 4-3. love_type_labels — 36종 표시 마스터 (참조 데이터)
-- ─────────────────────────────────────────────
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

alter table public.love_type_labels enable row level security;

-- 정책 본문(§10-3)은 partner_id() 헬퍼(011_rls_helpers.sql)에 의존하므로
-- 012_rls_policies.sql에서 SCHEMA.md 원문 그대로 생성한다.
-- (love_type_labels의 전체공개 읽기 정책도 012에서 일괄 생성한다)
