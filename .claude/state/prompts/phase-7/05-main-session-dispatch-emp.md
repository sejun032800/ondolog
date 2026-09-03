# 메인 세션 지시 — Phase 7 선행 준비 #4 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/05-main-session-dispatch-emp.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
>
> 짝: `05-engine-dev-emp-requeue.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 특이점 셋

**① 기존 테스트가 정당하게 깨집니다.** 지금까지 "기존 테스트 수정 금지"를
위반 탐지의 축으로 써왔지만, 이번엔 EMP 값 테스트와 드리프트 테스트가
반드시 깨집니다. **예외는 이 둘로 한정**되며, 그 밖의 테스트가 깨졌다면
의도하지 않은 파급입니다.

**② 합격 기준을 에이전트에게 주지 않았습니다.** 결과가 기준에 못 미쳤을 때
가중치를 조정해 맞추는 것이 가장 자연스러운 행동이기 때문입니다. **당신도
알려주지 마세요.** 판정은 아래 5단계에서 수치를 받은 뒤에 합니다.

**③ v1 파일은 보존됩니다.** 과거 발행물 재현에 필요합니다. v2가 추가될 뿐
v1이 갱신되는 것이 아닙니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

**`docs/ONDOLOG_MASTER.md`를 전체 통독하지 마세요.**

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` · `DECISIONS.md` | 현재 상태와 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/05-engine-dev-emp-requeue.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem src/engine, scripts/norm -Recurse -File | Select-Object FullName
```

`src/engine/leagueStats.ts`는 **내용까지 읽으세요.** 수정 대상입니다.
현재 EMP 공식과 `LEAGUE_STATS_ENGINE_VERSION` 값을 기록해 두십시오.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

출력이 있으면 **멈추고 보고하세요.**

### 2-2. 17-3이 갱신본인가

> 이 검사는 "문구가 있는가"가 아니라 **"문서가 최신인가"**를 봅니다.
> 순응형 보너스는 2026-09-02 갱신본에만 존재합니다. 옛 판으로 재열거하면
> 아무것도 바뀌지 않은 v2가 나오고, 그 실패는 한참 뒤에 발견됩니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '순응형' -Context 2,4
```

- [ ] **순응형이 EMP에 대응하는 보너스로 나오는가** — 단순히 단어가 있는지가
      아니라, 호나이 삼분법 표에서 순응형 행에 EMP가 적혀 있는지 확인하세요
- [ ] EMP 공식에 보너스 항이 포함돼 있는가

둘 중 하나라도 아니면 **문서를 편집하지 말고** 최신본 교체가 필요하다고
보고하고 멈추세요. 이 파일은 마스터 PM 세션에서 관리됩니다.

### 2-3. 기존 자산이 제자리에 있는가

```powershell
Test-Path src/engine/data/norm-synthetic-v1.json
Get-ChildItem scripts/norm -File | Select-Object Name
Get-ChildItem __tests__/engine -File | Select-Object Name
```

- [ ] v1 규준 파일 존재
- [ ] 열거 순수 함수와 생성 스크립트 존재
- [ ] 드리프트 감지 테스트 존재

없으면 멈추고 보고하세요 — 프롬프트가 재사용을 전제합니다.

### 2-4. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -v "^\s*\*"
```

기준선: **테스트 318개 통과 / tsc 0 에러 / `UNRESOLVED(` 호출 2건**
(정의 1건 + `temperature.activityScore` 소비 1건)

> `UNRESOLVED` 단순 grep은 주석·타입까지 세어 20건이 넘습니다. 위 정밀
> 명령만 사용하세요.

**v1의 코어 9종 분포를 기록해 두십시오.** 5단계 비교에 필요합니다.

```powershell
Get-Content src/engine/data/norm-synthetic-v1.json -Raw | ConvertFrom-Json
```

---

## 3단계 — 위임

### 지켜야 할 것

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.** 에이전트가 직접 전문 읽게 합니다.

**17-3의 가중치 값을 당신이 알려주지 마세요.** 프롬프트가 의도적으로 값을
옮겨 적지 않았습니다. 에이전트가 문서를 직접 읽어야 어긋남이 드러납니다.

**합격 기준(코어 간 폭, 순위 조건)을 알려주지 마세요.** 알려주면 에이전트가
그 숫자에 맞추려 가중치를 건드릴 유인이 생깁니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/05-engine-dev-emp-requeue.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번 작업에서 기존 테스트 수정이 허용되는 범위가 정확히 어디까지인지
2. norm-synthetic-v1.json을 어떻게 다뤄야 하는지
3. 점검 수치가 기대와 다를 때 무엇을 해야 하고 무엇을 하면 안 되는지
4. 건드리지 말아야 할 기존 파일이 무엇인지

확인 후, 문서가 지시한 대로 현재 EMP 공식과 17-3의 공식, 그리고
computeSixStats 소비 모듈을 먼저 보고하고, 그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. v1 보존 확인 (가장 먼저)

```powershell
git status --porcelain -uall src/engine/data/
git diff src/engine/data/norm-synthetic-v1.json
```

**v1에 `M`이 붙거나 diff가 나오면 즉시 보고하고 멈추세요.** 과거 발행물
재현 수단이 훼손된 것입니다.

`??`로 v2만 새로 나타나야 정상입니다.

### 4-2. 변경 범위 대조

```powershell
git status --porcelain -uall
git diff --stat
git diff src/engine/leagueStats.ts
git diff package.json app.json eas.json tsconfig.json
```

`leagueStats.ts`의 diff를 **직접 읽으세요.**

- EMP 공식만 바뀌었는가, 아니면 다른 스탯도 건드렸는가
- 호나이 그룹 판정을 **재사용**했는가, 순응형 판정을 새로 옮겨 적었는가
- `LEAGUE_STATS_ENGINE_VERSION`이 올랐는가

**아래에 `M`이 붙으면 위반입니다.**

```powershell
git status --porcelain -uall src/engine/temperature.ts src/engine/constants/unresolved.ts
```

### 4-3. 가중치 임의 조정 여부 — 이번 작업의 핵심 검증

**보고서의 수치보다 이것을 먼저 보세요.**

```powershell
git diff src/engine/leagueStats.ts | Select-String -Pattern '0\.\d+'
```

diff에 나타난 EMP 가중치를 **17-3 원문과 한 줄씩 대조하세요.**
하나라도 다르면 에이전트가 수치를 맞추려 조정한 것입니다. **보고하고 멈추세요.**

### 4-4. 깨진 테스트의 범위 확인

```powershell
git diff __tests__/
npx jest --ci --watchAll=false
```

- [ ] 수정된 테스트가 **EMP 값 검증 + 드리프트 테스트로 한정**되는가
- [ ] 그 밖의 테스트가 수정됐다면 **위반입니다.** 보고하세요
- [ ] 새 기댓값이 보고서에 파일·테스트명·기존값·새값으로 열거됐는가

### 4-5. 드리프트 테스트가 여전히 작동하는가

테스트 파일을 직접 읽으세요.

- [ ] 대조 대상이 **v2**로 갱신됐는가
- [ ] **열거를 실제로 재호출**하는가 — 파일끼리 비교로 바뀌지 않았는가
- [ ] 샘플링·`try/catch`·근사 비교가 들어가지 않았는가

### 4-6. v2 데이터 검증

```powershell
Get-Content src/engine/data/norm-synthetic-v2.json -Raw | ConvertFrom-Json
(Get-Item src/engine/data/norm-synthetic-v2.json).Length
```

- [ ] `version`이 `synthetic-v2`인가
- [ ] `engineVersions`의 `leagueStats`가 **올라간 값**인가
- [ ] 배열 7개 각각의 길이가 정확히 **3,888**인가

### 4-7. 재생성 결정론

```powershell
Copy-Item src/engine/data/norm-synthetic-v2.json $env:TEMP/norm-check.json
# 생성 스크립트 재실행 (에이전트 보고서에 적힌 명령)
Get-FileHash src/engine/data/norm-synthetic-v2.json, $env:TEMP/norm-check.json
Remove-Item $env:TEMP/norm-check.json
```

해시가 다르면 보고하세요.

### 4-8. 표준 검증

```powershell
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -v "^\s*\*"
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/ scripts/
```

- tsc: **0 에러**
- `UNRESOLVED(` 호출: **2건 유지**

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 17-3 갱신 확인: 순응형→EMP {O/X} / EMP 공식에 보너스 항 {O/X}
- 기존 자산: v1 {O/X} / 열거 함수 {O/X} / 드리프트 테스트 {O/X}
- 기준선: 테스트 {N}개 / tsc {N}에러 / UNRESOLVED( {N}건
- 변경 전 EMP 공식: {그대로}
- 변경 전 LEAGUE_STATS_ENGINE_VERSION: {값}

## v1 보존 (최우선)
- v1 변경 여부: {없음 / 있음 — 즉시 보고}

## 가중치 조정 여부 (최우선)
- 변경 후 EMP 가중치: {각 항과 값}
- 17-3 원문 가중치: {각 항과 값}
- 일치 여부: {일치 / 불일치 — 내용}

## 변경 범위
- git status --porcelain -uall 출력 전문
- leagueStats.ts diff 요지: {EMP만 / 다른 스탯도 — 내용}
- 호나이 그룹 판정: {재사용 / 새로 작성}
- LEAGUE_STATS_ENGINE_VERSION: {변경 전} → {변경 후}
- 금지 파일 변경: temperature {O/X} / unresolved {O/X}

## 깨진 테스트
- 수정된 테스트 목록: {파일 · 테스트명 · 기존값 · 새값}
- EMP·드리프트 외 수정: {없음 / 있음 — 위반}

## 드리프트 테스트
- 대조 대상: {v1 / v2}
- 열거 재호출 여부: {재호출함 / 파일끼리 비교함}
- 전체 대조 여부: {전체 / 샘플링}

## v2 데이터
- version / engineVersions: {값}
- 배열 7개 길이: {각각}
- 파일 크기: {N} bytes
- 재생성 해시 일치: {일치/불일치}

## 표준 검증
- 테스트: 318 → {현재}
- tsc: {N}에러
- UNRESOLVED( 호출: {N}건

## 점검 수치 (판단하지 말고 그대로 옮길 것)
- 코어 9종 분포: {평균·표준편차·최소·최대·표본수}
- 코어 간 평균 폭: {값} (v1: 5.75)
- 평균 오름차순 코어 순위: {1위부터 9위까지}
- 스탯 6종 평균·표준편차: {그대로}
- 합성값 평균·표준편차: {그대로}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **17-3의 가중치나 합격 기준을 에이전트에게 알려주는 것**
- 점검 수치를 **당신이 해석하거나 합격 판정하는 것** — 수치만 옮기세요
- `docs/ONDOLOG_MASTER.md`를 편집하는 것 — 마스터 PM 세션 소유입니다
- **`norm-synthetic-v1.json`을 지우거나 정리하는 것** — 보존 대상입니다
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
