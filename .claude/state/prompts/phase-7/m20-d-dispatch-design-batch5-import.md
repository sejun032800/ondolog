# 메인 세션 위임 프롬프트 — `2.0-D` 디자인 묶음 5 반입 (매거진 v2.0.0 · 입력 화면 보드) + 2.0-A1 코너를 새 틀에 연결

> **함께 넣는 파일: `ONDOLOG_render_issue_v2_0_0.zip` · `ONDOLOG_canvas_batch5.zip`** — Proteur가 **풀지 않고** 이 위임서와 같은 폴더(`.claude/state/prompts/phase-7/`)에 넣었습니다. **`ONDOLOG_render_issue_v2_0_0_part1.zip`은 반입하지 않습니다**(R158-7 · 최종본에 다 들어 있음 — 폴더에 있어도 풀지 않음).
> 기준 문서는 저장소 안 **ROADMAP r158 R158-5 ~ R158-11**, 기획서(r158), 반입된 `render/issue/README.md` v2.0.0 §10(①②③④ F1~F7) · §13, `docs/magazine-2-0/contracts/`입니다. 시작 전에 `DOC_REVISION`이 ROADMAP `r158` 이상인지, **2.0-A1 2차 커밋이 들어왔는지**(`git log`에 "2.0-A1 chatDelta v0") 확인하고, 아니면 진행 전에 한 줄로 알려 주세요.
> 보관 경로: `.claude/state/prompts/phase-7/m20-d-dispatch-design-batch5-import.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-26 (ROADMAP **r158** · R151-3 · R138 · R152-2 · R157-7 · R119-5 · R121-5 · R144-3)
> 대상: 메인 세션. 방식: R75 — 한 지시서, 끝에 한 번 보고
> **LLM 0 · 원격 0 · 마이그레이션 0 · 앱 화면 0 · 새 패키지 0**
> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

---

## 압축 풀기 규칙 (R151-3 · 상시)

1. 풀기 **전**에 `git status --short`의 ` D` 줄이 0인지 확인합니다.
2. 압축을 **저장소 밖 임시 폴더**에 먼저 풀고, 압축 안 파일 목록을 만듭니다.
3. 저장소로 옮길 때는 **더하거나 바꾸기만** 합니다. 기존 파일을 지우는 일은 0입니다(지워야 할 것이 보이면 멈추고 보고).
4. 옮긴 **뒤** `git status --short`로 바뀐 파일 목록을 만들어 압축 목록과 대조합니다. ` D` 0을 다시 확인합니다.
5. 압축 맨 위 파일은 제자리로 보냅니다.
   - `CHANGES_batch5.md` → `docs/design/nocturne/`
   - `CURRENT_batch5_rows.md` → 저장소 CURRENT 표에 붙여 넣고 rows 파일은 지움(추적되지 않는 파일)
   - `screens_index_batch5_rows.csv` → `screens_index.csv`에 붙여 넣고 지움. 같은 id가 있으면 바꾸고, 중복 0
6. **zip 파일 자체는 커밋 0.** 루트 `.gitignore`에 `.claude/state/prompts/**/*.zip` 한 줄(F2 · R157-12)
7. 반입 커밋은 메인 세션 확인 뒤 **작업 커밋 하나**입니다. Proteur는 반입 커밋을 따로 하지 않습니다(R150-2 · R158-7).

## 범위 · 허가

- **반입**: `render/issue/` v2.0.0 전체(새 15틀 · README · base.css · tools · themes · images · fonts · measure.json) · 입력 화면 보드 `N-R20-Magazine-Input.dc.html` · 화면 그림(K · L · N · P · W).
- **편집**
  - 렌더러 Python(`compose*.py` · `render_issue.py` · `page_plan.py` · `promise_check.py` 등) · `render/tests/`
  - 엔진 · 코너 중 아래 "정정"에 필요한 곳
  - 계약 파일(`docs/magazine-2-0/contracts/`)
  - `.gitignore` 한 줄 · HANDOFF · PROGRESS
- **고치지 않는 것**
  - 디자인 틀(`render/issue/pages/*.html` · `base.css` · `tools/*.py`). **예외는 아래 "정정" 3 · 4의 문구 두 곳뿐**(PM이 뜻으로 정한 것 · 모양은 그대로)
  - 지금 3코너 동작(동결)
- **금지**: LLM 0 · 원격 0 · 커밋 0(사람이 합니다)
- **근거(R119-5)**: 파일:줄 · 시험 이름

## 할 일

### ① 반입 확인

| 확인 | 정상 |
|---|---|
| 지면 수 | README §1: **28개**(v1.2.4의 13 + 새 15) |
| 파일 수 | README §8: 68개(+ `measure.env.json` 같은 개발 파일은 따로 셈) |
| 렌더러 Python | 반입으로 바뀐 것 0(압축은 `render/issue/`만) |
| `measure.json` | **압축에 들어 있습니다**(디자인 환경 값). 반입하면 저장소의 렌더 환경판을 덮으므로 ② 재측정을 **같은 커밋**에서 합니다 |
| `samples/*.pdf`(약 3.3MB × 2) | 저장소에 전부터 `render/issue/samples/`가 추적되고 있었는지 확인합니다. **처음 생기는 큰 바이너리라면 커밋하지 않습니다.** 루트 `.gitignore`에 `render/issue/samples/*.pdf` 한 줄을 넣고 파일은 로컬에만 둡니다(`tools/sample.py`로 다시 만들 수 있음). 어느 쪽이었는지 보고에 적습니다 |
| 글꼴 | 해시가 지금 `measure.env.json`과 같은지 확인합니다. 다르면 어느 파일인지 적습니다 |
| v1.2.4 13지면 | README §10 ①-5: "견본 **픽셀 같음** · 높이 표 **값 같음**". 반입 뒤 시나리오 11개의 13지면 HTML 차이를 목록으로 적습니다. `overflow-wrap` 한 줄 외에 다른 차이가 있으면 보고합니다 |

### ② F1 렌더 환경 재측정 (같은 커밋 · R138)

- 렌더 PC에서 `render/issue/tools/measure.py`를 실행하고, 84-d2 방법으로 `measure.env.json`을 다시 기록합니다. 두 번 재서 바이트까지 같은지 봅니다.
- 판 이름이 `v2.0.0`으로 찍히는지 봅니다(디자인이 고침).
- 디자인 환경판(압축 안 `measure.json`)과 차이 칸 수를 적습니다. 88- 여유 1줄 판정(9칸 모두 남김)이 그대로 적용되는지도 봅니다(`heights.py:32`).

### ③ F2 · F3 · F5 · F6 · F7 — A1 코너를 새 틀에 연결

| # | 할 일 |
|---|---|
| F2 | `DEV_TEMP_CSS_92`를 **지웁니다**(`render_issue.py:418` 블록 · :439 덧붙임). 틀 `base.css`가 `overflow-wrap:anywhere`를 스스로 합니다. 92- · 88-b 덩어리 시험이 **임시 CSS 없이** 통과해야 합니다 |
| F6 | `render/temp_pages/tp-*.html`(A1 임시 틀 10개)를 **새 틀로 바꿉니다**. A1 지면: `dna-figure` · `dna-axes` · `rough-guess` · `appendix-calendar` · `appendix-postcard` · `photo-break` · `next` · `colophon` · `note` · `contents`. 임시 틀 폴더는 **연결이 모두 끝난 뒤** 지웁니다(추적 파일이라 ` D`가 생기는 것은 이 위임이 의도한 삭제 — 목록으로 보고) |
| F3 | 새 변형 고르기(README §3 v2.0.0 줄) · 새 계산 값(§2 v2.0.0 표). `@sample.stamp`는 실제 호에서 **늘 빈 값**이고, 시험으로 고정합니다 |
| F5 | 약속 문장 금지 검사(`promise_check.py`)를 `next.html` · `colophon.html` · `note.html` **출력**에 겁니다. 틀의 고정 문구가 모두 통과하는지 시험합니다 |
| F7 | 목차: 9항목 이상이면 `long` 변형, 8항목 이하이면 `short`. 발행 노트: 재료 6줄 이상이면 `grid` 변형. 빠진 코너는 "코너 — 이유" 한 줄씩 |
| 제목 | **「판권과 정오」**(R158-3 · PM이 정함). README F6의 "판권 정오" · 러닝헤드 "판권 · 정오"보다 PM 결정이 우선입니다(이름은 뜻 · PM 소관). 제목 표와 러닝헤드를 모두 「판권과 정오」로 하고, 틀의 러닝헤드가 고정 문구라면 그 문구 한 곳만 바꾸고 보고합니다 |

**F4(되받기 블록 등록)는 이번에 하지 않습니다.**
- 대상 블록(`setlog` · `interview` · `guest` · `league-report`)은 아직 코너 엔진이 없습니다(A2 · 2.0-B · C).
- HANDOFF에 "F4는 그 코너 위임에서 등록"이라고 적고, 높이 표(`measure.json` `v2`) 위치만 적어 둡니다.
- 나머지 새 틀(셋로그 · 인터뷰 · 게스트 · 어깨너머 · 협찬 · 리그 2면)도 **반입만** 하고 연결하지 않습니다.

### ④ 정정 (R158-8 · PM이 견본을 보고 정함)

| # | 정정 | 하는 곳 |
|---|---|---|
| 1 | **두 사람의 결 · "마음을 기대는 방식"에 애착 유형 이름(안정형 · 불안형 · 회피형 등) 표시 0.** 엔진이 조합 문장(예: "서로의 속도를 기다려 주는 짝")을 넣습니다. 조합별 문장표는 엔진 상수 하나에 두고, 판정 · 결핍 표현 0 · 합니다체 · 명사형 라벨 규칙을 지킵니다 | 엔진 + 계약 |
| 2 | **모든 지면 출력에 애착 유형 이름이 나오지 않는다**는 시험을 하나 둡니다(금칙 목록: 안정형 · 불안형 · 회피형 · 혼란형 · 공포회피형 등) | 렌더 시험 |
| 3 | **어림짐작 면책 문장 = "재미로 보는 지면입니다. 진짜로 잰 값은 아닙니다."**(합니다체). 틀의 고정 문구라면 그 문구 한 곳만 바꾸고 보고합니다 | 틀 문구 1곳 또는 슬롯 |
| 4 | **견본 인터뷰 질문은 승인 풀 60에서만**(R158-8). 렌더 견본 데이터(`tools/sample.py` · 로컬 견본)에 인터뷰 질문이 있으면 풀의 문장으로 바꿉니다. **보드 그림(L01~L04)은 바꾸지 않고** 다음 디자인 묶음 정정 항목으로 적습니다 | 견본 데이터 |

### ⑤ 계약 갱신 (R158-9)

| 계약 | 반영 |
|---|---|
| `rough_guess` | `items`를 짐작/셈으로 나눔: `estimates[3]` · `measured{reply, talkFirst, emoji}` · `busiestDay` · `monthlyTopic`(디자인 §10 ③ 모양) |
| `league_monthly` | `current` · `matchReport` 추가 · **`pages.max` = 2 유지**(디자인 요청 3은 받지 않음) |
| `love_dna` | `score.chatApplied` 추가(A1에서 이미 있으면 확인만) |
| `couple_interview` | `mostDivergent` 삭제 |
| `over_shoulder` | `ourValue` 삭제 |
| `publication_note` | **`notUsed`는 이름 그대로**(싣지 않은 재료) · **`skippedCorners`를 새로 더함**(빠진 코너). 틀의 `@note.emptyCorners`는 `skippedCorners`에서 채웁니다 |
| `colophon` · `love_dna` (A1 2차 보고에서 남은 것) | 옛 표기 정리: "판권 정오" → **「판권과 정오」** · `love_dna`의 chatDelta UNRESOLVED 표기 → **dna_v0 A′**(식 · 상수 위치 `loveDna.ts` `DNA_CHAT_DELTA_V0`) |

**PM이 아직 정하지 않은 디자인 요청**(디자인 §10 ③ 중 위 표 밖)은 계약 파일에 `"design_request_pending_pm": [...]`로만 적고 엔진은 바꾸지 않습니다.
- `love_dna` `partners[].name` · `bigFive o c e a n` · `sternbergOverlap`
- `offline_setlog` `dayText` · 조각 6
- `couple_interview` `answers[]` 짝 바꾸기 · `pages.max` 3(**R158-5와 어긋남 — 2가 맞음, 확인용**)
- `special_guest` 질문별 100자
- `sponsored` skip_note 없음
- `appendix` 엽서 1장 면 유지
- `next_issue` `openingCorners` 상수표
- `colophon` `errata[]`

PE가 PM에게 올립니다.

### ⑥ 입력 화면 보드 · 화면 (문서 반입)

- `N-R20-Magazine-Input.dc.html` · `screens/` K01 · K02 · L01~L04 · N01 · N02 · P01~P03 · W01~W04(+ `__anno`)는 `docs/design/nocturne/`에 넣습니다.
- 색인 · CURRENT 줄을 붙입니다.
- 앱 코드는 0입니다(입력 화면 구현은 2.0-B · C).

### ⑦ 반입 뒤 확인

- **시나리오 11개 + 2.0 견본 2권**(A1)을 렌더합니다: 넘침 · 잘림 · 겹침 0 · 사실 불일치 0 · 약속 문장 0 · 애착 이름 0 · 쪽 수 4의 배수 또는 `short` 기록.
- 기존 3코너 13지면은 ①의 차이 목록 밖 변화가 0이어야 합니다.
- 92- · 88-b 덩어리 시험은 **임시 CSS 없이** 통과해야 합니다.

## 검증

- 렌더 시험 전체(수 · 시간) · 루트 jest · tsc · `npm run gate` 1회(시간)
- `measure.json` 2회 바이트 같음 · 환경 경고 0
- 남은 `__pycache__` · `_preview/` · 임시 폴더 0

## 보고 (한 번, 끝에)

1. 멈춘 것
2. ① 반입 확인 표(압축 목록 ↔ 바뀐 파일 대조 · ` D` 0 · samples 처리 · 13지면 차이 목록)
3. ② 재측정 숫자
4. ③ 연결한 지면 · 지운 임시 틀 목록 · 「판권과 정오」 처리
5. ④ 정정 4건(파일:줄 · 시험 이름) · 틀 문구를 바꿨다면 그 줄
6. ⑤ 계약 변경 · `design_request_pending_pm` 목록
7. ⑦ 견본 렌더 결과 표
8. 커밋 명령(`git add` 경로 하나씩 · 메시지 `feat(render): 2.0-D 디자인 묶음 5 반입 · v2.0.0 · A1 코너 새 틀 연결 · DEV_TEMP_CSS_92 제거` · 끝에 `git log --oneline -4` · `git status --short`)
9. PM에게 올릴 것 — 없으면 "없음"
