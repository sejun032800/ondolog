# 메인 세션 지시 — `70-` 마이그레이션 전수 확인 · 029

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/70-main-session-dispatch-migration-audit-029.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-27
>
> 짝: `70-db-architect-migration-audit-029.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 새 의존성 없음. 028과 같이 두 부분입니다. Deno는 늘 `--no-lock`.

- **1부 (지금):** db-architect(전수 확인 + 029 + 스크립트) → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 029를 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 실증 판정(사람이 실행) → 보안 점검 비교(메인 세션) → 타입 재생성 → 보고

**마이그레이션 적용과 원격 쓰기는 사람이 합니다**(절대 규칙 6, R42-4). 원격 확인은 **읽기 전용 SQL · CLI**로 합니다(R45-1 — MCP `list_migrations` 같은 도구는 쓰지 않습니다). 파괴적 배치 함수는 어떤 경로로도 부르지 않습니다(R34-3).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-27-r45'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '## 9-H. 마이그레이션 파일 불변'
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files scripts/ops/verifyLabels69.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '70-'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력. **비어 있지 않으면** 그 상태 그대로 게이트를 한 번 돌려 기록하고, 무엇이 남아 있는지 보고에 적은 뒤 진행 여부를 판단합니다 |
| ROADMAP r45 · SCHEMA §9-H | 각 한 줄 |
| 마이그레이션 마지막 2개 | 마지막이 028. **029가 이미 있으면 멈춥니다** |
| `verifyLabels69.ts` | 한 줄 — `69-`가 커밋됐다 |
| 위임 파일 | 두 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1681 · 94**, Python **122**. **jest는 출력 전체를 `scripts/ops/out/70-jest-pre.txt`에 남깁니다.** 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8). 다시 돌려도 다르면 위임하지 않고 보고합니다.

## 1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/70-db-architect-migration-audit-029.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. §0 전수 확인은 전부 읽기 전용 — 원격에 쓰지 않음
2. 어긋남이 보안(정책·권한·definer 함수·트리거) 쪽이면 029를 쓰기 전에 멈춤
3. 001~028 파일은 하나도 고치지 않음(R45-2)
4. 사람이 돌릴 명령은 scripts/ops/out/70-run.ps1 에 — 실행하지 않음

끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

**db-architect가 멈췄으면 그 지점에서 보고합니다.**

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- docs src app render supabase/functions src/types/database.ts package.json package-lock.json app.json eas.json babel.config.js
git diff --stat HEAD -- supabase/migrations
$ref = (Get-Content supabase/.temp/project-ref -Raw).Trim(); (Get-ChildItem scripts, supabase/migrations, src, app -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]scripts[\\/]ops[\\/]out[\\/]' } | Select-String -SimpleMatch -Pattern $ref | Measure-Object).Count
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 여섯째 명령은 **빈 출력**이어야 합니다
- 넷째: **빈 출력**이어야 합니다 — 적용된 001~028이 하나도 바뀌지 않았다(R45-2). 새 029는 `??`로만 보입니다
- 다섯째: **`0`**이어야 합니다(R41-6)

| 확인 | 기대 |
|---|---|
| 전수 확인 표 | 001~028 **전부**가 표에 있는가. 적용 시각 · 뒤에 바뀐 커밋 · 원격 상태 · 분류. 016 · 020 포함. a-보조(적용 당시 SQL) 사용 여부 |
| 멈춤 | 보안 어긋남이 있었다면 029를 쓰지 않고 멈췄는가 |
| 029 | `description_ko` 36행 MASTER 대조 · 멱등 · 보안 외 어긋남만 · 파일별 주석 · **정책 · 권한 · 함수 · 배치 · cron 변경 없음** |
| `verifyDissolution68.ts` | 머리 주석 한 줄만 바뀌었는가 |
| 로컬 적용 | 001~029 · 36행 · 다시 적용해도 같음 |
| 스크립트 | 029 실증 · `70-run.ps1` · 키 · 토큰 · URL · ref 출력 0. **실행되지 않았는가** |
| 게이트 | tsc 0 / 0, jest 전부 통과(출력 전체를 `scripts/ops/out/70-jest.txt`에), Python 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 적용 전 확인 — 원격, 읽기 전용

db-architect가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다. 지문을 보고에 적습니다.

## 4. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / jest 다시 돌림: {없음 / 실패 시험 이름·꼬리}

## 전수 확인 (§0)
- 방법: {git 시각 비교 / 적용 당시 SQL 비교 — 칸 있음·없음}
- 결과 표: {파일마다 한 줄 — 적용 시각 · 뒤에 바뀐 커밋 · 바뀐 것 · 원격 상태 · 분류 · 029 여부}
- 시드 확인: {}
- 멈춤: {없음 / 있음 — 보안 어긋남 목록}

## 029 (멈추지 않았으면)
- 경로: {} (전문은 파일로)
- description_ko MASTER 대조: {}
- 함께 넣은 어긋남: {}
- 로컬 적용: {명령 / 결과}
- 타입 재생성에서 바뀔 것: {기대 0}
- 사람이 쓸 적용 명령: {}
- 적용 전 확인 결과: {지문 포함}

## 2부에서 사람이 돌릴 명령
- scripts/ops/out/70-run.ps1 전문: {코드 블록}

## 변경
- git diff --stat: {}
- 적용된 마이그레이션 diff: {빈 출력 O / X}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키·ref 누출 확인: {}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로, 출력 전체는 70-jest.txt):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다. **여기서 멈춥니다.**

---

# 2부 — 사람이 "029를 원격 개발에 적용했다"고 알린 뒤에만

## 5. 적용 확인

원격 migration 기록에 029가 있는지 읽기 전용 SQL로 확인합니다. 없으면 멈춥니다.

## 6. 권한 확인

권한 확인 SQL을 **읽기 전용으로** 돌려 출력 원문을 보존합니다. 지문이 적용 전과 다르거나 정책 · 권한이 바뀌었으면 7 이후로 가지 않고 보고합니다.

## 7. 실증 판정 — 사람이 실행

사람이 `scripts/ops/out/70-run.ps1`을 PowerShell에서 돌립니다. 메인 세션은 실행하지 않습니다. 사람이 "실행했다"고 알리면 출력 파일로 판정합니다.
- ① `description_ko` 36행 · MASTER 대조 불일치 0
- ② §0의 각 어긋남이 029 뒤 일치
- ③ 보안 점검 — 029 뒤 원문을 `scripts/ops/out/70-security-after.json`으로 **메인 세션이 저장**하고(읽기 전용), `compareSecurity.ts`를 **메인 세션이 직접** 돌려 69- 뒤 기준선 대비 변화 0을 판정합니다(로컬 비교, 원격에 쓰지 않음)
- 스크립트 결함이면 db-architect에게 스크립트만 고치게 하고, **실행은 다시 사람에게** 맡깁니다

## 8. 타입 재생성

SCHEMA §9-D-10 그대로(기존 명령). **변화 0**이 기대값입니다. 바뀌면 멈춥니다(메타데이터는 적기만, R31-3). 바뀐 것이 없으면 파일에 쓰지 않습니다.

## 9. 2부 보고

```
## 적용 확인
- 029: {있음 / 없음}

## 권한 확인 (출력 그대로)
- {지문 포함}

## 029 실증 (출력 파일 기준)
- ① description_ko: {} / ② 어긋남 일치: {} / ③ 보안 점검 비교: {}

## 타입 재생성
- {변화 없음 / 있음 — 멈춤}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로, 출력 전체는 파일로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기
- 파괴적 배치 함수 호출
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키 · 토큰 · 서명 URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
