# 메인 세션 지시 — M1b 마무리 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/52r2-main-session-dispatch-m1b-finish.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-20
>
> 짝: `52r2-corner-pipeline-m1b-finish.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 API 호출은 없습니다.** 커밋하지 않습니다. `52-`가 커밋된 뒤에 돌립니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-19-r59'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-19-r17'
git ls-files scripts/ops/m1InputCandidates.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '52r2-corner-pipeline-m1b-finish'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r59 / ROADMAP r17 | 각 한 줄 |
| `m1InputCandidates.ts` | 한 줄 — `52-`가 커밋됐다 |
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

.claude/state/prompts/phase-7/52r2-corner-pipeline-m1b-finish.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 3번 안전 정지의 사유를 실패 사유 4값 밖에 두어야 하는 이유
2. 5번에서 코드로 강제할 수 없을 때 해야 할 일

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src docs package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
Get-ChildItem supabase/functions -Recurse -File | Select-String -Pattern 'scripts/ops'
git diff -- supabase/functions/_shared/corners/sweetWords.ts
```

- 셋째·넷째 명령은 **빈 출력**이어야 합니다

| 확인 | 기대 |
|---|---|
| 1 문구 | `sweetWords.ts` diff에서 "다툼에"가 빠지고 "덮인 것을 다시 꺼내주는 것"이 됐는가. 다른 문장은 그대로인가 |
| 2 sel-a | 운영 경로에 sel-a만 들어갔는가. cap-\*·sel-b~d는 하네스 dry에만 있는가. 제외 건수에 잡히는가 |
| 3 안전 정지 | 기준이 **40,000 초과**인가. LLM 호출 **전**인가. 실패 사유 4값 유니온·Zod 스키마에 변경이 없는가. 하네스 `run`도 거치는가 |
| 4 dateLevel | 17-1 user 블록에만 실렸는가. 출력 스키마·ID 참조 선언이 그대로인가 |
| 5 featured | 코드 강제인가 프롬프트 지시인가. 코드라면 검증 순서·새 검증층 변화가 없는가. LLM의 선택을 다른 데이트로 바꿔 끼우지 않는가 |
| 금지 | `git diff`를 읽어 **출력 스키마·저장 스키마·ID 참조 선언**에 변경이 없는지 확인 |
| 호출 | 실제 API 호출이 없었는가 (보고와 `scripts/ops/out/` 산출물로 확인) |
| 시험 | 고친 기댓값이 전부 보고됐는가. 3의 시험이 LLM 호출 0회를 확인하는가 |
| 게이트 | 0 / 0 / 986 이상 · 49 이상 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 항목별 변경 (1~5): {}
2. sel-a 위치·제외 건수: {}
3. 안전 정지 위치·결과 모양·코너별 추정 입력 토큰(50- 데이터셋): {}
4. dateLevel 모양·사진 ID 참조 여부: {}
5. featured: {코드 강제 — 위치 / 프롬프트 지시 — 이유}
6. 고친 시험 기댓값: {없음 / 파일·줄·이전 → 이후}
7. 새 시험: {}
8. 하네스 dry 산출물: {경로}

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
