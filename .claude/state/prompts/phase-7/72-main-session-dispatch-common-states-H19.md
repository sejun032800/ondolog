# 메인 세션 지시 — `72-` 공통 상태 I01~I06 · H19 · 쌓인 앱 손질

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/72-main-session-dispatch-common-states-H19.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-04
>
> 짝: `72-ui-builder-common-states-H19.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **마이그레이션 · 원격 · 새 의존성 · 설정 파일 변경은 모두 0입니다.**

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-04-r57'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '72-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력(`71c-` 커밋 ② 완료) |
| ROADMAP r57 | 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | 두 줄 이상 |

### 0-1. 남은 프로세스 (R57-8)

시작 전에 세고, 보고에 적습니다. 끝난 뒤에 다시 셉니다(§2).

```powershell
$pw = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -match 'ms-playwright' }).Count
$py = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -match 'render\\\.venv' }).Count
$pg = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'pgliteServer' }).Count
"playwright=$pw python(render venv)=$py pgliteServer=$pg"
```

- 사람이 쓰는 Chrome을 세지 않도록 Playwright가 설치한 Chromium(`ms-playwright` 경로)만 셉니다.
- 0이 아니면, 이전 시험의 잔여물인지(시작 시각 · 명령줄 앞부분) 보고합니다. **끄지는 않습니다.** Proteur에게 맡깁니다.

### 0-2. 기준선

tsc 0 / 0, jest **1727 · 97**, Python **277**. 출력 전체를 `scripts/ops/out/72-*-pre.txt`에 남깁니다.

- **Python 실행 시간을 적습니다.** 400초를 넘으면 상위 10개 시험의 시간을 잽니다(`55-3d` 때 쓴 방법 — HANDOFF 기록). **렌더러 코드는 고치지 않습니다.** 원인만 보고합니다.
- jest가 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8). 흔들린 것이 `chatPhotoQueue`이면 이름만 적습니다(이번 지시서에서 원인을 고침).

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/72-ui-builder-common-states-H19.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요.
1. 디자인 보드(Nocturne v5 + patch7 + patch8)가 문서·기존 구현보다 우선 — 다른 곳은 보고
2. I05는 화면·문구만 모은다 — 확인 동작(삭제 대상·호출·순서)은 그대로, H14 "해제합니다" / H16 "탈퇴합니다"
3. H19 문의: mailto · SUPPORT_EMAIL = TODO_SUPPORT_EMAIL 자리표시자 · 본문에 계정 id·이메일·커플 정보 0 · "최신" 없음 · 오픈소스 숨김
4. chatPhotoQueue: 원인부터, 재실행·시간 늘리기·skip 금지, 파일 20회 + 전체 3회 연속
5. 새 의존성·설정 파일·마이그레이션·원격 0, 정적 검사 시험 0

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- package.json package-lock.json app.json tsconfig.json babel.config.js supabase docs render
git ls-files --others --exclude-standard
Select-String -Path src/**/*.ts, src/**/*.tsx, app/**/*.tsx -Pattern 'service_role|SERVICE_ROLE' | Measure-Object | Select-Object -ExpandProperty Count
Select-String -Path src/**/*.ts, src/**/*.tsx, app/**/*.tsx -Pattern '@[A-Za-z0-9._-]+\.(com|net|kr|io)\b' | Select-Object Path, LineNumber
git diff -- __tests__/db/demoResponsesPreservation.test.ts
```

- 셋째: **빈 출력**(설정 · 마이그레이션 · 문서 · 렌더러 변경 0)
- 다섯째: **`0`**
- 여섯째: 앱 코드에 메일 주소처럼 보이는 줄이 있으면 직접 봅니다. **개인 주소가 있으면 멈춥니다.** `TODO_SUPPORT_EMAIL`만 있어야 합니다
- 일곱째: `import fs` **한 줄 삭제만** 나와야 합니다(R56-5)

| 확인 | 기대 |
|---|---|
| I05 동작 | H14 · H16 · 기록 삭제가 부르는 함수 · 순서가 이전과 같은지 **diff로 직접 대조**합니다(화면 · 문구만 바뀜) |
| H19 메일 | 메일 본문을 만드는 코드를 직접 읽습니다. 계정 id · 이메일 · 커플 id · 이름이 들어갈 길이 없어야 합니다. 시험이 모의 계정 값으로 그것을 확인하는지도 봅니다 |
| `chatPhotoQueue` | 원인 설명이 코드와 맞는지 · `retry` · `skip` · 큰 시간 초과가 새로 생기지 않았는지 diff로 봅니다. **메인 세션이 직접 다시 돌립니다**: 아래 20회 + 전체 3회 |
| 해요체 | 바꾼 목록을 몇 개 골라 화면 코드와 대조합니다. 확인어 두 개는 그대로여야 합니다 |
| PNG | **메인 세션이 Read로 직접 봅니다**: I01~I06 · H19 · H14 · H16 확인. 보드와 다른 곳만 표로 정리합니다. PNG가 없으면 이유를 보고합니다 |
| 게이트 | tsc 0 / 0 · jest 1727 + 새 시험 · 실패 0 · Python 277 — **메인 세션이 직접 다시 돌립니다.** 출력 전체를 `scripts/ops/out/72-*.txt`에 남깁니다. Python 시간도 적습니다 |
| 남은 프로세스 | §0-1을 다시 돌려 **전 = 후**인지 확인합니다 |

```powershell
$r = 1..20 | ForEach-Object { $o = npx jest __tests__/hooks/chatPhotoQueue.test.tsx --watchAll=false 2>&1 | Select-String -Pattern '^Tests:'; "$_ $o" }; $r | Out-File -Encoding utf8 scripts/ops/out/72-chatPhotoQueue-20.txt; ($r | Select-String -Pattern 'failed').Count
```
```powershell
$r = 1..3 | ForEach-Object { $o = npx jest --watchAll=false 2>&1 | Select-String -Pattern '^Tests:'; "$_ $o" }; $r | Out-File -Encoding utf8 scripts/ops/out/72-jest-full-3.txt; $r
```

- 첫째의 마지막 출력: **`0`**(20회 중 실패 0)
- 둘째: 세 줄 모두 `failed` 없음

## 3. 보고

```
## 사전 점검
- 관문: {} / 기준선: {} / 다시 돌림: {}
- 남은 프로세스(전): playwright {} · python {} · pgliteServer {} {잔여물이면 내용}
- Python 시간: {}초 {400초를 넘으면 상위 10개}

## 산출
1. 보드 경로: {}
2. I01: {파일·줄 · 커플 전용 기능 목록}
3. I02: {파일·줄 · 감지 방식}
4. I03 · I04: {}
5. I05: {파일·줄 · H14/H16 확인어 · H16 PDF 안내 · 확인 동작 diff 대조 결과}
6. I06: {모은 곳}
7. H19: {버전 출처 · SUPPORT_EMAIL 위치 · 메일 본문 · 열 수 없을 때}
8. A14 · B01 · A18: {}
9. patch8 해요체: {바꾼 목록}
10. chatPhotoQueue: {원인 · 고친 곳 · 20회 · 전체 3회}
11. import fs: {}
12. 새 시험: {목록 · 수}
13. 내부 결정: {}

## 화면 PNG (메인 세션이 직접 봄)
- 보드와 다른 곳: {표 / 없음}
- PNG 경로: {}

## 51- 확인 목록에 더할 항목
- 비행기 모드에서 I02
- 문의하기 → 메일 앱이 열리고 본문에 계정 정보 없음
- H14 / H16 확인어 각각
- 커플 미연결 상태에서 탭마다 I01
- {ui-builder가 더한 것}
- SUPPORT_EMAIL이 운영 주소로 바뀌었는지(빌드 전)

## 변경
- git diff --stat: {} / 설정·의존성·마이그레이션·원격: {0} / 앱 코드의 메일 주소: {TODO만}

## 게이트 (메인 세션 재실행)
- tsc / tsc(functions) / Python(시간) / jest 마지막 요약 줄
- 남은 프로세스(후): {전 = 후}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. **여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 새 의존성 · 설정 파일 변경 · 마이그레이션 · 원격 접속
- I05의 확인 동작(삭제 대상 · 호출 · 순서) 변경
- 개인 메일 주소를 코드 · 문서 · 시험 · 보고에 넣는 것
- `chatPhotoQueue`를 재실행 · 시간 늘리기 · `skip`으로 덮는 것
- `demoResponsesPreservation.test.ts`에서 `import fs` 말고 다른 줄을 바꾸는 것
- 남은 프로세스를 메인 세션이 끄는 것(보고만)
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
