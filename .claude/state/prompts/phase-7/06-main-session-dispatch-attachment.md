# 메인 세션 지시 — 애착축 진단 집계 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/06-main-session-dispatch-attachment.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-02
>
> 짝: `06-engine-dev-attachment-diagnostic.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**관측만 하는 작업입니다.** 엔진도 규준집단도 바뀌지 않습니다.
산출물은 진단 스크립트 하나와 그 출력 수치뿐입니다.

그래서 검증의 무게가 **"아무것도 안 바뀌었는가"**에 실립니다.
`src/engine/`에 변경이 하나라도 있으면 그 자체가 위반입니다.

**수치 해석은 하지 마세요.** 예측값과 판정 기준을 당신에게 주지 않은 것은
의도적입니다 — 알면 그 숫자에 맞추려는 유인이 생깁니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/06-engine-dev-attachment-diagnostic.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem scripts -Recurse -File | Select-Object FullName
```

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`#4` 산출물이 커밋된 상태여야 합니다. 출력이 있으면 **멈추고 보고하세요.**

### 2-2. 열거 순수 함수가 제자리에 있는가

```powershell
Get-ChildItem scripts/norm -File | Select-Object Name
Test-Path src/engine/data/norm-synthetic-v2.json
```

없으면 멈추고 보고하세요 — 프롬프트가 재사용을 전제합니다.

### 2-3. 축 판정 로직이 코드에 존재하는가

```powershell
Get-ChildItem src/engine -Recurse -File -Include *.ts | Select-String -Pattern 'anxiety|avoidance|attachment' -List
```

**경로와 함수명을 보고에 포함하세요.** 없으면 에이전트가 축 판정을
새로 짜게 되고, 그러면 진단 수치가 실제 규준집단과 다른 계산에서 나옵니다.

### 2-4. 기준선 기록

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

기준선: **테스트 318개 통과 / tsc 0 에러.**
이 작업은 테스트를 깨뜨릴 이유가 없습니다.

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**예측값·판정 기준을 알려주지 마세요.** 프롬프트에도 없습니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/06-engine-dev-attachment-diagnostic.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 이 작업이 만들지 않는 것이 무엇인지
2. 산출할 집계가 몇 개이며 각각 무엇인지
3. 표본 수(n)를 왜 보고해야 하는지

확인 후, 재사용할 함수의 경로와 시그니처를 먼저 보고하고,
그다음 집계를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 아무것도 안 바뀌었는지 — 이번 작업의 핵심 검증

```powershell
git status --porcelain -uall
git diff --stat
```

**`src/engine/` 아래에 `M`이나 `??`가 하나라도 있으면 위반입니다.**

```powershell
git status --porcelain -uall src/engine/
git diff src/engine/
```

예상 신규(`??`): 진단 스크립트 (`scripts/` 하위)
예상 수정(`M`): `HANDOFF.md` 뿐

규준집단 파일 `v1`·`v2`에 변경이 있으면 **즉시 보고하고 멈추세요.**

### 4-2. 채점 재구현 여부

```powershell
Get-ChildItem scripts -Recurse -File -Include *.ts | Select-String -Pattern 'import' -Context 0,2
```

진단 스크립트가 기존 열거 함수와 채점 함수를 import하는지 확인하세요.
스크립트 안에 축 판정 조건(`'C'`, `'B'` 비교)이나 축 수치(20/50/85)가
**다시 적혀 있으면 재구현**입니다. 보고하세요.

### 4-3. 표본 수 확인 — 판정의 전제입니다

보고된 `n`을 직접 확인하세요.

- [ ] 회피축 3수준의 `n`이 **서로 같은가**
- [ ] 불안축 3수준의 `n`이 **서로 같은가**
- [ ] 교차표 9칸의 `n`이 **서로 같은가**
- [ ] 각 집계의 합계가 **3,888**인가
- [ ] 4유형 `n`의 합계가 3,888인가

**하나라도 어긋나면 굵게 표시해 보고하세요.** 이 수치가 이후 해석의
전제이며, 어긋나면 수치 자체를 다르게 읽어야 합니다.

### 4-4. 재실행 일관성

진단 스크립트를 **한 번 더 돌려** 같은 수치가 나오는지 확인하세요.

```powershell
# 에이전트 보고서에 적힌 실행 명령을 그대로 다시 실행
```

수치가 달라지면 비결정적 요소가 있다는 뜻입니다. 보고하세요.

### 4-5. 표준 검증

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"
```

- 테스트: **318 유지.** 증감이 있으면 보고하세요
- tsc: **0 에러**
- `UNRESOLVED(` 호출: **2건** (정의 1 + `temperature.activityScore` 소비 1)

> 이 grep은 이전 판이 `-rn` 접두사 때문에 주석을 못 걸렀던 것을
> 고친 명령입니다. 6건이 나오면 예전 명령을 쓴 것입니다.

---

## 5단계 — 보고

```
## 사전 점검
- 작업 트리: {clean / 변경 N건}
- 열거 함수·v2 존재: {O/X}
- 축 판정 로직: {경로와 함수명}
- 기준선: 테스트 {N}개 / tsc {N}에러

## 무변경 확인 (최우선)
- src/engine/ 변경: {없음 / 있음 — 즉시 보고}
- 규준집단 v1·v2 변경: {없음 / 있음}
- git status --porcelain -uall 출력 전문

## 채점 재구현 여부
- 진단 스크립트 import 목록: {그대로}
- 스크립트 내 축 판정·수치 재등장: {없음 / 있음 — 내용}

## 진단 스크립트
- 경로: {경로}
- 실행 명령: {그대로}
- 재실행 시 수치 동일: {동일 / 다름}

## 집계 ① 회피축 3수준
| 수준 | 평균 | sd | 최소 | 최대 | n |

## 집계 ② 불안축 3수준
| 수준 | 평균 | sd | 최소 | 최대 | n |

## 집계 ③ 애착 4유형
| 유형 | 평균 | sd | 최소 | 최대 | n |

## 집계 ④ 회피 × 불안 교차표
| | 불안 low | 불안 mid | 불안 high |
| 회피 low | 평균(n) | | |
| 회피 mid | | | |
| 회피 high | | | |

## 표본 수 균등 여부
- 회피축 3수준 n 동일: {O/X — 값}
- 불안축 3수준 n 동일: {O/X — 값}
- 교차표 9칸 n 동일: {O/X — 값}
- 각 합계 3,888: {O/X}

## 표준 검증
- 테스트: 318 → {현재}
- tsc: {N}에러
- UNRESOLVED( 호출: {N}건

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 집계를 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **예측값이나 판정 기준을 에이전트에게 알려주는 것** — 프롬프트에도 없습니다
- 수치를 **당신이 해석하는 것** — 회피축 효과가 크다/작다는 판단을 하지 마세요
- `src/engine/` 아래 무엇이든 고치는 것 — 이 작업은 관측만 합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
