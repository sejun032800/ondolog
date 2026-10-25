# 메인 세션 지시 — U6 온보딩 2부 + 큐 재개 시점 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/65-main-session-dispatch-u6-part2.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-25
>
> 짝: `65-ui-builder-u6-part2.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 새 의존성 · 마이그레이션 없음. 커밋하지 않습니다. Deno를 쓰면 `--no-lock`.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r70'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-25-r39'
git ls-files src/services/photoQueueFs.ts scripts/ops/verifyExistingAccount.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '65-ui-builder-u6-part2'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r70 / ROADMAP r39 | 각 한 줄 |
| `photoQueueFs.ts` · `verifyExistingAccount.ts` | 두 줄 — `64-`가 커밋됐다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1496 · 81**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/65-ui-builder-u6-part2.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. §0(큐 재개 시점)을 가장 먼저 하고 다른 변경과 섞지 않음 — 사람이 따로 먼저 커밋한다
2. A14·A15 고정 문장은 지시서 글자 그대로, 보드와 달라도 이 문장
3. 엔진(src/engine)·연결 로직·A20 규칙은 바꾸지 않고 화면만
4. onboarding_step은 기존 함수로만 올림
5. 새 의존성·마이그레이션 없음, 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs src/engine package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern '\bonboarding_step\b'
Get-ChildItem app/(onboarding) -Recurse -File | Select-String -Pattern "from '.*theme"
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 여섯째 명령은 **빈 출력**이어야 합니다
- 넷째: `64-` 때의 목록(`onboardingStepCore` 갱신 하나 · 위임 다섯 곳 · 읽기 · 상수 · 타입)에서 **새로 직접 쓰는 곳이 늘지 않았는지** 대조합니다
- 다섯째: 나온 줄이 Nocturne 테마(`nocturne`)뿐인지 봅니다. 옛 테마가 남으면 보고와 맞는지 대조합니다
- 다섯째 명령의 `app/(onboarding)` 경로가 PowerShell에서 오류를 내면 `-LiteralPath 'app/(onboarding)'`로 바꿔 다시 돌립니다

| 확인 | 기대 |
|---|---|
| §0 묶음 | 다른 변경과 **따로** 보고됐는가. 재개를 한 곳에서 관리하고 동시 업로드 0 시험이 있는가. 비커플 · 로그아웃 시 정지, 로그아웃해도 큐 유지 |
| `verifyU6Signup.ts` | 다시 돌린 출력이 붙었는가 |
| A14 · A15 | 고정 문장이 지시서와 **글자 그대로** 같은가(diff로 직접 봅니다). 단정 문장 없음. 공유 버튼 숨김 |
| A16 | `enneagram_override`만 쓰고 `enneagram_inferred`는 그대로인가 |
| A17 · A18 | 기존 `Share` + `selectable` · [솔로예요] 동작 보고 · 연결 · 오류 판정 로직 diff 없음 |
| A19 · A20 | 닉네임 1~20자 · 미래 날짜 불가 시험 · A20 규칙 파일 · 줄 |
| 옛 코드 | 세 컴포넌트와 그것만 쓰는 시험이 지워졌는가. 못 지운 것은 이유 |
| 원격 실증 | 두 계정 각 단계 뒤 `onboarding_step` · `couples` 값, 오버라이드 두 값 보관, 채팅 탭 없이 재시작 → 전송. **사용자 권한**, 출력에 키 · 토큰 · URL 없음 |
| 정적 검사 시험 | 색 · 서체 · 문자열을 코드에서 찾는 시험이 새로 생기지 않았는가(R32-3) |
| 색 · 서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## §0 큐 재개 시점 (따로 커밋할 묶음)
- 파일 목록: {}
- 관리하는 곳 / 진행 중 표시 / 채팅 탭 재개 남김 여부: {}
- verifyU6Signup.ts 출력: {}

## U6 온보딩 2부
1. 항목 1~10: {파일·원본 보드}
2. 보드와 다르게 한 곳: {}
3. A17 [솔로예요]: {코드가 하는 그대로}
4. A20 규칙 위치: {파일·줄}
5. 옛 코드 정리: {지운 것 / 못 지운 것·이유 / 남은 옛 테마 import}
6. 원격 실증 (출력 그대로): {단계별 onboarding_step·couples / 오버라이드 / 큐}
7. 색·서체 확인: {명령과 출력}
8. 51- 확인 목록 (24가지): {}
9. 내부 결정: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경 · 삭제: {없음 / 파일·줄·이전 → 이후, 지운 시험 건수}
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

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. 한 줄이 길어지면 줄을 나눕니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 새 의존성, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
