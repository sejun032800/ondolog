# 메인 세션 지시 — 기존 계정 · 동의 문장 · 사진 영속 큐 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/64-main-session-dispatch-existing-account-photo-queue.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-25
>
> 짝: `64-ui-builder-existing-account-photo-queue.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 마이그레이션 없음. 의존성은 `expo-file-system` 하나만 1회 허가(R38-5). 커밋하지 않습니다. Deno를 쓰면 `--no-lock`.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r70'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-25-r38'
git ls-files scripts/ops/verifyU6Signup.ts
Select-String -Path package.json -Pattern '"expo-file-system"'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '64-ui-builder-existing-account-photo-queue'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r70 / ROADMAP r38 | 각 한 줄 |
| `verifyU6Signup.ts` | 한 줄 — `63-`이 커밋됐다 |
| `expo-file-system` | **빈 출력** — 아직 설치 전이다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1448 · 75**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/64-ui-builder-existing-account-photo-queue.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. npx expo install expo-file-system 한 번만 허가 — package.json·package-lock.json 외 파일이 바뀌거나 app.json 플러그인이 필요하면 멈춤. legacy API 금지
2. 동의 문장은 지시서의 문장 글자 그대로, consent.ts 상수로. 다른 동의·약관 문장은 바꾸지 않음
3. 기존 계정은 덮어쓰지 않음 — profiles가 있으면 저장 경로 호출 0, onboarding_step은 줄이지 않음
4. 마이그레이션 없음, 로그인 전 서버 호출 0·온보딩 답 AsyncStorage 0 유지, 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs app.json eas.json babel.config.js
git diff package.json
Get-ChildItem src, app -Recurse -File | Select-String -Pattern 'expo-file-system/legacy'
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\bonboarding_step\b'
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 다섯째 · 일곱째 명령은 **빈 출력**이어야 합니다
- 넷째: `package.json`에서 `expo-file-system` 한 줄 추가만 보여야 합니다
- 여섯째: 나온 줄이 보고의 ② e 목록과 **모두 맞는지** 대조합니다

| 확인 | 기대 |
|---|---|
| 의존성 | 바뀐 설정 파일이 `package.json` · `package-lock.json`뿐인가. 설치 버전 |
| ① | `consent.tsx:29`의 문장이 사라지고 `consent.ts` 상수를 읽는가. 문장이 지시서와 글자 그대로 같은가(diff로 직접 봅니다). 주석 한 줄. 다른 동의 · 약관 문장 diff 0 |
| ② a | "이미 계정이 있어요" → A11, 표시는 메모리에만 |
| ② b | `profiles` 있음 → 저장 경로 호출 0 시험 |
| ② c | `profiles` 없음 → A03부터, A11 건너뜀. `canEnterLogin`이 로그인 전에만 적용되는가 |
| ② d | `profiles` 덮어쓰기 없음, `23505` = 성공, 일부만 들어간 상태 시험 |
| ② e | `onboarding_step` 쓰는 곳 전부와 처리. 감소 0 시험 |
| ③ | 복사본 → 큐 항목 → 성공 시 둘 다 삭제. 재시작 뒤 이어 보내기. 메시지 · 스토리 각각 중복 없음. 스토리 클라이언트 id 처리 |
| 규칙 11 | 기존 시험이 그대로 통과하는가 |
| 원격 실증 | 재로그인 전후 같음 · 저장 2회 · 사진 큐 메시지 · 스토리 각 1 · 1. **사용자 권한**, 출력에 키 · 토큰 · URL 없음 |
| 정적 검사 시험 | 색 · 서체 · 문자열을 코드에서 찾는 시험이 새로 생기지 않았는가(R32-3) |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. expo-file-system: {설치 버전 / 바뀐 파일 / app.json 요구 여부}
2. ① 동의 문장: {파일·줄}
3. ② a~e: {파일·줄} / e — onboarding_step 쓰는 곳: {전부와 처리}
4. ③ 사진 큐: {저장 위치·키 / 스토리 클라이언트 id / 복사본 사라짐 처리}
5. 원격 실증 (출력 그대로): {재로그인 전후 / 저장 2회 / 사진 큐 메시지·스토리}
6. 51- 확인 목록 (21가지): {}
7. 내부 결정: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키 누출 확인: {빈 출력 O / X}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. 한 줄이 길어지면 줄을 나눕니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- `expo-file-system` 외 의존성, 마이그레이션, 허가 밖 설정 변경(`app.json` 포함)
- 키 값을 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
