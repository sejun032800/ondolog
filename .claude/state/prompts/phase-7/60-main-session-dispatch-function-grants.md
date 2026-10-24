# 메인 세션 지시 — `60-` DB 함수 실행 권한 최소화 (025)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/60-main-session-dispatch-function-grants.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
>
> 짝: `60-db-architect-function-grants.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 023·024와 같이 두 부분입니다. Deno는 늘 `--no-lock`.

- **1부 (지금):** 위임(분류표 → 애매하면 멈춤 → 025 작성) → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 025를 원격 개발에 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 타입 재생성 → 실증 ①~⑨

**마이그레이션 적용은 사람이 합니다**(절대 규칙 6). **`execute_dissolution`은 어떤 권한으로도 실제 실행하지 않습니다**(거부 확인만).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-24-r33'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '10-0. 함수 실행 권한 원칙'
git ls-files supabase/migrations/024_issues_column_grants.sql
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '60-db-architect-function-grants'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r33 · SCHEMA §10-0 | 각 한 줄 이상 |
| 024 파일 | 한 줄 — 커밋됐다 |
| 마이그레이션 마지막 2개 | 마지막이 024. **025가 이미 있으면 멈춥니다** |
| 위임 파일 | 한 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1288 · 64**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/60-db-architect-function-grants.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 분류가 애매한 함수가 하나라도 있으면 마이그레이션을 쓰기 전에 멈춤
2. 정책·RLS·테이블 권한(024 열 권한 포함)은 건드리지 않음
3. 원격에는 읽기 전용 조회만 — 적용·실증 실행 없음

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src app docs package.json package-lock.json
```

- 셋째 명령은 **빈 출력**이어야 합니다. 새 025 파일은 `??`로만 보입니다

| 확인 | 기대 |
|---|---|
| 기준선 | 보안 점검 경고 전체가 파일로 남았는가 |
| 분류표 | 원격 `public` 함수 **전부**가 있는가. 부르는 곳이 코드·카탈로그 근거로 적혔는가 |
| 멈춤 | 애매한 함수가 있었다면 025를 쓰지 않고 멈췄는가 |
| 025 | ①~⑥만 있는가. **`create/alter/drop policy` 없음 · 테이블 `grant`/`revoke` 없음(024 열 권한 그대로) · 함수 동작 변경 없음**. 배치 함수에 anon·authenticated 실행이 남지 않는가. RLS 헬퍼는 authenticated가 남는가. 운영자 명령이 부르는 함수에 service_role이 명시됐는가 |
| ⑥ 접두사 | `fn_delete_own_entry`의 새 정의가 023과 **같은 동작**인가(diff로 테이블 이름 접두사·권한 줄 외 차이 없음) |
| 기본 권한 | 회수가 걸리는 역할이 보고됐는가 |
| 실증 스크립트 | ①~⑨, `execute_dissolution`은 거부 확인만, 실제 실행은 대상 0건만. **실행되지 않았는가** |

## 3. 적용 전 확인 — 원격, 읽기 전용

A가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다.

## 4. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 분류
- 보안 점검 기준선: {파일 / 경고 요약}
- 분류표: {전체 — 함수마다 한 줄}
- 애매한 함수: {없음 / 있음 — 멈춤, 목록}

## 025 (멈추지 않았으면)
- 경로: {} (전문은 파일로)
- ①~⑥ 요약: {}
- 기본 권한 회수가 걸리는 역할: {}
- 확인 SQL·실증 스크립트: {경로 / 실행 방법}
- 사람이 쓸 적용 명령: {}
- 적용 전 확인 결과: {}

## 게이트
- tsc: {} / tsc(functions): {}
- jest 마지막 요약 줄 (그대로): {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

---

# 2부 — 사람이 "025를 원격 개발에 적용했다"고 알린 뒤에만

## 5. 적용 확인

원격 migration 기록에 025가 있는지 확인합니다(읽기 전용). 없으면 멈춥니다.

## 6. 권한 확인

권한 확인 SQL을 돌려 **출력 원문**을 보존합니다. 분류표대로가 아니면 7 이후로 가지 않고 보고합니다.

## 7. 타입 재생성

SCHEMA §9-D-10 그대로. 권한만 바뀌므로 **스키마 타입 diff 0이 기대값**입니다. 바뀌면 멈춥니다(`__InternalSupabase` 메타데이터는 적기만, R31-3). 바뀐 것이 없으면 파일에 쓰지 않습니다.

## 8. 실증 ①~⑨

A의 실증 스크립트를 돌리고 **출력 원문**을 보존합니다. 처음 실행하는 스크립트이므로 **구문 오류가 나면 고치기 전에 보고**합니다.
- ③의 소유자 권한 실행은 **대상이 0건인 `expire_stories`만**. 실행 전에 대상이 0건인지 먼저 읽기로 확인하고, 0이 아니면 실행하지 않고 보고합니다
- **`execute_dissolution`은 실행하지 않습니다**
- ④ RLS 회귀에서 이전과 다른 결과가 하나라도 나오면 멈추고 보고합니다 — 025가 RLS 헬퍼 권한을 잘못 건드린 신호입니다
- ⑨ 보안 점검은 1부의 기준선 파일과 나란히 비교표로

## 9. 2부 보고

```
## 적용 확인
- 025: {있음 / 없음}

## 권한 확인 (출력 그대로)
- {}

## 타입 재생성
- 스키마 타입 변경: {없음 / 있음 — 멈춤} / 메타데이터: {}

## 실증 ①~⑨ (출력 그대로, 키·토큰·URL 없음)
- ① anon 배치 호출: {}
- ② 로그인 배치 호출: {}
- ③ pg_cron·소유자 실행: {대상 0건 확인 / 결과}
- ④ RLS 회귀: {항목별 이전과 같음 O/X}
- ⑤ fn_issue_progress·fn_delete_own_entry: {}
- ⑥ 운영자 명령 함수: {}
- ⑦ issues_public: {}
- ⑧ pg_default_acl: {}
- ⑨ 보안 점검 비교표: {기준선 / 025 후}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
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
- **`execute_dissolution` 실행**, 대상이 0건이 아닌 배치 함수 실행
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키·토큰·서명 URL을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
