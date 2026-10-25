# 메인 세션 지시 — U4 채팅 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/62-main-session-dispatch-u4-chat.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-25
>
> 짝: `62-ui-builder-u4-chat.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 새 의존성·마이그레이션 없음. 커밋하지 않습니다. Deno를 쓰면 `--no-lock`.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r69'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-25-r36'
git ls-files src/utils/mainScreen.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '62-ui-builder-u4-chat'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r69 / ROADMAP r36 | 각 한 줄 |
| `mainScreen.ts` | 한 줄 — `61-`이 커밋됐다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1355 · 68**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/62-ui-builder-u4-chat.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. §0 손질(a~d)을 가장 먼저 하고 다른 변경과 섞지 않음 — 사람이 따로 먼저 커밋한다
2. 채팅 기능(실시간·오프라인 큐·스토리)의 동작은 바꾸지 않고 화면만
3. 공유 카드 예고 문구, "잡지에 실릴 수 있다" 안내를 새로 넣지 않음
4. 새 의존성 없음, 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern 'computeDaysTogether'
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째·넷째·다섯째 명령은 **빈 출력**이어야 합니다 — 넷째는 옛 UTC 함수가 남지 않았는지 봅니다(R36-3)

| 확인 | 기대 |
|---|---|
| §0 손질 | a~d가 다른 변경과 **따로** 보고됐는가. a: 36.5° = `textSub`, b: 경과율·재료 수가 함수 하나, c: 옛 함수 삭제·바꾼 곳 목록, d: `#C08A64` 토큰 |
| F01 | D+N이 KST 함수. 원문이 Pretendard(MaruBuri 아님). 읽음 = 숫자 1 |
| F02 | 옛 `CoupleGate`·옛 테마 import가 사라졌는가. 게이팅(채팅 = 진입 즉시 초대) 그대로. 초대 로직은 기존 것 |
| F03~F06 | 스토리 "고르면 바로 올린다" 그대로 · 시스템 선택기 · F05 스피너 없음 · F06 U3 제스처 재사용 · 스토리·사진 크게 보기는 시트 ✕ |
| 기능 불변 | 실시간 구독·오프라인 큐·스토리 서비스 코드의 **동작 변경이 없는가**(diff로 — 바뀌었다면 이유) |
| 규칙 7 | `chatApi.sendMessage`의 빈 본문 거부가 화면과 **같은 함수**인가. DB 제약 없음 |
| 규칙 8·9 | 공유 카드 예고 문구 없음, "잡지에 실릴 수 있다" 안내를 새로 넣지 않음. 보드에 있었는데 뺀 문구가 보고됐는가 |
| 원격 실증 | 두 계정 각자 **사용자 권한**: A 전송 → B 실시간 수신 · 사진 메시지 · 빈 본문 API 거부. 출력에 키·토큰·URL 없음 |
| 정적 검사 시험 | 색·서체·문자열을 코드에서 찾는 시험이 새로 생기지 않았는가(R32-3) |
| 색·서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## §0 손질 (따로 커밋할 묶음)
- 파일 목록: {}
- a / b / c(바꾼 곳) / d: {}

## U4
1. 항목 1~9: {파일·원본 보드}
2. 원격 실증 (출력 그대로): {실시간 수신 / 사진 / 빈 본문 거부}
3. 규칙 8·9: {뺀 문구 / 기존 안내 위치}
4. 옛 CoupleGate·테마: {사라짐 / 남음 — 위치}
5. 기능 불변: {서비스 코드 diff 요약}
6. 색·서체 확인: {명령과 출력}
7. 51- 확인 목록: {}
8. 내부 결정: {}

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

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 새 의존성, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
