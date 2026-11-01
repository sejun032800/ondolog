# 메인 세션 지시 — `55-3c` 지면 사실 마무리

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-3c-main-session-dispatch-facts-followup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-01
>
> 짝: `55-3c-corner-pipeline-facts-followup.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **원격 쓰기 없음 · 실제 LLM 호출 없음 · 새 의존성 없음.** `55-3-run.ps1`은 실행하지 않습니다(PM 확인 뒤).

**이번에는 메인 세션의 쪽 그림 점검이 관문입니다**(R51-8). PM은 vol1 전 쪽과 메인 세션이 표시한 쪽만 봅니다. 표시를 빠뜨리면 PM이 보지 않고 지나갑니다.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-27-r72'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-01-r51'
git ls-files render/facts.py
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-3c-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 — `55-3b`가 커밋됐다. 비어 있지 않으면 그 상태로 게이트를 한 번 돌려 기록하고 남은 파일을 보고에 적습니다 |
| MASTER r72 · ROADMAP r51 | 각 한 줄(R47-3). **없으면 멈춥니다** |
| `render/facts.py` | 한 줄 |
| 위임 파일 | 두 줄 |

**기준선**: tsc 0 / 0, jest **1686 · 95**, Python(`55-3b` 완료 값 — HANDOFF · PROGRESS의 숫자). 출력 전체를 `scripts/ops/out/55-3c-jest-pre.txt` · `55-3c-python-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8).

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/55-3c-corner-pipeline-facts-followup.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. 재소환 사진은 노트에 따로 한 줄, "이번 기간 게재 + 재소환 = 지면 전체" 검증을 되살림
2. 이달의 우리 숫자 칸은 facts에서 — 생성 콘텐츠의 숫자 칸 값은 쓰지 않음
3. 지면에 실린 모든 원문 줄 = 시드 기록의 메시지·메모 하나와 글자 단위로 같다는 시험
4. render/issue/ 수정은 N3가 템플릿 원인일 때 그 한 곳만(R50-6 주석)
5. 원격에 쓰지 않음, 실제 LLM 호출 0, 55-3-run.ps1은 대조·수정만 하고 실행하지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff -- render/issue
git diff --stat -- supabase src app docs package.json package-lock.json render/requirements.txt tsconfig.json
git ls-files --others --exclude-standard | Select-String -Pattern '\.(pdf|jpe?g|png|html)$'
$k = $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; (Get-ChildItem scripts, supabase, src, app, render, .claude/state -Recurse -File -Exclude *.pdf,*.jpg,*.jpeg,*.png,*.woff,*.woff2,*.ttf,*.otf | Where-Object { $_.FullName -notmatch '[\\/](\.venv|render[\\/]out|scripts[\\/]ops[\\/]out)[\\/]' } | Select-String -SimpleMatch -Pattern $k | Measure-Object).Count
Select-String -Path scripts/ops/out/55-3-run.ps1 -Pattern '\bdb\s+push\b|migration\s+(up|repair)'
```

- 셋째: `render/issue/` diff는 **비었거나**, N3 원인이 템플릿일 때 활자 변형 오프너의 그 한 곳만(R50-6 주석 포함)
- 넷째 · 다섯째 · 일곱째: **빈 출력** / 여섯째: **`0`**

### 2-1. 쪽 그림 점검 (R50-7 · R51-8 — 관문)

로컬 네 권(vol1 · vol2 · vol2b · vol3)의 **모든 쪽 그림을 Read 도구로 직접 봅니다.** vol4는 멈춤 사유만. 그림을 못 열면 멈추고 보고합니다. 점검 항목은 일곱 가지입니다.

| # | 점검 | 볼 것 |
|---|---|---|
| 1 | 숫자 | 지면 숫자가 `facts`와 같은가. 같은 숫자가 쪽마다 다르게 나오지 않는가(노트 · 오프너 · 목차 · 기사 칸 · 경로 · 타임라인 · **이달의 우리**) |
| 2 | 빈 것 | 빈 줄 · 빈 칸 · **값이 0인 라벨** |
| 3 | 누가 쓴 글 | 두 사람 글에는 이름 표시, 온도록 글에는 라벨. 온도록 문장이 두 사람 말투가 아닌가 |
| 4 | 기간 | 이번 기간과 재소환이 섞였는가 |
| 5 | 약속 · 날짜 | 다음 호 약속 · Vol · 발행일 · 연도 규칙 |
| 6 | 읽힘 | 읽히지 않는 글자 · **같은 정보가 두 번 나오는가** |
| 7 | **원문 온전함**(새) | 원문이 **단어 중간에서 시작하거나 끝나는가** · 줄임표 · 이어 붙임 · 두 대화 본문이 같은가 |

**보고에는 문제가 있는 쪽만 표시합니다.** 문제 없는 쪽은 "그 밖의 쪽 O"로 한 줄. 표시한 쪽 번호 목록을 따로 적습니다 — Proteur가 이 목록을 PM에게 넘깁니다.

| 확인 | 기대 |
|---|---|
| N1 | 노트에 재소환 사진 한 줄 · 두 검증 시험 · 지면 사진 수를 직접 센 대조 |
| N2 · N5 | 근거 사진 줄 없음 · 0인 칸 · 라벨 · 조각 없음 |
| N3 | 원인 보고 · 두 번 표시 없음 |
| N4 | 이달의 우리 숫자 칸 = `facts` · 정의가 보고됨 · 콘텐츠 숫자를 쓰지 않음 |
| N6 · R51-7 | 원문 글자 단위 시험 · 대화 본문 비겹침 · vol3 인용 · 표지가 온전한 문장 |
| run.ps1 | 새 시드와 맞음 · 적용 명령 0 · 실행 안 함 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 전부 통과 — 출력 전체를 `scripts/ops/out/55-3c-jest.txt` · `55-3c-python.txt`에. **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / 다시 돌림: {없음 / 실패 시험·꼬리}

## 산출
1. N1 / N2 / N3(원인) / N4(숫자 칸 정의) / N5 / N6·R51-7: {항목별 파일·줄}
2. render/issue/ 수정: {없음 / 파일·줄·이전 → 이후}
3. 시드 변경 · 새 시험: {}
4. 로컬 다섯 권: {권별 통과/실패 · 원문 clipped · 노트 정합 · R51-2 검증 · 감사기 이전/이후}
5. 55-3-run.ps1: {그대로 / 바뀐 줄}
6. 내부 결정: {}

## 쪽 그림 점검 (일곱 항목, 메인 세션이 직접 봄)
- 문제 있는 쪽: {권 · 쪽 · 항목 번호 · 내용}
- 그 밖의 쪽: O
- N1~N6 · R51-7 해소 쪽: {}
- **PM에게 넘길 쪽 목록**: {권 · 쪽}

## PM에게 넘길 PDF
- {vol1 PDF 경로 — PM은 전 쪽} / {표시한 쪽이 있는 권의 PDF 경로}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후 — 검증을 줄이는 변경은 따로 표시}
- render/issue diff: {없음 / N3 한 곳}
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
- 원격 쓰기 · `55-3-run.ps1` 실행 · 실제 LLM 호출 · 새 의존성 · 마이그레이션
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
