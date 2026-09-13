# 메인 세션 지시 — Phase 7 #12: 검증망 선설치 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/19-main-session-dispatch-guardrails.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-10
>
> 짝: `19-engine-dev-guardrails.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**Phase 7의 첫 작업이고, 파이프라인을 만들지 않습니다.** 브랜드 타입과
정적 규칙만 깝니다.

**검사 대상 디렉터리가 비어 있습니다.** 그래서 스위트를 돌리면 자명하게
통과하고, 그 통과는 증거가 되지 못합니다. **합성 입력 테스트가 그 자리를
메웁니다** — 4단계에서 그것이 실제로 있는지 확인합니다.

**이번에 확정되는 모듈 경로가 `#13`의 계약이 됩니다.** 규칙 C·D가 그
경로를 기준으로 판정하므로, 경로가 어긋나면 `#13`이 규칙에 걸립니다.
보고에서 반드시 받아두십시오.

---

## 0단계 — 파일명 확인

```powershell
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 공백·괄호가 들어간 파일명이 있는가 → `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `19-engine-dev-guardrails.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/19-engine-dev-guardrails.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem __tests__ -Recurse -File | Select-Object FullName
Get-ChildItem src -Directory -Recurse | Select-Object FullName
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`#11` 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-10-r18'
```

**출력이 없으면 위임하지 마세요.** 문서를 편집하지 말고 보고하고 멈추십시오.

### 2-3. Part 17-0이 존재하는가

이번 위임의 참조 원본입니다.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '17-0-1|17-0-2|17-0-3'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'ValidatedContent|CoeffBundle' -Context 0,3
```

- [ ] 17-0-1·17-0-2·17-0-3이 전부 있는가
- [ ] 브랜드 타입 둘이 규격에 적혀 있는가

### 2-4. 수집 대상 디렉터리 현황

```powershell
Test-Path supabase/functions, src/services, src/engine/corners
Get-ChildItem supabase/functions, src/services, src/engine/corners -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName
```

**출력을 기록하세요.** 지금 비어 있거나 없는 것이 정상이며, 4단계에서
"없어도 테스트가 통과하는가"를 확인할 근거입니다.

### 2-5. 기존 스위트 기준선

```powershell
Get-ChildItem __tests__ -Recurse -File -Include *.ts | Select-String -Pattern 'readdirSync|collectEngineFilesRecursive' -List
```

**경로를 기록하세요.** 4단계에서 이들의 수집 범위가 안 바뀌었는지
대조합니다.

### 2-6. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 415개 / tsc 0 에러**
(수가 다르면 실측값을 기준선으로 잡고 기록하십시오.)

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**모듈 경로를 당신이 정해주지 마세요.** 프롬프트가 에이전트에게
확정하도록 맡겼습니다. 당신이 제안하면 그 경로가 문서 근거 없이
굳어집니다.

**2-4·2-5에서 찾은 것을 알려주지 마세요.** 1부 조사가 그것을 직접
확인하는 절차입니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/19-engine-dev-guardrails.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번 작업이 만들지 않는 것이 무엇인지
2. 새 스위트를 만드는 것이 왜 허용되는지
3. 검사 대상이 비어 있는데 규칙 작동을 어떻게 증명하는지
4. 이번에 확정해야 하는 모듈 경로가 무엇이며 왜 중요한지

확인 후, 문서가 지시한 1부 조사 결과를 먼저 보고하고,
그다음 2~4부를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 파이프라인이 만들어지지 않았는가 — 최우선

```powershell
git status --porcelain -uall
git diff --stat
```

예상 신규(`??`): 브랜드 타입 모듈, 새 테스트 스위트.
예상 수정(`M`): `PROGRESS.md`, `HANDOFF.md`.

**LLM 호출 코드·계수 조회 구현·코너 생성 코드가 있으면 범위 이탈입니다.**

```powershell
Get-ChildItem supabase/functions, src/services, src/engine/corners -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName
```

- [ ] 2-4 기록과 같은가 — **여전히 비어 있어야 정상**입니다.
      `#13`이 채웁니다

### 4-2. 브랜드 심볼이 export되지 않았는가 — 핵심 검증

브랜드 타입 모듈을 **직접 읽으세요.**

- [ ] 브랜드 심볼이 **export되지 않는가** — export되면 외부에서 객체를
      직접 만들 수 있어 브랜드가 무의미해집니다
- [ ] 두 타입이 **한 모듈**에 있는가
- [ ] 모듈이 **`src/engine/` 아래**에 있는가 — Deno 디렉터리에 두면
      엔진이 그쪽을 참조해 의존 방향이 뒤집힙니다
- [ ] 타입이 **복제되지 않았는가** — 두 곳에 있으면 브랜드 심볼이
      갈라져 무의미해집니다
- [ ] `CoeffBundle`의 `version`이 **분리 불가능**한 형태인가
- [ ] **생성 함수나 캐스트가 없는가** — 이 단계에서 두 타입은 생성
      수단이 없어야 정상입니다
- [ ] 모듈이 **`#13`의 생성 함수를 받을 자리**로 설계됐는가 —
      심볼이 비공개이므로 생성 함수는 이 모듈 안에만 들어올 수 있습니다

### 4-3. 합성 입력 테스트가 실제로 있는가 — 이번 작업의 증거

**존재 확인이 아니라 내용 확인입니다.** 테스트 파일을 직접 읽으세요.

각 규칙(C·D·E)마다 세 가지가 있어야 합니다.

- [ ] **위반하는 소스**가 걸리는 것을 확인하는가
- [ ] **정상인 소스**가 안 걸리는 것을 확인하는가
- [ ] **주석 안에만 있는 위반 형태**가 안 걸리는 것을 확인하는가

규칙 E는 하나가 더 있어야 합니다.

- [ ] **브랜드 정의 모듈 경로의 캐스트가 안 걸리는가** — 예외가
      반영됐다는 증거입니다. 예외가 없으면 `#13`이 브랜드 값을 만들 수
      없습니다

**세 번째가 특히 중요합니다.** 주석 제거가 실제로 작동한다는 증거이고,
이전에 `grep`이 다섯 번 오탐을 낸 자리입니다.

```powershell
Get-ChildItem __tests__ -Recurse -File -Include *.ts | Select-String -Pattern '합성|synthetic|fixture' -List
```

- [ ] 합성 소스가 **테스트 안의 문자열**인가, 실제 파일인가
- [ ] 검사가 **소스 문자열 읽기**인가, import 방식인가 — import면
      `supabase/functions/`의 Deno 코드를 읽지 못합니다

**실제 파일이면 수집 대상이 되어 스위트가 자기 자신을 검사하게
됩니다.** 발견되면 보고하세요.

### 4-4. 빈 디렉터리에서 깨지지 않는가

```powershell
npx jest --ci --watchAll=false
```

- [ ] 새 스위트가 **통과**하는가 — 디렉터리가 없거나 비어 있어도
      크래시하지 않아야 합니다

### 4-5. 규칙 로직이 순수 함수인가

테스트·구현 코드를 읽고 확인하세요.

- [ ] 각 규칙이 `(경로, 소스) => 위반목록` 형태로 분리됐는가
- [ ] 디렉터리 순회가 그 함수를 호출하는 얇은 층인가

**분리돼 있지 않으면 합성 입력 테스트가 불가능합니다.** 4-3이
통과했다면 대개 분리된 것이지만, 형태를 확인하세요.

### 4-6. 모듈 경로 확정 — `#13`의 계약

- [ ] **LLM 호출이 허용되는 모듈 경로**가 보고됐는가 (규칙 C)
- [ ] **`app_config` 접근이 허용되는 조회 모듈 경로**가 보고됐는가 (규칙 D)
- [ ] **브랜드 생성 함수가 들어갈 모듈**이 명시됐는가
- [ ] 셋 다 `HANDOFF.md`에 기록됐는가

**이 둘을 보고에 그대로 옮기세요.** `#13` 프롬프트가 이 경로를
그대로 써야 하고, 어긋나면 `#13`이 규칙 C·D에 걸립니다.

### 4-7. 기존 스위트 무변경

```powershell
git diff __tests__/engine/determinismStaticRules.test.ts __tests__/engine/importBoundary.test.ts
```

- [ ] **출력이 없어야 정상**입니다. 있으면 보고하세요

```powershell
git status --porcelain -uall src/engine/ scripts/
```

- [ ] `src/engine/` 기존 파일과 스크립트가 변경되지 않았는가

### 4-8. 표준 검증

```powershell
npx tsc --noEmit -p .
# scripts/norm/unresolvedInventory.ts 실행
```

- tsc: **0 에러**
- `UNRESOLVED` 집계: **정의 4 / 소비 2** 유지
- 테스트: 415 대비 감소 없음 (신규로 증가는 정상)

---

## 5단계 — 보고

```
## 0단계
- 파일명 정리: {불필요 / 정리함 — 내용}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r18: {O/X}
- Part 17-0-1/2/3: {각 O/X} / 브랜드 타입 규격: {O/X}
- supabase/functions, src/services, src/engine/corners 현황: {출력 전문}
- 기존 스위트 경로: {목록}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 범위 (최우선)
- git status --porcelain -uall 전문
- supabase/functions · src/services · src/engine/corners 현황: {2-4와 동일 / 파일 생김 — 보고}
- 파이프라인 코드 존재: {없음 / 있음 — 범위 이탈}

## 브랜드 타입
- 모듈 경로: {경로} — src/engine/ 아래 {O/X}
- 타입 복제: {없음 / 있음 — 위반}
- 브랜드 심볼 export 여부: {안 함 / 함 — 위반}
- 두 타입 한 모듈: {O/X}
- CoeffBundle의 version 분리 가능성: {불가 / 가능 — 보고}
- #13 생성 함수를 받을 자리로 설계: {O/X}
- 생성 함수·캐스트: {없음 / 있음 — 위반}

## 합성 입력 테스트 (증거)
- 규칙 C: 위반 {O/X} / 정상 {O/X} / 주석전용 {O/X}
- 규칙 D: 위반 {O/X} / 정상 {O/X} / 주석전용 {O/X}
- 규칙 E: 위반 {O/X} / 정상 {O/X} / 주석전용 {O/X} / **정의 모듈 예외 {O/X}**
- 합성 소스 형태: {문자열 상수 / 실제 파일 — 보고}
- 검사 방식: {소스 문자열 읽기 / import — 보고}

## 규칙 구조
- 순수 함수 분리: {O/X} — 함수명 {목록}
- 수집 방식: {재귀 / 아님}
- 빈 디렉터리에서 통과: {O/X}

## 모듈 경로 확정 (#13의 계약)
- LLM 호출 허용 경로 (규칙 C): {경로}
- app_config 조회 허용 경로 (규칙 D): {경로}
- 브랜드 생성 함수가 들어갈 모듈: {경로}
- HANDOFF 기록: {O/X}

## 기존 무변경
- 기존 스위트 2개 diff: {없음 / 있음 — 보고}
- src/engine/ · scripts/ 변경: {없음 / 있음}

## 표준 검증
- 테스트: 415 → {현재} / tsc {N}에러
- UNRESOLVED 집계: 정의 {N} / 소비 {M}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **모듈 경로를 당신이 정해주는 것** — 에이전트가 확정합니다
- **2-4·2-5에서 찾은 것을 에이전트에게 알려주는 것**
- **규칙 우회 경로가 보고됐을 때 규칙을 넓히는 것** — 보고 사항입니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 스위트·진단 스크립트·집계 스크립트를 고치는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
