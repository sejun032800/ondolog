# 메인 세션 지시 — `#14` 1부 위임 (설계 보고까지)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/29-main-session-dispatch-corners-design.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-04
>
> 짝: `29-corner-pipeline-corners-design.md`

---

**당신이 직접 설계하는 작업이 아닙니다.** `corner-pipeline`에 위임하고 보고를
검증합니다. **이번 위임은 설계 보고까지이며 코드가 생기면 안 됩니다.**

## 0. 사전 점검 — 하나라도 다르면 위임하지 말 것

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-04-r37'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-04-r4'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '^#### 17-0-4-A\.|^#### 17-0-5-D\.|^#### 17-0-5-E\.|^#### 17-0-5-F\.'
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern '§17-0-4-A'
Select-String -Path .claude/agents/corner-pipeline.md -Pattern '§17-0'
Select-String -Path .claude/agents/corner-pipeline.md -Pattern 'src/services/llm|최대 3회|문자 단위 대조|src/engine/corners'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '29-corner-pipeline-corners-design'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER r37 | 한 줄 |
| ROADMAP r4 | 한 줄 |
| r36·r37 절 넷 | **네 줄** |
| CORNER_CONTENT 포인터 | 한 줄 이상 — `28-`이 반영됐다 |
| 에이전트 정의의 포인터 | 한 줄 이상 — 교체본이 들어갔다 |
| 에이전트 정의의 낡은 지시 | **빈 출력** |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선: **0 / 0 / 556 · 35**

## 1. 위임

**위임 프롬프트를 요약하거나 보강하지 마세요. 설계 방향을 제안하지 마세요.**

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/29-corner-pipeline-corners-design.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번 작업이 어디까지이며 무엇을 하지 않는지
2. 코너 코드가 몰라야 하는 것이 무엇인지
3. FORBIDDEN_KEYS를 어디에 거는지
4. ID 해석의 세 조건이 무엇이며, 입력 소속만으로 갈음하면 안 되는 이유

확인 후 1·2·3절을 진행하고, 설계를 보고한 뒤 멈춰주세요.
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

### 2-1. 코드가 생기지 않았는가 — 최우선

```powershell
git status --porcelain
```

| 기대 |
|---|
| **`.claude/state/HANDOFF.md`·`PROGRESS.md` 외 변경 없음** |

`supabase/`·`src/`·`__tests__/` 변경이 있으면 **범위 이탈**입니다.

### 2-2. 설계 보고가 빠짐없는가

위임 프롬프트 **2-1~2-9 각각**과 **3절의 증명 항목 각각**에 답이 있는지 확인하고,
빠진 항목을 적으세요.

### 2-3. 원본과 맞는지 — 직접 대조

설계가 문서와 어긋나는지 **문서를 열어** 확인하세요. 특히:

- 코너 모듈 경로가 `supabase/functions/` 아래인가
- `FORBIDDEN_KEYS`가 **LLM 출력에만** 걸리는가
- `ValidatedContent`가 **승인 목록 안에서만** 만들어지는가. 검증 없이 브랜드를
  붙이는 공개 함수가 설계에 없는가
- ID 해석이 **세 조건을 명시적으로** 검사하는가
- 빈 결과와 파싱 실패가 **분리**되는가
- 입력 조립·배치·미디어 복제가 설계에 **들어가지 않았는가**

## 3. 보고

```
## 사전 점검
- 표 여덟: {각 O/X}
- 기준선: {0 / 0 / 556 · 35}

## 범위 (최우선)
- git status --porcelain: {전문}
- 코드 변경: {없음 / 있음 — 범위 이탈}

## 설계 요약
- 코너 모듈 경로: {목록}
- 두 함수 시그니처: {코너별}
- 골격 변경: {요지}
- 캐시 지점 전달 방식: {요지}
- ValidatedContent 생성 위치: {경로} / 승인 목록 변경: {없음 / 있음 — 사유}
- 검사 순서: {그대로}
- 빈 결과 표현: {코너별}
- ID 해석 세 조건: {검사 방식}
- 규칙 F: {위치·범위}
- 테스트 배치: {r26 실현 가능 / 불가 — 사유와 대안}

## 누락·불일치
- 위임 프롬프트 항목 중 답이 없는 것: {목록 / 없음}
- 문서와 어긋나는 설계: {목록 / 없음}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 설계·구현하는 것
- 설계 방향을 에이전트에게 제안하는 것
- 2부(구현)로 넘어가는 것 — 별도 지시가 있습니다
- 커밋·푸시
