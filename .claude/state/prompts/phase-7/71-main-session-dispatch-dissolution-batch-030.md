# 메인 세션 지시 — `71-` 해제 배치 결함 수정 (030)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/71-main-session-dispatch-dissolution-batch-030.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-03
>
> 짝: `71-db-architect-dissolution-batch-030.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 두 부분으로 나눕니다.

- **1부 (지금)**: 위임 → 검증 → 보고 → **멈춥니다.** 그다음 Proteur가 030을 적용합니다(`db push`는 사람만, R53-6).
- **2부 (다음 05:00 UTC 실행 뒤, Proteur가 알리면)**: 확인 → 보고. R53-6에 따라 Proteur가 지시하면 확인 스크립트는 메인 세션이 실행해도 됩니다. 그렇게 했으면 보고에 적습니다.

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-03-r53'
Select-String -Path docs/ONDOLOG_SCHEMA.md -SimpleMatch -Pattern '(030, ROADMAP R53-3)'
git ls-files scripts/db/diag_dissolution_cron.sql
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '71-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r53 · SCHEMA 030 주석 | 각 한 줄(R47-3). **없으면 멈춥니다** |
| 진단 SQL | 한 줄(커밋됨) |
| 위임 파일 | 두 줄 |

**기준선**: tsc 0 / 0, jest **1686 · 95**, Python **277**. 출력 전체를 `scripts/ops/out/71-*-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8).

## 1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/71-db-architect-dissolution-batch-030.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요.
1. execute_dissolution은 철회 시각 한 줄만 조건부로 — 나머지 본문·권한 그대로
2. cron은 한 건씩 예외 처리, 실패는 ops_alerts에(kind check 제약 교체 필요, detail은 ID·SQLSTATE·제약 이름·메시지 앞부분만, PG_EXCEPTION_DETAIL 금지)
3. 로컬 PGlite 시험 (a)~(d) — (c)는 cron이 실제로 실행하는 코드 그대로
4. 001~029 diff 0, 원격 적용·조회 0, docs/ 수정 0(SCHEMA 고친 판은 보고에)

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations docs src app package.json package-lock.json
git ls-files --others --exclude-standard
Get-ChildItem supabase/migrations, scripts/db -File | Where-Object { $_.Name -match '[^\x00-\x7F]' }
Select-String -Path scripts/db/*.sql -Pattern '\bdb\s+push\b|migration\s+(up|repair)'
```

- 셋째 · 다섯째 · 여섯째: **빈 출력**. 셋째는 이미 커밋된 마이그레이션(001~029)이 바뀌지 않았다는 뜻입니다. 030은 새 파일이라 넷째에 나옵니다
- 넷째: 새 파일은 030 · 점검 SQL · 시험 파일뿐이어야 합니다

| 확인 | 기대 |
|---|---|
| ① 재정의 | 030의 함수 본문을 013과 줄 단위로 대조합니다. **철회 시각 한 줄만** 조건부로 바뀌었고, `security definer` · `search_path` 그대로, 실행 권한 회수가 유지되는지 직접 봅니다 |
| ② cron | 한 건씩 예외 처리 · 예약 `0 5 * * *` · 작업 이름 그대로 · 같은 이름의 작업이 하나만 남는 방식 · 래퍼를 만들었으면 실행 권한 회수 |
| `ops_alerts` | `kind` 제약 교체가 기존 두 값을 유지하는지 · `detail`에 `PG_EXCEPTION_DETAIL`이 없는지 |
| ③ SCHEMA 고친 판 | 보고에 전문이 있는지 |
| ④ 시험 | (a)(b)(c)(d)가 있고 통과하는지 · (c)가 cron 실행 코드와 같은 코드를 돌리는지 직접 대조 |
| ⑤ 점검 SQL | SELECT만 있는지 · 출력 열에 키 · URL · ref · 개인 정보가 없는지 직접 읽고 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 277 — **메인 세션이 직접 다시 돌립니다.** 출력 전체를 `scripts/ops/out/71-*.txt`에 남깁니다 |

## 3. 1부 보고

```
## 사전 점검
- 관문: {} / 기준선: {}

## 산출
1. 030: {경로 · ① 이전 → 이후}
2. ② 선택: {DO / 래퍼 · 근거 · cron 교체 방식 · ops_alerts kind 값 · 제약 교체}
3. SCHEMA 고친 판: {§11-3 · §11-4 · §9-D-5 전문}
4. 시험: {(a)~(d) · 실패 장치}
5. 점검 SQL: {경로 · 출력 열}
6. 2부 기대값: {실행 권한 · cron 지문}
7. 내부 결정: {}

## 사람이 할 것 (Proteur)
- 030 적용 — 다음 05:00 UTC(14:00 KST) 전에

## 변경
- git diff --stat: {} / 001~029 diff: {0} / 금지 대상: {} / 새 파일: {}

## 게이트 (메인 세션 재실행)
- tsc / tsc(functions) / Python / jest 마지막 요약 줄

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

---

# 2부 — 030 적용과 다음 05:00 UTC 실행 뒤, Proteur가 알린 뒤에만

## 4. 확인

| # | 확인 | 기대 |
|---|---|---|
| ① | `verifyPurge68.ts run`(`test-68-purge`) | 개시자 파생 행 삭제 · 상대 행 유지 · `status = dissolved` · `executed_at` |
| ② | `71-`의 cron 실패 점검 SQL | 그날 `execute-dissolutions` 성공 · 030 적용 뒤 실패 0. 11-03 실패 한 건은 적용 전 기록으로 따로 적습니다 |
| ③ | 권한 · 지문 | `execute_dissolution`(그리고 래퍼): anon · authenticated · service_role 실행 권한 false · cron 작업 지문이 1부 기대값과 같음 · 보안 점검을 함수 이름 기준으로 70- 기준선과 비교 |
| ④ | 타입 재생성 | 1부의 "추가될 것"과 같음 |

- **`execute_dissolution` · 래퍼를 원격에서 부르지 않습니다**(R34-3). 배치가 돈 결과만 읽습니다.
- `ops_alerts`에 새 행이 있으면 내용(kind · detail)을 보고합니다. 정상이라면 이번 실행에서는 없어야 합니다.

## 5. 2부 보고

```
## 2부 판정
- 실행 주체: {사람 / Proteur 지시로 메인 세션}
- ① verifyPurge68: {}
- ② cron 실패 점검: {그날 결과 · 적용 뒤 실패 수}
- ③ 권한 · 지문 · 보안 점검: {}
- ④ 타입: {}
- ops_alerts 새 행: {0 / 내용}
- 출력 누출: {0}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- `db push` · 마이그레이션 적용 · 커밋 · 푸시
- 원격에서 `execute_dissolution` · `apply_retention_policy` · 래퍼 호출, cron 수동 실행
- 적용된 마이그레이션 수정 · `docs/` 수정
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
