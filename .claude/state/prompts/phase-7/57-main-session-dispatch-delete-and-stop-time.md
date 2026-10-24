# 메인 세션 지시 — `57-` 본인 기록 삭제(023) · stop 시각 규칙

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/57-main-session-dispatch-delete-and-stop-time.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
>
> 짝: `57-db-architect-delete-rpc.md` (A) · `57-corner-pipeline-deleted-entries.md` (B) · `57-ui-builder-delete-and-stop-time.md` (C)

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 두 부분으로 나눕니다(`47-`과 같은 방식).

- **1부 (지금):** A 위임 → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 023을 원격 개발에 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → A 실증·권한 확인 → 타입 재생성 → B 위임 → C 위임

**마이그레이션 적용은 사람이 합니다**(절대 규칙 6). 원격에서 메인 세션은 1부에서 읽기 전용 SELECT만, 2부에서 실증 스크립트만 실행합니다.

---

# 1부

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-24-r68'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-24-r30'
git ls-files src/services/dateRecordApi.ts
Get-ChildItem supabase/migrations -Name | Select-Object -Last 3
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '57-db-architect-delete-rpc|57-corner-pipeline-deleted-entries|57-ui-builder-delete-and-stop-time'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
Select-String -Path .env -Pattern '^EXPO_PUBLIC_SUPABASE_ANON_KEY=.+' -Quiet
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r68 / ROADMAP r30 | 각 한 줄 |
| `dateRecordApi.ts` | 한 줄 — `56-`이 커밋됐다 |
| 마이그레이션 마지막 3개 | 마지막이 022. **023이 이미 있으면 멈춥니다** |
| 위임 파일 | 세 줄 |
| 환경변수 둘, anon key | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1185 · 59**, Python 시험 **122건**(`55-1`이 쓴 명령). 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. A 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/57-db-architect-delete-rpc.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 함수 본문이 반드시 확인하는 것 (작성자 = 호출자, 같은 커플) 과 멱등
2. 원격 DB에 아무것도 실행하지 않는다는 것 (적용·실증 스크립트 실행 모두)

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. A 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src app docs package.json package-lock.json
```

- 셋째 명령은 **빈 출력**이어야 합니다 — 기존 마이그레이션·앱·문서가 그대로입니다. 새 023 파일은 `git status`에 추적 안 된 새 파일(`??`)로만 보입니다

| 확인 | 기대 |
|---|---|
| 함수 | `security definer`, `search_path` 고정. 본문이 `auth.uid() = author_id`와 `is_couple_member(couple_id)`를 **모두** 확인하는가. 아니면 예외(구분되는 메시지). 이미 지운 항목은 변화 없음 |
| 권한 | `anon`·`public` 실행 회수, `authenticated`만 |
| 파생 칸 | 남은 항목 기준으로 `photo_count`·`has_user_note`·`duration_minutes`를 다시 맞추는가. 데이트를 지우지 않는가 |
| 바꾸지 않는 것 | RLS·정책·다른 테이블·기존 마이그레이션에 변경이 없는가. DELETE 정책·저장소 파일 삭제가 없는가 |
| 실증 스크립트 | 다섯 경우를 **사용자 세션으로** 부르는가. 출력 원문을 파일로 남기는가. **실행되지 않았는가** |
| 적용 명령 | 022 때 쓴 명령이 저장소 기록에서 찾아졌는가(못 찾음이면 그대로 보고) |

## 3. 적용 전 확인 — 원격, 읽기 전용

A가 쓴 적용 전 확인 쿼리를 **읽기 전용으로** 돌립니다. 같은 이름의 함수가 원격에 이미 있으면 적용하면 안 되는 상태이므로 그대로 보고합니다.

## 4. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## A
- 마이그레이션: {경로} (전문은 파일로)
- 함수 확인 항목: {작성자·커플·멱등·예외 메시지·권한}
- 파생 칸 처리: {}
- SCHEMA 명세 초안: {위치}
- 실증 스크립트·권한 쿼리: {경로 / 실행 방법}
- 사람이 쓸 적용 명령: {022 때 명령 / 못 찾음}
- 적용 전 확인 결과: {같은 이름 함수 없음 O / X}

## 게이트
- tsc: {} / tsc(functions): {}
- jest 마지막 요약 줄 (그대로): {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.** 사람이 023을 검토·적용하고 별도 메시지로 알릴 때까지 2부를 시작하지 않습니다.

---

# 2부 — 사람이 "023을 원격 개발에 적용했다"고 알린 뒤에만

## 5. 적용 확인 — 읽기 전용

`fn_delete_own_entry`가 원격 개발에 있는지 확인합니다. 없으면 멈추고 보고합니다.

## 6. A 실증·권한 확인

- A가 쓴 실증 스크립트(다섯 경우)를 돌리고 **출력 원문**을 보존합니다
- 권한 확인 쿼리(`has_function_privilege` — `anon` 불가 · `authenticated` 가능, `prosecdef = true`, `proconfig`의 `search_path`)를 022 실증과 같은 방식으로 돌립니다
- 하나라도 기대와 다르면 B·C로 가지 않고 보고합니다

## 7. 타입 재생성

SCHEMA §9-D-10 기준 그대로입니다 — **기존 `database.ts`를 만들 때 쓴 명령을 그대로** 쓰고, diff는 **추가만** 허용합니다(이번에는 `fn_delete_own_entry`의 Functions 항목). 기존 타입이 하나라도 바뀌면 멈추고 보고합니다. 명령을 찾지 못하면 재생성하지 않고 보고합니다.

## 8. B 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/57-corner-pipeline-deleted-entries.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요: 시험용 삭제는 작성자 세션으로 RPC를 불러 한다는 것,
이미 발행된 호는 바꾸지 않는다는 것.

끝나면 게이트(tsc 둘, jest, 해당하면 deno check)를 직접 돌려 보고에 넣어주세요.
```

**검증**: 입력 조립이 `deleted_at` 항목을 빼는가(시험) · 발행 재확인이 `deleted_at`을 없는 원본과 같이 처리하는가(코너 `pending` + `source_media_missing` + 렌더 세 필드 비움) · 원격 실증 출력(삭제 → 발행 거부)이 붙었는가 · 마이그레이션·앱 변경이 없는가 · 게이트를 메인 세션이 다시 돌림

## 9. C 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/57-ui-builder-delete-and-stop-time.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요: 삭제는 fn_delete_own_entry RPC만 부른다는 것,
stop 시각에 표시 값을 쓰지 않는다는 것(KST 00:00 표시 값 코드를 지운다).

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

**검증**

```powershell
git diff --stat -- supabase render docs package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 둘 다 **빈 출력**이어야 합니다. `src/types/database.ts`는 7의 재생성분이므로 따로 확인합니다

| 확인 | 기대 |
|---|---|
| 삭제 UI | 내 사진·메모에만 진입. I05 확인 + "이미 발행된 호에서는 지워지지 않아요". 상대 항목에는 없음. RPC만 부름 |
| stop 시각 | 시험 네 가지. 00:00 표시 값 코드와 "시각 모름" 읽기 코드가 지워졌는가 |
| "메모 N" | 피드 머리 문구 |
| 항목 11 | 00:00 표시 값 stop을 다시 기록했는가(지우지 않음) |
| 색·서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 그대로 — **메인 세션이 직접 다시 돌립니다** |

## 10. 2부 보고

```
## 적용 확인
- fn_delete_own_entry: {있음 / 없음}

## A 실증 (출력 그대로)
- ①~⑤: {}
- 권한: {anon / authenticated / prosecdef / search_path}

## 타입 재생성
- 명령: {} / diff: {추가만 O / X — 내용}

## B
- 입력 조립 deleted_at: {이미 있음 — 위치 / 고침}
- 발행 재확인: {diff 요약} / 시험: {}
- 원격 실증 (출력 그대로): {}

## C
- 항목 8~11: {파일·보드}
- 항목 9 시험 네 가지: {}
- 삭제 원격 확인: {}
- 항목 11: {}
- 색·서체 확인: {명령과 출력}
- 51- 확인 목록 (10가지): {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음}
- 키 누출 확인: {빈 출력 O / X}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / deno check: {해당 없음 / 결과} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
