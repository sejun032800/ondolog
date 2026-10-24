# 메인 세션 지시 — `59-` 발행물 읽기 권한(024) · U3 원격 실증

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/59-main-session-dispatch-issues-grant.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
>
> 짝: `59-db-architect-issues-grant.md` (A)

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. `57-`과 같이 두 부분으로 나눕니다. Deno는 늘 `--no-lock`(R31-7).

- **1부 (지금):** A 위임 → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 024를 원격 개발에 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 타입 재생성 → B 실증 ①~⑧ → C U3 원격 실증 → 보안 점검

**마이그레이션 적용은 사람이 합니다**(절대 규칙 6). 원격에서 메인 세션은 1부에서 읽기 전용 SELECT만, 2부에서 실증 스크립트와 확인 SQL만 실행합니다.

---

# 1부

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-24-r32'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '마이그레이션 024에서 고침'
git ls-files src/services/magazineApi.ts
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '59-db-architect-issues-grant'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r32 | 한 줄 |
| SCHEMA "마이그레이션 024에서 고침" | 한 줄 이상 |
| `magazineApi.ts` | 한 줄 — `58-`이 커밋됐다 |
| 마이그레이션 마지막 2개 | 마지막이 023. **024가 이미 있으면 멈춥니다** |
| 위임 파일 | 한 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest = **Proteur가 위임 메시지와 함께 알려주는 숫자**(`58-`의 1301 · 65, 또는 R32-3 처리 뒤의 수), Python 시험 **122건**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. A 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/59-db-architect-issues-grant.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 열 권한은 뷰가 내보내는 14칸에만, pdf_print_path와 anon에는 주지 않음
2. 정책·뷰·버킷 정책은 바꾸지 않음 (버킷 정책은 읽고 판단만)
3. 원격에는 읽기 전용 조회만 — 적용·실증 실행 없음

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. A 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src app docs package.json package-lock.json
```

- 셋째 명령은 **빈 출력**이어야 합니다. 새 024 파일은 `??`로만 보입니다

| 확인 | 기대 |
|---|---|
| 칸 목록 | 원격 뷰 정의에서 읽은 칸이 14칸과 같은가. 다르면 멈췄는가 |
| 마이그레이션 | `grant select (14칸) on public.issues to authenticated` 하나. **`pdf_print_path` 없음 · `anon` 없음 · `create/alter/drop policy` 없음 · `create/replace view` 없음 · `security definer` 없음** |
| 버킷 정책 | 원문과 판단(1~2로 풀림 / 따로 고쳐야 함)이 보고됐는가. 마이그레이션에 정책 변경이 없는가 |
| 실증 스크립트 | ①~⑧을 **사용자 권한**(anon 키 + 시험 계정)으로 부르는가. 서명 URL 값은 찍지 않고 상태 코드만 찍는가. **실행되지 않았는가** |
| 권한 확인 SQL | `information_schema.column_privileges`로 `pdf_print_path`·`anon`을 확인하는가 |

## 3. 적용 전 확인 — 원격, 읽기 전용

A가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다(023 때와 같은 방법).

## 4. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## A
- 원격 뷰 칸 목록: {14칸과 같음 / 다름 — 목록}
- 마이그레이션: {경로} (전문은 파일로)
- 버킷 정책: {원문 요약} / 판단: {1~2로 풀림 / 따로 고쳐야 함 — 방법}
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

**여기서 멈춥니다.** 사람이 024를 검토·적용하고 별도 메시지로 알릴 때까지 2부를 시작하지 않습니다.

---

# 2부 — 사람이 "024를 원격 개발에 적용했다"고 알린 뒤에만

## 5. 적용 확인 — 읽기 전용

원격 `migration list`(또는 `supabase_migrations.schema_migrations`)에 024가 있는지 확인합니다. 없으면 멈추고 보고합니다.

## 6. 권한 확인 (완료 기준 1)

권한 확인 SQL을 돌려 **출력 원문**을 보존합니다 — `pdf_print_path`에 `authenticated` 권한 없음, 허용 14칸에만 있음, `anon` 0건. 하나라도 다르면 7 이후로 가지 않고 보고합니다.

## 7. 타입 재생성

SCHEMA §9-D-10 그대로 — **기존 명령 그대로**, 열 권한은 생성 타입을 바꾸지 않는 것이 기대값입니다. **스키마 타입이 하나라도 바뀌면 멈춥니다.** `__InternalSupabase` 메타데이터 변경은 판정에서 빼고 보고에 적기만 합니다(R31-3). 바뀐 것이 없으면 파일에 쓰지 않습니다.

## 8. B 실증 ①~⑧

A의 실증 스크립트를 돌리고 **출력 원문**을 보존합니다. 처음 실행하는 스크립트이므로 **구문 오류가 나면 고치기 전에 보고**합니다. ②(`pdf_print_path` 직접 조회 거부)가 이 지시의 핵심입니다. ⑧에서 `main.tsx`의 조회 코드를 고쳐야 동작한다면(R32-4) — 고칠 곳을 보고하고, 고침은 `ui-builder`에게 위임한 뒤 검증합니다(화면 자체 교체는 U1).

## 9. C — U3 원격 실증 (`58-` 완료 기준 2)

B가 모두 통과한 뒤에만. `58-`이 쓴 `scripts/ops/verifyU3Library.ts`를 돌립니다 — 두 시험 계정 각자의 **사용자 권한**으로: 서재 목록 = 발행 호만 · 표지·쪽 이미지·PDF 서명 URL 200 · 초안 미노출 · 상대 계정도 같은 서재 · 다음 호 카드의 실제 값. **출력 원문**(서명 URL 값 제외). 앱 버그가 드러나면 고치기 전에 보고합니다.

## 10. 보안 점검 (완료 기준 4)

Supabase 보안 점검(advisors)을 읽기 전용으로 돌려, **024 이후 새 경고가 없는지** 확인합니다. 이전부터 있던 경고는 구분해 적습니다.

## 11. 2부 보고

```
## 적용 확인
- 024: {있음 / 없음}

## 권한 확인 (출력 그대로)
- pdf_print_path / 14칸 / anon: {}

## 타입 재생성
- 스키마 타입 변경: {없음 / 있음 — 멈춤} / 메타데이터: {변경 없음 / 값}

## B 실증 ①~⑧ (출력 그대로, 서명 URL 값 제외)
- {}
- ⑧ main.tsx: {동작 / 고침 필요 — 위치 / 고침 위임 결과}

## C U3 원격 실증 (출력 그대로)
- {}

## 버킷 정책
- {그대로 / 고쳐야 함 — PM 확인 대기}

## 보안 점검
- 새 경고: {없음 / 있음 — 내용} / 이전부터 있던 경고: {}

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
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기, 버킷 정책 변경
- 사람의 적용 알림 전에 2부를 시작하는 것
- 서명 URL·키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
