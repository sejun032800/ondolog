# 메인 세션 지시 — Phase 7 선행 준비 #7 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/08-main-session-dispatch-def2.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-03
>
> 짝: `08-engine-dev-def-neutral-avoidance.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 핵심 위험 — 직전 시도가 여기서 실패했습니다

**바뀌어야 하는 것은 회피축뿐입니다. 불안축은 원래대로여야 합니다.**

직전 시도는 DEF의 애착 항을 `100 − 불안축`으로 바꿨는데, 회피축이 빠지는
동시에 **불안축 가중이 2배가 되어** 순계수가 부호를 바꿨습니다. 회피축
수치만 보면 목표를 정확히 맞춘 것처럼 보였습니다. **대조군인 불안축을
확인해야만 드러납니다.**

4단계에서 불안축 복귀를 독립 검증합니다.

**예측값과 합격 기준을 당신에게 주지 않았습니다.** 알면 그 숫자에 맞추려는
유인이 생깁니다. 판정은 수치를 받은 뒤에 합니다.

---

## 0단계 — 선행 조건 확인

이 지시서는 아래가 끝난 뒤에 실행합니다. 안 됐으면 멈추고 보고하세요.

- [ ] `#6` 애착축 진단 수치(회피축·불안축 3수준, 교차표, 4유형)가
      `PROGRESS.md`에 복원되고 커밋됨
- [ ] 직전 시도의 작업 트리가 stash 또는 폐기되어 `git status --porcelain`이 빔

> `#6` 수치는 **스크립트 재실행으로 복구되지 않습니다.** 스크립트가 대고
> 도는 엔진이 바뀌었기 때문입니다. 전후 비교의 기준값이므로 커밋된
> 상태여야 합니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` · `DECISIONS.md` | 현재 상태와 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/08-engine-dev-def-neutral-avoidance.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem src/engine, scripts/norm -Recurse -File | Select-Object FullName
```

`src/engine/leagueStats.ts`를 **내용까지 읽으세요.** 현재 EMP·DEF 공식,
애착 안정성 공용 함수, `LEAGUE_STATS_ENGINE_VERSION`을 기록해 두십시오.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
git log --oneline -3
```

출력이 있으면 **멈추고 보고하세요.**

### 2-2. 17-3이 재설계본인가

> **"문구가 있는가"가 아니라 "문서가 최신인가"를 봅니다.**
> 직전 판(`100 − 불안축`)이 남아 있으면 같은 실패를 반복합니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '75 −|75 -' -Context 2,4
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '순계수' -Context 4,8
```

- [ ] DEF의 애착 항이 **`75 − 불안축/2`** 형태인가
- [ ] `100 − 불안축` (직전 판)이 **남아 있지 않은가**
- [ ] **두 축 순계수 표**가 존재하는가 — 불안 `+0.10` / 회피 `−0.10`
- [ ] EMP의 애착 항은 **그대로**인가

하나라도 아니면 **문서를 편집하지 말고** 최신본 교체가 필요하다고
보고하고 멈추세요.

### 2-3. 기존 자산이 제자리에 있는가

```powershell
Test-Path src/engine/data/norm-synthetic-v1.json, src/engine/data/norm-synthetic-v2.json
Get-ChildItem scripts/norm -File | Select-Object Name
```

- [ ] v1·v2 규준 파일
- [ ] 열거 순수 함수, 생성 스크립트
- [ ] **애착축 진단 스크립트**
- [ ] 드리프트 감지 테스트

### 2-4. v2 기준선 확보 — 판정의 전제입니다

`norm-synthetic-v2.json`과 `PROGRESS.md`에서 아래를 읽어 기록하십시오.

**엄격 대조용 (한 비트도 달라지면 안 됨)**

```
EMP 평균 ______ / sd ______
PUS ______ / ATT ______ / TAC ______ / REA ______  (평균·sd)
코어 간 평균 폭 ______
```

**변화 확인용**

```
DEF 평균 ______ / sd ______
합성값 평균 ______ / sd ______
회피축 3수준 ______ / ______ / ______
불안축 3수준 ______ / ______ / ______   ← 가장 중요
```

> **불안축 3수준이 이번 판정의 핵심입니다.** v3에서 이 값이 v2로
> 돌아와야 합니다.

### 2-5. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

기준선: **테스트 318개 / tsc 0 에러 / `UNRESOLVED(` 2건**

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**17-3의 가중치, 예측값, 합격 기준을 알려주지 마세요.**

**직전 시도가 어떻게 실패했는지 당신의 말로 설명하지 마세요.** 프롬프트
배경에 이미 들어 있습니다. 덧붙이면 에이전트가 그 서술에 맞추려 합니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/08-engine-dev-def-neutral-avoidance.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 다섯 가지로 먼저 확인해주세요.
1. 이 변경으로 바뀌어야 하는 축과 바뀌면 안 되는 축이 각각 무엇인지
2. 공용 애착 헬퍼를 어떻게 다뤄야 하는지
3. DEF 전용 함수가 어떤 인자를 받아야 하고 어떤 인자를 받으면 안 되는지
4. 상태 파일을 어떻게 갱신해야 하는지
5. 점검 수치가 기대와 다를 때 무엇을 하면 안 되는지

확인 후, 문서가 지시한 착수 전 보고 네 가지를 먼저 보고하고,
그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 불안축 복귀 — 이번 작업의 최우선 검증

**다른 무엇보다 먼저 보세요.** 직전 시도가 무너진 지점입니다.

- [ ] v3의 **불안축 3수준 평균이 2-4에서 기록한 v2 값과 같은가**
- [ ] 총차의 **부호가 양수**인가
- [ ] 다르면 **즉시 보고하고 멈추세요**

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern 'anxiety|Anxiety|attach' -Context 3,3
```

- [ ] DEF 전용 함수가 **회피축 인자를 받지 않는 형태**인가
- [ ] `computeAttachmentStability` 본문이 **변경되지 않았는가**

### 4-2. 엄격 대조 — 바뀌면 안 되는 것들

v3에서 아래가 **2-4 기록과 완전히 같아야** 합니다. 소수점 이하까지입니다.

- [ ] EMP 평균·sd
- [ ] PUS·ATT·TAC·REA 평균·sd
- [ ] 코어 간 평균 폭

**하나라도 다르면 즉시 보고하고 멈추세요.**

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern 'emp|EMP' -Context 3,3
```

- [ ] EMP 계산식 라인이 무변경인가 (주석 갱신은 무방)

### 4-3. v1·v2 보존 확인

```powershell
git status --porcelain -uall src/engine/data/
git diff src/engine/data/norm-synthetic-v1.json src/engine/data/norm-synthetic-v2.json
```

**둘 중 하나라도 `M`이 붙거나 diff가 나오면 즉시 보고하고 멈추세요.**

### 4-4. 상태 파일 구조 재편 여부 — 이번에 추가된 검증

```powershell
git diff --stat .claude/state/
git diff .claude/state/PROGRESS.md .claude/state/HANDOFF.md
```

- [ ] **삭제된 줄이 있는가** — 항목 추가만 허용됩니다
- [ ] 기존 섹션이 옮겨지거나 통합되지 않았는가
- [ ] **`#6` 진단 수치가 `PROGRESS.md`에 그대로 남아 있는가**

삭제가 있으면 **보고하고, 커밋 전에 복원하십시오.**

### 4-5. 변경 범위 대조

```powershell
git status --porcelain -uall
git diff --stat
git diff src/engine/leagueStats.ts
git diff package.json app.json eas.json tsconfig.json
git status --porcelain -uall src/engine/temperature.ts src/engine/constants/unresolved.ts
```

- DEF만 바뀌었는가, `LEAGUE_STATS_ENGINE_VERSION`이 올랐는가
- 금지 파일에 `M`이 붙으면 위반입니다

### 4-6. 가중치 임의 조정 여부

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern '0\.\d+|75'
```

diff의 DEF 가중치와 상수를 **17-3 원문과 한 줄씩 대조하세요.**
다르면 **보고하고 멈추세요.**

### 4-7. 깨진 테스트의 범위

```powershell
git diff __tests__/
npx jest --ci --watchAll=false
```

- [ ] 수정된 테스트가 **DEF 값 검증 + 드리프트로 한정**되는가
- [ ] **EMP 테스트가 수정됐다면 이 작업의 실패입니다**
- [ ] 새 기댓값이 파일·테스트명·기존값·새값으로 열거됐는가

### 4-8. 드리프트 테스트

- [ ] 대조 대상이 **v3**인가
- [ ] **열거를 실제로 재호출**하는가
- [ ] 샘플링·`try/catch`·근사 비교가 없는가

### 4-9. v3 데이터 검증

- [ ] `version`이 `synthetic-v3`, `engineVersions`의 `leagueStats`가 올랐는가
- [ ] 배열 7개 각각의 길이가 정확히 **3,888**인가
- [ ] **애착축 요약 섹션**이 있는가 (회피 3 + 불안 3, 각 n=1296)
- [ ] 코어 9종 요약이 여전히 있는가
- [ ] 파일 크기 기록

### 4-10. 재생성 결정론

```powershell
Copy-Item src/engine/data/norm-synthetic-v3.json $env:TEMP/norm-check.json
# 생성 스크립트 재실행 (에이전트 보고서에 적힌 명령)
Get-FileHash src/engine/data/norm-synthetic-v3.json, $env:TEMP/norm-check.json
Remove-Item $env:TEMP/norm-check.json
```

### 4-11. 진단 스크립트 무변경 및 재실행

```powershell
git diff scripts/norm/attachment-diagnostic.ts
```

- [ ] **수정되지 않았는가**
- [ ] 직접 재실행해 에이전트 보고 수치와 일치하는가

### 4-12. 표준 검증

```powershell
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/ scripts/
```

- tsc **0 에러**, `UNRESOLVED(` **2건 유지**

---

## 5단계 — 보고

```
## 선행 조건
- #6 수치 PROGRESS.md 복원·커밋: {O/X}
- 직전 시도 작업 트리 정리: {O/X}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 17-3 재설계본: 75−불안축/2 {O/X} / 직전 판 잔존 {있음/없음} / 순계수 표 {O/X} / EMP 그대로 {O/X}
- 기존 자산: v1 {O/X} / v2 {O/X} / 진단 스크립트 {O/X} / 드리프트 {O/X}
- v2 엄격 대조 기준선: EMP {평균/sd} / PUS {} / ATT {} / TAC {} / REA {} / 코어 폭 {}
- v2 변화 확인 기준선: DEF {평균/sd} / 합성값 {평균/sd} / 회피축 {3값} / 불안축 {3값}
- 기준선: 테스트 {N}개 / tsc {N}에러 / UNRESOLVED( {N}건
- 변경 전 DEF·EMP 공식: {그대로}
- 애착 안정성 공용 함수: {경로·시그니처·호출처}

## 불안축 복귀 (최우선)
- v3 불안축 3수준: {값}
- v2와 일치 여부: {일치 / 불일치 — 즉시 보고}
- 총차와 부호: {값}
- DEF 전용 함수 시그니처: {그대로} — 회피축 인자 {받음/안 받음}
- computeAttachmentStability 본문: {무변경 / 변경 — 실패}

## 엄격 대조
- EMP {평균/sd} — v2 일치 {O/X}
- PUS {} / ATT {} / TAC {} / REA {} — v2 일치 {각 O/X}
- 코어 간 평균 폭 {} — v2 일치 {O/X}

## v1·v2 보존
- 변경 여부: {없음 / 있음 — 즉시 보고}

## 상태 파일
- 삭제된 줄: {없음 / 있음 — 내용}
- #6 진단 수치 잔존: {O/X}

## 가중치 조정 여부
- 변경 후 DEF 공식: {각 항과 값}
- 17-3 원문: {각 항과 값}
- 일치 여부: {일치 / 불일치}

## 변경 범위
- git status --porcelain -uall 전문
- leagueStats.ts diff 요지: {DEF만 / 다른 스탯도}
- LEAGUE_STATS_ENGINE_VERSION: {전} → {후}
- 금지 파일 변경: temperature {O/X} / unresolved {O/X}

## 깨진 테스트
- 수정된 테스트: {파일 · 테스트명 · 기존값 · 새값}
- EMP 테스트 수정: {없음 / 있음 — 실패}

## 드리프트 테스트
- 대조 대상 {v3?} / 열거 재호출 {O/X} / 전체 대조 {O/X}

## v3 데이터
- version / engineVersions: {값}
- 배열 7개 길이: {각각}
- 애착축 요약 / 코어 9종 요약: {있음/없음}
- 파일 크기: {N} bytes / 재생성 해시: {일치/불일치}

## 진단 스크립트
- 수정 여부: {없음 / 있음} / 재실행 수치 일치: {일치/불일치}

## 점검 수치 (판단하지 말고 그대로 옮길 것)
- 회피축 3수준 + 단계별 차이 + 총차
- 불안축 3수준 + 단계별 차이 + 총차
- 회피 × 불안 교차표 9칸
- 코어 9종 + 폭 + 순위
- 스탯 6종 평균·sd / 합성값 평균·sd

## 표준 검증
- 테스트: 318 → {현재} / tsc {N}에러 / UNRESOLVED( {N}건

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **17-3의 가중치·예측값·합격 기준을 에이전트에게 알려주는 것**
- **직전 시도의 실패 경위를 당신의 말로 덧붙이는 것** — 프롬프트에 있습니다
- 점검 수치를 **당신이 해석하거나 합격 판정하는 것** — 수치만 옮기세요
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **`v1`·`v2`를 지우거나 정리하는 것**
- **진단 스크립트를 고치는 것**
- **상태 파일에서 줄을 지우는 것** — 복원 대상입니다
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
