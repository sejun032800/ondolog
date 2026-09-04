# 메인 세션 지시 — 회피축 잔차 진단 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/11-main-session-dispatch-avoidance.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-04
>
> 짝: `11-engine-dev-avoidance-residual.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**관측만 하는 작업입니다.** 엔진도 규준집단도 축 정의도 바뀌지 않습니다.
산출물은 진단 스크립트 하나와 그 출력 수치뿐입니다.

그래서 검증의 무게가 **"아무것도 안 바뀌었는가"**에 실립니다.

**그리고 이번에는 특별한 위험이 하나 더 있습니다.** 이 진단은 문서와 코드가
어긋났는지를 찾는 작업입니다. 에이전트가 어긋남을 발견하고 **코드를 문서에
맞춰 고치면 찾으려던 증거가 사라집니다.** 4단계에서 확인합니다.

**예측값과 판정 기준을 당신에게 주지 않았습니다.** 알면 그 숫자에 맞추려는
유인이 생깁니다.

---

## 0단계 — 파일명 확인 (반복되는 문제)

다운로드한 프롬프트 파일을 저장소에 넣을 때 OS가 접미사를 붙이는 일이
`#2`와 `#8`에서 반복됐습니다.

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `11-engine-dev-avoidance-residual.md`로 있는가

파일명에 공백·괄호가 있으면 절대 규칙 4에 어긋나고, 보관 규격이 참조 경로와
달라집니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/11-engine-dev-avoidance-residual.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem scripts -Recurse -File | Select-Object FullName
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`#8` 산출물 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-02-r11'
```

**출력이 없으면 위임하지 마세요.** 문서를 편집하지 말고 보고하고 멈추십시오.

> 리비전이 그 사이 올랐으면 PM에게 확인하고 이 지시서의 값을 갱신한 뒤
> 진행하십시오.

### 2-3. 기존 자산 확인

```powershell
Get-ChildItem scripts/norm -File | Select-Object Name
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'attachAvoidance|Q5_AVOIDANCE_AXIS' -List
```

- [ ] 열거 순수 함수와 기존 애착축 진단 스크립트가 있는가
- [ ] 회피축 채점 로직의 경로·심볼을 보고에 포함하세요

### 2-4. 축 정의의 현재 코드 상태 기록 — 이번에 중요합니다

**진단 후 이 코드가 바뀌지 않았음을 증명해야 합니다.**

```powershell
Get-ChildItem src -Recurse -File -Include *.ts | Select-String -Pattern 'AVOIDANCE_AXIS|ATTACHMENT_AXIS_SCORE' -Context 2,6
```

**출력 전문을 보고에 기록하세요.** 4단계에서 대조합니다.

### 2-5. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 348개 / tsc 0 에러**
(수가 다르면 실측값을 기준선으로 잡고 기록하십시오.)

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**역산된 예상값(평균 초과·폭 초과의 크기)을 알려주지 마세요.** 프롬프트
배경에 필요한 만큼만 들어 있습니다.

**보정의 형태에 대한 가설을 말하지 마세요.** 어떤 문항이 관여할지,
보정 크기가 얼마일지 암시하면 에이전트가 그것을 찾으러 갑니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/11-engine-dev-avoidance-residual.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 이 작업이 만들지 않는 것이 무엇인지
2. 산출할 집계가 몇 개이며 각각 어떤 형태인지
3. 문서와 코드가 어긋난 것을 발견했을 때 무엇을 하면 안 되는지

확인 후, 재사용할 함수의 경로와 시그니처를 먼저 보고하고,
그다음 집계를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 축 정의가 안 바뀌었는가 — 이번 작업의 최우선 검증

```powershell
git status --porcelain -uall src/
git diff src/
```

**`src/` 아래에 변경이 하나라도 있으면 즉시 보고하고 멈추세요.**

특히 축 수치화 상수입니다.

```powershell
Get-ChildItem src -Recurse -File -Include *.ts | Select-String -Pattern 'AVOIDANCE_AXIS|ATTACHMENT_AXIS_SCORE' -Context 2,6
```

- [ ] 출력이 **2-4 기록과 완전히 동일한가**

에이전트가 문서와 코드의 차이를 발견하고 코드를 문서에 맞췄다면,
**이 진단이 찾으려던 증거가 사라진 것입니다.** 발견 자체가 산출물입니다.

### 4-2. 변경 범위

```powershell
git status --porcelain -uall
git diff --stat
```

예상 신규(`??`): 진단 스크립트 (`scripts/` 하위)
예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md`

**이 밖에 무엇이든 있으면 보고하세요.**

```powershell
git diff scripts/norm/attachment-diagnostic.ts
```

- [ ] 기존 진단 스크립트가 **수정되지 않았는가** — 수정되면 `#6`과의
      전후 비교가 성립하지 않습니다

### 4-3. 채점 재구현 여부

```powershell
Get-ChildItem scripts -Recurse -File -Include *.ts | Select-String -Pattern 'import' -Context 0,2
```

새 진단 스크립트가 기존 채점 함수를 import하는지 확인하세요.

- [ ] 스크립트 안에 축 수치(20/50/85)나 `'C'`·`'B'` 판정 조건이
      **다시 적혀 있지 않은가**

**재구현이면 이 진단은 무의미합니다.** 문서 정의대로 다시 구현하면
당연히 문서와 일치하는 값이 나오고, 찾으려던 차이가 사라집니다.
**발견되면 보고하고 멈추세요.**

### 4-4. 빈도 합 검산

보고된 빈도표를 직접 더해보세요.

- [ ] Q5=A 빈도 합이 **1,296**인가
- [ ] Q5=B, Q5=C 각각 **1,296**인가
- [ ] 전체 합이 **3,888**인가
- [ ] ①의 전체 평균이 ②의 빈도가중 평균과 일치하는가

**빈도가중 평균을 직접 계산해 ①과 대조하세요.** 두 집계가 같은 데이터에서
나왔다는 확인입니다. 어긋나면 보고하세요.

### 4-5. 재실행 일관성

진단 스크립트를 **한 번 더 돌려** 같은 수치가 나오는지 확인하세요.

수치가 달라지면 비결정적 요소가 있다는 뜻입니다. 보고하세요.

### 4-6. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

- 테스트: **2-5 기준선 유지**
- tsc: **0 에러**

---

## 5단계 — 보고

```
## 0단계
- 파일명 정리: {불필요 / 정리함 — 내용}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r11: {O/X}
- 열거 함수·기존 진단 스크립트: {O/X}
- 회피축 채점 로직: {경로와 심볼}
- 축 수치화 상수 현재 상태: {2-4 출력 전문}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 축 정의 무변경 (최우선)
- src/ 변경: {없음 / 있음 — 즉시 보고}
- 축 수치화 상수: {2-4와 동일 / 다름 — 내용}

## 채점 재구현 여부
- 진단 스크립트 import 목록: {그대로}
- 스크립트 내 축 수치·판정 조건 재등장: {없음 / 있음 — 내용}

## 진단 스크립트
- 경로: {경로}
- 실행 명령: {그대로}
- 재실행 시 수치 동일: {동일 / 다름}
- 기존 attachment-diagnostic.ts 수정: {없음 / 있음}

## 집계 ① attachAvoidance 전체 평균
- {소수점 6자리 이상}

## 집계 ② Q5 응답별 값 빈도표
- Q5=A: {값: 빈도, ...} — 합 {N}
- Q5=B: {값: 빈도, ...} — 합 {N}
- Q5=C: {값: 빈도, ...} — 합 {N}
- 전체 합: {N}

## 검산
- 빈도 합: A {O/X} / B {O/X} / C {O/X} / 전체 {O/X}
- 빈도가중 평균 vs ①: {일치 / 불일치 — 값}

## 변경 범위
- git status --porcelain -uall 전문

## 표준 검증
- 테스트: {기준선} → {현재} / tsc {N}에러

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 집계를 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **역산된 예상값이나 보정 형태에 대한 가설을 에이전트에게 알려주는 것**
- 수치를 **당신이 해석하는 것** — 보정이 있다/없다는 판단을 하지 마세요
- **문서와 코드의 차이가 보고됐을 때 코드를 고치는 것** — 발견이 산출물입니다
- `src/` 아래 무엇이든 고치는 것 — 이 작업은 관측만 합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 진단 스크립트를 고치는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
