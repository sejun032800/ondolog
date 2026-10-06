# 메인 세션 작업 — 지면 제목 자리표시자와 인수인계서 두 행 (`32-` 미반영분)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/39-main-session-docs-titles.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-06

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다.**
**바꿀 문구는 정해져 있습니다. 다듬지 마세요.**

r41 때의 `32-`이 저장소에 반영되지 않았습니다(`37-` diff에서 지면 제목 자리표시자가
그대로 보임). `32-`은 지금 저장소와 사전 점검이 맞지 않아, 그 내용을 지금 상태에 맞춰
다시 씁니다.

## 0. 사전 점검

**관문**

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-06-r45'
$c = [IO.File]::ReadAllText('docs/ONDOLOG_CORNER_CONTENT.md')
([regex]::Matches($c, [regex]::Escape('"title": "<지면 제목 — 디자인 확정 전>"'))).Count
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 — `37-`이 커밋됐다 |
| MASTER r45 | 한 줄 |
| 자리표시자 수 | **`2`** (§2 예시 하나, §6 예시 하나) |

**확인** — 기록만 하고 멈추지 않습니다.

```powershell
$h = [IO.File]::ReadAllText('docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md')
([regex]::Matches($h, [regex]::Escape('| 우회 실증 |'))).Count
([regex]::Matches($h, [regex]::Escape('rename을 보는 diff에는 경로를 한정하지 않는다'))).Count
```

두 수를 보고에 적습니다. **`0`인 것만** 2절에서 추가합니다. `1`이면 이미 있으니
추가하지 않습니다.

---

## 1. CORNER_CONTENT — 지면 제목 두 곳 (r41)

`docs/ONDOLOG_CORNER_CONTENT.md`

| 위치 | 바꿀 것 | 바꾼 것 |
|---|---|---|
| §2 예시 (`"cornerName": "데이트 아카이브",` 바로 다음 줄) | `"title": "<지면 제목 — 디자인 확정 전>"` | `"title": "함께한 하루"` |
| §6 예시 (`"cornerName": "다정한 말들"`과 같은 줄) | `"title": "<지면 제목 — 디자인 확정 전>"` | `"title": "다정한 말들"` |

각 줄에서 **그 부분 문자열만** 바꿉니다.

---

## 2. 인수인계서 — 0단계 확인이 `0`인 행만

`docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md`

### 2-1. Part 4-2 표 마지막 행 뒤

```
| 우회 실증 | "우회가 막혔는지 실증할 때는 막은 길 하나가 아니라 같은 결과에 이르는 길 전부를 본다. 리터럴 대입이 막혀도 공개 생성자를 거치면 같은 값이 만들어진다." |
```

### 2-2. Part 5-2 표 마지막 행 뒤

```
| 이동을 검사하는 diff에 목적지 경로만 지정 → 옛 경로가 빠져 rename이 감지되지 않고 파일 전체가 "추가"로 보임 | **rename을 보는 diff에는 경로를 한정하지 않는다.** 한정해야 하면 옛 경로와 새 경로를 둘 다 지정한다 |
```

---

## 3. 확인

- Node로 디스크에서 읽고 씁니다. `Set-Content`·`Out-File`·`>` 금지

```powershell
git diff -- docs/ONDOLOG_CORNER_CONTENT.md docs/ONDOLOG_PROMPT_ENGINEER_HANDOFF.md
```

| 확인 | 기대 |
|---|---|
| CORNER_CONTENT | 지면 제목 두 곳만 |
| 자리표시자 수 | 0 |
| 인수인계서 | 0단계에서 `0`이었던 행만 추가 — 그 밖 없음 |

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 630 · 35**를 확인한 뒤 `PROGRESS.md` 제목 바로 아래에 한 줄.

## 4. 보고

```
- 관문: {각 O/X}
- 확인: 우회 실증 행 {N} / rename 행 {N}
- 추가한 행: {목록 / 없음}
- git diff 전문
- 게이트: {}
- git status --porcelain: {전문}
```

## 하지 말 것

- 커밋·푸시
- 지정된 곳 외 편집, 문구 다듬기
- 이미 있는 행을 다시 추가하는 것
- 게이트 전에 기록하는 것
