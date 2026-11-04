# PM 지시 — `71c-` `71b-` 마무리 · `demo_responses` 기록 편입 · 보존 시험 · 타입 · 2026-11-04

> 받는 사람: PE. `71b-` 보고 + `demo_responses` 덧붙임에 대한 PM 결정(§1)과 다음 지시서다. **원격 쓰기 0**(원격 읽기만 — R53-6, Proteur 지시로 메인 세션).
> 기준: **ROADMAP `2026-11-04-r56`**(R56-1~12), SCHEMA §9-H(r56 번호·경로 줄) · **§9-I**(`demo_responses`).
> **전제(절대): `demo_responses`의 데이터는 어떤 일이 있어도 지우거나 바꾸지 않는다**(R56-5).

## 1. 결정

| 안건 | 결정 |
|---|---|
| PGlite 자식 프로세스 | **R56-1. 받는다.** 조건: 실패·시간 초과·중단 때도 자식 프로세스가 남지 않음을 확인(§3 A-②) |
| (d) 정적 비교 단언 | **R56-2. 뺀다** — 33단언 · jest 1719 |
| 타입 인코딩 | **R56-3. 새 커밋으로 UTF-8 복구.** 기준은 `50f17f8^`과의 텍스트 diff. `--stat`에 `Bin`이 나오면 멈춘다 |
| 불안정 시험 | **R56-4. `72-`에서 원인부터** |
| `demo_responses` 처리 | **R56-6. A안** — 같은 버전 번호 · md5가 같은 파일을 저장소에 추가만. `repair`·원격 쓰기 0 |
| 번호 규칙 | **R56-7. 030 뒤로는 `YYYYMMDDHHMMSS_이름.sql`(UTC).** `031_…` 쓰지 않음, `--include-all` 쓰지 않음 |
| 원격 스키마 변경 경로 | **R56-8. 저장소 마이그레이션 → 사람의 `db push`만.** 다른 대화의 연결은 읽기만 |
| SCHEMA 기록 | **R56-9. §9-I로 반영했다.** `with check (true)` 경고는 의도된 기준선 |
| 타입 커밋 | **R56-10. 편입 파일과 같은 시점.** 기대값 = `run_due_dissolutions` 1줄 + `demo_responses` 블록 |
| 보존 장치 | **R56-5. 규칙 + 시험 + 사본 셋 다** |
| CLI | **R56-11. v2.121.0 그대로** |

## 2. 사전 점검

```powershell
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-04-r56'
npx supabase --version
```

CLI = 2.121.0. 기준선 jest 1720 · 96(커밋 전 `71b-` 작업 트리), tsc 0, Python 277. 적용된 마이그레이션 파일(001~030) diff 0.

## 3. 할 일

### A. `71b-` 마무리 (`db-architect`)

| # | 할 일 |
|---|---|
| ① | (d)의 013·030 파일 본문 비교 단언 삭제 → 33단언 |
| ② | **자식 프로세스 정리 확인** — 정상 종료 · 시험 실패 · 시간 초과 세 경로에서 `pgliteServer.mjs` 프로세스가 남지 않는다. 시간 초과 때 강제 종료 경로가 있다. 확인 방법(프로세스 목록 전후 비교)과 결과를 보고 |
| ③ | HANDOFF의 타입 재생성 명령을 R56-3 형태로 바꾸고, 그 아래 "`git diff --stat`에 `Bin`이 나오면 커밋하지 않는다" 한 줄 |

**→ 사람 커밋 ①** `71b-` 시험 · `verifyPurge68` · `pgliteMigrations.ts` · `pgliteServer.mjs` · HANDOFF (jest 1719, 이 시점에는 "마지막 적용 = 030"이 맞다)

### B. 확인 (메인 세션, 원격 읽기만)

| # | 할 일 |
|---|---|
| ① | Proteur가 보낸 확인 메시지 1~6 결과(원격 버전 `20261103142031`의 `name`·`statements` md5 · 권한 · 정책 · 보안 점검 결과 · 저장소 스크립트가 이 테이블을 읽기 외로 건드리는 곳 — 파일·줄). **6번에서 하나라도 나오면 멈추고 보고** |
| ② | `demo_responses` 행 수(숫자만) — 편입 전후 같은지 비교할 기준. 행 내용 출력 0 |

### C. 편입 (`db-architect`, B 통과 뒤)

| # | 할 일 |
|---|---|
| ① | `supabase/migrations/20261103142031_demo_responses_web_trial.sql` — 본문은 원격 `statements`를 그대로, **md5 일치**를 보고. 이름은 원격 `name`과 같게(다르면 원격 쪽을 따른다, 보고) |
| ② | **PGlite 하네스가 이 파일을 적용한다.** `anon` 역할 등 필요한 것은 시험 쪽 스텁으로만. 이 파일이 PGlite에서 안 돌면 본문을 고치지 말고 멈춰서 이유 보고 |
| ③ | `71b-` 시험의 "마지막 적용 = 030"을 **"적용 목록 = 저장소 마이그레이션 파일 전체(정렬 순서)"**로 고친다. 특정 번호를 박지 않는다 |
| ④ | **보존 시험**(R56-5 ④, 새 파일): 편입 파일까지 적용 → 행 몇 개 넣기(값 범위 안) → 그 뒤 파일 전부 적용 → **행 수 · 값 · 열 정의 · RLS 켜짐 · 정책 · anon insert만** 그대로. 지금은 뒤 파일이 0개라도 시험은 둔다 — 다음 마이그레이션부터 효과가 있다. 고의 실패 확인 한 번(임시로 `delete from demo_responses`를 뒤에 붙인 파일 → 실패 확인 → 지움) |
| ⑤ | 원격 쓰기 0 · `repair` 0 · `db reset` 0 · 사람이 돌릴 파일에 적용 명령 0(R47-2) |

### D. 사람 확인 (Proteur, 읽기 전용)

```powershell
npx supabase migration list
npx supabase db push --dry-run
```

- `migration list`: 001~030 + `20261103142031` 모두 로컬 = 원격.
- `--dry-run`: **적용할 것 없음.** 무엇이든 적용하겠다고 나오면 실제 `db push`는 하지 말고 출력을 PM에게. (이번 지시서에서 실제 `db push`는 없다.)

### E. 타입 (Proteur)

```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
npx supabase gen types typescript --linked | Out-File -Encoding utf8 src/types/database.ts
git diff --stat 50f17f8^ -- src/types/database.ts
```

- 텍스트 diff로 나오고(`Bin` 아님) **늘어난 것이 `run_due_dissolutions` 1줄 + `demo_responses` 블록뿐**(덧붙임 기준 약 103줄).
- 줄 끝 차이로 파일 전체가 바뀌거나, 다른 차이가 있으면 커밋하지 않고 PM에게.

## 4. 완료 기준

1. jest 1719 + 보존 시험(수 보고) · 실패 0 · tsc 0 · Python 277.
2. 편입 파일 md5 = 원격 `statements`.
3. 고의 실패 확인 두 번(A에서 이미 한 013식은 다시 안 함 — 보존 시험 하나).
4. `demo_responses` 행 수 편입 전 = 후(B-② 숫자).
5. D의 `--dry-run` "적용할 것 없음".

## 5. 커밋 (Proteur)

① A(`71b-` 마무리) — 지금 바로 가능 ② C 편입 파일 + 보존 시험 + "적용 목록" 수정 ③ `fix(types)` UTF-8 복구 + `run_due_dissolutions` + `demo_responses`. ②와 ③은 연달아(같은 날). 그 뒤 푸시.

## 6. Proteur에게 (지시서 밖)

- **사본**: `demo_responses`를 주 1회 CSV로 내려받아 **저장소 밖**에 보관(실사용자 응답이라 git에 넣지 않는다). 첫 사본은 이번 편입 전에.
- **다른 대화의 Supabase 연결**: 앞으로 이 프로젝트에는 읽기만(R56-8). 연결 설정에 읽기 전용 선택지가 있으면 켠다.
- **웹 체험판 수집 고지**: 페이지에 무엇을 모으는지(나이대·성별·MBTI·답·기기) 적혀 있는지 확인(ROADMAP §8, 지금).

## 7. 그다음

**`72-` 앱** — I01~I08 + H19 문의 최소판 + 쌓인 앱 손질(A14 "반영돼요" · H14/H16 "해제합니다"/"탈퇴합니다" · A18 자기 코드 · B01 해요체) + **`chatPhotoQueue` 불안정 원인**(R56-4). 다음 마이그레이션이 생기면 그 지시서가 첫 시각 형식 번호를 쓰고 `--dry-run`으로 "그 파일 하나"를 확인한다(R56-7).
