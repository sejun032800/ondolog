# 위임 프롬프트 — 마이그레이션 023 · 본인 기록 삭제 RPC (`57-` A)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/57-db-architect-delete-rpc.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
> 기준선: MASTER r68 · ROADMAP r30 · `56-` 커밋됨 · 원격에는 022까지 적용됨

---

## 목표 (PM)

**본인이 올린 사진·메모만 지우는 security definer RPC를 마이그레이션 023으로 만든다.** (ROADMAP R30-1)
이번 위임은 **파일을 쓰는 데까지**다. 원격 적용은 사람이 하고(절대 규칙 6), 실증은 적용 뒤 메인 세션이 한다.

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_MASTER.md` **9-4**(수동 업로드 · 본인 기록 삭제, r68) · **17-0-10-D**
- `docs/ONDOLOG_ROADMAP.md` 결정 **R30-1 · R21-2 · R13-7**
- `docs/ONDOLOG_SCHEMA.md` — `data_entries` · `dates` · §10 RLS(`is_couple_member`, SELECT 정책의 `deleted_at is null`) · §9-D(022 함수의 security definer·`search_path` 작성 방식) · §9-D-10(타입 재생성 기준)

## 범위

| # | 할 일 |
|---|---|
| 1 | **`fn_delete_own_entry(p_entry_id uuid)`** — `security definer`, `search_path` 고정. 호출자(`auth.uid()`)가 그 항목의 `author_id`이고 `is_couple_member(couple_id)`일 때만 `deleted_at = now()`. 아니면 예외 — **무엇이 틀렸는지 구분되는 메시지**(없는 항목 / 작성자 아님 / 커플 아님 / 비로그인). **이미 지운 항목은 아무 일도 하지 않는다**(멱등). `anon`·`public` 실행 권한 회수, `authenticated`만 |
| 2 | 같은 함수 안에서 그 항목이 붙은 데이트의 파생 칸(`photo_count`·`has_user_note`·`duration_minutes`)을 **남은 항목 기준으로** 다시 맞춘다. 사진이 0장이 된 데이트도 **지우지 않는다** — 데이트 삭제는 범위 밖 |
| 3 | **RLS·정책은 바꾸지 않는다.** SELECT 정책(`deleted_at is null`)이 지운 항목을 숨기는 것이 맞는 동작이다. DELETE 정책을 만들지 않는다(소프트 삭제). 저장소 원본 파일은 지우지 않는다 |
| 4 | **마이그레이션 파일**(`supabase/migrations/`의 다음 번호 023 — 이름은 기존 규칙대로) + **SCHEMA에 들어갈 물리 명세 초안**(PM이 SCHEMA에 옮긴다 — `docs/`는 고치지 않는다. 초안은 HANDOFF 새 섹션이나 보고에 둔다) |
| 5 | **실증 스크립트 — 쓰기만 하고 실행하지 않는다.** 적용 뒤 메인 세션이 돌린다. 원격 **개발** 프로젝트, 시험 데이터 이름에 `test`(R13-7). 사용자 세션으로 RPC를 부른다(service_role로 부르면 작성자 확인을 증명하지 못한다). 다섯 경우: ① A가 자기 사진 삭제 → 성공 · 파생 칸 갱신 · A·B 모두 조회에서 사라짐 ② A가 B의 사진 삭제 → 거부 · 행 변화 없음 ③ 다른 커플의 항목 → 거부 · 행 변화 없음 ④ 같은 항목 두 번 → 두 번째는 변화 없음 ⑤ 비로그인 → 거부. **출력 원문을 파일로 남기게** 쓴다 |
| 6 | **권한 확인 쿼리** — `has_function_privilege`로 `anon` 불가 · `authenticated` 가능, `prosecdef = true`, `proconfig`의 `search_path`. 실행 방법은 022 실증(`scripts/db/verify_022_*`)과 같은 방식으로 |

**함수 본문이 작성자·커플을 반드시 확인한다.** 이 함수는 RLS를 우회하는 것이 목적이 아니라, 정책으로 표현할 수 없는 "작성자 본인의 소프트 삭제"를 함수 안의 확인으로 하는 것이다.

## 범위 밖

데이트 자체 삭제 · 저장소 원본 파일 삭제 · RLS 정책 변경 · 다른 테이블 변경 · 앱 코드 · 입력 조립·발행 경로(`57-` B) · `src/types/database.ts` 재생성(적용 뒤 별도)

## 하지 말 것

- **원격 DB에 DDL·DML을 실행하는 것** — 마이그레이션 적용(`db push` 등)과 실증 스크립트 실행을 포함한다. 절대 규칙 6
- 기존 마이그레이션 파일을 고치는 것
- `docs/`, `src/types/database.ts`, 설정 파일 수정, 의존성 추가
- 문서에 없는 값을 지어내는 것 — **멈추고 보고**
- 커밋·푸시

## 게이트

- `npx tsc --noEmit -p .` 0 · `npx tsc --noEmit -p supabase/functions/tsconfig.json` 0
- jest 전부 통과(마지막 요약 줄 그대로, 기준선 1185 · 59)

## 산출 — 완료 보고에 붙인다

1. 마이그레이션 파일 경로와 **전문**
2. SCHEMA 물리 명세 초안(위치)
3. 실증 스크립트·권한 확인 쿼리 경로, 실행 방법(022와 같은 방식인지)
4. 사람이 적용할 때 쓸 명령 — **022를 적용할 때 쓴 명령을 저장소 기록(HANDOFF·PROGRESS·`scripts/`)에서 찾아 그대로** 적는다. 찾지 못하면 "못 찾음"으로 적는다(지어내지 않는다)
5. 적용 전 확인 — 원격에 같은 이름의 함수가 이미 있는지 볼 읽기 전용 쿼리(실행은 메인 세션)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정(파일명·예외 메시지 문구·파생 칸 계산 방식 등)은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
