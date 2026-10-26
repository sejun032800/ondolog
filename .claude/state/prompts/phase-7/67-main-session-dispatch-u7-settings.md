# 메인 세션 지시 — U7 설정 필수 1부 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/67-main-session-dispatch-u7-settings.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
>
> 짝: `67-ui-builder-u7-settings.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 새 의존성 · 마이그레이션 없음. 커밋하지 않습니다. Deno는 늘 `--no-lock`.

- **앞부분 (지금):** 위임 → 검증 → 보고(사람이 돌릴 실증 명령 포함). **여기서 멈춥니다.**
- **뒷부분 (사람이 "실증을 실행했다"고 알린 뒤):** 출력 파일 판정 → 보고. **원격 쓰기가 들어가는 실증은 메인 세션이 실행하지 않습니다**(R42-4).

---

# 앞부분

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r70'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-26-r42'
git ls-files supabase/migrations/026_couple_connect.sql scripts/ops/verifyCoupleConnect.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '67-'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r70 / ROADMAP r42 | 각 한 줄 |
| 026 · `verifyCoupleConnect.ts` | 두 줄 — `66-`이 커밋됐다 |
| 위임 파일 | 두 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1560 · 87**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/67-ui-builder-u7-settings.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. 쓰는 칸은 지시서 표 안에서만 — deleted_at·purge_scheduled_at·동의 시각·birth_date·onboarding_step·couple_dissolutions는 쓰지 않음. 밖의 칸이 필요하면 멈춤
2. 갈 곳 없는 항목·[연결 해제]·[회원 탈퇴]는 숨김 — 빈 화면 0
3. 재검사는 계정당 1회, 새 assessment 행 + 한 번의 UPDATE, 이전 행 보존, 재검사 INSERT의 23505는 실패
4. 원격에는 아무것도 쓰지 않음 — 실증 스크립트는 쓰기만
5. 새 의존성·마이그레이션 없음, 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase docs src/types/database.ts src/engine package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\b(deleted_at|purge_scheduled_at|birth_date|terms_agreed_at|privacy_agreed_at|ai_usage_agreed_at|marketing_agreed_at|couple_dissolutions)\b'
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\bretest_used\b'
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 여섯째 명령은 **빈 출력**이어야 합니다
- 넷째: 나온 줄 중 **이번 diff에서 새로 생긴 쓰기**가 없는지 봅니다. 기존 가입 저장 경로(`createProfileAndAssessment`)의 동의 시각 · 생년월일 쓰기는 원래 있던 것이라 그대로입니다 — `git diff`로 새 줄인지 대조합니다
- 다섯째: 쓰는 곳이 재검사 UPDATE 하나뿐인지 봅니다

| 확인 | 기대 |
|---|---|
| H01 · H02 | 숨긴 항목 목록. 남은 항목은 모두 갈 곳이 있는가 |
| H03 | 생년월일 읽기 전용 · 로그아웃 뒤 큐 유지 |
| H04 | 사귄 날짜 수정이 `set_by` = 나 · `confirmed_by` = null을 같은 UPDATE로 · A20 재표시 위치 · 닉네임 1~20자 |
| H05 | A14 · A15 · A16 재사용 · `love_type_code` 재계산 그대로 |
| H06 | 새 assessment INSERT · 한 번의 UPDATE에 `active_assessment_id` · `enneagram_inferred` · `attachment` · override null · `love_type_code` · `retest_used` · 이전 행 삭제 0 · 재검사 경로 `23505` = 실패 · assessment 고유 키 보고 |
| H11 | `legal-document` 재사용 · 문장 diff 0(`src/constants/consent.ts` · `legalDocuments.ts`) |
| 쓰는 칸 | 실제 쓰는 칸 목록이 지시서 표 안인가 |
| 실증 스크립트 | 사용자 세션 · 앞 단계 실패 시 멈춤 · null 처리 · 키 · 토큰 · URL 출력 0. **실행되지 않았는가** |
| 정적 검사 시험 | 새로 생기지 않았는가(R32-3) |
| 색 · 서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 앞부분 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 항목 1~6: {파일·원본 보드} / 숨긴 항목: {}
2. A20 재표시: {위치·방식}
3. 재검사: {assessment 고유 키(파일·줄) / 새 행 키 방식 / 23505 처리 / 오버라이드 처리}
4. 쓰는 칸: {테이블·칸·파일·줄}
5. 색·서체 확인: {명령과 출력}
6. 51- 확인 목록 (25가지): {}
7. 내부 결정: {}

## 사람이 돌릴 실증 명령 (한 줄, 키 값 없이)
{코드 블록 — 한 줄을 끊지 않는다}
- 출력 파일: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키 누출 확인: {빈 출력 O / X}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. **여기서 멈춥니다.**

---

# 뒷부분 — 사람이 "실증을 실행했다"고 알린 뒤에만

## 4. 판정

`scripts/ops/out/`의 출력 파일을 읽어 ①~⑦ 항목별로 판정합니다. 처음 실행한 스크립트에서 구문 오류가 났으면 고치기 전에 보고합니다. 스크립트 결함이면 쓴 에이전트(ui-builder)에게 스크립트만 고치게 하고, **실행은 다시 사람에게** 맡깁니다.

## 5. 뒷부분 보고

```
## 실증 ①~⑦ (출력 파일 기준)
- 대상 커플: {test-66- / test-67- 새로}
- ① 이름: {} / ② 사귄 날짜: {} / ③ A20 재확인: {} / ④ 닉네임: {}
- ⑤ 재검사: {assessment 행 수 / active / override / love_type_code / retest_used}
- ⑥ 두 번째 재검사 차단: {} / ⑦ onboarding_step: {}

## 게이트 (메인 세션 재실행)
- jest 마지막 요약 줄 (그대로): {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 새 의존성, 마이그레이션, 허가 밖 설정 변경
- **원격 쓰기가 들어가는 실증을 메인 세션이 실행하는 것**
- 키 · 토큰 · URL을 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
