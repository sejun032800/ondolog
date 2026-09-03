# 메인 세션 지시 — Phase 7 선행 준비 #5 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/07-main-session-dispatch-def.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
>
> 짝: `07-engine-dev-def-anxiety-only.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 핵심 위험

**DEF만 바뀌어야 하고 EMP는 그대로여야 합니다.**

애착 안정성이 공용 헬퍼로 계산되어 EMP·DEF 양쪽에서 호출되고 있을 가능성이
높습니다. 그 헬퍼를 고치면 EMP도 함께 바뀌는데, **결과 수치만 보면
"회피축이 줄었다"로 읽혀 통과처럼 보입니다.** 실제로는 의도한 −0.10이
아니라 0이 되고 불안축까지 움직입니다.

4단계에서 **EMP 무변경을 독립적으로 확인**하는 절차를 넣었습니다.

**예측값과 합격 기준을 당신에게 주지 않았습니다.** 알면 그 숫자에 맞추려는
유인이 생깁니다. 판정은 수치를 받은 뒤에 합니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` · `DECISIONS.md` | 현재 상태와 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/07-engine-dev-def-anxiety-only.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem src/engine, scripts/norm -Recurse -File | Select-Object FullName
```

`src/engine/leagueStats.ts`를 **내용까지 읽으세요.** 현재 EMP·DEF 공식과
`LEAGUE_STATS_ENGINE_VERSION`을 기록해 두십시오.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

진단 스크립트 커밋과 docblock 수정이 끝난 상태여야 합니다.

### 2-2. 17-3이 갱신본인가

> **"문구가 있는가"가 아니라 "문서가 최신인가"를 봅니다.**
> 옛 판으로 재열거하면 v2와 동일한 v3가 나오고, 그 실패는 한참 뒤에
> 발견됩니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DEF' -Context 2,6
```

- [ ] DEF의 애착 항이 **불안축만** 쓰도록 바뀌어 있는가
- [ ] **EMP의 애착 항은 그대로**인가 (양쪽 다 확인하세요)

둘 중 하나라도 아니면 **문서를 편집하지 말고** 최신본 교체가 필요하다고
보고하고 멈추세요.

### 2-3. 기존 자산이 제자리에 있는가

```powershell
Test-Path src/engine/data/norm-synthetic-v1.json, src/engine/data/norm-synthetic-v2.json
Get-ChildItem scripts/norm -File | Select-Object Name
```

- [ ] v1·v2 규준 파일
- [ ] 열거 순수 함수, 생성 스크립트
- [ ] **애착축 진단 스크립트** — 전후 비교에 재사용합니다
- [ ] 드리프트 감지 테스트

### 2-4. EMP 기준선 확보 — 이번에 추가된 점검

**변경 후 EMP가 안 바뀌었음을 증명하려면 기준선이 필요합니다.**

`norm-synthetic-v2.json`에서 **EMP 분포의 평균·표준편차**를 읽어
기록하십시오.

```powershell
Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
```

**기록:** EMP 평균 ______ / EMP sd ______

> v3의 EMP 분포가 이 값과 **완전히 같아야** 정상입니다. 조금이라도
> 다르면 EMP가 영향을 받은 것입니다.

또한 v2의 회피축·불안축·코어 9종 분포도 기록해 두십시오. 5단계 비교에
필요합니다.

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

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/07-engine-dev-def-anxiety-only.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이 작업에서 바뀌어야 하는 스탯과 바뀌면 안 되는 스탯이 각각 무엇인지
2. 애착 안정성이 공유 함수일 때 어떻게 해야 하는지
3. 기존 테스트 수정이 허용되는 범위가 어디까지인지
4. norm-synthetic-v1/v2를 어떻게 다뤄야 하는지

확인 후, 문서가 지시한 착수 전 보고 네 가지(현재 DEF 공식, 현재 EMP 공식,
애착 안정성 공유 여부와 호출처, 17-3의 갱신된 DEF 공식)를 먼저 보고하고,
그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. EMP 무변경 확인 — 이번 작업의 최우선 검증

**다른 무엇보다 먼저 보세요.** 여기가 틀렸으면 나머지 수치는 전부
잘못된 전제 위에 있습니다.

```powershell
Get-Content src/engine/data/norm-synthetic-v3.json -Raw | ConvertFrom-Json
```

- [ ] v3의 **EMP 평균·sd가 2-4에서 기록한 v2 값과 완전히 같은가**
- [ ] 소수점 이하까지 같아야 합니다. 다르면 **즉시 보고하고 멈추세요**

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern 'emp|EMP' -Context 3,3
```

- [ ] EMP 공식 라인이 diff에 **계산식 변경으로 나타나는가** (주석 갱신은 무방)
- [ ] 공용 애착 헬퍼가 수정됐다면 EMP 호출처가 어떻게 보호됐는지 확인

### 4-2. v1·v2 보존 확인

```powershell
git status --porcelain -uall src/engine/data/
git diff src/engine/data/norm-synthetic-v1.json src/engine/data/norm-synthetic-v2.json
```

**둘 중 하나라도 `M`이 붙거나 diff가 나오면 즉시 보고하고 멈추세요.**
`??`로 v3만 새로 나타나야 정상입니다.

### 4-3. 변경 범위 대조

```powershell
git status --porcelain -uall
git diff --stat
git diff src/engine/leagueStats.ts
git diff package.json app.json eas.json tsconfig.json
```

`leagueStats.ts` diff를 **직접 읽으세요.**

- DEF만 바뀌었는가, 다른 스탯 계산식도 건드렸는가
- `LEAGUE_STATS_ENGINE_VERSION`이 올랐는가

```powershell
git status --porcelain -uall src/engine/temperature.ts src/engine/constants/unresolved.ts
```

**`M`이 붙으면 위반입니다.**

### 4-4. 가중치 임의 조정 여부

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern '0\.\d+'
```

diff의 DEF 가중치를 **17-3 원문과 한 줄씩 대조하세요.**
하나라도 다르면 수치를 맞추려 조정한 것입니다. **보고하고 멈추세요.**

### 4-5. 깨진 테스트의 범위

```powershell
git diff __tests__/
npx jest --ci --watchAll=false
```

- [ ] 수정된 테스트가 **DEF 값 검증 + 드리프트로 한정**되는가
- [ ] **EMP 테스트가 수정됐다면 이 작업의 실패입니다.** 보고하세요
- [ ] 새 기댓값이 파일·테스트명·기존값·새값으로 열거됐는가

### 4-6. 드리프트 테스트가 여전히 작동하는가

- [ ] 대조 대상이 **v3**로 갱신됐는가
- [ ] **열거를 실제로 재호출**하는가 — 파일끼리 비교로 바뀌지 않았는가
- [ ] 샘플링·`try/catch`·근사 비교가 없는가

### 4-7. v3 데이터 검증

- [ ] `version`이 `synthetic-v3`인가
- [ ] `engineVersions`의 `leagueStats`가 올라간 값인가
- [ ] 배열 7개 각각의 길이가 정확히 **3,888**인가
- [ ] **애착축 요약 섹션**이 있는가 (회피축 3수준 + 불안축 3수준)
- [ ] 에니어그램 코어 9종 요약이 여전히 있는가
- [ ] 파일 크기 기록

### 4-8. 재생성 결정론

```powershell
Copy-Item src/engine/data/norm-synthetic-v3.json $env:TEMP/norm-check.json
# 생성 스크립트 재실행 (에이전트 보고서에 적힌 명령)
Get-FileHash src/engine/data/norm-synthetic-v3.json, $env:TEMP/norm-check.json
Remove-Item $env:TEMP/norm-check.json
```

### 4-9. 진단 스크립트 재실행

**`v2` 때와 같은 스크립트여야 전후 비교가 성립합니다.**

```powershell
git diff scripts/norm/attachment-diagnostic.ts
```

- [ ] 진단 스크립트가 **수정되지 않았는가** (docblock 외 변경이 있으면 보고)
- [ ] 스크립트를 직접 재실행해 에이전트 보고 수치와 일치하는지 확인

### 4-10. 표준 검증

```powershell
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/ scripts/
```

- tsc: **0 에러**
- `UNRESOLVED(` 호출: **2건 유지**

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 17-3 갱신: DEF 불안축만 {O/X} / EMP 그대로 {O/X}
- 기존 자산: v1 {O/X} / v2 {O/X} / 진단 스크립트 {O/X} / 드리프트 테스트 {O/X}
- v2 EMP 기준선: 평균 {} / sd {}
- 기준선: 테스트 {N}개 / tsc {N}에러 / UNRESOLVED( {N}건
- 변경 전 DEF 공식: {그대로}
- 변경 전 EMP 공식: {그대로}
- 애착 안정성 공유 여부: {공유 / 개별} — {경로와 호출처}

## EMP 무변경 (최우선)
- v3 EMP 평균 / sd: {} / {}
- v2와 일치 여부: {완전 일치 / 불일치 — 즉시 보고}
- EMP 공식 diff: {없음 / 있음 — 내용}
- 공유 헬퍼 처리 방식: {그대로}

## v1·v2 보존
- 변경 여부: {없음 / 있음 — 즉시 보고}

## 가중치 조정 여부
- 변경 후 DEF 가중치: {각 항과 값}
- 17-3 원문: {각 항과 값}
- 일치 여부: {일치 / 불일치}

## 변경 범위
- git status --porcelain -uall 출력 전문
- leagueStats.ts diff 요지: {DEF만 / 다른 스탯도}
- LEAGUE_STATS_ENGINE_VERSION: {전} → {후}
- 금지 파일 변경: temperature {O/X} / unresolved {O/X}

## 깨진 테스트
- 수정된 테스트: {파일 · 테스트명 · 기존값 · 새값}
- EMP 테스트 수정 여부: {없음 / 있음 — 실패}

## 드리프트 테스트
- 대조 대상 {v3?} / 열거 재호출 {O/X} / 전체 대조 {O/X}

## v3 데이터
- version / engineVersions: {값}
- 배열 7개 길이: {각각}
- 애착축 요약 섹션: {있음/없음}
- 코어 9종 요약: {있음/없음}
- 파일 크기: {N} bytes
- 재생성 해시 일치: {일치/불일치}

## 진단 스크립트
- 수정 여부: {없음 / 있음 — 내용}
- 재실행 수치 일치: {일치/불일치}

## 점검 수치 (판단하지 말고 그대로 옮길 것)
- 회피축 3수준: {평균·sd·최소·최대·n} / 단계별 차이 / 총차
- 불안축 3수준: {동일} / 단계별 차이 / 총차
- 회피 × 불안 교차표: {9칸 평균과 n}
- 코어 9종: {평균·sd·최소·최대·n} / 코어 간 폭 / 오름차순 순위
- 스탯 6종 평균·sd: {그대로}
- 합성값 평균·sd: {그대로}

## 표준 검증
- 테스트: 318 → {현재}
- tsc: {N}에러
- UNRESOLVED( 호출: {N}건

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **17-3의 가중치·예측값·합격 기준을 에이전트에게 알려주는 것**
- 점검 수치를 **당신이 해석하거나 합격 판정하는 것** — 수치만 옮기세요
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **`v1`·`v2`를 지우거나 정리하는 것** — 보존 대상입니다
- **진단 스크립트를 고치는 것** — 전후 비교가 성립하지 않게 됩니다
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
