# 메인 세션 지시 — `#14` 2부 2단계-c 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/35-main-session-dispatch-declarative.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-05
>
> 짝: `35-corner-pipeline-declarative-ids.md`

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검 — 하나라도 다르면 위임하지 말 것

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-05-r43'
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'isRecordInPeriod'
git ls-files __tests__/functions
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '35-corner-pipeline-declarative-ids'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** — 2단계-b가 커밋됐다 |
| MASTER r43 | 한 줄 |
| `isRecordInPeriod` | 한 줄 이상 |
| `__tests__/functions` | **빈 출력** — 검사 파일이 지워졌다 |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0**, jest 수를 기준선으로 기록하세요.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/35-corner-pipeline-declarative-ids.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 코너가 넘기는 것과 골격이 하는 것
2. 이번에 하지 않는 것
3. 완료 기준의 첫 줄을 무엇으로 보일 것인지
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

| 확인 | 방법 |
|---|---|
| **코너가 판정 로직을 넣을 자리가 없는가** (PM 완료 기준) | 코너가 넘기는 타입 정의를 **직접 읽고**, 함수를 넣을 수 있는 자리가 있는지 확인. 에이전트가 이것을 무엇으로 보였는지도 확인 |
| 해석·기간 판정이 골격에서 `isRecordInPeriod` 하나로 되는가 | 코드를 읽어 확인 |
| 기존 ID 해석 테스트가 통과하는가 | jest |
| 빈 결과 판정 훅이 바뀌지 않았는가 | diff |
| `llmClient` 호출 시그니처 | 사전 점검 때와 같은가 |
| 고친 assertion마다 이유가 보고됐는가 | diff로 대조 |
| 게이트 | 0 / 0, jest 기준선 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 표 다섯: {각 O/X} / 기준선: {0 / 0 / N · M}

## PM 완료 기준
- 코너가 넘기는 타입: {정의 위치와 요지}
- 판정 로직을 넣을 자리: {없음 / 있음 — 위치}
- 에이전트가 이를 보인 방법: {}

## 그 밖
- isRecordInPeriod 하나로: {O/X}
- 빈 결과 판정 훅: {그대로 / 변경}
- llmClient 시그니처: {그대로 / 변경}
- 고친 assertion과 이유: {목록}
- 게이트: {}
- git status --porcelain: {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 3단계로 넘어가는 것
- 커밋·푸시
