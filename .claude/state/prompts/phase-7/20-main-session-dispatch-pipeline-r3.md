# 메인 세션 지시 — Phase 7 #13: 파이프라인 골격 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/20-main-session-dispatch-pipeline-r3.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-10
>
> **r3 — 위임 전 개정.** 착수 조건 ①(Edge Function `tsc` 범위)이
> 해소돼 조건에서 내려갔다. 게이트가 두 줄이 됐고, 착수 조건 ③(문서
> 값 실재 확인)이 새로 섰다. 리비전 r24.
>
> 짝: `20-engine-dev-pipeline-r3.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**Phase 7에서 처음으로 실제 코드를 만듭니다.** 지금까지는 검증망과
타입 정의였습니다.

**착수 조건 둘이 앞에 있습니다.** 둘 다 실패하면 구현이 성립하지
않으므로, 에이전트가 거기서 멈추는 것이 정상입니다.

**그리고 `#12`의 규칙이 처음으로 실제 코드에 적용됩니다.** 지금까지는
합성 입력으로만 검증됐습니다. **규칙 C·D·E가 `#13` 완료 후에도
통과하는지가 규칙 작동의 두 번째 증거**입니다.

---

## 0단계 — 파일명 확인

```powershell
git ls-files | Select-String -Pattern '\(\d\)| '
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] **저장소 전체에** 공백·괄호가 들어간 파일명이 있는가 →
      `git mv`로 정리하고 커밋
- [ ] 이번 위임 파일이 `20-engine-dev-pipeline-r3.md`로 있는가
- [ ] `docs/ONDOLOG_CORNER_CONTENT.md`가 **정상 이름으로** 있는가

> OneDrive 경유로 파일을 저장소에 넣을 때마다 `(2)` 접미사가 붙는
> 일이 반복됐습니다. MASTER 공백, phase-7 프롬프트 두 번, 그리고
> `CORNER_CONTENT`까지 네 번째입니다.

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태와 `#12` 계약 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md` | **이번에 위임할 프롬프트 원문** |

```powershell
Get-ChildItem supabase -Recurse -File | Select-Object FullName
Get-ChildItem src/engine/corners -Recurse -File | Select-Object FullName
```

`src/engine/corners/brandedTypes.ts`와
`__tests__/engine/cornerPipelineStaticRules.test.ts`를 **내용까지
읽으세요.** 둘 다 이번에 수정됩니다.

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 작업 트리가 깨끗한가

```powershell
git status --porcelain
```

`#12` 커밋이 끝난 상태여야 합니다.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-09-13-r24'
```

**출력이 없으면 위임하지 마세요.**

### 2-3. `#12` 계약 세 경로가 기록돼 있는가

```powershell
Select-String -Path .claude/state/HANDOFF.md -Pattern 'llmClient|coeffLookup|brandedTypes' -Context 1,2
```

**세 경로가 전부 나와야 합니다.** 위임 프롬프트가 이 경로를 박아
쓰므로, 기록과 다르면 프롬프트를 고쳐야 합니다.

**`HANDOFF.md`보다 코드가 원본입니다.** 정적 규칙이 실제로 판정에 쓰는
값을 함께 확인하십시오.

```powershell
Select-String -Path __tests__/engine/cornerPipelineStaticRules.test.ts -Pattern 'MODULE' -Context 0,2
```

- [ ] 위임 프롬프트의 경로가 **이 상수들과 정확히 일치하는가**

**어긋나면 위임하지 마세요.** 에이전트가 만든 모듈이 지정 모듈로
인정되지 않아 규칙에 걸립니다.

**출력 전문을 보고에 기록하세요.**

### 2-4. `FORBIDDEN_KEYS`가 문서에 있는가

에이전트가 이 목록을 지어내면 안 됩니다.

```powershell
Select-String -Path docs -Recurse -Pattern 'FORBIDDEN_KEYS' -ErrorAction SilentlyContinue
```

**경로와 맥락을 기록하세요.** 없으면 그 사실을 보고하십시오 —
에이전트가 착수 전 보고에서 같은 것을 확인합니다.

### 2-5. 두 게이트가 통과 상태인가

**Edge Function 타입 검사는 이미 해소됐습니다.** 전용 tsconfig·루트
`exclude`·`ambient.d.ts`가 커밋돼 있습니다.

```powershell
Test-Path supabase/functions/tsconfig.json, supabase/functions/ambient.d.ts
Select-String -Path tsconfig.json -Pattern 'supabase/functions' -Context 1,2
```

- [ ] 두 파일이 있는가
- [ ] 루트 `tsconfig.json`의 `exclude`에 `supabase/functions`가 있는가

**하나라도 없으면 위임하지 마세요.** 그 상태로 파이프라인을 만들면
타입 층이 작동하지 않습니다.

### 2-6. 참조 문서의 값이 채워져 있는가

위임 프롬프트가 "문서에서 찾으라"고 지시한 값들입니다. **자리표시자면
에이전트가 착수 조건 ①에서 멈춥니다** — 그 전에 확인해 두십시오.

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'FORBIDDEN_KEYS' -Context 2,12
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern 'FORBIDDEN_KEYS' -Context 0,4
```

- [ ] MASTER 17-0-4에 **실제 목록**이 있는가
- [ ] `CORNER_CONTENT.md`가 **포인터**로 바뀌어 있는가 (목록 복제 아님)

**내용을 에이전트에게 알려주지 마세요.** 존재 여부만 확인합니다.

### 2-7. 기준선 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선
```
tsc -p .                                  → 0 에러
tsc -p supabase/functions/tsconfig.json   → 0 에러
jest                                      → 449 tests / 28 suites
```

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**2-4·2-6에서 찾은 것을 알려주지 마세요.** 1부와 착수 전 보고가 그것을
직접 확인하는 절차입니다.

**`FORBIDDEN_KEYS`의 내용을 알려주지 마세요.** 에이전트가 문서에서
찾아야 합니다.

### 위임 메시지

```
engine-dev 에이전트로 작업을 진행해주세요.

.claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 착수 조건 둘이 무엇이며, 실패하면 무엇을 해야 하는지
2. 이번에 만들지 않는 것이 무엇인지
3. 실패 사유가 몇 값이며 왜 합치면 안 되는지
4. 브랜드 값을 만들 수 있는 자리가 어디인지

확인 후, 문서가 지시한 1부 착수 조건 두 가지를 먼저 확인해 보고하고,
통과하면 2~5부를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

### 4-1. 착수 조건 처리

- [ ] 둘 다 확인·보고됐는가
- [ ] **①에서 확인한 값 목록이 보고됐는가** — `FORBIDDEN_KEYS` 하나만이
      아니어야 합니다
- [ ] **①이 실패했는데 구현을 진행하지 않았는가**
- [ ] **Edge Function 타입 검사 확인용 최소 파일을 만들지 않았는가** —
      해소된 사안이라 이제 범위 이탈입니다

`tsconfig.json`이 범위 밖인데 구현했다면, **타입 층이 작동하지 않는
상태로 파이프라인이 만들어진 것**입니다. 보고하고 멈추세요.

②(필드 매핑)는 어긋나도 구현 금지 사유가 아닙니다. **어긋난 내용이
보고됐는지만** 확인하세요.

```powershell
git status --porcelain -uall tsconfig.json supabase/functions/tsconfig.json supabase/functions/ambient.d.ts supabase/migrations
```

- [ ] **출력이 없어야 정상**입니다. 전부 이번 범위 밖입니다

### 4-2. 정적 규칙이 실제 코드에서 통과하는가 — 핵심 검증

```powershell
npx jest --ci --watchAll=false
```

- [ ] 규칙 C·D·E가 **전부 통과하는가**

**이것이 규칙 작동의 두 번째 증거입니다.** `#12`에서는 합성 입력으로만
확인됐고, 이제 실제 파이프라인 코드에 적용됩니다.

### 4-3. 규칙 C 교정과 오탐 없음 — 실증

```powershell
git diff __tests__/engine/cornerPipelineStaticRules.test.ts
```

- [ ] 규칙 C가 **LLM SDK import**와 **엔드포인트 호스트 문자열**을
      검사하는 형태로 바뀌었는가
- [ ] `fetch` 전반을 잡지 않는가
- [ ] **`src/services/referencePhotoApi.ts`가 걸리지 않는 것**을
      확인하는 테스트가 있는가
- [ ] **`llmClient.ts` 자신이 걸리지 않는 것**을 확인하는 테스트가 있는가

**세 번째가 실증입니다.** 정당한 `fetch`가 오탐되지 않는다는 것을
합성 입력이 아니라 실제 파일로 확인합니다.

### 4-4. 경로가 계약과 일치하는가

```powershell
Test-Path supabase/functions/_shared/llmClient.ts, supabase/functions/_shared/coeffLookup.ts
Get-ChildItem supabase/functions -Recurse -File | Select-Object FullName
```

- [ ] 두 모듈이 **2-3 기록과 정확히 같은 경로**에 있는가
- [ ] 계약 밖 경로에 LLM 호출·`app_config` 접근 코드가 없는가

**경로가 다르면 정적 규칙이 그 파일을 지정 모듈로 인정하지 않습니다.**
규칙이 통과했다면 대개 맞지만, 경로를 직접 확인하세요.

### 4-5. 브랜드 캐스트가 한 곳뿐인가

```powershell
git diff src/engine/corners/brandedTypes.ts
Get-ChildItem src, supabase -Recurse -File -Include *.ts | Select-String -Pattern 'as ValidatedContent|as CoeffBundle'
```

- [ ] 캐스트가 **`brandedTypes.ts` 안에만** 있는가
- [ ] 생성 함수가 그 모듈 안에 있는가

### 4-6. 저장 함수가 검증된 값만 받는가

구현을 직접 읽으세요.

- [ ] 저장 함수의 인자 타입이 **`ValidatedContent<T>`**인가
- [ ] `ValidatedContent`가 **Zod 파싱과 `FORBIDDEN_KEYS` 둘 다 통과한
      경우에만** 반환되는가
- [ ] `CoeffBundle`이 `coeffLookup.ts`를 거치지 않고 만들어질 수 없는가

### 4-7. 실패 사유 4값

```powershell
Get-ChildItem supabase, src -Recurse -File -Include *.ts | Select-String -Pattern 'insufficient_input|generation_failed|schema_invalid|forbidden_content'
```

- [ ] **네 값이 그대로** 있는가 — 이름 변경·병합이 없는가
- [ ] **TypeScript 유니온으로 강제**되는가 — `skip_reason`이 DB에서
      자유 텍스트라 타입이 막아야 합니다
- [ ] `forbidden_content`가 `schema_invalid`와 **분리**돼 있는가

**분리가 핵심입니다.** `FORBIDDEN_KEYS` 위반율은 원칙 ①이 지켜지는지를
재는 유일한 지표이고, 형식 오류와 섞으면 측정할 수 없습니다.

### 4-8. 재시도 상한

테스트를 직접 읽으세요.

- [ ] `insufficient_input`·`forbidden_content`가 **재시도하지 않는가**
- [ ] `generation_failed` 최대 2회, `schema_invalid` 1회인가
- [ ] **호출 예산이 `llmClient`에 있는가** — 파이프라인이 상한을 넘겨
      요청해도 거부되는 것이 테스트로 확인되는가
- [ ] **예산이 인자로 흘러가지 않는가** — 코너 1건마다 예산을 가진
      클라이언트를 받는 형태인가

**상한 테스트가 없으면 보고하세요.** 비용 상한이 이 수치 위에 섭니다.

**예산이 인자면 호출부가 새 예산 객체를 만들어 우회할 수 있습니다.**
`llmClient`의 시그니처를 직접 읽어 확인하세요.

그리고 층 분리를 확인하세요.

- [ ] `llmClient`가 Zod·`FORBIDDEN_KEYS`를 **모르는가**
- [ ] 파이프라인이 HTTP 상태를 **모르는가**

### 4-9. 코너별 부분이 없는가

```powershell
Get-ChildItem supabase, src/engine/corners -Recurse -File | Select-Object FullName
```

- [ ] 코너별 **프롬프트 문안·Zod 스키마·선행 검사 조건**이 없는가
- [ ] 골격이 그 셋을 **인자로 받는 형태**인가

**있으면 `#14`의 범위를 침범한 것입니다.** 보고하세요.

### 4-10. 표준 검증

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
# scripts/norm/unresolvedInventory.ts 실행
git status --porcelain -uall
```

- **두 게이트 모두 0 에러**
- `UNRESOLVED` 집계: **정의 4 / 소비 2** 유지
- 테스트: 449 / 28 suites 대비 감소 없음

---

## 5단계 — 보고

```
## 0단계
- 저장소 전체 공백·괄호 파일명: {없음 / 정리함 — 목록}
- docs/ONDOLOG_CORNER_CONTENT.md 정상 이름: {O/X}

## 사전 점검
- 작업 트리: {clean / 변경 N건}
- DOC_REVISION r24: {O/X}
- #12 계약 세 경로 (HANDOFF): {출력 전문}
- 정적 규칙의 MODULE 상수: {출력 전문} — 프롬프트와 일치 {O/X}
- FORBIDDEN_KEYS 문서 위치: {경로 / 없음}
- 두 게이트 상태: 전용 tsconfig {O/X} / ambient.d.ts {O/X} / 루트 exclude {O/X}
- FORBIDDEN_KEYS: MASTER 17-0-4 실제 목록 {O/X} / CORNER_CONTENT 포인터 {O/X}
- corners 컬럼 구성: {출력}
- 기준선: tsc -p . {N}에러 / tsc -p supabase {N}에러 / jest {N} tests {N} suites

## 착수 조건 (최우선)
- ① 문서 값 실재 확인: {확인한 값 목록과 각각 O/X}
- 최소 확인 파일 생성: {없음 / 있음 — 범위 이탈}
- ② 필드 매핑 17-0-5-B 일치: {일치 / 어긋남 — 내용}
- ①이 실패했는데 구현 진행: {아니오 / 예 — 보고}
- tsconfig(루트·전용) · ambient.d.ts · migrations 변경: {없음 / 있음 — 위반}

## 정적 규칙 (핵심)
- 규칙 C·D·E 통과: {O/X}
- 규칙 C 판정 기준: {SDK import + 엔드포인트 문자열 / 그 외}
- referencePhotoApi.ts 오탐 없음 테스트: {O/X}
- llmClient.ts 자기 예외 테스트: {O/X}

## 경로 계약
- llmClient.ts 실제 경로: {경로} — 계약 일치 {O/X}
- coeffLookup.ts 실제 경로: {경로} — 계약 일치 {O/X}
- 계약 밖 LLM 호출·app_config 접근: {없음 / 있음}

## 브랜드
- 캐스트 위치: {목록} — brandedTypes.ts 한 곳뿐 {O/X}
- 생성 함수 위치: {경로}
- 저장 함수 인자 타입: {그대로}
- CoeffBundle 우회 생성 가능성: {불가 / 가능 — 보고}

## 실패 사유·재시도
- 4값 존재: {각 O/X} / 이름 변경·병합: {없음 / 있음}
- forbidden_content 분리: {O/X}
- 4값 TypeScript 유니온 강제: {O/X}
- 재시도 정책 일치: {O/X}
- 호출 예산 위치: {llmClient / 그 외}
- 예산이 인자로 흘러가는가: {아니오 / 예 — 위반}
- 상한 초과 요청 거부 테스트: {O/X}
- 층 분리: llmClient가 Zod 모름 {O/X} / 파이프라인이 HTTP 모름 {O/X}

## 범위
- 코너별 프롬프트·스키마·선행조건: {없음 / 있음 — 위반}
- 골격이 셋을 인자로 받는 형태: {O/X}
- #14가 주입할 인터페이스: {그대로}

## 표준 검증
- 테스트: 449 → {현재} / {N} suites
- tsc -p . : {N}에러 / tsc -p supabase/functions: {N}에러
- UNRESOLVED 집계: 정의 {N} / 소비 {M}
- git status --porcelain -uall 전문

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **`FORBIDDEN_KEYS`의 내용을 에이전트에게 알려주는 것**
- **2-4·2-6에서 찾은 것을 알려주는 것**
- **착수 조건이 실패했는데 진행시키는 것**
- **`tsconfig.json`(루트·전용)·`ambient.d.ts`를 고치는 것**
- **2-6에서 찾은 `FORBIDDEN_KEYS` 내용을 알려주는 것** — 존재만
  확인합니다
- **마이그레이션을 작성하는 것** — 이번 범위가 아니며 필요하지도 않습니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- 커밋·푸시 (사람이 실행합니다)
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
