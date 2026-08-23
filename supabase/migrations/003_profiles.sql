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

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
-- 정책 본문(§10-3)은 partner_id() 헬퍼(011_rls_helpers.sql)에 의존하므로
-- 012_rls_policies.sql에서 SCHEMA.md 원문 그대로 생성한다.
-- 단, "RLS 없이 테이블 생성 금지" 원칙에 따라 테이블 생성 즉시 RLS를 활성화한다.
-- (정책이 없는 상태의 RLS 활성화 = 전체 차단. 안전한 기본값이다.)
alter table public.profiles enable row level security;
