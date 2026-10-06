# 메인 세션 작업 — r45 문서 정리

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/37-main-session-docs-r45.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-06

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다.**
**바꿀 문구는 정해져 있습니다. 다듬지 마세요.**

## 0. 사전 점검

**관문** — 하나라도 다르면 멈추고 보고합니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-06-r45'
$h = [IO.File]::ReadAllText('docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md')
([regex]::Matches($h, [regex]::Escape('**다시 쓰는 작업은 디스크에서 읽고 원래 줄바꿈으로 쓴다.**'))).Count
$c = [IO.File]::ReadAllText('docs/ONDOLOG_CORNER_CONTENT.md')
([regex]::Matches($c, [regex]::Escape('"cornerName": "이달의 다정한 말들"'))).Count
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r45 | 한 줄 |
| 인수인계서의 옛 처방 문구 | `1` |
| CORNER_CONTENT의 옛 코너 이름 | `1` |

---

## 1. 인수인계서 — 옛 행 하나 고치고, 한 행 추가

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`

### 1-1. Part 5-2 — 옛 행의 처방 칸을 바꾼다 (행을 늘리지 않는다)

`**다시 쓰는 작업은 디스크에서 읽고 원래 줄바꿈으로 쓴다.**`가 들어 있는 **그 행의
처방 칸 전체**를 아래로 바꿉니다. **사건 칸은 그대로** 둡니다.

```
**줄바꿈의 기준은 저장소(index)의 LF다.** 작업 트리의 CRLF·LF는 `autocrlf`와 도구가 바꾸는 로컬 상태라 기준으로 쓰지 않는다. 손실 없음 검증은 줄바꿈을 정규화한 뒤 비교한다 — 바이트 단위 비교를 쓰되 비교 전에 양쪽을 LF로 맞춘다. "맨 LF 0개" 같은 작업 트리 줄바꿈 검사는 폐기한다
```

### 1-2. Part 4-2 표 마지막 행 뒤에 한 행

```
| 확인과 관문 | "사전 점검 항목은 둘로 나눠 쓴다. 실패하면 위임을 막는 관문, 그리고 결과를 기록만 하는 확인. PM이 '확인'이라고 한 것을 관문으로 올리지 않는다." |
```

---

## 2. CORNER_CONTENT — 다정한 말들의 코너 이름 (r45)

`docs/ONDOLOG_CORNER_CONTENT.md`에서 **`"cornerName": "이달의 다정한 말들"`** 한 곳을
**`"cornerName": "다정한 말들"`**로 바꿉니다. 같은 줄의 다른 부분은 그대로 둡니다.

---

## 3. 쓰는 방식과 확인

- Node로 디스크에서 읽고 씁니다. `Set-Content`·`Out-File`·`>` 금지
- 줄바꿈은 기준이 저장소(LF)이므로 따로 맞추지 않습니다

```powershell
git diff -- docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md docs/ONDOLOG_CORNER_CONTENT.md
```

| 확인 | 기대 |
|---|---|
| 인수인계서 | 5-2 한 행의 처방 칸 교체 + 4-2 한 행 추가 — **그 밖 없음** |
| CORNER_CONTENT | 코너 이름 한 곳 — **그 밖 없음** |
| 인수인계서의 옛 처방 문구 | 0 |

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 630 · 35**를 확인한 뒤 `PROGRESS.md` 제목 바로 아래에 한 줄.

## 4. 보고

```
- 사전 점검 표: {각 O/X}
- git diff 전문
- 게이트: {}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- 지정된 곳 외 편집, 문구 다듬기
- 5-2 사건 칸 변경, 5-2에 행을 새로 더하는 것
- 게이트 전에 기록하는 것
