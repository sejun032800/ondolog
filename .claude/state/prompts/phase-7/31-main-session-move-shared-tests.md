# 메인 세션 작업 — `#14` 2부 1단계: `_shared` 테스트를 같은 트리로 옮기기만

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/31-main-session-move-shared-tests.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-04

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음).

## 무엇을 하는가

`supabase/functions/_shared/`의 네 모듈 테스트를 **모듈과 같은 트리로 옮깁니다**
(MASTER r26, r39 Q11). 옮기면서 `require(경로변수)` 우회를 **`.ts` 확장자 정적
import**로 바꿉니다.

**이 단계의 증거는 "assertion 무수정, 전부 통과"입니다.** 동작을 바꾸는 수정
(`FORBIDDEN_KEYS` 위치, `validateCornerContent` 제거)은 **다음 단계**입니다.
한 번에 하면 옮긴 줄과 고친 줄이 섞여 diff를 읽을 수 없습니다.

---

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-04-r39'
git ls-files __tests__ | Select-String -Pattern 'cornerPipeline\.test|llmClient\.test|saveCornerResult\.test|coeffLookup\.test'
git ls-files supabase/functions | Select-String -Pattern '\.test\.ts$'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER r39 | 한 줄 |
| `__tests__`의 네 테스트 | **네 줄** — `__tests__/functions/` 아래로 보인다. 경로를 보고에 적는다 |
| `supabase/functions`의 테스트 | **빈 출력** — 아직 옮겨진 것이 없다 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 556 · 35**. 다르면 멈추고 보고하세요.

---

## 1. 옮기기

네 테스트 파일을 각각 **대상 모듈과 같은 디렉터리**로 `git mv` 합니다.

```
supabase/functions/_shared/cornerPipeline.test.ts
supabase/functions/_shared/llmClient.test.ts
supabase/functions/_shared/saveCornerResult.test.ts
supabase/functions/_shared/coeffLookup.test.ts
```

**`git mv`를 쓰세요.** 복사 후 삭제하면 git이 이동으로 인식하지 못해 diff가
"전부 삭제 + 전부 추가"로 보입니다.

### 허용되는 수정 — 셋뿐

| 수정 | 이유 |
|---|---|
| import 경로 | 위치가 바뀌었다 |
| `require(경로변수)` → `.ts` 확장자 정적 import | 이번 이동의 목적 (Q11) |
| 파일 맨 위 `/// <reference types="jest" />` | 전용 tsconfig가 jest 전역 타입을 모르는 경우에만 |

**assertion·기댓값·테스트 이름·테스트 본문은 한 글자도 바꾸지 않습니다.**

### 전제 확인

`jest`가 `supabase/functions/` 아래 테스트를 **수집하는지**를 옮긴 직후 확인합니다.

```powershell
npx jest --ci --watchAll=false --listTests | Select-String -Pattern 'supabase'
```

**네 줄이 나와야 합니다.** 안 나오면 jest 설정을 고치지 말고 `git mv`를 되돌리고
멈추고 보고하세요(설정 파일 변경은 범위 밖입니다).

---

## 2. 검증

### 2-1. 이동이 순수했는가 — 이 단계의 증거

```powershell
git diff --cached -M --stat
git diff --cached -M
```

`git mv`로 스테이징된 이동을 rename으로 봅니다. diff를 **직접 읽으세요.**

| 확인 | 기대 |
|---|---|
| 네 파일이 **rename**으로 보인다 | O |
| 바뀐 줄이 **허용된 셋뿐** | O — import 줄, `require` 줄, reference 줄 |
| assertion·기댓값·테스트 이름 변경 | **없음** |

### 2-2. 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

| 확인 | 기대 |
|---|---|
| tsc 두 줄 | 0 / 0 — **전용 tsconfig가 옮긴 테스트까지 타입 검사한다** |
| jest | **556 · 35 그대로** — 옮기기만 했으니 수가 같아야 한다 |
| 네 테스트 | 전부 통과 |

**수가 달라지면 멈추고 보고하세요.** 테스트가 수집에서 빠졌거나 중복됐다는 뜻입니다.

### 2-3. 남은 우회

```powershell
Select-String -Path supabase/functions/_shared/*.test.ts -Pattern 'require(' -SimpleMatch
```

| 기대 |
|---|
| **빈 출력** — 옮긴 네 테스트에 `require` 우회가 남지 않았다 |

(저장소의 다른 `require(` — 예: `jest.requireActual` — 은 이번 대상이 아닙니다.)

**확인한 뒤** `PROGRESS.md` **제목 바로 아래**에 한 줄.

---

## 3. 보고

```
- 0단계 표: {각 O/X} / 옮기기 전 네 테스트 경로: {목록}
- jest 수집 확인 (--listTests): {네 줄 O/X}
- git diff --cached -M --stat: {전문}
- 바뀐 줄이 허용된 셋뿐: {O/X} — 파일별 바뀐 줄 요약
- assertion·기댓값·테스트 이름 변경: {없음 / 있음 — 위반}
- reference types 줄을 넣은 파일: {목록 / 없음}
- 게이트: {0 / 0 / 556 · 35}
- 남은 require 우회: {없음 / 위치}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- **assertion·기댓값·테스트 이름·본문 수정** — 다음 단계의 일이다
- `FORBIDDEN_KEYS` 위치 변경, `validateCornerContent` 제거 — 다음 단계
- 코너 코드 작성 — `#14` 2부 본체
- jest 설정·`tsconfig.json`·`package.json` 변경
- `git mv` 대신 복사·삭제
- 전제가 없을 때 대체물을 찾아 나서는 것, 저장소 밖 경로를 읽는 것
