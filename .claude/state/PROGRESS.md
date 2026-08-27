# 진행 상황

최종 갱신: 2026-08-27 (Phase 6 — 얼굴 임베딩 매칭 순수 함수)

## 현재 Phase

Phase 6 — 피드 + 얼굴 인식 (착수, UI 단계(동의 흐름 + 대표사진 등록) +
매칭 순수 함수 완료. 실제 얼굴 탐지·임베딩 추출·갤러리 연동은 메인
세션 예정)

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
   자체가 없음(기본값·클램프만 구현). **(2026-08-25 갱신)** 이 항목
   자체는 여전히 미해결이지만, Phase 4(메인 탭)를 막던 블로커는
   해소됐다 — 작업 지시가 "미연결 36.5도 외에는 노출하지 않는다"를
   명시해, 앱이 `daily_temperature` 저장값만 읽고 값이 없으면 숫자
   대신 대기 상태를 보여주는 방식으로 확정했다(`app/(tabs)/main.tsx`).
   결합 공식 자체는 여전히 Edge Function(일 배치) 쪽에서 확정돼야
   한다 — 이 파일의 계약(앱 클라이언트에서 계산 함수 호출 금지)은
   그대로 유효.
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

- [x] Phase 3 — 온보딩 8화면 + 공유 카드 (`ui-builder`)
  - **라우팅** (Part 11-3 트리 그대로): `app/index.tsx`(화면1, 로고/시작
    겸 세션·onboarding_step 분기점), `app/_layout.tsx`(루트 Stack,
    (onboarding)/(tabs)/(modals) 그룹 등록)
  - **온보딩 그룹** `app/(onboarding)/`: `basic-info.tsx`(화면2),
    `mbti.tsx`(화면3, 알아요/몰라요 분기), `love-quiz.tsx`(화면4, MBTI별
    5문항), `result-brief.tsx`(화면5, 공유카드), `auth.tsx`(화면6, 소셜
    로그인 3종), `result-detail.tsx`(화면7, 상세 결과+궁합+오버라이드),
    `invite.tsx`(화면8), `start-date.tsx`(화면+)
  - **탭 그룹** `app/(tabs)/`: main/chat/feed/magazine/settings — Phase 3
    범위 밖 기능은 골격만(주석으로 명시), 5개 탭 항상 표시 + CoupleGate
    게이팅 배선만 완료
  - **모달 그룹** `app/(modals)/couple-gate.tsx`: 화면 8과 `InvitePanel`
    컴포넌트 공유(재사용). `magazine-viewer.tsx`/`upload.tsx`는 각각
    매거진/피드 Phase 범위라 이번엔 만들지 않음(빈 스텁도 안 만듦 —
    PDF 접근·업로드 관련 CLAUDE.md 규칙과 얽혀 있어 해당 Phase에서
    제대로 설계하는 게 안전 판단)
  - **스토어**: `src/store/sessionStore.ts`(화면2~5 메모리 전용,
    AsyncStorage/persist 미사용 정적 테스트 포함), `src/store/coupleStore.ts`
    (전역 `isConnected` 등가 상태, 미연결 시 온도 36.5 고정 — 상수만
    재노출, temperature.ts 함수는 호출하지 않음)
  - **상수**: `src/constants/compatibility.ts`(Part 10-6 궁합 매트릭스,
    온도차 9쌍 상호성 100% 충족 — 단 Part 10-6-5 원문 중 "8 IRON"
    항목 1건은 문서 자체 모순 발견해 교정, 파일 상단 docblock에 근거
    기록), `src/constants/attachmentDisplay.ts`(Part 10-5-3 애착 재프레이밍
    원문), `src/constants/onboardingStep.ts`(`profiles.onboarding_step`
    0~3 매핑, SCHEMA 원문 기준), `src/constants/theme.ts`
  - **컴포넌트**: `CompatibilitySection`(프레이밍 문구 항상 렌더링),
    `ResultCard`(PII 없음 — 이름 필드 자체가 타입에 없음), `CoupleGate`,
    `InvitePanel`(화면8/모달 공유), `Big5Bars`/`ScoreBar`/`SternbergTriangle`
    (react-native-svg 미설치라 비-SVG 방식으로 시각화), `DateInput`
    (날짜 피커 라이브러리 미설치라 연/월/일 3칸 텍스트 입력으로 대체)
  - **서비스**: `src/services/personalityApi.ts`(화면6~7 서버 저장),
    `src/services/coupleApi.ts`(화면8/+ 초대·매칭·사귄날짜),
    `src/services/socialAuth.ts`(카카오/구글/애플 — `signInWithOAuth`
    + `expo-web-browser` 리다이렉트 방식, 네이티브 SDK 대신 선택한 이유
    파일 상단 docblock 참조)
  - **신규 의존성**: `expo-web-browser`, `expo-auth-session` 설치(둘 다
    순수 JS 관리형 패키지, package.json diff 확인 완료 — react 버전
    변경 없음)
  - **테스트**: 궁합 매트릭스 12개, CompatibilitySection 컴포넌트 11개
    (프레이밍 문구 9코어 전수 + 라벨 + 실행팁), sessionStore 9개
    (AsyncStorage/persist 미사용 정적 검사 포함), enneagramCandidates
    4개 — **신규 36개**. 기존 94개 + 신규 37개(compatibility 13 포함
    조정) = **131개 전부 통과** (`npx jest --ci --watchAll=false`)
  - **정적 검증**: `npx tsc --noEmit -p .` — app/src 전 파일 0 에러
    (테스트 파일의 jest 전역 타입 미설정은 Phase 2부터 있던 기존
    상태, 이번 작업으로 생긴 문제 아님, 테스트 실행 자체는 babel-jest
    경유라 무관)

- [x] 화면 6(약관 동의) 개정판 구현 (2026-08-25, 메인 세션)
  - 근거: docs/ONDOLOG_MASTER.md "MASTER Part 9-1 보강 — 화면 6 약관
    동의 명세"(개정판)
  - **신규**: `src/constants/consent.ts`(MIN_AGE_YEARS=14, 잠정값),
    `src/constants/legalDocuments.ts`(이용약관/개인정보처리방침/AI
    데이터 활용/마케팅 4종 — 전부 "[자리표시자]" 안내형, 실제 조문
    아님), `src/utils/age.ts`(calculateAge, 순수 함수),
    `src/components/Checkbox.tsx`, `src/components/LegalDocumentModal.tsx`,
    `src/components/ConsentChecklist.tsx`
  - **수정**: `app/(onboarding)/auth.tsx`(체크리스트 통합, 소셜 로그인
    버튼 3개를 필수 동의 미충족 시 비활성화하는 방식으로 6-1 CTA
    구현), `src/services/personalityApi.ts`(marketing_agreed_at 저장
    추가, ai_usage_agreed_at을 이제 실제로 채움)
  - **스키마**: `supabase/migrations/017_profiles_marketing_consent.sql`
    (marketing_agreed_at 컬럼 신설 + terms/privacy_agreed_at의
    default now() 제거) — **원격 미적용, db-architect/사람 작업
    필요**(HANDOFF.md 4번). docs/ONDOLOG_SCHEMA.md도 함께 갱신.
  - **테스트**: `__tests__/utils/age.test.ts`(6개, 생일 경계·윤년 포함),
    `__tests__/components/ConsentChecklist.test.tsx`(8개) — 신규 14개.
    기존 131개 + 신규 14개 = **145개 전부 통과**
    (`npx jest --ci --watchAll=false`)
  - **정적 검증**: `npx tsc --noEmit -p .` — app/src 전 파일 0 에러
    (테스트 파일 jest 전역 타입 미설정은 Phase 2부터의 기존 상태,
    이번 작업으로 생긴 문제 아님)
  - **완료기준 자가 점검** (MASTER.md 6-6, 7개 중 6개 충족 확인 +
    1개는 해석 판단 필요 — 상세 근거 `.claude/state/DECISIONS.md`
    2026-08-25 항목):
    1. 필수 항목(만14세+약관+개인정보+AI활용) 전체 체크해야 버튼
       활성화 — ✅
    2. 각 항목에 전문 [보기] 링크 — ②③④⑤는 ✅, ①(만14세)은 문서
       자체가 없어 링크를 두지 않음 — **해석 판단, 코디네이터 확인
       필요**
    3. birth_date 기준 만 14세 미만 가입 차단 — ✅ (버튼 비활성화로
       구조적 차단)
    4. AI 활용 동의가 이용약관과 분리된 별도 항목 — ✅
    5. 생체정보 동의 항목 없음 — ✅
    6. 인증 실패 후 재시도 시 동의 상태 유지 — ✅ (React 로컬 state,
       리셋 경로 없음)
    7. 동의 없이 profiles 레코드 생성 안 됨 — ✅ (버튼 게이팅 +
       useEffect 방어적 재검사 + DB default 제거 3중)

- [x] 카카오 소셜 로그인 OAuth 플로우 구현 (2026-08-25, 메인 세션)
  - 배경: Supabase 대시보드에 카카오 프로바이더 설정 + Redirect URL
    등록(`ondolog://**`, `exp://**`) 완료됨(사람 작업). 앱 코드에서
    수동 OAuth 3단계를 처리하도록 구현.
  - **수정**: `src/services/supabase.ts` — `flowType: 'pkce'` 추가
    (기존 implicit 기본값이던 것을 명시적으로 전환. exchangeCodeForSession
    이 동작하려면 클라이언트가 PKCE 모드여야 함)
  - **수정**: `src/services/socialAuth.ts` — 기존에는
    `expo-auth-session`의 `makeRedirectUri` + URL 프래그먼트에서
    access_token/refresh_token을 뽑아 `setSession`하는 implicit 방식
    이었음. 이번에 요청 명세대로 재작성:
    1) `signInWithOAuth({ skipBrowserRedirect: true })`로 URL만 획득
    2) `expo-web-browser`의 `openAuthSessionAsync`로 브라우저 세션 열고
       앱 스킴 복귀 대기
    3) 복귀 URL 쿼리에서 `code` 추출 → `exchangeCodeForSession`으로
       세션 교환
    - redirectTo는 `expo-linking`의 `createURL('auth/callback')`으로
      생성(요청 명세대로 — `expo-auth-session` 대신). `expo-auth-session`
      의존성은 이제 이 파일에서 미사용(package.json에는 남아있음, 제거는
      범위 밖으로 판단해 안 건드림).
  - **수정**: `app/(onboarding)/auth.tsx` — `handlePress`에서
    `provider !== 'kakao'`이면 OAuth 호출 자체를 시작하지 않고 "준비
    중이에요" 안내 얼럿만 띄우도록 분기 추가(구글/애플은 프로바이더
    미설정 상태). 동의 체크리스트 상태(`consent`)는 이 분기·인증
    실패·취소 어느 경로에서도 리셋되지 않음(기존 6-5 보장 방식 그대로
    유지 — React 로컬 state, 리셋 코드 경로 없음).
  - **미변경(기존 동작 유지)**: 화면 2~5 세션 데이터의 서버 귀속
    (`createProfileAndAssessment`)과 화면 7 이동은 `useEffect`가
    `session` 변화를 구독하는 기존 구조 그대로 — `exchangeCodeForSession`
    성공 시 `onAuthStateChange`가 SIGNED_IN을 쏘면 `useSession` 훅을
    통해 동일 경로로 이어진다.
  - **검증**: `npx tsc --noEmit -p .` app/src 전 파일 0 에러(테스트
    파일 jest 전역 타입 미설정은 기존 상태, 무관). `npx jest --ci
    --watchAll=false` 145개 전부 통과(회귀 없음, 이번 작업은 신규
    테스트를 추가하지 않음 — OAuth 브라우저 왕복은 유닛 테스트로
    검증하기 어려운 영역이라 실기기 확인이 필요한 부분으로 남김).
  - **실기기 검증 불가**(기존 사유 그대로): `.env` anon key 플레이스홀더
    상태라 카카오 로그인 E2E를 이 세션에서 확인 못 함. 사람이 anon key
    채운 뒤 Dev Build로 직접 확인 필요(완료 기준의 "profiles 레코드
    생성 + 화면 7 이동 + 취소 시 화면 6 유지" 3가지 모두 코드 경로는
    구현됐으나 실행 검증은 대기).

- [x] Phase 4 — 5개 탭 UI + 라우팅 (2026-08-25, ui-builder)
  - **판단**: "미확정 4곳" 중 온도 결합공식이 메인 탭 히어로를 막는
    블로커였으나(위 "다음" 절 구 항목), 이번 작업 지시(작업 프롬프트
    "주의" 절)가 "미연결 36.5도 외에는 이 값들을 화면에 노출하지
    않는다"를 명시적으로 확정해 블로커가 해소됐다. Part 9-2 "앱 동작 |
    저장된 값을 읽기만 함"과 결합해 다음 규칙으로 구현: 연결 상태에서
    `daily_temperature` 최신 저장값이 있으면 그 값을 그대로 표시(계산은
    어디서도 하지 않음 — 순수 읽기), 없으면(배치 Edge Function이 아직
    없어 사실상 항상 이 경우) 숫자 대신 "측정 준비 중" 텍스트만 표시.
    이렇게 하면 "저장값만 읽는다"(AC 13-2-2)와 "미확정 공식 기반 숫자를
    노출하지 않는다"(작업 지시)가 동시에 성립한다.
    - **(2026-08-25 후속, 코디네이터 리뷰)** 문구를 "측정 준비 중"에서
      "아직 온도를 잴 기록이 없어요"로 교체. 시스템 상태가 아니라 유저
      행동으로 프레이밍해 채팅 탭 사용을 유도하는 방향(Part 17-2 DNA
      일치율이 채팅으로 움직이는 것과 같은 맥락). `docs/ONDOLOG_MASTER.md`
      Part 9-2 "표시 상태" 표로 문서화 완료(DECISIONS.md 동일 날짜 항목).
  - **라우팅/탭 골격**: `app/(tabs)/_layout.tsx`, `app/(modals)/couple-gate.tsx`,
    `app/index.tsx`, `app/_layout.tsx`는 Phase 3에서 이미 Part 11-3
    그대로 구현돼 있었다(5개 탭 항상 표시, onboarding_step 분기, 초대
    모달) — 이번 Phase는 그 골격 위에 각 탭의 실제 콘텐츠를 채웠다.
  - **메인 탭** (`app/(tabs)/main.tsx`, 전면 재작성): Part 9-2 두 표
    (연결/미연결) 그대로 구현.
    - 연결: 양측 프로필칩 + 커플 닉네임, 히어로 온도(위 판단 참조),
      사귄일수 D+N(`src/utils/relationshipDays.ts`, 시작일=1일차 —
      국내 커플앱 관행 채택, 원문 오프셋 미기재라 docblock에 근거 기록),
      하단 최근 발행물(issues_public 뷰만 조회 — CLAUDE.md 절대 규칙 3)
      → 매거진 탭 진입점
    - 미연결: 본인 프로필칩 + "빈 슬롯", 히어로 36.5 고정, 온보딩 결과
      요약(`ResultCard` 재사용 — PII 없음, Phase 3 산출물 그대로),
      연인 초대 CTA
    - 이 화면은 `<CoupleGate>`를 쓰지 않는다(의도적) — 두 상태가 "같은
      화면의 잠긴/열린 기능"이 아니라 Part 9-2 원문부터 별개 표로
      정의돼 있어서다. `<CoupleGate>`는 채팅(진입 즉시 모달)·피드
      통합뷰처럼 "같은 화면 안에서 기능 하나만 잠기는" 경우 전용으로
      유지했다(main.tsx 상단 docblock에 근거 기록).
    - **(2026-08-25 후속, 코디네이터 확정)** "기념일 임박 시 강조"는
      최초 구현 시 임박 기준이 문서에 없어 스킵했으나, 코디네이터가
      기준을 확정해 `docs/ONDOLOG_MASTER.md` Part 9-2 "사귄 일수 표시
      규격" 표로 보강함 — 100일 단위/연 단위 마일스톤, 7일 전부터 강조,
      당일 별도 축하 표시. `src/utils/relationshipDays.ts`
      `getMilestoneStatus`(순수 함수, 신규 테스트 8개)로 구현하고
      `main.tsx` 히어로에 반영 완료(아래 "막힌 것"에서 제거).
  - **채팅 탭**: 기존 게이팅(`autoOpenInvite`) 유지, 연결 상태 빈 화면을
    "채팅 기능은 곧 열려요" 텍스트로 교체(빈 View였던 것 개선).
  - **피드 탭**: Part 9-4 "부분 게이팅"(혼자 기록은 항상 가능, 통합
    뷰만 커플 전용)을 반영해 섹션을 둘로 나누고 통합 타임라인 섹션만
    `<CoupleGate>`로 감쌌다. coupleStore.refresh() 호출 누락을 추가로
    발견해 보강(다른 탭과 동일 패턴 적용 — 없으면 store가 'unknown'
    상태로 멈춰 CoupleGate가 빈 화면을 반환하는 버그였음).
  - **매거진 탭**: 기존 게이팅 유지, 미연결 fallback에 "연인 초대하기"
    버튼을 추가해 "초대 유도"(Part 11-2)를 텍스트뿐 아니라 실제 CTA로
    구현.
  - **설정 탭**: 변경 없음(Part 9-6 그룹 대부분이 Phase 5+ 기능에
    종속돼 있어 이번엔 손대지 않음 — 로그아웃만 있는 기존 상태 유지).
  - **스토어**: `src/store/coupleStore.ts` 확장 — `partnerId`/`nickname`
    필드 추가, `temperature`를 `number` → `number | null`로 변경(연결
    상태에서 배치 데이터 없음을 표현하기 위함), `refresh()`가
    `daily_temperature` 최신 행을 실제로 조회하도록 구현(HANDOFF.md의
    "Phase 4가 여기에 실제 조회를 붙여야 한다" 요청 반영).
  - **신규 유틸**: `src/utils/relationshipDays.ts`(`computeDaysTogether`,
    순수 함수 — `now` 인자 주입 가능해 테스트 결정론 확보).
  - **테스트**: `__tests__/utils/relationshipDays.test.ts` 신규 6개
    (경계값·시간대 무관성·결정론·방어적 입력 포함). 기존 145개 + 신규
    6개 = 151개 전부 통과 (`npx jest --ci --watchAll=false`).
    **(2026-08-25 후속)** 마일스톤 강조 구현 시 `getMilestoneStatus`
    테스트 8개 추가(당일/임박 경계·마일스톤 겹침·결정론 포함) —
    151개 + 8개 = **159개 전부 통과**.
  - **정적 검증**: `npx tsc --noEmit -p .` — app/src 전 파일(main.tsx
    포함) 0 에러. 테스트 파일 jest 전역 타입 미설정 에러는 Phase 2부터
    있던 기존 상태로 무관(신규 `relationshipDays.test.ts`도 동일 패턴).
    후속 마일스톤 변경 반영 후 재확인해도 0 에러.
  - **완료기준 자가 점검** (Part 13-2 메인 탭 3개 + Part 13-8 전역
    2개 확인):
    1. 미연결 유저 온도 36.5 고정 — ✅ (`useCoupleStore` 초기값·
       disconnected 분기 둘 다 상수 재사용, 하드코딩 중복 없음)
    2. 연결 유저 온도는 저장값만 읽음, 실시간 계산 없음 — ✅ (위 "판단"
       참조 — 값이 없으면 아예 숫자를 안 보여줌으로써 이 계약을 더
       엄격히 지킴)
    3. 사귄일수가 시작일 기준 정확히 계산 — ✅ (단위 테스트 6개)
    4. 미연결 유저에게 5개 탭 모두 표시 — ✅ (Phase 3부터 유지)
    5. 커플 전용 기능 탭 시 초대 모달 + 동일 컴포넌트 재사용 — ✅
       (채팅 `autoOpenInvite`, `InvitePanel`이 화면 8과 `couple-gate.tsx`
       양쪽에서 동일 컴포넌트)
  - **검증용 SQL(사람이 직접 실행)**: 최종 보고서(대화 로그) 참조 —
    미연결/연결 두 시나리오 INSERT문을 세션 응답에 남겼다(이 파일에는
    중복 기록하지 않음).

- [x] 디자인 시스템 적용 — Phase 3~4 화면 리팩터링 (2026-08-26, ui-builder)
  - **배경**: `docs/ONDOLOG_DESIGN.md`(§0~17, 구현 명세 §11~17 포함)가 확정돼
    테마 시스템을 구축하고 온보딩 8화면 + 탭 5개 + couple-gate 모달의 시각
    토큰을 교체했다. 기능 로직·데이터 흐름은 변경 대상이 아니었다(순수
    시각 리팩터링). Phase 5(채팅 실시간)는 착수하지 않음.
  - **신규**: `src/theme/`(`palette.ts` 라이트/다크/별지/4기후,
    `inkHierarchy.ts` `ink('metric'|'narrative'|'verbatim')` §9-2 API,
    `typography.ts` §11-4 표 그대로, `spacing.ts` 4pt 그리드, `index.ts`
    `useTheme()` — 시스템 감지 + 수동 전환, AsyncStorage로 영속화·기존
    의존성 재사용), `src/components/Button.tsx`(§5-1, PrimaryButton/
    SecondaryButton 대체)·`PageHeader.tsx`(§4-1/§13-1)·`Numeral.tsx`
    (§2-3/§11-7 소수부 45%)·`TypeLabel.tsx`(§5-4), `jest.setup.js`
    (AsyncStorage jest mock).
  - **삭제**: `src/constants/theme.ts`(임시 팔레트, 사용처 전부 이관 확인 후
    삭제), `src/components/PrimaryButton.tsx`/`SecondaryButton.tsx`.
  - **수정**: 온보딩 8화면, 탭 5개 + `_layout.tsx`, `couple-gate.tsx`,
    `app/_layout.tsx`(§11-6 폰트 로드 스캐폴드 — 아래 참조), Phase 3 공유
    컴포넌트 다수(`Big5Bars`/`Checkbox`/`CompatibilitySection`/
    `ConsentChecklist`/`CoupleGate`/`DateInput`/`InvitePanel`/
    `LegalDocumentModal`/`ResultCard`/`ScoreBar`/`ScreenContainer`/
    `SternbergTriangle`) — 전부 로직 유지, 색·서체·간격·모서리만 토큰 교체.
  - **폰트**: `assets/fonts/`에 MaruBuri·Pretendard 5종이 배치됐고
    (2026-08-26 사람 작업), `app/_layout.tsx`의 `useFonts` 주석을
    해제했다(2026-08-27, 아래 "완료"에 반영). 원래는 파일 부재로 주석
    처리해뒀던 것 — 상세는 아래 2026-08-27 항목 참조.
  - **§17 검증 5개 — 코디네이터가 직접 재실행해 확인, 전부 0건**:
    하드코딩 헥스색(`app/`,`src/components/`,`src/screens/`) / shadow·
    elevation / fontWeight / 아이콘 라이브러리 / borderRadius 4 이상.
  - **테스트/타입**: `npx jest --ci --watchAll=false` 159/159 통과(회귀
    없음, 코디네이터 재실행 확인). `npx tsc --noEmit -p .` 0 에러(테스트
    파일 jest 전역 타입 미설정은 Phase 2부터의 기존 상태, 무관 — 확인).
  - **코디네이터가 리뷰 중 발견해 되돌린 것**: `package.json`의
    `scripts.android`/`scripts.ios`가 `expo start --android`/`--ios`에서
    `expo run:android`/`run:ios`로 바뀌어 있었다 — 작업 지시서 어디에도
    없는 변경이고 에이전트 최종 보고서도 이 변경을 언급하지 않았다
    (보고서는 "jest.setupFiles 추가"만 명시). `expo run:*`는 로컬 네이티브
    빌드 툴체인(Gradle/Xcode)을 요구해 기존 `expo start --*` 개발 흐름과
    동작이 다르다 — 근거 없는 변경으로 판단해 원래 값으로 되돌렸다
    (`jest.setupFiles` 추가는 유지).
  - **에이전트가 스스로 내린 판단(문서 배치 미기재 구간, `AskUserQuestion`
    없이 기본 방침으로 해소)**: 온보딩 진행 표시 "0 1 / 0 5" 자소 간
    리터럴 스페이스(§13 mockup 문자열 그대로 재현), 설정 탭에 실제 동작하는
    "테마" 행 추가(§13-6/§7 명시 항목)하되 없는 기능(프로필 편집 등) 자리는
    새로 만들지 않음, 에러색 부재 시 `narrative` 톤 사용(빨강 등 새 색
    발명 안 함), ScoreBar/SternbergTriangle 시각화는 문서에 레이아웃이
    없어 기존 Phase 3 방식 유지·톤만 교체. 코디네이터 검토 결과 전부 타당.
  - **정책 그대로 유지된 것(문서화 목적으로 기록)**: 채팅 탭 말풍선은
    §4-4 예외(§13-3)대로 실시간 대화 전용으로 말풍선 유지, 인용된 대화만
    들여쓰기+화자 라벨 규격 적용 — 이 부분 Phase 5 범위라 이번엔 골격만
    토큰 교체.

- [x] Phase 5 — 채팅 실시간 + 스토리 (2026-08-26, ui-builder)
  - **범위**: Supabase Realtime 1:1 채팅(텍스트, 이미지는 자리표시자), 오프라인
    큐잉 → 복구 시 재전송(`client_msg_id` 멱등 키), 읽음 표시(read_at), 스토리
    (작성 UI + 목록 표시 — 만료/보관 배치는 Edge Function 영역이라 이번 범위
    아님, `013_batch_functions.sql`의 `expire_stories`가 계속 담당).
  - **신규**: `src/hooks/useRealtimeMessages.ts`(Realtime 구독 + 낙관적 추가 +
    병합 + 큐잉/재시도 + 읽음 트리거 + 스토리 로드/작성), `src/services/chatApi.ts`
    (`sendMessage`가 23505 유니크 위반을 "이미 전송됨"으로 간주해 기존 행을
    재조회하는 방식으로 멱등성 구현, `markMessagesRead`는 `sender_id`가 본인인
    행을 쿼리에서 제외, `fetchStories`/`createStory` — stories는 update 정책이
    없어 update 쿼리 자체를 만들지 않음), `src/utils/chatQueue.ts`(오프라인
    큐 판단 순수 함수), `src/utils/chatMessages.ts`(병합·정렬·읽음대상·날짜그룹
    순수 함수), `src/utils/uuid.ts`(client_msg_id 생성),
    `src/components/ChatBubble.tsx`/`ChatDateDivider.tsx`/`StoryStrip.tsx`.
  - **수정**: `app/(tabs)/chat.tsx`(전면 재작성, `<CoupleGate autoOpenInvite>`
    게이팅은 Phase 4 그대로 유지).
  - **오프라인 큐 설계 판단**: `@react-native-community/netinfo` 등 새 네이티브
    모듈을 추가하지 않았다(DECISIONS.md 2026-08-25 "네이티브 재빌드 일괄 처리"
    결정 준수 — Phase 6까지 신규 네이티브 모듈 보류). 대신 순수 JS로 "전송 실패
    시 메모리 큐 적재 → 4초 재시도 타이머 + Realtime 채널 재연결(SUBSCRIBED)
    시점에 큐 비우기" 방식을 택했다. 큐는 메모리 상주(AsyncStorage 영속화
    없음) — "재전송 시 중복 삽입 안 됨"이라는 완료 기준은 만족하지만 "앱이
    강제 종료돼도 큐가 살아남는다"는 별개 요구이고 이번 지시에는 없었다(추후
    필요해지면 별도 판단 필요).
  - **코디네이터 리뷰 중 발견해 되돌리게 한 버그**: `chatMessages.ts`의 날짜
    구분선 로직(`dateKeyOf`)이 최초 구현에서 `sentAt.slice(0, 10)`로 UTC 날짜를
    그대로 잘라 썼다 — 같은 메시지의 시각 표시(`ChatBubble`의 `formatTime`)는
    `new Date(iso).getHours()`로 기기 로컬(KST) 시각을 보여주는데, 이 둘의
    기준이 달랐다. KST 자정~오전 9시(UTC 15:00~24:00)에 온 메시지가 "어제
    날짜 구분선 아래 + 오전 X시"로 표시되는 모순이 매일 발생하는 흔한 경계
    였다. 에이전트에게 로컬 타임존 기준(`getFullYear()`/`getMonth()`/
    `getDate()`)으로 고치도록 요청해 수정 완료, 경계 테스트 2개 추가
    (TZ=UTC/America/Los_Angeles로도 결정론 확인).
  - **Realtime publication 미설정 — 사람 작업 필요**: 서브에이전트가 원격
    프로젝트에 읽기 전용 쿼리(`select ... from pg_publication_tables where
    pubname = 'supabase_realtime'`)를 실행한 결과 **`messages`/`stories`
    어느 테이블도 `supabase_realtime` publication에 포함돼 있지 않다.**
    `alter publication supabase_realtime add table public.messages;`가
    적용되기 전까지는 상대방 기기가 실시간으로 메시지를 받지 못한다(화면
    재진입 시 `fetchMessages`로만 갱신됨 — 발신자 쪽은 낙관적 추가 +
    insert 응답으로 정상 동작). db-architect/사람이 마이그레이션으로
    적용 필요(HANDOFF.md 참조). 오프라인 큐 멱등성(완료 기준 2)은 이
    publication과 무관하게 DB 유니크 제약만으로 보장되므로 영향 없음.
  - **테스트**: 신규 28개(`chatQueue` 4, `chatMessages` 15, `uuid` 5, 기타
    포함) — 기존 159개 + 신규 28개 = **187개 전부 통과**
    (`npx jest --ci --watchAll=false`, 코디네이터 재실행 확인).
  - **정적 검증**: `npx tsc --noEmit -p .` — 신규 파일 기준 0 에러(잔존 에러는
    전부 기존 jest 전역 타입 미설정 패턴, Phase 2부터의 기존 상태, 무관 —
    코디네이터가 필터링해 확인).
  - **DESIGN.md §17 검증**: 신규 9개 파일 대상 하드코딩 헥스색/shadow·elevation/
    fontWeight/아이콘 라이브러리/borderRadius 리터럴 전부 0건(코디네이터 직접
    grep 재확인).
  - **rule-auditor 감사(Haiku)**: 절대 규칙 1~7 전부 위반 없음, 완료 기준 8개
    전부 통과, 설정 파일(package.json 등) 무단 변경 없음, Phase 7 영역
    (warmth_score/sentiment/analyzed_at) 미침해 확인. RLS 재검증(항목 3)은
    DB 접근 권한 없어 스킵 — 이번 Phase가 새 테이블/컬럼을 추가하지 않고
    Phase 1에서 이미 검증된 `messages`/`stories`를 그대로 재사용하므로 영향
    없다고 판단.
  - **완료기준 자가 점검**: 위임 프롬프트의 완료 기준 8개 전부 rule-auditor +
    코디네이터 직접 재검증(diff/jest/tsc/grep)으로 통과 확인.

- [x] Phase 5 후속 — 채팅 전송 큐 보완 (2026-08-27)
  - **배경**: 2026-08-26 결정("오프라인 큐 메모리 상주")의 두 가지 트레이드오프
    — 앱 강제 종료 시 큐 소실, 'failed' 전환 경로 없이 무한 재시도 — 를
    해소하는 작업 지시. 상세 판단 근거는 `.claude/state/DECISIONS.md`
    2026-08-27 항목 참조.
  - **큐 영속화**: `src/utils/chatQueue.ts`에 `chatQueueStorageKey`/
    `parseQueuedMessages` 추가. AsyncStorage 키 `chat_queue:{coupleId}`에
    큐 변경마다 즉시 저장, 앱 시작 시 복원해 pending 항목은 재시도를
    바로 재개한다(`src/hooks/useRealtimeMessages.ts`).
  - **재시도 정책**: `src/utils/chatQueue.ts`에 `classifySendError`(RLS
    거부·제약 위반·기타 4xx급은 permanent 즉시 실패, 네트워크 오류·
    연결 예외/자원부족/운영자개입 클래스는 retryable), `computeBackoffDelayMs`
    (2s→4s→8s→16s→32s), `recordFailedRetry`/`resetForRetry`(최대 5회 소진 시
    failed 전환) 구현. 실제 `setTimeout` 스케줄링은 신규 파일
    `src/utils/chatRetryQueue.ts`(`ChatRetryQueue`, React 비의존 —
    fake timer 테스트 가능)로 분리.
  - **사용자 조작**: `ChatBubble`에 "전송 실패 · 다시 시도" 캡션 탭
    (hitSlop 16, ink-mute)과 말풍선 길게 누르기(취소) 추가.
    `useRealtimeMessages`가 `retryFailed`/`cancelPending`을 노출하고
    `app/(tabs)/chat.tsx`가 연결.
  - **표시 규격**: `docs/ONDOLOG_DESIGN.md` §13-3 "전송 상태" 표는
    이미 이 작업 지시서와 동일한 내용으로 반영돼 있어 문서 수정 없음
    (확인만 함). `ChatMessage`에 `failed?: boolean` 필드 추가(`pending`은
    기존 그대로 유지 — 기존 테스트 무변경).
  - **테스트**: 신규 27개 — `chatQueue.test.ts` 확장(에러 분류·백오프
    계산·상태 전이·영속화 파싱), `chatRetryQueue.test.ts` 신설
    (`jest.useFakeTimers()` + `advanceTimersByTimeAsync`로 2s→4s→8s→16s→32s
    백오프·5회 소진 후 failed 전환·즉시 permanent 실패·다시 시도·취소·
    복원 후 재개·`hydrate`(큐 생성~AsyncStorage 복원 완료 사이의 유실
    방지)를 전부 결정론적으로 검증). 기존 187개 + 신규 27개 =
    **214개 전부 통과**(`npx jest --ci --watchAll=false`).
  - **정적 검증**: `npx tsc --noEmit -p .` — `src/`, `app/` 소스 파일 기준
    신규 에러 0건(테스트 파일 jest 전역 타입 미설정은 기존부터 있던
    무관한 상태).
  - **범위 밖**: 이미지 메시지 재시도, NetInfo 기반 즉시 재시도(원칙
    유지), 다중 실패 항목 우선순위 조정.

- [x] 폰트 활성화 (2026-08-27)
  - **배경**: 사람이 `assets/fonts/`에 MaruBuri Light/Regular/SemiBold(.ttf)
    + Pretendard Regular/SemiBold(.otf) 5개를 배치 완료(2026-08-26)했다는
    보고를 받아 `app/_layout.tsx`의 `useFonts` 주석을 해제.
  - **주의(주석 해제만으로는 안 됐던 부분)**: 기존 주석 코드는 Pretendard도
    `.ttf` 확장자로 `require`하고 있었는데, 실제 배치된 파일은 `.otf`였다
    (MaruBuri는 `.ttf`가 맞음) — 그대로 해제했으면 번들 시점에
    "module not found"로 즉시 깨졌을 것. `require` 경로의 Pretendard
    두 개만 `.otf`로 고쳐서 해제했다. `src/theme/typography.ts`의
    fontFamily 키(`'MaruBuri-Light'` 등)는 `useFonts`의 키와 정확히
    일치함을 대조 확인(수정 없음, 문서 값 그대로 유지).
  - **검증**: `npx tsc --noEmit -p .` 신규 에러 0건(기존 `supabase.ts`의
    `process` 타입 미설정 에러만 무관하게 잔존), `npx jest` 214개 전부
    통과(폰트 로드는 jest 환경에서 실행되지 않는 네이티브 경로라
    테스트 대상 아님).
  - **후속 조치 필요(사람 작업)**: 이 변경은 JS/TS 파일만 건드렸고 폰트
    자체는 이미 Metro가 번들할 수 있는 애셋이라 **네이티브 재빌드 없이도
    Dev Build 재시작(`expo start` 캐시 초기화)만으로 반영될 가능성이
    높다** — 다만 `.otf`가 이 프로젝트에서 처음 쓰이는 애셋 확장자라
    Metro assetExts에 이미 포함되는지(Expo 기본값엔 포함됨) 실기기에서
    최종 확인 필요.

- [x] Phase 6 1단계 — 생체정보(얼굴 인식) 동의 흐름 (2026-08-27)
  - **범위**: docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보(얼굴 인식)
    별도 동의"의 화면 A(동의)만. SDK 연동·화면 B(권한)·화면 C(대표사진
    등록)는 명시적으로 범위 밖 — 메인 세션이 이어서 진행.
  - **산출물**:
    - `src/utils/biometricConsent.ts` — `isBiometricConsentActive` 순수
      판정 함수(동의 시각 있고 철회 시각 없음 = 유효)
    - `src/store/profileStore.ts` — `biometric_consent_at`/
      `biometric_consent_revoked_at` 상태 + refresh/agree/revoke
      (coupleStore와 같은 패턴 — 서버가 진실 소스)
    - `src/components/BiometricConsentPanel.tsx` — 화면 A 본문(헤드라인·
      3단계 설명·온디바이스 처리 고지 4요지·전문 보기 링크·체크박스
      또는 철회 버튼). `mode: 'consent' | 'manage'`로 최초 동의/설정 탭
      재확인을 겸한다
    - `app/(modals)/biometric-consent.tsx` + `_layout.tsx` 라우트 등록
    - `app/(tabs)/feed.tsx` — 미동의 시 "사진 자동으로 정리해드릴까요?"
      안내 카드, 동의 완료 시 "연동 준비 중" 안내로 전환
    - `app/(tabs)/settings.tsx` — "개인정보 & 약관" 그룹 신설, 동의
      상태 표시 행 + `/biometric-consent` 진입점, 로그아웃 시
      `profileStore.reset()` 추가
    - `src/constants/legalDocuments.ts` — `biometric` 키 + 온디바이스
      처리 고지 4요지 배열(`BIOMETRIC_ON_DEVICE_NOTICE_POINTS`) 추가,
      기존 자리표시자 패턴 그대로(법률 문구 창작 없음)
    - `src/components/Button.tsx` — `testID` prop 추가(하위 호환, 테스트
      선택자 확보 목적)
  - **자체 판단 사항 4곳**: 세부 근거는 `.claude/state/DECISIONS.md`
    2026-08-27 "Phase 6 첫 단계" 항목 참조 — ① 화면 A를 consent/manage
    두 모드의 단일 컴포넌트로 구현 ② 재동의 시 `revoked_at`을 null로
    되돌리는 파생 규칙 ③ 피드 탭 안내 카드 표시 기준을
    `photo_sync_enabled`가 아니라 생체정보 동의 상태로 둠 ④ 철회 시
    로컬 얼굴 데이터 삭제는 SDK 미연동으로 구현하지 않음(QA 체크리스트
    항목으로 아래 "막힌 것"에 기록).
  - **테스트**: 신규 14개 — `biometricConsent.test.ts`(4, 동의 유효
    판정 전수), `BiometricConsentPanel.test.tsx`(10, 4요지 노출·전문
    모달·체크 전 진행 차단·체크 후 진행·나중에·관리 모드 철회 확인
    다이얼로그 승인/취소). 기존 214개 + 신규 14개 = **228개 전부 통과**.
  - **정적 검증**: `npx tsc --noEmit -p .` 신규 에러 0건.

- [x] Phase 6 2단계 — 대표사진 등록 화면(화면 C) (2026-08-27)
  - **범위**: docs/ONDOLOG_MASTER.md "연인 인식용 대표사진"(개인 1장 +
    커플 1장). "사진 선택"은 실제 갤러리가 아니라 번들 자산 플레이스홀더
    (코디네이터 승인, `.claude/state/DECISIONS.md` 참조) — 그 이후
    미리보기·Storage 업로드·DB 반영은 전부 실제 동작.
  - **산출물**:
    - `supabase/migrations/019_avatars_storage_policies.sql` — 015가
      미확정으로 남겼던 avatars 버킷 경로 규칙을 확정(개인
      `{user_id}/reference`, 커플 `{couple_id}/reference`). **원격
      미적용** — 사람이 `supabase db push` 필요(적용 전까지 업로드는
      전부 RLS 거부로 실패한다)
    - `src/services/referencePhotoApi.ts` — 업로드(Storage + DB 반영)
      + 미리보기용 서명 URL 발급
    - `src/constants/referencePhotoPlaceholders.ts` — 플레이스홀더
      자산 3개 + `Image.resolveAssetSource` 래퍼(실제 갤러리 연동 시
      이 파일만 교체하면 됨)
    - `src/components/ReferencePhotoSlot.tsx` — 슬롯 하나(선택·미리보기·
      저장·잠금) 재사용 컴포넌트
    - `app/(modals)/reference-photo.tsx` + `_layout.tsx` 라우트 등록 —
      개인/커플 두 슬롯을 한 화면에서 관리, 커플 섹션은 미연결 시 잠금
    - `src/store/profileStore.ts`에 `referencePhotoPath` +
      `setPersonalReferencePhoto` 추가
    - `src/store/coupleStore.ts`에 `referencePhotoPath` +
      `setReferencePhoto` 추가
    - `app/(tabs)/settings.tsx` — "사진 & 데이터" 그룹 신설, 등록 상태
      표시 + `/reference-photo` 진입점
  - **테스트**: 신규 7개(`ReferencePhotoSlot.test.tsx`). 기존 228개 +
    신규 7개 = **235개 전부 통과**.
  - **정적 검증**: `npx tsc --noEmit -p .` 신규 에러 0건.

- [x] Phase 6 — 얼굴 임베딩 매칭 순수 함수 (2026-08-27, engine-dev)
  - **범위**: docs/ONDOLOG_MASTER.md "얼굴 인식 아키텍처" 3단계
    파이프라인 중 3단계(매칭)만 — 1·2단계(얼굴 탐지·임베딩 추출)는
    네이티브 SDK 의존이라 이번 범위 밖(메인 세션).
  - **산출물**: `src/engine/faceMatch.ts` —
    `cosineSimilarity(a, b)`(표준 공식, 분모를 `sqrt(normA*normB)`
    하나로 계산해 동일/반대 벡터에서 부동소수점 오차 없이 정확히
    1.0/-1.0), `isMatch(similarity, threshold)`(임계값은 매개변수,
    하드코딩 없음), `matchAgainstReferences(embedding, references,
    threshold)`(여러 기준 중 최선 매칭 반환, `MatchResult` 구조는
    문서에 없어 자체 설계 — 근거는 DECISIONS.md 참조). 라이브러리
    의존 없음 — 순수 숫자 계산만.
  - **테스트**: 신규 17개 — 표준 공식·경계 벡터(동일/반대/직교)·차원
    불일치/빈 벡터/영벡터 에러·임계값 매개변수화·최선 매칭/미달/빈
    배열/동점 처리·양쪽 함수 100회 반복 결정론. 기존 240개 + 신규
    17개 = **257개 전부 통과**.
  - **정적 검증**: `npx tsc --noEmit -p .` 신규 에러 0건.
    `determinismStaticRules.test.ts`가 `src/engine/`을 동적 스캔해
    이 파일도 자동으로 결정론 정적 검사 대상에 포함됨(테스트 파일
    수정 불필요).
  - **범위 밖(다음 단계, 메인 세션)**: 실제 얼굴 탐지·임베딩 추출
    서비스 래퍼(1·2단계), 이 매칭 함수를 실제로 호출하는 스캔
    파이프라인, 임계값 실측·확정.

## 진행 중

Phase 6 — 생체정보 동의 흐름 + 대표사진 등록 UI + 매칭 순수 함수
(`faceMatch.ts`) 완료. 남은 것(실제 얼굴 탐지·임베딩 추출 SDK 연동,
`expo-image-picker` 갤러리 연동, 사진 라이브러리 권한, 스캔 파이프라인)
은 전부 네이티브 모듈/디버깅이 필요해 메인 세션이 이어서 진행
(서브에이전트 위임 금지 — ROADMAP.md 원문). **선행 필요**:
`019_avatars_storage_policies.sql` 원격 적용(아래 "막힌 것" 참조) —
적용 전까지는 대표사진 저장이 전부 실패한다.

## 보류 (Phase 6 재빌드 시 처리)

- [ ] expo-web-browser 네이티브 모듈 (Phase 3에서 발생)
- [ ] 얼굴 인식·카카오맵 SDK (Phase 6 본작업)

## 보류 (실기기 검증 대기)

- 카카오 로그인 E2E — 기존에 알려진 `.env` anon key 플레이스홀더 문제에 더해,
  `expo-web-browser`가 네이티브 모듈이라 기존 EAS Dev Build에는 포함되어
  있지 않다는 점을 이번에 확인함. Dev Build 재빌드가 필요.
- 위 재빌드는 단독으로 하지 않고 Phase 6의 얼굴인식·카카오맵 네이티브 패키지와
  함께 일괄 처리하기로 함(사유는 DECISIONS.md 2026-08-25 "네이티브 재빌드
  일괄 처리" 항목 참조). 그 전까지 카카오 로그인 실기기 E2E는 이 항목으로도
  막혀 있음(기존 anon key 이슈와는 별개 원인 — 둘 다 해소돼야 검증 가능).

## 막힌 것

- **(신규, 2026-08-27)** `019_avatars_storage_policies.sql` 원격 미적용
  — `npx supabase db push` 필요(사람 작업, CLAUDE.md 절대 규칙 6).
  적용 전까지는 대표사진(개인/커플) 업로드가 `avatars` 버킷 RLS 거부로
  전부 실패한다(`app/(modals)/reference-photo.tsx`). 상세 근거는
  `.claude/state/DECISIONS.md` 2026-08-27 "Phase 6 — 대표사진 등록
  화면" 항목 참조.
- **(신규, 2026-08-27, QA 체크리스트 — 자동 검증 불가)** 생체정보 동의
  철회 시 "기기 로컬의 얼굴 특징 데이터 삭제"(MASTER.md "철회 시
  반드시 함께 일어나야 하는 일" 3번)가 구현되지 않았다 — 얼굴 인식
  SDK 자체가 아직 연동되지 않아 삭제할 온디바이스 데이터가 없기
  때문(`revokeBiometricConsent`, `src/store/profileStore.ts`). SDK 연동
  (Phase 6 3단계, 메인 세션)이 끝나면 그 삭제 호출을 revoke 로직에
  반드시 추가해야 한다. MASTER.md 본문이 "rule-auditor가 검증할 수 없는
  유일한 항목이라 QA 체크리스트에 수동으로 남겨야 한다"고 직접
  명시한 항목이라 자동화 테스트로 대체할 수 없다 — 실기기 수동 검증
  필요.
- **(신규, 2026-08-26)** `supabase_realtime` publication에 `messages`/`stories`
  테이블이 등록돼 있지 않다(원격 프로젝트 `pg_publication_tables` 직접 조회로
  확인) — `alter publication supabase_realtime add table public.messages;`
  마이그레이션 필요(db-architect/사람 작업, HANDOFF.md 참조). 적용 전까지는
  Realtime 구독이 상대방의 메시지를 실시간으로 받지 못한다(재진입 시
  `fetchMessages`로만 동기화됨 — 발신자 쪽 낙관적 표시는 정상).
- iOS Dev Build 미완 (Apple Developer 계정 필요) — Apple 로그인 실기기
  검증 불가
- `.env`의 anon key가 플레이스홀더 상태 — Phase 3 소셜 로그인/DB 저장
  코드 전부 작성 완료했으나 이 값이 없어 실기기 E2E 테스트 불가
  (HANDOFF.md 참조, 대시보드에서 복사 필요)
- **(2026-08-25 해결)** Supabase Auth 카카오 프로바이더 + Redirect URL
  (`ondolog://**`, `exp://**`) 대시보드 설정 완료(사람 작업) — 앱 코드
  쪽 수동 OAuth 플로우 구현도 완료(위 "완료" 절 참조). 구글/애플은
  여전히 프로바이더 미설정 상태(화면에서 안내 문구로 막아둠).
- **(신규, 2026-08-25)** 카카오 로그인 네이티브 재빌드 필요 — 위 "보류" 절
  참조. anon key와 별개로 `expo-web-browser` 자체가 미빌드 상태라, anon key를
  채워도 이 항목이 남아있는 한 실기기 E2E는 여전히 불가.
- avatars Storage 버킷 정책 미정 (경로 규칙 확정 필요, HANDOFF.md 참조
  — Phase 3는 대표사진 업로드 UI를 만들지 않아 이번엔 영향 없음)
- love_type_labels 36종 **네이밍·카피는 확보됨**(`src/constants/loveTypeLabels.ts`,
  Part 10-5-2 원문 반영 완료). `description_ko`(장문 설명)만 Part 16 열린
  과제로 미확정 — 016 마이그레이션 INSERT 시 참조 가능 (HANDOFF.md 참조).
  화면 7은 이 값이 null이면 해당 섹션을 조건부로 숨기는 방식으로 이미
  대응해뒀다(완료 기준 4)
- "미확정 4곳"(온도 결합공식/DNA base_score 궁합공식/OVR 포지션
  가중치/베이지안 수축보정) — 4곳 모두 여전히 미해결(엔진 자체는
  Phase 2 자리표시자 상태 그대로). 단 온도 항목은 Phase 4를 막던
  블로커가 아니게 됐다(위 "미확정 4곳" 절 2026-08-25 갱신 참조) —
  메인 탭은 저장값이 없으면 숫자를 아예 노출하지 않는 방식으로
  우회했을 뿐, 결합 공식 원문 확정은 여전히 필요(일 배치 Edge Function
  구현 시점에 반드시 필요해짐 — DNA/OVR 3곳은 Phase 4에 영향 없음,
  DNA는 커플 연결 후 상세 화면, OVR은 스탯 화면 쪽이라 아직 미착수).
- **(2026-08-25 해결)** "기념일 임박 시 강조" — 코디네이터가 기준을
  확정(`docs/ONDOLOG_MASTER.md` Part 9-2 "사귄 일수 표시 규격": 100일/연
  단위, 7일 전 강조, 당일 별도 축하)해 `getMilestoneStatus`로 구현·
  테스트 완료(위 "완료" 절 참조).
- 메인 탭 "다음 발행까지 남은 기간"(Part 9-2 하단) — 발행 주기 config
  (`daily`/`monthly`)가 앱 코드에 아직 연결돼 있지 않아(Phase 7~8 범위)
  구현하지 않았다. "최근 발행물" 유무만 `issues_public` 뷰로 조회해
  매거진 탭 진입점으로 연결해뒀다. **(2026-08-25 코디네이터 확인)**
  Part 7 이후 구현 방침이 `docs/ONDOLOG_MASTER.md` Part 9-2에 명시적으로
  기록됨 — 더 이상 미확인 스킵이 아니라 확정된 연기.
- **(2026-08-25 해결)** 온보딩 화면 6(약관 동의) 실제 UI 구현 완료 —
  위 "완료" 절 참조. 남은 것은 017 마이그레이션 원격 적용과 약관 본문
  작성(둘 다 사람 작업, HANDOFF.md 4번)
- "이미지로 저장"(화면5) — `react-native-view-shot` 등 뷰 캡처 라이브러리
  미설치라 버튼만 있고 안내 alert만 뜬다. 후속 작업으로 남김
- 화면 5 "가입 버튼이 공유 버튼보다 강조되지 않음"은 스타일 코드
  (PrimaryButton=공유, SecondaryButton=가입)로만 보장했고 이를 검증하는
  자동 테스트는 아직 없음(코드 리뷰로 확인 가능한 상태)

## 다음

Phase 5 완료(채팅 실시간 + 스토리) + rule-auditor 감사 통과. Phase 6(피드 +
얼굴 인식, 메인 세션 전담) 착수 전 확인/처리 필요 사항:
- **`alter publication supabase_realtime add table public.messages;`
  (및 필요 시 `stories`) 마이그레이션 적용** — 사람/db-architk 작업. 이게
  없으면 채팅 실시간 수신이 화면 재진입 전까지 동작하지 않는다(위 "막힌 것"
  참조).
- 아래 "검증용 SQL"(Phase 4 절 참조)로 미연결/연결 두 시나리오를 Supabase
  대시보드에서 직접 실행해 메인 탭 동작을 실기기/시뮬레이터로 확인해달라
  (anon key가 채워진 이후 가능 — HANDOFF.md 1번 참조).
- "다음 발행까지 남은 기간"은 여전히 Phase 7~8로 확정 연기(위 "막힌 것"
  참조).
- Phase 6은 네이티브 모듈(얼굴 인식·카카오맵)이 핵심이라 서브에이전트
  위임 금지, 메인 세션이 직접 진행(ROADMAP.md 원문).
