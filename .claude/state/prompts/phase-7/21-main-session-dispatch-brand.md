# 메인 세션 지시 — `#13-r4`: 브랜드 생성자 이전 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/21-main-session-dispatch-brand.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-17
>
> 짝: `21-engine-dev-brand-constructors.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**`#13`의 국소 수정입니다.** 생성자의 위치만 바꿉니다.

**`#13` 산출물을 버리지 않습니다.** 파이프라인·`llmClient`·
`coeffLookup`·정적 규칙이 이미 있고 통과한 것이 전부 유효합니다.
**에이전트가 그것들을 다시 만들면 범위 이탈**입니다.

**커밋되지 않은 `#13` 산출물 위에서 작업합니다.** 시작 상태가 clean이
아닐 수 있고, 그게 정상입니다.

---

## 0단계 — 파일명 확인

```powershell
git ls-files | Select-String -Pattern '\(\d\)| '
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 저장소 전체에 공백·괄호 파일명이 없는가
- [ ] 이번 위임 파일이 `21-engine-dev-brand-constructors.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | `#13` 진행 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md` | **이번에 위임할 프롬프트 원문** |

`src/engine/corners/brandedTypes.ts`를 **내용까지 읽으세요.**
현재 생성자가 무엇이고 어떻게 export되는지 기록해 두십시오 —
4단계에서 대조합니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. `#13` 산출물이 워킹트리에 있는가

```powershell
git status --porcelain -uall
```

**`#13`의 미커밋 변경이 보여야 정상입니다.** 이번 작업은 그 위에서
이뤄집니다.

- [ ] `supabase/functions/_shared/` 아래 파이프라인 파일들이 있는가
- [ ] `src/engine/corners/brandedTypes.ts`에 생성자가 있는가

**없으면 멈추고 보고하세요.** `#13`이 되돌려졌다면 이번 작업의
전제가 사라집니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-17-r25'
```

**출력이 없으면 위임하지 마세요.**

### 2-3. 17-0-2가 생성자 배치를 규정하는가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '17-0-2' -Context 0,3
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '생성자' -Context 2,6
```

- [ ] `brandedTypes.ts`가 **타입 선언만** 갖는다는 규정이 있는가
- [ ] 각 브랜드의 생성자가 **어느 모듈에 사는지** 적혀 있는가

**어긋나면 위임하지 마세요.** 프롬프트가 이 규정을 전제합니다.

### 2-4. 규칙 E 예외 상수의 현재 값

```powershell
Select-String -Path __tests__/engine/cornerPipelineStaticRules.test.ts -Pattern 'MODULE|BRAND' -Context 0,2
```

**출력 전문을 기록하세요.** 이번에 예외가 목록으로 바뀌므로 4단계에서
변경 전후를 대조합니다.

### 2-5. 기준선 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선
```
tsc -p .                                  → 0 에러
tsc -p supabase/functions/tsconfig.json   → 0 에러
jest                                      → 543 tests / 35 suites
```

수가 다르면 실측값을 기준선으로 잡고 기록하십시오.

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**2-3·2-4에서 찾은 것을 알려주지 마세요.** 1부 조사가 그것을 직접
확인하는 절차입니다.

**해소 방향을 설명하지 마세요.** 프롬프트에 들어 있습니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이번 작업에서 다시 만들지 않는 것이 무엇인지
2. brandedTypes.ts에 무엇이 남고 무엇이 나가는지
3. 규칙 E 예외가 어떻게 바뀌는지
4. 우회가 막혔음을 무엇으로 증명하는지

확인 후, 문서가 지시한 1부 조사 결과를 먼저 보고하고,
그다음 2·3부를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. `#13` 산출물이 유지됐는가 — 최우선

```powershell
git status --porcelain -uall
Get-ChildItem supabase/functions/_shared -File | Select-Object Name
```

- [ ] `#13`이 만든 파일들이 **그대로 있는가**
- [ ] 파이프라인·`llmClient`·`coeffLookup`이 **다시 만들어지지
      않았는가**

**에이전트가 처음부터 다시 만들었다면 범위 이탈입니다.**
`git diff`로 변경 폭을 보고 판단하세요 — 생성자 이전은 국소
변경이어야 합니다.

### 4-2. `brandedTypes.ts`에 생성자가 없는가 — 핵심 검증

```powershell
git diff src/engine/corners/brandedTypes.ts
```

diff를 **직접 읽으세요.**

- [ ] **생성 함수가 전부 빠졌는가** — 타입 선언만 남았는가
- [ ] 캐스트가 **없는가**
- [ ] 브랜드 심볼이 여전히 **export되지 않는가**
- [ ] 타입 자체는 **export되는가** — 승인 모듈이 가져다 써야 합니다

### 4-3. `ValidatedContent`도 점검됐는가

**`CoeffBundle`만 고치고 넘어가면 같은 구멍이 남습니다.**

- [ ] 1부 조사에 **`ValidatedContent` 생성자**가 포함됐는가
- [ ] 같은 구멍이 있었는지 **결과가 보고됐는가**
- [ ] 있었다면 같은 방식으로 **옮겨졌는가**

### 4-4. 캐스트가 모듈당 한 곳인가

```powershell
Get-ChildItem src, supabase -Recurse -File -Include *.ts | Select-String -Pattern 'as ValidatedContent|as CoeffBundle'
```

- [ ] 각 승인 모듈에 **한 곳씩만** 있는가
- [ ] `brandedTypes.ts`에 **없는가**
- [ ] 승인 목록 밖의 파일에 **없는가**

### 4-5. 규칙 E 예외 목록

```powershell
git diff __tests__/engine/cornerPipelineStaticRules.test.ts
```

- [ ] 예외 상수가 **목록으로 바뀌었는가**
- [ ] `brandedTypes.ts`가 **빠졌는가**
- [ ] 승인 모듈 둘이 **들어갔는가**
- [ ] 2-4 기록과 대조해 그 밖의 변경이 없는가

### 4-6. 우회가 실제로 막혔는가 — 이번 작업의 증거

**테스트 파일을 직접 읽으세요.** 존재 확인이 아니라 내용 확인입니다.

- [ ] 승인 모듈 밖에서 **리터럴로 브랜드 값을 만들 수 없음**을
      확인하는 테스트가 있는가 (`@ts-expect-error`)
- [ ] 승인 모듈 밖의 캐스트가 **규칙 E에 걸리는** 합성 입력이 있는가
- [ ] 승인 모듈 안의 캐스트가 **안 걸리는** 합성 입력이 있는가

**`@ts-expect-error`가 무효면 `tsc`가 `TS2578`을 냅니다.** 두 게이트가
0 에러면 디렉티브가 실제로 억제 중이라는 뜻입니다.

### 4-7. 깨진 테스트

```powershell
npx jest --ci --watchAll=false
git diff __tests__/
```

- [ ] 깨진 것이 **이번 변경으로 정당하게 깨지는 것**인가
- [ ] **각각 사유가 보고됐는가**
- [ ] 그 밖의 테스트가 수정되지 않았는가

**리터럴을 넘겨 브랜드 값을 만들던 테스트는 깨지는 게 정상입니다.**
그것이 우회가 막혔다는 증거이기도 합니다.

### 4-8. 표준 검증

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
# scripts/norm/unresolvedInventory.ts 실행
git status --porcelain -uall tsconfig.json supabase/functions/tsconfig.json supabase/functions/ambient.d.ts supabase/migrations
```

- **두 게이트 모두 0 에러**
- 규칙 C·D·E 전부 통과
- `UNRESOLVED` 집계: **정의 4 / 소비 2** 유지
- 마지막 명령: **출력 없음**

---

## 5단계 — 보고

```
## 0단계
- 저장소 공백·괄호 파일명: {없음 / 목록}

## 사전 점검
- #13 산출물 워킹트리 존재: {O/X}
- DOC_REVISION r25: {O/X}
- 17-0-2 생성자 배치 규정: {O/X}
- 규칙 E 예외 상수 (변경 전): {출력 전문}
- 기준선: tsc -p . {N}에러 / tsc -p supabase {N}에러 / jest {N} tests {N} suites
- brandedTypes.ts 변경 전 생성자: {목록과 export 여부}

## #13 산출물 유지 (최우선)
- 파이프라인·llmClient·coeffLookup: {그대로 / 다시 만들어짐 — 위반}
- git diff --stat: {출력}
- 변경 폭: {국소 / 광범위 — 보고}

## brandedTypes.ts
- 생성자 제거: {O/X}
- 캐스트 존재: {없음 / 있음 — 위반}
- 브랜드 심볼 export: {안 함 / 함 — 위반}
- 타입 export: {O/X}

## ValidatedContent 점검
- 1부 조사에 포함: {O/X}
- 같은 구멍 존재 여부: {있었음 / 없었음}
- 옮겨짐: {O/X / 해당없음}

## 캐스트 위치
- 전체 매치: {목록}
- 모듈당 한 곳: {O/X}
- brandedTypes.ts에 없음: {O/X}

## 규칙 E 예외 목록
- 변경 전: {2-4 기록}
- 변경 후: {현재}
- brandedTypes.ts 제외: {O/X} / 승인 모듈 둘 포함: {O/X}

## 우회 차단 증거
- @ts-expect-error 리터럴 차단 테스트: {O/X}
- 승인 밖 캐스트 차단 합성 입력: {O/X}
- 승인 안 캐스트 통과 합성 입력: {O/X}

## 깨진 테스트
- 목록과 각 사유: {그대로}
- 그 밖의 테스트 수정: {없음 / 있음 — 보고}

## 표준 검증
- tsc -p . : {N}에러 / tsc -p supabase/functions: {N}에러
- 규칙 C·D·E: {통과 / 실패}
- jest: 543 → {현재} / {N} suites
- UNRESOLVED 집계: 정의 {N} / 소비 {M}
- 금지 파일 변경: {없음 / 있음}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **2-3·2-4에서 찾은 것을 알려주는 것**
- **해소 방향을 설명하는 것** — 프롬프트에 있습니다
- **`#13` 산출물을 되돌리거나 지우는 것** — 이번 작업의 전제입니다
- **`stripComments` 복제본을 통합하는 것** — `#15`입니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- `tsconfig.json`(루트·전용)·`ambient.d.ts`를 고치는 것
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
