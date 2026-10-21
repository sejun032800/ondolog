# 메인 세션 지시 — UI 기반 U0 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/53-main-session-dispatch-ui-foundation.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-21
>
> 짝: `53-ui-builder-ui-foundation.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. `52-r3`과 디자인 묶음이 커밋된 뒤에 돌립니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-21-r61'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-21-r19'
Test-Path docs/design/nocturne/README.md, docs/design/nocturne/screens_index.csv, docs/design/nocturne/boards, assets/grain.png, assets/sky_world.jpg
(Get-ChildItem docs/design/nocturne/screens -File).Count
(Get-ChildItem docs/design/nocturne/canvas -File).Count
git ls-files docs/design/nocturne/README.md assets/grain.png
Select-String -Path package.json -Pattern '"react-native-reanimated"'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '53-ui-builder-ui-foundation'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 — `52-r3`과 디자인 묶음이 커밋됐다 |
| MASTER r61 / ROADMAP r19 | 각 한 줄 |
| `Test-Path` | `True` 다섯 줄 |
| `screens` 파일 수 | `109` |
| `canvas` 파일 수 | `42` |
| `git ls-files` (README·grain) | 두 줄 — 디자인 묶음이 커밋됐다 |
| `react-native-reanimated` | 한 줄 — 이미 의존성에 있다. 없으면 멈추고 보고합니다(이번 허가는 svg·worklets뿐) |
| 위임 파일 | 한 줄 |

숫자가 다르면 위임하지 말고 실제 숫자를 보고합니다.

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / `52-r3` 완료 보고의 숫자** — Proteur가 위임 메시지와 함께 알려줍니다. 다르면 위임하지 않습니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/53-ui-builder-ui-foundation.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 이번 범위와 범위 밖 (화면 교체 없음)
2. 의존성 1회 허가의 대상과 범위
3. 색·서체 확인 항목 넷

허가 밖의 설정 변경이 필요하면 바꾸지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff -- package.json
git diff --stat -- supabase docs tsconfig.json babel.config.js app.json eas.json
```

| 확인 | 기대 |
|---|---|
| `package.json` | 의존성 두 줄(`react-native-svg`·`react-native-worklets`)만 늘었는가 |
| lock | 변경이 두 의존성과 그 하위 의존성 범위인가. `zod`·`@supabase/supabase-js` 해석 버전이 바뀌었다면 `deno.json`도 같이 바뀌었는가 |
| 마지막 명령 | **빈 출력** — 단, `deno.json`을 맞춘 경우 그 한 파일만 나온다 |
| 범위 | 옛 화면 파일의 색·서체가 바뀌지 않았는가. 바뀐 기존 파일은 `app/_layout.tsx`·`(tabs)/_layout.tsx`(와 HANDOFF·PROGRESS)뿐인가 |
| 파일명 | 새 파일 basename이 `^[A-Za-z0-9._-]+$`인가 |
| 확인 화면 | `__DEV__`에서만 닿는가. 출시 빌드에서 닿지 않는 방식이 보고됐는가 |
| 색·서체 확인 | 보고된 명령을 **메인 세션이 다시 돌려** 하드코딩 색·`textFaint` 글자색·`fontWeight`·`lilac` 12pt 이하가 0건인가 |
| 모션 | 블러·카운트업·진행률 채움·스피너가 없는가. 동작 줄이기에서 명멸·진입 모션이 멈추는가 |
| 게이트 | tsc 0 / 0, jest 기준선 대비 감소 없음 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X, 파일 수 109 / 42} / 기준선: {}

## 산출
1. 항목 1~8: {파일·원본 보드}
2. 녹화: {경로 / 못 함 — 막은 것}
3. 색·서체 확인: {명령과 출력}
4. 의존성: {svg 버전 / worklets 버전 / lock 범위 / babel 필요 여부 / deno.json 영향}
5. nocturne.ts 값 개수·원본과 다른 점: {}

## 변경
- git diff --stat: {}
- 허가 밖 변경: {없음 / 있음 — 내용}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {}
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
- 허가 밖의 의존성·설정 변경
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
