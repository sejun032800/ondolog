# 메인 세션 작업 — `CORNER_CONTENT.md` 저장 스키마에 r39 반영

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/30-main-session-corner-schema-r39.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-04
> 개정: 2026-10-04 — 첫 실행이 3단계에서 멈춤. 1-4의 바꿀 문구가 `'metric'`을 담는데
> 검증은 "§3 한 줄만"을 기대한 **지시서 자체의 모순**이었다. 검증을 "몇 줄인가"에서
> "어디에 무엇으로 남는가"로 바꿨다. 위임 전·변경 없이 멈췄으므로 덮어씀

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음).

MASTER §17-0-7(r39)의 결정 중 **저장 스키마가 바뀌는 것**을 원본 문서
`docs/ONDOLOG_CORNER_CONTENT.md`에 반영합니다. **바꿀 문구는 정해져 있습니다.
다듬지 마세요.**

---

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-04-r39'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-04-r4'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '^#### 17-0-7\.'
$f = 'docs/ONDOLOG_CORNER_CONTENT.md'
$find = @(
  '    title: string;         // 지면 제목',
  '    "title": "데이트 아카이브",',
  '  "header": { "title": "이달의 다정한 말들", "periodLabel": "2026년 8월" },',
  '    "warmthIndex": 72,',
  '  main: SweetExcerpt[];           // 월간 2~3개 / 일간 1개',
  '  sub: Array<{',
  '    signals: Array<{ kind: ''place'' | ''keyword'' | ''activity'' | ''metric''; value: string; count: number }>;',
  '    evidence: Evidence[];         // 최소 1개',
  '### 7-2. 생성 규칙'
)
$lines = [IO.File]::ReadAllLines($f)
foreach ($t in $find) { '{0}  <=  {1}' -f (@($lines | Where-Object { $_ -ceq $t }).Count), $t }
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER r39 / ROADMAP r4 / 17-0-7 | 각 한 줄 |
| 찾을 것 아홉 | **각 줄 앞의 수가 모두 `1`** — 줄 전체가 정확히 일치하는 줄이 하나씩 있다 |

하나라도 다르면 멈추고 보고하세요. 특히 찾을 것이 **두 번 이상** 나오면 어느
것을 바꿀지 판단하지 말고 멈추세요.

---

## 1. 교체 — 아홉 곳

**"찾을 것"이 줄 전체로 정확히 한 번 일치할 때만** 그 줄을 "바꿀 것"으로 바꿉니다.

> 표 안의 `\|`는 마크다운 표기 때문입니다. **실제 문자열은 `|`**입니다. 0단계의
> `$find` 배열이 실제 문자열입니다.

| # | 위치 | 찾을 것 (줄) | 바꿀 것 |
|---|---|---|---|
| 1 | §1 공통 봉투 | `    title: string;         // 지면 제목` | 아래 1-1 |
| 2 | §2 예시 | `    "title": "데이트 아카이브",` | 아래 1-2 |
| 3 | §6 예시 | `  "header": { "title": "이달의 다정한 말들", "periodLabel": "2026년 8월" },` | 아래 1-3 |
| 4 | §6 예시 | `    "warmthIndex": 72,` | `    "warmthIndex": null,` |
| 5 | §6-1 | `  main: SweetExcerpt[];           // 월간 2~3개 / 일간 1개` | `  main: SweetExcerpt[];           // 월간 1~3개 / 일간 1개 (MASTER 17-0-7)` |
| 6 | §6-1 | `  sub: Array<{` | `  sub: Array<{                    // 0~6개 (MASTER 17-0-7)` |
| 7 | §7-1 | `    signals: Array<{ kind: 'place' \| 'keyword' \| 'activity' \| 'metric'; value: string; count: number }>;` | 아래 1-4 |
| 8 | §7-1 | `    evidence: Evidence[];         // 최소 1개` (**4칸 들여쓰기**) | `    evidence: MonthEvidence[];    // 최소 1개` |
| 9 | §7-2 앞 | `### 7-2. 생성 규칙` | 아래 1-5 (그 줄 **앞에** 끼워 넣고 원래 줄은 그대로) |

**§3의 `evidence: Evidence[];`(2칸 들여쓰기)와 `interface Evidence`는 건드리지
않습니다.** 연애 DNA가 `metric` 근거를 쓰기 때문입니다.

### 1-1

```
    cornerName: string;    // 코너 이름 — 앱 화면·목차용, 길이 제한 없음, 코너별 상수 (MASTER 17-0-7)
    title: string;         // 지면 제목 — 지면 머리용, 7자 이내(코드포인트), 코너별 상수. 문구는 디자인이 정한다
```

### 1-2

```
    "cornerName": "데이트 아카이브",
    "title": "<지면 제목 — 디자인 확정 전>",
```

### 1-3

```
  "header": { "cornerName": "이달의 다정한 말들", "title": "<지면 제목 — 디자인 확정 전>", "periodLabel": "2026년 8월" },
```

### 1-4

```
    /** count는 파이프라인이 계산한다 — 그 신호가 참조한 근거 ID 개수. LLM이 쓰지 않는다. 'metric'은 MVP에서 뺀다 (MASTER 17-0-7) */
    signals: Array<{ kind: 'place' | 'keyword' | 'activity'; value: string; count: number }>;
```

### 1-5

````
```ts
/**
 * 17-5 전용 근거. §3의 Evidence와 별개다 — 연애 DNA는 metric 근거를 쓰므로 공유하지 않는다.
 * LLM은 근거를 ID로만 참조하고, 아래 필드는 파이프라인이 이번 입력 레코드에서 채운다 (MASTER 17-0-4-A).
 */
interface MonthEvidence {
  type: 'message' | 'photo' | 'date';
  at: string;                    // 근거의 시각·날짜
  excerpt?: string;              // type 'message' — 원문 그대로
  attribution?: Attribution;     // type 'message'
  photoPath?: string;            // type 'photo' — 발행 시 magazine 버킷 경로로 치환된다 (Part 8)
}
```

````

(맨 끝 빈 줄 하나를 둔 뒤 원래의 `### 7-2. 생성 규칙`이 이어집니다.)

---

## 2. 쓰는 방식

- Node로 **디스크에서** 읽고 **원래 줄바꿈**으로 씁니다(이 파일은 LF로 보고됨 — 직접 확인)
- `$env:TEMP`에 스냅샷을 먼저 뜨고, 끝나면 지웁니다
- `Set-Content`·`Out-File`·`>` 금지

---

## 3. 검증

```powershell
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern "'metric'"
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern 'signals: Array<' -SimpleMatch
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern 'interface Evidence \{|interface MonthEvidence \{|cornerName'
git diff --stat
```

| 확인 | 기대 |
|---|---|
| `'metric'` 검색 | **정확히 두 줄** — ① §3 `interface Evidence`의 `type` 줄(그대로) ② §7 `signals` 바로 위의 **1-4 주석 줄**(제거 사유 기록) |
| `signals: Array<` 줄 | 한 줄. **그 줄의 `kind` 목록에 `'metric'`이 없다** — `'place' \| 'keyword' \| 'activity'` 셋뿐 |
| `interface Evidence {` | 한 줄 (§3, 그대로) |
| `interface MonthEvidence {` | 한 줄 (§7) |
| `cornerName` | **세 줄 이상** (§1·§2·§6) |
| `git diff --stat` | `docs/ONDOLOG_CORNER_CONTENT.md` 하나(+ PROGRESS) |
| diff 내용 | **아홉 곳 외 변경 없음** — 직접 읽어 확인 |
| §3 전체 | **변경 없음** |
| 줄바꿈 | 원래대로 |

**하나라도 다르면 스냅샷에서 복원하고 멈추고 보고합니다.**

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 556 · 35**를 **확인한 뒤** `PROGRESS.md` **제목 바로 아래(가장 최근이
맨 위)**에 한 줄.

---

## 4. 보고

```
- 0단계 표: {각 O/X}
- 파일 줄바꿈: {CRLF / LF}
- 아홉 교체: {#1~#9 각 O/X, 행 번호}
- 검증 표: {각 O/X}
- 게이트: {0 / 0 / 556 · 35}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- **§3(`love_dna`)의 `Evidence`를 바꾸는 것**
- "바꿀 것"의 문구를 다듬는 것, 지면 제목 문구를 정하는 것 — 디자인이 정한다
- 찾을 것이 정확히 한 번 일치하지 않는데 바꾸는 것
- 아홉 곳 외 편집, 그 밖의 `docs/` 편집
- 게이트를 돌리기 전에 결과를 기록하는 것
- `git show HEAD:`로 원본을 읽어 다시 쓰는 것, 줄바꿈 변경
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
