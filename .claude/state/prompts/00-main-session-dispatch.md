# 메인 세션 지시 — Phase 7 선행 준비 #1 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/00-main-session-dispatch.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**
구현은 `engine-dev` 서브에이전트에게 위임하고, 당신은 사전 점검과 검증을 맡습니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

아래 파일만 읽으세요. **`docs/ONDOLOG_MASTER.md`를 전체 통독하지 마세요.**
4,200줄이고, 이 작업에 필요한 것은 지정된 절뿐입니다.

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` | 현재 Phase 진행 상태 |
| `.claude/state/HANDOFF.md` | 직전 작업의 인계 사항 |
| `.claude/state/DECISIONS.md` | 확정된 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/01-engine-dev-unresolved-spec.md` | **이번에 위임할 프롬프트 원문** |

이어서 구조만 확인합니다.

```powershell
Get-ChildItem src/engine -Recurse -File | Select-Object FullName
Get-ChildItem __tests__ -Recurse -File | Select-Object FullName
```

`src/engine/faceMatch.ts`는 내용까지 읽으세요. 위임 대상이 이 파일의 시그니처를
건드리지 않아야 하는데, 당신이 현재 형태를 알아야 검증할 수 있습니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

출력이 있으면 **멈추고 보고하세요.** 위임 후 `git diff`로 산출물을 대조해야 하는데,
기준선이 더러우면 무엇이 에이전트의 변경인지 구분할 수 없습니다.

### 2-2. 참조할 절이 실제로 존재하는가

위임 프롬프트가 지목하는 네 개 절이 `docs/ONDOLOG_MASTER.md`에 실재하는지 확인하세요.

- Part 16-2 (규격 전문 및 미해결 키 목록)
- Part 10-7-3 / Part 10-8-3 / Part 9-4 (각 키의 근거 절)

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '16-2|10-7-3|10-8-3|9-4'
```

**하나라도 없으면 위임하지 마세요.** 참조 문서를 못 찾은 에이전트는 표만 보고
구현하며, 그 결과는 문서 근거가 없는 코드가 됩니다.
없는 절이 무엇인지 목록으로 보고하고 멈추세요.

### 2-3. Part 16-2가 위임 프롬프트와 일치하는가

Part 16-2를 읽고, 위임 프롬프트의 **키 3종 표**(`temperature.activityScore` /
`leagueStats.shrinkage` / `faceMatch.threshold`)와 대조하세요.
키 이름·Phase·근거 절이 어긋나면 **문서 쪽이 원본입니다.** 임의로 맞추지 말고
차이를 보고하고 멈추세요.

### 2-4. 테스트 기준선 기록

```powershell
npx jest --ci --watchAll=false
```

통과 개수를 기록하세요. 위임 프롬프트는 257개를 전제하고 있습니다.
숫자가 다르면 그것도 보고 대상입니다.

---

## 3단계 — 위임

점검이 전부 통과하면 `engine-dev` 서브에이전트를 호출합니다.

### 지켜야 할 것

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**
`01-engine-dev-unresolved-spec.md`를 에이전트가 직접 전문 읽게 합니다.
당신이 요약하면 그것이 새로운 모호함이 되고, 결과가 어긋났을 때
원문 결함인지 당신의 요약 결함인지 추적할 수 없게 됩니다.

**당신의 해석이나 구현 방향 제안을 덧붙이지 마세요.**
시그니처·에러 타입·자료구조는 에이전트 판단 영역으로 열어둔 것입니다.

### 위임 메시지

아래를 그대로 사용하세요.

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/01-engine-dev-unresolved-spec.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 두 가지로 먼저 확인해주세요.
1. 등록할 키 3종의 이름과 각각의 phase
2. 진행 방식이 몇 단계로 나뉘어 있으며 1단계의 범위가 어디까지인지

확인 후 1단계만 수행하고 보고해주세요. 2단계는 별도 지시가 있을 때까지
진행하지 마세요.
```

---

## 4단계 — 보고 수령 후 검증

**에이전트 보고서를 그대로 믿지 마세요.** 서브에이전트는 중간 과정을 전달하지
못하며, 최종 메시지 하나만 돌아옵니다.

### 4-1. 변경 범위 대조

```powershell
git diff --stat
git diff package.json app.json eas.json tsconfig.json
```

보고서에 없는 파일이 변경됐으면 내용을 확인하고 보고하세요.
설정 파일에 변경이 있으면 그 자체가 절대 규칙 8 위반입니다.

### 4-2. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED" src/engine/
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/
```

- 테스트: 기준선(2-4에서 기록한 값) 대비 **감소가 없어야 합니다.**
  기존 테스트가 깨졌다면 에이전트가 고쳐서 통과시켰는지 `git diff __tests__/`로 확인하세요.
  **기존 테스트 파일 수정은 금지 사항입니다.**
- `UNRESOLVED` grep: 3종이 잡히면 정상입니다. **0건이 목표가 아닙니다.**
  이 명령은 위반 탐지가 아니라 잔여 미확정 계수의 집계입니다.

### 4-3. 시그니처 보존 확인

```powershell
git diff src/engine/faceMatch.ts
```

1단계에서 이 파일은 **변경이 없어야 정상입니다.**
변경이 있으면 위임 프롬프트의 주의 ①을 위반한 것이므로 보고하세요.

### 4-4. 의도된 실패가 실제로 실패하는가

throw를 기대하는 테스트가 `try/catch`로 삼켜져 있지 않은지
`__tests__/engine/unresolved.test.ts`를 직접 읽어 확인하세요.
**항상 통과하도록 쓰인 테스트는 이 규격 전체를 무의미하게 만듭니다.**

---

## 5단계 — 보고

아래 형식으로 정리해주세요.

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 참조 절 존재: Part 16-2 {O/X} / 10-7-3 {O/X} / 10-8-3 {O/X} / 9-4 {O/X}
- Part 16-2와 키 3종 표 일치: {일치 / 차이 있음 — 내용}
- 테스트 기준선: {N}개

## 산출물
- git diff --stat 출력
- 보고서에 없던 변경 파일: {있으면 목록}

## 검증
- 테스트: {기준선} → {현재}
- tsc: {통과/실패}
- UNRESOLVED grep: {N}건 — {키 목록}
- faceMatch.ts 변경 여부: {없음 / 있음 — 내용}
- 삼켜진 테스트 여부: {없음 / 있음}

## faceMatch 호출부 조사 결과
- {에이전트 보고 내용 그대로}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 `unresolved.ts`를 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 2단계(`faceMatch` 호출부 적용)를 이어서 진행하는 것 — 별도 지시를 기다립니다
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
