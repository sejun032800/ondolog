# 메인 세션 작업 — r41 문서 반영

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/32-main-session-docs-r41.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-05

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음). **바꿀 문구는 정해져 있습니다. 다듬지 마세요.**

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-05-r41'
$f = 'docs/ONDOLOG_CORNER_CONTENT.md'
$lines = [IO.File]::ReadAllLines($f)
$find = @(
  '    "title": "<지면 제목 — 디자인 확정 전>",',
  '  "header": { "cornerName": "이달의 다정한 말들", "title": "<지면 제목 — 디자인 확정 전>", "periodLabel": "2026년 8월" },'
)
foreach ($t in $find) { '{0}  <=  {1}' -f (@($lines | Where-Object { $_ -ceq $t }).Count), $t }
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER r41 | 한 줄 |
| 찾을 것 둘 | **각 줄 앞의 수가 `1`** |

하나라도 다르면 멈추고 보고하세요.

---

## 1. `CORNER_CONTENT.md` — 지면 제목 두 곳

**줄 전체가 정확히 일치할 때만** 바꿉니다.

| # | 찾을 것 | 바꿀 것 |
|---|---|---|
| 1 | `    "title": "<지면 제목 — 디자인 확정 전>",` | `    "title": "함께한 하루",` |
| 2 | `  "header": { "cornerName": "이달의 다정한 말들", "title": "<지면 제목 — 디자인 확정 전>", "periodLabel": "2026년 8월" },` | `  "header": { "cornerName": "이달의 다정한 말들", "title": "다정한 말들", "periodLabel": "2026년 8월" },` |

**`cornerName`은 바꾸지 않습니다.** 다정한 말들의 코너 이름은 PM 확인 중입니다.

---

## 2. PE 인수인계서 — 두 행 추가

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`. **아래 두 행 외에는 건드리지 마세요.**

### 2-1. Part 4-2 표 마지막 행 뒤

```
| 우회 실증 | "우회가 막혔는지 실증할 때는 막은 길 하나가 아니라 같은 결과에 이르는 길 전부를 본다. 리터럴 대입이 막혀도 공개 생성자를 거치면 같은 값이 만들어진다." |
```

### 2-2. Part 5-2 표 마지막 행 뒤

```
| 이동을 검사하는 diff에 목적지 경로만 지정 → 옛 경로가 빠져 rename이 감지되지 않고 파일 전체가 "추가"로 보임 | **rename을 보는 diff에는 경로를 한정하지 않는다.** 한정해야 하면 옛 경로와 새 경로를 둘 다 지정한다 |
```

---

## 3. 쓰는 방식과 검증

- Node로 **디스크에서** 읽고 **각 파일의 원래 줄바꿈**으로 씁니다(두 파일 모두 LF로 보고됨 — 직접 확인)
- `$env:TEMP`에 스냅샷을 먼저 뜨고, 끝나면 지웁니다
- `Set-Content`·`Out-File`·`>` 금지

```powershell
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern '디자인 확정 전'
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern '"title": "함께한 하루"|"title": "다정한 말들"'
git diff --stat
```

| 확인 | 기대 |
|---|---|
| `디자인 확정 전` | **빈 출력** |
| 지면 제목 둘 | **두 줄** |
| `git diff --stat` | 두 문서(+ PROGRESS) |
| diff 내용 | CORNER_CONTENT 두 줄 교체, 인수인계서 두 줄 추가 — **그 밖 없음**. 직접 읽어 확인 |

실패하면 스냅샷에서 복원하고 멈추고 보고합니다.

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 556 · 35**를 확인한 뒤 `PROGRESS.md` **제목 바로 아래**에 한 줄.

## 4. 보고

```
- 0단계 표: {각 O/X}
- 교체 둘: {각 O/X, 행 번호}
- 인수인계서 두 행: {O/X}
- 검증 표: {각 O/X}
- 게이트: {0 / 0 / 556 · 35}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- **`cornerName` 변경** — PM 확인 중
- 지정된 두 줄·두 행 외 편집, 그 밖의 `docs/` 편집
- 바꿀 문구를 다듬는 것
- 게이트 전에 기록하는 것
- `git show HEAD:`로 원본을 읽어 다시 쓰는 것, 줄바꿈 변경
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
