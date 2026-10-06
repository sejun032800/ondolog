# 메인 세션 지시 — `#14` 3단계 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/38-main-session-dispatch-three-corners.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-06
>
> 짝: `38-corner-pipeline-three-corners.md`

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-06-r45'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-04-r4'
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern '"cornerName": "다정한 말들"' -SimpleMatch
Select-String -Path .claude/state/HANDOFF.md -Pattern '1부 — 코너 3종 설계 보고' -SimpleMatch
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'findMissingReferencePaths'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '38-corner-pipeline-three-corners'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r45 / ROADMAP r4 | 각 한 줄 |
| CORNER_CONTENT 코너 이름 | 한 줄 — `37-`이 반영됐다 |
| 1부 설계 보고 | 한 줄 이상 |
| `findMissingReferencePaths` | 한 줄 이상 |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 630 · 35**. 다르면 실측값을 기록하세요.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 범위 여섯 가지
2. 시간대 라벨을 어떻게 계산하고 무엇으로 시험하는지
3. 1부 설계와 MASTER가 다르게 읽히면 무엇을 따르는지
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.** PM 목록 항목마다 확인합니다.

| PM 항목 | 확인 |
|---|---|
| 코너 셋 | 코너마다 요청 만들기·응답 처리, 두 스키마, 빈 결과, 선언형 매핑이 있는가. 코너 디렉터리에 전송·대기 코드가 없는가(규칙 G 통과) |
| `LlmRequest`·캐싱 | 캐시 지점이 `llmClient` 요청에 실리는 테스트가 있는가. SDK·엔드포인트가 `llmClient`에만 있는가(규칙 C 통과) |
| 지면 제목 상수 | 값이 §17-0-7 그대로인가. `^[가-힣 ]{1,7}$` 테스트가 있는가 |
| 시간대 라벨 | `_shared/`에 함수 하나인가. 고정 +09:00인가. **실행 시간대를 바꿔도 같은 라벨** 테스트가 있는가 |
| `findMissingReferencePaths` | 코너 셋 각각의 테스트에서 부르는가 |
| Zod 카나리아 | 있고, 실패 메시지가 "Zod 내부 구조가 바뀌었다"를 가리키는가. 공개 변환 검토 결과가 보고됐는가 |
| 고친 assertion | 이유가 보고됐는가, diff로 대조 |
| 게이트 | 0 / 0, jest 기준선 대비 감소 없음, 정적 규칙 전부 통과 |

## 3. 보고

```
## 사전 점검
- 표: {각 O/X} / 기준선: {}

## PM 항목
| 항목 | 위치 | 확인 |
|---|---|---|

## 그 밖
- 1부 설계와 MASTER가 달라 MASTER를 따른 곳: {목록}
- 고친 assertion과 이유: {목록}
- 게이트: {}
- git status --porcelain: {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 커밋·푸시
