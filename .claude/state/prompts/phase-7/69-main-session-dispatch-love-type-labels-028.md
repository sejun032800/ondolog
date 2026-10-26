# 메인 세션 지시 — `69-` 연애유형 라벨 데이터 · 재검사 행 구멍 (028)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/69-main-session-dispatch-love-type-labels-028.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-26
>
> 짝: `69-db-architect-love-type-labels-028.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. 새 의존성 없음. 026 · 027과 같이 두 부분입니다. Deno는 늘 `--no-lock`.

- **1부 (지금):** db-architect(조사 + 028 + 스크립트) → 검증 → 적용 전 확인(읽기 전용) → 보고. **여기서 멈춥니다.**
- **2부 (사람이 028을 적용했다고 알린 뒤, 별도 메시지로만):** 적용 확인 → 권한 확인 → 실증 판정(사람이 실행) → 타입 재생성 → 보고

**마이그레이션 적용과 원격 쓰기가 들어가는 실증 실행은 사람이 합니다**(절대 규칙 6, R42-4). 파괴적 배치 함수는 어떤 경로로도 부르지 않습니다(R34-3).

---

# 1부

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-26-r71'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-26-r44'
Get-ChildItem supabase/migrations -Name | Select-Object -Last 2
git ls-files scripts/ops/verifyPurge68.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '69-'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r71 · ROADMAP r44 | 각 한 줄 |
| 마이그레이션 마지막 2개 | 마지막이 027. **028이 이미 있으면 멈춥니다** |
| `verifyPurge68.ts` | 한 줄 — `68-`이 커밋됐다 |
| 위임 파일 | 두 줄 |
| 환경변수 셋 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1669 · 92**, Python **122**. **jest가 다르면 실패한 시험 이름과 출력 꼬리(마지막 40줄)를 남기고 한 번 다시 돌립니다**(R43-8). 다시 돌려도 다르면 위임하지 않고 보고합니다.

## 1. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/69-db-architect-love-type-labels-028.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. §0 조사 a~c를 먼저, 결과를 보고 첫머리에 — 문제가 된 곳은 보고만
2. 라벨 36행은 MASTER 10-5-2와 글자 단위 대조, 칸이 안 맞으면 멈춤
3. 원격에는 읽기 전용 조회만 — 적용·실증 실행 없음
4. 실증의 끊긴 상태 준비만 service_role, 복구 호출은 사용자 세션

끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- docs src app render supabase/functions src/types/database.ts package.json package-lock.json app.json eas.json babel.config.js
$ref = (Get-Content supabase/.temp/project-ref -Raw).Trim(); (Get-ChildItem scripts, supabase/migrations, src, app -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]scripts[\\/]ops[\\/]out[\\/]' } | Select-String -SimpleMatch -Pattern $ref | Measure-Object).Count
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 다섯째 명령은 **빈 출력**이어야 합니다(이번 범위는 마이그레이션 · 시드 · 스크립트뿐)
- 넷째: 출력이 **`0`**이어야 합니다(R41-6 — 무시 대상 `scripts/ops/out`은 뺐습니다)

| 확인 | 기대 |
|---|---|
| 조사 a~c | 결과가 파일 · 줄로. b는 읽는 곳마다 "표가 비었을 때 무엇이 됐나" |
| 028 | 36행 · MASTER 대조 불일치 0 · 엘리전 규칙 · `on conflict (code) do update` · `personality_assessments` INSERT `with check (seq = 1)` · **그 밖의 정책 · 027 함수 · 배치 · cron 변경 없음** |
| 시드 | 0-a가 시드였다면 ③의 결정(대조 시험 / 시드에서 빼기) |
| 로컬 적용 | 001~028 적용 · 36행 · `seq = 2` 사용자 INSERT 거부 · `seq = 1` 통과 |
| 스크립트 | 028 실증(①~④) · 보안 점검 비교가 **경고 이름 + 대상 이름 기준**인지 · 사용자 세션 기본(끊긴 상태 준비만 `service_role`) · 키 · 토큰 · URL · ref 출력 0. **실행되지 않았는가** |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 전부 통과 — **메인 세션이 직접 다시 돌립니다** |

## 3. 적용 전 확인 — 원격, 읽기 전용

db-architect가 쓴 적용 전 확인 SQL을 **읽기 전용으로** 돌립니다. 배치 · cron 지문을 보고에 적습니다.

## 4. 1부 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / jest 다시 돌림: {없음 / 실패 시험 이름·꼬리}

## 조사 (§0)
- a 라벨 데이터 위치: {}
- b 읽는 곳과 표가 비었을 때: {곳마다 한 줄}
- c 빈 라벨로 렌더된 시험 호: {없음 / 목록}

## db-architect
- 보안 점검 기준선: {파일 / 요약}
- 028: {경로 / MASTER 대조 결과 / 시드 처리 결정} (전문은 파일로)
- 로컬 적용: {명령 / 결과}
- 타입 재생성에서 바뀔 것: {기대 0 / 다르면 이유}
- 사람이 쓸 적용 명령: {}
- 적용 전 확인 결과: {지문 포함}

## 2부에서 사람이 돌릴 명령 (한 줄씩, 키 값 없이, 끊지 않음)
- 028 실증: {}
- 보안 점검 비교: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키·ref 누출 확인: {}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 명령은 한 줄을 끊지 말고 코드 블록에 넣습니다. **여기서 멈춥니다.**

---

# 2부 — 사람이 "028을 원격 개발에 적용했다"고 알린 뒤에만

## 5. 적용 확인

원격 migration 기록에 028이 있는지 확인합니다(읽기 전용). 없으면 멈춥니다.

## 6. 권한 확인

권한 확인 SQL을 **읽기 전용으로** 돌려 출력 원문을 보존합니다. 지문이 적용 전과 다르거나, `personality_assessments` INSERT 정책 외의 정책 · 권한이 바뀌었으면 7 이후로 가지 않고 보고합니다.

## 7. 실증 판정 — 사람이 실행

1부 보고의 명령을 사람이 PowerShell에서 돌립니다. 메인 세션은 실행하지 않습니다. 사람이 "실행했다"고 알리면 `scripts/ops/out/`의 출력 파일로 판정합니다.
- ① 라벨 36행 · MASTER 대조 불일치 0
- ② ⑱ 재검사 복구: `out_recovered = true` · 기존 `seq 2` 값으로 끝남 · `love_type_code` · `profiles.mbti`
- ③ 사용자 `seq = 2` INSERT 거부 · `seq = 1` 가입 통과
- ④ 보안 점검: 027 뒤 기준선 대비 028 뒤 변화 0 — **고친 비교 스크립트의 판정으로**
- 스크립트 결함이면 db-architect에게 스크립트만 고치게 하고, **실행은 다시 사람에게** 맡깁니다

## 8. 타입 재생성

SCHEMA §9-D-10 그대로(기존 명령). **변화 0**이 기대값입니다. 바뀌면 멈춥니다(메타데이터는 적기만, R31-3). 바뀐 것이 없으면 파일에 쓰지 않습니다.

## 9. 2부 보고

```
## 적용 확인
- 028: {있음 / 없음}

## 권한 확인 (출력 그대로)
- {지문 포함}

## 028 실증 (출력 파일 기준)
- ① 라벨: {} / ② ⑱ 복구: {} / ③ seq 2 거부·seq 1 통과: {} / ④ 보안 점검 비교: {}

## 타입 재생성
- {변화 없음 / 있음 — 멈춤}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- **마이그레이션 적용**(사람이 한다), 1부에서 원격에 쓰기, **원격 쓰기가 들어가는 실증을 메인 세션이 실행하는 것**
- 파괴적 배치 함수 호출
- 사람의 적용 알림 전에 2부를 시작하는 것
- 키 · 토큰 · 서명 URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
