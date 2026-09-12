# 메인 세션 지시 — 레지스트리 정리 + 재-export 제거 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/18-main-session-dispatch-cleanup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-10
>
> 짝: `18-engine-dev-registry-cleanup.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**정리 작업이고 범위가 좁습니다.** `resolutionCondition` 필드 제거와
재-export 두 개 제거입니다.

**위험은 범위가 넓어지는 쪽입니다.** 에이전트가 import 정리를 넓게
해석하거나, `UNRESOLVED` 함수 자체를 손보면 지금까지 쌓은 검증망의
토대가 흔들립니다.

**그리고 순수 이동의 증거가 갈아끼워집니다.** 지금까지는 재-export가
증거였고, 그것을 제거하므로 새 증거는 **"경로만 바꾸고 assertion은
그대로인 채 전부 통과"**입니다.

---

## 0단계 — 파일명 확인

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `18-engine-dev-registry-cleanup.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/18-engine-dev-registry-cleanup.md` | **이번에 위임할 프롬프트 원문** |

`src/engine/constants/unresolved.ts`와 `src/engine/temperature.ts`를
**내용까지 읽으세요.** 둘 다 수정 대상입니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

34번 산출물 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-04-r13'
```

리비전이 그 사이 올랐으면 PM에게 확인하고 이 지시서의 값을 갱신한 뒤
진행하십시오.

### 2-3. 소비처 재확인 — 위임의 전제

프롬프트가 **조사 결과를 전제로 쓰여 있습니다.** 그 사이 늘었으면
프롬프트가 틀린 전제 위에 서게 됩니다.

```powershell
Get-ChildItem src, __tests__, scripts -Recurse -File -Include *.ts | Select-String -Pattern 'resolutionCondition'
Get-ChildItem src, __tests__, scripts -Recurse -File -Include *.ts | Select-String -Pattern 'resolveTypeAffinity|TypeAffinityCategory'
```

- [ ] `resolutionCondition`이 **`unresolved.ts` 안에서만** 나오는가
- [ ] `temperature.ts`에서 궁합 심볼을 가져가는 곳이
      **`temperatureBaseline.test.ts` 하나뿐**인가

**늘었으면 멈추고 보고하십시오.** 프롬프트를 고쳐야 합니다.

**출력 전문을 보고에 기록하세요.**

### 2-4. 무변경 기준선

```powershell
Select-String -Path src/engine/temperature.ts -Pattern 'TEMPERATURE_ENGINE_VERSION' -Context 0,2
Select-String -Path src/store/coupleStore.ts -Pattern "from '.*temperature'" -Context 0,2
```

**기록하세요.** 4단계에서 대조합니다.

### 2-5. `UNRESOLVED` 집계 기준선

34번에서 만든 스크립트를 실행해 기록하십시오.

```powershell
# scripts/norm/unresolvedInventory.ts 실행 (HANDOFF.md에 명령 기록됨)
```

기준: **정의 4 / 소비 2**

> 이제 `grep -rn "UNRESOLVED("` 계열 명령은 쓰지 않습니다. 선언과
> 호출을 구분하지 못하고 레지스트리 키를 세지 못합니다.

### 2-6. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 415개 / tsc 0 에러**
(수가 다르면 실측값을 기준선으로 잡고 기록하십시오.)

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**2-3의 출력을 에이전트에게 알려주지 마세요.** 프롬프트가 착수 전에
직접 확인하도록 지시했습니다. 알려주면 확인을 건너뜁니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/18-engine-dev-registry-cleanup.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 제거 대상이 정확히 무엇무엇인지
2. import 정리에서 건드리면 안 되는 것이 무엇인지
3. 기존 테스트에 허용되는 수정이 어디까지인지
4. 순수 이동의 새 증거가 무엇인지

확인 후, 문서가 지시한 착수 전 조사 두 가지를 먼저 보고하고,
그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 범위가 넓어지지 않았는가 — 최우선

```powershell
git status --porcelain -uall
git diff --stat
```

예상 수정(`M`): `unresolved.ts`, `temperature.ts`,
`temperatureBaseline.test.ts`, `PROGRESS.md`, `HANDOFF.md`.
예상 신규(`??`): 없음.

**이 밖에 무엇이든 있으면 보고하세요.**

```powershell
git status --porcelain -uall src/store/coupleStore.ts src/engine/typeAffinity.ts
```

**출력이 있으면 위반입니다.** `coupleStore.ts`의
`DISCONNECTED_TEMPERATURE` import는 이번 작업과 무관합니다.

### 4-2. `UNRESOLVED` 함수가 안 바뀌었는가

```powershell
git diff src/engine/constants/unresolved.ts
```

diff를 **직접 읽으세요.**

- [ ] `resolutionCondition` **데이터와 타입만** 빠졌는가
- [ ] `UNRESOLVED` 함수 본문·시그니처·반환 타입이 그대로인가
- [ ] 에러 클래스 2종이 그대로인가
- [ ] 키 유니온이 레지스트리에서 파생되는 구조가 유지됐는가
- [ ] **등록된 키가 여전히 4개인가**
- [ ] 에러 메시지에 **`doc`이 그대로 나오는가**

**함수 쪽에 변경이 있으면 보고하세요.** 이 파일은 다른 모든 검증의
토대입니다.

### 1부의 증거 — 메시지 assertion

```powershell
git diff __tests__/engine/unresolved.test.ts
```

- [ ] **이 파일이 수정되지 않았는가** — 출력이 없어야 정상입니다
- [ ] 그 파일의 테스트가 **전부 통과하는가**

`unresolved.test.ts`는 네 키의 에러 메시지에서 `phase`와 `doc`을
assert합니다. `해소 조건` 문장은 검사하지 않으므로, **그 문장을 빼도
수정 없이 통과해야 합니다.**

> **이것이 1부의 증거입니다.** 메시지에서 한 문장이 빠져도 `phase`·`doc`
> 검사가 그대로 통과하는 것이, "지워도 정보 손실이 없다"는 판단의
> 실증입니다. 수정됐다면 그 판단이 틀렸다는 뜻이므로 **보고하고
> 멈추세요.**

같은 파일의 메시지 결정론 테스트(100회 호출의 메시지 동일성)도
함께 통과해야 합니다.

### 4-3. 재-export 제거 범위

```powershell
git diff src/engine/temperature.ts
```

- [ ] **궁합 심볼 재-export 두 개만** 제거됐는가
- [ ] 계산 로직·상수가 그대로인가
- [ ] **`TEMPERATURE_ENGINE_VERSION`이 2-4 기록과 같은가**
- [ ] `computeAttachmentStability` 본문이 그대로인가

### 4-4. 순수 이동의 새 증거 — 핵심 검증

```powershell
git diff __tests__/engine/temperatureBaseline.test.ts
```

diff를 **직접 읽으세요.**

- [ ] **import 경로만 바뀌었는가**
- [ ] **assertion과 기댓값이 하나도 안 바뀌었는가**
- [ ] 그 파일의 테스트가 **전부 통과하는가**

**assertion이 바뀌었으면 이동이 순수하지 않았다는 뜻입니다.**
보고하고 멈추세요.

> 지금까지 재-export가 순수 이동의 증거였습니다. 그것을 제거하므로
> **이 검증이 새 증거입니다.** 여기가 통과해야 재-export 없이도
> 이동이 안전했다고 말할 수 있습니다.

### 4-5. 34번 규칙이 여전히 통과하는가

```powershell
npx jest --ci --watchAll=false
```

- [ ] 정적 규칙 A·B가 **여전히 통과하는가**
- [ ] 테스트가 **415 대비 감소하지 않았는가**

`unresolved.ts`가 규칙 A·B의 검사 대상입니다. 이번에 수정되므로
규칙이 실제로 작동하는지 여기서 다시 확인됩니다.

### 4-6. 집계 스크립트

```powershell
# scripts/norm/unresolvedInventory.ts 실행
git diff scripts/
```

- [ ] **정의 4 / 소비 2**로 유지되는가
- [ ] 집계 스크립트가 **수정되지 않았는가**

`resolutionCondition` 제거가 집계에 영향을 주면 안 됩니다.

### 4-7. 표준 검증

```powershell
npx tsc --noEmit -p .
git status --porcelain -uall
```

- tsc: **0 에러**

---

## 5단계 — 보고

```
## 0단계
- 파일명 정리: {불필요 / 정리함 — 내용}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r13: {O/X}
- resolutionCondition 소비처: {출력 전문}
- 궁합 심볼 소비처: {출력 전문}
- TEMPERATURE_ENGINE_VERSION 기준선: {값}
- coupleStore.ts import 기준선: {그대로}
- UNRESOLVED 집계 기준선: 정의 {N} / 소비 {M}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 범위 (최우선)
- git status --porcelain -uall 전문
- coupleStore.ts / typeAffinity.ts 변경: {없음 / 있음 — 위반}
- 예상 외 파일: {없음 / 목록}

## UNRESOLVED 함수 무변경
- unresolved.ts diff 요지: {데이터·타입만 / 함수도 — 보고}
- 함수 시그니처·본문·반환 타입: {그대로 / 변경}
- 에러 클래스 2종: {그대로 / 변경}
- 키 유니온 파생 구조: {유지 / 변경}
- 등록 키 수: {N} (기대 4)
- 에러 메시지에 doc 포함: {O/X}
- 에러 메시지 변경 전/후: {그대로}
- unresolved.test.ts 수정 여부: {없음 / 있음 — 보고}
- 메시지 assertion 통과: {O/X}
- 메시지 결정론 테스트 통과: {O/X}

## 재-export 제거
- temperature.ts diff 요지: {재-export만 / 그 외도}
- TEMPERATURE_ENGINE_VERSION: {기준선} → {현재}
- 계산 로직·상수 변경: {없음 / 있음}
- computeAttachmentStability 본문: {무변경 / 변경}

## 순수 이동의 새 증거 (핵심)
- temperatureBaseline.test.ts diff: {import 경로만 / assertion도 — 보고}
- 그 파일 테스트 통과: {O/X}

## 34번 규칙
- 정적 규칙 A·B: {통과 / 실패}
- 테스트: 415 → {현재}

## 집계 스크립트
- 실행 결과: 정의 {N} / 소비 {M} (기준 4 / 2)
- 스크립트 수정: {없음 / 있음}

## 표준 검증
- tsc: {N}에러

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **2-3의 조사 결과를 에이전트에게 알려주는 것**
- **`coupleStore.ts`를 손대는 것** — 무관합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **34번 정적 규칙이나 집계 스크립트를 고치는 것**
- **`grep -rn "UNRESOLVED("` 계열 명령을 쓰는 것** — 집계 스크립트로
  대체됐습니다
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
