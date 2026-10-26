# 위임 프롬프트 — 마이그레이션 026 · 커플 연결 함수 + `couples` 직접 쓰기 회수 (`66-` 1부)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/66-db-architect-couple-connect.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
> 기준선: ROADMAP r40 · SCHEMA §9-F · 025 적용·커밋됨 · `65-` 커밋됨 · jest 1551 · 85 · Python 122

---

## 목표 (PM)

**초대 코드를 받은 사람이 사용자 권한으로 커플 연결을 할 수 있고, 어떤 클라이언트도 연결 칸을 직접 쓸 수 없다.** (ROADMAP R40-2 · R40-3)
이번 위임은 **조사 → (필요하면 멈춤) → 파일 작성**까지다. 원격 적용은 사람이 하고(절대 규칙 6), 실증은 적용 뒤에 한다.

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_SCHEMA.md` **§9-F**(이 작업의 규격 — 그대로 따른다) · §10-0(함수 실행 권한) · §10 `couples` 정책 · §9-E(023 관례) · §10-7(024 칸 단위 권한 관례)
- `docs/ONDOLOG_ROADMAP.md` 결정 **R40-2 · R40-3 · R40-5 · R33-1 · R34-4**
- 마이그레이션 `012_rls_policies`(couples 정책) · `023` · `024` · `025`

## 범위

| # | 할 일 |
|---|---|
| 1 | **앱이 `couples`에 쓰는 칸 목록**(읽기 전용 조사) — `src/` · `app/`에서 `couples`를 `.update(` · `.insert(` · `.upsert(`하는 곳 전부를 파일 · 줄 · 칸으로. 검색은 쓰기 호출 줄로 좁힌다 |
| 2 | **멈춤 조건** — 1에서 앱이 **연결 칸 7개**(`user_a_id` · `user_b_id` · `status` · `connected_at` · `dissolved_at` · `invite_code` · `subscription_tier`) 중 하나라도 **UPDATE**하는 곳이 나오면(예: 해체 요청이 `status`를 직접 쓰거나, 코드 재발급이 `invite_code`를 직접 씀) **마이그레이션을 쓰기 전에 멈추고 목록을 보고한다.** INSERT가 §9-F의 `with check`(`user_b_id is null` · `status = 'pending'` · `subscription_tier = 'free'`)와 어긋나게 쓰는 곳도 같다 |
| 3 | **보안 점검 기준선** — 지금 경고 목록을 **원문 JSON**으로 `scripts/ops/out/`에 남긴다(R34-4). 원격 읽기 전용 |
| 4 | **026 작성**(파일 이름 ASCII) — §9-F 그대로: ① 연결 함수(이름은 내부 결정, `security definer` · `set search_path = ''` · 본문 테이블 `public.` 접두사, §9-F 확인 순서 · 직렬화 · 동작 · 반환 · 멱등 그대로) ② 실행 권한: `public` · `anon` · `service_role` 회수, `authenticated`만 ③ `couples` UPDATE를 `anon` · `authenticated`에서 테이블 단위로 회수 → 1의 목록에 있는 칸만 `authenticated`에 칸 단위 부여. **목록을 마이그레이션 주석에** ④ `couples_update` 정책의 `(user_b_id is null and status = 'pending')` 가지 삭제 ⑤ `couples_insert` 정책 `with check`에 `user_b_id is null and status = 'pending' and subscription_tier = 'free'` 추가 ⑥ RLS가 그대로 켜져 있음을 주석으로 |
| 5 | **만료 조건** — `couples.invite_expires_at`은 nullable이다. null을 "만료 없음"으로 볼지 "무효"로 볼지 **지금 앱의 발급 코드가 이 칸을 채우는지 보고** 정하고(내부 결정), 근거를 보고에 한 줄 |
| 6 | **적용 전 확인 SQL · 권한 확인 SQL · 026 실증 스크립트** 작성 — **실행하지 않는다**. 실증은 아래 표. 사람이 적용할 명령은 023~025와 같은 순서(연결 확인 → `npx supabase migration list` → `npx supabase db push --dry-run` → `npx supabase db push`) |
| 7 | 로컬 확인 — 023~025 때 쓴 방법 그대로 마이그레이션 문법을 확인하고 쓴 명령을 보고. 원격에는 쓰지 않는다 |

**바꾸지 않는 것**: `couples` 외 테이블 · 다른 정책 · 024 `issues` 칸 권한 · 025 함수 권한(새 함수 한 줄 추가 외) · `magazine_theme`(M4-5 그대로, 알려진 구멍) · SELECT 정책(넓히지 않는다)

### 2부 026 실증 스크립트가 다룰 경우 (적용 뒤, **사용자 세션** — R40-5)

| # | 경우 | 기대 |
|---|---|---|
| ① | 새 시험 계정 A가 초대 발급(앱과 같은 INSERT) → B가 함수 호출 | `active` · `connected_at` 찍힘 · 반환 = 커플 id |
| ② | B가 미리 자기 대기 초대를 발급해 둔 상태에서 ① | **B의 그 대기 행 삭제** |
| ③ | 같은 B가 같은 코드로 다시 호출(응답 끊김 재시도) | 같은 id, 오류 없음 |
| ④ | A가 자기 코드로 호출 | `22023` |
| ⑤ | 없는 코드 · 만료된 코드 · 이미 쓴 코드 | **셋 다 같은 `P0002`**(메시지도 같음) |
| ⑥ | 이미 `active` 커플인 C가 남의 코드로 호출 / 이미 커플인 사람이 발급한 코드를 호출 | `23505` |
| ⑦ | A가 자기 커플 행의 `user_b_id` · `status` · `subscription_tier`를 직접 UPDATE | 거부 |
| ⑧ | `user_b_id`를 채운 · `status = 'active'` · `subscription_tier`가 `free`가 아닌 INSERT | 각각 거부 |
| ⑨ | 앱이 쓰는 칸(1의 목록) UPDATE — 사귄 날짜 · 닉네임 등 | 그대로 동작 |
| ⑩ | 권한: `has_function_privilege` — anon false · authenticated true · service_role false. `prosecdef` true · `proconfig`의 `search_path` 고정 | |
| ⑪ | RLS 회귀 — 사용자 권한으로 채팅 · 피드 읽기 각 1회, 구성원 아닌 계정의 커플 행 읽기 0 | 이전과 같음 |
| ⑫ | 보안 점검 다시 — 3의 기준선과 **비교표**(원문 JSON 저장) | 새 경고 0 |

- ⑤의 "만료된 코드"를 만들 때만 시험 행의 `invite_expires_at`을 `service_role`로 과거로 바꿔도 된다(그 밖의 준비는 사용자 세션). 시험 데이터 이름에 `test`
- 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 멈추고, null을 다룬다(R40-5)
- 출력 원문을 `scripts/ops/out/`에 파일로. **키 · 토큰 · URL을 남기지 않는다.** Deno는 `--no-lock`
- 사람이 PowerShell에서 바로 돌릴 **명령 한 줄**을 보고에 적는다(키 값 없이 환경변수만)

## 범위 밖

앱 코드 변경(같은 `66-`의 `ui-builder`가 한다) · 초대 코드 입력 횟수 제한(M4) · `magazine_theme` 잠금(M4-5) · 해체 흐름 변경

## 하지 말 것

- **원격 DB에 DDL · DML을 실행하는 것** — 마이그레이션 적용과 실증 실행을 포함한다(절대 규칙 6). 원격은 1 · 3 · 6의 **읽기 전용 조회**만
- 기존 마이그레이션 파일을 고치는 것
- `docs/`, `src/types/database.ts`, 설정 파일 수정, 의존성 추가
- 파괴적 배치 함수(`execute_dissolution` · `apply_retention_policy`)를 부르는 것(R34-3)
- 커밋 · 푸시

## 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로)

## 산출 — 완료 보고에 붙인다

1. **앱이 `couples`에 쓰는 칸 목록**(파일 · 줄 · 칸, UPDATE와 INSERT를 나눠서)
2. 멈춤 — 없음 / 있음(목록과 이유)
3. 보안 점검 기준선 파일 경로와 경고 요약
4. (멈추지 않았으면) 026 경로와 **전문**, 함수 이름, 만료 조건(5)의 결정과 근거
5. 확인 SQL · 실증 스크립트 경로와 사람이 돌릴 명령 한 줄, 사람이 쓸 적용 명령
6. **타입 재생성에서 추가될 것**(예상: 함수 1개) — 그 밖의 diff가 예상되면 이유
7. SCHEMA에 옮길 물리 명세 초안(위치)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
