# 메인 세션 작업 — `#15` 마무리 정리

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/27-main-session-strip-close.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-02

---

**위임이 아니라 메인 세션이 직접 수행합니다. 커밋은 하지 않습니다**
(절대 규칙 6, 예외 없음). **실행 코드와 assertion은 건드리지 않습니다.**

## 0. 시작 상태

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-09-26-r35'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-09-28-r3'
Select-String -Path scripts/generate-norm.ts -Pattern 'Remove-Item -Recurse'
Select-String -Path scripts/norm/enumerate.ts -Pattern "export const NORM_VERSION"
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **빈 출력** |
| MASTER 리비전 | 한 줄 |
| ROADMAP 리비전 | 한 줄 |
| `generate-norm.ts`의 `Remove-Item` | 한 줄 이상 — `26-r2`가 커밋됐다는 사실 |
| `NORM_VERSION` 정의 | 한 줄 — ②가 가리킬 원본이 있다는 사실 |

하나라도 다르면 멈추고 보고하세요.

---

## 1. 주석 둘

### ① `__tests__/engine/cornerPipelineStaticRules.test.ts`의 헤더 한 줄

"…용 유틸 (이 파일 로컬 — 기존 스위트의 복제본과 통합하지 않는다)"는 지금
코드와 반대입니다. **그 한 줄만** 공용 유틸(`scripts/lib/stripComments.ts`)을
가져다 쓴다는 사실에 맞게 고칩니다.

### ② `scripts/generate-norm.ts` 상단 docblock의 버전 값

`synthetic-v2`라고 적혀 있지만 실제는 다릅니다. **v3로 고치지 마세요** —
다음 재열거 때 같은 방식으로 또 낡습니다. **값을 지우고 원본을 가리킵니다.**
해당 문장을 이렇게 바꿉니다.

```
산출 파일명은 `scripts/norm/enumerate.ts`의 `NORM_VERSION`을 따른다.
```

그 문장 외의 docblock은 건드리지 않습니다.

---

## 2. PROGRESS 한 줄 이동

`#15` 기록 한 줄이 `# 진행 상황` 제목 **위**에 있습니다. **제목 바로 아래,
기존 갱신 문단 위**로 옮깁니다. 내용은 바이트 그대로 둡니다.

이동 후, 그 바로 아래(기존 갱신 문단 위)에 **이번 작업 한 줄**을 기록합니다.

---

## 3. `#15` 섹션 재판정 — 기준 B

①이 끝나면 HANDOFF `#15` 섹션 39행 "남은 불일치"의 마지막 열린 항목이
닫힙니다. **섹션 안의 내용을 다시 하나씩** 원본과 대조합니다.

| 내용 | 원본 |
|---|---|
| 공용 유틸 위치·`preserveLines` | 코드 (`scripts/lib/stripComments.ts`) |
| 556 · 35 | ROADMAP §1 (r3) |
| 합성 입력 테스트 | 코드 (`__tests__/scripts/stripComments.test.ts`) |
| 복제본 목록·경과 | 이력 |
| "남은 불일치" 네 항목 | **전부 고쳐졌는지 파일로 확인** |

- **전부 원본이 있거나 이력이면** 섹션을 통째로
  `.claude/state/archive/handoff-20261001.md` **끝에** 옮깁니다
  (같은 날 만든 아카이브. 기존 내용은 바이트 그대로 둡니다)
- **아직 원본이 없는 내용이 있으면** 옮기지 말고 보고합니다

---

## 4. 쓰는 방식과 검증

- Node로 **디스크에서** 읽고 **각 파일의 원래 줄바꿈**으로 씁니다.
  `$env:TEMP`에 스냅샷을 먼저 뜨고 끝나면 지웁니다
- `Set-Content`·`Out-File`·`>` 금지

| 확인 | 기대 |
|---|---|
| 테스트 파일 diff | **주석 한 줄만** |
| `generate-norm.ts` diff | **docblock 한 문장만** |
| PROGRESS | `#15` 줄이 **제목 아래로 이동**(바이트 동일) + **추가 한 줄** |
| HANDOFF | 사라진 것이 `#15` 섹션뿐 (옮겼다면) |
| 아카이브 | 기존 내용 **바이트 동일** + 끝에 `#15` 섹션 바이트 동일 |
| 맨 LF | CRLF 파일들 **0** |

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**0 / 0 / 556 · 35.** 실패하면 스냅샷에서 복원하고 멈추고 보고합니다.

---

## 5. 보고

```
- 0단계 표: {각 O/X}
- ① 헤더 변경 전/후: {그대로}
- ② docblock 문장 변경 전/후: {그대로}
- PROGRESS: 이동 {O/X} / 추가 한 줄 {O/X}
- #15 섹션 재판정: {아카이브로 / 남김 — 원본 없는 내용}
- "남은 불일치" 네 항목 파일 확인: {각 O/X}
- 검증 표: {각 O/X}
- 게이트: {0 / 0 / 556 · 35}
- git status --porcelain: {전문}
- 판단이 필요한 지점: {있으면}
```

## 하지 말 것

- 커밋·푸시
- 실행 코드·assertion 변경
- `generate-norm.ts` docblock에 버전 값을 적는 것 — 가리키기만 한다
- **`scripts/norm/enumerate.ts`의 docblock 수정** — 범위 밖. 보고만
- 지정된 한 줄·한 문장 외 주석 수정
- 기준 B 대조 없이 섹션을 옮기는 것
- 아카이브의 기존 내용을 바꾸는 것
- `git show HEAD:`로 원본을 읽어 다시 쓰는 것, 줄바꿈 변경
- 전제가 없을 때 대체물을 찾아 나서는 것, `$env:TEMP` 외 저장소 밖 경로를 읽는 것
