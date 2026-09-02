# 메인 세션 지시 — Phase 7 선행 준비 #2 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/02-main-session-dispatch-norm.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
> (위임 전 개정 — MASTER Part 10-8-2·10-8-3 확정분 반영)
>
> 짝: `02-engine-dev-norm-enumeration.md` (같은 순번 = 같은 작업의 지시/위임 한 쌍)

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

### 2-3. 문서가 프롬프트의 전제를 확정하고 있는가

위임 프롬프트는 세 가지를 확정 사항으로 전제합니다. 문서가 이를 담고 있지 않으면
프롬프트와 문서가 어긋나고, 에이전트는 착수 전에 멈춥니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '산술평균은 백분위' -Context 0,4
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '인자로 주입' -Context 0,4
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '엔진 코드 버전' -Context 0,4
```

세 문구가 전부 확인돼야 합니다. **하나라도 없으면 멈추고 보고하세요.**

### 2-4. 기존 채점 함수가 실제로 존재하는가

이번 위임의 전제입니다. 없으면 프롬프트의 핵심 제약이 성립하지 않습니다.

```powershell
Select-String -Path src/engine/*.ts -Pattern 'enneagram|attachment|sternberg|bigFive|PUS|EMP|REA' -List
```

**파일 경로 목록을 보고에 포함하세요.** 전혀 없으면 멈추고 보고하세요 —
에이전트가 채점을 새로 짜게 되고, 그게 이 작업에서 가장 피해야 할 결과입니다.

### 2-5. 엔진 버전 소스가 존재하는가

프롬프트가 `engineVersion`을 **기존 소스에서 가져오라**고 지시합니다.
없으면 에이전트가 값을 지어내거나 멈춥니다.

```powershell
Select-String -Path src -Pattern 'engine_version|engineVersion|ENGINE_VERSION' -Recurse -List
```

**찾은 경로를 보고에 포함하세요.** 없으면 그 사실을 보고하고 멈추세요 —
새로 만드는 것은 이번 위임의 범위가 아닙니다.

### 2-6. 테스트 기준선 확인

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 267개 통과 / tsc 0 에러.**

---

## 3단계 — 위임

### 지켜야 할 것

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**
`02-engine-dev-norm-enumeration.md`를 에이전트가 직접 전문 읽게 합니다.
당신이 요약하면 그것이 새로운 모호함이 되고, 결과가 어긋났을 때
원문 결함인지 당신의 요약 결함인지 추적할 수 없게 됩니다.

**당신의 해석이나 구현 방향 제안을 덧붙이지 마세요.**
JSON 구조, 백분위 조회 방식, 스크립트 배치는 에이전트 판단 영역으로 열어둔 것입니다.

**분산 지배 점검과 에니어그램 분포에 대해 당신의 해석을 주지 마세요.**
프롬프트가 "수치만 보고하고 판단하지 말 것"으로 막아뒀습니다.

### 위임 메시지

아래를 그대로 사용하세요.

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/02-engine-dev-norm-enumeration.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이 작업에서 가장 중요한 제약이 무엇인지
2. 규준 데이터에 담아야 하는 것이 무엇무엇인지
3. 백분위 조회 함수가 규준 데이터를 어떻게 받아야 하는지
4. 건드리지 말아야 할 기존 파일이 무엇인지

확인 후, 문서가 지시한 대로 기존 채점 함수와 엔진 버전 소스를 먼저 찾아
경로를 보고하고, 그다음 열거를 진행해주세요.
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

예상 신규 파일(`??`): 생성 스크립트, 열거 순수 함수, 규준 JSON,
백분위 조회 함수, 테스트 파일.
예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md` 뿐.

**이 밖의 항목이 있으면 전부 보고하세요.** 특히 `src/engine/leagueStats.ts`에
`M`이 붙어 있으면 프롬프트의 금지 사항 위반입니다.

### 4-2. 채점 재구현 여부 — 이번 작업의 핵심 검증

**보고서의 다른 수치보다 이것을 먼저 보세요.** 여기가 틀렸으면 나머지 결과는
전부 무의미합니다.

```powershell
Select-String -Path scripts/*.ts -Pattern 'import' -Context 0,2
```

- 기존 `src/engine/` 채점·스탯 함수를 import하고 있는가
- 스크립트 안에 에니어그램 룩업 테이블·빅5 사전값(72/28 등)·애착 축 수치
  (20/50/85)·스탯 가중치가 **다시 적혀 있지 않은가**

숫자가 재등장하면 재구현입니다. 값이 우연히 일치하더라도 두 벌이 된 순간
이후에 갈라집니다. **발견되면 보고하고 멈추세요.**

### 4-3. 주입 규칙 준수 확인

엔진이 규준 JSON을 직접 import하면 과거 버전 재현이 불가능해집니다.
확정된 금지 사항입니다.

```powershell
Select-String -Path src/engine -Pattern "norm-synthetic|norm-.*\.json|data/norm" -Recurse
```

**`src/engine/` 안에서 매치가 나오면 위반입니다.** (`src/engine/data/` 아래의
JSON 파일 자체는 데이터이므로 제외하고, `import` 하는 코드가 있는지를 보세요.)
백분위 조회 함수의 시그니처를 직접 열어 **규준 데이터가 인자로 들어오는지**
확인하세요.

### 4-4. 데이터 검증

```powershell
Get-Content src/engine/data/norm-synthetic-v1.json -Raw | ConvertFrom-Json
(Get-Item src/engine/data/norm-synthetic-v1.json).Length
```

- **배열 7개**(합성값 1 + 스탯 6) 각각의 길이가 정확히 **3,888**인가
- `version`이 `synthetic-v1`인가
- `engineVersion`이 있고, **2-5에서 찾은 소스의 값과 일치하는가**
- 각 분포에 평균·표준편차·분위수가 함께 있는가
- 에니어그램 코어 9종 요약이 있는가
- 파일 크기를 기록하세요 — 앱 번들 영향 판단 근거입니다

### 4-5. 재생성 결정론

```powershell
Copy-Item src/engine/data/norm-synthetic-v1.json $env:TEMP/norm-check.json
# 생성 스크립트 재실행 (에이전트 보고서에 적힌 명령)
Get-FileHash src/engine/data/norm-synthetic-v1.json, $env:TEMP/norm-check.json
Remove-Item $env:TEMP/norm-check.json
```

해시가 다르면 비결정적 요소(객체 키 순서, 부동소수점 누적 순서, 타임스탬프)가
있다는 뜻입니다. **보고하세요.**

### 4-6. 드리프트 감지 테스트가 실제로 작동하는가

**존재만 확인하지 말고 작동을 확인하세요.** 이 테스트가 통과하도록만 쓰여
있으면 장치 전체가 무의미해집니다(`#1`의 throw 기대 테스트와 같은 함정입니다).

테스트 파일을 직접 읽고 아래를 보세요.

- 열거 순수 함수를 **실제로 재호출**하는가, 아니면 파일을 파일과 비교하는가
- 샘플링·캐싱 없이 3,888개 전체를 대조하는가
- `try/catch`나 느슨한 비교로 불일치를 삼키지 않는가

### 4-7. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED" src/engine/
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/ scripts/
```

- 테스트: **267 대비 감소가 없어야 합니다.** 기존 테스트가 깨졌다면
  `git diff __tests__/`로 에이전트가 고쳐서 통과시켰는지 확인하세요.
  **기존 테스트 파일 수정은 금지 사항입니다.**
- tsc: **0 에러**
- `UNRESOLVED`: **여전히 3건이어야 합니다.** 줄었으면 에이전트가
  `leagueStats.shrinkage`를 임의로 해소한 것이므로 보고하세요
- 결정론 grep은 `scripts/`까지 봅니다. 생성 스크립트에 타임스탬프가 들어가면
  4-5가 깨집니다

### 4-8. 금지 영역 무변경 확인

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
- 확정 문구 3종: 산술평균 위치 {O/X} / 인자 주입 {O/X} / 엔진 코드 버전 {O/X}
- 기존 채점 함수 파일: {경로 목록}
- 엔진 버전 소스: {경로와 값}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 채점 재구현 여부 (최우선)
- 생성 스크립트 import 목록: {그대로}
- 스크립트 내 채점 상수 재등장: {없음 / 있음 — 내용}

## 주입 규칙
- src/engine/ 내 규준 JSON import: {없음 / 있음 — 경로}
- 백분위 조회 함수 시그니처: {그대로}

## 산출물
- git status --porcelain -uall 출력 전문
- 예상 외 신규 파일: {있으면 목록}
- 기존 파일 수정(M): {목록}
- norm-synthetic-v1.json 크기: {N} bytes

## 데이터 검증
- 배열 7개 길이: {각각}
- version / engineVersion: {값} / {값} — 2-5 소스와 일치 {O/X}
- 에니어그램 9종 요약: {있음/없음}
- 재생성 해시 일치: {일치/불일치}

## 드리프트 감지 테스트
- 파일 경로: {경로}
- 열거 재호출 여부: {재호출함 / 파일끼리 비교함}
- 전체 대조 여부: {전체 / 샘플링}

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
- 엔진 버전 소스가 없을 때 **새로 만드는 것** — 보고하고 멈추세요
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
