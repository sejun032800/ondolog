# 메인 세션 지시 — 입력 조립 후속 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/45-main-session-dispatch-input-assembly-followup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-09
>
> 짝: `45-corner-pipeline-input-assembly-followup.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r50'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r9'
git ls-files supabase/functions/_shared | Select-String -Pattern 'inputAssembly.ts', 'kstTime.ts'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '45-corner-pipeline-input-assembly-followup'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r50 / ROADMAP r9 | 각 한 줄 |
| `inputAssembly.ts`·`kstTime.ts` | 두 줄 — `44-` r2가 커밋됐다 |
| 위임 파일 | 한 줄 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 983 · 49**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/45-corner-pipeline-input-assembly-followup.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 이번에 할 일 세 가지와 각각의 원본 절
2. 바꿀 수 있는 파일과 테스트의 범위
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- docs src/types/corners supabase/functions/_shared/corners package.json tsconfig.json supabase/functions/tsconfig.json
```

- 마지막 명령은 **빈 출력**이어야 합니다
- 바뀐 파일이 `inputAssembly.ts`, `kstTime.ts`(또는 `kstDisplayStamp`가 있는 곳), `44-`에서 만든 테스트, HANDOFF, PROGRESS뿐인지 봅니다
- 시간대 테스트가 바뀌었으면 `git diff`로 **`kstTime` describe 밖이 그대로인지** 확인합니다

| # | 확인 |
|---|---|
| 1 | 크기 없는 사진만 있는 과거 데이트가 후보에서 빠지는 시험이 있는가. 후보 판정이 D·F에서 남는 사진을 세는가 |
| 2 | 출처 표기 값에 `— `가 없는가. 한 자리 월·일·시·분으로 두 자리 표기를 시험하는가 |
| 3 | 에이전트가 보고한 **원래 세는 범위**. 맞췄다면 재소환 후보의 잠긴 사진을 세지 않는다는 시험이 있는가 |
| 고친 기댓값 | 에이전트가 보고한 이전 값·새 값·근거가 r50 문장과 맞는가 |
| 게이트 | 0 / 0, jest 983 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 변경
- git diff --stat: {}
- 범위 밖 변경: {없음 / 있음}

## 1~3
| # | 변경 전 | 변경 후 | 시험 위치 |
|---|---|---|---|

## 고친 기댓값 (있으면)
- {파일:줄 — 이전 → 새 — 근거}

## 게이트
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
