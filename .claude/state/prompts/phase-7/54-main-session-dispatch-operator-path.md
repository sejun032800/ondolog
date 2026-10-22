# 메인 세션 지시 — M2-b 운영자 경로 + M2-e 실증 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/54-main-session-dispatch-operator-path.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-22
>
> 짝: `54-corner-pipeline-operator-path.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 LLM API 호출은 없습니다.** 원격 **개발** DB에는 씁니다(R13-7). 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-21-r62'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-21-r20'
git ls-files src/theme/nocturne.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '54-corner-pipeline-operator-path'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
deno --version
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r62 / ROADMAP r20 | 각 한 줄 |
| `nocturne.ts` | 한 줄 — `53-`이 커밋됐다(Proteur가 `npx expo install --check` 확인 뒤, R20-9) |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값 자체는 출력하지 않습니다** |
| `deno --version` | 버전 출력 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 1059 · 53**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 샘플 출력 모드와 실제 호출 금지의 범위 (fail-closed를 건드리지 않는 것 포함)
2. service_role 키를 다루는 규칙과 개발 프로젝트 확인
3. 원격 개발 DB에 쓰는 시험 데이터의 조건

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src app docs package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
```

- 셋째 명령은 **빈 출력**이어야 합니다

**키 누출 확인** — 리터럴 검색입니다. 출력이 비어 있어야 하고, 키 값은 화면에 내지 않습니다.

```powershell
Get-ChildItem scripts, supabase, src, app, .claude/state -Recurse -File | Select-String -SimpleMatch -Pattern $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
Get-ChildItem scripts, supabase, src, app, .claude/state -Recurse -File | Select-String -SimpleMatch -Pattern $env:ONDOLOG_LLM_API_KEY
```

`$env:ONDOLOG_LLM_API_KEY`가 비어 있으면 둘째 줄은 건너뛰고 그렇다고 적습니다.

**`src/`·`app/`에서 service_role을 읽지 않는가** — import·리터럴로 한정합니다. 출력이 비어 있어야 합니다.

```powershell
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
Get-ChildItem src, app -Recurse -File | Select-String -Pattern "from ['""][./]*scripts/ops"
```

| 확인 | 기대 |
|---|---|
| 명령 둘 | 생성·발행이 나뉘었는가. 발행이 `fn_publish_issue` 한 번이고, 부르기 전에 복제 완료를 확인하는가 |
| 샘플 모드 | 검증기 변경 없이 통과하는가. 모델 fail-closed·`app_config`가 그대로인가. 실제 호출 경로를 여는 인수가 없는가 |
| 시험 커플 한정 | 시험 표시가 없는 커플을 거부하는가 |
| 개발 프로젝트 확인 | 접속 대상이 개발 프로젝트가 아니면 멈추는가 |
| 경로 함수 | 입력 조립과 P7이 같은 함수 하나를 부르는가. 검증 뒤 content를 고치는 코드가 없는가 |
| R20-1 | `''`가 빠지고 `trivialMessages`로 세는가. 시험이 있는가 |
| R20-2 | `pending` · `usage_over` 경보(`detail`에 숫자와 ID만) · 발행 거부까지 시험이 있는가 |
| 범위 B | 표 네 줄의 실제 출력이 붙었는가. 예외 5종에서 전후 비교가 있는가 |
| 호출 | 실제 LLM 호출 0회. 실행 명령의 네트워크 허용 범위에 공급자 호스트가 없는가 |
| 금지 | 마이그레이션·의존성·설정·`docs/` 변경이 없는가 |
| 게이트 | tsc 0 / 0, jest 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 범위 A — 운영자 경로
1. 명령·실행 로그·결과 파일: {실행 명령(키 제외) / 로그 경로 / 결과 파일 경로}
2. 코너 3종 상태 / 복제 건수 / 제외 건수(사유별) / 추정 토큰: {}
3. R20-1·R20-2 시험: {파일·건수}
4. 시험 데이터 목록: {ID·경로}
5. 앱 채팅 빈 본문 차단: {막음 / 안 막음 — 파일·행}

## 범위 B — M2-e 실증 (출력 그대로)
- 정상 발행: {}
- 예외 5종 (각각 전후 비교): {}
- 동시 발행: {}
- 발행된 호의 theme 변경: {}

## 변경
- git diff --stat: {}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키 누출 확인: {빈 출력 O / X}
- 실제 LLM 호출: {0회 — 근거}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 실제 LLM API 호출, `app_config` 변경, 마이그레이션
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
