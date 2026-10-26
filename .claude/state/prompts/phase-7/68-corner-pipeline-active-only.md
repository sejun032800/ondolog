# 위임 프롬프트 — 생성 · 발행 대상을 `active` 커플로 한정 (`68-` 1부, 조건부)

> 대상: `corner-pipeline`
> 보관 경로: `.claude/state/prompts/phase-7/68-corner-pipeline-active-only.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
> **이 위임은 같은 `68-` db-architect의 조사 0-c에서 "`active`만 대상으로 삼지 않는 곳"이 나왔을 때만 한다.** 없었으면 메인 세션이 이 파일을 쓰지 않는다.

---

## 목표 (PM)

**해제 중(`dissolving`) 커플은 새 호를 만들지 않는다** — 화면 문구 "해제 예정 기간에는 새 호를 만들지 않아요"가 사실이 된다. (ROADMAP R43-7)

**원본**: `docs/ONDOLOG_ROADMAP.md` R43-7 · R31-9 · `docs/ONDOLOG_SCHEMA.md` §9-G · §11-3 · db-architect 보고의 조사 0-c 목록(메인 세션이 위임 메시지에 붙인다)

## 범위

| # | 할 일 |
|---|---|
| 1 | 조사 0-c가 찾은 곳에서 대상 커플을 **`couples.status = 'active'`만** 받게 한다. `dissolving` · `pending` · `dissolved`면 거부하고 사유를 출력한다(운영자 명령이 조용히 넘어가지 않게) |
| 2 | 시험 — `active`는 통과, `dissolving` · `pending` · `dissolved`는 거부. Python이면 `render/tests`에, TypeScript면 jest에 |
| 3 | 이미 만들어진 호의 발행(`fn_publish_issue` 경로)도 대상이면 같은 규칙인지 확인하고 보고 — 발행 규칙을 바꿀지는 **보고만**(해제 중 커플의 이미 생성된 호를 발행할지는 PM 판단) |

## 범위 밖

DB 함수 · 마이그레이션 · 앱 코드 · 생성 로직 자체 · 렌더 출력

## 지켜야 할 것

- **CLAUDE.md 절대 규칙 8개 그대로.** 키는 환경변수에서만, 출력 · 로그에 키 · 토큰 · URL 0
- 원격에는 아무것도 쓰지 않는다. 운영자 명령을 실제로 돌리지 않는다
- Deno는 `--no-lock`. 파일 이름 ASCII

## 게이트

- tsc 0 / 0 · jest 전부 통과 · Python 시험 전부 통과(122 + 추가분) — 마지막 요약 줄 그대로

## 산출

1. 바꾼 파일 · 줄과 거부 사유 출력 예
2. 추가한 시험(파일 · 건수)
3. 발행 경로 확인 결과(3)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄
