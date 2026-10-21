# 메인 세션 지시 — sel-a 좁힘 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/52r3-main-session-dispatch-sel-a-narrow.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-21
>
> 짝: `52r3-corner-pipeline-sel-a-narrow.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. **실제 API 호출은 없습니다.** 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-21-r61'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-21-r19'
git ls-files supabase/functions/_shared/inputPrefilter.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '52r3-corner-pipeline-sel-a-narrow'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r61 / ROADMAP r19 | 각 한 줄 |
| `inputPrefilter.ts` | 한 줄 — `52-r2`가 커밋됐다 |
| 위임 파일 | 한 줄 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 1028 · 52** (`52-r2` 결과, Proteur 확인값). **다르면 위임하지 말고 실제 숫자를 보고합니다.**

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/52r3-corner-pipeline-sel-a-narrow.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 새 기준에서 남는 쪽과 빠지는 쪽
2. 바꾸지 않는 것

끝나면 게이트(tsc 둘, jest)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations src docs package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json supabase/functions/deno.json
git diff -- supabase/functions/_shared/inputPrefilter.ts supabase/functions/_shared/inputAssembly.test.ts
```

- 셋째 명령은 **빈 출력**이어야 합니다

| 확인 | 기대 |
|---|---|
| 판정 | 본문이 비었거나 공백뿐인 메시지만 빠지는가. 자음만·이모티콘 단독·한 글자 판정이 지워졌는가 |
| 겹침 | "본문 없는 메시지"와 이중으로 세지 않는가 |
| 시험 입력 | 320·334행이 `'A'`·`'B'`로 돌아왔는가 |
| sel-a 시험 | 남는 쪽에 `"ㅋㅋㅋ"`·`"❤️"`·`"응?"`·`"콜 🍺"`, 빠지는 쪽에 `""`·`"   "`·줄바꿈뿐이 있는가 |
| 바꾸지 않는 것 | 안전 정지 기준(40,000)·featured 처리·스키마·ID 참조 선언·검증 순서에 diff가 없는가 |
| 호출 | 실제 API 호출이 없었는가 (`scripts/ops/out/runs/`가 그대로인가) |
| 게이트 | tsc 0 / 0, jest 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 판정 변경 전후·겹침 세는 방식: {}
2. 고친 시험: {파일·줄·이전 → 이후}
3. 표
| 항목 | 52-r2 | 52-r3 |
|---|---|---|
| sel-a로 뺀 건수 | 7 | {} |
| 데이트 아카이브 (중간값) | 2,571 | {} |
| 다정한 말들 | 13,403 | {} |
| 이달의 우리 | 14,561 | {} |
4. 하네스 dry 산출물: {경로}

## 변경
- git diff --stat: {}
- 금지 대상 변경: {없음 / 있음 — 내용}

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
- 실제 API 호출
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
