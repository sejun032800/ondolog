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
