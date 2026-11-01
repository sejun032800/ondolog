# 메인 세션 지시 — `55-3b` 지면 사실 오류 일괄 수정

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-3b-main-session-dispatch-vol1-fixes.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-01
>
> 짝: `55-3b-corner-pipeline-vol1-fixes.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **원격 쓰기 없음 · 실제 LLM 호출 없음 · 새 의존성 없음.** `55-3-run.ps1`은 실행하지 않습니다(PM 판정 뒤).

이번 검증의 중심은 **메인 세션이 다섯 권의 쪽 그림을 직접 보는 것**입니다(R50-7). 글자 추출로는 잡히지 않는 문제를 찾는 것이 목적입니다.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-27-r72'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-01-r50'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-3b-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 — `55-3` R49 수정이 커밋됐다. 비어 있지 않으면 그 상태로 게이트를 한 번 돌려 기록하고 남은 파일을 보고에 적습니다 |
| MASTER r72 · ROADMAP r50 | 각 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | 두 줄 |

**기준선**: tsc 0 / 0, jest **1686 · 95**, Python **191**. 출력 전체를 `scripts/ops/out/55-3b-jest-pre.txt` · `55-3b-python-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8).

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/55-3b-corner-pipeline-vol1-fixes.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. 지면의 모든 수치·목록은 "호의 사실" 한 모듈에서 한 번 — 따로 세는 코드를 남기지 않음
2. render/issue/ 수정은 지시서가 이름 붙인 6곳만, 수정마다 R50-6 주석 — 그 밖의 수정 0
3. 시드 문장은 시드 기록과 맞추고 시드 점검 시험을 더함
4. 쪽 그림은 새 의존성 없이(Playwright 경로) — 설치 금지
5. 원격에 쓰지 않음, 실제 LLM 호출 0

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- render/issue
git diff -- render/issue
git diff --stat -- supabase src app docs package.json package-lock.json render/requirements.txt tsconfig.json
git ls-files --others --exclude-standard | Select-String -Pattern '\.(pdf|jpe?g|png|html)$'
$k = $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; (Get-ChildItem scripts, supabase, src, app, render, .claude/state -Recurse -File -Exclude *.pdf,*.jpg,*.jpeg,*.png,*.woff,*.woff2,*.ttf,*.otf | Where-Object { $_.FullName -notmatch '[\\/](\.venv|render[\\/]out|scripts[\\/]ops[\\/]out)[\\/]' } | Select-String -SimpleMatch -Pattern $k | Measure-Object).Count
```

- 셋째 · 넷째: `render/issue/` diff가 **지시서가 이름 붙인 6곳**(목차 조각 · 이름 없는 곳 문구 · 기사 메모 줄 · 타임라인 라벨 · 뒤표지 NEXT ISSUE 삭제 · 사진 위 폴리오 잉크)**뿐**이고, 각 자리에 `R50-6 임시` 주석이 있는지 직접 대조합니다
- 다섯째 · 여섯째: **빈 출력**
- 일곱째: **`0`**

### 2-1. 쪽 그림 직접 보기 (R50-7 — 이번 검증의 핵심)

로컬 다섯 권(vol1 · vol2 · vol2b · vol3 통과, vol4 실패라 그림 없음 — vol4는 멈춤 사유만)의 **모든 쪽 그림을 Read 도구로 직접 봅니다.** 그림을 못 열면 멈추고 보고합니다. 쪽마다 아래 점검표를 채웁니다.

| 점검 | 볼 것 |
|---|---|
| 숫자 | 지면의 숫자가 "호의 사실" 값과 같은가. 같은 숫자가 다른 쪽에서 다르게 나오지 않는가(오프너 · 목차 · 노트 · 기사 칸 · 경로 · 타임라인) |
| 빈 것 | 빈 줄 · 빈 칸 · 값 없는 라벨("AI 캡션 0" 등) |
| 누가 쓴 글 | 두 사람 글에는 이름 표시가, 온도록 글에는 라벨이 있는가. 온도록 문장이 두 사람 말투(반말 · 해요체)로 쓰이지 않았는가 |
| 기간 | 이번 기간과 재소환이 섞였는가(장소 목록 · 숫자 · 날짜) |
| 약속 · 날짜 | 다음 호 약속 · Vol · 발행일 · 연도 규칙(재소환만 연도) |
| 읽힘 | 읽히지 않는 글자(대비 · 겹침 · 잘림) |

**§1 표 #1~#14가 모두 해소됐는지 쪽 번호로** 적습니다. 새로 찾은 것은 고치지 말고 별도 목록으로 적습니다.

| 확인 | 기대 |
|---|---|
| "호의 사실" | 한 모듈에서 계산 · 모든 지면이 읽음 · 따로 세는 코드 0 |
| 노트 정합 | 다섯 권 모두 줄마다 모은 양 − 게재 = 싣지 않은 것 합 |
| 시드 | #12~#14 해소 · 시드 점검 시험 |
| 로컬 다섯 권 | 원문 `clipped` 0 · vol4 실패 유지 · 감사기 결과 이전과 나란히 |
| 정적 검사 시험 | 새로 생기지 않았는가(R32-3) |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 191 이상 — 출력 전체를 `scripts/ops/out/55-3b-jest.txt` · `55-3b-python.txt`에. **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / 다시 돌림: {없음 / 실패 시험·꼬리}

## 산출
1. "호의 사실" 모듈: {파일 / 값 / 읽는 지면 / 따로 세는 코드 남음 여부}
2. §1 #1~#14 해소: {항목별 파일·줄}
3. render/issue/ 수정 6곳: {파일·줄·이전 → 이후} — 디자인 보관 요청서용
4. 시드 변경 · 시드 점검 시험: {}
5. 로컬 다섯 권: {권별 통과/실패 · 원문 clipped · 감사기 이전/이후 · 노트 정합}
6. 내부 결정: {}

## 쪽 그림 점검표 (메인 세션이 직접 봄)
- {권 · 쪽마다 한 줄: 숫자 / 빈 것 / 누가 쓴 글 / 기간 / 약속·날짜 / 읽힘 — O 또는 문제}
- §1 #1~#14 해소 쪽: {}
- 새로 찾은 것(고치지 않음): {}

## PM에게 넘길 PDF
- {다섯 권 PDF 경로 — vol4는 멈춤 사유 파일}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- render/issue diff: {6곳만 O / X}
- 금지 대상 변경: {없음 / 있음}
- 렌더 산출물이 커밋 대상에 없음: {O / X}
- 키 누출: {0}
- 실제 LLM 호출: {0회}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로): {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. **여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 지시서 밖의 `render/issue/` 수정
- 원격 쓰기 · `55-3-run.ps1` 실행 · 실제 LLM 호출 · 새 의존성(도구 설치 포함) · 마이그레이션
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
