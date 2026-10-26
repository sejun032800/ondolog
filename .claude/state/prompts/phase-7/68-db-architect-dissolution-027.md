# 위임 프롬프트 — 조사 + 마이그레이션 027 (해제 · 탈퇴 · 재검사 함수 · 칸 단위 쓰기) (`68-` 1부)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/68-db-architect-dissolution-027.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
> 기준선: ROADMAP r43 · SCHEMA §9-G · 026 적용 · `67-` 커밋됨 · jest 1626 · 90 · Python 122

---

## 목표 (PM)

**연결 해제 · 회원 탈퇴 · 재검사가 서버 함수로만 일어나고, 7일 유예는 서버가 정하며, 클라이언트는 `profiles` · `personality_profiles` · `couple_dissolutions`의 위험한 칸을 직접 쓸 수 없다.** (ROADMAP R42-6 · R43-2~7)
이번 위임은 **조사 → (필요하면 멈춤) → 파일 작성**까지다. 원격 적용은 사람이 하고(절대 규칙 6), 실증은 적용 뒤 사람이 실행한다(R42-4).

**되돌릴 수 없는 길을 다룬다.** 파괴적 배치 함수(`execute_dissolution` · `apply_retention_policy`)는 **어떤 경로로도 부르지 않는다**(R34-3). 권한은 `has_function_privilege`로만 본다.

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_SCHEMA.md` **§9-G**(이 작업의 규격 — 그대로 따른다) · §10-0 · **§11-3**(`execute_dissolution`) · §9-F(026 관례) · 4-2(`personality_profiles`)
- `docs/ONDOLOG_MASTER.md` 9-6(해제 · 탈퇴 · 재검사) · 6-4(생체정보)
- `docs/ONDOLOG_ROADMAP.md` 결정 **R34-3 · R34-4 · R38-3 · R41-1 · R41-6 · R42-4 · R42-6 · R43-1~9**
- 마이그레이션 `004` · `012` · `021` · `023`~`026`

## 0. 읽기 전용 조사 — 먼저, 결과를 보고 첫머리에

| # | 확인할 것 | 결과에 따라 |
|---|---|---|
| a | **생체정보 동의를 받는 길** — `biometric-consent` · `reference-photo` 화면으로 가는 진입점(라우터 호출 · 링크 · 딥링크)이 지금 앱에서 닿는가. 파일 · 줄 | 보고만. 닿으면 ui-builder가 진입점을 숨긴다 |
| b | **생성 파이프라인이 MBTI를 어느 칸에서 읽는가**(`profiles.mbti` / assessment) — `supabase/functions` · `render` · `scripts/ops` | 보고만 |
| c | **입력 조립 · 운영자 스크립트(생성 · 발행)가 `couples.status = 'active'`만 대상으로 삼는가** — 파일 · 줄 | 보고만. 아니면 corner-pipeline이 막는다 |
| d | **앱이 `profiles` · `personality_profiles`에 UPDATE · INSERT하는 칸 전부**, **`couple_dissolutions`에 쓰는 곳 전부**(`src/` · `app/`, 쓰기 호출 줄로 좁혀서) — 파일 · 줄 · 칸 | 027 칸 단위 부여 목록이 된다 |
| e | **`scripts/ops`가 `profiles.onboarding_step`을 더 작은 값으로 쓰는 곳**(시험 데이터 준비 등) | 보고만. 027 트리거는 모든 역할에 걸리므로 그 스크립트가 깨질 수 있다 |

**멈춤 조건(R41-1)** — d에서 **이 지시서가 바꾸라고 지정한 경로(해제 · 탈퇴 · 재검사) 말고** 아래 칸을 쓰는 앱 코드가 나오면 027을 쓰기 전에 멈추고 목록을 보고한다: `deleted_at` · `purge_scheduled_at` · `terms_agreed_at` · `privacy_agreed_at` · `ai_usage_agreed_at` · `birth_date`(가입 INSERT는 제외 — UPDATE만) · `retest_used` · `active_assessment_id` · `enneagram_inferred` · `attachment` · `couple_dissolutions`의 모든 칸.

## 1. 보안 점검 기준선

지금 경고 목록을 **원문 JSON**으로 `scripts/ops/out/`에 남긴다(R34-4). 원격 읽기 전용.

## 2. 027 작성 — SCHEMA §9-G 그대로 (파일 이름 ASCII)

| # | 내용 |
|---|---|
| ① | **함수 다섯** — 해제 요청 · 해제 취소 · 탈퇴 요청 · 탈퇴 취소 · 재검사 완료. 이름은 내부 결정. 모두 `security definer` · `set search_path = ''` · 본문 `public.` 접두사. §9-G 표의 확인 순서 · 오류 코드 · 멱등 · 반환 그대로. **유예 7일은 서버가 `now() + interval '7 days'`로 정한다.** 탈퇴의 해제 사유는 **기존 enum의 탈퇴 값**(없으면 멈추고 보고 — enum을 새로 바꾸지 않는다) |
| ② | 재검사 완료 — 채점 결과는 인자로 받는다(결정론 엔진, 절대 규칙 2). 한 트랜잭션: `retest_used = false` 잠금 확인(아니면 `23505` "retest already used") → `seq = 2` INSERT → `personality_profiles` 갱신(오버라이드 null · `retest_used = true` · `love_type_code` 포함) → **`profiles.mbti`도 새 값으로**(R43-3). **이미 `seq = 2`가 있고 `retest_used = false`면 그 행으로 마저 끝낸다** — 이때 인자로 온 결과가 아니라 **기존 `seq = 2` 행의 값**으로 끝낸다(검사는 이미 1회 끝났다). 어느 쪽으로 끝냈는지 반환값이나 오류 없이 구분할 수 있게 하고 보고 |
| ③ | 실행 권한: `public` · `anon` · `service_role` 회수, `authenticated`만(§10-0) |
| ④ | `couple_dissolutions` — INSERT · UPDATE 정책 삭제, `anon` · `authenticated`의 INSERT · UPDATE · DELETE 권한 회수. SELECT 그대로 |
| ⑤ | `profiles` UPDATE — `anon` · `authenticated`에서 테이블 단위 회수 → 0-d 목록의 칸만 `authenticated`에 칸 단위 부여(**`marketing_agreed_at` 포함**). `deleted_at` · `purge_scheduled_at` · 동의 시각 3칸 · `birth_date`는 부여하지 않는다. **목록을 마이그레이션 주석에** |
| ⑥ | `profiles.onboarding_step` 감소 거부 — BEFORE UPDATE 트리거(`22023`). 트리거 함수는 §10-0 "트리거 전용"(실행 권한 모두 회수) |
| ⑦ | `profiles` INSERT `with check`에 `deleted_at is null and purge_scheduled_at is null` 추가 |
| ⑧ | `personality_profiles` UPDATE — 테이블 단위 회수 → 오버라이드 경로의 칸만(`enneagram_override` · `override_updated_at` · `override_count` · `love_type_code` — 0-d 목록과 대조). INSERT `with check`에 `retest_used = false` 추가 |
| ⑨ | `service_role`의 테이블 권한은 건드리지 않는다(운영자 스크립트) |
| ⑩ | RLS가 그대로 켜져 있음을 주석으로 |

**바꾸지 않는 것**: `execute_dissolution` · `apply_retention_policy` 본문 · pg_cron 작업 · 다른 테이블 · 024 · 025 · 026 권한(새 함수 줄 추가 외) · SELECT 정책.

**본문 대조(보고)** — 새 해제 요청 함수가 만든 `couple_dissolutions` 행(`purge_scheduled_at` · `initiated_by` · 사유 · `cancelled_at`)을 **기존 `execute_dissolution`이 그대로 집어 처리하는지** 본문을 읽고 대조한다(실행하지 않는다). 탈퇴로 생긴 해제도 같은지. 어긋나면 고치지 말고 보고.

## 3. 확인 SQL · 실증 스크립트 — 작성만, 실행하지 않는다

| 파일 | 내용 |
|---|---|
| 적용 전 확인 SQL | 읽기 전용. 026 때와 같은 형식 |
| 권한 확인 SQL | 함수 다섯의 `has_function_privilege`(anon false · authenticated true · service_role false) · `prosecdef` · `proconfig` · 트리거 함수 실행 권한 0 · `profiles` · `personality_profiles` · `couple_dissolutions` 칸 · 테이블 권한 · 정책 |
| **027 실증 스크립트** | SCHEMA §9-G "실증" 목록 전부, **사용자 세션**, 새 시험 계정 `test-68-*`. 앞 단계 실패 시 그 단계에 기대는 뒤 단계는 멈추고 null을 다룬다(R40-5). **끝에서 모든 해제 · 탈퇴를 취소한다 — 단 `test-68-purge` 커플 하나는 해제 요청을 남겨 둔다.** 그 커플의 `purge_scheduled_at`(서버 값)과 **확인 스크립트를 돌릴 날짜**(유예 끝 다음 pg_cron 실행 시각 — cron 표현식을 카탈로그에서 읽어 계산)를 출력한다. 보안 점검은 원문 JSON으로 저장하고 기준선과 비교(기대: `authenticated_security_definer_function`이 함수 다섯만큼 증가, 그 밖은 그대로) |
| **`test-68-purge` 확인 스크립트** | **읽기 전용.** 해제가 실행됐는지(`executed_at`) · `couples.status = 'dissolved'` · 개시자 파생 행 삭제 · 상대 행 유지를 §11-3 본문 기준으로 본다. 배치가 아직 안 돌았으면 "아직"을 출력하고 끝낸다. 아무것도 쓰지 않는다 |

공통: 출력은 `scripts/ops/out/`에 파일로, **키 · 토큰 · URL · 프로젝트 ref를 남기지 않는다**(R41-6 — 코드에도 ref 자리표시자). 시험 데이터 이름에 `test`. Deno는 `--no-lock`. 사람이 PowerShell에서 바로 돌릴 **명령 한 줄씩**을 보고에(ref는 `supabase/.temp/project-ref`에서 읽는 형태).

## 범위 밖

앱 코드(ui-builder) · 운영자 스크립트의 `active` 한정(corner-pipeline) · 탈퇴 계정 · Storage 최종 파기 배치(R43-9, M4-1) · 푸시 통보 · `execute_dissolution` 본문 변경

## 하지 말 것

- **원격 DB에 DDL · DML을 실행하는 것** — 적용 · 실증 실행 포함(절대 규칙 6). 원격은 0 · 1 · 적용 전 확인의 **읽기 전용 조회**만
- **파괴적 배치 함수를 부르는 것**(R34-3)
- 기존 마이그레이션 파일 수정 · `docs/` · `src/types/database.ts` · 설정 파일 수정 · 의존성 추가
- 커밋 · 푸시

## 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로) · 마이그레이션 로컬 문법 확인(023~026 때 쓴 방법, 명령 보고)

## 산출 — 완료 보고에 붙인다

1. **0 조사 a~e 결과**(파일 · 줄)
2. 멈춤 — 없음 / 있음(목록)
3. 보안 점검 기준선 파일 · 요약
4. (멈추지 않았으면) 027 경로 · **전문** · 함수 다섯 이름 · 탈퇴 사유 enum 값 · 칸 단위 부여 목록 · 재검사 복구 경로가 어떻게 구분되는지
5. **`execute_dissolution` 본문 대조 결과**
6. 확인 SQL · 실증 스크립트 · 확인 스크립트 경로, 사람이 돌릴 명령 한 줄씩, 적용 명령 순서
7. **타입 재생성에서 추가될 것**(기대: 함수 5개) — 그 밖의 diff가 예상되면 이유
8. SCHEMA에 옮길 물리 명세 초안(위치)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
