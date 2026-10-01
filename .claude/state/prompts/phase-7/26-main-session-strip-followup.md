# 메인 세션 작업 — `#15` 후속 정리

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/26-main-session-strip-followup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-01

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음).

`#15`가 `stripComments` 복제본을 통합하면서 **사실과 달라진 주석**과
**`unresolvedInventory`의 기록된 컴파일 명령**을 고칩니다. 함께 상태 파일과
인수인계서의 남은 항목을 정리합니다.

**assertion과 실행 코드는 건드리지 않습니다.**

---

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-09-26-r35'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-09-28-r3'
git log --oneline -10 | Select-String -Pattern 'stripComments'
Test-Path scripts/lib/stripComments.ts
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER 리비전 | 한 줄 출력 |
| ROADMAP 리비전 | 한 줄 출력 |
| `git log … stripComments` | **한 줄 이상** — `#15`가 커밋됐다는 뜻 |
| `Test-Path` | `True` |

**하나라도 기대와 다르면 멈추고 보고하세요.**

---

## 1. 실행 명령 갱신 — 가장 먼저

### 1-1. 명령의 원본은 스크립트 docblock 한 곳

`scripts/norm/unresolvedInventory.ts` 상단 docblock의 **1회용 컴파일·실행
명령**이 원본입니다. 이것을 고칩니다.

- `#15` 이후 `scripts/lib/`를 import하므로, 기록된 명령 그대로면 출력 경로가
  달라집니다. **`--rootDir .`을 더해** 출력이 `scripts/norm/` 아래에 생기게
  합니다
- 명령의 나머지(옵션·순서)는 그대로 둡니다

**PROGRESS·아카이브에 적힌 옛 명령은 고치지 않습니다.** 그 시점의 사실이고,
이력을 다시 쓰면 기록이 거짓이 됩니다.

### 1-2. 실증 — 고친 명령을 그대로 돌린다

**새 PowerShell 창을 열어**, docblock에 적은 명령을 **한 글자도 바꾸지 않고
복사해** 실행합니다.

- 빌드 산출물 디렉터리를 **먼저 지우고** 실행합니다. 예전 빌드 결과를 읽어
  맞는 수가 나오는 경우를 막기 위해서입니다
- 출력이 **정의 4 / 소비 2**여야 합니다
- 끝나면 빌드 산출물을 지웁니다

**4/2가 나오지 않거나 명령이 실패하면 멈추고 보고하세요.**

---

## 2. 사실과 달라진 주석 정정

**`#15` 때문에 사실과 달라진 주석만** 고칩니다. 아래 다섯 파일이 대상입니다.

| 파일 | 고칠 것 |
|---|---|
| `__tests__/engine/cornerPipelineStaticRules.test.ts` | "다시 로컬로 정의하는 이유" 제목과 그 아래 "기존 스위트 …" 문장, 대상이 사라진 "이 복제본은…" docblock |
| `__tests__/engine/determinismStaticRules.test.ts` | 함수를 지운 자리에 남은, 대상 없는 docblock |
| `__tests__/engine/importBoundary.test.ts` | 같음 |
| `__tests__/store/sessionStore.test.ts` | 같음 |
| `scripts/norm/unresolvedInventory.ts` | "다른 로컬 모듈을 import하지 않아"는 틀린 문장 |

- 대상 없는 docblock은 **지우거나 `scripts/lib/stripComments.ts`를 가리키는
  한 줄로** 바꿉니다
- `#15`에서 정정한 docblock 문장(옛 판단 + 충족된 단서)은 **그대로 둡니다**
- 위 목록 밖의 주석은 건드리지 않습니다. 사실과 달라 보이는 것을 더 발견하면
  **고치지 말고 보고**합니다

---

## 3. 상태 파일

### 3-1. HANDOFF "열린 항목" — `#15` 행을 아카이브로

`#15`는 PM이 수용해 닫혔습니다.

- "열린 항목" 표에서 **`#15` 행 하나를** 옮깁니다
- 옮길 곳: `.claude/state/archive/handoff-20261001.md` (새 파일)

  첫 줄:
  ```
  # HANDOFF 아카이브 — 2026-10-01. 닫힌 "열린 항목" 행과 원본 순서 그대로 옮긴 항목.
  ```
  그 아래 표 머리(열 이름 줄과 구분 줄) + 옮긴 행

- `#15` 실행 때 HANDOFF에 생긴 **새 섹션**도 완료된 기록이므로 **통째로**
  같은 아카이브로 옮깁니다

### 3-2. PROGRESS 기록 한 줄

**제목(`# 진행 상황`) 바로 아래, 기존 갱신 문단 위**에 이번 작업 한 줄.

### 3-3. 쓰는 방식

- Node로 **디스크에서** 읽고 **원래 줄바꿈(CRLF)**으로 씁니다
- 쓰기 전에 `$env:TEMP`에 스냅샷을 뜹니다 (이 경로만 허가)
- `Set-Content`·`Out-File`·`>` 리다이렉트 금지

### 3-4. 검증

- HANDOFF에서 사라진 것이 **`#15` 행 + `#15` 새 섹션뿐**이고, 둘 다 아카이브에
  **바이트 그대로** 있다
- PROGRESS에서 추가된 것이 **제목 아래 한 줄뿐**이다
- 세 파일 모두 **맨 LF 0개**

실패하면 스냅샷에서 복원하고 멈추고 보고합니다.

---

## 4. PE 인수인계서 — 행 추가 셋

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`. **아래 세 행 외에는 건드리지
마세요.** 이 파일은 LF입니다.

### 4-1. Part 4-2 표 마지막 행 뒤에 둘

```
| 사전 점검 | "사전 점검의 모든 항목은 실행할 명령과 기대 출력으로 쓴다. 명령이 없는 전제 조건은 검사되지 않는다." |
| 열린 항목 | "상태 칸 갱신 허용. 원본 칸은 실제로 실행한 지시서를 가리키도록 갱신 허용. 닫힌 행은 아카이브로 옮긴다." |
```

### 4-2. Part 5-2 표 마지막 행 뒤에 하나

```
| `Get-ChildItem -Exclude node_modules`가 `node_modules`를 거르지 못함 (`-Exclude`는 파일 이름에만 걸림) | **저장소 파일 검색은 `git ls-files`로 한다.** 추적하는 파일만 보므로 빌드 산출물·임시 파일도 함께 걸러진다 |
```

---

## 5. 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

| 명령 | 기대 출력 |
|---|---|
| tsc (루트) | 0 에러 |
| tsc (functions) | 0 에러 |
| jest | **556 tests / 35 suites** 전부 통과 |

---

## 6. 보고

```
## 시작
- 0단계 표 다섯: {각 기대와 일치 O/X}

## 실행 명령 (최우선)
- docblock 명령 변경 전/후: {그대로}
- 새 셸에서 그대로 실행: {O/X}
- 빌드 산출물 선삭제: {O/X}
- 결과: 정의 {N} / 소비 {M} (4/2여야 함)

## 주석 정정
| 파일 | 바뀐 것 |
|---|---|
- 목록 밖에서 더 발견한 것: {없음 / 목록 — 고치지 않음}
- assertion·실행 코드 변경: {없음 / 있음 — 위반}

## 상태 파일
- 아카이브로 옮긴 것: {`#15` 행, `#15` 섹션}
- 검증: 사라진 것 일치 {O/X} / 바이트 동일 {O/X} / PROGRESS 추가 한 줄 {O/X} / 맨 LF {각 0}

## 인수인계서
- 4-2 두 행 / 5-2 한 행: {O/X}
- 그 밖의 변경: {없음 / 있음 — 위반}

## 게이트
- {0 / 0 / 556 · 35}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- 커밋·푸시 — 절대 규칙 6, 예외 없음
- **assertion·실행 코드 변경**
- **PROGRESS·아카이브에 적힌 옛 명령을 고치는 것** — 이력이다
- 목록 밖 주석 수정 — 발견하면 보고
- 빌드 산출물을 지우지 않고 명령을 실행하는 것
- 지정된 세 행 외의 인수인계서 편집
- `git show HEAD:`로 원본을 읽어 파일을 다시 쓰는 것, 줄바꿈을 바꾸는 것
- `Set-Content`·`Out-File`·`>` 리다이렉트
- 그 밖의 `docs/` 편집, 설정 파일 변경
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
