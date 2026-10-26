# 메인 세션 지시 — `68-` 연결 해제 · 회원 탈퇴 · 재검사 함수 · 칸 단위 쓰기 (027)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/68-main-session-dispatch-dissolution-027.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
>
> 짝: `68-db-architect-dissolution-027.md` → (조건부) `68-corner-pipeline-active-only.md` → `68-ui-builder-dissolution-deletion.md` (이 순서)

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 새 의존성 없음. 026과 같이 두 부분입니다. Deno는 늘 `--no-lock`.

- **1부 (지금):** db-architect(조사 + 027) → (조건부) corner-pipeline → ui-builder → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 027을 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 실증 판정(사람이 실행) → 타입 재생성 → 보고

**마이그레이션 적용과 원격 쓰기가 들어가는 실증 실행은 사람이 합니다**(절대 규칙 6, R42-4). **파괴적 배치 함수(`execute_dissolution` · `apply_retention_policy`)는 어떤 경로로도 부르지 않습니다**(R34-3).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-26-r43'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '## 9-G. 연결 해제'
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files scripts/ops/verify67Settings.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '68-'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r43 · SCHEMA §9-G | 각 한 줄 |
| 마이그레이션 마지막 2개 | 마지막이 026. **027이 이미 있으면 멈춥니다** |
| `verify67Settings.ts` | 한 줄 — `67-`이 커밋됐다 |
| 위임 파일 | 네 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1626 · 90**, Python **122**. **jest가 다르면 실패한 시험 이름과 출력 꼬리(마지막 40줄)를 남기고 한 번 다시 돌립니다**(R43-8). 다시 돌려도 다르면 위임하지 않고 보고합니다.

## 1. 위임 ① — db-architect

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/68-db-architect-dissolution-027.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. §0 조사 a~e를 먼저, 결과를 보고 첫머리에
2. 멈춤은 "지시서가 바꾸라고 지정한 경로(해제·탈퇴·재검사) 말고 금지 칸을 쓰는 앱 코드가 있을 때"만
3. SCHEMA §9-G 그대로 — execute_dissolution·apply_retention_policy·pg_cron은 바꾸지도 부르지도 않음
4. 원격에는 읽기 전용 조회만 — 적용·실증 실행 없음
5. 실증 스크립트는 사용자 세션, 끝에서 해제·탈퇴 취소, test-68-purge 하나만 남김

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

**db-architect가 멈췄으면 다음 위임으로 가지 않고 그 지점에서 보고합니다.**

## 2. 위임 ② — corner-pipeline (조사 0-c에서 `active`만 대상으로 삼지 않는 곳이 나왔을 때만)

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/68-corner-pipeline-active-only.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.

db-architect 조사 0-c 결과(그대로 붙임):
{0-c 결과 — 파일·줄}

착수 전에 확인: 원격에 쓰지 않음, 운영자 명령을 실제로 돌리지 않음, DB·앱 코드는 건드리지 않음.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

`{…}`는 **채워서** 보냅니다. 0-c가 "모두 `active`만"이었으면 이 위임은 하지 않고 보고에 "해당 없음"으로 적습니다.

## 3. 위임 ③ — ui-builder (027을 쓴 뒤에만)

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/68-ui-builder-dissolution-deletion.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

db-architect 조사 결과(그대로 붙임):
- 0-a 생체정보 진입점: {}
- 0-d 앱 쓰기 칸 목록: {}

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 함수 이름·인자·오류 코드는 새 027 파일에서 읽음 — 027은 고치지 않음
2. 직접 쓰기(couple_dissolutions·retest_used·active_assessment_id·deleted_at 등)가 앱에 남지 않음
3. 원격에는 아무것도 쓰지 않고, 스크립트도 실행하지 않음
4. 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 4. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- docs src/types/database.ts src/engine package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern "from\('couple_dissolutions'\)"
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\b(retest_used|active_assessment_id|deleted_at|purge_scheduled_at)\b'
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\b(execute_dissolution|apply_retention_policy)\b'
$ref = (Get-Content supabase/.temp/project-ref -Raw).Trim(); (Get-ChildItem scripts, supabase/migrations, src, app -Recurse -File | Select-String -SimpleMatch -Pattern $ref | Measure-Object).Count
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 여섯째 · 여덟째 명령은 **빈 출력**이어야 합니다
- 일곱째: 출력이 **`0`**이어야 합니다(R41-6 — 개수만 출력하므로 ref 값은 화면에 나오지 않습니다). 0이 아니면 파일 목록을 ref 없이 보고합니다
- 넷째: 나온 줄이 **읽기(select)뿐**인지 봅니다
- 다섯째: 나온 줄이 **읽기 · 타입 · 함수 인자**뿐이고 직접 쓰기 객체에 없는지 봅니다

| 확인 | 기대 |
|---|---|
| 조사 a~e | 결과가 파일 · 줄로 나왔는가. e(운영자 스크립트의 `onboarding_step` 감소)가 있으면 보고됐는가 |
| 027 | §9-G 함수 다섯 · 유예 서버 계산 · 재검사 복구 · `profiles.mbti` · 실행 권한 · `couple_dissolutions` 회수 · `profiles` · `personality_profiles` 칸 단위(주석에 목록) · 트리거 · INSERT `with check` · **`service_role` 테이블 권한 그대로** · **배치 함수 · pg_cron 변경 없음** · SELECT 정책 그대로 |
| 본문 대조 | 새 함수가 만든 해제 행을 `execute_dissolution`이 그대로 처리하는지 결과 |
| corner-pipeline | 수정했으면 `active`만 통과 시험 · 발행 경로 확인 결과. 안 했으면 "해당 없음" 근거 |
| 앱 | H14 · H16 · 재검사 · 마케팅 · 생체정보 진입점 · 직접 쓰기 0 · 유예 화면 양쪽 · 탈퇴 유예 중 로그인 |
| 스크립트 넷 | 027 실증 · purge 확인(읽기 전용) · 회귀(재검사 없음) — 사용자 세션 · 앞 단계 실패 시 멈춤 · 키 · 토큰 · URL · ref 출력 0. **실행되지 않았는가** |
| 정적 검사 시험 | 새로 생기지 않았는가(R32-3) |
| 색 · 서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 5. 적용 전 확인 — 원격, 읽기 전용

db-architect가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다.

## 6. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / jest 다시 돌림: {없음 / 실패 시험 이름·꼬리}

## 조사 (db-architect §0)
- a 생체정보 진입점: {}
- b 생성 쪽 MBTI 칸: {}
- c 생성·발행 대상 active 한정: {}
- d 앱 쓰기 칸: {profiles / personality_profiles / couple_dissolutions}
- e 운영자 스크립트 onboarding_step 감소: {}

## db-architect
- 멈춤: {없음 / 있음 — 목록}
- 보안 점검 기준선: {파일 / 요약}
- 027: {경로 / 함수 다섯 이름 / 탈퇴 사유 enum / 칸 단위 목록 / 재검사 복구 구분} (전문은 파일로)
- execute_dissolution 본문 대조: {}
- 타입 재생성에서 추가될 것: {}
- 사람이 쓸 적용 명령: {}
- 적용 전 확인 결과: {}

## corner-pipeline
- {수정 내용·시험 / 해당 없음 — 근거}

## ui-builder
- H14·H16·재검사·마케팅·생체정보 진입점: {파일·보드}
- 상대가 해제를 처음 보는 곳 / 탈퇴 유예 화면 / 재검사 복구 화면: {}
- 직접 쓰기 제거: {}

## 2부에서 사람이 돌릴 명령 (한 줄씩, 키 값 없이, 끊지 않음)
- 027 실증: {}
- test-66- 회귀: {}
- test-68-purge 확인(유예 끝 뒤에): {} / 돌릴 날짜: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키·ref 누출 확인: {빈 출력 O / X}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 51- 확인 목록
- {27가지 — 더한 두 줄}

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 명령은 한 줄을 끊지 말고 코드 블록에 넣습니다. **여기서 멈춥니다.**

---

# 2부 — 사람이 "027을 원격 개발에 적용했다"고 알린 뒤에만

## 7. 적용 확인

원격 migration 기록에 027이 있는지 확인합니다(읽기 전용). 없으면 멈춥니다.

## 8. 권한 확인

권한 확인 SQL을 **읽기 전용으로** 돌려 출력 원문을 보존합니다. 함수 다섯이 anon false · authenticated true · service_role false · `prosecdef` true · `search_path` 고정이 아니거나, 칸 · 정책이 027 주석의 목록과 다르면 9 이후로 가지 않고 보고합니다.

## 9. 실증 판정 — 사람이 실행

1부 보고의 명령 중 **027 실증**과 **`test-66-` 회귀**를 사람이 PowerShell에서 돌립니다. 메인 세션은 실행하지 않습니다. 사람이 "실행했다"고 알리면 `scripts/ops/out/`의 출력 파일로 판정합니다.
- 027 실증: SCHEMA §9-G "실증" 목록 항목별 O/X · 끝에서 해제 · 탈퇴 취소 · `test-68-purge` 해제가 남았는지(`purge_scheduled_at` · 확인 날짜) · 보안 점검 비교표(기준선 / 027 후)
- 회귀: 이름 · 날짜 · 닉네임 · 오버라이드 · `onboarding_step` 같은 값 쓰기가 칸 단위 부여 뒤에도 동작
- 스크립트 결함이면 쓴 에이전트에게 스크립트만 고치게 하고, **실행은 다시 사람에게** 맡깁니다

## 10. 타입 재생성

SCHEMA §9-D-10 그대로(기존 명령). **추가는 함수 5개만**이 기대값입니다. 그 밖의 스키마 타입 diff가 있으면 멈춥니다(`__InternalSupabase` 메타데이터는 적기만, R31-3).

## 11. 2부 보고

```
## 적용 확인
- 027: {있음 / 없음}

## 권한 확인 (출력 그대로)
- {}

## 027 실증 (출력 파일 기준)
- {항목별 O/X}
- test-68-purge: {해제 남음 / purge_scheduled_at / 확인 날짜}
- 보안 점검 비교표: {기준선 / 027 후}

## test-66- 회귀 (출력 파일 기준)
- {항목별 O/X}

## 타입 재생성
- 추가: {} / 그 밖의 변경: {없음 / 있음 — 멈춤} / 메타데이터: {}

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

- 직접 구현, 위임 프롬프트 요약 · 보강
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기, **원격 쓰기가 들어가는 실증을 메인 세션이 실행하는 것**
- **파괴적 배치 함수 호출**(어떤 경로로도)
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키 · 토큰 · 서명 URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
