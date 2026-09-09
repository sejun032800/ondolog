# 메인 세션 지시 — DEF 반올림 효과 검증 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/14-main-session-dispatch-rounding.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-04
>
> 짝: `14-engine-dev-def-rounding.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**관측만 하는 작업입니다.** 엔진도 규준집단도 바뀌지 않습니다.

**예측값을 에이전트에게 주지 않았습니다.** 이번 진단은 특정 예측이 맞는지를
보는 작업이고, 알려주면 그 숫자에 맞추려는 유인이 생깁니다.

---

## 0단계 — 파일명 확인

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `14-engine-dev-def-rounding.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/14-engine-dev-def-rounding.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem scripts/norm -File | Select-Object Name
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`13-` 진단 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-04-r12'
```

리비전이 그 사이 올랐으면 PM에게 확인하고 이 지시서의 값을 갱신한 뒤
진행하십시오.

### 2-3. 반올림 지점이 코드에 있는가

이번 위임의 핵심 전제입니다.

```powershell
Get-ChildItem scripts/norm -Recurse -File -Include *.ts | Select-String -Pattern 'roundTo|DECIMALS' -Context 1,2
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'export function roundTo|export const .*DECIMALS' -Context 0,3
```

**찾은 함수·상수와 자리수를 보고에 기록하세요.** 4단계에서 에이전트가
같은 것을 썼는지 대조합니다.

> 찾은 자리수가 2-5에서 직접 뽑을 파일 값의 형태와 맞지 않으면
> 그 자체가 보고 대상입니다 — **문서를 편집하거나 코드를 고치지 말고
> 보고하십시오.**

### 2-4. 재사용할 함수가 있는가

```powershell
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'export function computeAttachmentStability|export function computeDefAnxietyStability|export function computeSixStats|export function inferLoveType' -Context 0,3
```

**경로와 시그니처를 보고에 포함하세요.**

### 2-5. 파일 기준값 기록

`v2`·`v3`의 DEF 고유값과 빈도를 **당신이 직접 뽑아** 기록하십시오.
4단계에서 에이전트의 ⑤와 대조합니다.

```powershell
$v2 = Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
$v3 = Get-Content src/engine/data/norm-synthetic-v3.json -Raw | ConvertFrom-Json
$v2.stats.def.sorted | Group-Object | Select-Object Name, Count | Sort-Object {[double]$_.Name}
$v3.stats.def.sorted | Group-Object | Select-Object Name, Count | Sort-Object {[double]$_.Name}
$v2.stats.def.mean
$v3.stats.def.mean
```

### 2-6. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 348개 / tsc 0 에러**
(수가 다르면 실측값을 기준선으로 잡고 기록하십시오.)

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**예상값을 알려주지 마세요.** 반올림 전 차가 얼마여야 하는지, 반올림 후가
얼마여야 하는지 전부 알려주지 않습니다.

**반올림 자리수도 알려주지 마세요.** 프롬프트가 코드에서 확인하도록
지시했습니다. 알려주면 그 값을 그대로 쓰고 코드 확인을 건너뜁니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/14-engine-dev-def-rounding.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 반올림 방식을 어디서 얻어야 하는지
2. 산출할 것이 몇 가지이며 각각 무엇인지
3. 재구성이 올바른지 어떻게 검산하는지
4. 어긋남을 발견했을 때 무엇을 하면 안 되는지

확인 후, 재사용할 함수의 경로와 확인한 반올림 지점을 먼저 보고하고,
그다음 산출을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 무변경 확인

```powershell
git status --porcelain -uall src/
git diff src/
git diff scripts/norm/attachment-diagnostic.ts scripts/norm/avoidance-residual-diagnostic.ts scripts/norm/def-term-residual-diagnostic.ts scripts/norm/v2-def-storage-diagnostic.ts
```

**`src/` 아래에 변경이 하나라도 있으면 즉시 보고하고 멈추세요.**

- [ ] 기존 진단 스크립트 네 개가 **수정되지 않았는가**

### 4-2. 반올림 방식이 코드에서 왔는가 — 핵심 검증

```powershell
Get-ChildItem scripts/norm -Recurse -File -Include *.ts | Select-String -Pattern 'roundTo|DECIMALS'
```

- [ ] 새 스크립트가 **2-3에서 찾은 함수·상수를 import해 쓰는가**
- [ ] 자리수가 리터럴로 박혀 있지 않은가

**리터럴이면 추측일 수 있습니다.** 그 값이 2-3 기록과 같은지 확인하고,
다르면 보고하세요.

### 4-3. 재구성 검산

- [ ] `defV3raw`와 현재 `computeSixStats(...).def`의 **대조 결과가 보고됐는가**
- [ ] 어긋난 경우, 그 차이가 **확인된 반올림으로 설명되는지** 판정됐는가

**반올림이 `computeSixStats` 안쪽에 있으면 두 값은 당연히 다릅니다.**
그 위치가 이번 조사의 대상이므로, 차이 자체를 실패로 보지 마세요.

- 반올림으로 설명됨 → 정상. 계속 진행합니다
- 설명되지 않음 → **재구성이 틀린 것입니다.** 보고하고 멈추세요

### 4-4. 항 함수 재작성 여부

```powershell
Get-ChildItem scripts/norm -Recurse -File -Include *.ts | Select-String -Pattern 'import' -Context 0,2
```

- [ ] 두 항 함수를 `src/engine/leagueStats`에서 import하는가
- [ ] 스크립트 안에 `100 -`·`75 -`·`/ 2` 형태의 항 식이 다시 적혀 있지 않은가

### 4-5. 파일 대조 — 당신이 직접

**⑤의 결과를 에이전트 보고로만 받지 마세요.** 2-5에서 직접 뽑은 표와
에이전트의 ③④를 맞춰보십시오.

- [ ] `v2` 고유값 집합이 2-5 기록과 일치하는가
- [ ] 각 값의 빈도가 일치하는가
- [ ] `v3`도 동일하게 일치하는가

### 4-6. 산출 검산

- [ ] ①②의 평균 넷이 소수점 **12자리 이상**으로 보고됐는가
- [ ] ③④의 빈도 합이 각각 **3,888**인가
- [ ] 표본 수가 **3,888**인가

### 4-7. 재실행 일관성

진단 스크립트를 한 번 더 돌려 같은 수치가 나오는지 확인하세요.

### 4-8. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
git status --porcelain -uall
```

- 테스트: **2-6 기준선 유지**
- tsc: **0 에러**
- 예상 신규(`??`): 진단 스크립트. 예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md`

---

## 5단계 — 보고

```
## 0단계
- 파일명 정리: {불필요 / 정리함 — 내용}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r12: {O/X}
- 반올림 지점: {함수 · 상수 · 자리수 · 경로}
- 재사용 함수: {각각 경로 · 시그니처}
- v2 DEF 고유값·빈도 (직접 추출): {표}
- v3 DEF 고유값·빈도 (직접 추출): {표}
- v2/v3 DEF 평균: {값} / {값}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 무변경 확인
- src/ 변경: {없음 / 있음 — 즉시 보고}
- 기존 진단 스크립트 4개: {무변경 / 수정됨}

## 반올림 방식 출처 (핵심)
- 새 스크립트가 쓴 함수·자리수: {그대로}
- 2-3 기록과 일치: {O/X}
- 리터럴 하드코딩: {없음 / 있음 — 값}

## 재구성 검산
- defV3raw vs computeSixStats(...).def: {일치 / 차이 — 값}
- 차이가 반올림으로 설명됨: {O/X / 해당없음}
- 항 함수 import 여부: {O/X}

## 진단 스크립트
- 경로: {경로} / 실행 명령: {그대로}
- 재실행 수치 동일: {동일 / 다름}

## ① 반올림 없는 평균
- E[defV2raw] = {값}
- E[defV3raw] = {값}
- 차           = {값}

## ② 반올림 후 평균
- E[round(defV2raw)] = {값}
- E[round(defV3raw)] = {값}
- 차                  = {값}

## ③ 반올림 후 v2 고유값·빈도
- {표} — 합 {N}

## ④ 반올림 후 v3 고유값·빈도
- {표} — 합 {N}

## ⑤ 파일과의 대조
- v2 값 집합 일치: {O/X} / 빈도 일치: {O/X}
- v3 값 집합 일치: {O/X} / 빈도 일치: {O/X}
- 불일치 상세: {있으면 값과 차이}
- 메인 세션 직접 대조 결과: {일치 / 불일치}

## 표준 검증
- 테스트: {기준선} → {현재} / tsc {N}에러
- git status --porcelain -uall 전문

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 산출하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **예상값이나 반올림 자리수를 에이전트에게 알려주는 것**
- 수치를 **당신이 해석하는 것** — 반올림이 원인이라는 판단을 하지 마세요
- **어긋남이 보고됐을 때 코드나 문서를 고치는 것** — 발견이 산출물입니다
- `src/` 아래 무엇이든 고치는 것
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 진단 스크립트를 고치는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
