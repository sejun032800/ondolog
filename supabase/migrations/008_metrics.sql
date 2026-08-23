-- ─────────────────────────────────────────────
-- 8-1. daily_temperature — 메인 탭 지표
-- ─────────────────────────────────────────────
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

alter table public.daily_temperature enable row level security;

-- ─────────────────────────────────────────────
-- 8-2. stat_snapshots — 연애리그 6각 스탯 시계열
-- ─────────────────────────────────────────────
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

alter table public.stat_snapshots enable row level security;

-- ─────────────────────────────────────────────
-- 8-3. match_reports — 주간 매치 리포트 11항목
-- ─────────────────────────────────────────────
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

alter table public.match_reports enable row level security;

-- ─────────────────────────────────────────────
-- 8-4. dna_scores — 연애 DNA 일치율 이력
-- ─────────────────────────────────────────────
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

alter table public.dna_scores enable row level security;

-- 4개 테이블 모두 정책(§10-6)은 is_couple_member() 헬퍼(011_rls_helpers.sql)에
-- 의존하므로 012_rls_policies.sql에서 생성한다. 쓰기는 service_role(배치)만 수행하며
-- 클라이언트용 INSERT/UPDATE 정책은 의도적으로 두지 않는다.
