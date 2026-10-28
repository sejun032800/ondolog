# 메인 세션 지시 — `55-3` 조판 v1.2.2 렌더러 맞춤

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-3-main-session-dispatch-render-v1_2_2.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-28
>
> 짝: `55-3-corner-pipeline-render-v1_2_2.md`
> **관문(R29-2): 이 작업이 통과해야 실제 커플에게 호를 발행할 수 있다.**

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 새 의존성 · 마이그레이션 없음. **실제 LLM API 호출 없음.** Deno는 늘 `--no-lock`.

- **1부 (지금):** 위임(반입 대조 → 렌더러 맞춤 → 로컬 세 권 → 원격 스크립트 작성) → 검증 → 보고. **여기서 멈춥니다.**
- **2부 (사람이 `55-3-run.ps1`을 실행했다고 알린 뒤에만):** 출력 판정 → 보고. **원격 쓰기가 들어가는 실행은 사람이 합니다**(R42-4).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-27-r72'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-27-r47'
Get-ChildItem supabase/migrations -Name | Select-Object -Last 1
Select-String -Path render/issue/README.md -SimpleMatch -Pattern 'v1.2.2' | Select-Object -First 1
git ls-files render/issue/.gitignore
(Get-ChildItem render/issue -Recurse -File -Force | Measure-Object).Count
Test-Path render/issue/issue
Get-ChildItem render/issue -Recurse -Directory -Force -Filter __pycache__ | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem render/issue -Recurse -File -Include *.html,*.css | Select-String -Pattern '<script|(src|href)\s*=\s*["'']?https?://|url\(\s*["'']?https?://|@import\s+["'']https?://' | Select-Object -First 5
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-3-.*v1_2_2'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력. 비어 있지 않으면 그 상태로 게이트를 한 번 돌려 기록하고 남은 파일을 보고에 적습니다 |
| MASTER r72 · ROADMAP r47 | 각 한 줄(R47-3). **없으면 멈춥니다** |
| 마지막 마이그레이션 | `029_…` — `70-`이 끝났다 |
| README `v1.2.2` | 한 줄. **없으면 v1.2.2가 들어오지 않은 것이니 멈춥니다** |
| `render/issue/.gitignore` | 한 줄 — 반입이 커밋됐다 |
| 파일 수 | **`48`**(R47-4). 다르면 멈추고 숫자를 보고합니다 |
| `render/issue/issue` | **`False`** |
| `__pycache__` | **`0`** |
| `<script` · 외부 URL | **빈 출력.** 나오면 멈추고 그 줄을 보고합니다 |
| 위임 파일 | 두 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1686 · 95**, Python(`render/tests/`) **122**. **jest는 출력 전체를 `scripts/ops/out/55-3-jest-pre.txt`에 남깁니다.** 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8). 다시 돌려도 다르면 위임하지 않고 보고합니다.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/55-3-corner-pipeline-render-v1_2_2.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. §0 반입 대조를 먼저 — README §8과 실제 48파일이 다르면 멈춤
2. render/issue/ 안 파일은 고치지 않음 — 막히면 목록으로
3. 원문은 줄이거나 자르지 않음 — 한 대화가 한 면을 넘으면 렌더 실패 + 운영자
4. tm-articles 사진은 붙이지 않음(R44-9), 없는 값을 지면에 넣지 않음
5. 원격에는 아무것도 쓰지 않음, 실제 LLM 호출 0 — 원격 단계는 55-3-run.ps1에 쓰기만(db push 같은 적용 명령은 넣지 않음)

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- render/issue
git diff --stat -- supabase/migrations src app docs package.json package-lock.json render/requirements.txt tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
git ls-files --others --exclude-standard | Select-String -Pattern '\.(pdf|jpe?g|png|html)$'
$k = $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; (Get-ChildItem scripts, supabase, src, app, render, .claude/state -Recurse -File -Exclude *.pdf,*.jpg,*.jpeg,*.png,*.woff,*.woff2,*.ttf,*.otf | Where-Object { $_.FullName -notmatch '[\\/]\.venv[\\/]' } | Select-String -SimpleMatch -Pattern $k | Measure-Object).Count
$ref = (Get-Content supabase/.temp/project-ref -Raw).Trim(); (Get-ChildItem scripts, supabase/migrations, src, app, render -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/](scripts[\\/]ops[\\/]out|\.venv)[\\/]' } | Select-String -SimpleMatch -Pattern $ref | Measure-Object).Count
Select-String -Path scripts/ops/out/55-3-run.ps1 -Pattern '\bdb\s+push\b|migration\s+(up|repair)'
```

- 셋째 · 넷째 · 다섯째 명령은 **빈 출력**이어야 합니다 — 셋째는 지면 HTML을 고치지 않았는지, 다섯째는 렌더 산출물이 커밋 대상에 섞이지 않았는지 봅니다
- 여섯째 · 일곱째: **`0`**이어야 합니다(개수만 출력 — 키 · ref 값은 화면에 나오지 않습니다)
- 여덟째: **빈 출력** — 실행 파일에 적용 명령이 없다(R47-2)

| 확인 | 기대 |
|---|---|
| 반입 대조 | 48파일 대조 · 슬롯 이름 대조 · ASCII · `55-2` 남은 항목 목록이 보고 첫머리에 |
| `data-width` | 여섯 경우 — 개발 결과와 `resolve.js` 결과가 같은가. 적용 순서가 optional 다음인가. 값 없음 · 범위 밖 · 숫자 아님이 **요소 제거**인가(렌더 실패가 아님) |
| 슬롯 바인딩 | 기사 순번 · 사진 장수 · 러닝헤드(재소환만) · 오프너 사진 폴백 + `type-only` · 다정 지수 · 출처 막대 — 모두 데이터에서 오는가 |
| 확정 7건 | 항목별 바꾼 곳. `tm-articles` 사진 없음 → 한 단 지면 |
| 원문 불변 | 원문 필드의 줄 수 제한 · 말줄임이 없어졌는가. 인용면 나눔이 대화 단위이고 한 대화를 쪼개지 않는가. 넘치면 실패 + 사유 |
| 감사기 | 같은 HTML에 `audit.py`와 개발 검사기 결과가 나란히. 디자인만 잡은 항목이 개발 검사기에 더해졌는가. `safe` 분류표 |
| 로컬 세 권 | 조건대로인가 — ① 사진 많은 달 · `basic` · 타임라인 2면 ② 첫 stop 사진 없음 → 폴백 · `type-only` ③ 긴 원문 → 실패 / 그 대화를 빼면 통과. 테마 셋 이상. **메인 세션이 PDF를 열어** 지면 순서 · 폴리오 · 출처 막대 · 기사 번호 · 사진 장수 · "그때 그 시절" 위치 · Vol/발행일 없음을 확인 |
| 표시 속성 | 출력 HTML에 `data-*`가 남아 있는가(R44-8) |
| 견본 사진 | `images/sample/`이 렌더 결과에 없는가 |
| 원격 스크립트 | `55-3-run.ps1` — 시험 커플만 · 발행은 시험 커플 한 권 · 적용 명령 없음 · 키 · ref 출력 0. **실행되지 않았는가** |
| 정적 검사 시험 | 새로 생기지 않았는가(R32-3) |
| 호출 | 실제 LLM 호출 0회 — 근거 |
| 게이트 | tsc 0 / 0, jest 전부 통과(출력 전체를 `scripts/ops/out/55-3-jest.txt`에), Python 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / jest 다시 돌림: {없음 / 실패 시험 이름·꼬리}

## 반입 대조 (§0)
- 48파일: {일치 / 다른 것}
- 슬롯 이름: {}
- 55-2 남은 항목: {목록}

## 산출
1. data-width 여섯 경우: {개발 / resolve.js}
2. 슬롯 바인딩: {항목별}
3. 확정 7건: {항목별 파일·줄}
4. 원문 불변: {없앤 곳 / 나눔 실패 사유 출력 예}
5. 감사기 대조·safe 분류: {}
6. 로컬 세 권: {① 경로·조건·검사 결과 / ② / ③}
7. 55-2 남은 항목 처리 · 막힌 슬롯: {}
8. 라벨 · Vol · 발행일: {}
9. 내부 결정: {}

## 2부에서 사람이 돌릴 것
- scripts/ops/out/55-3-run.ps1 전문: {코드 블록 — 한 줄을 끊지 않는다}
- 출력 파일 위치: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- render/issue diff: {빈 출력 O / X}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 렌더 산출물이 커밋 대상에 없음: {O / X}
- 키·ref 누출 확인: {0 / 0}
- 실행 파일 적용 명령: {빈 출력 O / X}
- 실제 LLM 호출: {0회 — 근거}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / deno check: {해당 없음 / 결과} / Python: {}
- jest 마지막 요약 줄 (그대로, 출력 전체는 파일로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. **여기서 멈춥니다.**

---

# 2부 — 사람이 "`55-3-run.ps1`을 실행했다"고 알린 뒤에만

## 4. 판정

`scripts/ops/out/`의 출력 파일로 판정합니다. 메인 세션은 원격에 쓰는 명령을 실행하지 않습니다.
- 세 권이 원격 시험 커플 데이터로 1부의 로컬 결과와 같은 조건을 만족하는가(③은 실패 → 그 대화를 뺀 뒤 통과)
- 각 권의 지면 검사 · `audit.py` 결과 · `safe` 분류 · **3-7 위반 0 · 원문 `clipped` 0**
- **시험 커플 한 권 발행** — 발행 가드(렌더 세 필드 · 원본 재확인) 통과, 실제 커플 대상 0
- 스크립트 결함이면 corner-pipeline에게 스크립트만 고치게 하고, **실행은 다시 사람에게** 맡깁니다

## 5. 2부 보고

```
## 원격 세 권 (출력 파일 기준)
- ① / ② / ③: {조건 충족 · 검사 결과 · safe 분류 · 3-7 위반 · 원문 clipped}
- PDF 위치: {사람이 열 경로}

## 발행 회귀
- {시험 커플 한 권 — 가드 결과}

## 게이트 (메인 세션 재실행)
- jest 마지막 요약 줄 (그대로): {} / Python: {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- `render/issue/` 안 파일 수정
- **원격 쓰기가 들어가는 실행을 메인 세션이 하는 것**, 실제 커플 대상 작업
- 실제 LLM API 호출, 마이그레이션, 새 의존성, 허가 밖 설정 변경
- 키 · 토큰 · 서명 URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
