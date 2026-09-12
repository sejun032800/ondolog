# 메인 세션 지시 — `node_modules` 백업 + 정적 규칙 이관 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/17-main-session-dispatch-static.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-10
>
> 짝: `17-engine-dev-static-rules.md`

---

**이 지시서는 두 작업을 순서대로 담습니다.**

- **0단계**: `node_modules` 백업 — 메인 세션이 직접 수행. 위임 아님
- **1단계 이후**: 정적 규칙 이관 — `engine-dev`에 위임

---

## 0단계 — `node_modules` 백업 (직접 수행)

### 왜 지금 하는가

현재 `node_modules`는 **`package-lock.json`으로 재현할 수 없습니다.**
`npm install --legacy-peer-deps`로 설치된 뒤 lock만 되돌려졌고, 그
이후 `npm ci`는 lock 내부 불일치로 거부됩니다.

**지워지면 복구 경로가 없습니다.** 진짜 해소는 폰 복귀 후 lock
재생성이며, 이 백업은 그때까지의 다리입니다.

### 절차

```powershell
git status --porcelain
Select-String -Path .gitignore -Pattern 'node_modules'
```

- 첫 명령: 출력이 있으면 **멈추고 보고**
- 둘째 명령: **출력이 있어야** 합니다. 없으면 멈추고 보고하십시오

```powershell
Compress-Archive -Path node_modules -DestinationPath ..\ondolog-node_modules-20260910.zip
(Get-Item ..\ondolog-node_modules-20260910.zip).Length
git status --porcelain
```

- 압축 파일은 **저장소 밖(`..\`)**에 둡니다. 커밋 대상이 아닙니다
- 마지막 명령의 출력이 백업 전과 같아야 합니다

### `HANDOFF.md`에 기록

**기존 기록을 지우지 말고 항목만 추가하십시오.**

```
node_modules 백업: ..\ondolog-node_modules-20260910.zip ({크기} bytes, 2026-09-10)
현재 node_modules는 lock으로 재현 불가 — npm install --legacy-peer-deps로
설치 후 lock만 되돌려진 상태. npm ci는 lock 내부 불일치로 거부됨.
이 백업은 폰 복귀 후 lock 재생성 시 폐기한다. 해결이 아니라 다리다.
```

### 게이트

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

**`348 tests / 26 suites` · `tsc 0 에러`.** 백업 과정이 아무것도
바꾸지 않았음을 확인합니다. 다르면 멈추고 보고하십시오.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/17-engine-dev-static-rules.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem __tests__ -Recurse -File | Select-Object FullName
Get-ChildItem scripts -Recurse -File | Select-Object FullName
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

0단계의 `HANDOFF.md` 변경이 커밋됐거나, 그 한 건만 남아 있어야 합니다.
그 밖의 변경이 있으면 **멈추고 보고**하십시오.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-04-r13'
```

리비전이 그 사이 올랐으면 PM에게 확인하고 이 지시서의 값을 갱신한 뒤
진행하십시오.

### 2-3. 정적 스위트가 존재하는가

이번 위임의 전제입니다. 없으면 "기존 스위트에 얹는다"가 성립하지 않습니다.

```powershell
Get-ChildItem __tests__ -Recurse -File -Include *.ts | Select-String -Pattern 'readdirSync|readFileSync|src/engine' -List
```

**검사 대상 파일을 순회하는 스위트의 경로를 보고에 포함하세요.**
하나도 없으면 멈추고 보고하십시오.

### 2-4. 주석 제거 유틸이 있는가

```powershell
Get-ChildItem __tests__, src -Recurse -File -Include *.ts | Select-String -Pattern 'stripComments|removeComments|주석' -List
```

**찾은 것을 보고에 기록하세요.** 없으면 없다고 기록하십시오 —
에이전트가 새로 만들지, 선례를 따를지의 근거가 됩니다.

### 2-5. 현재 `UNRESOLVED` 호출 수 기록

집계 스크립트가 낸 수와 대조할 기준이 필요합니다.

```powershell
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

**출력 전문을 기록하세요.** 이 명령은 주석을 완전히 거르지 못하므로
실제 수와 다를 수 있습니다. 그 차이가 이번 작업의 이유입니다.

### 2-6. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 348개 / tsc 0 에러**

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**2-3·2-4에서 찾은 것을 에이전트에게 알려주지 마세요.** 프롬프트가
1부에서 직접 조사하도록 지시했습니다. 알려주면 조사를 건너뛰고,
**구조를 잘못 읽었을 때 그게 드러나지 않습니다.**

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/17-engine-dev-static-rules.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 규칙을 어디에 추가해야 하며, 왜 그곳이어야 하는지
2. 테스트로 만들 것과 스크립트로 만들 것이 각각 무엇이며 왜 나뉘는지
3. 정적 테스트로 만들면 안 되는 것이 무엇인지
4. 규칙 위반을 발견했을 때 무엇을 하면 안 되는지

확인 후, 문서가 지시한 1부 조사 결과를 먼저 보고하고,
그다음 2부·3부를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 새 테스트 파일이 생기지 않았는가 — 핵심 검증

```powershell
git status --porcelain -uall __tests__/
```

**`??`로 새 테스트 파일이 나타나면 위반입니다.** 기존 스위트에 규칙을
추가해야 합니다. `M`만 있어야 정상입니다.

```powershell
git diff __tests__/
```

diff를 **직접 읽으세요.**

- [ ] 규칙 A·B가 **기존 스위트 안에** 추가됐는가
- [ ] 기존 assertion이 수정되지 않았는가
- [ ] 규칙 A·B의 검사 대상 파일 수집이 **`src/engine/` 하위 재귀**인가

**루트만 훑으면 하위 디렉터리가 검증망 밖에 남습니다.** 앞으로 코너
생성 코드가 하위에 만들어지면 규칙 B가 가장 필요한 자리가 검사되지
않습니다.

- [ ] **기존 규칙들의 수집 범위는 변경되지 않았는가** — 신규 규칙에만
      재귀를 적용해야 합니다

### 4-2. 주석 제거가 실제로 되는가

테스트 코드를 직접 읽으세요.

- [ ] **주석**을 제거한 뒤 검사하는가 (문자열 리터럴은 범위 밖입니다)
- [ ] 2-4에서 찾은 유틸이 있었다면 **재사용**했는가
- [ ] 복제된 유틸을 공용 모듈로 **추출·통합하지 않았는가** — 통합은
      별도 작업이며 기존 테스트 여러 개를 건드리게 됩니다
- [ ] 새로 만들었다면 그 이유가 보고됐는가

**검증 방법**: 현재 `src/engine/` 안에 "이런 것을 쓰지 않는다"는
취지로 `Math.random` 등을 언급하는 주석이 있습니다. 규칙 A가
통과한다면 주석 제거가 작동하는 것입니다.

### 4-3. `src/` 무변경

```powershell
git status --porcelain -uall src/
git diff src/
```

**변경이 하나라도 있으면 즉시 보고하고 멈추세요.** 규칙 위반을
발견해도 고치지 않는 것이 지시입니다.

### 4-4. 집계 스크립트

```powershell
git status --porcelain -uall scripts/
git diff scripts/
```

- [ ] 기존 진단 스크립트 5개가 **수정되지 않았는가**
- [ ] 새 스크립트가 파일 목록을 박지 않고 **`src/engine/` 하위를 재귀로
      순회**하는가 — 레지스트리 정의 파일이 하위 디렉터리에 있습니다
- [ ] `UNRESOLVED` 소비 지점 수를 **assert하는 코드가 없는가**

스크립트를 직접 실행해 2-5 기록과 대조하십시오.

```powershell
# 에이전트 보고서에 적힌 실행 명령
```

- [ ] 정의와 소비가 분리돼 출력되는가
- [ ] 2-5의 grep 결과와 수가 다르면, **그 차이가 주석 때문인지**
      확인하고 보고하세요

### 4-5. 범위 경계

```powershell
git diff __tests__/ | Select-String -Pattern '16-2|레지스트리|registry|20|50|85|100 -|75 -'
```

- [ ] 레지스트리 ↔ 16-2 대조 테스트가 **추가되지 않았는가**
- [ ] 축 수치·항 식 검증이 **상시 테스트로 들어가지 않았는가**

둘 다 범위 밖입니다. **발견되면 보고하세요.**

### 4-6. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
git status --porcelain -uall
```

- 테스트: **348 대비 감소가 없어야 합니다.** 신규 규칙으로 증가하는
  것은 정상입니다
- tsc: **0 에러**

---

## 5단계 — 보고

```
## 0단계 백업
- .gitignore에 node_modules: {O/X}
- 백업 파일: {경로} / {크기} bytes
- 백업 후 git status: {clean / 변경}
- 게이트: 테스트 {N} / tsc {N}에러
- HANDOFF 기록: {완료 / 미완}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r13: {O/X}
- 정적 스위트 경로: {목록}
- 주석 제거 유틸: {경로 / 없음}
- 현재 UNRESOLVED( grep 결과: {출력 전문}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 새 테스트 파일 여부 (핵심)
- __tests__/ 신규 파일: {없음 / 있음 — 위반}
- 규칙 A·B 추가 위치: {스위트 경로}
- 기존 assertion 수정: {없음 / 있음}
- 규칙 A·B 파일 수집: {재귀 / 루트만 / 목록 박힘}
- 새로 검사 대상이 된 파일: {목록} — 규칙 A·B 통과 {각 O/X}
- 기존 규칙 수집 범위 변경: {없음 / 있음 — 위반}

## 주석 제거
- 방식: {그대로}
- 기존 유틸 재사용: {O/X — 경로} / 통합 시도: {없음 / 있음 — 위반}
- 규칙 A 통과 여부: {통과 / 실패 — 내용}

## src/ 무변경
- 변경: {없음 / 있음 — 즉시 보고}

## 집계 스크립트
- 경로: {경로} / 실행 명령: {그대로}
- 기존 진단 스크립트 5개: {무변경 / 수정됨}
- 파일 수집 방식: {재귀 / 루트만 / 목록 박힘}
- assert 코드 존재: {없음 / 있음 — 위반}
- 출력: 정의 {N}건 {위치} / 소비 {M}건 {위치와 키}
- 2-5 grep 결과와의 차이: {없음 / 있음 — 원인}

## 범위 경계
- 레지스트리 대조 테스트: {없음 / 있음 — 위반}
- 축 수치·항 식 상시화: {없음 / 있음 — 위반}

## 표준 검증
- 테스트: 348 → {현재} / tsc {N}에러
- git status --porcelain -uall 전문

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 규칙을 구현하는 것** — 1단계 이후는 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **2-3·2-4에서 찾은 구조를 에이전트에게 알려주는 것** — 1부 조사가
  그것을 직접 확인하는 절차입니다
- **규칙 위반이 보고됐을 때 코드를 고치는 것** — 발견이 산출물입니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **기존 진단 스크립트를 고치는 것**
- **백업 파일을 저장소 안에 두거나 커밋하는 것**
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
