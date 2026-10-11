# 메인 세션 지시 — 022 실증 (SCHEMA §9-D-9)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/47b-main-session-dispatch-publish-path-verify.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-11
>
> 짝: `47b-db-architect-publish-path-verify-scripts.md`
> 이 문서가 `47-` 디스패치의 B를 대신한다 (r53에서 실증 방식이 확정됐다)

---

**두 단계입니다.**
- **1~2:** 스크립트 작성 위임 → 검증. 원격에 접속하지 않습니다
- **3:** 사람이 022를 적용했음을 확인한 뒤에만 원격에서 스크립트를 실행합니다

커밋하지 않습니다. `src/types/database.ts` 재생성은 이번 범위가 아닙니다.

## 0. 사전 점검

**관문**

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-11-r53'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r11'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '### 9-D-9'
git ls-files supabase/migrations scripts/db | Select-String -Pattern '022_publish_path.sql', 'verify_022_publish_theme_trigger.sql'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '47b-db-architect-publish-path-verify-scripts'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r53 / ROADMAP r11 | 각 한 줄 |
| SCHEMA §9-D-9 | 한 줄 |
| 022·실증 SQL | 두 줄 — `47-` A가 커밋됐다 |
| 위임 파일 | 한 줄 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## 1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/47b-db-architect-publish-path-verify-scripts.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 실증 방식의 원본이 어디인지
2. 원격 DB에 대해 스크립트가 해도 되는 것과 하면 안 되는 것

스크립트는 쓰기만 하고 실행하지 마세요.
```

## 2. 검증 — 스크립트를 읽어서

```powershell
git status --porcelain
git diff --stat -- supabase/migrations docs src/types
```

- 마지막 명령은 **빈 출력**이어야 합니다

| # | 확인 |
|---|---|
| 1 트리거 | 임시 테이블에 **진짜 `public.fn_issues_theme_on_publish`**를 거는가. `couple_id`를 원격 `couples`에서 **읽기만** 하는가. 초안 `theme`를 커플의 `magazine_theme`와 **다른 값**으로 넣는가. `couples`가 0행이면 실증 없이 끝나는가. 임시 `couples`·함수 사본이 **없는가** |
| 2 A | 사본이 **치환 명령으로만** 만들어지고 그 명령이 스크립트에 있는가. "논리 확인이며 실제 함수의 증명이 아니다"가 적혀 있는가 |
| 3 B | 권한·`prosecdef`·`search_path`·`magazine` 정책 확인이 **SELECT뿐**인가 |
| 공통 | 쓰기가 임시 테이블·`pg_temp`에만 있는가. 원격 실제 테이블에 INSERT·UPDATE·DELETE·DDL이 없는가 |

**하나라도 어긋나면 3으로 가지 않고 보고합니다.**

## 3. 원격 실행 — 사람이 적용한 뒤에만

**사람이 "022를 원격에 적용했다"고 알리기 전에는 하지 않습니다.** 알림을 받으면 먼저 읽기 전용으로
적용됐는지 확인합니다 — `fn_publish_issue`·`fn_issue_progress`·`fn_issues_theme_on_publish` 함수와
`corner_batches`·`ops_alerts` 테이블이 원격에 있는가. 없으면 실행하지 않고 보고합니다.

방법은 §9-C-6 실증 때 원격 SQL을 실행한 것과 같습니다. 순서는 3(B) → 1(트리거) → 2(A).

## 4. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 스크립트
- 위치: 1 {} / 2 {} / 3 {}
- 검증: {각 O/X}
- git status --porcelain: {전문}

## 원격 실행 (적용 확인 후)
- 적용 확인: {함수 셋·테이블 둘 O/X}
- B 권한·설정: fn_publish_issue anon {} / authenticated {} / service_role {} · prosecdef {} · search_path {} · fn_issue_progress anon {} / authenticated {} · magazine 정책 {목록}
- 트리거: couples 행 {N} → {실증함: 복사 O/X, 발행 후 변경 예외 O/X / 0행이라 48- C로 미룸}
- A (논리 확인, 실제 함수의 증명 아님): {항목별 O/X}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 작성, 위임 프롬프트 요약·보강
- 사람의 적용 확인 전에 원격에서 실행하는 것
- 원격 실제 테이블에 쓰는 것, 임시 테이블·`pg_temp` 밖의 DDL
- 마이그레이션 적용, 타입 재생성
- 커밋·푸시
