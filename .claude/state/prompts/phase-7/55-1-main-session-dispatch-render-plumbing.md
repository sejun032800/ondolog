# 메인 세션 지시 — M2-c 렌더 배관 위임 (`55-1`)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-1-main-session-dispatch-render-plumbing.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-22
>
> 짝: `55-1-corner-pipeline-render-plumbing.md` · `55-main-session-dispatch-render.md`를 대체한다(ROADMAP R23-1)

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 LLM API 호출은 없습니다.** 원격 **개발** DB·스토리지에는 씁니다(R13-7). 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-22-r66'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-22-r25'
git ls-files scripts/ops/publishIssue.ts
Test-Path render/issue
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-1-corner-pipeline-render-plumbing'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
python --version
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r66 / ROADMAP r25 | 각 한 줄 |
| `publishIssue.ts` | 한 줄 — `54-`가 커밋됐다 |
| `render/issue` | **`False`** — 디자인 v1.1은 `55-1` 뒤에 들어온다(R25-8). `True`면 멈추고 보고합니다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |
| `python --version` | 버전 출력. 없으면 멈추고 보고합니다(사람이 설치) |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 1092 · 55**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/55-1-corner-pipeline-render-plumbing.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 지면은 임시 지면 한 장이고 꾸미지 않는다는 것
2. 슬롯 해석 순서 (variant → repeat → if → optional)
3. 커밋하지 않는 것(렌더 산출물)과 허가된 설정 변경(.gitignore 두 항목)

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff -- .gitignore
git diff --stat -- supabase/migrations src app docs package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
git ls-files --others --exclude-standard | Select-String -Pattern '\.(pdf|jpe?g|png)$'
```

- `.gitignore` diff는 `render/.venv`와 렌더 산출 폴더 두 항목뿐이어야 합니다
- 넷째·다섯째 명령은 **빈 출력**이어야 합니다 — 다섯째는 렌더 산출물이 커밋 대상에 섞이지 않았는지 봅니다

**키 누출 확인** — 리터럴 검색입니다. 출력이 비어 있어야 합니다.

```powershell
Get-ChildItem scripts, supabase, src, app, render, .claude/state -Recurse -File -Exclude *.pdf,*.jpg,*.jpeg,*.png,*.woff,*.woff2,*.ttf,*.otf | Where-Object { $_.FullName -notmatch '\\\.venv\\' } | Select-String -SimpleMatch -Pattern $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

| 확인 | 기대 |
|---|---|
| 임시 지면 | `render/_placeholder/` 한 장. 슬롯 표시를 쓰고, 꾸미지 않았는가 |
| 채움 모듈 | 여섯 표시와 해석 순서(variant → repeat → if → optional)의 시험이 있는가. 순서별 시험 두 가지가 들어 있는가 |
| 렌더 규칙 | `print_background=True`, margin 0, `networkidle`, 파일명 ASCII. 이미지 1170px JPEG 85, 쪽당 용량 보고 |
| `issues` 세 필드 | 값과 버킷 목록이 출력 그대로 붙었는가 |
| 가드 ① | 세 필드 중 하나라도 비면 발행 거부 — 시험 |
| 가드 ② | 재생성·`pending` 복귀 경로에서 세 필드를 비움 — 시험 |
| 원본 재확인 | 원본 삭제 → 거부 · 코너 `pending` + `source_media_missing` · 렌더 필드 빈 값 · 호 미발행 |
| 끝에서 끝 | 생성 → 렌더 → 발행 1건 성공 |
| `thumbPath` | 렌더 코드가 읽지 않는가 |
| 호출 | 실제 LLM 호출 0회 |
| 게이트 | tsc 0 / 0, jest 전부 통과 — **메인 세션이 직접 다시 돌립니다**. `scripts/ops` 진입점이 바뀌었으면 `deno check`도 메인 세션이 다시 돌립니다 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. PDF·페이지 이미지: {경로} / 쪽당 용량: {}
2. issues 세 필드·버킷 목록 (출력 그대로): {}
3. 가드 ①·②·원본 재확인 시험: {} / 정상 발행: {}
4. 채움 모듈 시험 (표시별·순서별): {}
5. thumbPath: {}
6. 실행 명령(키 제외)·시험 데이터 목록: {}
7. 내부 결정: {}

## 변경
- git diff --stat: {}
- .gitignore diff: {}
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
- 실제 LLM API 호출, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
