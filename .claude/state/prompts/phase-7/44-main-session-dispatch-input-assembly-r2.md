# 메인 세션 지시 — 입력 조립 위임 (r2)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/44-main-session-dispatch-input-assembly-r2.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-09
>
> 짝: `44-corner-pipeline-input-assembly-r2.md`

---

**직접 구현하지 않습니다.** 위임하고 결과를 검증합니다. 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r49'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r8'
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern '#### 17-0-9'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern 'input-assembly-r2'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r49 / ROADMAP r8 | 각 한 줄 |
| §17-0-9 제목 | 한 줄 |
| r2 지시서 | 두 줄 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 925 · 48**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/44-corner-pipeline-input-assembly-r2.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 세 가지를 먼저 확인해주세요.
1. 이번 범위와 범위 밖
2. 채우는 규칙의 원본이 어디인지
3. 이번에 바꿀 수 있는 기존 파일이 무엇인지

확인 후 기간 내 조회 → 재소환 순서로 끝까지 진행해주세요.
MASTER §17-0-9에 없는 값이 필요하면 그 부분에서만 멈추고 보고해주세요.
```

## 2. 검증 — 직접 확인

### 2-1. 변경 범위

```powershell
git status --porcelain
git diff --stat
git diff --stat -- package.json tsconfig.json supabase/functions/tsconfig.json docs src/types/corners
```

- 마지막 명령은 **빈 출력**이어야 합니다
- 바뀐 기존 파일은 아래 셋과 HANDOFF·PROGRESS뿐이어야 합니다. 그 밖의 기존 파일이 바뀌었으면 무엇이 왜 바뀌었는지 보고합니다
  - `supabase/functions/_shared/corners/cornerCommon.ts`
  - `__tests__/functions/timeOfDayLabelTimezone.test.ts` — `git diff`를 읽어 **기존 케이스가 지워지거나 바뀌지 않았는지** 확인
  - (새 파일) `_shared/` 바로 아래의 입력 조립 모듈, 시각 변환 모듈 **하나**, 새 테스트
- 새 모듈이 `_shared/corners/` 안에 있으면 범위 이탈입니다(규칙 G)

### 2-2. 완료 기준

| 항목 | 확인 |
|---|---|
| 범위 1. 조회 | 채팅·사진·데이트 각각의 테스트가 있는가 |
| 범위 1. 재소환 | §17-0-9-C의 건수·후보 네 조건·우선순위와 `recallReason`·기준 시각(기간 시작)을 각각 시험하는가. 결정론 시험이 있는가 |
| 범위 2. 네 필드 | 기존 입력 레코드 타입으로 만드는가. 시간대 라벨이 `timeOfDayLabel` 호출뿐인가. 시각 변환이 새 모듈 하나에 모였는가. 사유별 제외 건수를 반환하는가 |
| 범위 3. 커플 분리 | 쿼리마다 세 조건을 거는가. 결과 재확인이 **기존 `CoupleMembershipError`**를 던지는가. 두 커플을 섞은 가짜 클라이언트 시험이 골격 단언을 거치지 않는가 |
| 잠긴 데이터 | 이번 기간·재소환 모두에서 빠지는 시험이 있는가 |
| 범위 4. 계약 | `cornerCommon.ts` 머리 주석이 바뀌었는가. 레코드 모양이 다른 곳에 새로 정의되지 않았는가 |
| 범위 5. 기존 함수 | 기간 판정이 `isRecordInPeriod`인가. 쿼리 범위가 기간보다 좁지 않음을 보이는 경계 레코드 시험이 있는가. 기간 판정·기간 라벨·시간대 라벨 규칙을 새로 짠 코드가 없는가 |
| 쓰기 없음 | 입력 조립 코드에 `last_featured_at`·`feature_count` 쓰기, `insert`·`update`·`upsert`·`delete` 호출이 없는가 |
| 게이트 | 0 / 0, jest 925 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 범위 확인 (에이전트 착수 전 답)
- {}

## 변경
- git diff --stat: {}
- 설정·docs·src/types/corners 변경: {없음 / 있음}
- 바뀐 기존 파일: {목록과 이유}
- 시간대 테스트: 기존 케이스 {그대로 / 바뀜 — 내용}

## 검증
| 항목 | 위치 | 확인 |
|---|---|---|

## 멈춘 부분 (있으면)
- {부분 — 필요한 값}

## 게이트
- {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 에이전트가 멈춘 부분을 이어서 구현하게 하는 것 — PM 판단을 기다립니다
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
