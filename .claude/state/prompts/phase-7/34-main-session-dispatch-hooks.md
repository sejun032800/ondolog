# 메인 세션 지시 — `#14` 2부 2단계-b 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/34-main-session-dispatch-hooks.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-05
>
> 짝: `34-corner-pipeline-hooks-period.md`

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검 — 하나라도 다르면 위임하지 말 것

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-05-r42'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '^#### 17-0-4-B\.'
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'validateCornerResponse'
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'validateCornerContent'
Select-String -Path supabase/functions/_shared/coeffLookup.ts -Pattern '^export function buildCoeffBundle'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '34-corner-pipeline-hooks-period'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** — 2단계가 커밋됐다 |
| MASTER r42 | 한 줄 |
| §17-0-4-B 제목 | 한 줄 |
| `validateCornerResponse` | 한 줄 이상 |
| `validateCornerContent` (코드 파일) | **주석 줄만** — 정의·호출이 없다. 출력 줄을 보고에 적는다 |
| `buildCoeffBundle` 공개 | **빈 출력** |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 594 · 35**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/34-corner-pipeline-hooks-period.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번에 하지 않는 것
2. 훅을 빠뜨렸을 때 무엇이 일어나야 하는지
3. 기간 판정 함수를 어디에 두고 누가 부르는지
4. 재소환 표시가 있는 다른 커플 레코드가 왜 막혀야 하는지
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

### 2-1. 기간 판정 함수가 하나인가

에이전트가 보고한 함수 이름으로 확인합니다.

```powershell
git ls-files supabase src | ForEach-Object { Select-String -Path $_ -Pattern '<함수이름>' -SimpleMatch }
```

| 확인 | 기대 |
|---|---|
| 정의 | **한 곳** |
| 호출 | **소속 단언 쪽과 ID 해석 쪽 둘 다** — 코드를 열어 각 호출이 어느 쪽인지 확인 |
| 같은 규칙의 다른 구현 | **없음** — `start`·`end`·`recalled`를 직접 비교하는 코드가 판정 함수 밖에 있는지 읽어서 확인 |

### 2-2. 통과형 기본값이 없는가

`validateCornerResponse`와 파이프라인의 훅 자리를 **직접 읽으세요.**

- 훅 인자가 **선택(`?`)이 아닌가**
- `?? ` / `|| ` / 기본 매개변수로 **통과형 함수를 채우는 코드가 없는가**

### 2-3. 증명 테스트 — 내용을 읽으세요

| 증명 | 확인할 것 |
|---|---|
| 훅 필수 | `@ts-expect-error`가 **넷**(빈 결과·ID 해석·원문 채우기·`scopedRecords`) — 하나씩 뺀 호출 |
| 기간 경계 | 끝 시각 막힘, 시작 시각 통과 |
| 재소환 같은 커플 | 표시 + 이전 → 통과 / 표시 없이 이전 → 막힘 |
| **재소환 다른 커플** | 표시가 있어도 **막힘** |
| 응답 쪽 | 재소환 두 경우가 **ID 해석 쪽에서도** 같은 결과 |
| 맥락 값 | 빈 커플·날짜 아님·뒤집힘 — 각각 LLM **0**, 저장 **0** |

### 2-4. 주석과 범위

```powershell
git diff -- src/engine/corners/brandedTypes.ts
Select-String -Path supabase/functions/_shared/llmClient.ts -Pattern 'call\('
```

- `brandedTypes.ts` diff가 **주석뿐**인가
- `llmClient` 호출 시그니처가 **사전 점검 때와 같은가**

### 2-5. 고친 assertion과 게이트

```powershell
git diff --stat
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

- 고친 assertion마다 **⑤~⑦** 중 하나로 보고됐는가. diff로 대조
- **0 / 0**, jest **594 이상**, 규칙 C~G 통과

## 3. 보고

```
## 사전 점검
- 표 일곱: {각 O/X} / validateCornerContent 잔존 줄: {목록} / 기준선: {0 / 0 / 594 · 35}

## 기간 판정 함수
- 이름·정의 위치: {}
- 호출 위치: 단언 쪽 {} / ID 해석 쪽 {}
- 판정 함수 밖의 같은 규칙 구현: {없음 / 위치}

## 기본값
- 훅 인자 선택 여부: {전부 필수 / 선택 있음 — 위치}
- 통과형 채움 코드: {없음 / 위치}

## 증명
| 증명 | 테스트 위치 | 내용 확인 |
|---|---|---|

## 범위
- brandedTypes.ts diff: {주석뿐 / 그 외}
- llmClient 시그니처: {그대로 / 변경}

## assertion
| 파일·행 | 사유 ⑤~⑦ | 직접 대조 |
|---|---|---|

## 게이트
- {tsc / tsc / jest N · M}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 3단계로 넘어가는 것
- 커밋·푸시
