# 메인 세션 지시 — DEF 애착 항 잔차 진단 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/12-main-session-dispatch-def-term.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-04
>
> 짝: `12-engine-dev-def-term-residual.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**관측만 하는 작업이고 산출물이 숫자 몇 개뿐입니다.** 엔진도 규준집단도
바뀌지 않습니다.

**이번 진단은 저장된 수치 자체를 의심하는 작업입니다.** 그래서 ②의 값은
**파일에서 그대로 읽은 것**이어야 하고, 재계산하거나 반올림하면 진단이
성립하지 않습니다. 4-3에서 당신이 직접 대조합니다.

---

## 0단계 — 파일명 확인

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `12-engine-dev-def-term-residual.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/12-engine-dev-def-term-residual.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem scripts/norm -File | Select-Object Name
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

회피축 진단 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-02-r11'
```

리비전이 그 사이 올랐으면 PM에게 확인하고 이 지시서의 값을 갱신한 뒤
진행하십시오.

### 2-3. 두 항 함수가 코드에 존재하는가

이번 위임의 전제입니다. 없으면 에이전트가 식을 다시 적게 됩니다.

```powershell
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'computeAttachmentStability|computeDefAnxietyStability' -Context 1,4
```

**경로·시그니처·export 여부를 보고에 포함하세요.** 둘 다 있어야 합니다.

### 2-4. 규준집단 파일 셋이 있는가

```powershell
Test-Path src/engine/data/norm-synthetic-v1.json, src/engine/data/norm-synthetic-v2.json, src/engine/data/norm-synthetic-v3.json
```

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

**예상값을 알려주지 마세요.** 두 항의 평균이 얼마여야 하는지, 차이가
얼마여야 하는지 전부 알려주지 않습니다. 알면 그 숫자에 맞추려는 유인이
생기고, **이번 진단은 정확히 그 예상이 맞는지를 보는 작업입니다.**

**어긋남의 원인에 대한 가설이나 어느 파일이 의심스러운지도 말하지 마세요.**

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/12-engine-dev-def-term-residual.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 두 항 함수를 어떻게 얻어야 하는지, 그리고 왜 그래야 하는지
2. termDiff를 어느 방향으로 계산해야 하는지
3. 규준집단 파일에서 DEF 평균을 어떻게 가져와야 하는지
4. 이 진단에서 뽑지 말아야 할 것이 무엇인지

확인 후, 두 함수의 경로와 시그니처를 먼저 보고하고,
그다음 산출을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 무변경 확인

```powershell
git status --porcelain -uall src/
git diff src/
git diff scripts/norm/attachment-diagnostic.ts scripts/norm/avoidance-residual-diagnostic.ts
```

**`src/` 아래에 변경이 하나라도 있으면 즉시 보고하고 멈추세요.**

- [ ] 기존 진단 스크립트 두 개가 **수정되지 않았는가**

### 4-2. 항 재작성 여부 — 핵심 검증

```powershell
Get-ChildItem scripts -Recurse -File -Include *.ts | Select-String -Pattern 'import' -Context 0,2
Get-ChildItem scripts/norm -File -Include *.ts | Select-String -Pattern '100 -|75 -|/ 2'
```

- [ ] 새 스크립트가 두 항 함수를 `src/engine/leagueStats`에서 import하는가
- [ ] 스크립트 안에 **항의 식이 다시 적혀 있지 않은가**

**재작성이면 이 진단은 무의미합니다.** 문서 정의대로 다시 계산하면
당연히 문서와 일치하는 값이 나오고, 찾으려던 차이가 사라집니다.
**발견되면 보고하고 멈추세요.**

### 4-3. ②가 파일에서 그대로 읽혔는가 — 이번 진단의 성립 조건

**당신이 직접 세 파일의 DEF 평균을 읽어 에이전트 보고와 대조하세요.**

```powershell
Get-Content src/engine/data/norm-synthetic-v1.json -Raw | ConvertFrom-Json
Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
Get-Content src/engine/data/norm-synthetic-v3.json -Raw | ConvertFrom-Json
```

값이 다르면 에이전트가 재계산했거나 반올림한 것입니다.

- [ ] v1·v2·v3의 DEF 평균이 보고와 일치하는가
- [ ] **v1과 v2의 DEF 평균이 서로 같은가** — 그 사이 변경은 EMP뿐이라
      같아야 합니다. 다르면 별개의 결함이므로 보고하세요

### 4-4. `termDiff` 방향 확인

```powershell
Get-ChildItem scripts/norm -File -Include *.ts | Select-String -Pattern 'termDiff' -Context 2,2
```

- [ ] `termV3mean − termV2mean` 방향인가

**반대로 계산되면 ④의 `(d)` 역산이 부호가 뒤집혀 결론이 반대로 나옵니다.**
보고된 `termDiff`의 부호도 함께 확인하세요.

### 4-5. 산출 검산

- [ ] ①의 두 평균이 소수점 **12자리 이상**으로 보고됐는가
- [ ] 표본 수가 **3,888**인가
- [ ] ④의 네 값 `(a)(b)(c)(d)`가 전부 보고됐는가

**`(c)`와 `(d)`의 판정에는 반올림 여유를 둡니다.**

> 규준집단 파일은 반올림된 값을 저장합니다. 이전 작업에서 코어 간 폭이
> `1.754629` 대 `1.754630`으로 마지막 자리가 달랐고 반올림 최말단으로
> 정리한 전례가 있습니다.
>
> **`|(c)| > 1e-5` 이면 어긋남. 그 이하는 반올림 최말단으로 봅니다.**
> `(d)`도 같은 기준을 적용합니다.

`|(c)| > 1e-5`이면 현재 코드와 v3 파일이 어긋난다는 뜻입니다.
드리프트 감지 테스트가 통과 중이라면 모순이므로 보고하세요.

### 4-6. 재실행 일관성

진단 스크립트를 한 번 더 돌려 같은 수치가 나오는지 확인하세요.

### 4-7. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
git status --porcelain -uall
```

- 테스트: **2-5 기준선 유지**
- tsc: **0 에러**
- 예상 신규(`??`): 진단 스크립트. 예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md`

---

## 5단계 — 보고

```
## 0단계
- 파일명 정리: {불필요 / 정리함 — 내용}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r11: {O/X}
- 두 항 함수: {각각 경로 · 시그니처 · export 여부}
- 규준집단 v1/v2/v3: {O/X}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 무변경 확인
- src/ 변경: {없음 / 있음 — 즉시 보고}
- 기존 진단 스크립트 2개: {무변경 / 수정됨}

## 항 재작성 여부 (핵심)
- 새 스크립트 import 목록: {그대로}
- 스크립트 내 항 식 재등장: {없음 / 있음 — 내용}

## 진단 스크립트
- 경로: {경로} / 실행 명령: {그대로}
- 재실행 수치 동일: {동일 / 다름}

## ① 두 항의 전수 평균 (소수점 12자리 이상)
- termV2mean = {값}
- termV3mean = {값}
- termDiff (v3 − v2) = {값}
- 코드상 계산 방향 확인: {v3−v2 / v2−v3}
- 표본 수: {N}

## ② 규준집단 파일의 DEF 평균 (파일 원값)
- v1 = {값}
- v2 = {값}
- v3 = {값}
- v1 == v2: {O/X}
- 메인 세션 직접 대조 결과: {일치 / 불일치 — 값}

## ③ 현재 코드의 DEF 평균
- {값}

## ④ 대조
- (a) ②v3 − ②v2                    = {값}
- (b) 0.3 × termDiff                = {값}
- (c) ③ − ②v3                      = {값}  · |(c)| > 1e-5 {O/X}
- (d) (③ − 0.3×termDiff) − ②v2     = {값}  · |(d)| > 1e-5 {O/X}

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
- **예상값, 어긋남의 원인, 어느 파일이 의심스러운지를 에이전트에게
  알려주는 것**
- 수치를 **당신이 해석하는 것** — 어느 파일이 틀렸다는 판단을 하지 마세요
- **어긋남이 보고됐을 때 코드나 문서를 고치는 것** — 발견이 산출물입니다
- `src/` 아래 무엇이든 고치는 것
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 진단 스크립트를 고치는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
