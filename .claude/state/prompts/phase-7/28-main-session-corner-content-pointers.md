# 메인 세션 작업 — `CORNER_CONTENT.md` 파이프라인 서술을 MASTER 포인터로

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/28-main-session-corner-content-pointers.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-04

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음).

## 왜 하는가

`docs/ONDOLOG_CORNER_CONTENT.md`는 MASTER 17-0(코너 파이프라인 규격)보다
**먼저 쓰인 문서**입니다. **코너별 저장 스키마(§2~§7)의 원본**으로는 그대로
유효하지만, **파이프라인 동작에 관한 서술**이 MASTER와 어긋납니다(r36 확정).
그 서술을 **MASTER를 가리키는 포인터로** 바꿉니다.

**스키마 필드(§2~§7의 구조 정의)는 건드리지 않습니다.**

---

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-04-r36'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-09-28-r3'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '^#### 17-0-0\.|^#### 17-0-4-A\.|^#### 17-0-5-D\.|^#### 17-0-5-E\.'
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern 'src/engine/corners|최대 3회 재시도|no_warm_messages|messages.body`와 대조해'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER 리비전 | 한 줄 |
| ROADMAP 리비전 | 한 줄 |
| MASTER 포인터 대상 넷 | **네 줄** — 가리킬 절이 있다 |
| CORNER_CONTENT 낡은 서술 | **한 줄 이상** — 고칠 대상이 있다 |

하나라도 다르면 멈추고 보고하세요.

---

## 1. 교체 — 다섯 곳

**아래 "찾을 것"이 정확히 일치할 때만** 바꿉니다. 일치하지 않으면 바꾸지 말고
멈추고 보고하세요. **"바꿀 것"의 문구는 바꾸지 마세요.**

### 1-1. §0-2의 배치 위치 한 줄

찾을 것 — 다음으로 **시작하는 줄 하나**:

```
배치 위치: `src/types/corners/*.ts`
```

바꿀 것 (줄 전체):

```
배치 위치: `docs/ONDOLOG_MASTER.md` §17-0-0을 따른다 — 코너 생성은 Edge Function이며 코드는 `supabase/functions/` 아래에 있다.
```

### 1-2. §9 전체 (`## 9. 파일 배치`부터 `## 10. 남은 결정` 바로 앞까지)

`### 9-1. 공통 생성 파이프라인 계약`과 그 아래 코드 블록·주의 문단까지 **모두**
포함하는 범위입니다. 그 범위 전체를 아래로 바꿉니다. 끝의 `---` 구분선과
`## 10.`은 그대로 둡니다.

바꿀 것:

```markdown
## 9. 파일 배치와 파이프라인

**이 절의 원본은 `docs/ONDOLOG_MASTER.md` §17-0이다.** 이 문서는 코너별
**저장 스키마(§2~§7)**의 원본이고, 배치와 파이프라인 동작은 다시 적지 않는다.

| 주제 | 원본 |
|---|---|
| 실행 주체·코드 위치 | §17-0-0 (모듈 경로 계약은 정적 규칙의 `MODULE` 상수, §17-0-3) |
| 검사 순서 | §17-0-4 |
| 원문은 LLM이 쓰지 않는다 (ID 참조 → 파이프라인이 채움) | §17-0-4-A |
| 실패 사유 · 재시도 | §17-0-5 · §17-0-5-A |
| 재료 부족의 두 시점 | §17-0-5-D |
| 입력 조립 · 미디어 복제의 위치 | §17-0-5-E (미디어 복제 원칙은 Part 8) |
```

### 1-3. §6-2 "스킵 우선" 행

찾을 것 — 다음으로 **시작하는 행 하나**:

```
| **스킵 우선** |
```

바꿀 것 (행 전체):

```
| **스킵 우선** | 다정한 발화가 없으면 억지로 생성하지 않는다. 기록 방식은 `docs/ONDOLOG_MASTER.md` §17-0-5-D |
```

### 1-4. §6-2 아래 "검증" 문단

찾을 것 — 다음으로 **시작하는 줄 하나**:

```
**검증**: 저장 전 `turns[].text`를 원본
```

바꿀 것 (줄 전체):

```
**원문 보장**: `turns[].text`는 LLM이 쓰지 않고 파이프라인이 원본에서 채운다 — `docs/ONDOLOG_MASTER.md` §17-0-4-A.
```

### 1-5. 건드리지 않는 것

- §6-2의 **"원문 불변"** 행 — 저장 스키마의 불변 조건으로 여전히 참입니다
- §0-1의 미디어 복제 행, §1-1의 "발행 시 magazine 버킷으로 복제된 경로" 주석 —
  MASTER Part 8과 일치합니다
- 그 밖의 모든 줄

---

## 2. 쓰는 방식

- Node로 **디스크에서** 읽고 **원래 줄바꿈**으로 씁니다. 쓰기 전에 파일의
  줄바꿈(CRLF/LF)을 확인하세요
- 새로 넣는 텍스트도 **그 파일의 줄바꿈**으로
- `$env:TEMP`에 스냅샷을 먼저 뜨고, 끝나면 지웁니다
- `Set-Content`·`Out-File`·`>` 금지

---

## 3. 검증

```powershell
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern 'src/engine/corners|src/types/corners|최대 3회 재시도|no_warm_messages|messages.body`와 대조해'
Select-String -Path docs/ONDOLOG_CORNER_CONTENT.md -Pattern '§17-0-0|§17-0-4-A|§17-0-5-D|§17-0-5-E'
git diff --stat
```

| 확인 | 기대 |
|---|---|
| 낡은 서술 검색 | **빈 출력** |
| 포인터 검색 | **네 절이 모두** 한 번 이상 나온다 |
| `git diff --stat` | **`docs/ONDOLOG_CORNER_CONTENT.md` 하나**(+ PROGRESS) |
| diff 내용 | 다섯 곳 외 변경 **없음** — 직접 읽어 확인 |
| §2~§7 스키마 | **변경 없음** |
| 줄바꿈 | 원래대로 (CRLF 파일이면 맨 LF 0) |

**하나라도 다르면 스냅샷에서 복원하고 멈추고 보고합니다.**

### 게이트 → 기록

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 556 · 35**를 **확인한 뒤에** `PROGRESS.md`의 **제목 바로 아래(가장
최근 기록이 맨 위)**에 이번 작업 한 줄을 적습니다.

---

## 4. 보고

```
- 0단계 표: {각 O/X}
- 파일 줄바꿈: {CRLF / LF}
- 다섯 교체: 1-1 {O/X} / 1-2 {O/X} / 1-3 {O/X} / 1-4 {O/X} / 1-5 무변경 {O/X}
- 1-2 교체 범위: {시작 행 ~ 끝 행}
- 검증 표: {각 O/X}
- 게이트: {0 / 0 / 556 · 35}
- PROGRESS 기록 위치: {제목 바로 아래 O/X}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- **§2~§7 스키마 정의를 바꾸는 것**
- "바꿀 것"의 문구를 다듬는 것
- 찾을 것이 정확히 일치하지 않는데 바꾸는 것
- 지정된 다섯 곳 외 편집, 그 밖의 `docs/` 편집
- **`.claude/agents/` 파일 편집** — 이번 범위 밖
- 게이트를 돌리기 전에 결과를 기록하는 것
- `git show HEAD:`로 원본을 읽어 다시 쓰는 것, 줄바꿈 변경
- `Set-Content`·`Out-File`·`>` 리다이렉트
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
