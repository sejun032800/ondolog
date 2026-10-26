# 메인 세션 지시 — `66-` 커플 연결 함수(026) · A14 결함 · 연애유형 코드

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/66-main-session-dispatch-couple-connect.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
>
> 짝: `66-db-architect-couple-connect.md` → `66-ui-builder-couple-connect-app.md` (이 순서)

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 새 의존성 없음. 023~025와 같이 두 부분입니다. Deno는 늘 `--no-lock`.

- **1부 (지금):** db-architect 위임(026 · 실증 스크립트) → ui-builder 위임(앱 · 실증 스크립트) → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 026을 원격 개발에 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 실증(사람이 실행) → 타입 재생성 → 보고

**마이그레이션 적용과 시험 계정을 만드는 실증 실행은 사람이 합니다**(절대 규칙 6, R40-5). 파괴적 배치 함수는 부르지 않습니다(R34-3).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-26-r40'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '## 9-F. 커플 연결'
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files src/services/chatQueueHub.ts scripts/ops/verifyU6Part2.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '66-'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r40 · SCHEMA §9-F | 각 한 줄 |
| 마이그레이션 마지막 2개 | 마지막이 025. **026이 이미 있으면 멈춥니다** |
| `chatQueueHub.ts` · `verifyU6Part2.ts` | 두 줄 — `65-`와 실증 스크립트가 커밋됐다 |
| 위임 파일 | 세 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1551 · 85**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임 ① — db-architect

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/66-db-architect-couple-connect.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 앱이 couples의 연결 칸 7개를 UPDATE하는 곳이 있으면 026을 쓰기 전에 멈춤
2. SCHEMA §9-F 그대로 — SELECT 정책은 넓히지 않음, couples 외 테이블·다른 정책은 건드리지 않음
3. 원격에는 읽기 전용 조회만 — 적용·실증 실행 없음
4. 실증 스크립트는 사용자 세션 기본, 앞 단계 실패 시 멈춤

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

**db-architect가 멈췄으면 ui-builder로 가지 않고 그 지점에서 보고합니다.**

## 2. 위임 ② — ui-builder (①이 026을 쓴 뒤에만)

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/66-ui-builder-couple-connect-app.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 함수 이름·오류 코드는 새 026 파일에서 읽음 — 026은 고치지 않음
2. love_type_code 계산은 엔진의 기존 함수, src/engine diff 0
3. 원격에는 아무것도 쓰지 않고, 스크립트도 실행하지 않음
4. 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 3. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- docs src/types/database.ts src/engine package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern "from\('couples'\)"
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\benneagram_effective\b'
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 여섯째 명령은 **빈 출력**이어야 합니다. 새 026 파일은 `??`로만 보입니다
- 넷째: 나온 줄 중 쓰기 호출이 db-architect의 칸 목록과 맞는지, `redeemInviteCode`에 직접 UPDATE가 남지 않았는지 대조합니다
- 다섯째: 나온 줄이 **읽기 · 타입 · 계산 결과 표시뿐**이고 쓰기 객체에 없는지 봅니다

| 확인 | 기대 |
|---|---|
| 칸 목록 | 앱이 `couples`에 쓰는 칸이 파일 · 줄로 나왔는가. 연결 칸 7개 UPDATE 0(있었으면 멈췄는가) |
| 026 | §9-F의 확인 순서 · 직렬화(두 `profiles` 잠금) · 같은 오류 하나 · B의 다른 대기 행 삭제 · 멱등 · `set search_path = ''` · `public.` 접두사 · `authenticated`만 · 테이블 UPDATE 회수 + 칸 단위 부여(주석에 목록) · 정책 두 개 변경 · **그 밖의 정책 · 테이블 변경 없음** · SELECT 정책 그대로 |
| 만료 조건 | null 처리 결정과 근거 |
| 앱 | `redeemInviteCode` RPC · 오류 3종 보드 문구 · 주석 정정 · 생성 칸 쓰기 0(찾은 곳 전부) · `love_type_code` 같은 UPDATE · `src/engine` diff 0 |
| 실증 스크립트 둘 | 사용자 세션 · 앞 단계 실패 시 멈춤 · null 처리 · 키 · 토큰 · URL 출력 0. **실행되지 않았는가** |
| 정적 검사 시험 | 새로 생기지 않았는가(R32-3) |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 4. 적용 전 확인 — 원격, 읽기 전용

db-architect가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다.

## 5. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## db-architect
- 앱이 couples에 쓰는 칸: {UPDATE / INSERT — 파일·줄·칸}
- 멈춤: {없음 / 있음 — 목록}
- 보안 점검 기준선: {파일 / 요약}
- 026: {경로 / 함수 이름 / 만료 조건 결정·근거} (전문은 파일로)
- 타입 재생성에서 추가될 것: {}
- 사람이 쓸 적용 명령: {}
- 적용 전 확인 결과: {}

## ui-builder
- 연결 RPC 전환·오류 문구: {}
- 생성 칸: {목록 / 찾은 쓰기 경로 / 고친 곳}
- love_type_code: {파일·줄 / 쓴 엔진 함수 / 바꾼 화면}
- 실증 스크립트: {변경 요약}

## 2부에서 사람이 돌릴 명령 (한 줄씩, 키 값 없이)
- 026 실증: {}
- 두 계정 온보딩 실증: {}

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

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 명령은 한 줄을 끊지 말고 코드 블록에 넣습니다. **여기서 멈춥니다.**

---

# 2부 — 사람이 "026을 원격 개발에 적용했다"고 알린 뒤에만

## 6. 적용 확인

원격 migration 기록에 026이 있는지 확인합니다(읽기 전용). 없으면 멈춥니다.

## 7. 권한 확인

권한 확인 SQL을 **읽기 전용으로** 돌려 출력 원문을 보존합니다. anon false · authenticated true · service_role false · `prosecdef` true · `search_path` 고정 · `couples` 칸 권한이 목록대로가 아니면 8 이후로 가지 않고 보고합니다.

## 8. 실증 — 사람이 실행

1부 보고의 명령 두 줄을 **사람이 PowerShell에서** 돌립니다. 메인 세션은 실행하지 않습니다. 사람이 "실행했다"고 알리면 `scripts/ops/out/`의 출력 파일을 읽어 아래를 판정합니다.
- 026 실증 ①~⑫ 항목별 O/X, ⑫ 보안 점검 비교표(기준선 / 026 후)
- 두 계정 온보딩: 가입 → A14(프로필 생성 성공, 대체 경로 없음) → A16(`love_type_code` 변화) → A17 → B가 A18 → **연결 성공** → A19 → A20 → 채팅 탭 없이 재시작 → 큐 전송(객체 · 행 각 1). 단계별 `onboarding_step` · `couples` 값
- 원격 시험 데이터의 틀린 `love_type_code`(`test-65-a-*` · `test-65-b-*`의 RHF)는 **앱 경로로 오버라이드를 다시 써서** 바로잡혔는가(스크립트가 하는 일인지 1부 보고와 대조). SQL로 직접 고치지 않습니다
- 처음 실행하는 스크립트에서 구문 오류가 나면 고치기 전에 보고합니다

## 9. 타입 재생성

SCHEMA §9-D-10 그대로(기존 명령). **추가는 함수 1개만**이 기대값입니다. 그 밖의 스키마 타입 diff가 있으면 멈춥니다(`__InternalSupabase` 메타데이터는 적기만, R31-3).

## 10. 2부 보고

```
## 적용 확인
- 026: {있음 / 없음}

## 권한 확인 (출력 그대로)
- {}

## 026 실증 ①~⑫ (출력 그대로, 키·토큰·URL 없음)
- {항목별 O/X}
- ⑫ 보안 점검 비교표: {기준선 / 026 후}

## 두 계정 온보딩 실증 (출력 그대로)
- {단계별 결과 · onboarding_step · couples}
- love_type_code 바로잡음: {}

## 타입 재생성
- 추가: {} / 그 밖의 변경: {없음 / 있음 — 멈춤} / 메타데이터: {}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 51- 확인 목록
- 24가지 그대로인지, 연결 항목이 "사용자 권한 연결(두 기기)"로 적혀 있는지

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기, **시험 계정을 만드는 실증을 메인 세션이 실행하는 것**
- 파괴적 배치 함수 호출
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키 · 토큰 · 서명 URL을 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
