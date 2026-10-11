# 메인 세션 지시 — 발행 경로 코드 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/48-main-session-dispatch-publish-path-code.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-11
>
> 짝: `48-corner-pipeline-publish-path-code.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 원격 DB에는 접속하지 않습니다. 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-11-r56'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-11-r12'
Select-String -Path docs/ONDOLOG_SCHEMA.md  -Pattern '022_publish_path.sql .*적용됨'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '48-corner-pipeline-publish-path-code'
docker version
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r56 / ROADMAP r12 | 각 한 줄 |
| SCHEMA 022 적용 표시 | 한 줄 |
| 위임 파일 | 한 줄 |
| `docker version` | **Server** 부분까지 나온다 — Docker Desktop이 설치돼 있고 실행 중이다 |

**`docker version`이 Server를 보여 주지 않으면 위임하지 않고 멈춥니다.** Docker Desktop 설치는 사람
작업입니다(Windows는 WSL2 필요). **설치가 막혀도 브랜치 등 다른 방법으로 넘어가지 않고 보고합니다**
(PM 결정).

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/48-corner-pipeline-publish-path-code.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 이번 범위와 범위 밖
2. 멈춤 조건
3. 로컬 스택에서 하면 안 되는 것

그다음 문서의 "착수 전 보고"를 하고 진행해주세요. MASTER §17-0-10·SCHEMA §9-D에
없는 값이 필요하면 그 부분에서만 멈추고 보고해주세요.
```

## 2. 검증

### 2-1. 변경 범위

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations docs src/types package.json tsconfig.json supabase/functions/tsconfig.json
```

- 마지막 명령은 **빈 출력**이어야 합니다
- 바뀐 기존 파일이 에이전트의 착수 전 보고 목록과 같은지 대조합니다. 목록 밖 변경은 보고합니다
- `supabase/.temp/` 등 CLI가 바꾼 추적 파일이 남아 있으면 되돌리고 보고합니다

### 2-2. 원격 안전

- 에이전트가 쓴 명령에 `--linked`·`--db-url`·`db push`가 **없는지** 보고에서 확인합니다
- 실제 LLM API를 부르는 코드가 시험에서 실행되지 않는지(가짜 전송) 확인합니다

### 2-3. 완료 기준

| 범위 | 확인 |
|---|---|
| 경로 함수 | `_shared/`에 하나인가. 입력 조립과 P7이 같은 함수를 부르는가. **다른 곳에서 목적지 경로 문자열을 조립하는 코드가 없는가** |
| P3 | §9-D-3 조건부 UPDATE를 쓰고, 돌려받은 코너만 제출하는가 |
| 배치 | 제출·폴링이 `llmClient.ts` 안에 있는가. `custom_id`로 짝짓는가 |
| 설정 | 모델·캐시 설정을 `coeffLookup.ts`로 읽는가. `tbd`면 생성하지 않는 시험이 있는가 |
| 소속 단언 실패 | 그 호 전체 중단 + `ops_alerts` 기록이 시험되는가 |
| 로컬 C | 정상 발행, 예외들, **동시 발행 번호 1·2** 결과가 있는가. 스크립트와 결과가 저장소에 있는가 |
| 테마 트리거 | 초안 theme가 커플 값과 **달랐다가** 발행 시 커플 값이 되는가. 발행 후 변경은 예외인가 |
| `functions serve` | 기동 확인 결과가 있는가 |
| 게이트 | 0 / 0, jest 986 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / docker: {} / 기준선: {}

## 착수 전 보고 (에이전트가 올린 그대로)
1~5: {}

## 변경
- git diff --stat: {}
- 보호 경로 변경: {없음 / 있음}
- 착수 전 목록 밖 변경: {없음 / 있음 — 내용}
- CLI가 바꾼 추적 파일: {없음 / 되돌림 — 파일}

## 검증
| 범위 | 위치 | 확인 |
|---|---|---|

## 로컬 실증
- C: 정상 {} / 예외 {} / 동시 발행 번호 {}
- 테마 트리거: {}
- functions serve: {}

## 멈춘 부분 / 사람 작업으로 남긴 것
- {}

## 게이트
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- Docker가 없을 때 다른 방법으로 넘어가는 것
- 원격 DB 접속·쓰기, `db push`
- 에이전트가 멈춘 부분을 이어서 구현하게 하는 것 — PM 판단을 기다립니다
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
