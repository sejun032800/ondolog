# 메인 세션 지시 — 발행 경로 마이그레이션 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/47-main-session-dispatch-publish-path-migration.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-11
>
> 짝: `47-db-architect-publish-path-migration.md`

---

**두 부분입니다.**
- **A (지금):** 위임 → 검증 → 적용 전 관문 → 보고. 여기서 멈춥니다
- **B (사람이 마이그레이션을 적용한 뒤, 별도 메시지로만):** 테마 트리거 실증

**원격 DB에는 읽기 전용 SELECT만 실행합니다.** 마이그레이션 적용은 사람이 합니다. 커밋하지 않습니다.

## A-0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r52'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r11'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '## 9-D. 발행 경로', '### 9-D-8'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '47-db-architect-publish-path-migration'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r52 / ROADMAP r11 | 각 한 줄 |
| SCHEMA §9-D | 두 줄 — r52의 SCHEMA가 반영됐다 |
| 위임 파일 | 한 줄 |

**확인** — 결과를 보고에 적습니다. 위임은 막지 않습니다.

```powershell
git ls-files supabase/migrations
Select-String -Path supabase/migrations/*.sql -Pattern 'ai_usage_agreed_at'
```

- 마지막 마이그레이션 번호
- `ai_usage_agreed_at`(MASTER §17-0-10-B의 대상 커플 조건, `48-`에서 씀)이 기존 마이그레이션에 있는지

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## A-1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/47-db-architect-publish-path-migration.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 마이그레이션의 유일한 근거가 어디인지
2. 원격 DB에 대해 해도 되는 것과 하면 안 되는 것

확인 후 "1. 착수 전 확인"부터 진행하고, 멈춤 조건에 해당하면 작성하지
말고 보고해주세요.
```

## A-2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations docs src/types package.json tsconfig.json supabase/functions/tsconfig.json
```

- 마지막 명령은 **빈 출력**이어야 합니다. 기존 마이그레이션이 바뀌면 안 됩니다
- 새 파일은 마이그레이션 하나, 실증 SQL 하나, HANDOFF·PROGRESS뿐이어야 합니다

| 확인 | 기대 |
|---|---|
| 착수 전 확인 | 에이전트가 낸 기존 객체 목록. 없거나 다른 것이 있었으면 작성하지 않고 멈췄는가 |
| 파일명 | 마지막 번호 + 1, `_publish_path.sql`, ASCII |
| 내용 = §9-D | **§9-D-1 ~ 9-D-8의 블록을 하나씩 대조합니다.** 빠진 블록, §9-D에 없는 추가, 다르게 쓴 줄이 있으면 목록으로. 순서를 바꾼 곳은 에이전트가 이유를 댔는가 |
| 적용 전 확인 쿼리 | 마이그레이션 파일에 **들어 있지 않은가** |
| 015 | 에이전트가 보고한 `magazine` 정책 원문. INSERT 정책만 지웠는가. UPDATE·DELETE는 보고만 했는가 |
| 테마 실증 SQL | §9-C-6 방식(임시 테이블)이고, §9-D-4의 두 가지(발행 시 채움, 발행 후 변경 예외)를 다 보는가 |
| `fn_publish_issue` | 실증 **방법 제안만** 있고 실행하지 않았는가 |
| 게이트 | 0 / 0, jest 986 대비 감소 없음 (파일명 규칙 테스트 포함) |

## A-3. 적용 전 관문 — 원격, 읽기 전용

§9-D 머리의 두 쿼리를 원격에서 실행합니다. 방법은 §9-C-6 실증 때 원격 SQL을 실행한 것과 같습니다.
**SELECT 두 개 외에는 실행하지 않습니다.**

```sql
select count(*) from public.corners
 where skip_reason is not null
   and skip_reason not in ('insufficient_input','generation_failed','schema_invalid','forbidden_content');

select count(*) from public.corners where generation_attempts not between 0 and 3;
```

**둘 다 0이어야 합니다.** 0이 아니면 적용하면 안 되는 상태이므로 그대로 보고합니다.

## A-4. 보고 — 여기서 멈춥니다

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}
- 마지막 마이그레이션 번호: {} / ai_usage_agreed_at: {있음 — 파일:줄 / 없음}

## 착수 전 확인 (에이전트가 올린 그대로)
- 기존 객체: {목록}
- 멈춤 여부: {}

## 산출물
- 마이그레이션: {파일명}
- 실증 SQL: {위치}
- git status --porcelain: {전문}

## §9-D 대조
| 블록 | 결과 |
|---|---|
- 순서를 바꾼 곳과 이유: {}

## 015 magazine 정책
- 원문: {}
- 처리: {INSERT 삭제 / 없음 / UPDATE·DELETE 보고}

## fn_publish_issue 실증 방법 (에이전트 제안 그대로)
- {}

## 적용 전 관문 (원격)
- skip_reason 위반: {N} / generation_attempts 위반: {N}

## 게이트
- {}

## 판단이 필요한 지점
- {있으면}
```

---

## B. 테마 트리거 실증 — 사람이 적용한 뒤, 별도 메시지로만

**사람이 마이그레이션을 원격에 적용했다는 메시지를 받기 전에는 하지 않습니다.**

1. A에서 저장한 실증 SQL을 원격에서 실행합니다(§9-C-6 방식, 임시 테이블). 임시 테이블 밖의 원격 데이터에는 쓰지 않습니다
2. §9-C-6과 같이 **바인딩**(`tg_issues_theme_on_publish`가 `issues`에 BEFORE UPDATE로, 활성)이 있는지 확인합니다
3. 보고

```
## B
- 발행 시 theme 채움: {O/X — 결과}
- 발행 후 theme 변경 예외: {O/X — 오류 문구}
- 바인딩: {O/X}
```

## 하지 말 것

- 직접 작성, 위임 프롬프트 요약·보강
- 원격 DB에 SELECT 외의 것을 실행하는 것 (B의 임시 테이블 실증 제외)
- 마이그레이션을 적용하는 것
- 사람의 적용 확인 전에 B를 하는 것
- 커밋·푸시
