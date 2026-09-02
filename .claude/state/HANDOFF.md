# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료된 항목은 즉시 삭제할 것** — 누적되면 컨텍스트가 오염된다.

## `tsconfig.json` `types` 배열 신설 (2026-09-02, 코디네이터 지시) — CLAUDE.md 절대 규칙 8 명시

**변경 전**: `compilerOptions`에 `types`/`typeRoots` 키 없음(로컬·`expo/tsconfig.base`
병합본 `--showConfig`로 확인 — 둘 다 부재).
**변경 후**: `"types": ["jest", "node"]` 추가.

**원인**: 자동 `@types/*` 스캔이 jest뿐 아니라 node(`fs`/`path`/`__dirname`)까지
전부 안 되고 있었다(baseline 720에러 중 8건이 이미 `TS2591` node 관련 —
jest 전용 문제라는 최초 라벨이 부정확했음). `npx tsc --noEmit --types jest`
단독 시험 720→15, `--types jest,node` 시험 720→0으로 원인을 확정한 뒤 반영.
`node_modules/@types/jest`·`node`는 원래도 정상 설치돼 있었다(호이스팅
문제 아님) — 그저 아무 것도 자동 로드되지 않고 있었을 뿐.

**검증**: `npx tsc --noEmit -p .` 전체 0에러(신규 파일 포함), `npx jest` 267/267
그대로 pass(회귀 없음). `unresolved.test.ts`의 `@ts-expect-error` 2곳도
이제 유효성이 증명됐다 — tsc가 "Unused '@ts-expect-error' directive"를
전혀 보고하지 않았으므로(0에러에 포함되려면 이 경고도 없어야 한다) 두
디렉티브 모두 실제로 타입 에러를 억제하고 있다는 뜻이다.

## `UNRESOLVED` 규격 1단계 — 완료 확정 (2026-09-02) — 2단계는 승인 대기

`src/engine/constants/unresolved.ts` + `__tests__/engine/unresolved.test.ts`
작성 완료. **2단계(호출부 적용)는 이 인수인계 이후 별도 지시가 있어야
착수한다 — 아직 진행하지 않았다.**

- **등록된 키 3종과 소비 예정 Phase** (Part 16-2 목록과 1:1):
  - `temperature.activityScore` — Phase 7 (`MASTER Part 10-7-3`)
  - `leagueStats.shrinkage` — Phase 7 (`MASTER Part 10-8-3`)
  - `faceMatch.threshold` — Phase 6 (`MASTER Part 9-4`)
- **`faceMatch.ts` 호출부 존재 여부 조사 결과: 없음.** `isMatch`/
  `matchAgainstReferences`를 참조하는 코드는 저장소 전체에서
  `src/engine/faceMatch.ts` 자신과 `__tests__/engine/faceMatch.test.ts`뿐
  (`app/`, `src/services/`, `src/hooks/` 등 어디에도 caller 없음).
  프롬프트 지시대로 **호출부를 새로 만들지 않았다** — `faceMatch.ts`
  파일 자체도 이번 작업에서 전혀 건드리지 않았다. **2단계(호출부 적용)는
  진행하지 않는다** — 없는 호출부를 새로 만드는 것은 Phase 6 스캔
  파이프라인 설계를 이 세션이 선점하는 것이 되어, 별도 지시 없이 하지
  않는다(CLAUDE.md 절대 규칙 8과 같은 성격). `faceMatch.threshold`는
  레지스트리에 등록된 채 소비자를 기다리는 것이 이 규격이 의도한
  정상 상태다.
  > ⚠️ **Phase 6 스캔 파이프라인 구현 시 반드시 지킬 것**: `isMatch`의
  > `threshold` 인자는 `UNRESOLVED('faceMatch.threshold')`를 통해
  > 주입한다. 숫자를 직접 넣지 않는다. 값은 실기기 캘리브레이션 후
  > 확정된다.
- **이 변경으로 영향받은 기존 테스트: 없음.** `__tests__/engine/unresolved.test.ts`는
  신규 파일이고, 기존 파일은 하나도 수정하지 않았다. `npx jest` 전체
  실행 결과 22 suites / 267 tests 전부 pass(기존 257 + 신규 10).
- **`npx tsc --noEmit -p .`: 0에러 (위 `tsconfig.json` `types` 배열 신설 항목
  참조).** 신규 파일 포함 전체 통과, `@ts-expect-error` 2곳 유효성도 확인됨.

## Phase 2(엔진) 산출 타입 요약 — 여전히 유효, 그대로 참조

전부 `src/engine/*.ts`에서 export. 상세는 각 파일 상단 docblock 참조.

- `src/engine/loveTypeInference.ts` — `inferLoveType`, `resolveMbtiFromQuickQuiz`,
  개별 `compute*` 함수들, `LOVE_TYPE_ENGINE_VERSION`. Phase 3에서 그대로
  소비했다(`src/store/sessionStore.ts`, `src/services/personalityApi.ts`).
- `src/engine/leagueStats.ts` — `computeSixStats`/`computeOvrRawScore`/
  `percentileRank`/`mapPercentileToOvr`. Phase 3에서는 미사용(메인 탭 범위).
  **(2026-09-02)** `computeOvrRawScore`는 **더 이상 자리표시자가 아니다.**
  OVR은 6각 스탯의 산술평균(반올림)으로 확정됐고(MASTER Part 10-8-2)
  현행 구현이 이미 그 형태다 — 포지션 가중치 단계 자체가 삭제됐다.
  `percentileRank`가 쓸 규준집단도 확정(전수 열거 3,888, Part 10-8-1).
  **남은 미확정은 베이지안 수축 강도 하나** →
  `UNRESOLVED('leagueStats.shrinkage')`.
- `src/engine/temperature.ts` — `resolveDisconnectedTemperature`(36.5 고정),
  `clampTemperature`.
  **(2026-09-02)** 계산 규격이 **MASTER Part 10-7**로 확정됐다 —
  `baselineTemperature`(성격 기저) + `activityDelta`(14일 이동창).
  **다만 두 함수는 아직 구현되지 않았다.** 구현 시 제약:
  계수를 **인자로만** 받고, 이 파일에서 DB·네트워크·환경변수에
  접근하지 않는다(계수 조회는 호출부 책임). 엔진 안에서 supabase
  클라이언트를 import하면 함수가 비동기가 되어 순수성이 사라지는데
  기존 결정론 grep에는 걸리지 않는 **조용한 실패**다.
  식별자: `temperature`(최종) / `baselineTemperature`(기저) /
  `activityDelta`(변동) / `typeAffinity`(유형 궁합 — **온도 어근을 쓰지
  않는다**). **앱 클라이언트에서 이 파일의 함수를 호출하지
  않는다**(파일 상단 계약) — Phase 3의 `src/store/coupleStore.ts`는
  `DISCONNECTED_TEMPERATURE` **상수**만 재노출하고 함수는 호출하지 않는
  방식으로 이 계약을 지켰다. Phase 4(메인 탭)도 동일 원칙 유지할 것.
- `src/engine/dnaScore.ts` — `clampDnaScore`/`computeTotalScore`. base_score
  궁합 공식 없음(아래 "미확정" 참조).
  **(2026-09-02)** 여전히 미확정이지만 범위가 좁아졌다 — 궁합 매트릭스는
  MASTER **Part 10-6-5**에 이미 있고 **범주형**(잘 맞음 / 중립 / 온도차)이다.
  없는 것은 **범주 → 점수 변환 규칙** 하나. 마스터 PM 확정 대기.

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

## Phase 5(채팅 실시간) 산출 요약 — Phase 6+가 가져다 쓰는 용도

- **`src/hooks/useRealtimeMessages.ts`**가 채팅 화면의 유일한 데이터 소스다.
  `messages`/`stories` 조회·전송·읽음처리 로직은 전부 `src/services/chatApi.ts`에
  있다 — 다른 Phase가 채팅 데이터를 건드릴 일이 있으면(예: Phase 7 AI 감정
  태깅 배치가 `warmth_score`를 채우는 쪽) 이 파일들의 쿼리 패턴을 참고할 것.
  `warmth_score`/`sentiment`/`analyzed_at`은 Phase 5 어디에서도 읽거나 쓰지
  않는다(의도적 — Phase 7 전용).
- **(2026-08-27 해소)** 오프라인 큐가 AsyncStorage로 영속화됐다
  (`chat_queue:{coupleId}`, `src/utils/chatQueue.ts`
  `chatQueueStorageKey`/`parseQueuedMessages`) — 앱 강제 종료 후
  재실행해도 미전송 메시지가 pending으로 복원되고 재시도가 재개된다.
  재시도 정책(최대 5회, 지수 백오프 2s→4s→8s→16s→32s, 에러 유형별
  즉시 실패 분기)과 사용자 조작("다시 시도"/취소)도 함께 구현됨 —
  스케줄링은 `src/utils/chatRetryQueue.ts`(`ChatRetryQueue`, React
  비의존이라 fake timer로 테스트됨), 상세 판단 근거는
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조.
- **`client_msg_id` 멱등 재전송 패턴**: insert 시도 → 유니크 제약 위반(23505)이면
  기존 행을 재조회해 성공으로 간주(`src/services/chatApi.ts` `sendMessage`).
  다른 테이블에도 같은 멱등 재전송이 필요해지면(예: 피드 업로드) 이 패턴을
  재사용할 수 있다.

## Phase 6 1~2단계(생체정보 동의 + 대표사진 등록) 산출 요약 — Phase 6 3단계(메인 세션)가 가져다 쓰는 용도

- **동의 상태의 단일 진실 소스는 `profiles.biometric_consent_at`/
  `biometric_consent_revoked_at`이다.** "현재 동의가 유효한가"는 어디서도
  직접 두 컬럼을 비교하지 말고 `src/utils/biometricConsent.ts`의
  `isBiometricConsentActive(consentAt, revokedAt)`를 불러 써라 — 재동의 시
  `revoked_at`을 `null`로 되돌리는 규칙(문서에 없는 자체 판단,
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조)이 이 함수 안에만
  있고 다른 곳에 중복돼 있지 않다.
- **`src/store/profileStore.ts`/`src/store/coupleStore.ts`가 대표사진
  경로(`referencePhotoPath`)까지 함께 들고 있다.**
  `setPersonalReferencePhoto(userId, localUri)`(profileStore)/
  `setReferencePhoto(localUri)`(coupleStore, 연결 상태에서만)가 업로드
  + DB 반영 + 로컬 상태 갱신을 한 번에 한다. 실제 업로드는
  `src/services/referencePhotoApi.ts`(`uploadReferencePhoto`,
  `getReferencePhotoSignedUrl`)에 있다 — Storage 경로 규칙은 아래
  참조.
- **⚠️ `019_avatars_storage_policies.sql`을 원격에 적용해야 대표사진
  업로드가 동작한다.** 개인 `{user_id}/reference`, 커플
  `{couple_id}/reference` 규칙으로 경로를 확정했다(015가 미확정으로
  남겨뒀던 부분). 적용 전까지는 `app/(modals)/reference-photo.tsx`의
  저장이 전부 RLS 거부(42501)로 실패한다 — `.claude/state/PROGRESS.md`
  "막힌 것" 참조.
- **화면 C(대표사진 등록)는 이미 완성돼 재사용 가능하다.**
  `src/components/ReferencePhotoSlot.tsx`(프레젠테이션, 개인/커플 공용) +
  `app/(modals)/reference-photo.tsx`(라우팅/스토어 연결). "사진 선택"만
  플레이스홀더다(`src/constants/referencePhotoPlaceholders.ts`) — 실제
  갤러리 연동 시 이 상수 파일의 소스를 `expo-image-picker` 결과로
  바꾸고, `ReferencePhotoSlot`에 넘기는 `onSave` 콜백 인자(로컬 URI)
  타입만 유지하면 나머지(미리보기·업로드·DB 반영)는 그대로 동작한다.
- **`profiles.photo_sync_enabled`/`photo_scan_completed_at`/
  `photo_scan_cursor`는 여전히 전혀 건드리지 않았다.** 피드 탭 안내
  카드(`app/(tabs)/feed.tsx`의 `PhotoSyncPromptCard`)는 생체정보 동의
  상태만으로 두 상태(미동의/동의완료)를 보여준다 — 화면 B(권한)·SDK
  연동 후에는 이 카드를 "동의 완료 → 권한 미허용 → 대표사진 등록
  완료 → 스캔 중"처럼 더 세분화해야 할 것이다.
- **⚠️ 철회 시 로컬 얼굴 데이터 삭제가 구현되지 않았다.** MASTER.md
  "철회 시 반드시 함께 일어나야 하는 일" 3번 — SDK 연동 시
  `revokeBiometricConsent`(`src/store/profileStore.ts`) 안에 온디바이스
  삭제 호출을 반드시 추가할 것. 자동 테스트로 강제할 수 없는 항목이라
  QA 체크리스트에 수동으로 남아 있다(`.claude/state/PROGRESS.md`
  "막힌 것" 참조).
- **(2026-09-02) `src/engine/faceMatch.ts`의 `threshold` 인자는 다섯 번째
  자리표시자였다** — 어느 문서에도 값이 없었고 자리표시자 목록에도 없었다.
  코드는 규칙을 정확히 지켰지만(인자로 받고 하드코딩하지 않음) 그래서
  아무도 추적하지 않았다. **판정 정책은 확정됐다** — MASTER Part 9-4:
  **오탐 회피 우선**, 판정이 애매한 구간은 매칭하지 않는다. 이중 임계값은
  범위 밖(분포 관측 후 Phase 10과 재검토).
  **값은 실기기 캘리브레이션 대기** → `UNRESOLVED('faceMatch.threshold')`.
  SDK 반환값이 유사도인지 거리인지, 정규화 범위가 무엇인지, 실제 커플
  사진에서 어느 대역에 분포하는지가 재빌드 후에만 관측된다. 측정은
  **온디바이스에서 하고 사람이 화면에서 읽어 손으로 기록한다** — 유사도
  로그나 특징 벡터를 서버로 보내면 절대 규칙 1 위반이다. 실기기
  작업이므로 위임 대상이 아니다.
- **법률 문구는 여전히 자리표시자다** — `src/constants/legalDocuments.ts`
  의 `biometric` 항목. 실제 법무 검토 텍스트로 교체 필요(다른 3개
  문서와 동일한 미해결 상태, "여전히 필요한 처리" 5번 항목에 함께
  추적).

## 여전히 필요한 처리 (사람 작업)

### 2026-09-02 추가

- **`docs/` 5종 교체** — MASTER·DESIGN·ROADMAP·SCHEMA·CORNER_CONTENT.
- **`ui-builder_phase6_guard.md` 내용을 `.claude/agents/ui-builder.md`
  끝에 이어 붙이기** — 새 파일이 아니다. Phase 6(생체정보 동의) +
  Phase 10(매거진 제작 탭) 주의사항.
- **마스터 PM 문서 / 프롬프트 엔지니어 인수인계서를 `docs/`에 넣을지 결정**
  — 현재 저장소 밖이라 버전 관리가 안 된다. 마스터 PM 문서는 "새 세션에서
  문서 하나로 복구"가 존재 이유라 특히 그렇다.
- **`018_realtime_publication.sql` 원격 적용 여부 확인** — 로컬 파일 존재와
  원격 적용은 별개다. 아래 1번과 같은 사안이며, 0831 대조 문서가 "다음
  확인 3가지"로 올렸으나 그 문서는 스냅샷이라 갱신되지 않는다.

### 기존

1. **`supabase_realtime` publication에 `messages`(및 필요 시 `stories`)가
   빠져 있다** — 원격 프로젝트에 직접 쿼리(`select * from
   pg_publication_tables where pubname = 'supabase_realtime'`)해 확인함,
   결과 0행. `alter publication supabase_realtime add table
   public.messages;`를 마이그레이션으로 적용해야 상대방 기기가 채팅을
   실시간으로 수신한다(현재는 화면 재진입 시에만 최신화됨). db-architect
   영역 — Phase 5는 읽기 전용 확인만 하고 적용하지 않았다(작업 지시 준수).
2. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
3. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
4. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
5. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
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
   교체 필요. **(2026-08-27 추가)** 같은 파일의 `biometric`(생체정보
   동의) 항목도 동일하게 자리표시자 — 아래 "Phase 6 1단계" 절 참조.
6. **(2026-08-27 구현 완료, 원격 미적용) avatars Storage 버킷 정책** —
   경로 규칙을 개인 `{user_id}/reference` / 커플 `{couple_id}/reference`로
   확정하고 `supabase/migrations/019_avatars_storage_policies.sql`
   작성 완료(`app/(modals)/reference-photo.tsx` 대표사진 등록 화면이
   이 정책에 의존한다). **`npx supabase db push`로 원격 적용 필요** —
   적용 전까지는 대표사진 업로드가 전부 RLS 거부(42501)로 실패한다.
   적용 후 `supabase gen types typescript --linked`로
   `src/types/database.ts` 재생성은 불필요(테이블 컬럼이 아니라
   Storage 정책만 추가했다).
7. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
8. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
9. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
10. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
11. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
12. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.

## Phase 2(엔진) 산출물 요약 (참고용)

- `src/constants/*.ts`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`
- `__tests__/engine/*.test.ts` — 94개 전부 통과
- love_type_labels 36종 네이밍·카피 확보(`src/constants/loveTypeLabels.ts`).
  `description_ko`만 Part 16 열린 과제로 미확정(null) — 화면 7은 null이면
  해당 섹션을 조건부로 숨기는 방식으로 대응 완료.
