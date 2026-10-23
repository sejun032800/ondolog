# 메인 세션 지시 — `55-1` 보충 (R26-2 · `data-optional`이 `data-src`도 센다)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/55-1b-main-session-optional-src.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-23
> 기준선: MASTER r66 · ROADMAP r26 · `55-1` 커밋됨 · jest 1098 · 55 · Python 40건

---

**`55-1`은 끝났습니다. 이 보충 하나만 반영합니다**(PM 지시 `55-1` §9, r26 추가). `corner-pipeline`에게 위임하고 검증합니다. 실제 LLM 호출·원격 쓰기는 없습니다. 커밋하지 않습니다.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-22-r66'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-23-r26'
git ls-files render/render_issue.py
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '55-1b-main-session-optional-src'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r66 / ROADMAP r26 | 각 한 줄 |
| `render_issue.py` | 한 줄 — `55-1`이 커밋됐다 |
| 이 파일 | 한 줄 |

기준선: tsc 0 / 0, jest **1098 · 55**, Python 시험(`render/tests/`) **40건 OK**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 보충 하나를 corner-pipeline 역할로 직접 수행해주세요. 다른 에이전트를 호출하지 마세요.
이 메시지가 지시의 전부입니다.

[보충 — ROADMAP R26-2]
- 슬롯 채움 모듈의 data-optional 판정은 data-slot(글자)과 data-src(사진 경로)를 모두 센다.
  "안의 data-slot·data-src 값이 전부 비면 요소째 삭제"다. 사진 틀에는 data-src만 있다.
- 시험 하나를 더한다: 사진 경로가 빈 사진 틀이 data-optional로 지워진다.
  (사진 경로가 있는 틀은 남는다는 반대 경우가 기존 시험에 없으면 같이 둔다)
- 해석 순서(variant → repeat → if → optional, R25-2)는 바꾸지 않는다.
- 이미 그렇게 동작하면 코드는 그대로 두고, 그 위치와 시험을 보고한다.

바꾸지 않는 것: render/_placeholder/ 지면, 렌더 명령, 발행 가드, scripts/ops, 설정 파일, docs/.
render/issue/는 쓰지 않는다(55-2 범위).
끝나면 Python 시험과 게이트(tsc 둘, jest)를 직접 돌려 보고해주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
```

| 확인 | 기대 |
|---|---|
| 바뀐 곳 | 채움 모듈과 그 시험(`render/` 아래), HANDOFF·PROGRESS뿐인가 |
| 판정 | `data-optional`이 `data-slot`과 `data-src`를 모두 세는가 — diff 또는 기존 코드 위치 |
| 시험 | 빈 사진 경로의 틀이 지워지는 시험이 있는가 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 시험 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 보충
- 판정: {이미 그랬음 — 위치 / 고침 — diff 요약}
- 시험: {파일·이름}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {}
- Python 시험: {건수 OK}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}
```

## 하지 말 것

- 직접 구현, 위임 메시지 요약·보강
- 보충 밖 변경
- 커밋·푸시
