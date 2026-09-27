# 메인 세션 지시 — 마이그레이션 021 위임과 적용 후 검증

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/23-main-session-dispatch-theme.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-27
>
> 짝: `23-db-architect-app-ui-theme.md`

---

## 이 지시서는 두 단계입니다

| | 단계 | 누가 |
|---|---|---|
| **A** | 021 파일 작성 위임 → 파일 검증 → **멈춤** | 메인 세션 |
| — | `npx supabase db push` | **사람** (절대 규칙 6) |
| **B** | 타입 재생성 → 검증 쿼리 → **트리거 실증** | 메인 세션 |

**A가 끝나면 반드시 멈추고 보고하세요.** 사람이 push한 뒤 B를 지시합니다.

---

# 단계 A

## 0단계 — 파일명 확인

```powershell
git ls-files | Select-String -Pattern '\(\d\)| '
```

- [ ] 공백·괄호 파일명이 없는가 (Expo Router의 `(modals)` 등 라우트
      그룹은 정상)

## 1단계 — 프로젝트 파악

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/db-architect.md` | 위임 대상 정의 |
| `.claude/state/prompts/phase-7/23-db-architect-app-ui-theme.md` | **위임 원문** |

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. MASTER와 SCHEMA가 최신인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-24-r31'
Select-String -Path docs/ONDOLOG_SCHEMA.md -Pattern '## 9-C'
Select-String -Path docs/ONDOLOG_SCHEMA.md -Pattern '021_app_ui_theme'
```

**세 명령 모두 출력이 있어야 합니다.** 하나라도 없으면 문서를 편집하지
말고 보고하고 멈추세요.

### 2-2. §9-C가 자리표시자가 아닌가

```powershell
Select-String -Path docs/ONDOLOG_SCHEMA.md -Pattern 'alter table public.couples|alter table public.issues|alter table public.dates|fn_issues_theme_immutable|create or replace view public.issues_public' -List
```

- [ ] 다섯 패턴이 전부 §9-C 안에 있는가

**내용은 에이전트에게 알려주지 마세요.** 존재만 확인합니다.

### 2-3. 021이 비어 있는가

```powershell
Test-Path supabase/migrations/021_app_ui_theme.sql
Get-ChildItem supabase/migrations -File | Select-Object Name
```

- [ ] `021_app_ui_theme.sql`이 **아직 없는가**
- [ ] 다른 이름의 021이 없는가

### 2-4. 기준선

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
git status --porcelain
```

기준선: **0 에러 / 0 에러 / 550 tests · 34 suites**, 작업 트리 clean.

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.** §9-C의 DDL을 대신
알려주지 마세요.

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/23-db-architect-app-ui-theme.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번 작업의 유일한 근거 문서와 절
2. 뷰에 새 컬럼을 어디에 두어야 하며 왜 그런지
3. pdf_profiles에서 무엇을 빼고 무엇을 넣지 않는지
4. 원격 적용과 database.ts를 누가 언제 다루는지

확인 후, 문서가 지시한 1부 보고를 먼저 하고 그다음 작성해주세요.
```

## 4단계 — 파일 검증

**에이전트 보고를 신뢰 근거로 쓰지 마세요.** 전부 직접 확인합니다.

### 4-1. 범위

```powershell
git status --porcelain -uall
git diff --stat
```

- [ ] 신규는 **`021_app_ui_theme.sql` 하나**(+ 상태 파일 2)인가
- [ ] **001~020에 변경이 없는가**

```powershell
git status --porcelain -uall supabase/migrations src/types docs
```

- [ ] `021` 외에 출력이 없는가

### 4-2. §9-C와의 일치 — 직접 대조

021 파일과 SCHEMA §9-C를 **나란히 열어** 읽으세요.

- [ ] 네 부분이 **9-C-2 → 9-C-3 → 9-C-4 → 9-C-5 순서**인가
- [ ] 컬럼 셋의 이름·타입·default·check가 §9-C와 같은가
- [ ] 트리거 조건이 **`old.published_at is not null`** 인가

### 4-3. 뷰 — 목록 끝

```powershell
Select-String -Path supabase/migrations/021_app_ui_theme.sql -Pattern 'create or replace view' -Context 0,10
```

- [ ] 009의 컬럼 목록이 **순서 그대로** 있고, **`theme`가 맨 끝**인가
- [ ] `pdf_print_path`가 **없는가**

**중간에 들어갔으면 push 시 적용이 실패합니다.** 보고하고 멈추세요.

### 4-4. `pdf_profiles`

```powershell
Select-String -Path supabase/migrations/021_app_ui_theme.sql -Pattern 'pdf_profiles' -Context 1,3
Select-String -Path supabase/migrations/021_app_ui_theme.sql -Pattern 'scale|colorSpace|CMYK|sRGB'
```

- [ ] 첫 명령에 새 값이 있는가
- [ ] **둘째 명령에 출력이 없어야** 합니다

### 4-5. 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

- [ ] **0 에러 / 0 에러 / 550 · 34** 그대로인가 (SQL 파일은 게이트에
      영향이 없어야 정상)

## 5단계 — 단계 A 보고 후 멈춤

```
## 단계 A 보고

### 사전 점검
- r31 / §9-C / 021 등재: {각 O/X}
- §9-C 다섯 패턴: {O/X}
- 021 미존재: {O/X}
- 기준선: {0 / 0 / 550 · 34}

### 범위
- git status --porcelain -uall 전문
- 001~020 변경: {없음 / 있음 — 위반}

### §9-C 일치
- 네 부분 순서: {O/X}
- 컬럼 셋: {일치 / 차이 — 내용}
- 트리거 조건: {그대로}

### 뷰
- 컬럼 목록: {그대로}
- theme 위치: {끝 / 중간 — 위반}
- pdf_print_path 제외: {O/X}

### pdf_profiles
- 새 값: {그대로}
- scale·색공간 잔존: {없음 / 있음 — 위반}

### 게이트
- {0 / 0 / 550 · 34}

### 사람 작업 대기
- `npx supabase db push` 필요
```

**여기서 멈추세요.** 커밋하지 마세요. 사람이 확인·커밋·push한 뒤
단계 B를 지시합니다.

---

# 단계 B — 사람이 push한 뒤에만

## 6단계 — 적용 확인과 타입 재생성

```powershell
npx supabase migration list --linked
```

- [ ] 원격에 **021이 적용됨**으로 나오는가. 아니면 멈추고 보고

```powershell
npx supabase gen types typescript --linked > src/types/database.ts
git diff --stat src/types/database.ts
```

- [ ] `couples`에 `magazine_theme`, `issues`에 `theme`, `dates`에
      `sky_color`, `issues_public`에 `theme`가 생겼는가
- [ ] **그 밖의 테이블 타입이 바뀌지 않았는가** — 바뀌었으면 원격과
      로컬이 어긋나 있던 것이니 보고

## 7단계 — §14 검증 쿼리

SCHEMA §14의 쿼리 중 아래 셋을 원격에 실행합니다.

- RLS 미적용 테이블 → **0행**
- `issues_public`의 `pdf_print_path` → **0**
- 얼굴 임베딩 컬럼 → **0행**

## 8단계 — 트리거 실증 (핵심)

**트리거가 존재하는지가 아니라 막는지를 봅니다.**

**반드시 트랜잭션 안에서 실행하고 ROLLBACK하세요.** 원격 데이터를
바꾸지 않습니다.

```sql
begin;

-- ① 발행된 행: 막혀야 한다
update public.issues
   set theme = case when theme = 'basic' then 'hip' else 'basic' end
 where id = (select id from public.issues where published_at is not null limit 1);
-- 기대: ERROR  issues.theme은 발행 후 바꿀 수 없다

rollback;
```

```sql
begin;

-- ② 미발행 행: 통과해야 한다
update public.issues
   set theme = case when theme = 'basic' then 'hip' else 'basic' end
 where id = (select id from public.issues where published_at is null limit 1);
-- 기대: UPDATE 1

rollback;
```

```sql
begin;

-- ③ CHECK: 목록 밖 값은 막혀야 한다
update public.couples
   set magazine_theme = 'unknown'
 where id = (select id from public.couples limit 1);
-- 기대: ERROR  violates check constraint

rollback;
```

- 해당하는 행이 원격에 **없으면 그 사실을 보고**하세요. **테스트 행을
  새로 만들지 마세요** — 외래키가 연쇄로 걸려 있습니다
- ①이 **통과해 버리면** 트리거가 작동하지 않는 것입니다. 즉시 보고

## 9단계 — 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

- [ ] `database.ts` 재생성 후에도 **0 / 0 / 550 · 34**인가

## 10단계 — 단계 B 보고

```
## 단계 B 보고

### 적용
- migration list에 021: {적용 / 미적용}

### 타입
- database.ts 신규 필드 넷: {각 O/X}
- 그 밖의 타입 변경: {없음 / 있음 — 내용}

### §14 검증
- RLS 미적용: {N}행 / pdf_print_path 노출: {N} / 임베딩 컬럼: {N}행

### 트리거 실증 (핵심)
- ① 발행 행 UPDATE: {ERROR — 메시지 / 통과 — 위반 / 대상 행 없음}
- ② 미발행 행 UPDATE: {UPDATE 1 / 에러 — 내용 / 대상 행 없음}
- ③ CHECK 밖 값: {ERROR / 통과 — 위반}
- 세 건 모두 ROLLBACK: {O/X}

### 게이트
- {0 / 0 / 550 · 34}

### git status --porcelain
- {전문}
```

---

## 하지 말 것

- **당신이 직접 021을 작성하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **§9-C의 DDL을 에이전트에게 알려주는 것**
- **`db push`를 실행하는 것** — 사람이 합니다
- **단계 A가 끝났는데 멈추지 않고 B로 넘어가는 것**
- **트리거 실증을 ROLLBACK 없이 실행하는 것**
- **실증용 테스트 행을 원격에 만드는 것**
- `docs/` 편집, 커밋·푸시, 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
