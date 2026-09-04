# 메인 세션 지시 — Phase 7 선행 준비 #8 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/09-main-session-dispatch-dna.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-03
>
> 짝: `09-engine-dev-dna-base-score.md`
> **선행: `10-` 레지스트리 동기화가 먼저 끝나야 합니다.**

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 특이점 넷

**① 완료된 파일을 건드립니다.** 궁합 판정 로직이 `src/engine/temperature.ts`
안에 있고, 이번에 공용 모듈로 분리합니다. **순수 이동이라 온도 산출이 한
비트도 변하면 안 됩니다.**

**② `UNRESOLVED` 건수가 2 → 3으로 늘어납니다.** `dnaScore.chatDelta`가 처음
소비되기 때문입니다. 늘었다고 실패 판정하지 마세요.

**③ 양(量) 기반 구현이 들어갔는지 봐야 합니다.** `chat_delta`는 채팅의
질을 재는 값인데, 발화 건수에 반응하는 코드가 들어가면 연애 온도와 같은
지표가 됩니다.

**④ DB 관련 식별자가 등장하면 범위 이탈입니다.** 계수 출처와 버전 기록
위치는 정해졌지만, 배선은 이번 범위가 아닙니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` · `DECISIONS.md` | 현재 상태와 결정 이력 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/09-engine-dev-dna-base-score.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem src/engine -Recurse -File | Select-Object FullName
```

`src/engine/dnaScore.ts`와 `src/engine/temperature.ts`를 **내용까지
읽으세요.** 둘 다 수정 대상이라 변경 전 상태를 알아야 합니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`10-` 레지스트리 동기화 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-02-r11'
```

**출력이 없으면 위임하지 마세요.** 문서를 편집하지 말고, 최신본 교체가
필요하다고 보고하고 멈추십시오.

### 2-3. 참조할 절이 존재하는가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '17-2|10-6-5|10-7-2|16-2'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'base_score 산출 규격' -Context 0,8
```

- [ ] 17-2에 `base_score` 산출 규격 절이 있는가
- [ ] 세 값과 델타 범위, 클램프 규칙이 적혀 있는가

### 2-4. 궁합 판정 로직의 현재 위치

```powershell
Get-ChildItem src -Recurse -File -Include *.ts | Select-String -Pattern 'resolveTypeAffinity|TYPE_AFFINITY|TypeAffinity'
```

**경로·심볼명·export 여부를 전부 보고에 포함하세요.** 이번 작업이 이것을
공용 모듈로 옮깁니다. 위임 프롬프트가 예상한 구조와 다르면 에이전트가
착수 전에 멈출 수 있는데, 그 판단의 근거가 이 목록입니다.

### 2-5. `dnaScore.chatDelta`가 등재됐는가

```powershell
Select-String -Path src/engine/constants/unresolved.ts -Pattern 'chatDelta' -Context 1,3
```

**없으면 멈추고 보고하세요.** `10-` 레지스트리 동기화가 이 키를 등재했어야
합니다. 없다면 그 작업이 누락됐거나 실패한 것입니다.

**스스로 추가하지 마세요.** 보고만 하십시오.

### 2-6. 온도 기준선 확보

**분리가 순수했는지 증명하려면 기준선이 필요합니다.**

```powershell
Select-String -Path src/engine/temperature.ts -Pattern 'TEMPERATURE_ENGINE_VERSION' -Context 0,2
Get-ChildItem __tests__ -Recurse -File | Select-String -Pattern 'temperature' -List
```

**기록:** `TEMPERATURE_ENGINE_VERSION` 값 ______ / 온도 관련 테스트 파일 목록

### 2-7. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

기준선: **tsc 0 에러 / `UNRESOLVED(` 2건**

> 테스트 수는 `10-` 작업에서 늘었을 수 있습니다. **그 작업 직후의 수를
> 기준선으로 삼고 기록하십시오.** (`10-` 이전 기준은 324였습니다.)

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**Part 17-2의 수치를 알려주지 마세요.** 프롬프트가 의도적으로 값을
옮겨 적지 않았습니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/09-engine-dev-dna-base-score.md 를 전문 읽고
그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이 없습니다.
그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 궁합 판정 로직을 어떻게 다뤄야 하며, 그 이동이 무엇을 바꾸면 안 되는지
2. 세 부분 중 완전 구현되는 것과 throw로 남는 것이 각각 무엇인지
3. chat_delta에 대해 절대 하면 안 되는 구현이 무엇인지
4. 건드리지 말아야 할 기존 파일이 무엇인지

확인 후, 문서가 지시한 대로 dnaScore.ts의 현재 상태와 궁합 판정 로직의
위치를 먼저 보고하고, 그다음 구현을 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 온도 무변경 확인 — 최우선

```powershell
git diff src/engine/temperature.ts
```

diff를 **직접 읽으세요.**

- [ ] 궁합 판정 코드가 **삭제되고 import로 대체**됐는가 (이동)
- [ ] 그 밖의 로직이 바뀌지 않았는가
- [ ] **`TEMPERATURE_ENGINE_VERSION`이 오르지 않았는가** — 2-6 기록과 동일해야 합니다

```powershell
git diff __tests__/ | Select-String -Pattern 'temperature' -Context 3,3
```

- [ ] 온도 테스트의 **assertion·기댓값이 바뀌었는가** — 바뀌었으면 이동이
      순수하지 않았다는 뜻입니다. **보고하세요.** import 경로 갱신은 정상이고,
      DNA 관련 신규 테스트가 추가되는 것도 정상입니다

### 4-2. 모듈 의존 방향 확인

```powershell
Select-String -Path src/engine/dnaScore.ts -Pattern "import" -Context 0,1
```

- [ ] `dnaScore.ts`가 **`temperature.ts`를 import하지 않는가**
- [ ] 공용 모듈에서 가져오는가

두 모듈이 서로를 참조하면 버전이 얽힙니다. **발견되면 보고하세요.**

### 4-3. 양(量) 기반 구현 여부 — 이번 작업 고유 검증

```powershell
git diff src/engine/dnaScore.ts | Select-String -Pattern 'count|length|messageCount|total|sum|건수|개수'
```

`chat_delta` 주변에 **메시지 수·건수·합계를 다루는 코드나 타입**이
있으면 방향을 정한 것입니다. 산출식은 미확정이어야 합니다.

- [ ] 변동분 함수의 시그니처가 **양을 받는 형태가 아닌가**
- [ ] `UNRESOLVED`를 소비하고 끝나는가

**발견되면 보고하세요.** 이것이 연애 온도와 DNA를 가르는 지점입니다.

### 4-4. DB 식별자 등장 여부 — 범위 이탈 검증

```powershell
git diff src/engine/dnaScore.ts | Select-String -Pattern 'chat_factors|chatFactors|breakdown|coeffVersion|app_config|supabase'
```

**매치가 나오면 범위 이탈입니다.** `#8`은 엔진 계산만 하고 DB 코드를
만들지 않습니다.

계수 출처(`app_config`)와 버전 기록 위치(`dna_scores.breakdown.coeffVersion`)는
정해졌지만 **배선은 호출부 작업**이며, 호출부는 아직 존재하지 않습니다.
지금 만들면 서비스 계층 형태를 에이전트가 발명하게 됩니다.

특히 `chat_factors`가 위험합니다 — 여기에 무엇을 넣을지가 정해지면
산출식이 미확정인 채로 **재료 수집 방향이 먼저 정해집니다.**

### 4-5. `UNRESOLVED` 판정

```powershell
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
git diff src/engine/constants/unresolved.ts
```

- [ ] **3건**인가 (정의 1 + 온도 소비 1 + DNA 소비 1)
- [ ] `unresolved.ts`에 **diff가 없는가** — 있으면 위반입니다
- [ ] 소비된 키가 `dnaScore.chatDelta`인가

### 4-6. 계수 하드코딩 여부

```powershell
git diff src/engine/dnaScore.ts | Select-String -Pattern '\b(61|65|69|50|100|25|10)\b'
```

기저 세 값과 클램프 경계가 **리터럴로 박혀 있으면 위반**입니다.
계수는 인자로 들어와야 합니다. 주석 안의 언급은 무방합니다.

### 4-7. 변경 범위 대조

```powershell
git status --porcelain -uall
git diff --stat
git diff package.json app.json eas.json tsconfig.json
git status --porcelain -uall src/engine/leagueStats.ts src/engine/loveTypeInference.ts src/engine/data
```

예상 수정(`M`): `dnaScore.ts`, `temperature.ts`, `PROGRESS.md`, `HANDOFF.md`,
온도 테스트(import 경로).
예상 신규(`??`): 공용 모듈, DNA 테스트.

**마지막 명령에 출력이 있으면 위반입니다.**

### 4-8. 테스트 확인

테스트 파일을 직접 읽으세요.

- [ ] **기저 점수 테스트가 throw 없이 값을 검증하는가** — 여기까지 throw하면
      ①이 구현되지 않은 것입니다
- [ ] 세 범주 / 목록에 없을 때 / 양방향 불일치 각각에 테스트가 있는가
- [ ] 최종 함수의 throw를 기대하는 테스트가 있는가
- [ ] `try/catch`로 삼켜 항상 통과하게 만들지 않았는가

### 4-9. 상태 파일 구조 재편 여부

```powershell
git diff .claude/state/PROGRESS.md .claude/state/HANDOFF.md
```

- [ ] **삭제된 줄이 있는가** — 항목 추가만 허용됩니다

### 4-10. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "Math.random\|Date.now()\|new Date()" src/engine/
```

- 테스트: **2-7 기준선 대비 감소가 없어야 합니다**
- tsc: **0 에러**

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}     
- DOC_REVISION r11: {O/X}
- 참조 절: 17-2 {O/X} / 10-6-5 {O/X} / 10-7-2 {O/X} / 16-2 {O/X}
- 궁합 판정 로직 현재 위치: {경로 · 심볼 · export 여부}
- dnaScore.chatDelta 등재: {O/X}
- TEMPERATURE_ENGINE_VERSION 기준선: {값}
- 온도 테스트 파일: {목록}
- 기준선: 테스트 {N}개 / tsc {N}에러 / UNRESOLVED( {N}건

## dnaScore.ts 변경 전 상태
- {에이전트 보고 + 당신이 1단계에서 읽은 내용}

## 온도 무변경 (최우선)
- temperature.ts diff 요지: {이동만 / 로직 변경 있음}
- TEMPERATURE_ENGINE_VERSION: {기준선} → {현재}
- 온도 테스트 수정: {import 경로만 / 기댓값도 — 보고}

## 모듈 의존
- 공용 모듈 경로: {경로}
- dnaScore.ts import 목록: {그대로}
- temperature.ts import 여부: {없음 / 있음 — 위반}

## 양 기반 구현 여부
- chat_delta 주변 건수·합계 코드: {없음 / 있음 — 내용}
- 변동분 함수 시그니처: {그대로}

## DB 식별자 등장 여부
- chat_factors / breakdown / coeffVersion / app_config / supabase: {없음 / 있음 — 내용}

## UNRESOLVED
- 현재 건수: {N} (기준선 2)
- 소비된 키: {목록}
- unresolved.ts diff: {없음 / 있음 — 위반}

## 계수
- dnaScore.ts 내 리터럴: {없음 / 있음 — 내용}
- 기저 함수 시그니처: {그대로}

## 변경 범위
- git status --porcelain -uall 전문
- 금지 파일 변경: leagueStats {O/X} / loveTypeInference {O/X} / data {O/X}

## 테스트
- 기저 점수: throw 없이 값 검증 {O/X}
- 세 범주 / 목록 밖 / 양방향 불일치: {각 O/X}
- 최종 함수 throw 기대 테스트: {O/X}
- 삼켜진 테스트: {없음 / 있음}
- 테스트: {기준선} → {현재} / tsc {N}에러

## 상태 파일
- 삭제된 줄: {없음 / 있음 — 내용}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **Part 17-2의 수치를 에이전트에게 알려주는 것**
- **`UNRESOLVED`가 2 → 3으로 는 것을 실패로 판정하는 것** — 정상입니다
- **계수 출처(`app_config`)나 버전 기록 위치를 에이전트에게 알려주는 것** —
  이번 범위가 아니며, 알려주면 배선을 시도합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- **`unresolved.ts`에 키를 직접 등록하는 것** — 없으면 보고하고 멈추세요
- 커밋·푸시 (사람이 실행합니다)
- 지시받지 않은 설정 파일 변경
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
