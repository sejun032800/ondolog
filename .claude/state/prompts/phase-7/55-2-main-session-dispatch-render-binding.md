# 메인 세션 지시 — M2-c 조판 슬롯 채우기 위임 (`55-2`)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-2-main-session-dispatch-render-binding.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-23 (v1.1 기준 — `55-1`(보충 R26-2 포함) 완료와 `render/issue/` v1.1 반입 뒤 실행, ROADMAP R26-7)
>
> 짝: `55-2-corner-pipeline-render-binding.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 LLM API 호출은 없습니다.** 원격 **개발** DB·스토리지에는 씁니다(R13-7). 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-22-r66'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-23-r26'
git ls-files render/_placeholder | Select-Object -First 1
Test-Path render/issue/README.md
Test-Path render/issue/tools/__pycache__
Select-String -Path .gitignore -SimpleMatch -Pattern '__pycache__'
Test-Path render/issue/issue
Select-String -Path render/issue/README.md -SimpleMatch -Pattern 'v1.1'
git ls-files render/issue | Select-Object -First 3
Get-ChildItem render/issue -Recurse -File -Include *.html,*.css | Select-String -Pattern '<script|(src|href)\s*=\s*["'']?https?://|url\(\s*["'']?https?://|@import\s+["'']https?://' | Select-Object -First 5
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-2-corner-pipeline-render-binding'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r66 / ROADMAP r26 | 각 한 줄 |
| `render/_placeholder` | 한 줄 — `55-1`이 커밋됐다 |
| `README.md` | `True` |
| `tools/__pycache__` | **`False`** — 반입 때 지웠다(R26-1) |
| `.gitignore`의 `__pycache__` | 한 줄 |
| `render/issue/issue` | **`False`** — `True`면 한 단계 더 들어가 있다. 멈춥니다 |
| `v1.1` | 한 줄 이상 — v1.1 대조표가 있다. **없으면 v1이 들어온 것이니 멈춥니다**(R25-8) |
| `git ls-files render/issue` | 출력 있음 — 반입분이 커밋됐다 |
| `<script`·외부 URL | **빈 출력.** 나오면 멈추고 그 줄을 보고합니다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / `55-1` 보충 완료 보고의 숫자** — Proteur가 위임 메시지와 함께 알려줍니다. jest에는 규칙 F(파일명) 시험이 들어 있어 반입한 파일 이름도 여기서 확인됩니다. 다르면 위임하지 말고 실제 숫자와 실패한 시험을 보고합니다. **파일명 시험이 `render/.venv` 안의 파일 때문에 실패하면**(`55-1` 보고 판단 2) 고치지 말고 그대로 보고합니다.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/55-2-corner-pipeline-render-binding.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 0단계 — README v1.1 문법과 55-1 채움 모듈 문법이 다르면 멈춤
2. render/issue/ 안의 HTML 구조를 고치지 않는다는 것 (막히면 목록으로 보고)
3. 없는 값을 지면에 넣지 않는다는 것과 PM 예외 두 가지 (재소환 사유 · @da.lead 숫자)
4. 완료 기준의 PDF 세 권 조건

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- render/issue
git diff --stat -- supabase/migrations src app docs package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
git ls-files --others --exclude-standard | Select-String -Pattern '\.(pdf|jpe?g|png)$'
```

- 셋째·넷째·다섯째 명령은 **빈 출력**이어야 합니다 — 셋째는 지면 HTML을 고치지 않았는지, 다섯째는 렌더 산출물이 커밋 대상에 섞이지 않았는지 봅니다

**키 누출 확인** — 리터럴 검색입니다. 출력이 비어 있어야 합니다.

```powershell
Get-ChildItem scripts, supabase, src, app, render, .claude/state -Recurse -File -Exclude *.pdf,*.jpg,*.jpeg,*.png,*.woff,*.woff2,*.ttf,*.otf | Where-Object { $_.FullName -notmatch '\\\.venv\\' } | Select-String -SimpleMatch -Pattern $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 확인 | 기대 |
|---|---|
| 0단계 | 문법 대조 결과가 보고됐는가. 달랐다면 멈췄는가 |
| PDF 세 권 | 조건대로인가 — ① 사진 표지·`basic`·타임라인 2면 ② 활자 표지·`neon`·인용 2면 ③ `skipped` 코너·다른 밝은 테마. **메인 세션이 PDF를 열어** 지면 순서·쪽 번호를 확인 |
| 지면 구조 | `render/issue/` diff가 비었는가. 막힌 슬롯은 목록으로 보고됐는가 |
| 지면 순서 | CORNER_LAYOUT §6. `skipped` 코너가 지면·목차에서 빠지고 쪽 번호가 다시 매겨졌는가. 대체 지면이 없는가 |
| 분할 | 953px 기준 시험 두 가지(3-stop → 2면, 945px → 1면) |
| 코너 밖 값 | README §2·§9-② 이름 전부가 계산됐는가. 표제 대체 규칙·활자 표지 전환 조건 시험. **재소환 사유는 `anniversary`만 "N년 전 이맘때"이고 나머지는 줄 삭제인가(R26-4). `@da.lead` 숫자가 실린 것만 세는가(R26-5)** — 렌더된 PDF에서도 확인 |
| 발행 노트 | 문장 출처 비율의 분류별 문장 수가 보고됐는가. 고정 틀 문장(`@da.lead`·`@da.routeHeadline`·`@back.closing`)이 온도록 쪽으로 들어갔는가. 형용사 없는 문장인가 |
| 없는 값 | content·README §2 계산 밖의 값이 지면에 없는가 |
| 테마 | 6종 키 모두 렌더 가능한가 |
| 지면 검사 | 호별 결과 파일에 `overset`이 들어 있는가. `audit.py` 대조 결과가 있는가. 위반이 렌더를 실패시키지 않고 기록됐는가 |
| 견본 사진 | `images/sample/`이 렌더 결과에 없는가 |
| 발행 | 렌더된 호 정상 발행 1건 (`55-1` 가드 통과) |
| 호출 | 실제 LLM 호출 0회 |
| 게이트 | tsc 0 / 0, jest 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
0. 0단계 문법 대조: {같음 / 다름 — 목록}
1. PDF 세 권: {① 경로·조건 / ② / ③}
2. 지면 검사 결과 파일: {호별 경로·위반 건수(overset 포함)} / audit.py 대조: {}
3. 발행 노트 문장 출처 비율 근거: {호별 분류별 문장 수}
4. 막힌 슬롯: {없음 / 목록}
5. 정상 발행: {}
6. 견본 사진 없음 확인: {}
7. 실행 명령(키 제외)·시험 데이터·내부 결정: {}

## 변경
- git diff --stat: {}
- render/issue diff: {빈 출력 O / X}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 렌더 산출물이 커밋 대상에 없음: {O / X}
- 키 누출 확인: {빈 출력 O / X}
- 실제 LLM 호출: {0회 — 근거}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / deno check: {해당 없음 / 결과}
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
- `render/issue/` 안 파일 수정
- 실제 LLM API 호출, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
