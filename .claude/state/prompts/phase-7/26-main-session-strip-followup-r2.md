# 메인 세션 작업 — `#15` 후속 정리 (r2)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/26-main-session-strip-followup-r2.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-01
>
> **r2 — 원본은 1-1에서 멈췄다.** 원본은 "docblock 명령에 `--rootDir .`을
> 더한다"고 했으나 그 옵션은 이미 있었다. PE가 직전 보고의 서술을 파일을
> 열어보지 않고 옮겨 생긴 전제 오류다. 실제 문제는 **명령이 bash 문법**
> (줄 끝 `\`, `rm -rf`)이라 PowerShell에서 그대로 돌리면 `--outDir` 없이
> 첫 줄이 따로 실행되어 저장소 안에 `.js`가 생길 수 있다는 것이다.
> r2 변경: 1-1의 목적을 **PowerShell에서 그대로 실행되는 명령으로 바꾸기**로,
> **`generate-norm.ts`도 함께**(PM 승인). 인수인계서 4-2에 한 행 추가

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
git log --oneline -- scripts/lib/stripComments.ts
Test-Path scripts/lib/stripComments.ts
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER 리비전 | 한 줄 출력 |
| ROADMAP 리비전 | 한 줄 출력 |
| `git log -- scripts/lib/stripComments.ts` | **한 줄 이상** — `#15` 산출물이 커밋됐다는 뜻 |
| `Test-Path` | `True` |

**하나라도 기대와 다르면 멈추고 보고하세요.**

> 커밋 확인은 **커밋 메시지가 아니라 산출물 파일**로 합니다. 이 저장소의
> 커밋 메시지는 `1001 오후 시작`처럼 날짜 형식이라 내용 단어로는 찾을 수 없습니다.

---

## 1. 실행 명령을 PowerShell 형식으로 — 가장 먼저

### 1-1. 명령의 원본은 스크립트 docblock 한 곳

아래 **두 스크립트** 상단 docblock의 1회용 컴파일·실행 명령이 원본입니다.
**둘 다 지금은 bash 문법**이라 이 프로젝트의 개발 환경(Windows/PowerShell)에서
그대로 실행되지 않습니다.

- `scripts/norm/unresolvedInventory.ts`
- `scripts/generate-norm.ts`

**PowerShell 형식으로 바꿉니다.** 다른 스크립트 docblock들이 이미 쓰는
형식과 같게 합니다.

| 바꿀 것 | 바꾼 것 |
|---|---|
| 줄 끝 `\` | 줄 끝 백틱(`` ` ``) |
| `rm -rf .norm-build` | `Remove-Item -Recurse -Force .norm-build` |

- **옵션과 순서는 그대로 둡니다.** `--rootDir .`을 포함해 하나도 빼거나
  더하지 않습니다
- 바꾸기 전에 **현재 명령 전문을 보고에 적습니다**

**PROGRESS·아카이브에 적힌 옛 명령은 고치지 않습니다.** 그 시점의 사실이고,
이력을 다시 쓰면 기록이 거짓이 됩니다.

### 1-2. 실증 — 고친 명령을 그대로 돌린다

**새 PowerShell 창을 열어**, docblock의 명령을 **주석 머리(` * `)만 떼고
나머지는 한 글자도 바꾸지 않고** 실행합니다.

- **먼저 `.norm-build`를 지웁니다.** 예전 빌드 결과를 읽어 맞는 수가 나오는
  경우를 막기 위해서입니다
- 출력이 **정의 4 / 소비 2**여야 합니다
- 끝나면 명령의 마지막 줄이 `.norm-build`를 지웠는지 확인합니다

**실행 후 저장소에 `.js`가 새로 생기지 않았는지 확인합니다.**

```powershell
git status --porcelain --untracked-files=all | Select-String -Pattern '\.js$'
Test-Path .norm-build
```

| 명령 | 기대 출력 |
|---|---|
| `.js` 검색 | **빈 출력** |
| `Test-Path .norm-build` | `False` |

**4/2가 나오지 않거나, `.js`가 생겼거나, 명령이 실패하면** 생긴 파일을
지우고 멈추고 보고하세요.

### 1-3. `generate-norm.ts` 실증 — 검증 방식이 다릅니다

이 스크립트는 **실행하면 규준집단 파일을 씁니다**(`src/engine/data/`).
돌려서 숫자를 보는 방식으로 실증하면 그 파일이 다시 쓰입니다. 그래서
**결과가 바뀌지 않았는지**로 확인합니다.

**새 PowerShell 창에서**, 1-2와 같은 방식으로 실행합니다 (빌드 산출물
선삭제 → 주석 머리만 떼고 그대로 실행).

실행 후:

```powershell
git status --porcelain --untracked-files=all src/engine/data/
git status --porcelain --untracked-files=all | Select-String -Pattern '\.js$'
Test-Path .norm-build
```

| 명령 | 기대 출력 |
|---|---|
| `src/engine/data/` 상태 | **빈 출력** |
| `.js` 검색 | **빈 출력** |
| `Test-Path .norm-build` | `False` |

**같은 코드로 재생성하면 기존 파일과 바이트가 같아야 합니다.** 그것이
드리프트 감지 테스트가 지켜온 보장입니다.

**`src/engine/data/`에 무언가 바뀌었거나 새 파일이 생겼으면:**

```powershell
git checkout -- src/engine/data/
git clean -n src/engine/data/      # 지울 대상을 먼저 확인
git clean -f src/engine/data/      # 확인한 뒤에만
```

복원하고 **멈추고 보고하세요.** 그건 명령 문법 문제가 아니라 **더 큰 문제의
신호**입니다. 바뀐 파일 이름과 `git diff --stat` 결과를 보고에 적습니다.

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

- `#15` 실행 때 HANDOFF에 생긴 **새 섹션**은 **기준 B로 판정한 뒤** 옮깁니다

  **닫혔다는 건 아카이브 후보라는 뜻이지 판정을 건너뛰어도 된다는 뜻이
  아닙니다.** 닫힌 작업의 섹션에도 다른 곳에 원본이 없는 것이 들어 있을
  수 있습니다 — "레지스트리 정리" 섹션 끝의 `execute_sql` 메모가 그랬습니다.

  섹션 안의 내용을 하나씩 아래 표와 대조합니다.

  | 내용 | 원본 |
  |---|---|
  | 공용 유틸 위치·`preserveLines` 옵션 | 코드 (`scripts/lib/stripComments.ts`) |
  | 새 기준선 556 · 35 | ROADMAP §1 (r3) |
  | 고친 컴파일 명령 | 1단계 이후의 `unresolvedInventory.ts` docblock |
  | "숨어 있던 위반 0", "제외 0 경위" 같은 경과 | 이력 — 아카이브로 가면 된다 |

  - **전부 원본이 있으면** 섹션을 **통째로** 같은 아카이브로 옮깁니다
  - **표에 없는 내용이 있으면 옮기지 말고** 섹션을 남긴 채 그 내용을
    보고하세요. 제자리가 어디인지는 PM이 정합니다

### 3-2. PROGRESS 기록 한 줄

**제목(`# 진행 상황`) 바로 아래, 기존 갱신 문단 위**에 이번 작업 한 줄.

### 3-3. 쓰는 방식

- Node로 **디스크에서** 읽고 **원래 줄바꿈(CRLF)**으로 씁니다
- 쓰기 전에 `$env:TEMP`에 스냅샷을 뜹니다 (이 경로만 허가)
- `Set-Content`·`Out-File`·`>` 리다이렉트 금지

### 3-4. 검증

- HANDOFF에서 사라진 것이 **`#15` 행** (+ 기준 B를 통과했다면 **`#15` 새 섹션**)뿐이고,
  옮긴 것은 아카이브에 **바이트 그대로** 있다
- PROGRESS에서 추가된 것이 **제목 아래 한 줄뿐**이다
- 세 파일 모두 **맨 LF 0개**

실패하면 스냅샷에서 복원하고 멈추고 보고합니다.

---

## 4. PE 인수인계서 — 행 추가 다섯

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`. **아래 다섯 행 외에는 건드리지
마세요.** 이 파일은 LF입니다.

### 4-1. Part 4-2 표 마지막 행 뒤에 셋

```
| 사전 점검 | "사전 점검의 모든 항목은 실행할 명령과 기대 출력으로 쓴다. 명령이 없는 전제 조건은 검사되지 않는다." |
| 열린 항목 | "상태 칸 갱신 허용. 원본 칸은 실제로 실행한 지시서를 가리키도록 갱신 허용. 닫힌 행은 아카이브로 옮긴다." |
| 보고를 전제로 | "다른 세션의 보고를 지시서의 전제로 옮길 때는 그 대상을 파일로 직접 확인한다. 보고는 확인할 위치를 알려줄 뿐, 확인을 대신하지 않는다." |
```

### 4-2. Part 5-2 표 마지막 행 뒤에 둘

```
| `Get-ChildItem -Exclude node_modules`가 `node_modules`를 거르지 못함 (`-Exclude`는 파일 이름에만 걸림) | **저장소 파일 검색은 `git ls-files`로 한다.** 추적하는 파일만 보므로 빌드 산출물·임시 파일도 함께 걸러진다 |
| 커밋 여부를 커밋 메시지의 단어로 확인 → 커밋돼 있는데 실패 (메시지가 `1001 오후 시작` 같은 날짜 형식) | **사전 점검 명령은 확인하려는 사실 자체를 본다.** 산출물이 있는지는 파일로, 커밋됐는지는 그 파일의 이력으로 본다. 커밋 메시지 같은 사람이 붙인 설명은 판정 근거로 쓰지 않는다 |
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
- unresolvedInventory.ts 변경 전 전문: {그대로}
- unresolvedInventory.ts 변경 후 전문: {그대로}
- 옵션·순서 변경: {없음 / 있음 — 위반}
- 새 PowerShell 창에서 그대로 실행: {O/X}
- 빌드 산출물 선삭제: {O/X}
- 결과: 정의 {N} / 소비 {M} (4/2여야 함)
- 실행 후 .js 생성: {없음 / 있음 — 경로}
- 실행 후 .norm-build 잔존: {없음 / 있음}
- generate-norm.ts 변경 전 전문 / 후 전문: {그대로}
- generate-norm.ts 실행: {O/X}
- 실행 후 src/engine/data/ 상태: {빈 출력 / 바뀜 — 파일명, 복원함}
- 실행 후 .js 생성 / .norm-build 잔존: {없음 / 있음}

## 주석 정정
| 파일 | 바뀐 것 |
|---|---|
- 목록 밖에서 더 발견한 것: {없음 / 목록 — 고치지 않음}
- assertion·실행 코드 변경: {없음 / 있음 — 위반}

## 상태 파일
- 아카이브로 옮긴 것: {`#15` 행 / `#15` 섹션 — 옮김 or 남김}
- `#15` 섹션 기준 B 대조: {각 내용 → 원본 위치} / 표에 없는 내용: {없음 / 목록 — 섹션 남김}
- 검증: 사라진 것 일치 {O/X} / 바이트 동일 {O/X} / PROGRESS 추가 한 줄 {O/X} / 맨 LF {각 0}

## 인수인계서
- 4-2 세 행 / 5-2 두 행: {O/X}
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
- **닫힌 섹션을 기준 B 대조 없이 아카이브로 옮기는 것**
- 빌드 산출물을 지우지 않고 명령을 실행하는 것
- **bash 문법 명령을 PowerShell에서 실행하는 것**
- 명령의 옵션·순서를 바꾸는 것 — 문법만 바꾼다
- 두 스크립트 외 docblock 수정
- **`generate-norm.ts` 실행으로 바뀐 `src/engine/data/`를 그대로 두는 것** — 복원하고 보고
- 지정된 다섯 행 외의 인수인계서 편집
- `git show HEAD:`로 원본을 읽어 파일을 다시 쓰는 것, 줄바꿈을 바꾸는 것
- `Set-Content`·`Out-File`·`>` 리다이렉트
- 그 밖의 `docs/` 편집, 설정 파일 변경
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
