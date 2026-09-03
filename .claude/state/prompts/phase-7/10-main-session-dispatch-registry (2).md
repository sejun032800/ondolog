# 메인 세션 지시 — `UNRESOLVED` 레지스트리 동기화 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/10-main-session-dispatch-registry.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-03
>
> 짝: `10-engine-dev-unresolved-registry-sync.md`
> **실행 순서: `09-` DNA 위임보다 먼저.**

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**작은 작업이지만 검증이 까다롭습니다.** 레지스트리에 항목을 추가하는 것은
데이터 등재이고, 그 과정에서 `UNRESOLVED` 함수 자체나 에러 타입 구분이
망가지면 **기존 검증 장치 전체가 무력해집니다.**

`UNRESOLVED(` 호출 건수가 **2건 그대로**여야 한다는 점에 주의하세요.
등재는 소비가 아닙니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/10-engine-dev-unresolved-registry-sync.md` | **이번에 위임할 프롬프트 원문** |

`src/engine/constants/unresolved.ts`를 **내용까지 읽으세요.** 수정 대상입니다.
현재 등재된 키 목록을 기록해 두십시오.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-02-r10'
```

**출력이 없으면 위임하지 마세요.** 문서를 편집하지 말고 보고하고 멈추십시오.

### 2-3. 16-2 레지스트리 표 확인

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'UNRESOLVED` 레지스트리' -Context 0,12
```

**표의 키 목록을 보고에 그대로 옮기세요.** 위임 후 결과를 대조할 근거입니다.

### 2-4. 코드 레지스트리 현황

```powershell
Select-String -Path src/engine/constants/unresolved.ts -Pattern "':" -Context 0,3
```

**현재 등재된 키를 보고에 옮기세요.** 2-3과의 차이가 이번 작업의 범위입니다.

### 2-5. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

기준선: **테스트 324개 / tsc 0 에러 / `UNRESOLVED(` 2건**

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**어느 키가 빠졌는지 알려주지 마세요.** 프롬프트가 전수 대조를 지시합니다.
당신이 답을 주면 에이전트가 그것만 확인하고 넘어갑니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/10-engine-dev-unresolved-registry-sync.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 대조 결과를 몇 가지로 나눠야 하며 각각 어떻게 처리하는지
2. UNRESOLVED( 호출 건수가 이 작업 후 어떻게 되어야 하는지
3. 건드리면 안 되는 것이 무엇인지

확인 후, 문서가 지시한 1부 전수 대조를 먼저 끝내 결과를 기록하고,
그다음 2부를 진행해주세요. 한 번의 작업으로 끝까지 진행하시면 됩니다.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 대조가 전수였는가

에이전트 보고의 세 분류를 **2-3과 2-4의 목록으로 직접 검산하세요.**

- [ ] 16-2 표의 키가 **전부** 언급됐는가
- [ ] 코드에만 있는 키가 있었다면 **삭제되지 않고 보고만** 됐는가
- [ ] 내용 불일치가 있었다면 **수정되지 않고 보고만** 됐는가

### 4-2. 변경 범위

```powershell
git status --porcelain -uall
git diff --stat
```

예상 수정(`M`): `unresolved.ts`, 그 테스트, `PROGRESS.md`, `HANDOFF.md`.

**이 밖에 무엇이든 있으면 보고하세요.** 특히 아래는 위반입니다.

```powershell
git status --porcelain -uall src/engine/temperature.ts src/engine/dnaScore.ts src/engine/leagueStats.ts src/engine/data
```

### 4-3. `UNRESOLVED` 함수 자체가 안 바뀌었는가 — 핵심 검증

```powershell
git diff src/engine/constants/unresolved.ts
```

diff를 **직접 읽으세요.**

- [ ] 레지스트리 **데이터만** 늘었는가
- [ ] `UNRESOLVED` 함수 본문·시그니처·반환 타입이 그대로인가
- [ ] 에러 클래스 2종이 그대로인가
- [ ] 키 유니온 타입이 레지스트리에서 파생되는 구조가 유지됐는가

**함수 쪽에 변경이 있으면 보고하세요.** 이 파일은 다른 모든 검증의
토대라, 여기가 흔들리면 `#1` 이후 쌓아온 장치가 전부 의미를 잃습니다.

### 4-4. `UNRESOLVED(` 호출 건수

```powershell
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

- [ ] **2건 그대로인가** — 늘었으면 에이전트가 소비 호출부를 만든 것입니다.
      등재는 소비가 아닙니다. **보고하세요**

### 4-5. 테스트가 실제로 throw를 검증하는가

테스트 파일을 직접 읽으세요.

- [ ] 추가된 키마다 **throw를 기대하는 테스트**가 있는가
- [ ] `try/catch`로 삼켜 항상 통과하게 만들지 않았는가
- [ ] **등록 키와 미등록 키의 에러 타입 구분 테스트가 여전히 있는가**
- [ ] `@ts-expect-error` 검증이 여전히 있는가

### 4-6. 상태 파일

```powershell
git diff .claude/state/PROGRESS.md .claude/state/HANDOFF.md
```

- [ ] **삭제된 줄이 있는가** — 항목 추가만 허용됩니다

### 4-7. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

- 테스트: **324 대비 감소가 없어야 합니다**
- tsc: **0 에러**

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r10: {O/X}
- 16-2 표의 키 목록: {그대로}
- 코드 레지스트리 현황: {그대로}
- 기준선: 테스트 {N}개 / tsc {N}에러 / UNRESOLVED( {N}건

## 대조 결과
- 양쪽 일치: {키 목록}
- 표에만 있음 (추가함): {키 목록과 phase·doc}
- 코드에만 있음 (보고만): {있으면 목록}
- 내용 불일치 (보고만): {있으면 목록}
- 전수 대조 검산: 16-2 표의 키가 전부 언급됨 {O/X}

## UNRESOLVED 함수 무변경 (핵심)
- unresolved.ts diff 요지: {데이터만 / 함수도 변경 — 보고}
- 함수 시그니처·반환 타입: {그대로 / 변경}
- 에러 클래스 2종: {그대로 / 변경}
- 키 유니온 파생 구조: {유지 / 변경}

## 호출 건수
- UNRESOLVED( : {N}건 (기준선 2)

## 테스트
- 추가 키의 throw 기대 테스트: {O/X}
- 삼켜진 테스트: {없음 / 있음}
- 에러 타입 2종 구분 테스트: {O/X}
- @ts-expect-error 검증: {O/X}
- 테스트: 324 → {현재} / tsc {N}에러

## 변경 범위
- git status --porcelain -uall 전문
- 금지 파일 변경: temperature {O/X} / dnaScore {O/X} / leagueStats {O/X} / data {O/X}

## 상태 파일
- 삭제된 줄: {없음 / 있음 — 내용}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 레지스트리를 수정하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **어느 키가 빠졌는지 에이전트에게 알려주는 것** — 전수 대조가 목적입니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **코드에만 있는 키를 정리하는 것** — 보고 대상입니다
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
