# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료된 항목은 즉시 삭제할 것** — 누적되면 컨텍스트가 오염된다.

## Phase 2(엔진) 완료 — 엔진 산출 타입 요약 (Phase 3이 바로 가져다 쓰는 용도)

전부 `src/engine/*.ts`에서 export. 파일 경로·시그니처만 정리 — 구현
세부사항은 각 파일 상단 docblock 참조.

- **`src/engine/loveTypeInference.ts`**
  - `inferLoveType(input: LoveTypeInput): LoveTypeInferenceResult` —
    5문항 채점 최상위 진입점.
    - `LoveTypeInput = { mbti: MbtiType; q1..q5: QuizChoice }`
    - `LoveTypeInferenceResult = { engineVersion: string; enneagramCore: EnneagramCore;
      big5: Big5Scores; sternberg: SternbergScores; attachAnxiety: number;
      attachAvoidance: number; attachment: AttachmentType; loveTypeCode: string }`
  - `resolveMbtiFromQuickQuiz(answers: QuickMbtiAnswers): MbtiType` —
    화면 3 "MBTI 몰라요" 4문항(E/I,S/N,F/T,J/P) → 4글자 코드. 온보딩
    화면 3 구현 시 이 함수를 바로 쓰면 됨(`src/constants/quickMbti.ts`의
    `QuickMbtiAnswers` 타입과 세트).
  - 개별 단계 함수(`computeEnneagramCore`/`computeBig5`/`computeAttachment`/
    `computeSternberg`/`computeLoveTypeCode`)도 전부 export돼 있어 화면
    7(상세 결과)의 "빅5 막대그래프", "스턴버그 삼각형" 등 부분 렌더링에
    개별 호출 가능.
  - `LOVE_TYPE_ENGINE_VERSION`(현재 `'1.0.0'`) — `personality_assessments.engine_version`
    저장 시 이 값을 그대로 쓸 것.
  - 라벨 표시 문자열(label_ko/copy_ko 등)은 `src/constants/loveTypeLabels.ts`의
    `LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]`로 조회.

- **`src/engine/leagueStats.ts`**
  - `computeSixStats(input: SixStatsInput): SixStats` —
    `SixStatsInput = { big5, sternberg, q1, q2, attachAnxiety, attachAvoidance }`
    (loveTypeInference 출력에서 그대로 조립 가능),
    `SixStats = { pus, emp, att, def, tac, rea }`(전부 0~100).
  - `computeOvrRawScore(stats: SixStats): number` — **자리표시자**(포지션
    가중치 없음, 6개 스탯 단순 평균). 아래 "Phase 3 착수 전" 목록 참조.
  - `percentileRank(rawScore, populationRawScores: readonly number[]): number`
    — 모집단 원점수 배열을 호출부(배치 잡)가 직접 공급해야 함.
  - `mapPercentileToOvr(percentile: number): number` — Part 17-3
    캘리브레이션 표 그대로(0~120).
  - `LEAGUE_STATS_ENGINE_VERSION`(`'1.0.0'`) → `stat_snapshots.engine_version`.

- **`src/engine/temperature.ts`**
  - `resolveDisconnectedTemperature(): number` — 항상 36.5.
  - `clampTemperature(rawScore: number): number` — 0~100, 소수 1자리로
    정규화만 함(값을 만드는 결합 공식은 없음 — 아래 참조).
  - 앱 클라이언트에서 호출 금지 — 이 함수들은 일 배치(Edge Function) 전용.

- **`src/engine/dnaScore.ts`**
  - `clampDnaScore(rawScore: number): number` — 50~100, 소수 2자리.
  - `computeTotalScore(baseScore: number, chatDelta: number): number` —
    `clampDnaScore(baseScore + chatDelta)`. base_score를 만드는 궁합
    공식은 없음(아래 참조). population/percentile 인자를 받는 함수가
    이 파일에 아예 없음(절대평가 구조 강제).
  - `DNA_SCORE_ENGINE_VERSION`(`'1.0.0'`) → `dna_scores.engine_version`.

## Phase 3(온보딩 UI) 착수 전 처리 필요한 것

1. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   값이 `eyJhbGci...`로 잘려 있어 실제 JWT가 아니다(원인: 과거 PowerShell
   히어독 사고로 `.env` 원본이 손상됨, DECISIONS.md 2026-08-23 참조).
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 `.env`에 채워 넣어야 앱 클라이언트(`src/services/supabase`)가
   동작한다. Phase 3에서 Supabase 클라이언트를 초기화하기 전에 처리.

2. **`avatars` Storage 버킷에 클라이언트 정책이 없다(의도적, 전면 차단)** —
   개인 대표사진(`profiles.reference_photo_path`)과 커플 대표사진
   (`couples.reference_photo_path`)이 버킷을 공유하는데 경로 규칙
   (`{user_id}/...` vs `{couple_id}/...`)이 SCHEMA.md에 없어 결정을 미뤘다.
   Phase 3(온보딩, 대표사진 업로드 UI) 착수 전 경로 규칙을 확정하고
   `supabase/migrations/`에 후속 마이그레이션(017 등)으로 정책을 추가해야
   업로드가 동작한다.

3. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2는
   "선행 프로젝트의 연애 일치율 로직 계승, 명칭만 변경"이라고만 하고 그
   원문이 이 저장소 어디에도 없다(마스터·SCHEMA·ORCHESTRATION·ROADMAP
   전체 확인). 대화량/응답속도/감정 톤을 실제로 결합해 온도값을 만드는
   함수가 없음 — 기본값(36.5)·클램프(0~100, 소수 1자리)만 구현된 상태.
   선행 프로젝트 원문을 확보하거나 신규 설계가 확정되면 이 파일에 결합
   함수를 추가. (엔진 기능이라 UI 작업과 직접 충돌하진 않지만, 온보딩
   이후 메인 탭 히어로 영역이 이 값을 표시하므로 Phase 3~4 사이 확정 필요.)

4. **DNA base_score 궁합 공식 + 애니어그램 9×9 best/worst 매트릭스가 없다**
   (`src/engine/dnaScore.ts`) — Part 17-2는 "빅5·애니어그램·스턴버그·애착
   조합"이라고만 하고 가중치가 없다. Part 16-1의 "best/worst 궁합 매트릭스
   정의(애니어그램 9×9 기준)"도 미확정. 선행 프로젝트 원문 또는 신규 설계
   필요. 화면 7(상세 결과)의 "best/worst 궁합 유형" 노출 항목과도 연결됨.

5. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`의 `computeOvrRawScore`) — Part 17-3 처리
   순서 ②(피파 포지션별 가중 로직 차용)의 가중치 표가 없고, Part 16-1의
   "연애 포지션(애니어그램×빅5) 정식 네이밍 체계"도 미확정. 현재
   `computeOvrRawScore`는 6개 스탯 단순 평균으로 자리표시 중.

6. **베이지안 수축(shrinkage) 보정 파라미터가 없다** (`src/engine/leagueStats.ts`)
   — Part 17-3 "설계 원칙"에 원칙만 언급되고 사전평균·수축 강도 등 구체
   수치가 없어 미구현. 5문항 표본이 적어 극단값이 그대로 남는 상태.

7. **`daily_temperature.engine_version` 컬럼 부재** — SCHEMA.md §8-1
   `daily_temperature`에는 다른 3개 산출 테이블(personality_assessments/
   stat_snapshots/dna_scores)과 달리 `engine_version` 컬럼이 없다.
   컬럼을 추가할지는 db-architect 판단 필요(스키마 변경 사안이라 engine-dev가
   직접 수정하지 않음).

## Phase 2(엔진) 산출물 요약 (참고용)

- `src/constants/*.ts`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`
- `__tests__/engine/*.test.ts` — 94개 전부 통과
- love_type_labels 36종 **네이밍·카피는 이번에 확보됨**
  (`src/constants/loveTypeLabels.ts`, Part 10-5-2 원문을 자동 diff로
  대조 완료, 불일치 0건). `description_ko`(장문 설명)만 여전히 Part 16
  열린 과제로 없음 — `016_seed_love_type_labels.sql`에 INSERT를 채울 때
  이 상수 파일의 code/core_en/suffix_en/label_en/label_ko/copy_ko를
  그대로 옮기고 description_ko만 null로 두거나 콘텐츠팀 확정을 기다릴 것.
- 상세 내역은 세션 최종 보고 및 `.claude/state/PROGRESS.md`, `DECISIONS.md` 참조
