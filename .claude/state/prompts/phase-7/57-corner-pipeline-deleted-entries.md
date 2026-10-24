# 위임 프롬프트 — 지운 항목을 생성·발행 경로에서 빼기 (`57-` B)

> 대상: `corner-pipeline`
> 보관 경로: `.claude/state/prompts/phase-7/57-corner-pipeline-deleted-entries.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
> 기준선: MASTER r68 · ROADMAP r30 · 마이그레이션 023 원격 개발 적용·실증 완료(`57-` A)

---

## 목표 (PM)

**작성자가 지운 사진(`deleted_at`이 찬 `data_entries`)은 다음 호에 실리지 않는다.** 저장소 원본 파일은 남아 있으므로, 파일 존재만 보는 지금의 재확인으로는 막지 못한다. (ROADMAP R30-1 · R21-2 · R23-3)

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_MASTER.md` **17-0-9**(입력 조립 — service_role 조회는 RLS 조건을 재현한다) · **17-0-10-D**(발행 직전 원본 재확인) · 9-5(발행 가드)
- `docs/ONDOLOG_ROADMAP.md` 결정 **R30-1 · R21-2 · R23-3**

## 범위

| # | 할 일 |
|---|---|
| 6 | **입력 조립**이 `deleted_at`이 찬 `data_entries`를 넣지 않는지 확인한다. 빠져 있으면 고친다(service_role 조회는 RLS 조건을 재현해야 한다 — 17-0-9). 제외 건수 사유에 "지운 항목"을 둘지는 내부 결정. 시험 |
| 7 | **발행 직전 원본 재확인**이 저장소 파일 존재와 함께 **`deleted_at`도 본다** — 찬 것은 없는 원본과 같이 처리한다: 해당 코너 `pending` + `last_error = 'source_media_missing'` + 렌더 세 필드 비움(R23-3), 발행하지 않는다. 실패 사유 4값은 늘리지 않는다. **시험**: jest(메모리 저장소) + **원격 개발 실증** — 렌더된 시험 호의 사진 하나를 **작성자가 `fn_delete_own_entry`로** 삭제 → 발행 거부 · 코너 `pending` · 렌더 필드 빈 값 · 호 미발행. 출력 원문 보존 |

**이미 발행된 호는 그대로 둔다** — 발행된 호의 content·렌더 결과를 바꾸는 코드를 넣지 않는다.

## 범위 밖

마이그레이션 · RLS 변경 · 앱 코드 · 렌더 지면 · 실제 LLM 호출 · `docs/` 수정 · 의존성 추가

## 지켜야 할 것

- 절대 규칙 8개 그대로. 커밋·푸시는 사람
- service_role 키는 운영자 명령에서만 환경변수로. **값은 어디에도 쓰지 않는다**
- 원격 쓰기는 개발 프로젝트에만. 새 시험 데이터 이름에 `test`. 시험용 삭제는 **작성자 세션으로 RPC를 불러** 한다(service_role로 `deleted_at`을 직접 쓰지 않는다)

## 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로) · `scripts/ops` 진입점이 바뀌었으면 `deno check --no-lock --config supabase/functions/deno.json <진입점들>` · Python 시험 그대로(122건)
- 실제 LLM 호출 0회

## 산출

1. 입력 조립의 `deleted_at` 처리 — 이미 있었음(위치) / 고침(diff 요약), 시험
2. 발행 재확인 변경 diff 요약, jest 시험
3. 원격 실증 출력(그대로) — 쓴 시험 호·사진 ID, RPC 호출 결과, 발행 명령 결과, 코너·`issues` 세 필드 전후
4. 내부 결정 목록

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
