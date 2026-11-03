# 위임 프롬프트 — 해제 배치 결함 수정 (`71-`, 마이그레이션 030)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/71-db-architect-dissolution-batch-030.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-03 (PM 지시 `71-`)
> 기준선: ROADMAP r53 · SCHEMA §11-3 030 주석 · jest 1686 · 95 · Python 277
> **1부만 한다.** 원격 적용 · 원격 조회 없음. 끝나면 멈춘다.

---

## 목표 (PM)

**해제를 요청한 사람이 생체 동의를 했든 안 했든, 7일 유예가 끝나면 그 사람의 파생 데이터가 정해진 날 지워진다. 한 건이 실패해도 그날의 다른 해제는 실행되고, 실패는 기록에 남는다.** (ROADMAP R53-3 · R53-4 · R53-5, MASTER 9-6)

**원본 (직접 읽는다)**
- `docs/ONDOLOG_ROADMAP.md` 결정 **R34-3 · R45-2 · R47-2 · R53-3~5**
- `docs/ONDOLOG_SCHEMA.md` **§11-3**(030 주석 포함) · **§11-4** · **§9-D-5 `ops_alerts`**
- `supabase/migrations/003_profiles.sql:40-42`(`chk_biometric_revoke_order`) · `013_batch_functions.sql:114-167` · `014_cron.sql:14-18` · `025_function_execute_grants.sql:25-26`
- 원격 진단 결과: `11-03 05:00:00Z failed · new row for relation "profiles" violates check …`. 그날 대상은 1건이고, 그 개시자는 생체 동의 시각과 철회 시각이 모두 비어 있었다(1 / 1)

## 1. 할 일

| # | 할 일 |
|---|---|
| ① | **`execute_dissolution` 재정의**(030). 개시자의 `biometric_consent_revoked_at`은 **`biometric_consent_at is not null`일 때만** `coalesce(biometric_consent_revoked_at, now())`로 채운다. 동의 시각이 없으면 철회 시각도 null로 둔다. `reference_photo_path = null`은 **조건 없이** 그대로 둔다. 나머지 본문은 한 글자도 바꾸지 않는다(파생 데이터 4종 삭제 · 양쪽 이탈 판정 · `dissolved` · `executed_at`). `security definer` · `set search_path = public` · 실행 권한(025 분류 — 배치 전용, 모두 회수)도 그대로 둔다 |
| ② | **cron 문장 교체.** `execute-dissolutions`가 대상을 **한 건씩** 처리하게 한다. 각 건은 `begin … exception when others` 로 감싸, 한 건이 실패해도 다음 건으로 넘어간다. 실패는 `ops_alerts`에 한 행으로 남긴다(§1-1). 예약 시각 `0 5 * * *`과 작업 이름은 그대로 둔다. 반복문을 **`DO` 블록으로 cron 명령에 넣을지, 배치 전용 래퍼 함수로 만들지**는 판단해서 보고한다. 래퍼를 만들면 025 분류로 `public` · `anon` · `authenticated` · `service_role` 실행 권한을 모두 회수한다. **판단 기준 하나**: ④(c)를 **cron이 실제로 실행하는 코드 그대로** 로컬에서 시험할 수 있어야 한다 |
| ③ | **SCHEMA 고친 판.** §11-3 · §11-4 본문(그리고 ②로 바뀌면 §9-D-5)을 030 정의로 고친 판을 **보고에 붙인다.** `docs/`는 직접 고치지 않는다 — PM이 반영한다 |
| ④ | **로컬 PGlite 시험**(R53-4 — 배치 함수를 실제 데이터 모양으로 돌린다). (a) 생체 동의 없는 개시자: 실행 성공 · 개시자 파생 행 4종 삭제 · 상대 행 유지 · `status = dissolved` · `executed_at` 채워짐 · 철회 시각 null (b) 생체 동의 있는 개시자: 철회 시각 채워짐 · 대표사진 경로 null (c) **대상 두 건 중 한 건이 실패하도록** 만들어, 나머지 한 건은 실행되고 실패 건은 `executed_at`이 비어 있으며 `ops_alerts`에 한 행이 남는지 확인한다(실패를 일으키는 방법은 시험 안에서만 쓰는 장치로 — 보고에 적는다) (d) 기존 해제 · 탈퇴 단언 회귀. 기존 마이그레이션 PGlite 시험과 같은 방식으로, 001~030을 순서대로 적용한 DB에서 돌린다 |
| ⑤ | **cron 실패 점검**(R53-5, 읽기 전용). `scripts/db/` 아래 ASCII 이름의 `.sql` 하나를 만든다. 내용: 최근 7일 `cron.job_run_details`에서 `status = 'failed'`인 행의 작업 이름 · 시작 시각 · 메시지 앞 120자, 그리고 작업마다 마지막 성공 시각. **SELECT만** 쓴다. 키 · URL · ref · 개인 정보는 출력하지 않는다. `scripts/db/diag_dissolution_cron.sql`과 같은 형식으로, 사람이 SQL Editor에 붙여 실행한다 |
| ⑥ | 파일 이름은 ASCII로 한다. **적용된 마이그레이션 001~029의 diff는 0**(R45-2). 사람이 돌릴 파일에 `db push` · `migration up/repair`를 넣지 않는다(R47-2) |

### 1-1. `ops_alerts`에 남기는 실패 — PE가 확인한 사실 두 가지

- **`kind`에 check 제약이 있다.** §9-D-5: `kind in ('couple_membership', 'usage_over')`. 해제 실패를 남기려면 030에서 **새 값 하나를 더하는 제약 교체가 필요하다.** 원격의 실제 제약 이름은 그 테이블을 만든 마이그레이션 파일에서 확인한다(추측하지 않는다). 새 값의 이름은 판단해서 보고한다
- **`detail`은 "ID만 담는다"**(컬럼 주석). 그러니 해제 id · SQLSTATE · 제약 이름(`GET STACKED DIAGNOSTICS … CONSTRAINT_NAME`)과 `SQLERRM` 앞부분만 넣는다. **`PG_EXCEPTION_DETAIL`은 넣지 않는다** — check 위반의 DETAIL에는 "Failing row contains (…)"로 그 행의 값 전체가 담긴다. `couple_id` 컬럼은 채운다(FK는 `on delete cascade`)

### 1-2. 멈춤 조건 — 고치지 말고 그 지점에서 보고

- ①을 하려면 본문의 다른 줄도 바꿔야 하는 경우
- `ops_alerts` 제약을 교체하면 기존 행이나 기존 함수(`fn_publish_issue` 등)의 동작이 바뀌는 경우
- cron 작업을 교체할 때, 같은 이름의 작업이 둘 이상 생기거나 기존 작업이 남을 수 있는 경우 — 저장소의 014에서 쓴 방식과 맞춘다
- 로컬 시험이 기존 시험의 단언을 고쳐야만 통과하는 경우

## 2. 범위 밖

원격 적용 · 원격 조회 · `execute_dissolution` · `apply_retention_policy`를 원격에서 호출하는 것(R34-3) · `apply_retention_policy` 수정 · 앱(`src/` · `app/`) · `docs/` 수정 · 새 의존성 · 실제 LLM 호출

## 3. 지켜야 할 것

- **CLAUDE.md 절대 규칙 8개 그대로.** 커밋 · 푸시 · `db push`는 사람이 한다
- 데이터 · 정의는 마이그레이션에 둔다(시드 파일 아님). 정적 검사 시험은 만들지 않는다(R32-3)
- 프로젝트 ref를 파일 · 출력 · 보고에 내지 않는다(R41-6)

## 4. 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로) · Python 277 그대로
- **새 시험**: ④ (a)(b)(c)(d). (c)는 cron이 실제로 실행하는 코드를 그대로 돌린다
- 타입 재생성 "추가될 것": 래퍼 함수를 만들면 그 함수만, 아니면 없음
- 원격 적용 0

## 5. 산출 — 완료 보고에 붙인다

1. 030 파일 경로와 바뀐 정의(①의 바뀐 줄 이전 → 이후)
2. ② 선택(DO 블록 / 래퍼)과 그 근거 · cron 교체 방식 · `ops_alerts` 새 `kind` 값과 제약 교체 방식
3. ③ SCHEMA §11-3 · §11-4 · §9-D-5 고친 판(전문)
4. ④ 시험 목록 · 실패를 일으킨 장치
5. ⑤ 점검 SQL 경로 · 출력 열
6. 2부에서 확인할 것: 함수와 래퍼의 실행 권한 기대값, cron 작업 지문 기대값
7. 내부 결정 목록

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄
