# 위임 프롬프트 — 마이그레이션 025 · DB 함수 실행 권한 최소화 (`60-` 1부)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/60-db-architect-function-grants.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
> 기준선: ROADMAP r33 · 024 적용·커밋됨 · jest 1288 · 64 · Python 122

---

## 목표 (PM)

**공개 anon 키로 배치용 definer 함수(`execute_dissolution`·`apply_retention_policy`·`expire_stories` 등)를 부를 수 없게 하고, 모든 함수의 실행 권한을 SCHEMA §10-0 분류대로 최소화한다.** 새 함수의 기본 권한도 회수한다. (ROADMAP R33-1 · R33-2 · §6 차단 조건)
이번 위임은 **분류표 → (필요하면 멈춤) → 파일 작성**까지다. 원격 적용은 사람이 하고(절대 규칙 6), 실증은 적용 뒤 메인 세션이 한다.

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_SCHEMA.md` **§10-0**(함수 실행 권한 원칙) · §9-E(023 `fn_delete_own_entry`) · §10-7(`issues_public`, 024) · §11(배치 함수·pg_cron) · §9-D(발행 경로 함수)
- `docs/ONDOLOG_ROADMAP.md` 결정 **R33-1~5 · R31-7 · R13-7**, §6 공개 배포 차단 조건

## 범위

| # | 할 일 |
|---|---|
| 1 | **보안 점검 기준선 저장**(R33-4) — 지금 경고 목록 **전체**를 파일로 남긴다(`scripts/ops/out/` 등 추적 안 하는 곳). 읽기 전용 |
| 2 | **원격 `public` 스키마 함수 전부의 분류표** — 열: 함수 이름(인자 포함) · definer/invoker · 지금의 `EXECUTE`(`public`/`anon`/`authenticated`/`service_role`) · **부르는 곳**(pg_cron 작업 · RLS 정책 본문 · 다른 함수 본문 · 앱 코드 · Edge Function · 운영자 명령 `scripts/ops`·`render`) · §10-0 분류 · 바꿀 권한. **부르는 곳은 코드 검색과 카탈로그(`cron.job`, `pg_policies`, 함수 본문)에서 찾아** 적는다. 원격은 읽기 전용 |
| 3 | **분류가 애매한 함수가 하나라도 있으면 마이그레이션을 쓰기 전에 멈추고 분류표를 보고한다.** 예: 앱도 부르고 배치도 부름 · 로그인 전 화면이 부름 · 부르는 곳을 못 찾음 · 트리거 함수인지 불분명. 모두 분명하면 4로 |
| 4 | **025 작성** — ① 분류대로 `revoke execute … from public, anon, authenticated` 후 필요한 역할에만 `grant` ② Edge Function·운영자 명령이 REST로 부르는 함수는 `service_role`에 **명시 부여** ③ `alter default privileges in schema public revoke execute on functions from public, anon, authenticated` — **어느 역할의 기본 권한에 걸리는지**(마이그레이션을 실행하는 역할, `for role` 필요 여부)를 확인해 보고 ④ `issues_public`: anon의 모든 권한, authenticated의 SELECT 외 권한 회수 ⑤ `search_path` 미고정 함수 3개(`tg_set_updated_at` 등 — 1의 기준선에서 이름 확정)에 `set search_path` ⑥ `fn_delete_own_entry` 본문의 테이블 이름에 `public.` 접두사 — **동작 변경 없음**, 정의만 다시 쓴다(권한 줄도 다시) |
| 5 | **적용 전 확인 SQL · 권한 확인 SQL · 실증 스크립트** 작성 — **실행하지 않는다**. 실증은 아래 2부 ①~⑨. 사람이 적용할 명령은 023·024와 같은 순서(연결 확인 → `migration list` → `--dry-run` → `db push`) |

**바꾸지 않는 것**: 정책·RLS · 테이블 권한(**024 열 권한 포함**) · 함수 동작(⑥ 접두사 정리 제외) · 확장 위치(R33-3)

### 2부 실증 스크립트가 다룰 경우 (적용 뒤 메인 세션이 실행)

| # | 경우 | 기대 |
|---|---|---|
| ① | anon 키로 배치 함수 셋(`expire_stories`·`apply_retention_policy`·`execute_dissolution`)을 `/rpc`로 호출 | 거부 · 데이터 변화 없음 |
| ② | 로그인한 시험 계정으로 같은 호출 | 거부 · 변화 없음 |
| ③ | pg_cron 작업 목록이 그대로이고, 배치 함수 하나를 소유자 권한으로 안전하게 실행(대상 0건인 `expire_stories`) | 성공 |
| ④ | **RLS 회귀** — 사용자 권한으로: `59-` B ①③④⑥, `57-` 본인 삭제 ①·상대 삭제 거부 ②, 채팅·피드 읽기 각 1회 | 이전과 같은 결과 |
| ⑤ | `fn_issue_progress`·`fn_delete_own_entry`가 authenticated로 동작, anon으로 거부 | 그대로 |
| ⑥ | 운영자 명령이 부르는 함수(발행 명령의 `fn_publish_issue` 등)가 service_role로 동작 — 생성은 dry, 발행은 거부 경로 등 **데이터를 바꾸지 않는 방식** | 그대로 |
| ⑦ | `issues_public`: anon SELECT 거부, authenticated INSERT 거부, authenticated SELECT 동작 | |
| ⑧ | 새 함수 기본 권한 — **임시 함수를 만들었다 지우는 방식은 쓰지 않는다.** `pg_default_acl`로 확인 | 회수됨 |
| ⑨ | 보안 점검 다시 — 1의 기준선과 **비교표** | definer 함수 anon 실행 경고 0 |

- **`execute_dissolution`은 어떤 권한으로도 실제 실행하지 않는다** — 거부 확인만. 배치 함수를 실제로 실행할 때는 **대상이 0건인 것만**
- 출력 원문을 파일로. **키·토큰·URL을 남기지 않는다.** 시험 데이터 이름에 `test`. Deno는 `--no-lock`

## 범위 밖

확장 이동(R33-3) · 정책·RLS 변경 · 함수 동작 변경(⑥ 제외) · 앱 화면 · 렌더

## 하지 말 것

- **원격 DB에 DDL·DML을 실행하는 것** — 마이그레이션 적용과 실증 실행을 포함한다(절대 규칙 6). 원격은 1·2의 **읽기 전용 조회**만
- 기존 마이그레이션 파일을 고치는 것
- `docs/`, `src/types/database.ts`, 설정 파일 수정, 의존성 추가
- 문서에 없는 분류를 지어내는 것 — **애매하면 멈추고 보고**
- 커밋·푸시

## 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로)

## 산출 — 완료 보고에 붙인다

1. 보안 점검 기준선 파일 경로와 경고 요약
2. **분류표 전체**(함수마다 한 줄)
3. 애매한 함수 — 없음 / 있음(멈춤, 목록과 이유)
4. (멈추지 않았으면) 마이그레이션 경로와 **전문**, 기본 권한 회수가 걸리는 역할
5. 확인 SQL · 실증 스크립트 경로와 실행 방법, 사람이 쓸 적용 명령
6. SCHEMA에 옮길 물리 명세 초안(위치)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
