# 메인 세션 지시 — `#14` 2부 2단계-d 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/36-main-session-dispatch-skeleton-final.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-06
>
> 짝: `36-corner-pipeline-skeleton-final.md`
>
> 개정: PROGRESS 맨 LF 확인을 사전 점검에서 뺌. PM 요청은 "한 번 확인"이었는데
> 관문(기대값 0)으로 넣어 2단계-d와 무관한 이유로 멈췄다. 확인 결과는 PM께 보고됨.
> 위임 전·변경 없이 멈췄으므로 덮어씀

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검 — 하나라도 다르면 위임하지 말 것

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-06-r44'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '선언의 세 필드 (확정, r44)' -SimpleMatch
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'ReferenceMapping'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '36-corner-pipeline-skeleton-final'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** — 2단계-c가 커밋됐다 |
| MASTER r44 | 한 줄 |
| r44 문단 | 한 줄 |
| `ReferenceMapping` | 한 줄 이상 |
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

.claude/state/prompts/phase-7/36-corner-pipeline-skeleton-final.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 범위 네 가지
2. scopedRecords가 한 번 불린다는 것을 무엇으로 확인하는지
3. 이번에 하지 않는 것
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

| 확인 | 방법 |
|---|---|
| `scopedRecords` 한 번 호출 | 테스트가 **호출 횟수**를 세는지 읽어서 확인 |
| `resolveRecordReferences` 비공개 | 정의에 `export`가 없는지, 테스트가 `resolveDeclaredReferences`로 시험하는지 |
| `kind` 유니온 | 정의를 읽어 확인 |
| `path` 존재 확인 | 함수가 있고, 있는 자리 통과·없는 자리 실패를 테스트하는지 |
| `llmClient` 시그니처 | 사전 점검 때와 같은가 |
| 고친 assertion | 이유가 보고됐는가, diff로 대조 |
| 게이트 | 0 / 0, jest 기준선 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 표 다섯: {각 O/X} / 기준선: {0 / 0 / N · M}

## 범위 넷
| 항목 | 위치 | 확인 |
|---|---|---|

## 그 밖
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
