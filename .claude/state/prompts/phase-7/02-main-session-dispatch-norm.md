# 메인 세션 지시 — Phase 7 선행 준비 #2 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/02-main-session-dispatch-norm.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
> (위임 전 개정 — MASTER Part 10-8-2 산술평균 위치 확정 반영)
>
> 짝: `02-engine-dev-norm-enumeration.md` (같은 순번 = 같은 작업의 지시/위임 한 쌍)
> 기반: `00-main-session-dispatch-r2.md`의 절차를 이 작업에 맞게 조정

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**
구현은 `engine-dev` 서브에이전트에게 위임하고, 당신은 사전 점검과 검증을 맡습니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

**`docs/ONDOLOG_MASTER.md`를 전체 통독하지 마세요.**

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` | 현재 Phase 진행 상태 |
| `.claude/state/HANDOFF.md` | 직전 작업(#1)의 인계 사항 |
| `.claude/state/DECISIONS.md` | 확정된 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/02-engine-dev-norm-enumeration.md` | **이번에 위임할 프롬프트 원문** |

이어서 엔진 구조를 확인합니다. 이번 작업은 **기존 채점 함수를 재사용하는 것이
핵심 제약**이라, 당신이 무엇이 있는지 알아야 검증할 수 있습니다.

```powershell
Get-ChildItem src/engine -Recurse -File | Select-Object FullName
Get-ChildItem __tests__ -Recurse -File | Select-Object FullName
Get-ChildItem scripts -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName
```

`src/engine/leagueStats.ts`는 내용까지 읽으세요. 이번 위임에서 **건드리지
않아야 하는 파일**이라 현재 형태를 알아야 합니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

출력이 있으면 **멈추고 보고하세요.** `#2`의 산출물도 대부분 신규 파일이라,
기준선이 더러우면 무엇이 에이전트의 변경인지 구분할 수 없습니다.

### 2-2. 참조할 절이 실제로 존재하는가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '10-1-3|10-2\.|10-8-1|10-8-2|10-8-3|17-3'
```

여섯 절이 전부 실재해야 합니다. **하나라도 없으면 위임하지 마세요.**
없는 절이 무엇인지 목록으로 보고하고 멈추세요.

### 2-3. 10-8-2가 산술평균 위치를 확정하고 있는가

위임 프롬프트가 "산술평균은 백분위 **앞**"을 전제로 쓰여 있습니다.
문서가 이를 확정하지 않은 상태면 프롬프트와 문서가 어긋나고,
에이전트는 착수 전에 멈춥니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '산술평균은 백분위' -Context 0,6
```

확정 문구가 없으면 **멈추고 보고하세요.**

### 2-4. 기존 채점 함수가 실제로 존재하는가

이번 위임의 전제입니다. 없으면 프롬프트의 핵심 제약이 성립하지 않습니다.

```powershell
Select-String -Path src/engine/*.ts -Pattern 'enneagram|attachment|sternberg|bigFive|PUS|EMP|REA' -List
```

5문항 채점(에니어그램 코어·빅5·애착·스턴버그)과 6각 스탯 산출을 담당하는
파일이 보이는지 확인하고, **파일 경로 목록을 보고에 포함하세요.**
전혀 없으면 멈추고 보고하세요 — 에이전트가 채점을 새로 짜게 되고,
그게 이 작업에서 가장 피해야 할 결과입니다.

### 2-5. 테스트 기준선 확인

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 267개 통과 / tsc 0 에러.**
숫자가 다르면 보고 대상입니다.

---

## 3단계 — 위임

### 지켜야 할 것

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**
`02-engine-dev-norm-enumeration.md`를 에이전트가 직접 전문 읽게 합니다.
당신이 요약하면 그것이 새로운 모호함이 되고, 결과가 어긋났을 때
원문 결함인지 당신의 요약 결함인지 추적할 수 없게 됩니다.

**당신의 해석이나 구현 방향 제안을 덧붙이지 마세요.**
JSON 구조, 백분위 조회 방식, 스크립트 배치는 에이전트 판단 영역으로
열어둔 것입니다.

**분산 지배 점검과 에니어그램 분포에 대해 당신의 해석을 주지 마세요.**
프롬프트가 "수치만 보고하고 판단하지 말 것"으로 막아뒀습니다.
당신이 방향을 암시하면 그 막음이 무너집니다.

### 위임 메시지

아래를 그대로 사용하세요.

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/02-engine-dev-norm-enumeration.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 이 작업에서 가장 중요한 제약이 무엇인지
2. 규준 데이터에 반드시 포함해야 하는 분포가 몇 종류이며 각각 무엇인지
3. 건드리지 말아야 할 기존 파일이 무엇인지

확인 후, 문서가 지시한 대로 기존 채점 함수를 먼저 찾아 경로와 시그니처를
보고하고, 그다음 열거를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

**에이전트 보고서를 그대로 믿지 마세요.**

### 4-1. 변경 범위 대조

```powershell
git status --porcelain -uall
git diff --stat
git diff package.json app.json eas.json tsconfig.json
```

**`git diff --stat`만으로는 이번 산출물 대부분을 볼 수 없습니다.** 신규 파일은
diff에 나타나지 않습니다. `git status --porcelain -uall`이 주 검증 명령입니다.

예상 신규 파일(`??`):

- 생성 스크립트 (`scripts/` 하위)
- `src/engine/data/norm-synthetic-v1.json`
- 백분위 조회 함수 파일 (`src/engine/` 하위)
- 테스트 파일 (`__tests__/engine/` 하위)

예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md` 뿐.

**이 밖의 항목이 있으면 전부 보고하세요.** 특히 `src/engine/leagueStats.ts`에
`M`이 붙어 있으면 프롬프트의 금지 사항 위반입니다.

### 4-2. 채점 재구현 여부 — 이번 작업의 핵심 검증

**보고서의 다른 수치보다 이것을 먼저 보세요.** 여기가 틀렸으면 나머지 결과는
전부 무의미합니다.

생성 스크립트를 직접 열어 `import` 문을 확인하세요.

```powershell
Select-String -Path scripts/*.ts -Pattern 'import' -Context 0,2
```

- 기존 `src/engine/` 채점·스탯 함수를 import하고 있는가
- 스크립트 안에 에니어그램 룩업 테이블·빅5 사전값(72/28 등)·애착 축 수치
  (20/50/85)·스탯 가중치가 **다시 적혀 있지 않은가**

숫자가 스크립트 안에 재등장하면 재구현입니다. 값이 우연히 일치하더라도
두 벌이 된 순간 이후에 갈라집니다. **발견되면 보고하고 멈추세요.**

### 4-3. 데이터 검증

```powershell
Get-Content src/engine/data/norm-synthetic-v1.json -Raw | ConvertFrom-Json
(Get-Item src/engine/data/norm-synthetic-v1.json).Length
```

- 프로파일 수가 정확히 **3,888**인가
- `version`이 `synthetic-v1`인가
- **합성값 분포**(6스탯 산술평균의 분포)가 평균·표준편차·분위수·조회 형태로 있는가
- **스탯 6종**(PUS·EMP·ATT·DEF·TAC·REA) 각각의 분포가 동일 형식으로 있는가
- **둘 중 하나만 있으면 미완입니다.** 합성값 분포가 OVR 백분위의 대상이고,
  스탯별 분포는 수축 사전평균·표준편차와 대조용입니다
- 파일 크기를 기록하세요 — 앱 번들 영향 판단 근거입니다

### 4-4. 재생성 결정론

이 작업의 결정론 검증입니다. 생성 스크립트를 한 번 더 돌려 **바이트 단위로
동일한 파일이 나오는지** 확인하세요.

```powershell
Copy-Item src/engine/data/norm-synthetic-v1.json $env:TEMP/norm-check.json
# 생성 스크립트 재실행 (에이전트 보고서에 적힌 명령)
Get-FileHash src/engine/data/norm-synthetic-v1.json, $env:TEMP/norm-check.json
Remove-Item $env:TEMP/norm-check.json
```

해시가 다르면 어딘가에 비결정적 요소(객체 키 순서, 부동소수점 누적 순서,
타임스탬프)가 있다는 뜻입니다. **보고하세요.**

### 4-5. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED" src/engine/
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/ scripts/
```

- 테스트: **267 대비 감소가 없어야 합니다.** 기존 테스트가 깨졌다면
  에이전트가 고쳐서 통과시켰는지 `git diff __tests__/`로 확인하세요.
  **기존 테스트 파일 수정은 금지 사항입니다.**
- tsc: **0 에러.** 어제 `types` 화이트리스트를 넣어 기준선이 0이 됐으므로
  이제 0이 아니면 그 자체가 이번 작업의 결함입니다
- `UNRESOLVED`: **여전히 3건이어야 합니다.** 줄었으면 에이전트가
  `leagueStats.shrinkage`를 임의로 해소한 것이므로 보고하세요
- 결정론 grep은 `scripts/`까지 봅니다. 생성 스크립트에 타임스탬프가
  들어가면 4-4가 깨집니다

### 4-6. 금지 영역 무변경 확인

```powershell
git status --porcelain -uall src/engine/leagueStats.ts
git diff src/engine/leagueStats.ts
```

**변경이 없어야 정상입니다.** OVR 파이프라인 순서는 확정됐지만 배선은
별도 작업이며 이번 범위 밖입니다.

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 참조 절 존재: 10-1-3 {O/X} / 10-2 {O/X} / 10-8-1 {O/X} / 10-8-2 {O/X} / 10-8-3 {O/X} / 17-3 {O/X}
- 10-8-2 산술평균 위치 확정 문구: {있음/없음}
- 기존 채점 함수 파일: {경로 목록}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 채점 재구현 여부 (최우선)
- 생성 스크립트 import 목록: {그대로}
- 스크립트 내 채점 상수 재등장: {없음 / 있음 — 내용}

## 산출물
- git status --porcelain -uall 출력 전문
- 예상 외 신규 파일: {있으면 목록}
- 기존 파일 수정(M): {목록}
- norm-synthetic-v1.json 크기: {N} bytes

## 데이터 검증
- 프로파일 수: {N} (기대 3,888)
- version: {값}
- 합성값 분포: {있음/없음}
- 스탯별 분포 6종: {있음/없음}
- 재생성 해시 일치: {일치/불일치}

## 표준 검증
- 테스트: 267 → {현재}
- tsc: {N}에러
- UNRESOLVED grep: {N}건 — {키 목록}
- leagueStats.ts 변경 여부: {없음 / 있음 — 내용}

## 에이전트가 보고한 점검 수치 (판단하지 말고 그대로 옮길 것)
- 분산 지배 점검 — 스탯 6종 표준편차: {그대로}
- 에니어그램 코어 9종별 합성값 분포: {그대로}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 열거 스크립트를 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- 분산 지배나 에니어그램 분포 수치를 **당신이 해석하는 것** — 수치만 옮기세요.
  표준화 도입도 가중치 도입도 마스터 PM 결정입니다
- OVR 파이프라인을 이번 기회에 배선하는 것 — 별도 작업입니다
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
