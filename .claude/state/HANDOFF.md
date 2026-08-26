# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료된 항목은 즉시 삭제할 것** — 누적되면 컨텍스트가 오염된다.

## Phase 2(엔진) 산출 타입 요약 — 여전히 유효, 그대로 참조

전부 `src/engine/*.ts`에서 export. 상세는 각 파일 상단 docblock 참조.

- `src/engine/loveTypeInference.ts` — `inferLoveType`, `resolveMbtiFromQuickQuiz`,
  개별 `compute*` 함수들, `LOVE_TYPE_ENGINE_VERSION`. Phase 3에서 그대로
  소비했다(`src/store/sessionStore.ts`, `src/services/personalityApi.ts`).
- `src/engine/leagueStats.ts` — `computeSixStats`/`computeOvrRawScore`(자리
  표시자)/`percentileRank`/`mapPercentileToOvr`. Phase 3에서는 미사용
  (메인 탭 범위).
- `src/engine/temperature.ts` — `resolveDisconnectedTemperature`(36.5 고정),
  `clampTemperature`. **앱 클라이언트에서 이 파일의 함수를 호출하지
  않는다**(파일 상단 계약) — Phase 3의 `src/store/coupleStore.ts`는
  `DISCONNECTED_TEMPERATURE` **상수**만 재노출하고 함수는 호출하지 않는
  방식으로 이 계약을 지켰다. Phase 4(메인 탭)도 동일 원칙 유지할 것.
- `src/engine/dnaScore.ts` — `clampDnaScore`/`computeTotalScore`. base_score
  궁합 공식 없음(아래 "미확정" 참조).

## Phase 3(온보딩 UI) 산출 요약 — 이후 Phase가 가져다 쓰는 용도

- **세션 분기**: `app/index.tsx`가 앱 실행 시 세션 유무 +
  `profiles.onboarding_step`로 라우팅을 전부 결정한다. 새 Phase가 메인
  탭 진입 로직을 따로 만들 필요 없음 — `onboarding_step`이
  `ONBOARDING_STEP.COMPLETE`(3)면 이미 `/main`으로 보낸다.
- **`src/constants/onboardingStep.ts`**: `profiles.onboarding_step`은
  DB CHECK 제약으로 **0~3 범위 고정**(`supabase/migrations/003_profiles.sql`).
  Part 11-1 문서는 "완료/미완료"만 규정하고 구체 정수는 스키마 쪽
  원문(주석 "0=가입직후 … 3=온보딩완료")을 따랐다 — 새 화면을 끼워
  넣더라도 이 범위를 벗어나면 DB insert/update가 즉시 실패한다.
- **`src/services/coupleApi.ts`**: 초대 코드 발급(`getOrCreateInvite`)/
  참여(`redeemInviteCode`)/스킵(`completeOnboardingWithoutCouple`)/
  사귄날짜(`setOrConfirmStartDate`) 전부 RLS 정책만으로 클라이언트
  직접 호출(RPC 불필요) — `couples_update` 정책이 "빈 슬롯에 들어가는"
  참여를 이미 허용하도록 db-architect가 설계해둔 덕분.
- **소셜 로그인 구현 방식**(`src/services/socialAuth.ts`): 카카오/구글/
  애플 네이티브 SDK 대신 `supabase.auth.signInWithOAuth` +
  `expo-web-browser` 리다이렉트 방식을 선택했다(이유는 파일 상단
  docblock). Provider 문자열은 `'kakao' | 'google' | 'apple'`
  (`@supabase/auth-js`의 `Provider` 타입에 이미 포함돼 있음 확인함).
  이 방식이 최종 채택인지는 사람 검토 필요 — 네이티브 SDK로 바꾸기로
  하면 이 파일과 `app/(onboarding)/auth.tsx`만 교체하면 되고 나머지
  (profiles/personality_assessments 저장 로직)는 영향 없다.
- **애니어그램 코어 "후보 2개"**(화면 7): `src/utils/enneagramCandidates.ts`
  — Part 10-1-2 Q1/Q2 산출물 표에서 구조적으로 도출(Q1이 같은 호나이
  그룹 3개로 좁히고 Q2가 그중 1개를 확정 → 나머지 2개가 후보). MBTI
  사전분포(enneagramPrevalence.ts)와는 무관 — 그건 화면 5 "희귀 조합"
  배지 전용으로 그대로 분리 유지했다.

## Phase 4(5개 탭 UI) 산출 요약 — Phase 5+가 가져다 쓰는 용도

- **`src/store/coupleStore.ts`** (`isConnected` 등가 상태, Part 9-1 화면 8
  "전역 상태 coupleStore.isConnected" 원문 명명 그대로 — 실제 필드명은
  `status: 'unknown'|'loading'|'disconnected'|'connected'`). 이번
  Phase에서 필드 확장:
  - `partnerId: string | null` — 연결 시 상대 profiles.id
  - `nickname: string | null` — 커플 닉네임(`couples.nickname`)
  - `temperature: number | null` — **타입이 `number`에서 바뀌었다.**
    미연결이면 항상 `DISCONNECTED_TEMPERATURE`(36.5), 연결이면
    `daily_temperature` 최신 저장값(없으면 `null` — 아직 배치가 한
    번도 안 돎). **null을 절대로 임의 숫자로 대체하지 말 것** — 화면은
    null일 때 숫자 대신 대기 상태 문구를 보여줘야 한다(작업 지시
    "미연결 36.5도 외에는 노출 금지" 계약, `app/(tabs)/main.tsx`
    docblock 참조).
  - `temperatureDateOn: string | null` — 위 temperature가 계산된 날짜.
  - `refresh(userId)`가 이제 `daily_temperature`도 실제로 조회한다
    (기존엔 36.5 기본값만 유지했었음).
- **`src/components/CoupleGate.tsx`**: 변경 없음(Phase 3 그대로). 단
  **메인 탭은 이 컴포넌트를 쓰지 않는다** — Part 9-2가 연결/미연결을
  "같은 화면의 잠긴 기능"이 아니라 처음부터 별개 표로 정의해서다.
  `<CoupleGate>`는 "같은 화면 안에서 기능 하나만 잠기는" 경우
  전용으로 남겨뒀다 — 실제 사용처: 채팅 탭(`autoOpenInvite`), 피드
  탭(통합 타임라인 섹션만), 매거진 탭(발행물 영역 전체). 새 Phase가
  커플 전용 기능을 추가할 때 이 두 패턴(전용 화면 vs 부분 잠금) 중
  어느 쪽인지 먼저 판단할 것.
- **`src/utils/relationshipDays.ts`** (`computeDaysTogether`): 사귄
  일수 D+N 계산 순수 함수, `now` 인자 주입 가능(테스트 결정론용).
  시작일을 1일차로 세는 관행을 채택했다(원문에 오프셋 명시 없음,
  파일 상단 docblock에 근거 기록) — 원문이 다르게 확정되면 이 파일만
  교체.
- **탭 하나 새로 열 때 잊지 말 것**: `<CoupleGate>`를 쓰는 화면은
  마운트 시 `useCoupleStore.getState().refresh(userId)`를 직접
  호출하거나 `useEffect`로 트리거해야 한다 — 하지 않으면 store가
  `status: 'unknown'`에 멈춰 `<CoupleGate>`가 계속 빈 화면(`null`)을
  반환한다(피드 탭에서 실제로 이 버그를 발견해 고쳤다 — Phase 4
  완료 절 참조).

## 문서 불일치 발견 — 콘텐츠팀/코디네이터 확인 필요

**Part 10-6-5 "8 · IRON" 온도차 표가 Part 10-6-4 순환 고리와 모순된다.**
Part 10-6-4는 온도차 9쌍이 `1-8-7-3-2-5-9-4-6-1` 순환 고리를 이룬다고
명시하고("상호 대칭 필수"), 실제로 8을 제외한 8개 코어의 온도차 목록은
전부 이 고리와 정확히 일치한다. 그런데 "8 · IRON" 항목만 온도차 상대로
{1 KEEL, 6 OATH}를 적어놨다 — 고리대로면 {1, 7}이어야 한다("7 · RUSH"
쪽 목록에는 이미 8이 온도차 상대로 명시돼 있어 8 쪽에서 7이 빠지면
상호성이 깨진다). `src/constants/compatibility.ts`는 순환 고리를
기준으로 8의 두 번째 항목을 7로 교정하고, 문구는 "7 · RUSH" 목록에
이미 있던 원문(이유: "주장형끼리, 주도권 충돌", 팁: "밀어붙이기 전에
한 박자 쉬어보세요")을 그대로 재사용했다(새 문구 창작 없음) —
`compatibility.ts` 파일 상단 docblock에 상세 근거 기록. **콘텐츠팀
확인 후 원문이 다르게 확정되면 이 항목만 교체할 것.**

## 여전히 필요한 처리 (사람 작업)

1. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
2. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
3. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
4. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
   약관 동의 UI는 구현 완료(`app/(onboarding)/auth.tsx`,
   `src/components/ConsentChecklist.tsx` 등). 단
   `supabase/migrations/017_profiles_marketing_consent.sql`
   (marketing_agreed_at 컬럼 추가 + terms/privacy_agreed_at
   default now() 제거)을 원격에 아직 push하지 않았다 — 사람이
   `npx supabase db push` 실행 후 `supabase gen types`로
   `src/types/database.ts` 재생성 필요(지금은 수동 패치 상태).
   미적용 상태에서는 marketing_agreed_at upsert가 실패한다.
   상세는 `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
   약관/개인정보처리방침/AI 활용 고지 **본문은 여전히 자리표시자**다
   (`src/constants/legalDocuments.ts`) — 출시 전 법무 검토 본문으로
   교체 필요.
5. **avatars Storage 버킷 정책 미정** — 개인/커플 대표사진 경로 규칙
   (`{user_id}/...` vs `{couple_id}/...`)이 SCHEMA.md에 없어 결정을
   미뤘다(Phase 3는 사진 업로드 화면이 없어 영향 없었음). 대표사진
   업로드 UI를 만드는 Phase에서 경로 규칙 확정 + 후속 마이그레이션
   (017 등)으로 정책 추가 필요.
6. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
7. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
8. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
9. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
10. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
11. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.

## Phase 2(엔진) 산출물 요약 (참고용)

- `src/constants/*.ts`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`
- `__tests__/engine/*.test.ts` — 94개 전부 통과
- love_type_labels 36종 네이밍·카피 확보(`src/constants/loveTypeLabels.ts`).
  `description_ko`만 Part 16 열린 과제로 미확정(null) — 화면 7은 null이면
  해당 섹션을 조건부로 숨기는 방식으로 대응 완료.
