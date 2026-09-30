# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료 항목은 `.claude/state/archive/`로 옮긴다** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지 않았다.
> 프롬프트 #13도 상태 파일 기록 삭제·이동·재편을 금지해 유지한다.
> `#13-r4`(브랜드 생성자 이전)도 같은 이유로 `#13` 절을 그대로 두고
> 위에 새 절만 추가한다.)

## 열린 항목

> 완료 항목은 `.claude/state/archive/`로 옮긴다. 이 파일에는 열린 것만 둔다.
> 이 표는 원본을 가리키기만 한다. 본문을 옮겨 적지 않는다.

| 항목 | 상태 | 원본 |
|---|---|---|
| `#15` `stripComments` 통합 | 미실행 | `.claude/state/prompts/phase-7/22-engine-dev-strip-comments.md` |
| `#14` 코너 3종 + 규칙 F | 미실행 | `docs/ONDOLOG_MASTER.md` 17-0 · 규칙 F는 §17-0-3 |
| 모듈 경로 계약 | 유효 | `__tests__/engine/cornerPipelineStaticRules.test.ts`의 `LLM_CALL_MODULE` · `APP_CONFIG_LOOKUP_MODULE` · `APPROVED_BRAND_CONSTRUCTOR_MODULES` |
| 발행 시 테마 복사 트리거 | 미적용 (Phase 7 발행 묶음) | `docs/ONDOLOG_SCHEMA.md` §9-C-7 |
| 테마 잠금 DB 강제 | 미적용 (Phase 9, 그 전 공개 배포 금지) | `docs/ONDOLOG_SCHEMA.md` §9-C-8 |
| 루트 `include`가 `docs/`의 `.ts`까지 먹음 | 알려진 제약 | `tsconfig.json`의 `include` |

## node_modules 백업 (2026-09-12, main session)

node_modules 백업: ..\ondolog-node_modules-20260910.zip (219548890 bytes, 2026-09-10)
현재 node_modules는 lock으로 재현 불가 — npm install --legacy-peer-deps로
설치 후 lock만 되돌려진 상태. npm ci는 lock 내부 불일치로 거부됨.
이 백업은 폰 복귀 후 lock 재생성 시 폐기한다. 해결이 아니라 다리다.

## package.json ↔ package-lock.json 정합 — 목표 달성 불가로 중단 (2026-09-12, main session)

Phase 7 위임(`.claude/state/prompts/phase-7/15-main-session-package-align.md`).
**중단 — 목표 자체가 달성 불가능함을 확인.** `package.json`은
`git checkout -- package.json`으로 되돌렸다(`git status --porcelain` 클린
확인 완료). `CLAUDE.md`는 손대지 않았다. 커밋 없음.

1. **`package-lock.json`이 내부적으로 낡았다.** `expo@57.0.17`이 요구하는
   전이 의존 7건의 버전 요구가 lock에 고정된 버전보다 높다. `npm ci`는
   어떤 플래그로도 통과하지 않는다(`--legacy-peer-deps`는 peer 충돌만
   무시할 뿐, 이건 peer 충돌이 아니라 lock 자체 무결성 오류라 무시
   대상이 아니다):
   `expo-updates-interface`(57.0.1→57.0.2 요구), `expo-json-utils`
   (57.0.1→57.0.2), `@expo/metro-runtime`(57.0.14→57.0.15), `@expo/ui`
   (57.0.12→57.0.18), `expo-glass-effect`(57.0.1→57.0.3), `expo-symbols`
   (57.0.2→57.0.3), `@expo-google-fonts/material-symbols`
   (0.4.44→0.4.47).

   별도로, **`package.json` 대 lock 루트 선언 자체의 불일치도 5건** 확인됨
   (`node -e`로 `package.json` vs `package-lock.json`
   `packages[""].dependencies`를 직접 비교, 2026-09-12 확인):

   | 필드 | package.json | lock 루트 선언 |
   |---|---|---|
   | react-native | 0.86.3 | 0.86.2 |
   | expo-router | ~57.0.17 | ~57.0.15 |
   | expo-dev-client | ~57.0.16 | ~57.0.14 |
   | expo-linking | ~57.0.8 | ~57.0.7 |
   | expo-auth-session | ~57.0.10 | ~57.0.9 |

   이 5건은 이번 세션 산출물이 아니다 — `git diff c4e0231 11ce24b --
   package.json`으로 확인한 결과 **commit `11ce24b`("0831 시작 커밋",
   2026-08-31)에서 `package.json`의 이 5개 필드만 올라가고
   `package-lock.json`의 루트 선언은 그대로 남았다.** 그 뒤 `0904`·`0906`·
   `0909`×2·`0912` 커밋 전부 `package.json`/`package-lock.json`을
   건드리지 않아 그대로 이어졌다. `npm ci`를 한 번도 정상 실행하지 않아
   지금까지 발견되지 않았던 것으로 보인다.

2. **`CLAUDE.md` 45행은 여전히 잘못된 명령이다.** `npm install
   --legacy-peer-deps`는 lock을 덮어쓴다(절대 규칙 8 위반 소지). 대체안으로
   시도한 `npm ci`는 위 1번 때문에 작동하지 않는다. 45행은 손대지 않았다 —
   현재 맞는 명령이 없다.

3. **현재 동작 중인 `node_modules`를 만든 절차 — PSReadLine 히스토리로
   재구성(추측 아님, 하지만 불완전)**. 이번 세션(main session, 2026-09-12)
   대화 이전에 있었던 별도 라운드의 명령이라 이 세션은 직접 실행을
   지켜보지 못했다. 출처: `%APPDATA%\Microsoft\Windows\PowerShell\
   PSReadLine\ConsoleHost_history.txt`(줄 396~452 부근). **이 파일은
   타임스탬프를 남기지 않아 정확한 실행 시각은 전부 불명 — 순서(줄 번호
   순)만 확인 가능.**

   - `npm install --legacy-peer-deps` 실행 (416번째 줄 부근) —
     **이 시점에 `package-lock.json`이 다시 쓰였다.** `node_modules`도
     이때 갱신됨(→ 지금 설치돼 있는 `node_modules`의 실제 출처).
   - `Test-Path package-lock.json` / `Select-String package.json` /
     `git log --oneline -3 -- package.json package-lock.json` 등 확인성
     명령 다수.
   - **`git checkout -- package-lock.json`** — **이 시점에 방금 다시
     써진 lock을 커밋 상태로 되돌림.** `node_modules`는 그대로 두었다 —
     즉 이 순간부터 `node_modules`는 디스크상 lock이 선언하는 트리와
     달라졌다(lock으로 재현 불가능한 상태가 됨).
   - `npx jest --ci --watchAll=false` 실행 → 통과(348/26 기준선이 이
     시점 산출물로 추정 — 이 세션이 직접 목격하지 않아 "추정").
   - `Test-Path node_modules/@react-native/jest-preset` 확인.
   - `npx tsc --noEmit -p .` 실행 → 통과 추정(출력 미보존).
   - `package.json` vs lock 루트 선언 비교 PowerShell 스크립트(foreach
     dependencies/devDependencies) 실행 → 위 5건 발견한 것으로 추정.
     **이 스크립트의 실제 출력은 어디에도 저장되지 않아 그 결과 자체는
     불명** — 이번 세션이 2026-09-12에 동일 비교를 `node -e`로 독립
     재실행해 같은 5건을 확인했다(위 표).
   - `npm ci` 재실행 → 실패한 것으로 추정(오늘 이 세션이 동일 실패를
     재현함).

   **결론: 지금 `node_modules`는 그 `npm install --legacy-peer-deps`
   1회 실행의 산출물이고, 그 뒤 되돌려진 lock으로는 `npm ci`로 재현할
   방법이 없다. `node_modules`가 지금 지워지면(디스크 정리, 재클론 등)
   복구 경로가 없다.** 이 세션은 `npm ci`를 2회 실행했으나 둘 다
   의존성 해석 단계에서 실패해 `node_modules`를 건드리지 않았다(설치
   전 단계 실패 확인 — `npx jest`/`npx tsc`가 여전히 348/26·0에러로
   통과하는 것으로 재확인, 2026-09-12).

4. **해소 시점**: 폰 복귀 후 재빌드 때 `expo install --fix` + lock
   재생성 + EAS 빌드 + 실기기 검증을 한 벌로 다룬다(재빌드 대기 5종
   미검증 상태로는 네이티브 스택을 건드릴 수 없음).

## 연애 온도 — 기저·활동 변동분·결합 (Part 10-7) — 완료 (2026-09-03, engine-dev)

Phase 7 선행 #3(`.claude/state/prompts/phase-7/03-engine-dev-temperature.md`).
`src/engine/temperature.ts`(기존 파일, 새로 쓰지 않고 이어서 구현)에
Part 10-7 "연애 온도 계산 규격 (확정)"의 세 부분을 추가했다.

### 변경 전 상태 (Phase 2 자리표시자)

- **완전 구현돼 있던 것**: `resolveDisconnectedTemperature()`(미연결
  36.5 고정), `clampTemperature()`(0~100, 소수 1자리 반올림+클램프),
  상수 4개(`DISCONNECTED_TEMPERATURE`/`TEMPERATURE_MIN`/`TEMPERATURE_MAX`/
  `TEMPERATURE_DECIMALS`).
- **자리표시자였던 것(=존재하지 않았던 것)**: 기저 온도, 활동 변동분,
  결합 공식 전부. 구 docblock이 "핵심 결합 공식이 문서 어디에도 없다"고
  명시하고 있었다(Part 10-7 신설 전 상태). `TEMPERATURE_ENGINE_VERSION`은
  `"1.0.0"`이었고 이 범위(미연결값·클램프)만 반영한 버전이었다.

### 이번에 추가한 것 — Part 10-7 세 부분

| 부분 | 함수 | 상태 |
|---|---|---|
| ① 기저 온도 | `computeBaselineTemperature(coreA, coreB, coefficients)` | 완전 구현, 순수 함수, **throw 없음**. 프로파일 미비 시 `undefined` 반환(에러 아님) |
| ① 보조 | `resolveTypeAffinity(coreA, coreB)` / `TypeAffinityCategory` | 완전 구현. 비대칭(잘맞음) 시 높은 쪽 채택 |
| ② 활동 변동분 식 | `computeActivityDeltaFromScores(dailyScores, coefficients)` | 완전 구현 + 완전 테스트 (UNRESOLVED 없음 — 이미 숫자인 점수를 가정) |
| ② 원시 입력 진입점 | `computeActivityDelta(dailyActivities, coefficients)` / `computeDailyActivityScore(raw)` | 식은 구현, "하루치 활동 점수" 정의는 `UNRESOLVED('temperature.activityScore')` 소비. 실활동(`DailyActivityRaw`)이 하나라도 있으면 throw. `null`(데이터 없음)만 있으면 0 반환, throw 없음 |
| ③ 결합 | `computeDailyTemperature(coreA, coreB, dailyActivities, coefficients)` | 구현됨. 실활동 데이터가 있는 현실적 호출은 `UnresolvedConstantError`로 실패 — **의도된 정상 상태** |

### 재사용한 궁합 판정 로직 (재작성 없음)

| 항목 | 경로 | 시그니처/형태 |
|---|---|---|
| `COMPATIBILITY` | `src/constants/compatibility.ts` | `Readonly<Record<EnneagramCore, { best: readonly {core,reason}[]; contrast: readonly {core,reason,tip}[] }>>` — Part 10-6-5 매트릭스, 기존 파일 그대로 import만 함 |
| `EnneagramCore` | `src/constants/enneagram.ts` | `1\|2\|...\|9` 타입만 import (값 룩업인 `HORNEVIAN_HARMONIC_TABLE`은 건드리지 않음) |

`resolveTypeAffinity`는 이 `COMPATIBILITY`를 양방향(coreA→coreB 관점,
coreB→coreA 관점)으로 조회해 `best`/`contrast`/`neutral` 중 하나를 정하고,
어긋나면(비대칭 잘맞음) 높은 쪽을 채택한다(Part 10-7-2 "양방향 판정이
어긋나면 높은 쪽을 커플 기저로 삼는다"). 매트릭스 값 자체는 한 글자도
다시 옮겨 적지 않았다.

### 최종 온도 함수가 throw하는 이유 / 해소 시 무엇을 바꿔야 하는가

`computeDailyTemperature`는 내부에서 `computeActivityDelta`를 호출하고,
그 함수는 `null`이 아닌 각 날짜에 `computeDailyActivityScore(raw)`를
호출한다. 이 함수 본문이 `UNRESOLVED({ key: 'temperature.activityScore' })`
하나뿐이라 즉시 `UnresolvedConstantError`를 던진다 — "채팅·피드 건수를
몇 점으로 환산하는가"가 실사용 데이터 없이 정할 수 없는 값이기 때문이다
(Part 10-7-3, Part 16-2). 활동 데이터가 전혀 없는 날(`null`)만 있는
극단 케이스(신규 연결 직후)는 throw하지 않고 기저 온도를 그대로 반환한다
— 이는 "없는 날은 0으로 계산" 규칙이 자명하게 적용되는 경우라 점수
환산식이 필요 없기 때문이다.

**해소되면** (`temperature.activityScore` 캘리브레이션 완료 시)
`computeDailyActivityScore` 함수 **본문만** 실제 환산식으로 교체한다.
`computeActivityDelta`/`computeActivityDeltaFromScores`/
`computeDailyTemperature`는 이미 최종 식대로 구현돼 있으므로 손댈 필요가
없다 — 이 분리가 이번 설계의 핵심이다(집계 식과 "점수를 어떻게
만드는가"를 처음부터 별도 함수로 나눠, 해소 시 변경 범위를 함수 하나로
좁혔다).

### `TEMPERATURE_ENGINE_VERSION`: `1.0.0` → `1.1.0`

daily_temperature 테이블에는 `engine_version` 컬럼이 없어 DB에 직접
쓰이진 않지만(파일 docblock이 이미 명시), 감사 추적용 모듈 버전이라
Part 10-7의 세 부분(①②③)이 새로 추가된 만큼 마이너 버전을 올렸다.

### 계수는 전부 인자 — 하드코딩 없음

`BaselineTemperatureCoefficients`(`contrast`/`neutral`/`best`,
문서 기본값 36.5/39/42), `ActivityDeltaCoefficients`(`windowDays`/
`widthCap`/`min`, 문서 기본값 14/55/0), `DailyTemperatureCoefficients`
(위 둘을 묶음) 전부 인자로만 받는다. `src/engine/temperature.ts` 안에
이 수치들을 상수로 박아두지 않았다 — 유일한 예외는 기저 하한
`DISCONNECTED_TEMPERATURE`(36.5)인데, 이는 "계수"가 아니라 Part 9-2에서
이미 확정된 별개의 구조적 상수(미연결 기본 체온)를 재사용한 것이고
Part 10-7-2가 명시적으로 이 값을 하한으로 지정했다. `daily_temperature.factors`
기록 코드는 작성하지 않았다(호출부 책임, Part 10-7-5).

### 판단이 필요했던 지점 (질문 목록)

- **활동 변동분의 "없는 날"(null) 처리 경계.** Part 10-7-3은 "창이 차기
  전에도 분모는 14, 없는 날은 0으로 계산"이라고만 한다. 나는 이를
  "커플이 아직 존재하지 않았던 날짜(데이터 자체가 없음)"로 해석해
  `null`로 표현하고 0으로 계산했으며, "커플은 존재했지만 그날 채팅/피드가
  0건"인 경우는 `DailyActivityRaw{chatMessageCount:0, feedPostCount:0}`로
  표현해 여전히 `computeDailyActivityScore`(UNRESOLVED)를 거치도록
  했다 — 0건이 0점으로 환산된다는 것도 아직 확정된 공식이 없으므로
  지어내지 않기 위함이다. 이 경계 해석이 맞는지 재확인 필요.
- ②의 식(`computeActivityDeltaFromScores`)과 "점수를 어떻게 만드는가"
  (`computeDailyActivityScore`)를 별도 함수로 분리한 것은 위임 프롬프트에
  명시된 요구는 아니고, "식은 구현·테스트되지만 점수 정의는 미확정"을
  더 명확히 분리해 표현하려는 내 설계 판단이다. 문제가 있다면 지적 바람.

### "없는 날"(null) 처리 경계 — 코디네이터 판정 (2026-09-03)

위 첫 번째 판단 지점에 대한 답: **에이전트의 구현(건수 층위 해석)이 옳다.**
단 근거를 다시 잡는다 — 문제는 "0건을 0점으로 볼 것인가"가 아니라 Part
10-7-3의 "없는 날은 0으로 계산한다"가 **건수 층위**(없는 날의 채팅·피드
건수를 0으로 둔다 → 그 0건도 점수로 환산해야 하므로 `UNRESOLVED` 경유,
throw)인지 **점수 층위**(없는 날의 활동 점수 자체를 0으로 둔다 → 환산을
건너뛰므로 throw 없음)인지의 문제다. 지금 구현은 건수 층위로 읽었고,
그게 더 보수적이라 맞다.

**오늘은 관측 차이가 없다** — `computeDailyTemperature`는 실활동이
하나라도 있으면 어차피 throw하므로 이 경계의 두 해석이 지금 당장
갈리는 지점이 없다. 차이는 `temperature.activityScore`가 **확정된 뒤**
드러난다.

**처방 — `temperature.activityScore` 정의를 작성/확정할 때 반드시
"채팅 0건·피드 0건인 날"을 명시적으로 다룰 것.** 다루지 않으면 이
질문이 그때 다시 올라온다. 그리고 확정 시점에 현재
`__tests__/engine/temperatureBaseline.test.ts`의
`{ chatMessageCount: 5, feedPostCount: 0 }` → `UnresolvedConstantError`를
기대하는 테스트가 깨질 것이다 — **그건 버그가 아니라 정상 신호다**
(`__tests__/engine/normDrift.test.ts`의 드리프트 감지 테스트와 같은
성격: "값이 채워졌으니 이 경로가 더 이상 throw하지 않는다"는 것을
테스트가 스스로 알려주는 것). 그 시점에 이 테스트를 고치는 것은 "기존
테스트 수정 금지" 규칙의 예외다 — `activityScore` 자체를 해소하는
작업의 일부이지, 미확정 상태를 우회하려는 수정이 아니기 때문이다.

### 궁합 매트릭스 재현성 — 마스터 PM 확인 필요 (2026-09-03, 코디네이터 에스컬레이션)

`COMPATIBILITY`(`src/constants/compatibility.ts`)를 엔진이 직접 정적
import한다 — 이번 위임 프롬프트가 명시적으로 허용한 형태이고 위반은
아니다. 다만 규준 데이터(`normPercentile.ts`)에서 인자 주입으로 막았던
문제(Part 10-8-3)가 여기 절반만 막혀 있다: 기저값 세 개(36.5/39/42)는
`coefficients` 인자로 주입되지만, **어느 유형쌍이 어느 값을 받는지
정하는 매트릭스 자체는 코드에 정적으로 고정**돼 있다. 매트릭스가
바뀌면(콘텐츠팀 교정 등) 과거에 발행된 매거진의 온도를 재현할 수
없고, `daily_temperature.factors`에 계수 버전을 기록해도 매트릭스
버전은 남지 않는다. **PM 판단 대기** — 이번 작업(#3)을 되돌릴 사안은
아니다(문서가 요구하지 않았고 매트릭스가 규준집단처럼 자주 바뀌는
것도 아니다). 필요하면 Part 10-6-5 또는 10-7-5에 매트릭스 버전 필드를
추가하는 별도 작업으로 처리.

### 파일

- 변경: `src/engine/temperature.ts` (기존 파일 이어서 구현, 기존 export
  4개는 시그니처·동작 그대로 유지)
- 신규: `__tests__/engine/temperatureBaseline.test.ts` (기존
  `__tests__/engine/temperature.test.ts`는 **수정하지 않음** — 그 파일의
  기존 4개 테스트 그대로 통과)

`npx jest`: 기존 289개 + 신규 29개 = **318개 전부 통과**.
`npx tsc --noEmit -p .`: **0에러**. `grep -rn "UNRESOLVED" src/engine/`는
`unresolved.ts`(선언, 불변) 외에 `temperature.ts` 3곳에서 신규 소비
(`computeDailyActivityScore` 정의 1곳 + 그 문서화 참조들은 카운트 아님,
실제 호출 지점은 `computeDailyActivityScore` 함수 본문 1곳).

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

## 레지스트리 정리(resolutionCondition 제거) + temperature.ts 재-export 제거 (2026-09-12, engine-dev)

`.claude/state/prompts/phase-7/18-engine-dev-registry-cleanup.md` 수행 완료.
착수 전 조사(문서 주장)를 그대로 신뢰하지 않고 직접 grep으로 재확인 후
진행했다.

**착수 전 조사 결과(직접 재확인)**
- `resolutionCondition`: `src/`·`__tests__/`·`scripts/` 전체 재귀 grep 결과
  `src/engine/constants/unresolved.ts` 내부(42/56/62/68/74/98행)뿐. 외부
  소비 없음 — 문서 주장과 일치.
- 재-export 소비처: `temperature.ts`의 `resolveTypeAffinity`/
  `TypeAffinityCategory`를 가져가는 곳은 `__tests__/engine/temperatureBaseline.test.ts`
  하나뿐. `src/engine/dnaScore.ts`는 이미 `./typeAffinity` 직접 import.
  `src/store/coupleStore.ts:30`은 `DISCONNECTED_TEMPERATURE`만 import해
  무관 — 문서 주장과 일치.

**1부 — `resolutionCondition` 제거.** `UnresolvedConstantMeta` 인터페이스
필드, 등록 4키 값, 에러 메시지 속 해당 문장만 제거. `UNRESOLVED` 함수
시그니처·본문, 에러 클래스 2종, 키 유니온 파생 구조, 등록 키 4개는 무변경.

에러 메시지 전/후(`UnresolvedConstantError` 생성자, `src/engine/constants/unresolved.ts`):
- 전: `` `UNRESOLVED constant "${key}" — Phase ${meta.phase}에서 소비 예정, ` + `근거 문서 ${meta.doc}. 해소 조건: ${meta.resolutionCondition}. ` + '이 값을 지어내지 말고, 해소 전까지 호출부에서 이 계수를 실사용하지 말 것.' ``
- 후: `` `UNRESOLVED constant "${key}" — Phase ${meta.phase}에서 소비 예정, ` + `근거 문서 ${meta.doc}. ` + '이 값을 지어내지 말고, 해소 전까지 호출부에서 이 계수를 실사용하지 말 것.' ``

`__tests__/engine/unresolved.test.ts`는 **무수정으로 전부 통과** —
`phase`·`doc`만 assert하던 기존 assertion이 문장 제거 후에도 그대로
통과했고, 같은 파일의 메시지 결정론 테스트(동일 키 100회 → 메시지 동일)도
무수정으로 통과. 이것이 "해소 조건 제거가 정보 손실이 아니다"(r11)의
실증이다.

**2부 — 재-export 제거.** `src/engine/temperature.ts`에서 `resolveTypeAffinity`·
`TypeAffinityCategory` 재-export 두 줄과, 그 재-export를 설명하던 TSDoc
문장(존재하지 않게 될 재-export를 가리키므로 함께 제거하지 않으면 허위
문서가 됨)만 제거. 다른 심볼 import·계산 로직·`TEMPERATURE_ENGINE_VERSION`
(1.1.0 유지)·`computeAttachmentStability` 본문·`src/store/coupleStore.ts`·
`src/engine/typeAffinity.ts`는 전부 무변경(git status 및 diff로 확인).

`temperatureBaseline.test.ts` import 전/후, assertion 무변경 확인:
- 전: `resolveTypeAffinity`가 다른 심볼들과 한 import 블록으로
  `'../../src/engine/temperature'`에서 옴.
- 후: `resolveTypeAffinity`만 별도 줄로 `'../../src/engine/typeAffinity'`에서
  import. 나머지는 기존 그대로 `temperature.ts`에서 import.
  assertion·기댓값 문자열은 한 글자도 건드리지 않았고 전부 통과했다.

**순수 이동의 증거가 갈아끼워졌다**: 지금까지는 "재-export 덕에 기존 경로로
가져가도 통과"가 증거였는데, 그 재-export를 제거한 지금은 "import 경로만
`./typeAffinity`로 바꾸고 assertion은 그대로인 채 전부 통과"가 새 증거다.

**검증**: `npx tsc --noEmit -p .` 0에러 / `npx jest` 26 suites·**415 tests
전부 통과**(감소 없음) / `determinismStaticRules.test.ts`(34번 정적 규칙
A·B) 통과 유지 / `scripts/norm/unresolvedInventory.ts` 실행 결과 **정의 4 /
소비 2**(합계 6) 그대로 / `git status --short` 수정 파일 3개뿐
(`src/engine/constants/unresolved.ts`, `src/engine/temperature.ts`,
`__tests__/engine/temperatureBaseline.test.ts`) / 커밋·푸시 없음.

원격 SQL 실행 도구: Supabase MCP execute_sql. 다문장 스크립트는 한 번의 호출로 실행되며, 중간에 에러가 나면 에러 메시지만 반환된다.
