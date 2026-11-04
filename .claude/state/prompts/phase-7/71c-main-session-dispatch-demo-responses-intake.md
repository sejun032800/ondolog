# 메인 세션 지시 — `71c-` `71b-` 마무리 · `demo_responses` 기록 편입 · 보존 시험

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/71c-main-session-dispatch-demo-responses-intake.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-04
>
> 짝: `71c-db-architect-demo-responses-intake.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **원격 쓰기는 0입니다.** 원격 읽기는 Proteur 지시로 메인 세션이 합니다(R53-6). 그렇게 했으면 보고에 적습니다.

**전제 (절대 — R56-5): `demo_responses`의 데이터는 어떤 일이 있어도 지우거나 바꾸지 않습니다.** 원격에서 이 테이블에 SELECT 말고는 아무것도 하지 않습니다. 행 값은 화면 · 파일 · 보고 어디에도 내지 않습니다.

순서는 이렇습니다.
1. **A + B (지금)** → 보고 → 멈춤
2. Proteur가 커밋 ①을 하고, **CSV 첫 사본을 받았다**고 알림
3. **C** → 보고 → 멈춤
4. Proteur가 D · E · 커밋 ② · ③

---

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-04-r56'
Select-String -Path docs/ONDOLOG_SCHEMA.md -SimpleMatch -Pattern '9-I'
npx supabase --version
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '71c-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | `71b-` 작업 트리 그대로: HANDOFF · PROGRESS · `verifyPurge68.ts` 수정, `__tests__/db/` · `scripts/db/pgliteMigrations.ts` · `scripts/db/pgliteServer.mjs` 새 파일, `src/types/database.ts`(UTF-8 복구본) 수정. **그 밖의 파일이 있으면 멈춥니다** |
| ROADMAP r56 · SCHEMA §9-I | 각각 한 줄 이상(R47-3). **없으면 멈춥니다** |
| CLI | `2.121.0`(R56-11) |
| 위임 파일 | 두 줄 |

**기준선**: tsc 0 / 0, jest **1720 · 96**, Python **277**. 출력 전체를 `scripts/ops/out/71c-*-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8). 이번에 다시 돌려서 통과하는 시험이 `chatPhotoQueue`이면 이름만 적습니다(R56-4, `72-`에서 다룸).

## 1. A 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/71c-db-architect-demo-responses-intake.md 를
전문 읽고 그 문서의 A만 이행해주세요. C는 제가 시작하라고 할 때까지 하지 마세요.

착수 전에 확인해주세요.
1. (d) 파일 본문 비교 단언만 삭제 → 33
2. 자식 프로세스: 정상·실패·시간 초과 세 경로에서 남지 않음, 시간 초과 때 강제 종료 경로 — Windows에서 전후 프로세스 목록으로 확인, 임시 시험은 지움
3. HANDOFF 타입 명령 R56-3 형태 + Bin 한 줄
4. 원격 접속 0, supabase/migrations/ 변경 0

끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

### A 검증

```powershell
git diff --stat
git diff --stat -- supabase/migrations docs src/ app package.json package-lock.json
git ls-files --others --exclude-standard
```

- 둘째: `src/types/database.ts` 한 줄만 나와야 합니다(이미 있던 UTF-8 복구본). 그 밖의 파일은 0입니다
- 셋째: 새 파일은 `71b-`의 세 개(`__tests__/db/…` · `pgliteMigrations.ts` · `pgliteServer.mjs`)뿐이어야 합니다

| 확인 | 기대 |
|---|---|
| ① | 시험 파일에 013 · 030 파일을 읽어 비교하는 코드가 없음 · 단언 33 |
| ② | 세 경로의 확인 결과가 보고됐는지. **메인 세션도 직접 한 번 확인합니다**: jest 실행 전후로 `pgliteServer` 프로세스 수를 비교합니다(전후 같아야 함) |
| ③ | HANDOFF 줄 |
| 게이트 | tsc 0 / 0 · jest **1719** · 실패 0 · Python 277 — **메인 세션이 직접 다시 돌립니다** |

## 2. B — 원격 확인 (읽기만, 메인 세션)

Proteur가 앞서 보낸 확인 메시지 1~6을 아직 하지 않았다면 지금 합니다. 했다면 그 결과를 그대로 씁니다.

| # | 확인 |
|---|---|
| 1 | `supabase_migrations.schema_migrations`의 버전 `20261103142031`: `name` · `statements`(C에 넘길 원문 — **보고에는 md5와 줄 수만** 적습니다) · md5(70- 감사 방식) |
| 2 | `demo_responses`: RLS · 정책 · anon · authenticated · service_role 테이블 권한 |
| 3 | 보안 점검(`get_advisors`)에서 이 테이블 관련 항목. `with check (true)` 경고는 의도된 기준선입니다(R56-9) |
| 4 | CLI가 원격 최신 번호보다 작은 로컬 번호를 다루는 방식 — 문서 근거로(R56-7 확인용) |
| 5 | `71b-` 시험에서 편입 뒤 바뀌어야 할 단언 |
| 6 | **저장소의 모든 스크립트 · 마이그레이션 · 배치 함수가 `demo_responses`를 읽기 외로 건드리는 곳**(파일 · 줄). **하나라도 나오면 멈추고 보고합니다. C를 진행하지 않습니다** |
| 7 | **보존 기준값**(행 값 출력 0): 지금 행 수 · 최대 `id` · `id <= 최대 id`인 행 전체의 해시(예: 열 전체를 `id` 순서로 이어 붙인 문자열의 md5 — **해시 값만** 보고) |

**PE 정정 — 7번이 필요한 이유**: 웹 체험판은 지금도 응답을 받고 있습니다. 그래서 편입 전후의 **전체 행 수는 늘 수 있고, 그래도 정상입니다.** "행 수 전 = 후"(PM 지시서 §4-4) 대신, "**기준 시점까지의 행(`id <= 최대 id`)의 수와 해시가 전후로 같고, 전체 행 수는 같거나 늘었다**"로 판정합니다. 이 기준을 PM에게 함께 보고합니다.

## 3. A + B 보고

```
## 사전 점검
- 관문: {} / 기준선: {} / 다시 돌림: {}

## A
- ① 지운 단언 · 남은 수: {}
- ② 프로세스 정리: {세 경로 · 방법 · 결과 · 메인 세션 직접 확인}
- ③ HANDOFF: {}
- 게이트: tsc / tsc(functions) / Python / jest 마지막 요약 줄

## B (Proteur 지시로 메인 세션 원격 읽기)
- 1 버전: name {} · statements 줄 수 {} · md5 {}
- 2 권한 · 정책: {}
- 3 보안 점검: {}
- 4 CLI 번호 처리: {문서 근거}
- 5 바뀔 단언: {}
- 6 읽기 외 접촉: {없음 / 파일·줄}
- 7 보존 기준값: 행 수 {} · 최대 id {} · 해시 {}

## 사람이 할 것
- 커밋 ① (71b- 마무리)
- demo_responses CSV 첫 사본(저장소 밖)

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

---

# C — Proteur가 "커밋 ①을 했고 CSV 사본을 받았다"고 알린 뒤에만, B-6이 "없음"일 때만

## 4. C 위임

db-architect에게 B-1의 `name`과 `statements` 원문, md5 기준값을 넘기고 이렇게 보냅니다.

```
71c-db-architect-demo-responses-intake.md 의 C를 이행해주세요. 원격 기록 값은 아래와 같습니다: {name} / {md5} / statements 원문 {…}
착수 전에 확인해주세요.
1. 편입 파일 본문 = 원격 statements 그대로, md5 일치
2. 고의 실패는 시험 안의 임시 폴더에서만 — supabase/migrations/에는 편입 파일 하나만 생긴다
3. 보존 시험 = 편입 파일까지 적용 → 행 넣기 → 뒤 파일 전부 적용 → 행·값·열·RLS·정책·권한 그대로
4. "적용 목록 = 저장소 파일 전체" — 특정 번호 없음
5. 원격 접속 0
```

## 5. C 검증

```powershell
git status --porcelain
git ls-files --others --exclude-standard -- supabase/migrations
git diff --stat -- supabase/migrations docs src/ app package.json package-lock.json
Get-ChildItem supabase/migrations -File | Select-Object -Last 3 Name
```

- 둘째: **`supabase/migrations/20261103142031_<name>.sql` 하나만** 나와야 합니다. 그 밖의 파일이 있으면 **멈춥니다**(고의 실패 파일이 남았을 수 있음)
- 셋째: A 때와 같아야 합니다(`src/types/database.ts`만)

| 확인 | 기대 |
|---|---|
| 편입 파일 | 메인 세션이 그 파일의 md5를 직접 계산해 B-1과 대조합니다 · 본문에 원격 기록에 없는 줄이 없음 |
| 하네스 | 정렬 순서 · 나눠 적용 · 폴더 인자 변경이 보고됐는지 |
| "적용 목록" | 특정 번호가 박혀 있지 않음 |
| 보존 시험 | 확인 항목(행 수 · 값 · 열 · RLS · 정책 · 권한)이 다 있는지 직접 읽습니다 · 고의 실패 결과 |
| 원격 보존 | **B-7 다시 조회**: 기준 시점까지의 행 수 · 해시가 B와 같고, 전체 행 수는 같거나 늘었는지(값 출력 0) |
| 게이트 | tsc 0 / 0 · jest 1719 + 보존 시험 · 실패 0 · Python 277 — **메인 세션이 직접 다시 돌립니다** |

## 6. C 보고

```
## C
1. 편입 파일: {경로 · md5 원격/파일/메인 세션 계산}
2. 하네스 변경: {}
3. "적용 목록": {이전 → 이후}
4. 보존 시험: {파일 · 단언 수 · 항목}
5. 고의 실패: {결과 · 임시 폴더에서만 · supabase/migrations 새 파일 = 편입 파일 하나}
6. 영향받는 verify 기대값: {}
7. 원격 보존 재확인: {기준 시점 행 수 · 해시 같음 / 전체 행 수 전 → 후}
8. 내부 결정: {}

## 게이트 (메인 세션 재실행)
- tsc / tsc(functions) / Python / jest 마지막 요약 줄

## 사람이 할 것
- D: npx supabase migration list / npx supabase db push --dry-run (적용할 것 없음 기대)
- E: 타입 재생성 확인
- 커밋 ② · ③

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- **원격에서 `demo_responses`에 SELECT 말고 아무것이나 하는 것** · 행 값 출력
- `db push` · `migration repair` · `db reset` · 마이그레이션 적용 · 커밋 · 푸시
- `supabase/migrations/`에 편입 파일 말고 다른 파일을 만드는 것
- 적용된 001~030 수정 · `docs/` 수정 · jest 설정 변경 · 새 의존성
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
