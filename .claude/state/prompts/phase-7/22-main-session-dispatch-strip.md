# 메인 세션 지시 — `#15`: `stripComments` 통합 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/22-main-session-dispatch-strip.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-19
> 개정: 2026-09-27 — 리비전 MASTER r32 · ROADMAP r1. 위임 전 초안이라 덮어씀
>
> 짝: `22-engine-dev-strip-comments.md`

---

아래 순서대로 진행해주세요. **당신이 직접 구현하는 작업이 아닙니다.**

## 이번 작업의 성격

**검증 도구 자체를 고칩니다.** `stripComments`가 URL의 `://`를 줄
주석으로 오인해 **그 뒤 코드를 통째로 지웁니다.** 오탐이 아니라
미탐이라 지금까지 숨은 위반이 있을 수 있습니다.

**4부 재실행에서 새 위반이 나오면 그건 실패가 아니라 발견입니다.**
에이전트가 고치지 않고 보고하도록 지시했습니다.

---

## 0단계 — 파일명 확인

```powershell
git ls-files | Select-String -Pattern '\(\d\)| '
Get-ChildItem .claude/state/prompts/phase-7 -File | Select-Object Name
```

- [ ] 저장소 전체에 공백·괄호 파일명이 없는가
      (`app/(modals)` 같은 Expo Router 라우트 그룹은 정상입니다)
- [ ] 이번 위임 파일이 `22-engine-dev-strip-comments.md`로 있는가

---

## 1단계 — 프로젝트 파악 (범위 한정)

| 파일 | 목적 |
|---|---|
| `CLAUDE.md` | 절대 규칙 8개 |
| `.claude/state/PROGRESS.md` · `HANDOFF.md` | 현재 상태 |
| `.claude/agents/engine-dev.md` | 위임 대상 에이전트의 정의 |
| `.claude/state/prompts/phase-7/22-engine-dev-strip-comments.md` | **이번에 위임할 프롬프트 원문** |

---

## 2단계 — 사전 점검 (하나라도 실패하면 위임하지 말 것)

### 2-1. 산출물이 제자리에 있는가

```powershell
git status --porcelain -uall
Get-ChildItem supabase/functions/_shared -File | Select-Object Name
Test-Path src/engine/corners/brandedTypes.ts
```

**커밋됐든 워킹트리에 있든 무방합니다.** 확인할 것은 **산출물의
존재**이지 커밋 여부가 아닙니다.

- [ ] `_shared/` 아래 파이프라인 파일들이 있는가
- [ ] `brandedTypes.ts`가 있는가

없으면 멈추고 보고하세요.

### 2-2. MASTER가 최신본인가

```powershell
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-09-24-r32'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-09-24-r1'
```

**둘 다 출력이 있어야 합니다.** 하나라도 없으면 문서를 편집하지 말고
보고하십시오. 두 문서는 리비전을 따로 셉니다.

### 2-3. 복제본 현황 기록

```powershell
Get-ChildItem . -Recurse -File -Include *.ts -Exclude node_modules | Select-String -Pattern 'stripComments|replace\(/\\/\\*' -List
```

**출력 전문을 기록하세요.** 4단계에서 "남은 복제본이 없는가"를
대조합니다.

**내용을 에이전트에게 알려주지 마세요.** 1부 전수 조사가 그것을 직접
확인하는 절차입니다.

### 2-4. 기준선 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선
```
tsc -p .                                  → 0 에러
tsc -p supabase/functions/tsconfig.json   → 0 에러
jest                                      → 550 tests / 34 suites
```

수가 다르면 실측값을 기준선으로 잡고 기록하십시오.

---

## 3단계 — 위임

**위임 프롬프트를 요약하거나 다시 쓰지 마세요.**

**2-3에서 찾은 것을 알려주지 마세요.**

### 위임 메시지

```
아래 문서의 지시를 engine-dev 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/22-engine-dev-strip-comments.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 네 가지로 먼저 확인해주세요.
1. 이 버그가 왜 오탐이 아니라 미탐인지
2. 동작 동일성을 무엇으로 증명하는지
3. 재실행에서 새 위반이 나오면 무엇을 해야 하는지
4. 복제본의 내용이 서로 다르면 무엇을 해야 하는지

확인 후, 문서가 지시한 1부 전수 조사 결과를 먼저 보고하고,
그다음 2~4부를 진행해주세요.
```

---

## 4단계 — 보고 수령 후 검증

**에이전트 보고를 신뢰 근거로 쓰지 마세요.** 아래는 전부 당신이
직접 확인하는 항목입니다.

### 4-1. 남은 복제본이 없는가 — 핵심 검증

```powershell
Get-ChildItem . -Recurse -File -Include *.ts -Exclude node_modules | Select-String -Pattern 'stripComments|replace\(/\\/\\*' -List
```

- [ ] **정의가 한 곳뿐인가**
- [ ] 2-3 기록의 나머지가 **전부 import로 바뀌었는가**
- [ ] 인라인으로 남은 것이 없는가

### 4-2. 네 스위트가 수정 없이 통과하는가 — 동작 동일성의 증거

```powershell
git diff __tests__/
```

diff를 **직접 읽으세요.**

- [ ] **import 경로 갱신만** 있는가
- [ ] **assertion과 기댓값이 하나도 안 바뀌었는가**
- [ ] 네 스위트가 전부 통과하는가

**assertion이 바뀌었으면 추출이 아니라 변경입니다.** 보고하고
멈추세요.

### 4-3. 미탐이 사라졌는가

테스트 파일을 **직접 읽으세요.**

- [ ] **실행 코드에 URL이 있고 그 뒤에 위반이 오는** 합성 입력이 있는가
- [ ] 그것이 **걸리는 것**을 확인하는가
- [ ] 주석 전용 입력이 **여전히 안 걸리는** 테스트가 남아 있는가

**세 번째를 빠뜨리면 미탐을 고치면서 오탐을 만들 수 있습니다.**

합성 소스가 **테스트 안의 문자열 상수인지** 확인하세요. 실제 파일이면
수집 대상이 되어 스위트가 자기 자신을 검사합니다.

### 4-4. 재실행에서 새로 걸린 위반

```powershell
npx jest --ci --watchAll=false
```

- [ ] 정적 규칙 C·D·E가 **전부 통과하는가**
- [ ] 통과하지 않으면 **그것이 보고됐는가**

**새 위반이 나왔다면 에이전트가 고치지 않았는지 확인하세요.**

```powershell
git diff src/ supabase/
```

- [ ] 규칙 위반을 **고친 흔적이 없는가** — 발견이 산출물입니다

### 4-5. 주석 제거 범위

```powershell
git diff -- <공용 유틸 경로>
```

- [ ] **문자열 리터럴 제거가 추가되지 않았는가** — 범위 밖입니다
- [ ] 변경이 **URL 처리 하나**인가

### 4-6. 표준 검증

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
# scripts/norm/unresolvedInventory.ts 실행
git status --porcelain -uall tsconfig.json supabase/functions/tsconfig.json supabase/functions/ambient.d.ts supabase/migrations
```

- **두 게이트 모두 0 에러**
- `UNRESOLVED` 집계: **정의 4 / 소비 2** 유지
- 테스트: 550 대비 감소 없음
- 마지막 명령: **출력 없음**

---

## 5단계 — 보고

```
## 0단계
- 저장소 공백·괄호 파일명: {없음 / 목록}

## 사전 점검
- 산출물 존재: {O/X}
- MASTER r32: {O/X} / ROADMAP r1: {O/X}
- 복제본 현황 (변경 전): {출력 전문}
- 기준선: tsc -p . {N}에러 / tsc -p supabase {N}에러 / jest {N} tests {N} suites

## 전수 조사
- 에이전트가 보고한 복제본 목록: {그대로}
- 2-3 기록과 일치: {O/X — 누락·추가}
- 정규식이 서로 달랐는가: {같음 / 다름 — 내용}

## 남은 복제본 (핵심)
- 현재 매치 전문: {출력}
- 정의가 한 곳뿐: {O/X}
- 인라인 잔존: {없음 / 있음 — 경로}

## 동작 동일성
- git diff __tests__/ 요지: {import 경로만 / assertion도 — 보고}
- 네 스위트 통과: {O/X}

## 미탐 소멸
- URL 뒤 위반 합성 입력: {있음 — 내용 / 없음}
- 걸리는 것 확인: {O/X}
- 주석 전용 입력 유지: {O/X}
- 합성 소스 형태: {문자열 상수 / 실제 파일 — 보고}

## 재실행
- 규칙 C·D·E: {통과 / 실패 — 내용}
- 새로 걸린 위반: {없음 / 목록}
- 에이전트가 고친 흔적: {없음 / 있음 — 위반}

## 범위
- 공용 유틸 경로: {경로}
- 문자열 리터럴 제거 추가: {없음 / 있음 — 범위 이탈}
- 변경이 URL 처리 하나인가: {O/X}

## 표준 검증
- tsc -p . : {N}에러 / tsc -p supabase/functions: {N}에러
- jest: 550 → {현재} / {N} suites
- UNRESOLVED 집계: 정의 {N} / 소비 {M}
- 금지 파일 변경: {없음 / 있음}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **당신이 직접 구현하는 것** — 위임 대상입니다
- 위임 프롬프트를 요약·재작성·보강하는 것
- **2-3에서 찾은 것을 알려주는 것**
- **재실행에서 새로 걸린 위반을 고치는 것** — 발견이 산출물입니다
- **에이전트 보고의 자기 서술을 신뢰 근거로 쓰는 것** — 4단계는
  전부 직접 확인합니다
- `docs/ONDOLOG_MASTER.md`를 편집하는 것
- `tsconfig.json`(루트·전용)·`ambient.d.ts`를 고치는 것
- 커밋·푸시 (사람이 실행합니다 — 절대 규칙 6, 예외 없음)
- 전제가 없을 때 대체물을 찾아 나서는 것, 저장소 밖 경로를 읽는 것
- 사전 점검이 실패했는데 위임을 강행하는 것
- 검증에서 발견된 문제를 스스로 수정하는 것 — 보고가 먼저입니다
