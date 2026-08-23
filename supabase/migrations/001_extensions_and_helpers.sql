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
