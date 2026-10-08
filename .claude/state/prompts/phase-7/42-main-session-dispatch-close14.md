# 메인 세션 지시 — `#14` 마무리

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/42-main-session-dispatch-close14.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-08
>
> 짝: `42-corner-pipeline-close14.md`

---

두 부분입니다. **A는 위임, B는 당신이 직접.** B는 A의 검증이 끝난 뒤에 합니다.
커밋은 하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 시작하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-07-r47'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-07-r6'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '42-corner-pipeline-close14'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r47 / ROADMAP r6 | 각 한 줄 |
| 위임 파일 | 한 줄 |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 921 · 48**.

---

## A. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/42-corner-pipeline-close14.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.
```

### A 검증 — 직접 확인

| PM 항목 | 확인 |
|---|---|
| 규칙 F 수집 | 디렉터리 목록이 없어졌는가. 최상위 파일이 수집에 들어가는 테스트가 있는가. 대체 수집에서 `node_modules/`·`.git/`을 빼는가 |
| 빈 텍스트 응답 | 에이전트가 보고한 **원래 사유**. 지금 `schema_invalid`로 기록되는지 테스트로 확인되는가 |
| 게이트 | 0 / 0, jest 921 대비 감소 없음 |

---

## B. HANDOFF의 `#14` 정리 — 직접 (PM 결정: `#14` 종결)

인수인계서 4-2 "열린 항목" 규칙대로입니다 — **닫힌 행은 아카이브로**, 상세 섹션은
**기준 B로 판정한 뒤** 옮깁니다.

### B-1. 대상 찾기

- "열린 항목" 표의 **`#14` 행**
- 제목에 **`#14`**가 들어간 섹션 전부 (1부 설계 보고부터 이번 A까지)

목록을 보고에 적습니다.

### B-2. 섹션마다 기준 B

**닫혔다는 건 아카이브 후보라는 뜻이지 판정을 건너뛰어도 된다는 뜻이 아닙니다.**
섹션 안의 내용마다 다른 곳에 원본이 있는지(코드, MASTER, ROADMAP r6, 아카이브)
확인합니다.

- 전부 원본이 있거나 이력이면 **통째로** 아카이브로
- 원본이 없는 내용이 있으면 **옮기지 않고** 그 내용을 보고

### B-3. 옮기기

- 옮길 곳: `.claude/state/archive/handoff-20261008.md` (새 파일)
- 첫 줄: `# HANDOFF 아카이브 — 2026-10-08. #14 종결분, 원본 순서 그대로 옮겼다.`
- 그 아래 `#14` 행(표 머리 포함)과 옮기는 섹션들, **원래 순서·바이트 그대로**
- Node로 디스크에서 읽고 씁니다

### B-4. 손실 없음 확인

**줄바꿈을 LF로 맞춘 뒤** 비교합니다(인수인계서 5-2).

- HANDOFF에서 사라진 것이 **옮긴 행과 섹션뿐**이다
- 그것들이 아카이브에 **바이트 그대로**(LF 정규화 후) 있다
- 실패하면 되돌리고 멈추고 보고합니다

---

## C. 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

확인한 뒤 `PROGRESS.md` 제목 바로 아래에 한 줄.

## 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## A
| PM 항목 | 위치 | 확인 |
|---|---|---|
- 빈 텍스트 응답의 원래 사유: {}
- 고친 assertion과 이유: {}

## B
- 대상: `#14` 행 + 섹션 {목록}
- 섹션별 기준 B: {옮김 / 남김 — 원본 없는 내용}
- 손실 없음: {O/X}

## 게이트
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- A를 직접 구현하는 것
- B에서 기준 B 대조 없이 섹션을 옮기는 것, 섹션 안을 잘라내거나 재작성하는 것
- 게이트 전에 기록하는 것
- 커밋·푸시
