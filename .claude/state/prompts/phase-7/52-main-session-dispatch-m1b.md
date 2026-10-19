# 메인 세션 지시 — M1b 프롬프트 고도화 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/52-main-session-dispatch-m1b.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-19
>
> 짝: `52-corner-pipeline-m1b-prompt-refinement.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 API 호출은 없습니다.** 커밋하지 않습니다. `50r2-`가 커밋된 뒤에 돌립니다.

## 0. 사전 점검

**관문**

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-19-r58'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-19-r16'
git ls-files scripts/ops supabase/functions/deno.json | Select-Object -First 3
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '52-corner-pipeline-m1b-prompt-refinement'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r58 / ROADMAP r16 | 각 한 줄 |
| 하네스 | 출력 있음 — `50-`·`50r2-`가 커밋됐다 |
| 위임 파일 | 한 줄 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/52-corner-pipeline-m1b-prompt-refinement.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 바꿀 수 있는 것과 바꾸면 안 되는 것
2. 실제 API 호출 금지의 범위

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
```

| 확인 | 기대 |
|---|---|
| 바뀐 곳 | 코너 3종 프롬프트 문면, 하네스(`scripts/ops/`)의 dry 옵션, (있으면) 프롬프트 문자열을 고정한 시험의 기댓값, HANDOFF·PROGRESS |
| 금지 | `git diff`를 읽어 **LLM 출력 스키마·저장 스키마·ID 참조 선언·검증 순서**에 변경이 없는지, 새 검증 코드가 없는지 확인 |
| 운영 경로 | 입력 조립(`inputAssembly.ts`) 등 운영 코드에 상한·선별이 들어가지 않았는가 |
| 호출 | 실제 API 호출이 없었는가 (보고와 `scripts/ops/out/` 산출물로 확인) |
| 시험 | 고친 기댓값이 프롬프트 문자열 고정분뿐인가. 줄이 전부 보고됐는가 |
| 게이트 | 0 / 0 / 986 · 49 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 프롬프트 diff (코너별, 근거 절): {}
2. 입력 상한 후보 표: {}
3. 사전 선별 후보: {}
4. 추정 토큰 계산 방법: {}
5. 고친 시험 기댓값: {없음 / 파일·줄·이전 → 이후}

## 변경
- git diff --stat: {}
- 금지 대상 변경: {없음 / 있음 — 내용}

## 게이트 (메인 세션 재실행)
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 실제 API 호출
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
