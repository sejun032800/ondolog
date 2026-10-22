# 위임 프롬프트 — M2-c 렌더 배관 (`55-1`)

> 대상: `corner-pipeline`
> 보관 경로: `.claude/state/prompts/phase-7/55-1-corner-pipeline-render-plumbing.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-22
> 기준선: MASTER r66 · ROADMAP r25 · `54-` 커밋됨 · jest 1092 · 55
> `55-corner-pipeline-render.md`를 대체한다(ROADMAP R23-1)

---

## 목표 (PM) — 시연 가능한 결과 하나

**`54-`의 시험 커플 초안 호가 운영자 명령 하나로 디지털 PDF와 페이지 이미지가 되어 `magazine` 버킷에 올라가고, `issues`의 세 필드가 채워진다. 발행 명령은 렌더되지 않은 호와 원본이 지워진 호를 거부한다.**
지면은 **임시 지면**이다 — 진짜 지면은 `55-2`(디자인 `render/issue/` v1.1 도착 뒤).

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_MASTER.md` **9-5**(렌더 규칙·렌더는 발행 전 한 번·발행 가드), **17-0-10-D**(복제는 렌더 전·발행 직전 원본 재확인), 17-0-10-E
- `docs/ONDOLOG_ROADMAP.md` M2-c, 결정 **R13-5 · R21-2 · R23-1~3 · R25-2**
- `docs/ONDOLOG_SCHEMA.md` §9-D
- 슬롯 계약 — 이 문서의 "슬롯 계약" 절 (계약 원문은 디자인 세션 요청서이며, 지면 HTML이 오면 `render/issue/README.md`가 원본이 된다)

## 범위

| # | 할 일 |
|---|---|
| 1 | **임시 지면** — `render/_placeholder/`에 A4 HTML 한 장(호 이름·기간·코너별 상태와 제목·실린 사진 몇 장). 슬롯 계약 표시(`data-slot`·`data-repeat`·`data-src`)를 **이 임시 지면에서 먼저 써 본다** — `55-2`에서 같은 채움 코드가 디자인 HTML에 그대로 쓰이게. **디자인처럼 꾸미지 않는다** |
| 2 | **슬롯 채움 모듈** — 계약의 여섯 표시(`data-slot`·`data-repeat`·`data-optional`·`data-if`·`data-src`·`data-variant`)를 처리한다. 경로 해석, 반복, 빈 값 줄 삭제, 조건, 변형 선택. **지면 구조는 건드리지 않는다.** 시험으로 각 표시를 확인 |
| 3 | **렌더 명령** — Python Playwright(Chromium). MASTER 9-5 규칙: `print_background=True`, margin `0` + CSS padding, `wait_until='networkidle'`, 출력 파일명 ASCII. 산출: **디지털 PDF 1개 + 쪽마다 이미지 1장**(가로 1170px, JPEG 85 기본 — **쪽당 용량 보고**). `magazine` 버킷 `{couple_id}/{issue_id}/…`에 올리고 `pdf_digital_path`·`page_count`·`cover_path`(1쪽 이미지)를 채운다. **사진은 P7이 복제한 목적지 사본을 읽는다**(R21-2). 경로 모양·Deno/Python 분담은 내부 결정 |
| 4 | **발행 가드 ①**(R23-3) — 세 필드 중 하나라도 비면 발행 명령이 거부한다. 시험 |
| 5 | **발행 가드 ②**(R23-3) — 코너가 다시 생성되거나 `pending`으로 돌아가는 경로(재생성, 원본 재확인 실패)에서 **그 호의 세 필드를 비운다.** 시험 |
| 6 | **발행 직전 원본 재확인**(R21-2) — content에 실린 사진의 원본(`data_entries.storage_path`)이 하나라도 없으면 **발행하지 않고** 해당 코너 `pending` + `last_error = 'source_media_missing'`(+ 가드 ②로 렌더 필드 비움). 실패 사유 4값은 늘리지 않는다. **시험: 원본 하나 삭제 → 발행 거부 · 코너 pending · 렌더 필드 빈 값 · 호 미발행** |
| 7 | **`thumbPath`를 읽는 렌더 코드가 없는지** 확인해 보고(R21-2) |
| 8 | **끝에서 끝** — 시험 커플 하나: 생성(`54-` 명령) → 렌더 → **발행 1건 성공** |

### 슬롯 계약 — 해석 순서 (R25-2)

- 채움 모듈은 **`data-variant` → `data-repeat` → `data-if` → `data-optional`** 순으로 처리한다
- `data-optional`은 **"안의 슬롯 값이 전부 비면 요소째 삭제"**다
- `data-src="."`는 **반복 항목 자체가 사진 경로**다
- **순서별 시험을 하나씩 둔다** — 최소한 아래 둘
  - 지울 변형 안의 반복이 복제되지 않는다
  - `if`로 지운 가지의 빈 슬롯이 `optional` 판정에 걸리지 않는다

### Python 환경

- 가상환경은 **`render/.venv`**(추적 안 함). Chromium은 Playwright가 내려받는다
- **의존성 목록 파일 하나**를 `render/` 아래 둔다(이름은 내부 결정)
- **`.gitignore`에 `render/.venv`와 렌더 산출 폴더를 더하는 것은 허가한다.** 그 밖의 설정 파일·`package.json`은 바꾸지 않는다

## 범위 밖

진짜 지면·테마·표지 규칙·발행 노트 계산(`55-2`) · 지면 검사 도구(`55-2`) · `render/issue/` 반입·사용(`55-2`) · 앱 화면(U3) · 인쇄 프로필(M4-3) · 렌더 워커(M4-3) · 실제 LLM 호출 · 마이그레이션 · `docs/` 수정 · npm 의존성 추가 · 새 정적 규칙

## 지켜야 할 것

- **CLAUDE.md 절대 규칙 8개 그대로.** 커밋·푸시는 사람이 한다
- **렌더 산출물(PDF·이미지)은 커밋하지 않는다** — 추적하지 않는 폴더에
- `issues_public` 밖으로 렌더 결과를 여는 앱 경로를 만들지 않는다(절대 규칙 3)
- service_role 키는 운영자 명령(`scripts/ops`·`render`)에서만 환경변수(`ONDOLOG_SUPABASE_URL`·`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`)로 읽는다. 앱 코드에서 import되지 않는다. **값은 화면·파일·로그·보고 어디에도 쓰지 않는다**
- 원격 쓰기는 **개발 프로젝트에만**(`54-`의 확인 그대로). 새 시험 데이터 이름에는 `test`(R13-7)

## 게이트

- `npx tsc --noEmit -p .` 0
- `npx tsc --noEmit -p supabase/functions/tsconfig.json` 0
- jest 전부 통과. **마지막 요약 줄(`Test Suites:`·`Tests:`)을 그대로** 붙이고 기준선 1092 · 55 대비 증감을 적는다
- `scripts/ops` 진입점이 바뀌었거나 늘었으면 `deno check --no-lock --config supabase/functions/deno.json <진입점들>`
- Python 쪽 시험이 있으면 그 명령과 결과
- 실제 LLM API 호출 0회

## 산출 — 완료 보고에 붙인다

1. 시험 커플 호의 **PDF 파일과 페이지 이미지 경로**(임시 지면이어도 Proteur가 직접 연다), **쪽당 이미지 용량**
2. `issues` 세 필드와 버킷 목록 (쿼리 출력 그대로)
3. 발행 가드 ①·② · 원본 재확인 시험 결과, **정상 발행 1건**
4. 슬롯 채움 모듈의 표시별·순서별 시험 목록
5. `thumbPath` 확인 결과
6. 렌더·발행 실행 명령(키 값 제외), 새 시험 데이터 목록(ID·경로)
7. 내부 결정 목록 (경로 모양·Deno/Python 분담·의존성 파일 이름 등)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
