# 진행 상황

2026-10-04 (메인 세션, `28`): `CORNER_CONTENT.md` 파이프라인 서술을 MASTER 포인터로 — §0-2 배치 위치 줄, §9 전체(파일 배치 + 9-1 파이프라인 계약) → §17-0 포인터 표, §6-2 "스킵 우선" 행·"검증" 문단 → §17-0-5-D·§17-0-4-A 포인터. §2~§7 스키마 무변경, 게이트 0/0/556·35.

2026-10-01 (engine-dev, `#15` r2): `stripComments` 복제본 7곳 전부 `scripts/lib/stripComments.ts`로 통합(URL 미탐 수정, `preserveLines` 옵션 기본 꺼짐), 기존 스위트 assertion 무수정 통과, 신규 6건, 새 위반 없음, unresolvedInventory 정의 4 / 소비 2 유지, 게이트 0/0/556·35.

2026-10-04 (메인 세션, `27`): `#15` 마무리 정리 — `cornerPipelineStaticRules.test.ts` "공용 유틸" 헤더 주석 한 줄을 공용 유틸 사용 사실에 맞게, `generate-norm.ts` docblock의 버전 값을 지우고 `enumerate.ts`의 `NORM_VERSION`을 가리키게, 이 파일의 `#15` 줄을 제목 아래로 이동, HANDOFF `#15` 절 기준 B 통과 → `archive/handoff-20261001.md` 끝으로 이동, 게이트 0/0/556·35.

2026-10-02 (메인 세션, `26-...-r2`): `#15` 후속 정리 — `unresolvedInventory.ts`·`generate-norm.ts` docblock 실행 명령을 PowerShell 형식으로(옵션·순서 불변, 실증 4/2·규준 파일 바이트 불변), 사실과 달라진 주석 5개 파일 정정, HANDOFF `#15` 행 → `archive/handoff-20261001.md`(`#15` 절은 기준 B 미통과로 남김), PE 인수인계서 4-2·5-2 행 추가.

2026-09-30 (메인 세션, `24-...-r3`): HANDOFF 아카이브 정리 — 30섹션 중 24개를 `.claude/state/archive/handoff-20260924.md`로 이동, 6개 남김 + "열린 항목" 표 추가, 검증 4-1·4-2·4-3 통과, HANDOFF 180450→33139 bytes(20KB 초과, 보고함), PE 인수인계서 4-2·5-2 표 갱신, 게이트 0/0/550·34.

> 현재 상태의 원본은 `docs/ONDOLOG_ROADMAP.md` §1이다. 이전 갱신 이력은 `.claude/state/archive/`로 옮긴다.

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

## 보류 (실기기 검증 대기)

- 카카오 로그인 E2E — 기존에 알려진 `.env` anon key 플레이스홀더 문제에 더해,
  `expo-web-browser`가 네이티브 모듈이라 기존 EAS Dev Build에는 포함되어
  있지 않다는 점을 이번에 확인함. Dev Build 재빌드가 필요.
- 위 재빌드는 단독으로 하지 않고 Phase 6의 얼굴인식·카카오맵 네이티브 패키지와
  함께 일괄 처리하기로 함(사유는 DECISIONS.md 2026-08-25 "네이티브 재빌드
  일괄 처리" 항목 참조). 그 전까지 카카오 로그인 실기기 E2E는 이 항목으로도
  막혀 있음(기존 anon key 이슈와는 별개 원인 — 둘 다 해소돼야 검증 가능).

## v2 기준선 — 애착축 진단 (norm-synthetic-v2, engine leagueStats 2.0.0)

> 이 수치는 **v2 엔진 기준**(`norm-synthetic-v2`, `leagueStats 2.0.0`)이며,
> 이후 공식이 바뀌면 진단 스크립트 재실행으로 **재생성되지 않는다**.
> 회피축·불안축 조치의 전후 비교 기준선이므로 삭제하지 않는다.

> 출처: `.claude/state/HANDOFF.md` "애착축 진단 집계 — 완료 (2026-09-03, engine-dev)"
> 섹션의 복사본. HANDOFF.md 원본은 그대로 둔다. Phase 7 선행 #6
> (`.claude/state/prompts/phase-7/06-engine-dev-attachment-diagnostic.md`).
> `synthetic-v2` 전수 열거 3,888개 대상, 합성값 = 6각 스탯 산술평균
> = `computeOvrRawScore`.

### 진단 스크립트 실행 명령

- 경로: `scripts/norm/attachment-diagnostic.ts` (파일 I/O 없음, stdout JSON 출력)
- 실행 (Windows / PowerShell, `scripts/generate-norm.ts`와 동일한 1회용 컴파일 방식 — ts-node/tsx 없음):

  ```
  npx tsc scripts/norm/attachment-diagnostic.ts --ignoreConfig --ignoreDeprecations "6.0" `
    --outDir .norm-build --module commonjs --moduleResolution node `
    --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule --types node
  node .norm-build/scripts/norm/attachment-diagnostic.js
  Remove-Item -Recurse -Force .norm-build
  ```

### 재사용한 함수 (재구현 없음 — 전부 import만)

| 함수 / 상수 | 시그니처 또는 형태 | 경로 |
|---|---|---|
| `inferLoveType` | `(input: LoveTypeInput) => LoveTypeInferenceResult` | `src/engine/loveTypeInference.ts` |
| `computeSixStats` | `(input: SixStatsInput) => SixStats` | `src/engine/leagueStats.ts` |
| `computeOvrRawScore` | `(stats: SixStats) => number` (6각 산술평균 = 합성값) | `src/engine/leagueStats.ts` |
| `roundTo` | `(value: number, decimals: number) => number` (유일 반올림 지점) | `src/engine/numeric.ts` |
| `Q3_ANXIETY_AXIS` / `Q5_AVOIDANCE_AXIS` | `Record<QuizChoice, 'low'\|'mid'\|'high'>` (축 수준 룩업) | `src/constants/attachment.ts` |
| `ATTACHMENT_LABEL_KO` | `Record<AttachmentType, string>` (제품 언어 표기) | `src/constants/attachment.ts` |
| `MBTI_TYPES` | `readonly MbtiType[]` (열거 순서 고정) | `src/constants/quizTypes.ts` |
| `RAW_SCORE_DECIMALS`(10) / `SUMMARY_DECIMALS`(6) | 반올림 자리수 | `scripts/norm/distribution.ts` |

### 집계 ① 회피축 3수준별 합성값 분포 (진단 본체)

| 회피 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 49.435185 | 2.591468 | 43.0000000000 | 56.3333333333 | 1296 |
| mid  | 48.212963 | 2.590674 | 41.8333333333 | 55.1666666667 | 1296 |
| high | 46.675926 | 2.594047 | 40.1666666667 | 53.6666666667 | 1296 |

### 집계 ② 불안축 3수준별 합성값 분포 (대조군)

| 불안 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 47.546296 | 2.796909 | 40.1666666667 | 55.3333333333 | 1296 |
| mid  | 48.157407 | 2.795070 | 40.8333333333 | 56.0000000000 | 1296 |
| high | 48.620370 | 2.786406 | 41.3333333333 | 56.3333333333 | 1296 |

### 집계 ③ 애착 4유형별 합성값 분포

| 유형 | 표기 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|---|
| secure   | 안정형 | 48.569444 | 2.647318 | 41.8333333333 | 56.0000000000 | 1728 |
| anxious  | 불안형 | 49.333333 | 2.618341 | 42.8333333333 | 56.3333333333 | 864 |
| avoidant | 회피형 | 46.416667 | 2.574207 | 40.1666666667 | 53.1666666667 | 864 |
| fearful  | 혼란형 | 47.194444 | 2.555556 | 41.3333333333 | 53.6666666667 | 432 |

### 집계 ④ 회피 × 불안 교차표 (3 × 3 = 9칸, 평균과 n)

| 회피 \ 불안 | low | mid | high |
|---|---|---|---|
| **low**  | 48.861111 (n=432) | 49.527778 (n=432) | 49.916667 (n=432) |
| **mid**  | 47.694444 (n=432) | 48.194444 (n=432) | 48.750000 (n=432) |
| **high** | 46.083333 (n=432) | 46.750000 (n=432) | 47.194444 (n=432) |

### 각 집계의 n 균등 여부

- 회피축 3수준: **1296 / 1296 / 1296 — 균등**
- 불안축 3수준: **1296 / 1296 / 1296 — 균등**
- 교차표 9칸: **전부 432 — 균등**
- 애착 4유형: 1728 / 864 / 864 / 432 — 균등 아님(구조상 당연 — 절단점이
  `high` 하나뿐이라 secure가 4/9, fearful이 1/9)
- 합계: ①②③④ 전부 **3,888**

## v3 — DEF 애착 항 갱신 (norm-synthetic-v3, engine leagueStats 3.0.0)

> Phase 7 선행 #7(`.claude/state/prompts/phase-7/08-engine-dev-def-neutral-avoidance.md`).
> MASTER Part 17-3 재갱신: DEF 애착 항 = **`75 − 불안축/2`**
> (`computeDefAnxietyStability`, 회피축 인자를 받지 않는 DEF 전용 함수).
> 회피축이 DEF에서 빠지고 불안축 계수는 항 내부 −0.5 / DEF 순계수 −0.15로 보존.
> EMP 공식·산출은 불변(공용 `computeAttachmentStability` 본문 무수정).
> `LEAGUE_STATS_ENGINE_VERSION` 2.0.0 → 3.0.0.
> 전체 근거·비교표는 `.claude/state/HANDOFF.md` 동명 섹션 참조. 여기엔
> 점검 수치만 남긴다(스크립트 재실행으로 재생성되지 않으므로 보존용).

### 애착 항의 불안축 계수 유지 — 근거 요약

- 해석적: `∂/∂불안축 (75 − 불안축/2) = −0.5` = 변경 전 `∂/∂불안축 (100 − (불안+회피)/2)`.
- 항 평균: 변경 전 48.333 → 변경 후 49.167 (Part 17-3 예측과 일치, 항 값 범위 보존).
- 합성값 실측: 불안축 3수준 총차(high−low) v2 `1.074074` → v3 `1.074074` **동일**.
- 합성값 순계수: 불안축 ATT +0.35 / EMP −0.10 / DEF −0.15 = **+0.10 유지**
  (회피축은 EMP −0.10 / DEF 0 = −0.10, v2의 −0.25에서 축소).

### 점검 ① 회피축 3수준별 합성값 분포 (진단 스크립트 무수정 재실행)

| 회피 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 48.712963 | 2.590674 | 42.3333333333 | 55.6666666667 | 1296 |
| mid  | 48.212963 | 2.590674 | 41.8333333333 | 55.1666666667 | 1296 |
| high | 47.620370 | 2.593651 | 41.1666666667 | 54.6666666667 | 1296 |

단계별 차이: mid−low **−0.500000** / high−mid **−0.592593**. 총차 **−1.092593**.
(v2 총차 −2.759259 → v3 −1.092593.)

### 점검 ② 불안축 3수준별 합성값 분포

| 불안 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 47.657407 | 2.594642 | 41.1666666667 | 54.6666666667 | 1296 |
| mid  | 48.157407 | 2.594642 | 41.6666666667 | 55.1666666667 | 1296 |
| high | 48.731481 | 2.589681 | 42.3333333333 | 55.6666666667 | 1296 |

단계별 차이: mid−low **+0.500000** / high−mid **+0.574074**. 총차 **+1.074074**
(v2와 동일).

### 점검 ③ 회피 × 불안 교차표 (3 × 3, 평균 / n)

| 회피 \ 불안 | low | mid | high |
|---|---|---|---|
| **low**  | 48.194444 (n=432) | 48.694444 (n=432) | 49.250000 (n=432) |
| **mid**  | 47.694444 (n=432) | 48.194444 (n=432) | 48.750000 (n=432) |
| **high** | 47.083333 (n=432) | 47.583333 (n=432) | 48.194444 (n=432) |

(참고: 애착 4유형별 — secure 48.194444 / anxious 49.000000 / avoidant 47.333333 /
fearful 48.194444, n 1728 / 864 / 864 / 432.)

### 점검 ④ 에니어그램 코어 9종별 합성값 분포 (v3, 각 n=432)

| 코어 | 평균 | 표준편차 | 최소 | 최대 |
|---|---|---|---|---|
| 1 | 47.597222 | 2.558535 | 41.3333333333 | 54.0000000000 |
| 2 | 48.888889 | 2.575556 | 42.6666666667 | 55.3333333333 |
| 3 | 47.513889 | 2.555669 | 41.1666666667 | 54.0000000000 |
| 4 | 48.143519 | 2.544507 | 41.8333333333 | 54.5000000000 |
| 5 | 47.976852 | 2.544507 | 41.6666666667 | 54.3333333333 |
| 6 | 47.763889 | 2.558535 | 41.5000000000 | 54.1666666667 |
| 7 | 48.805556 | 2.572708 | 42.5000000000 | 55.3333333333 |
| 8 | 47.680556 | 2.555669 | 41.3333333333 | 54.1666666667 |
| 9 | 49.268519 | 2.561621 | 43.0000000000 | 55.6666666667 |

코어 간 평균 폭 **1.754630** (최저 3 → 최고 9). 오름차순 순위 **3 < 1 < 8 < 6 < 5 < 4 < 7 < 2 < 9**.
9종 전부 v2 대비 균일하게 **+0.074074** 이동(코어 = (Q1,Q2)로 Q3/Q5와 독립), 폭·순위 불변.

### 점검 ⑤ 스탯 6종 및 합성값 mean / stdDev (v3, 3,888 전수, 모표준편차)

| 항목 | 평균 | 표준편차 |
|---|---|---|
| PUS | 49.750000 | 17.020209 |
| EMP | 48.925926 | 15.211089 |
| ATT | 47.000000 | 21.489015 |
| DEF | 44.666667 | 18.979521 |
| TAC | 45.416667 | 16.359460 |
| REA | 53.333333 | 13.707257 |
| 합성값 | 48.182099 | 2.629861 |

PUS·EMP·ATT·TAC·REA는 v2와 바이트 동일. DEF `44.222222 / 19.423799` → `44.666667 / 18.979521`
(평균 +0.44, sd 감소 — 회피축이 빠져 항 산포 축소). ATT sd 21.489015 분산 1위 유지.

> **판단하지 않음.** 위 수치의 해석·추가 조정은 마스터 PM 결정. 17-3 값이 확정이며
> 수치를 목표에 맞춘 가중치 조정은 하지 않았다.

## 회피축 잔차 진단 (`attachAvoidance` 원점수 분포) — 완료 (2026-09-04, engine-dev)

Phase 7 선행 #11(`.claude/state/prompts/phase-7/11-engine-dev-avoidance-residual.md`).
MASTER Part 17-3 "애착 축 수치화"의 미해결 회피축 잔차(DEF 평균 상승분
실측 `+0.444445` vs 예측 `+0.25`, 역산 `E[회피축] = 52.962966`, 유효 폭
`66.22`)를 확정하기 위해, `attachAvoidance` **원점수**의 실제 분포를
전수 열거 3,888개로 집계했다. **`src/engine/` 무변경, 규준집단 파일 무변경,
기존 진단 스크립트(`attachment-diagnostic.ts`) 무변경.** `git status`에
`scripts/norm/avoidance-residual-diagnostic.ts` 신규 1건 + 상태 파일뿐.

### 진단 스크립트 — 재실행 가능 (축 수치화 정의 정정 시 전후 비교에 다시 쓴다)

- 경로: `scripts/norm/avoidance-residual-diagnostic.ts` (파일 I/O 없음, stdout JSON)
- 실행 (Windows / PowerShell, `attachment-diagnostic.ts`와 동일한 1회용 컴파일 방식):

  ```
  npx tsc scripts/norm/avoidance-residual-diagnostic.ts --ignoreConfig --ignoreDeprecations "6.0" `
    --outDir .norm-build --module commonjs --moduleResolution node10 `
    --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule --types node
  node .norm-build/scripts/norm/avoidance-residual-diagnostic.js
  Remove-Item -Recurse -Force .norm-build
  ```

  (설치된 tsc가 6.x라 `--ignoreConfig`·`--ignoreDeprecations "6.0"`·`node10`이
  필요하다. 커밋된 `attachment-diagnostic.ts` docblock의 명령도 같은 이유로
  이 두 플래그가 필요하다 — 그 파일은 이번에 건드리지 않았다.)

### 재사용한 함수 (재구현 없음 — import만)

| 함수 / 상수 | 시그니처 또는 형태 | 경로 |
|---|---|---|
| `inferLoveType` | `(input: LoveTypeInput) => LoveTypeInferenceResult`, 결과 필드 `attachAvoidance: number` | `src/engine/loveTypeInference.ts` |
| `MBTI_TYPES` | `readonly MbtiType[]` (16개, 열거 최외곽 루프) | `src/constants/quizTypes.ts` |
| `Q5_AVOIDANCE_AXIS` | `Record<QuizChoice, 'low'\|'mid'\|'high'>` (Q5 그룹 라벨용, 채점 미사용) | `src/constants/attachment.ts` |

열거 루프(MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)는
`scripts/norm/enumerate.ts::enumerateProfiles()` / `attachment-diagnostic.ts::
enumerateDiagnosticProfiles()`와 완전히 동일. `enumerateProfiles()`를 직접
호출하지 못한 이유: 반환 타입 `EnumeratedProfile`에 `attachAvoidance` 필드가
없음 → 커밋된 참조 `attachment-diagnostic.ts`가 같은 상황을 처리하는 방식
(같은 순서·같은 함수 호출로 루프를 다시 돌리되 필요한 필드만 추가)을 따름.
이 스크립트는 어떤 반올림도 추가하지 않음(loveTypeInference 내부 `clampInt`는
기존 채점 함수의 일부).

### 집계 ① `attachAvoidance` 전체 평균 (3,888개 산술평균)

- 정확 합계 `exactSum` = **200880**, 표본 수 = **3888**
- 평균 = **200880 / 3888 = 51.666666666666664** (JS double)
  - `toFixed(12)` = `51.666666666667`
  - `toPrecision(18)` = `51.6666666666666643`
- 문서 공칭값 `(20+50+85)/3` = `51.666666666666664` — **동일**

### 집계 ② Q5 응답별 `attachAvoidance` 값 빈도표 (값 오름차순, 반올림 없음)

```
Q5=A (q5Level=low) : { 20: 1296 }
Q5=B (q5Level=mid) : { 50: 1296 }
Q5=C (q5Level=high): { 85: 1296 }
```

- 각 수준 빈도 합: **1296 / 1296 / 1296** (`perLevelCountsAll1296` = true)
- 전체 합: **3888** (`totalCountIs3888` = true)
- 서로 다른 값 개수: **A=1, B=1, C=1** (세 수준 모두 단일 값)

### 검증 상태

- `npx tsc --noEmit -p .` : **0 에러**
- `npx jest --ci` : **26 suites / 348 tests 전부 pass** (테스트 추가/수정 없음, 회귀 0)
- `git status --short` : `scripts/norm/avoidance-residual-diagnostic.ts` 신규 +
  상태 파일(PROGRESS.md / HANDOFF.md)뿐. `src/engine/` · `src/engine/data/` ·
  `scripts/norm/attachment-diagnostic.ts` 변경 없음

### 판단 안 함

프롬프트 지시대로 수치만 보고한다. 위 빈도표가 무엇을 의미하는지(보정
유무·잔차 원인·축 수치화 정의 정정 필요 여부)는 마스터 PM 판단 사항이라
다루지 않았다. 문서(Part 17-3)와 코드가 어긋나 보여도 코드를 고치지 않았다 —
그 확인 자체가 이 진단의 산출물이다.

## DEF 애착 항 잔차 진단 (두 항 전수 평균 vs 파일 DEF 평균) — 완료 (2026-09-04, engine-dev)

Phase 7 선행 #12(`.claude/state/prompts/phase-7/12-engine-dev-def-term-residual.md`).
DEF 애착 항이 v2 `computeAttachmentStability(A,V)=100−(A+V)/2` → v3
`computeDefAnxietyStability(A)=75−A/2`로 바뀌었다. DEF 나머지 항은 두 판에서
동일하므로 DEF 평균 변화는 (이 항의 평균 차 × 0.3)이어야 한다. 규준집단
파일이 그와 어긋나는지 가른다. **어긋남이 항에 있는지 저장된 수치에 있는지를
가르는 진단** — 원인·정오는 판단하지 않는다.

### 이 작업이 만들지 않은 것 / 바꾸지 않은 것

- `src/` 아래 어떤 파일도 생성·수정 안 함 (공식·규준집단 파일 전부)
- `src/engine/data/norm-synthetic-v1/v2/v3.json` 무변경 — 저장된 값을 읽기 전용으로 옮기기만 함
- 기존 진단 스크립트 `attachment-diagnostic.ts` · `avoidance-residual-diagnostic.ts` 무변경
- 항 함수 식 재작성 없음 — `leagueStats.ts`에서 import해 호출
- 축 값은 `inferLoveType`에서 획득 (재구현 없음)
- 기존 테스트 assertion·기댓값 수정 없음 (신규 테스트 추가도 안 함)
- Q5별 코어 분포·DEF 항별 분해는 뽑지 않음 (차분에서 소거되는 양)

### 진단 스크립트 — 재실행 가능

- 경로: `scripts/norm/def-term-residual-diagnostic.ts` (규준 JSON 읽기 전용 I/O, stdout JSON)
- 실행 (Windows / PowerShell — 1회용 컴파일, ts-node/tsx 없음):

  ```
  npx tsc scripts/norm/def-term-residual-diagnostic.ts --ignoreConfig --ignoreDeprecations 6.0 `
    --outDir .norm-build --module commonjs --moduleResolution node --target es2022 `
    --esModuleInterop --skipLibCheck --resolveJsonModule --types node
  node .norm-build/scripts/norm/def-term-residual-diagnostic.js
  Remove-Item -Recurse -Force .norm-build
  ```

  (설치된 tsc가 6.x라 `--ignoreConfig`(TS5112)·`--ignoreDeprecations 6.0`(TS5107)이
  필요하다. 기존 두 진단 스크립트 docblock의 명령도 같은 이유로 이 플래그가
  필요하다 — 그 파일들은 이번에 건드리지 않았다.)

### 재사용한 함수 (재구현 없음 — import만)

| 함수 | 시그니처 | 경로 |
|---|---|---|
| `computeAttachmentStability` (v2 항) | `(attachAnxiety: number, attachAvoidance: number) => number` | `src/engine/leagueStats.ts` |
| `computeDefAnxietyStability` (v3 항) | `(attachAnxiety: number) => number` | `src/engine/leagueStats.ts` |
| `computeSixStats` (현재 DEF) | `(input: SixStatsInput) => SixStats`, `.def` 사용 | `src/engine/leagueStats.ts` |
| `inferLoveType` (축 값) | `(input: LoveTypeInput) => LoveTypeInferenceResult`, `.attachAnxiety`/`.attachAvoidance` | `src/engine/loveTypeInference.ts` |

열거 루프(MBTI_TYPES → Q1..Q5, 각 A,B,C)는 `enumerate.ts::enumerateProfiles()`와
동일. 표본 수 3,888 확인.

### ① 두 항의 전수 평균 (3,888개 산술평균)

- `termV2mean` = 187920 / 3888 = **48.333333333333336** (JS double)
  - `toFixed(15)` = `48.333333333333336` / `toPrecision(18)` = `48.3333333333333357`
- `termV3mean` = 191160 / 3888 = **49.166666666666664**
  - `toFixed(15)` = `49.166666666666664` / `toPrecision(18)` = `49.1666666666666643`
- **`termDiff = termV3mean − termV2mean`** (v3 항 − v2 항, 부호·순서 고정)
  = **0.8333333333333286**
  - `toFixed(15)` = `0.833333333333329` / `toPrecision(18)` = `0.833333333333328596`

### ② 규준집단 파일의 DEF 평균 재추출 (`stats.def.mean` 그대로, 재계산·반올림 없음)

| 파일 | version | engineVersions (loveTypeInference / leagueStats) | `stats.def.mean` | `stats.def.stdDev` |
|---|---|---|---|---|
| `norm-synthetic-v1.json` | synthetic-v1 | 1.0.0 / 1.0.0 | **44.222222** | 19.423799 |
| `norm-synthetic-v2.json` | synthetic-v2 | 1.0.0 / 2.0.0 | **44.222222** | 19.423799 |
| `norm-synthetic-v3.json` | synthetic-v3 | 1.0.0 / 3.0.0 | **44.666667** | 18.979521 |

- **v1 DEF 평균 == v2 DEF 평균 : 참** (둘 다 `44.222222`, `stdDev`도 동일)

### ③ 현재 코드로 계산한 DEF 평균 (현재 `computeSixStats(...).def`, 3,888 전수)

- 173664 / 3888 = **44.666666666666664** (JS double)
  - `toFixed(15)` = `44.666666666666664` / `toPrecision(18)` = `44.6666666666666643`

### ④ 대조 넷

| 항목 | 값 | `toFixed(15)` |
|---|---|---|
| (a) ②v3 − ②v2  (파일 기준 DEF 평균 변화) | `0.44444499999999465` | `0.444444999999995` |
| (b) 0.3 × termDiff  (항 변화가 예측하는 DEF 평균 변화) | `0.24999999999999856` | `0.249999999999999` |
| (c) ③ − ②v3  (현재 코드 ↔ v3 파일 일치 여부) | `-3.3333333249174757e-7` | `-0.000000333333332` |
| (d) (③ − 0.3 × termDiff) − ②v2  (현재 코드에서 v2 시절 DEF 평균 역산 − v2 파일값) | `0.19444466666666216` | `0.194444666666662` |

### 검증 상태

- `npx tsc --noEmit -p .` : **0 에러**
- `npx jest` : **26 suites / 348 tests 전부 pass** (테스트 추가·수정 없음, 회귀 0)
- `git status --short` : `scripts/norm/def-term-residual-diagnostic.ts` 신규 +
  상태 파일(PROGRESS.md / HANDOFF.md)뿐. `src/` · 기존 진단 스크립트 2개 무변경

### 판단 안 함

프롬프트 지시대로 수치만 보고한다. (a)와 (b), (c), (d)가 무엇을 의미하는지
(어긋남이 항에 있는지 저장된 수치에 있는지, 어느 파일이 틀렸는지, 어디를
고쳐야 하는지)는 마스터 PM 판단 사항이라 다루지 않았다. 어긋남이 보여도
코드·문서·규준집단 파일을 고치지 않았다 — 그 확인이 산출물이다.

## `v2` 규준집단 DEF 데이터 검증 (요약 필드 vs 원자료) — 완료 (2026-09-04, engine-dev)

Phase 7 선행 #13(`.claude/state/prompts/phase-7/13-engine-dev-v2-def-verify.md`).
직전 #12에서 `norm-synthetic-v2.json`의 DEF 평균이 역산값과 `0.194444` 어긋남이
확인됐다. 이 진단은 그 어긋남이 **파일의 `stats.def.mean` 요약 필드**에 있는지,
**`stats.def.sorted` 원자료**에 있는지를 가른다. 조회 전용 — 수치만 산출하고
원인·정오·`v2` 재산출 필요 여부는 판단하지 않는다.

### 이 작업이 만들지 않은 것 / 바꾸지 않은 것

- `src/` 아래 어떤 파일도 생성·수정 안 함 (엔진·규준집단 파일 전부)
- `src/engine/data/norm-synthetic-v1/v2/v3.json` 무변경 — `stats.def.sorted`·
  `stats.def.mean`을 읽기 전용으로 옮기기만 함 (재계산·반올림 없음)
- 기존 진단 스크립트 3개(`attachment-diagnostic.ts` ·
  `avoidance-residual-diagnostic.ts` · `def-term-residual-diagnostic.ts`) 무변경
- DEF 식·애착 항 식 재작성 없음 — `computeSixStats`를 import해 호출
- 회피축 보정량(4.5 / 0 / −5.25) 하드코딩 없음 — `V_i`에서
  `0.3 × (25 − V_i/2)`로 계산
- 기존 테스트 assertion·기댓값 수정 없음 (신규 테스트 추가도 안 함)

### 진단 스크립트 — 재실행 가능

- 경로: `scripts/norm/v2-def-storage-diagnostic.ts` (규준 JSON 읽기 전용 I/O, stdout JSON)
- 실행 (Windows / PowerShell — 1회용 컴파일, ts-node/tsx 없음):

  ```
  npx tsc scripts/norm/v2-def-storage-diagnostic.ts --ignoreConfig --ignoreDeprecations 6.0 `
    --outDir .norm-build --module commonjs --moduleResolution node --target es2022 `
    --esModuleInterop --skipLibCheck --resolveJsonModule --types node
  node .norm-build/scripts/norm/v2-def-storage-diagnostic.js
  Remove-Item -Recurse -Force .norm-build
  ```

  (설치된 tsc가 6.0.3이라 `--ignoreConfig`(TS5112)·`--ignoreDeprecations 6.0`(TS5107)이
  필요하다. `def-term-residual-diagnostic.ts`와 동일 플래그.)

### 재사용한 함수 (재구현 없음 — import만)

| 함수 | 시그니처 | 경로 | 용도 |
|---|---|---|---|
| `computeSixStats` | `(input: SixStatsInput) => SixStats`, `.def` 사용 | `src/engine/leagueStats.ts` | `v3DEF_i` (현재=v3 코드의 DEF) |
| `inferLoveType` | `(input: LoveTypeInput) => LoveTypeInferenceResult` | `src/engine/loveTypeInference.ts` | `V_i = .attachAvoidance`, `.big5`/`.sternberg`/`.attachAnxiety` 공급 |
| `roundTo` | `(value: number, decimals: number) => number` | `src/engine/numeric.ts` | 역산값을 `v2` `stats.def.sorted`와 동일 절차(10자리 반올림 후 오름차순)로 정렬 |

열거 루프(MBTI_TYPES → Q1..Q5, 각 A,B,C)는 `enumerate.ts::enumerateProfiles()`와
동일. 표본 수 · 배열 길이 전부 **3,888** 확인.

### 역산에서 `V_i`를 어떻게 얻었는가

프로파일마다 `inferLoveType({ mbti, q1, q2, q3, q4, q5 }).attachAvoidance`를
직접 호출해 얻었다. 회피축이 {20, 50, 85} 세 값뿐이라는 사실로 보정량을
미리 적지 않고, `v2DefReconstructed = v3Def + 0.3 * (25 - avoidance / 2)`를
코드에서 계산했다. 실측 결과 `V_i` 3종(각 1,296) → 보정량 3종
(−5.25 / 0 / +4.5, 각 1,296)으로 나뉘었고 이는 산출에 하드코딩되지 않았다.

### ① `v2` 파일 내부 정합성 (`stats.def.sorted` 직접 평균 vs `stats.def.mean`)

- 배열 길이 = **3888** (`arrayLengthIs3888: true`)
- `computedMean` = mean(`v2.stats.def.sorted`) = 171936 / 3888
  = **44.22222222222222** (JS double)
  - `toFixed(15)` = `44.222222222222221`
  - `toPrecision(18)` = `44.2222222222222214`
- `storedMean` = `v2.stats.def.mean` = **44.222222** (파일 그대로)
  - `toFixed(15)` = `44.222222000000002`
  - `toPrecision(18)` = `44.2222220000000021`
- **`computedMean − storedMean`** = **2.2222221929268926e-7**
  - `toFixed(15)` = `0.000000222222219`
  - `toPrecision(18)` = `2.22222219292689260e-7`
  (저장 `mean` 필드는 6자리 반올림값 `44.222222`이고, 배열 평균은 `398/9`.
  차 ≈ `2.22e-7`은 6자리 반올림 자리다.)

### ② `v2` 시절 DEF 프로파일별 역산 (`v2DEF_i = v3DEF_i + 0.3 × (25 − V_i/2)`)

- 표본 수 = **3888** (`sampleSizeIs3888: true`), 역산 정렬 배열 길이 = **3888**
- 역산 정렬 배열 first5 = `[13.75, 13.75, 13.75, 13.75, 13.75]`, last5 = `[84.5, ×5]`
- 입력 분포:
  - `v3Def` 고유값 6종: 19(864) / 35(864) / 49(432) / 50(864) / 65(432) / 80(432)
  - `V_i`(attachAvoidance): 20(1296) / 50(1296) / 85(1296)
  - 보정량 `0.3×(25−V_i/2)`: −5.25(1296) / 0(1296) / 4.5(1296)

### ③ 비교 결과 (역산 정렬 배열 vs `v2` `stats.def.sorted`, 원소별 — 불린 아님)

| 항목 | 값 | 소수 표기 |
|---|---|---|
| `maxAbsDiff` (원소별 절대차 최댓값) | **0.75** | `toFixed(15)` = `0.750000000000000` / `toPrecision(18)` = `0.750000000000000000` |
| `mismatchCount` (\|차\| > 1e-9 원소 수) | **2592** / 3888 | — |
| `meanDiff` (복원값 − 저장값의 평균) | **0.19444444444444445** | `toFixed(15)` = `0.194444444444444` / `toPrecision(18)` = `0.194444444444444448` |
| `reconstructedMean` (복원값 3,888개 평균) | **44.416666666666664** (172692 / 3888) | `toFixed(15)` = `44.416666666666664` / `toPrecision(18)` = `44.4166666666666643` |

- 원소별 차(복원 − 저장)의 고유값·빈도 (5종):
  −0.5(432) / −0.25(432) / 0(1296) / 0.5(864) / 0.75(864)
  → `meanDiff`가 단일 값이 아니라 5종으로 흩어져 있다. (일정한 이동 / 원소별
  다른 오류의 구분은 마스터 PM 판단 — 여기서는 분포만 제시.)

### 검증 상태

- `npx tsc --noEmit -p .` : **0 에러**
- `npx jest` : **26 suites / 348 tests 전부 pass** (테스트 추가·수정 없음, 회귀 0)
- `git status --short` : `scripts/norm/v2-def-storage-diagnostic.ts` 신규 +
  상태 파일(PROGRESS.md / HANDOFF.md)뿐. `src/` · 기존 진단 스크립트 3개 무변경

### 판단 안 함

프롬프트 지시대로 수치만 보고한다. `stats.def.mean` 요약 필드가 틀렸는지
`stats.def.sorted` 원자료가 틀렸는지, `v2`를 재산출해야 하는지는 마스터 PM
판단 사항이라 다루지 않았다. 어긋남이 보여도 코드·문서·규준집단 파일을
고치지 않았다 — 그 확인이 산출물이다.

## DEF 반올림 효과 검증 — 완료 (2026-09-09, engine-dev)

Phase 7 위임(`.claude/state/prompts/phase-7/14-engine-dev-def-rounding.md`).
DEF v2·v3 공식을 재구성해 반올림 전/후 평균을 각각 내고, 규준집단 파일의
`stats.def.sorted`와 대조했다. 조회 전용 —
`scripts/norm/def-rounding-effect-diagnostic.ts` 신규 1개만 추가, `src/`·
기존 진단 스크립트 4개·규준집단 파일(v1/v2/v3) 전부 무변경.

### 반올림 지점 (코드에서 확인, 추측 없음)

- **stage1** — `src/engine/leagueStats.ts` `computeSixStats()` 내부
  `def: roundAndClamp(def, 0, 0, 100)` → **decimals=0(정수)**, clamp[0,100].
  DEF가 함수를 벗어나기 전 적용되는 유일한 반올림.
- **stage2** — `scripts/norm/distribution.ts` `toSortedRawScores(values,
  RAW_SCORE_DECIMALS)`(`RAW_SCORE_DECIMALS=10`, 재정의 없이 import).
  stage1에서 이미 정수가 된 값에는 수치상 무영향이지만 배열에 들어가기까지
  실제로 거치는 반올림 호출이라 함께 적용.
- 파일 형태 확인: `v2`/`v3` `stats.def.sorted` 원소가 전부 정수 —
  stage1 decimals=0과 일치. **어긋남 없음.**

### 재사용 함수

`inferLoveType`(N/A/V/big5/sternberg), `computeAttachmentStability`(termV2),
`computeDefAnxietyStability`(termV3), `computeSixStats`(검산 대상 `.def`) —
전부 `src/engine/{loveTypeInference,leagueStats}.ts`에서 import. `roundTo`
/`roundAndClamp`는 `src/engine/numeric.ts`. `positiveBonus` 판정
(`q2 === 'B'` → 100/DEF)은 `leagueStats.ts`의 `groupBonus(q2==='B')`가
export되지 않아 동일 조건을 스크립트에 복제 — 명시 보고.

### 검산 — `defV3raw` 반올림 vs 현재 `computeSixStats(...).def`

`mismatchCount = 0`(3,888건 전부), `maxAbsDiff = 0.000000000000000`.
재구성식이 `computeSixStats` 내부 계산과 반올림 전까지 정확히 일치 — 재구성
정당성 확인됨.

### ① 반올림 없는 평균 (표본 3,888)

| | 값 |
|---|---|
| `E[defV2raw]` | `44.099999999999604`(toFixed15) |
| `E[defV3raw]` | `44.349999999999575`(toFixed15) |
| 차 | `0.249999999999972`(toFixed15) = `0.250000000000`(toFixed12) |

### ② 반올림 후 평균 (stage1→stage2 적용)

| | 값 |
|---|---|
| `E[round(defV2raw)]` | `44.222222222222221`(toFixed15) |
| `E[round(defV3raw)]` | `44.666666666666664`(toFixed15) |
| 차 | `0.444444444444443`(toFixed15) = `0.444444444444`(toFixed12) |
| (반올림후 차) − (반올림전 차) | `0.194444444444`(toFixed12) |

**±0.194444**는 이전 진단(`def-term-residual-diagnostic.ts`)이 "미해결
잔차"로 남겼던 값과 자릿수까지 일치한다. 수치만 보고 — 해석·판단은
마스터 PM.

### ③ 반올림 후 `v2`의 고유값·빈도 (합계 3888 확인)

18종: 13(288)/19(288)/23(288)/30(288)/35(288)/40(288)/43(144)/44(288)/
49(144)/50(288)/53(144)/54(288)/60(144)/65(144)/70(144)/74(144)/80(144)/84(144)

### ④ 반올림 후 `v3`의 고유값·빈도 (합계 3888 확인)

6종: 19(864)/35(864)/49(432)/50(864)/65(432)/80(432)

### ⑤ 파일과의 대조 (파일 값 그대로 읽음, 재계산 없음)

- `norm-synthetic-v2.json` `stats.def.sorted` vs ③: **값 집합 일치, 빈도
  전부 일치**(18종 전부 `diff: 0`). `storedMean = 44.222222`.
- `norm-synthetic-v3.json` `stats.def.sorted` vs ④: **값 집합 일치, 빈도
  전부 일치**(6종 전부 `diff: 0`). `storedMean = 44.666667`.

### 실행 방법

```
npx tsc scripts/norm/def-rounding-effect-diagnostic.ts --ignoreConfig `
  --ignoreDeprecations 6.0 --outDir .norm-build `
  --module commonjs --moduleResolution node --target es2022 `
  --esModuleInterop --skipLibCheck --resolveJsonModule --types node
node .norm-build/scripts/norm/def-rounding-effect-diagnostic.js
Remove-Item -Recurse -Force .norm-build
```

재실행 시 바이트 단위로 동일한 stdout(직접 확인 — 2회 실행 diff 없음).

### 검증 상태

- `npx tsc --noEmit -p .` : **0 에러**
- `npx jest` : **26 suites / 348 tests 전부 pass** (테스트 추가·수정 없음, 회귀 0)
- `git status --short` : `scripts/norm/def-rounding-effect-diagnostic.ts` 신규
  1개 + 상태 파일뿐. `src/` · 기존 진단 스크립트 4개 · 규준집단 파일(v1/v2/v3)
  전부 무변경. `.norm-build/`는 임시 산출물이라 삭제함(커밋 안 함).

### 판단 안 함

프롬프트 지시대로 수치만 보고한다. 반올림이 관측된 차이의 원인인지, `v2`
파일을 어떻게 처리해야 하는지는 마스터 PM 판단 사항이라 다루지 않았다.
코드·문서·규준집단 파일을 고치지 않았다.

## 레지스트리 정리(resolutionCondition 제거) + temperature.ts 재-export 제거 (2026-09-12, engine-dev)

`.claude/state/prompts/phase-7/18-engine-dev-registry-cleanup.md` 수행.
두 가지 정리, 착수 전 조사를 직접 재확인 후 진행했다.

### 착수 전 조사 결과 (직접 재확인)

- `resolutionCondition` 소비처: `src/engine/constants/unresolved.ts` 내부뿐
  (타입 선언 42행, 네 키의 값 56/62/68/74행, 에러 메시지 조립 98행).
  `src/`·`__tests__/`·`scripts/` 전체 재귀 grep(`resolutionCondition`)으로
  직접 재확인 — 코드상 외부 소비 없음(프롬프트 문서의 상태 기록 인용 제외).
  프롬프트 주장과 정확히 일치.
- 재-export 소비처: `temperature.ts`에서 `resolveTypeAffinity`·
  `TypeAffinityCategory`를 가져가는 곳은 `__tests__/engine/temperatureBaseline.test.ts`
  (수정 전 28행 import 블록) 하나뿐임을 grep으로 직접 재확인.
  `src/engine/dnaScore.ts`는 이미 `./typeAffinity`에서 직접 import.
  `src/store/coupleStore.ts:30`은 `DISCONNECTED_TEMPERATURE`만 import —
  궁합 심볼과 무관함을 확인. 프롬프트 주장과 정확히 일치.

### 1부 — `resolutionCondition` 제거

`UnresolvedConstantMeta` 인터페이스에서 `resolutionCondition` 필드(및 그
TSDoc 줄) 제거, 등록된 4개 키의 값에서 각각 제거, `UnresolvedConstantError`
생성자의 에러 메시지에서 그 문장만 제거. `UNRESOLVED` 함수 시그니처·본문,
`UnresolvedConstantError`/`UnknownUnresolvedKeyError` 두 에러 클래스,
키 유니온 파생 구조, 등록된 키 4개는 무변경.

에러 메시지 변경 전/후 (`UnresolvedConstantError` 생성자):

- 전:
  ``UNRESOLVED constant "${key}" — Phase ${meta.phase}에서 소비 예정, ` +
  `근거 문서 ${meta.doc}. 해소 조건: ${meta.resolutionCondition}. ` +
  '이 값을 지어내지 말고, 해소 전까지 호출부에서 이 계수를 실사용하지 말 것.'``
- 후:
  ``UNRESOLVED constant "${key}" — Phase ${meta.phase}에서 소비 예정, ` +
  `근거 문서 ${meta.doc}. ` +
  '이 값을 지어내지 말고, 해소 전까지 호출부에서 이 계수를 실사용하지 말 것.'``

`doc`은 그대로 남으므로 정보 손실 없음(r11 규정대로 해소 조건은 `doc`이
가리키는 절에서 읽는다).

**`__tests__/engine/unresolved.test.ts`는 무수정으로 전부 통과했다** —
`phase`·`doc`만 assert하고 `해소 조건` 문장은 검사하지 않던 기존 assertion이
메시지에서 그 문장이 빠진 뒤에도 그대로 통과. 같은 파일의 메시지 결정론
테스트(동일 키 100회 반복 → 메시지 동일)도 무수정으로 통과. 이것이 "해소
조건을 지워도 정보 손실이 없다"는 r11 판단의 실증이다(프롬프트 1부 증거).

### 2부 — 재-export 제거

`src/engine/temperature.ts`에서 `resolveTypeAffinity`·`TypeAffinityCategory`
재-export 두 줄(`export { resolveTypeAffinity }` / `export type
{ TypeAffinityCategory }`)과 그 재-export를 설명하던 TSDoc 블록 2곳(도입부
블록 전체, ① 절 안내 문장 중 재-export를 언급한 한 문장)을 제거했다 —
재-export 자체를 설명하던 문장이라 남기면 존재하지 않는 export를 가리키는
허위 문서가 되므로 함께 제거. `DISCONNECTED_TEMPERATURE` 등 다른 심볼
import·계산 로직·`TEMPERATURE_ENGINE_VERSION`(1.1.0 그대로)·
`computeAttachmentStability` 본문은 무변경. `src/store/coupleStore.ts`는
전혀 수정하지 않음(git status로 확인 — 무변경).

`__tests__/engine/temperatureBaseline.test.ts`의 import 변경 전/후:

- 전: 단일 import 블록으로 `DISCONNECTED_TEMPERATURE` 등과 함께
  `resolveTypeAffinity`까지 `'../../src/engine/temperature'`에서 가져옴.
- 후: `resolveTypeAffinity`만 별도 줄로 분리해
  `'../../src/engine/typeAffinity'`에서 import. 나머지 심볼은 기존대로
  `'../../src/engine/temperature'`에서 그대로 import. **assertion·기댓값은
  한 글자도 수정하지 않음.**

`temperatureBaseline.test.ts`는 경로만 바뀐 채 전부 통과했다. **순수 이동의
증거가 재-export("기존 경로로 그대로 가져가도 통과")에서 "경로만
`./typeAffinity`로 바꾸고 assertion은 그대로인 채 전부 통과"로
갈아끼워졌다** — 이것이 이번 작업의 새 증거다.

### 검증

- `npx tsc --noEmit -p .` — **0 에러**.
- `npx jest` — **26 suites / 415 tests 전부 통과**(감소 없음, `unresolved.test.ts`·
  `temperatureBaseline.test.ts` 포함).
- `determinismStaticRules.test.ts`(34번에서 추가된 정적 규칙 A·B) 계속 통과.
- `scripts/norm/unresolvedInventory.ts` 실행 결과: **정의 4 / 소비 2**(합계 6)로
  유지 — `resolutionCondition` 제거·재-export 제거 모두 이 집계에 영향 없음.
- `git status --short` — 수정 3파일뿐: `src/engine/constants/unresolved.ts`,
  `src/engine/temperature.ts`, `__tests__/engine/temperatureBaseline.test.ts`.
  `src/engine/typeAffinity.ts`·`src/store/coupleStore.ts`·
  `__tests__/engine/unresolved.test.ts`는 무변경. 커밋·푸시하지 않음.

## 코너 파이프라인 검증망 선설치 — 브랜드 타입 + 정적 규칙 C·D·E (2026-09-13, engine-dev)

위임: `.claude/state/prompts/phase-7/19-engine-dev-guardrails.md`. 근거:
`docs/ONDOLOG_MASTER.md` Part 17-0-1·17-0-2·17-0-3·17-0-3-A. **파이프라인·
LLM 호출·계수 조회 모듈은 만들지 않음** — 그건 다음 위임(문서 안에서
`#13`으로 지칭)의 일이고, 이번은 타입 정의 + 검증 규칙만.

### 1부 — 조사 결과 (구현 전)

1. **기존 정적 스위트 파일 수집 방식**: `determinismStaticRules.test.ts`는
   비재귀(`fs.readdirSync(engineDir)`, 옵션 없음) 4패턴 검사 블록 하나와,
   같은 파일 안에 재귀 수집 헬퍼 `collectEngineFilesRecursive`(하위
   디렉터리 포함, `.ts`만·`.test.ts` 제외)를 쓰는 규칙 A·B 블록 둘이
   같이 있다(2026-09-12 작업에서 같은 파일에 추가된 것). `importBoundary.test.ts`는
   비재귀 `fs.readdirSync`로 `src/engine/` 전체를 스윕한다. 어느 스위트도
   `src/engine/` 밖(`supabase/functions/`·`src/services/`)을 수집하지 않는다.
2. **주석 제거 유틸**: `stripComments(source) { return
   source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '') }` 형태가
   `determinismStaticRules.test.ts`·`importBoundary.test.ts`·
   `dnaBaseScore.test.ts`·`dnaScore.test.ts` 4개 파일에 **각자 로컬로
   복제**돼 있다(2026-09-12 조사 결과 그대로, 변동 없음).
3. **세 디렉터리 실존 여부**: `supabase/functions/`는 존재하고 `.gitkeep`
   1개뿐(`.ts` 없음). `src/services/`는 존재하고 실제 `.ts` 6개(`chatApi`·
   `coupleApi`·`personalityApi`·`referencePhotoApi`·`socialAuth`·`supabase`) +
   `llm/`·`map/` 하위 디렉터리(둘 다 `.gitkeep`만). `src/engine/corners/`는
   존재하고 이번 작업 전엔 `.gitkeep`만이었다(이번 작업이 `brandedTypes.ts`
   1개를 추가).
4. **규칙 로직 분리 여부**: 기존 두 스위트 모두 규칙 판정을 **테스트 본문에
   인라인**으로 둔다(`expect(source).not.toMatch(pattern)`을 `it()` 블록
   안에서 직접 호출) — 파일경로·소스문자열을 받아 위반 목록을 반환하는
   재사용 가능한 순수 함수로 분리돼 있지 않다.

**복제된 유틸(`stripComments`)은 통합하지 않았다** — 이번에 만든 새 스위트도
독립적으로 로컬 정의한다(지시대로).

### 2부 — 브랜드 타입

**신규 파일**: `src/engine/corners/brandedTypes.ts`.

```ts
export type ValidatedContent<T> = T & { readonly __validated: unique symbol }
export type CoeffBundle = {
  /* 계수 — 구체 필드는 #13이 코너별 요구사항에 맞춰 정한다 */
  readonly version: string
} & { readonly __fromConfig: unique symbol }
```

마스터 Part 17-0-2 원문 그대로. `unique symbol`을 별도 명명된 상수 없이
프로퍼티 타입으로 인라인 선언하는 방식이라 **애초에 내보낼 심볼 상수
자체가 없다**(export 금지 요건을 자연스럽게 만족). 두 타입 자체
(`ValidatedContent`/`CoeffBundle`)는 호출부가 시그니처에 써야 하므로
export한다. **생성 함수·캐스트는 이 파일에 없음** — docblock에 `#13`이
이 모듈 **안에** 추가할 두 함수(파싱·검증 함수 / app_config 조회 함수)의
자리만 설명 문구로 표시했다(코드 없음). `Object.keys()` 런타임 검사로
"이 모듈에 타입 외의 런타임 값이 없다"를 테스트로 고정했다(아래 4부).

**타입 자체가 생성 불가능함을 별도로 수동 검증**(스크래치 파일,
저장소에 남기지 않음): `check.ts`에서 `const bad: CoeffBundle = {version:
'1.0.0'}`는 `@ts-expect-error`로만 통과하고(직접 대입 불가), `raw as
ValidatedContent<T>` 캐스트만 유일한 생성 경로임을 `npx tsc --noEmit
--ignoreConfig --strict`로 확인했다.

### 3부 — 정적 규칙 C·D·E (새 스위트)

**신규 파일**: `__tests__/engine/cornerPipelineStaticRules.test.ts`.
기존 두 스위트는 전혀 수정하지 않았다(git diff 없음).

- **수집**: `supabase/functions/`·`src/services/`·`src/engine/corners/`
  세 루트를 각각 재귀 수집(`collectFilesRecursive` — 이 파일 로컬,
  `fs.existsSync` 확인 후 없으면 `[]` 반환, 있으면 `.ts`만·`.test.ts` 제외
  재귀). 세 디렉터리 중 하나가 없거나 비어 있어도(현재
  `supabase/functions/`가 그 상태) 깨지지 않음을 별도 테스트로 확인.
- **규칙 로직**: `ruleC_llmCallBoundaryViolations`·
  `ruleD_appConfigLookupBoundaryViolations`·`ruleE_brandCastViolations`
  세 순수 함수(시그니처: `(relFilePath: string, rawSource: string) =>
  string[]`), 전부 `stripComments` 적용 후 정규식 검사. 디렉터리 순회
  (`scanRepository`)는 이 함수들을 호출하는 얇은 층.

**확정한 모듈 경로 둘** (`#13`이 이 경로에 실제 모듈을 만들어야 함 —
어긋나면 `#13`이 규칙에 걸림):

| 규칙 | 허용 모듈 경로 | 판정 패턴 |
|---|---|---|
| **C** (LLM 호출) | `supabase/functions/_shared/llmClient.ts` | `fetch(` · `from '@anthropic-ai/sdk'` · `from 'openai'` · `new Anthropic(` · `new OpenAI(` |
| **D** (app_config 조회) | `supabase/functions/_shared/coeffLookup.ts` | `.from('app_config')` |

`_shared/`는 Supabase Edge Function 여러 배포 단위가 공통 코드를 상대
경로로 가져다 쓰는 관례적 디렉터리로 판단해 선택(구현 판단, 문서에
경로 리터럴이 없어 이번 작업이 확정). **명시적 한계 — 지어내지 않기
위해 범위를 좁힌 것**: 규칙 C는 위 패턴 밖의 LLM 호출 방식을, 규칙
D는 `.from('app_config')` 밖의 접근 방식(원시 SQL 등)을 놓칠 수 있다.
`#13`이 이 패턴과 다른 방식을 쓰면 규칙이 못 잡을 수 있음 — 이번 작업
범위에서 확장하지 않고 기록만 남긴다.

- **규칙 E**: 브랜드 정의 모듈(`src/engine/corners/brandedTypes.ts`)을
  경로 상수(`BRAND_DEFINITION_MODULE`)로 참조해, 이 경로만 예외로 두고
  `as ValidatedContent`·`as CoeffBundle` 캐스트를 검사.

### 4부 — 규칙 작동 증명 (합성 입력, 실제 파일 미생성)

세 규칙 각각 **위반 / 정상 / 주석전용** 3종 + 규칙 E는 **정의 모듈
예외** 관련 3건(정의 모듈 안 `ValidatedContent` 캐스트 무사, 정의 모듈
안 `CoeffBundle` 캐스트 무사, 같은 캐스트라도 다른 경로면 걸림) 추가.
규칙 C·D도 "지정 모듈 자신은 호출이 있어도 안 걸린다"(위치 제약 확인)
1건씩 추가. 합성 소스는 전부 테스트 파일 안의 문자열 상수 — **실제
파일로 만들지 않음**(수집 대상이 되는 것을 피하기 위해).

추가로 **실제 저장소 상태 확인** 5개 테스트: `supabase/functions/`
현재 `.ts` 0개 확인, 세 디렉터리 전체 스캔이 예외 없이 동작, 그리고
`src/engine/corners/brandedTypes.ts`(실제 파일)가 규칙 C·D·E 어느 것도
위반하지 않음(현재는 캐스트 자체가 없어 규칙 E도 자명하게 통과).

### 검증

- `npx jest --ci --watchAll=false`: **27 suites / 449 tests 전부 통과**
  (기존 415 + 신규 34, 회귀 없음).
- `npx tsc --noEmit -p .`: **0 에러**.
- `scripts/norm/unresolvedInventory.ts`: **정의 4 / 소비 2**(합계 6) 그대로
  유지 — 이번 작업은 `src/engine/constants/unresolved.ts`나 그 소비 지점을
  건드리지 않음.
- `git status --porcelain`: 신규 파일 2개뿐 —
  `src/engine/corners/brandedTypes.ts`, `__tests__/engine/cornerPipelineStaticRules.test.ts`.
  기존 스위트·`src/engine/` 기존 파일·상태 파일 외 다른 파일 무변경.
  커밋·푸시 없음.

### 발견 사실 — 보고만, 수정하지 않음

`src/services/referencePhotoApi.ts:63`에 실제 `fetch(input.localUri)` 호출이
이미 있다(얼굴 인식 참조 사진을 로컬 URI에서 읽어오는 용도, LLM과 무관).
규칙 C의 판정 패턴(`fetch(`)은 위치만 보고 목적을 판별하지 않으므로,
**이 파일도 향후 `src/services/` 전체에 규칙 C를 "위반 0건 기대"로
돌리면 걸린다.** 이번 스위트는 그런 전역 "0건이어야 한다" 단언을 넣지
않아 현재 통과하지만, `#13`이나 이후 작업이 규칙 C를 `src/services/`
전체에 대해 엄격하게 적용하려 하면 이 파일이 먼저 걸린다는 점을 미리
기록해 둔다. 규칙을 좁히거나(예: LLM 전용 식별자만 판정) 이 파일을
예외 처리하는 판단은 이번 작업 범위 밖이라 하지 않았다.

### `#13` 착수 시 확인 필요 사실 (기록)

- 위 표의 모듈 경로 둘(`supabase/functions/_shared/llmClient.ts`,
  `supabase/functions/_shared/coeffLookup.ts`)에 정확히 그 이름으로
  파일을 만들어야 규칙 C·D를 통과한다.
- `ValidatedContent`/`CoeffBundle` 생성 함수는
  `src/engine/corners/brandedTypes.ts` **안에만** 추가해야 한다(다른
  곳에 만들면 export 금지·규칙 E에 막힘).
- Edge Function 코드가 `tsc` 컴파일(타입 체크) 대상에 포함돼야 브랜드
  타입 층이 그 코드에 실제로 작동한다(Part 17-0-3-A 경고 — `#13` 사전
  점검 항목).
- **`#13` 완료 시점에 규칙 C·D·E(이 새 스위트)가 여전히 통과하는지
  다시 확인해야 한다** — 코드가 생긴 뒤 규칙이 우회되지 않았는지는
  그때 가서만 실제로 검증된다.

