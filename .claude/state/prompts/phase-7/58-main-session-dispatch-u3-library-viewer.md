# 메인 세션 지시 — U3 서재·뷰어 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/58-main-session-dispatch-u3-library-viewer.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
>
> 짝: `58-ui-builder-u3-library-viewer.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 원격 **개발** 프로젝트는 읽기만 합니다(시험 계정 로그인 포함). 새 의존성·마이그레이션 없음. 커밋하지 않습니다. Deno를 쓰면 늘 `--no-lock`(R31-7).

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-24-r68'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-24-r31'
git ls-files src/components/nocturne/ConfirmDialog.tsx
Select-String -Path package.json -Pattern '"react-native-gesture-handler"|"react-native-reanimated"'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '58-ui-builder-u3-library-viewer'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r68 / ROADMAP r31 | 각 한 줄 |
| `ConfirmDialog.tsx` | 한 줄 — `57-`이 커밋됐다 |
| gesture-handler · reanimated | **두 줄** — 이미 의존성에 있다. 하나라도 없으면 멈추고 보고합니다(이번에 의존성 추가 허가 없음) |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1209 · 59**, Python 시험 **122건**(`55-1`이 쓴 명령). 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/58-ui-builder-u3-library-viewer.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 서재에는 발행된 호만, 인쇄 PDF 경로는 어디에도 없음 (절대 규칙 3)
2. VOL 번호는 표지 밖 라벨로만, 표지 그림 위에 얹지 않음
3. 속표지 고지 문구는 지시서의 PM 문장을 쓰고 디자인 보드 문장은 쓰지 않음
4. 새 의존성 없음, 서명 URL을 로그·보고에 남기지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -Pattern 'pdf_print_path|magazine-print'
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째·넷째·다섯째 명령은 **빈 출력**이어야 합니다 — 넷째는 인쇄 PDF로 가는 경로가 앱에 없는지 봅니다(리터럴 검색)

| 확인 | 기대 |
|---|---|
| D01 서재 | 발행된 호만. 초안을 뷰가 거르는지 앱이 거르는지 보고됐는가. 최신순 |
| VOL 라벨 | 표지 **밖** "VOL.NN · N월호", 발행된 호에만. 표지 이미지 위에 번호가 없는가 |
| 다음 호 카드 | 진행률 = 기간 경과율(정지 값, 채움 애니메이션 없음). 빈 결과면 D14 계열 문구. "제작 현황 →" 링크가 없는가 |
| D14·D16 | 발행 0권 → D14, 미연결 → D16 분기 시험 |
| D10 속표지 | 종이 바탕(`paper` 계열). **고지 문구가 PM 문장인가 — 보드의 "편집 외의 각색은 하지 않았습니다"가 없는가.** 문구가 상수 한 곳에 있는가 |
| D11 뷰어 | 가로 넘김 · 핀치 줌 · 두 번 탭. 쪽 경로 시험. 서명 URL 만료 시 다시 받는가 |
| D12 목차 | 진입 버튼이 없고, 매니페스트 자리(빈 함수·타입)만 있는가 |
| PDF | `pdf_digital_path` 서명 URL을 `Linking`으로. 인쇄 PDF 경로 0건 |
| 원격 실증 | 두 계정 각자의 **사용자 권한**으로: 발행 호만 · 표지·쪽·PDF 200 · 초안 미노출 · 같은 서재. 출력에 **서명 URL 값이 없는가** |
| 색·서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인. `moon`이 발행 호·Vol·속표지 순간에만 쓰였는가 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 항목 1~7: {파일·원본 보드}
2. 원격 실증 (출력 그대로, 서명 URL 값 제외): {계정 A / 계정 B / 초안 미노출 / 상태 코드}
3. issues_public 초안 처리: {뷰가 거름 / 앱이 거름 — 근거}
4. 다음 호 카드 실제 값: {}
5. 색·서체 확인: {명령과 출력}
6. 51- 확인 목록 (11가지): {}
7. 내부 결정: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 인쇄 PDF 경로 검색: {빈 출력 O / X}
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
- 새 의존성, 마이그레이션, 허가 밖 설정 변경, 원격 쓰기
- 서명 URL·키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
