# 메인 세션 지시 — HANDOFF 정리 (r48 반영분)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/43-main-session-handoff-cleanup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-09

---

**당신이 직접 합니다. 위임하지 않습니다.** 코드는 바꾸지 않습니다. 커밋하지 않습니다.

PM 결정(MASTER r48 · ROADMAP r7 반영 뒤) 셋입니다.

| | PM 결정 |
|---|---|
| A | HANDOFF 끝의 `---` 한 줄을 지운다. **이 한 줄만 지우고 다른 줄은 건드리지 않는다** |
| B | 호 전체 중단과 운영 경보가 문서(r48 §17-0-4-B, ROADMAP r7 발행 경로 목록)에 기록됐으니, HANDOFF에 남은 **레지스트리·33 섹션**은 보관해도 된다 |
| C | "HANDOFF에 무언가를 더할 때는 끝에 붙이지 말고 '열린 항목'이나 새 섹션에 넣는다"는 규칙을 다시 적어 둔다 |

## 0. 사전 점검

**관문** — 하나라도 다르면 시작하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r48'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r7'
git ls-files .claude/state/archive | Select-String -Pattern 'handoff-20261008'
Test-Path .claude/state/archive/handoff-20261009.md
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r48 / ROADMAP r7 | 각 한 줄 |
| `handoff-20261008` | 한 줄 — `42-`가 커밋됐다 |
| `handoff-20261009.md` | `False` — 이번에 만들 이름이 비어 있다 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 925 · 48**.

**jest worker 경고 (PM 결정)** — "A worker process has failed to exit gracefully"가 `42-` 마지막
실행에서 한 번 났습니다. 이번 실행에서 다시 나오면 **두 번 연속**입니다. 그때는
`__tests__/functions/timeOfDayLabelTimezone.test.ts`를 읽고, 테스트가 띄운 자식 프로세스가
끝까지 정리되는지(종료 대기, 타이머 해제)를 **읽기만 해서** 보고합니다. 고치지 않습니다.
`--forceExit`·`--detectOpenHandles`를 명령에 넣지 않습니다.

---

## A. HANDOFF 끝의 `---` 한 줄 삭제 — 1회 허가

**허가 대상과 범위:** `.claude/state/HANDOFF.md`의 **내용이 있는 마지막 줄**인 `---` **한 줄**.
그 밖의 줄(앞뒤 빈 줄 포함)은 건드리지 않습니다. 이 허가는 이번 한 번, 이 한 줄에만 해당합니다.

### A-1. 확인

```powershell
node -e "const t=require('fs').readFileSync('.claude/state/HANDOFF.md','utf8');console.log(JSON.stringify(t.slice(-300)))"
```

내용이 있는 마지막 줄이 `---` 하나가 **아니면** 지우지 말고 멈추고 보고합니다. 파일 안의 다른
`---`를 찾아 나서지 않습니다.

### A-2. 삭제

Node로 디스크에서 읽고 그 한 줄만 빼서 씁니다. 다른 줄의 줄바꿈은 그대로 둡니다.

### A-3. 확인

```powershell
git diff --numstat -- .claude/state/HANDOFF.md
```

기대: `0	1	.claude/state/HANDOFF.md` — 더한 줄 0, 지운 줄 1. 다르면 되돌리고 멈추고 보고합니다.

---

## B. 레지스트리·33 섹션 보관

### B-1. 대상 찾기

```powershell
Select-String -Path .claude/state/HANDOFF.md -Pattern '^#'
```

제목 전부를 보고에 적고, 그중 아래 둘을 찾습니다.

- **레지스트리 정리** 섹션 — 제목에 "레지스트리"가 들어간 것
- **`#14` 2부 2단계(33) 섹션** — `42-`가 `#14` 섹션 여덟 중 일곱을 옮기고 **남긴 하나**. 판단 4번
  "골격은 운영 경보도, 그 호 전체의 생성 중단도 구현하지 않고 호출자에게 맡긴다"가 있는 섹션

"열린 항목" 표에 이 두 섹션을 가리키는 행이 있으면 그 행도 대상입니다.

**둘 중 하나라도 못 찾거나, 해당하는 섹션이 여럿이면** 옮기지 말고 멈추고 보고합니다.

### B-2. 섹션마다 기준 B

**보관해도 된다는 것은 판정을 건너뛰어도 된다는 뜻이 아닙니다.** 섹션 안의 내용마다 다른 곳에
원본이 있는지(코드, MASTER r48, ROADMAP r7, 아카이브, `docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`)
확인합니다.

- 33 섹션의 판단 4번은 이제 MASTER r48 §17-0-4-B("구현 주체는 호출자다")와 ROADMAP r7 발행 경로
  목록에 원본이 있습니다. **그 밖의 내용**도 같은 방식으로 봅니다
- 레지스트리 정리 섹션은 `24-` 정리 때 **끝에 붙은 `execute_sql` 동작 메모 한 줄** 때문에 남았다고
  보고됐습니다. 그 메모의 원본이 다른 곳에 있는지 확인합니다

판정:

- 전부 원본이 있거나 이력이면 **통째로** 아카이브로
- 원본이 없는 내용이 있으면 그 섹션은 **옮기지 않고** 그 내용을 보고

### B-3. 옮기기

- 옮길 곳: `.claude/state/archive/handoff-20261009.md` (새 파일)
- 첫 줄: `# HANDOFF 아카이브 — 2026-10-09. 레지스트리 정리·#14 2부 2단계 섹션, 원본 순서 그대로 옮겼다.`
- 그 아래 옮기는 행(표 머리 포함)과 섹션들, **원래 순서·바이트 그대로**
- Node로 디스크에서 읽고 씁니다
- **둘 다 옮기지 않게 되면** 아카이브 파일을 만들지 않습니다

### B-4. 손실 없음 확인

**줄바꿈을 LF로 맞춘 뒤** 비교합니다(인수인계서 5-2).

- `42-` 커밋 대비 HANDOFF에서 사라진 것이 **A의 `---` 한 줄과 옮긴 행·섹션뿐**이다
- 옮긴 것이 아카이브에 **바이트 그대로**(LF 정규화 후) 있다
- 실패하면 되돌리고 멈추고 보고합니다

---

## C. HANDOFF 기록 규칙 다시 적기

**적을 문장 (PM 문구 그대로):**

```
HANDOFF에 무언가를 더할 때는 끝에 붙이지 말고 "열린 항목"이나 새 섹션에 넣는다.
```

### C-1. HANDOFF 머리말

**허가 대상과 범위:** `.claude/state/HANDOFF.md`의 머리말(첫 `#` 제목 줄 다음부터 첫 번째 섹션
제목 앞까지)에 위 문장 **한 줄 추가**. 이번 한 번만입니다.

- 머리말에 **같은 뜻의 문장이 이미 있으면** 더하지 않고 그 줄을 보고합니다
- 없으면 머리말의 **마지막 내용 줄 바로 다음**에 한 줄을 넣습니다. 머리말의 다른 줄은 건드리지 않습니다

### C-2. 인수인계서 4-2 — 확인만

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md` 4-2의 "HANDOFF 기록" 규칙에 같은 뜻이 들어 있는지
**확인만** 하고 그 행을 보고에 옮겨 적습니다. 이 파일은 고치지 않습니다.

### C-3. 확인

C 전후로 HANDOFF에 **더해진 줄이 그 한 줄뿐**인지 확인합니다.

---

## D. 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 925 · 48** (코드 변경 없음). worker 경고 처리는 0단계와 같습니다.

확인한 뒤 `PROGRESS.md` 제목 바로 아래에 한 줄.

## 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / worker 경고: {없음 / 있음 — 두 번 연속이면 자식 프로세스 정리 읽기 결과}

## A
- 삭제 전 끝 부분(JSON): {}
- numstat: {}

## B
- 제목 목록: {}
- 대상: {섹션 제목 / 열린 항목 행}
- 섹션별 기준 B: {옮김 / 남김 — 원본 없는 내용}
- 손실 없음: {O/X}

## C
- 머리말: {추가함 — 줄 / 이미 있음 — 그 줄}
- 인수인계서 4-2 해당 행: {그대로}

## 게이트
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- `---` 한 줄과 C-1의 한 줄 밖의 줄을 고치는 것 — 빈 줄, 다른 구분선 포함
- 기준 B 대조 없이 섹션을 옮기는 것, 섹션 안을 잘라내거나 재작성하는 것
- 인수인계서(`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`)를 고치는 것
- `Set-Content`·`Out-File`·`>`로 파일을 쓰는 것, `git show`의 출력으로 파일을 다시 쓰는 것
- 시간대 테스트를 고치는 것, jest 명령에 `--forceExit`·`--detectOpenHandles`를 넣는 것
- 게이트 전에 기록하는 것
- 커밋·푸시
