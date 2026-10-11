-- 발행 경로: issues 번호·유일성, corner_batches, corners CHECK, 테마 복사 트리거,
-- ops_alerts, fn_publish_issue, fn_issue_progress, magazine 버킷 쓰기 정책 제거.
-- 근거: docs/ONDOLOG_SCHEMA.md §9-D (9-D-1 ~ 9-D-8). MASTER §17-0-10.
-- 001~021은 이미 적용된 것이라 고치지 않는다. 022는 alter로 얹는다.
--
-- 적용 전 관문(위반 행 0건 확인)은 SCHEMA §9-D 머리의 두 쿼리이며, 이 파일에 넣지 않는다.
-- 적용은 사람이 확인한 뒤에 한다.

-- ─────────────────────────────────────────────
-- 9-D-1. issues — 번호는 발행할 때, 초안은 기간당 하나
-- ─────────────────────────────────────────────

alter table public.issues alter column issue_number drop not null;

alter table public.issues add constraint chk_issue_number_published
  check (published_at is null or issue_number is not null);

alter table public.issues add constraint uq_issues_period
  unique (couple_id, issue_type, period_start);

-- ─────────────────────────────────────────────
-- 9-D-2. 배치 추적 · 사용량
-- ─────────────────────────────────────────────

create table public.corner_batches (
  id                 uuid primary key default gen_random_uuid(),
  provider_batch_id  text not null unique,
  status             text not null default 'in_progress'
                       check (status in ('in_progress', 'ended')),
  request_count      integer not null check (request_count > 0),
  submitted_at       timestamptz not null default now(),
  ended_at           timestamptz
);

alter table public.corner_batches enable row level security;   -- 정책 없음 = service_role 전용

alter table public.corners
  add column batch_id  uuid references public.corner_batches(id) on delete set null,
  add column llm_usage jsonb;

create index idx_corners_batch on public.corners (batch_id) where batch_id is not null;

comment on column public.corners.llm_usage is
  '마지막 요청의 사용량(입력·출력·캐시 읽기·캐시 쓰기 토큰). 캐시 적중 실측과 usage_over 경보의 근거.';

-- ─────────────────────────────────────────────
-- 9-D-3. corners — 실패 사유 CHECK, 요청 상한
-- ─────────────────────────────────────────────

alter table public.corners add constraint chk_corner_skip_reason
  check (skip_reason is null or skip_reason in
    ('insufficient_input', 'generation_failed', 'schema_invalid', 'forbidden_content'));

alter table public.corners add constraint chk_corner_attempts
  check (generation_attempts between 0 and 3);

comment on column public.corners.skip_reason is
  '실패 사유 4값(MASTER 17-0-5). insufficient_input이면 status=skipped, 나머지는 failed.';
comment on column public.corners.generation_attempts is
  '이 코너에 보낸 LLM 요청 수(누적, 라운드 포함). 상한 3은 제출 단계의 조건부 UPDATE와 이 CHECK가 강제한다.';

-- ─────────────────────────────────────────────
-- 9-D-4. 발행 시 테마 복사 트리거
-- ─────────────────────────────────────────────

create or replace function public.fn_issues_theme_on_publish()
returns trigger language plpgsql as $$
begin
  if old.published_at is null and new.published_at is not null then
    new.theme := (select magazine_theme from public.couples where id = new.couple_id);
  end if;
  return new;
end;
$$;

create trigger tg_issues_theme_on_publish
  before update on public.issues
  for each row execute function public.fn_issues_theme_on_publish();

-- ─────────────────────────────────────────────
-- 9-D-5. 운영 경보
-- ─────────────────────────────────────────────

create table public.ops_alerts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('couple_membership', 'usage_over')),
  couple_id    uuid references public.couples(id) on delete cascade,
  issue_id     uuid references public.issues(id)  on delete cascade,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index idx_ops_alerts_open on public.ops_alerts (issue_id) where resolved_at is null;

alter table public.ops_alerts enable row level security;   -- 정책 없음 = service_role 전용

comment on column public.ops_alerts.detail is
  'ID만 담는다. 채팅 원문·이름·사진 경로를 넣지 않는다.';

-- ─────────────────────────────────────────────
-- 9-D-6. 발행 확정 함수
-- ─────────────────────────────────────────────

create or replace function public.fn_publish_issue(p_issue_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_issue  public.issues%rowtype;
  v_next   integer;
  v_trial  boolean;
begin
  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'issue % not found', p_issue_id;
  end if;

  -- 같은 커플의 동시 발행이 같은 번호를 받지 않게 커플 행을 잠근다
  perform 1 from public.couples
   where id = v_issue.couple_id and status = 'active' for update;
  if not found then
    raise exception 'couple % is not active', v_issue.couple_id;
  end if;

  if v_issue.published_at is not null then
    raise exception 'issue % already published', p_issue_id;
  end if;
  if exists (select 1 from public.ops_alerts
              where issue_id = p_issue_id and resolved_at is null) then
    raise exception 'issue % has an open alert', p_issue_id;
  end if;
  if not exists (select 1 from public.corners
                  where issue_id = p_issue_id and status = 'ready') then
    raise exception 'issue % has no ready corner', p_issue_id;
  end if;

  select coalesce(max(issue_number), 0) + 1 into v_next
    from public.issues
   where couple_id = v_issue.couple_id and issue_type = v_issue.issue_type
     and published_at is not null;

  select not exists (select 1 from public.issues
                      where couple_id = v_issue.couple_id and published_at is not null)
    into v_trial;

  update public.corners set status = 'published'
   where issue_id = p_issue_id and status = 'ready';

  update public.dates d
     set last_featured_at = now(), feature_count = d.feature_count + 1
   where d.couple_id = v_issue.couple_id
     and d.id in (select unnest(c.source_date_ids) from public.corners c
                   where c.issue_id = p_issue_id
                     and c.corner_type = 'date_archive'
                     and c.status = 'published');

  update public.issues
     set issue_number = v_next, is_trial = v_trial, published_at = now()
   where id = p_issue_id;           -- §9-D-4 트리거가 theme를 채운다
end;
$$;

revoke all on function public.fn_publish_issue(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 9-D-7. 초안 진행 상황 RPC
-- ─────────────────────────────────────────────

create or replace function public.fn_issue_progress()
returns table (
  issue_id     uuid,
  issue_type   issue_type,
  period_start date,
  period_end   date,
  corner_type  corner_type,
  status       corner_status,
  skip_reason  text
)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.issue_type, i.period_start, i.period_end,
         c.corner_type, c.status, c.skip_reason
    from public.issues i
    join public.corners c on c.issue_id = i.id
   where i.published_at is null
     and public.is_couple_member(i.couple_id);
$$;

revoke all on function public.fn_issue_progress() from public, anon;
grant execute on function public.fn_issue_progress() to authenticated;

-- ─────────────────────────────────────────────
-- 9-D-8. magazine 버킷 — 클라이언트 쓰기 없음
-- ─────────────────────────────────────────────
-- 015의 구성원 INSERT 정책을 지운다. SELECT(magazine_storage_select)는 그대로 둔다.
-- 015 이후 magazine 버킷의 UPDATE·DELETE 정책은 저장소에 없다(없으므로 지우지 않는다).

drop policy if exists magazine_storage_insert on storage.objects;
