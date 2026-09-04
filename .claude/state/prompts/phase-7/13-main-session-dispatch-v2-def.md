# 메인 세션 지시 — `v2` 규준집단 DEF 데이터 검증 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/13-main-session-dispatch-v2-def.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-04
>
> 짝: `13-engine-dev-v2-def-verify.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**관측만 하는 작업이고 산출물이 숫자 몇 개뿐입니다.**

**틀린 값을 발견해도 고치지 않는 것이 핵심입니다.** `v2` 파일에 오류가
있다는 것이 직전 진단의 결론이고, 이 작업은 그 오류의 위치를 좁힙니다.
에이전트가 "고쳐두면 좋겠다"고 판단해 파일을 손대면 증거가 사라집니다.

---

## 0단계 — 파일명 확인

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `13-engine-dev-v2-def-verify.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/13-engine-dev-v2-def-verify.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem scripts/norm -File | Select-Object Name
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

직전 진단(`12-`) 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-04-r12'
```

**출력이 없으면 위임하지 마세요.** 문서를 편집하지 말고 보고하고 멈추십시오.

### 2-3. `v2` 시절 DEF 공식이 문서와 같았는가 — 진단의 전제

**이 확인이 실패하면 `13-` 위임 자체가 불필요합니다.**

역산식은 `v2` 시절 코드의 애착 항이 `100 − (A + V) / 2`였다는 것을
전제합니다. 당시 코드가 문서와 달랐다면 복원이 틀리고, **무죄인 데이터가
"재산출 필요"로 판정됩니다.**

```powershell
git log --oneline -- src/engine/data/norm-synthetic-v2.json
```

`v2`를 **생성한 커밋**(가장 오래된 쪽)의 해시를 찾아,

```powershell
git show <해시>:src/engine/leagueStats.ts | Select-String -Pattern 'def =|attachmentStability' -Context 2,4
```

- [ ] DEF의 애착 항이 `computeAttachmentStability(...)`이고
      그 본문이 `100 - (attachAnxiety + attachAvoidance) / 2`인가

**출력 전문을 보고에 기록하세요.**

| 결과 | 처리 |
|---|---|
| 문서와 같음 | 전제 확인. 3단계로 진행 |
| **다름** | **위임하지 말고 보고하고 멈추세요.** 진단 없이 원인이 확정됩니다 — `v2` 시절 코드가 문서와 달랐던 것입니다 |

### 2-4. `v2` 파일에 DEF 정렬 배열이 있는가

이번 위임의 전제입니다. 요약만 저장돼 있으면 ①이 성립하지 않습니다.

```powershell
$v2 = Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
$v2.stats.def.sorted.Count
$v2.stats.def.mean
```

- [ ] 배열 길이가 **3,888**인가
- [ ] 저장된 평균값을 보고에 기록하세요 — 4단계 대조에 씁니다

### 2-5. 재사용할 함수가 있는가

```powershell
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'export function computeSixStats|export function inferLoveType' -Context 0,3
```

**경로와 시그니처를 보고에 포함하세요.**

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

**예상값을 알려주지 마세요.** `v2`의 DEF 평균이 얼마여야 하는지, 어긋남의
크기가 얼마인지 전부 알려주지 않습니다.

**회피축 보정량을 알려주지 마세요.** 프롬프트가 의도적으로 그 값을 적지
않고 식만 줬습니다. **값을 옮겨 적는 과정에서 부호가 뒤집힌 전례가
있습니다** — 그렇게 되면 무죄인 데이터가 유죄로 판정됩니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/13-engine-dev-v2-def-verify.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 산출할 것이 몇 가지이며 각각 무엇인지
2. 역산에 쓸 회피축 값을 어디서 얻어야 하는지
3. 비교 결과로 무엇을 내야 하는지 (불린 하나가 아닙니다)
4. 틀린 값을 발견했을 때 무엇을 하면 안 되는지

확인 후, 재사용할 함수의 경로와 시그니처를 먼저 보고하고,
그다음 산출을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 무변경 확인 — 최우선

```powershell
git status --porcelain -uall src/
git diff src/
```

**`src/` 아래에 변경이 하나라도 있으면 즉시 보고하고 멈추세요.**
특히 `src/engine/data/norm-synthetic-v2.json`입니다 — 에이전트가 틀린
값을 고쳤다면 증거가 사라진 것입니다.

```powershell
git diff scripts/norm/attachment-diagnostic.ts scripts/norm/avoidance-residual-diagnostic.ts scripts/norm/def-term-residual-diagnostic.ts
```

- [ ] 기존 진단 스크립트 세 개가 **수정되지 않았는가**

### 4-2. 보정량 하드코딩 여부 — 핵심 검증

```powershell
Get-ChildItem scripts/norm -File -Include *.ts | Select-String -Pattern '4\.5|5\.25'
```

**금지 대상은 회피축 수준별 결과값뿐입니다.** `V`가 사라진
`{4.5, 0, -5.25}` 형태의 상수 배열·룩업이 있으면 안 됩니다.

`0.3`·`25`·`/ 2`·`7.5 - 0.15 * V`는 **식의 구성 요소이고 `V`에서
계산하는 형태**라 정상입니다. 이것들을 패턴에 넣으면 정상 구현이 매번
걸리고, 오탐이 반복되면 이 검사를 건너뛰게 됩니다.

- [ ] `V_i`를 `inferLoveType`에서 얻어 식으로 계산하는가
- [ ] 보정량이 프로파일과 무관한 상수 배열·룩업으로 들어가 있지 않은가

**하드코딩이면 부호나 대응이 틀렸을 때 아무도 못 잡습니다.**

### 4-3. 산출 검산

```powershell
$v2 = Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
($v2.stats.def.sorted | Measure-Object -Average).Average
$v2.stats.def.mean
```

**당신이 직접 계산해 에이전트의 ①과 대조하세요.**

- [ ] `computedMean`이 보고와 일치하는가
- [ ] `storedMean`이 2-4 기록과 일치하는가
- [ ] 배열 길이가 3,888인가

### 4-4. ③이 요구한 형태로 왔는가

- [ ] `maxAbsDiff` · `mismatchCount` · `meanDiff` · `reconstructedMean`
      **넷이 전부** 있는가
- [ ] 불린 하나로 대체되지 않았는가

**`meanDiff`가 특히 중요합니다.** 모든 원소에서 같은 값이면 일정한
이동이고, 흩어져 있으면 원소별로 다른 오류입니다.

`mismatchCount`가 0이 아니면 **`maxAbsDiff`의 크기**를 함께 보세요.

### 4-5. 재실행 일관성

진단 스크립트를 한 번 더 돌려 같은 수치가 나오는지 확인하세요.

### 4-6. 표준 검증

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
- v2 생성 커밋: {해시}
- v2 시절 DEF 애착 항: {git show 출력} — 문서와 일치 {O/X}
- v2 DEF 정렬 배열 길이: {N} / 저장된 평균: {값}
- 재사용 함수: {경로 · 시그니처}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 무변경 확인 (최우선)
- src/ 변경: {없음 / 있음 — 즉시 보고}
- norm-synthetic-v2.json 변경: {없음 / 있음 — 즉시 보고}
- 기존 진단 스크립트 3개: {무변경 / 수정됨}

## 보정량 하드코딩 여부 (핵심)
- V_i 획득 경로: {그대로}
- 보정량 상수·룩업 존재: {없음 / 있음 — 내용}

## 진단 스크립트
- 경로: {경로} / 실행 명령: {그대로}
- 재실행 수치 동일: {동일 / 다름}

## ① v2 파일 내부 정합성
- computedMean = {값}
- storedMean   = {값}
- 차           = {값}
- 배열 길이: {N}
- 메인 세션 직접 계산 결과: {일치 / 불일치 — 값}

## ② 역산
- reconstructedMean = {값}

## ③ 비교
- maxAbsDiff    = {값}
- mismatchCount = {N} (임계 1e-9)
- meanDiff      = {값}

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
- **예상값이나 회피축 보정량을 에이전트에게 알려주는 것**
- 수치를 **당신이 해석하는 것** — 어느 쪽이 틀렸다는 판단을 하지 마세요
- **`norm-synthetic-v2.json`을 고치는 것** — 오류가 확인돼도 그대로 둡니다
- `src/` 아래 무엇이든 고치는 것
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 진단 스크립트를 고치는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
