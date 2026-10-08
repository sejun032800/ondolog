# 메인 세션 작업 — r46 문서 둘

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/41-main-session-docs-r46.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-07

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다.**
**바꿀 문구는 정해져 있습니다. 다듬지 마세요.** `40-` 커밋 뒤에 돌립니다.

## 0. 사전 점검

**관문** — 줄바꿈을 LF로 맞춘 뒤 셉니다(인수인계서 5-2 줄바꿈 기준).

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-07-r46'
$c = ([IO.File]::ReadAllText('docs/ONDOLOG_CORNER_CONTENT.md')) -replace "`r`n", "`n"
([regex]::Matches($c, [regex]::Escape("  → Zod schema.parse       ← 실패 시 재시도, 3회 실패 시 status='failed'"))).Count
$h = ([IO.File]::ReadAllText('docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md')) -replace "`r`n", "`n"
([regex]::Matches($h, [regex]::Escape('"맨 LF 0개" 같은 작업 트리 줄바꿈 검사는 폐기한다 |'))).Count
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r46 | 한 줄 |
| §0-2 다이어그램 줄 | `1` |
| 인수인계서 5-2 행 끝 | `1` |

---

## 1. CORNER_CONTENT §0-2 — 다이어그램을 포인터로 (r46)

`docs/ONDOLOG_CORNER_CONTENT.md` §0-2의 **코드 블록 하나 전체**(``` 줄부터 ``` 줄까지,
안에 `LLM 출력(문자열)` … `→ corners.content 저장`이 든 블록)를 아래 한 줄로 바꿉니다.

```
검사 순서·실패 사유·재시도의 원본은 `docs/ONDOLOG_MASTER.md` §17-0-4(검사 순서)와 §17-0-5-A(재시도)다.
```

블록 앞 문장("LLM 출력을 그대로 `content`에 넣지 않는다. …")과 그 밖의 줄은 그대로 둡니다.
**그 블록이 정확히 하나가 아니면 바꾸지 말고 멈추고 보고하세요.**

---

## 2. 인수인계서 5-2 — "`git show`는 비교용으로만"을 되살린다 (r46)

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md` 5-2 표에서 `"맨 LF 0개" 같은 작업 트리 줄바꿈
검사는 폐기한다 |`로 끝나는 행의 **끝 부분**을 아래로 바꿉니다. 행 수는 늘리지 않습니다.

바꿀 것:

```
"맨 LF 0개" 같은 작업 트리 줄바꿈 검사는 폐기한다 |
```

바꾼 것:

```
"맨 LF 0개" 같은 작업 트리 줄바꿈 검사는 폐기한다. **`git show`는 비교용으로만 쓴다** — 커밋에서 읽어 파일을 다시 쓰면 작업 트리에만 있던 변경이 사라진다 |
```

---

## 3. 확인

- Node로 디스크에서 읽고 씁니다. `Set-Content`·`Out-File`·`>` 금지

```powershell
git diff -- docs/ONDOLOG_CORNER_CONTENT.md docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md
```

| 확인 | 기대 |
|---|---|
| CORNER_CONTENT | §0-2 블록 하나가 한 줄로 — 그 밖 없음 |
| 인수인계서 | 5-2 한 행의 끝 부분만 — 행 수 그대로, 그 밖 없음 |

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

게이트가 `40-` 직후 값과 같음을 확인한 뒤 `PROGRESS.md` 제목 바로 아래에 한 줄.

## 4. 보고

```
- 관문: {각 O/X}
- git diff 전문
- 게이트: {}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- 지정된 두 곳 외 편집, 문구 다듬기
- 5-2에 행을 새로 더하는 것
- 게이트 전에 기록하는 것
