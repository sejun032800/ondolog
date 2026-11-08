# 위임 프롬프트 — `51b-` 단계 A: 네이티브 묶음 (재빌드 1회분)

> 대상: `ui-builder` (시험은 같은 세션에서)
> 보관 경로: `.claude/state/prompts/phase-7/51b-ui-builder-native-bundle.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-08 (PM 지시 `51b-` §2, ROADMAP r65)
> 기준선: jest `Test Suites: 100 passed` · `Tests: 1765 passed` · tsc 0 / 0 · Python 277 · 커밋 `4e23fcf` 이후
> **마이그레이션 0 · 원격 쓰기 0.** 의존성 · 설정 변경은 **아래 표에 적은 것만**(PM 1회 허가). 바뀌어도 되는 파일: `package.json` · `package-lock.json` · `app.json` · 폴리필 파일 1개 · 그 폴리필을 불러오는 한 줄 · 시험. **그 밖의 파일이 바뀌면 멈추고 보고한다.**

---

## 목표 (PM)

재빌드가 필요한 변경만 한 번에 묶는다. 이 단계가 끝나면 Proteur가 커밋하고 **딱 한 번** 빌드한다. JS 결함 수정(단계 B)은 여기서 하지 않는다.

**원본 (직접 읽는다)**
- `docs/ONDOLOG_ROADMAP.md` **R32-3 · R63-2 · R63-5 · R63-9 · R64-2 · R64-3**
- `.claude/state/prompts/phase-7/PM_directive_51b-device-fixes.md` §2
- `src/services/supabase.ts`(Supabase 클라이언트 생성 위치) · `app.json` · `package.json`
- Nocturne 바탕 토큰(앱 테마 상수 — 위치를 찾아 보고)

## 1. 할 일

| # | 할 일 | 조건 |
|---|---|---|
| A1 | **`expo-crypto` 추가 + PKCE s256**(R63-5) | · 설치는 `npx expo install expo-crypto` **한 번**. `dependencies`(devDependencies 아님)에 들어갔는지 확인<br>· **최소 폴리필 파일 하나**: `globalThis.crypto.subtle.digest`가 **없을 때만** `expo-crypto`로 SHA-256을 채운다. `getRandomValues`도 없을 때만 채운다. 이미 있으면 아무것도 바꾸지 않는다<br>· 폴리필은 **Supabase 클라이언트가 만들어지기 전에** 한 번 불러온다(불러오는 위치 한 줄 보고)<br>· 다른 암호 기능 · 다른 전역 객체는 건드리지 않는다 |
| A2 | **`expo-dev-client` · `expo-image-picker` 패치** | `npx expo install expo-dev-client expo-image-picker` 한 번. 결과 버전이 `--check`가 말한 `~57.0.21`인지 보고. **다른 패키지 버전이 함께 바뀌면 멈추고 보고** |
| A3 | **스플래시 바탕 · Android 시스템 내비게이션 바**(R64-2 — P1 · P2) | · 스플래시 바탕을 **Nocturne 바탕 토큰과 같은 색**으로<br>· Android 아래 내비게이션 바가 흰 띠로 보이지 않게: 어둡게 하거나, edge-to-edge 투명 + 앱 바탕이 보이게<br>· **`app.json`에서만** 한다. 지금 SDK에서 어떤 키가 동작하는지 Expo 문서나 설치된 패키지 소스로 근거를 댄다(추측 금지)<br>· **설정만으로 안 되고 새 패키지가 필요하면**(예: 내비게이션 바 · 시스템 UI 전용 패키지) **설치하지 말고 멈춰서 보고**한다. 허가 밖이다 |
| A4 | **카메라 권한**(R63-9) | · 먼저 **확인**: 지금 설정으로 Android 매니페스트에 `android.permission.CAMERA`(그리고 `RECORD_AUDIO`)가 들어가는지. 저장소에 `android/` 폴더를 만들지 않는 방법으로 본다(예: `npx expo config --type introspect` 출력). 확인 방법과 결과를 보고<br>· 들어가면 **빼는 설정을 `app.json`에** 넣는다(예: `android.blockedPermissions` 또는 `expo-image-picker` 플러그인 옵션 — 근거를 댄다). 넣은 뒤 같은 방법으로 빠졌는지 다시 확인<br>· 갤러리에서 사진 고르기(앱이 쓰는 기능)는 그대로 동작해야 한다 |

## 2. 시험 (행동으로)

- A1:
  - 폴리필을 불러온 뒤 Supabase 로그인 시작 요청(OAuth URL 만들기)에 **`code_challenge_method=s256`**이 들어간다
  - `digest`가 원래 있으면 폴리필이 **같은 함수를 그대로 둔다**(`toBe`)
  - SHA-256 결과가 알려진 값과 같다(예: 빈 문자열의 해시)
- A3 · A4: 설정 값이라 jest 대상이 아니다. **정적 검사 시험(설정 파일 내용을 읽어 비교하는 시험)은 만들지 않는다**(R32-3). 확인 결과는 §1의 introspect 출력으로 보고한다
- 기존 시험은 모두 그대로 통과해야 한다

## 3. 관문

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --watchAll=false
npm ci --include=dev
npx expo install --check
```

- jest는 **1765 + 새 시험**(수 보고, 요약 줄 그대로)이고 실패 0이어야 한다
- **`npm ci --include=dev`가 ERESOLVE 없이 끝나야 한다**(R63-2). 실패하면 그 출력을 그대로 보고하고 멈춘다
- `--check`는 "Dependencies are up to date" 계열이어야 한다. 남는 것이 있으면 보고한다(고치지 않음)
- Python 277은 메인 세션이 돌린다

## 4. 지켜야 할 것

- **CLAUDE.md 절대 규칙 8개 그대로.** 커밋 · 푸시 · 빌드는 사람이 한다
- 개발용 패키지를 바꿀 일이 생기면 `npm install --save-dev --save-exact`로만 한다(R63-1). 다만 이번 허가 범위에는 개발용 패키지 변경이 없다
- `npm audit fix`는 실행하지 않는다
- 키 · 토큰 · URL · 프로젝트 ref를 로그 · 보고에 내지 않는다

## 5. 산출

1. A1:
   - 설치된 `expo-crypto` 버전과 위치(`dependencies`)
   - 폴리필 파일 경로와 불러오는 한 줄의 위치
   - 시험 이름
2. A2: 바뀐 버전 두 줄. 다른 패키지 변동이 없는지 확인한 결과
3. A3:
   - 고른 `app.json` 키와 그 근거
   - 쓴 색 값과 그 토큰의 이름 · 위치
   - edge-to-edge 여부
4. A4:
   - 바꾸기 전 introspect 결과(권한 목록 중 해당 줄)
   - 넣은 설정
   - 바꾼 뒤 결과
5. 관문 출력:
   - jest 요약 줄(그대로)
   - `npm ci` 마지막 줄
   - `--check` 전문
6. `git diff --stat`
7. 내부 결정

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄
