# 메인 세션 지시 — Phase 7 선행 준비 #3 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/03-main-session-dispatch-temperature.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
>
> 짝: `03-engine-dev-temperature.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업이 앞의 둘과 다른 점

**기존 파일을 수정합니다.** `#1`·`#2`는 신규 파일만 만들어 `git status`가 주
검증이었지만, 이번에는 `src/engine/temperature.ts`가 이미 존재하므로
**`git diff`가 실질 검증**입니다. 둘 다 봐야 합니다.

**`UNRESOLVED` grep 건수가 늘어나는 것이 정상입니다.** `temperature.activityScore`가
처음으로 실제 소비되기 때문입니다. 지금까지의 "3건 유지" 기대치를 그대로 적용하면
정상 결과를 실패로 판정하게 됩니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

**`docs/ONDOLOG_MASTER.md`를 전체 통독하지 마세요.**

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` · `DECISIONS.md` | 현재 상태와 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/03-engine-dev-temperature.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem src/engine -Recurse -File | Select-Object FullName
```

`src/engine/temperature.ts`는 **내용까지 읽으세요.** 수정 대상이라
변경 전 상태를 알아야 diff를 판정할 수 있습니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

출력이 있으면 **멈추고 보고하세요.** 이번엔 특히 중요합니다 — 기존 파일
수정 작업이라 diff 기준선이 더러우면 판정이 불가능합니다.

### 2-2. 참조할 절이 실제로 존재하는가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '10-6-5|10-7-1|10-7-5|16-2'
```

**하나라도 없으면 위임하지 마세요.**

### 2-3. 궁합 매트릭스가 코드에 존재하는가

기저 온도의 입력입니다. 없으면 에이전트가 매트릭스를 옮겨 적게 되고,
그게 `#2`에서 경계했던 것과 같은 실패입니다.

```powershell
Get-ChildItem src -Recurse -File -Include *.ts | Select-String -Pattern 'affinity|Affinity|compat|궁합' -List
```

**찾은 경로와 함수명을 보고에 포함하세요.** 전혀 없으면 멈추고 보고하세요.

### 2-4. `temperature.activityScore`가 레지스트리에 있는가

```powershell
Select-String -Path src/engine/constants/unresolved.ts -Pattern 'activityScore' -Context 1,3
```

없으면 멈추고 보고하세요 — 프롬프트가 이 키의 소비를 전제합니다.

### 2-5. 현재 `UNRESOLVED` 건수 기록

```powershell
grep -rn "UNRESOLVED" src/engine/
```

**건수와 각 위치를 기록하세요.** 작업 후 늘어난 것이 소비 지점인지
판정하려면 기준선이 필요합니다.

### 2-6. 테스트 기준선 확인

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 289개 통과 / tsc 0 에러.**

---

## 3단계 — 위임

### 지켜야 할 것

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.** 에이전트가 직접 전문 읽게 합니다.

**Part 10-7의 수치를 당신이 알려주지 마세요.** 프롬프트가 의도적으로 값을
옮겨 적지 않았습니다. 에이전트가 문서를 직접 읽어야 프롬프트와 문서가
어긋날 때 그것이 드러납니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/03-engine-dev-temperature.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 세 부분 중 완전 구현되는 것과 throw로 남는 것이 각각 무엇인지
2. 궁합 매트릭스를 어떻게 다뤄야 하는지
3. 건드리지 말아야 할 기존 파일이 무엇인지

확인 후, 문서가 지시한 대로 temperature.ts의 현재 상태와 궁합 판정 로직의
위치를 먼저 보고하고, 그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 변경 범위 대조 — 이번엔 diff가 실질입니다

```powershell
git status --porcelain -uall
git diff --stat
git diff src/engine/temperature.ts
git diff package.json app.json eas.json tsconfig.json
```

`temperature.ts`의 diff를 **직접 읽으세요.** 기존 구현이 통째로 지워지고
새로 쓰였는지, 살릴 것을 살렸는지가 여기서만 보입니다.

예상 수정(`M`): `temperature.ts`, `PROGRESS.md`, `HANDOFF.md`.
예상 신규(`??`): 테스트 파일.

**아래에 `M`이 붙으면 금지 사항 위반입니다.**

```powershell
git status --porcelain -uall src/engine/unresolved.ts src/engine/constants/unresolved.ts src/engine/leagueStats.ts src/engine/loveTypeInference.ts src/engine/data
```

### 4-2. 매트릭스 재작성 여부

```powershell
git diff src/engine/temperature.ts | Select-String -Pattern '36\.5|39|42'
```

기저 세 값이 `temperature.ts`에 리터럴로 박혀 있으면 **계수 주입 규칙 위반**입니다.
계수는 인자로 들어와야 합니다.

궁합 매트릭스 자체가 `temperature.ts` 안에 다시 적혔는지도 diff에서 확인하세요.
2-3에서 찾은 기존 로직을 import하고 있어야 정상입니다.

### 4-3. `UNRESOLVED` 건수 판정

```powershell
grep -rn "UNRESOLVED" src/engine/
git diff src/engine/constants/unresolved.ts
```

- **선언 3건은 그대로여야 합니다.** `unresolved.ts`에 diff가 있으면 위반입니다
- **소비 지점이 늘어난 것은 정상입니다.** 2-5 기준선보다 늘었다면 늘어난
  위치가 `temperature` 관련인지 확인하세요
- `temperature.activityScore` 외의 키가 소비되면 보고하세요

### 4-4. throw가 실제로 일어나는가

테스트 파일을 직접 읽고 확인하세요.

- 최종 온도 함수의 throw를 기대하는 테스트가 있는가
- **기저 온도 테스트는 throw 없이 값을 검증하는가** — 여기까지 throw하면
  ①이 구현되지 않은 것입니다
- `try/catch`로 삼켜 항상 통과하게 만들지 않았는가
- 비대칭 처리, 하한, 프로파일 미비 각각에 테스트가 있는가

### 4-5. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/
```

- 테스트: **289 대비 감소가 없어야 합니다.** 깨졌다면 `git diff __tests__/`로
  에이전트가 고쳐서 통과시켰는지 확인하세요. **기존 테스트 수정은 금지**입니다
- tsc: **0 에러**

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 참조 절 존재: 10-6-5 {O/X} / 10-7-1 {O/X} / 10-7-5 {O/X} / 16-2 {O/X}
- 궁합 판정 로직: {경로와 함수명}
- temperature.activityScore 등록: {O/X}
- UNRESOLVED 기준선: {N}건 — {위치}
- 기준선: 테스트 {N}개 / tsc {N}에러

## temperature.ts 변경 전 상태
- {에이전트 보고 + 당신이 1단계에서 읽은 내용}

## 변경 범위
- git status --porcelain -uall 출력 전문
- git diff --stat 출력
- 금지 파일 변경 여부: unresolved {O/X} / leagueStats {O/X} / loveTypeInference {O/X} / data {O/X}

## 매트릭스·계수 취급
- 궁합 로직 import 여부: {import함 / 재작성함}
- temperature.ts 내 기저값 리터럴: {없음 / 있음 — 내용}
- 계수 주입 방식: {시그니처 그대로}

## UNRESOLVED
- 현재 건수: {N} (기준선 {N})
- 늘어난 위치: {경로와 키}
- unresolved.ts diff: {없음 / 있음 — 내용}

## 테스트
- 기저 온도: throw 없이 값 검증 {O/X}
- 최종 온도: throw 기대 테스트 존재 {O/X}
- 비대칭 / 하한 / 프로파일 미비: {각각 O/X}
- 삼켜진 테스트: {없음 / 있음}
- 테스트: 289 → {현재}
- tsc: {N}에러

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **Part 10-7의 수치를 에이전트에게 알려주는 것** — 문서를 직접 읽게 합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것 — 마스터 PM 세션 소유입니다
- **`UNRESOLVED`가 늘었다는 이유로 실패 판정하는 것** — 이번엔 정상입니다
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
