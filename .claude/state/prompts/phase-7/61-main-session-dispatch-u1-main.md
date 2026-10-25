# 메인 세션 지시 — U1 메인 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/61-main-session-dispatch-u1-main.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-25
>
> 짝: `61-ui-builder-u1-main.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 새 의존성·마이그레이션 없음. 커밋하지 않습니다. Deno를 쓰면 `--no-lock`.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r69'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-25-r35'
git ls-files supabase/migrations | Select-Object -Last 1
Select-String -Path package.json -Pattern '"@react-native-async-storage/async-storage"'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '61-ui-builder-u1-main'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r69 / ROADMAP r35 | 각 한 줄 |
| 마지막 마이그레이션 | 025 — `60-`이 커밋됐다 |
| AsyncStorage | 한 줄 — 이미 의존성에 있다. **없으면 멈추고 보고합니다**(이번에 의존성 추가 허가 없음) |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1288 · 64**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/61-ui-builder-u1-main.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 앱이 온도를 계산하지 않음 (저장값 읽기만), 온도 표시 상태 5가지
2. 상태 우선순위 (B05 > B04 > B06 > B03 > B01)
3. MVP에서 빼는 것 (하늘 끌어내리기 힌트, "이번 주" 인용, 제작 현황 링크)
4. 색·서체 확인 항목은 보고 항목이지 정적 검사 시험으로 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째·넷째 명령은 **빈 출력**이어야 합니다

| 확인 | 기대 |
|---|---|
| 장막 | `veilOpacity` 키 이름 그대로, 값 `0.42 / 0.30 / 0.14 / 0`. 하단 장막 460pt, 색은 토큰 |
| 온도 | 상태 5가지 분기와 시험. **온도를 계산하는 코드가 없는가**(저장값 읽기만). 36.5°는 발광 없음 · `textMute`. 증감 문구 없음 |
| 마일스톤 | 시작일 = 1일차, 7일 전 칩, 당일 B04. KST 기준 시험 |
| 빼는 것 | "끌어내리면 우리의 하늘" 힌트·끌어내리기 없음, "이번 주" 인용 없음, "제작 현황 →" 없음 |
| 우선순위 | 순수 함수 하나와 시험. 보드를 따른 곳과 순서로 고른 곳이 보고됐는가 |
| B06 | 연 적 없음 + `published_at`부터 7일 이내일 때만. AsyncStorage(사용자·호 단위), **서버 쓰기 없음**. 뷰어 쪽 변경이 그 한 줄 범위인가 |
| B05 | 36.5°, 연결 유도 문구, MY LOVE TYPE 카드, 커플 게이트로 |
| 옛 코드 | 옛 `main.tsx` "최근 발행물"과 옛 테마 import가 이 파일에서 사라졌는가 |
| 원격 실증 | 상태 4가지를 **사용자 권한**으로, 조회 결과 그대로 |
| 정적 검사 시험 | 색·서체·문자열을 코드에서 찾는 시험이 새로 생기지 않았는가(R32-3) |
| 색·서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인. 온도 숫자만 rose + 발광 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 항목 0~9: {파일·원본 보드}
2. 상태 우선순위: {보드를 따른 곳 / 순서로 고른 곳, 히어로·칸 배치}
3. 원격 실증 (출력 그대로): {상태 4가지}
4. 옛 테마 import: {제거됨 / 남음 — 파일·줄}
5. 색·서체 확인: {명령과 출력}
6. 51- 확인 목록 (12가지): {}
7. 내부 결정: {}

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
