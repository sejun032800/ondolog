-- ─────────────────────────────────────────────
-- 9-1. issues — 발행물
-- ─────────────────────────────────────────────
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

alter table public.issues enable row level security;

-- ─────────────────────────────────────────────
-- 9-2. corners — 코너 (내용 스냅샷 보관)
-- ─────────────────────────────────────────────
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

alter table public.corners enable row level security;

-- issues/corners의 정책(§10-6)은 is_couple_member() 헬퍼(011_rls_helpers.sql)에
-- 의존하므로 012_rls_policies.sql에서 생성한다.

-- ─────────────────────────────────────────────
-- 10-7. issues_public — 인쇄용 PDF 차단 뷰
-- ─────────────────────────────────────────────
-- RLS는 행 단위라 컬럼을 숨길 수 없다. 클라이언트에는 뷰만 노출한다.
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
