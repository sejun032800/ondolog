# 진행 상황

최종 갱신: 2026-08-24

## 현재 Phase

Phase 2 — 엔진 ✅ 완료

## 완료

- [x] Phase 0 — 프로젝트 셋업
  - Expo SDK 57, Expo Router, TypeScript strict
  - EAS Dev Build (Android) 실기기 동작 확인
  - Supabase 프로젝트 생성(서울 리전, ap-northeast-2) + link + 연결 확인
  - docs/ 기획 문서 4종, CLAUDE.md, .claude/ 골격

- [x] Phase 1 — DB 마이그레이션 + RLS
  - `supabase/migrations/001~016_*.sql` 작성 완료, SCHEMA.md §13 순서 그대로
    - 001~012: 기존 파일 SCHEMA.md 원문 대조 검증 완료(수정 없음, 그대로 채택)
    - 013_batch_functions.sql: expire_stories / apply_retention_policy /
      unlock_on_upgrade / execute_dissolution (SCHEMA.md §11 원문 +
      revoke execute from public 보강)
    - 014_cron.sql: pg_cron 확장 활성화 + 3개 스케줄(expire-stories 15분,
      retention-policy 매일 04:00, execute-dissolutions 매일 05:00)
    - 015_storage_policies.sql: 6개 버킷 생성(전부 비공개) + entries/messages/
      stories/magazine 정책, avatars/magazine-print는 정책 없음(의도적)
    - 016_seed_love_type_labels.sql: 콘텐츠 미확정으로 INSERT 없음(사유 기록)
  - 원격(Supabase) 적용: 001~005 / 006~010 / 011~016 세 묶음 순차 push,
    전부 성공. `migration list`로 local=remote 16개 전부 확인.
  - `.env` 파싱 에러(LegacyDbConfigLoadError) 원인 규명 및 해결 — PowerShell
    히어독 사고로 `.env`에 명령문 원문이 그대로 기록되어 있었음. 재작성으로
    해결(anon key는 플레이스홀더 상태로 남음, HANDOFF.md 참조).
  - `src/types/database.ts` 생성 완료 (`supabase gen types typescript --linked`)
  - 검증 결과: 아래 참조

## Phase 1 검증 결과 (SCHEMA.md §14 + 완료기준)

| # | 검증 항목 | 쿼리 | 결과 | 판정 |
|---|---|---|---|---|
| 1 | RLS 미적용 테이블 | pg_class/pg_namespace | 0행 | ✅ |
| 2 | 보관정책 촬영일 기준 위반 | data_entries/couples | violations=0 | ✅ |
| 3 | issues_public에 pdf_print_path 노출 | information_schema.columns | leaked=0 | ✅ |
| 4 | 재검사 1회(계정당 2행) 제한 위반 | personality_assessments | 0행 | ✅ |
| 5 | 파기 후 상대 데이터 잔존(참고용) | data_entries by author_id | 0행(데이터 없음, 재실행 필요) | ⚠ 참고 |
| 6 | 얼굴 임베딩/특징벡터 컬럼 존재 | information_schema.columns | 0행 | ✅ |

- 5번은 아직 실제 couple/dissolution 데이터가 없어 "위반 없음"이 아니라
  "테스트 데이터 없음"이 정확한 해석. Phase 6(피드) 이후 실사용 데이터로
  재검증 필요.
- 테이블 19개 전부 생성 확인(profiles, personality_assessments,
  personality_profiles, love_type_labels, couples, couple_dissolutions,
  subscriptions, dates, date_stops, data_entries, messages, stories,
  daily_temperature, stat_snapshots, match_reports, dna_scores, issues,
  corners, app_config).
- pg_cron 작업 3개 active 확인. storage.buckets 6개 전부 비공개(public=false)
  확인. love_type_labels 0행(콘텐츠 미확정, 의도적) 확인.

- [x] Phase 2 — 엔진 (`engine-dev`)
  - **constants** (`src/constants/`) — 룩업 테이블, 전부 DB 조회 없이 코드
    상수로 고정(결정론 보호)
    - `enneagram.ts` — 호나이×하모닉 9칸 교차표(HORNEVIAN_HARMONIC_TABLE,
      Part 10-2-1 원문 그대로)
    - `enneagramPrevalence.ts` — MBTI별 애니어그램 사전분포(Part 10-2-6).
      채점 로직과 물리적으로 분리된 별도 파일(재수출 없음) — 희귀 배지·
      선택지 노출 순서 전용, 채점에는 미사용을 코드 경계로 강제
    - `attachment.ts` — 애착 2×2 교차표(Part 10-2-3) + 애착 축 수치화
      (Part 17-3, 20/50/85)
    - `loveTypeLabels.ts` — 36종 라벨 코드 매핑(Part 10-5-2 원문 그대로:
      code/core_en/suffix_en/label_en/label_ko/copy_ko). description_ko는
      Part 16 열린 과제라 전부 null(지어내지 않음)
    - `quickMbti.ts` — MBTI "몰라요" 간이 4문항 A/B→글자 매핑(Part 9-1)
    - `quizTypes.ts` — QuizChoice/MbtiType 공통 타입
  - **data** — `src/data/onboardingQuestions.ts`: 16유형 × 5문항 = 80문항.
    Part 10-3 원문과 자동 diff로 프롬프트 80개·선택지 240개 전부 불일치
    0건 확인(요약·의역 없음)
  - **engine** (`src/engine/`) — 전부 순수 함수, Math.random/Date.now()/
    new Date()/process.env 미사용을 정적 테스트로 강제
    - `loveTypeInference.ts` — 애니어그램 코어/빅5/스턴버그/애착/3자 코드
      채점(Part 10-2) + MBTI "몰라요" 4문항→4글자 코드 수렴
      (resolveMbtiFromQuickQuiz)
    - `leagueStats.ts` — 6각 스탯(PUS/EMP/ATT/DEF/TAC/REA, Part 17-3 가중
      합) + OVR 캘리브레이션 표(percentileRank/mapPercentileToOvr)
    - `temperature.ts` — 연애 온도 유틸(미연결 기본값 36.5, 0~100 클램프,
      소수 1자리) — **결합 공식은 미구현**(아래 미확정 항목 참조)
    - `dnaScore.ts` — DNA 일치율 유틸(하한 50, total=base+chat_delta,
      절대평가 — population/percentile 매개변수 자체가 없음) — **base_score
      궁합 공식은 미구현**(아래 참조)
    - `numeric.ts` — 공용 반올림/클램프(모든 필드가 반환 직전 단 한 번만
      반올림하도록 강제)
  - **tests** (`__tests__/engine/*.test.ts`) — 6개 스위트, **94개 전부
    통과** (`npx jest --ci --watchAll=false`). 포함 내용: 동일 입력 100회
    반복 결정론(4개 모듈), 호나이×하모닉 9칸 전수, 애착 2×2 전수, 16유형
    ×3⁵ 조합 중 결정론적 샘플링 100개의 loveTypeCode 유효성, MBTI 4문항
    →16종 전수 수렴, OVR 0~120 범위, DNA 하한 50, import 경계(사전분포
    미참조), Math.random/Date.now()/new Date()/process.env 부재 정적 검사

## 미확정 4곳 — 자리표시자 상태 (문서 대조로 "원문 없음" 확인됨)

아래 4곳은 마스터 문서 전체 grep 대조로 원문이 어디에도 없음을 확인한 뒤,
지어내지 않고 자리표시자로 남긴 것을 코디네이터가 승인함(2026-08-24).
상세 사유는 각 파일 상단 docblock과 DECISIONS.md 2026-08-24 항목 참조.

1. **연애 온도 결합 공식** (`src/engine/temperature.ts`) — Part 9-2는
   "선행 프로젝트의 연애 일치율 로직 계승"이라고만 하고 그 로직 원문이
   문서 어디에도 없음. 대화량/응답속도/감정 톤을 실제로 결합하는 함수
   자체가 없음(기본값·클램프만 구현).
2. **DNA base_score 궁합 공식** (`src/engine/dnaScore.ts`) — Part 17-2는
   "빅5·애니어그램·스턴버그·애착 조합"이라고만 하고 가중치가 없음.
   애니어그램 9×9 best/worst 궁합 매트릭스도 Part 16-1 미확정.
3. **OVR 포지션 가중치** (`src/engine/leagueStats.ts` `computeOvrRawScore`)
   — Part 17-3 처리 순서 ②(피파 포지션별 가중 로직)의 가중치 표가 없음.
   연애 포지션 네이밍 자체가 Part 16-1 미확정. 현재는 6개 스탯 단순 평균.
4. **베이지안 수축(shrinkage) 보정** (`src/engine/leagueStats.ts`) —
   "설계 원칙"으로만 언급되고 사전평균·수축 강도 등 구체 파라미터가 없음.
   미구현.

## 스키마 불일치 발견 (기록만, 직접 수정하지 않음 — db-architect 영역)

- `daily_temperature` 테이블(SCHEMA.md §8-1)에 `engine_version` 컬럼이
  없다. `personality_assessments`/`stat_snapshots`/`dna_scores` 3개
  테이블은 전부 `engine_version text not null`을 갖는데 이 테이블만 없어
  일관성이 깨져 있다. `temperature.ts`에는 버전 상수(`TEMPERATURE_ENGINE_VERSION`)
  를 뒀지만 저장할 DB 컬럼이 없는 상태 — 컬럼 추가 여부는 db-architect 판단 필요.

## 진행 중

- (없음)

## 막힌 것

- iOS Dev Build 미완 (Apple Developer 계정 필요, Phase 3 전까지 처리)
- `.env`의 anon key가 플레이스홀더 상태 (HANDOFF.md 참조, 대시보드에서 복사 필요)
- avatars Storage 버킷 정책 미정 (경로 규칙 확정 필요, HANDOFF.md 참조)
- love_type_labels 36종 **네이밍·카피는 확보됨**(`src/constants/loveTypeLabels.ts`,
  Part 10-5-2 원문 반영 완료). `description_ko`(장문 설명)만 Part 16 열린
  과제로 미확정 — 016 마이그레이션 INSERT 시 참조 가능 (HANDOFF.md 참조)
- 위 "미확정 4곳"(온도 결합공식/DNA base_score 궁합공식/OVR 포지션
  가중치/베이지안 수축보정) — Phase 3 착수와 무관하게 별도 확정 필요

## 다음

Phase 3 — 온보딩 8화면 (`ui-builder` 위임)
