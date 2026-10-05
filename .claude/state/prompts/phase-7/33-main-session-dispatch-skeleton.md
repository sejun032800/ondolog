# 메인 세션 지시 — `#14` 2부 2단계 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/33-main-session-dispatch-skeleton.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-05
>
> 짝: `33-corner-pipeline-skeleton-behavior.md`

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검 — 하나라도 다르면 위임하지 말 것

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-05-r41'
git ls-files supabase/functions/_shared | Select-String -Pattern '\.test\.ts$'
git ls-files __tests__/functions
Select-String -Path supabase/functions/_shared/coeffLookup.ts -Pattern '^export function buildCoeffBundle'
Select-String -Path supabase/functions/_shared/cornerPipeline.ts -Pattern 'validateCornerContent'
Select-String -Path .claude/state/HANDOFF.md -Pattern '#14 1부' -SimpleMatch
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '33-corner-pipeline-skeleton-behavior'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER r41 | 한 줄 |
| `_shared`의 테스트 | **네 줄** — 1단계가 커밋됐다 |
| `__tests__/functions` | **빈 출력** — 옛 위치가 비었다 |
| `buildCoeffBundle` 공개 | 한 줄 — 고칠 대상이 있다 |
| `validateCornerContent` | 한 줄 이상 — 지울 대상이 있다 |
| 1부 설계 보고 | 한 줄 이상 |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 556 · 35**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번에 하지 않는 것
2. 금지 키를 무엇에 걸고, 그것을 어떻게 증명하는지
3. 다른 커플 레코드가 섞였을 때 무엇이 일어나야 하는지
4. 규칙 E의 공개 여부를 무엇으로 판정하는지

확인 후, A절이 지시한 대로 buildCoeffBundle 사용처 전부를 먼저
보고하고 시작해주세요.
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

### 2-1. 사실 확인

```powershell
Select-String -Path supabase/functions/_shared/*.ts -Pattern '^export function buildCoeffBundle|export \{[^}]*buildCoeffBundle'
git ls-files supabase src __tests__ | ForEach-Object { Select-String -Path $_ -Pattern 'validateCornerContent' -SimpleMatch }
Select-String -Path supabase/functions/_shared/llmClient.ts -Pattern 'call\(' 
```

| 확인 | 기대 |
|---|---|
| `buildCoeffBundle` 공개 | **빈 출력** |
| `validateCornerContent` | **빈 출력** (주석 포함 없어야 함 — 있으면 보고) |
| `llmClient` 호출 시그니처 | 사전 점검 때와 **같다** — 3단계 몫 |

### 2-2. 증명 테스트가 실제로 있는가 — 내용을 읽으세요

| 증명 | 확인할 것 |
|---|---|
| 금지 키 | **파이프라인 전체**를 지나는가(가짜 `llmClient` → 저장 함수가 `forbidden_content`로 불림). 금지 키가 **스키마에 없는 키**인가 |
| 중첩 금지 키 | 있는가 |
| 모르는 키 | `schema_invalid`가 아님을 보는가 |
| 소속 단언 | `llmClient` 호출 **0**, 저장 **0**, 전용 오류 전파를 **셋 다** 보는가 |
| 공개 해제 | `@ts-expect-error` import 시도가 있는가 |
| 규칙 E 공개 여부 | 합성 입력 넷(export 함수·비공개·`export const` 화살표·`export { f }`)이 있는가. **TypeScript API로 파싱**하는가(문자열 검색 아님) |

### 2-3. 고친 assertion

```powershell
git diff --stat
git diff -- supabase/functions/_shared
```

- 고친 assertion마다 **①~④ 중 하나**로 보고됐는가. diff에서 직접 대조
- **분류되지 않은 assertion 변경**이 있는가

이번에는 이동이 없으므로 경로를 한정해 diff를 봐도 됩니다.

### 2-4. 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0**, jest **556 이상**, 규칙 C~G 통과.

## 3. 보고

```
## 사전 점검
- 표 여덟: {각 O/X} / 기준선: {0 / 0 / 556 · 35}

## 사실 확인
- buildCoeffBundle 공개: {없음 / 있음}
- validateCornerContent: {없음 / 위치}
- llmClient 호출 시그니처: {그대로 / 변경 — 범위 이탈}

## 증명
| 증명 | 테스트 위치 | 내용 확인 |
|---|---|---|

## assertion
| 파일·행 | 사유 ①~④ | 직접 대조 |
|---|---|---|
- 분류 안 된 변경: {없음 / 목록}

## 게이트
- {tsc / tsc / jest N · M} / 규칙 C~G: {통과}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 3단계(코너 3종·`LlmRequest`·캐싱)로 넘어가는 것
- 커밋·푸시
