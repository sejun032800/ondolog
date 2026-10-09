# 메인 세션 지시 — 입력 조립 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/44-main-session-dispatch-input-assembly.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-09
>
> 짝: `44-corner-pipeline-input-assembly.md`

---

**직접 구현하지 않습니다.** 위임하고 결과를 검증합니다. `43-`(HANDOFF 정리)이 커밋된 뒤에 돌립니다.
커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r48'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r7'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '43-main-session-handoff-cleanup', '44-corner-pipeline-input-assembly'
node -e "const l=require('fs').readFileSync('.claude/state/HANDOFF.md','utf8').split(/\r?\n/).filter(s=>s.trim()!=='');console.log(JSON.stringify(l[l.length-1]))"
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r48 / ROADMAP r7 | 각 한 줄 |
| 지시서 둘 | 두 줄 |
| HANDOFF 마지막 내용 줄 | `"---"`가 **아니다** — `43-` 결과가 커밋됐다 |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 925 · 48**.

**jest worker 경고 (PM 결정)** — "A worker process has failed to exit gracefully"가 직전 실행에 이어
다시 나오면(두 번 연속) `__tests__/functions/timeOfDayLabelTimezone.test.ts`를 읽고, 테스트가 띄운
자식 프로세스가 끝까지 정리되는지(종료 대기, 타이머 해제)를 **읽기만 해서** 보고합니다. 고치지
않습니다. `--forceExit`·`--detectOpenHandles`를 명령에 넣지 않습니다.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/44-corner-pipeline-input-assembly.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 이번 범위와 범위 밖
2. 입력 계약의 원본이 어디인지

그다음 문서의 "착수 전 보고"를 하고, 멈춤 조건에 해당하면 구현하지 말고
보고에서 멈춰주세요.
```

**에이전트가 착수 전 보고에서 멈췄으면** 2단계 검증 없이 3단계 보고로 갑니다.
`git status --porcelain`에 HANDOFF·PROGRESS 외 변경이 없어야 합니다.

## 2. 검증 — 직접 확인

| PM 범위 | 확인 |
|---|---|
| 1. 조회 + 재소환 | 채팅·사진·데이트, 재소환 레코드가 각각 나오는 테스트가 있는가 |
| 2. 네 필드 | 기존 입력 레코드 타입으로 만드는가. 시간대 라벨이 기존 공용 함수 호출뿐인가 — 새 코드에 시각 경계 비교가 있는지 diff로 |
| 3. 조회 단계의 커플 분리 | 골격의 단언을 거치지 않는 테스트로 다른 커플 레코드가 빠짐을 보이는가 |
| 4. 계약 = 코드 타입 | 입력 레코드 모양을 새로 정의하지 않았는가. `docs/` 변경이 없는가 |
| 5. 기존 함수 재사용 | `isRecordInPeriod`·`periodLabelOf`를 부르는가. 새 코드에 기간 비교·기간 표기 생성이 있는지 diff로 |
| 범위 밖 | 발행 경로 항목(배치 API, 미디어 복제, 테마 복사, `skip_reason` CHECK, import map, 캐시 적중 확인, 호 전체 중단과 경보)에 손대지 않았는가 |

```powershell
git status --porcelain
git diff --stat
git diff --stat -- package.json tsconfig.json supabase/functions/tsconfig.json docs
```

- 마지막 명령은 **빈 출력**이어야 합니다
- 골격 파일(`cornerPipeline.ts` 등)이 바뀌었으면 무엇이 왜 바뀌었는지 확인해 보고합니다. 착수 전
  보고의 멈춤 조건(공개 범위 변경)을 건너뛴 것인지 봅니다
- 기존 테스트 파일이 바뀌었으면 보고합니다 — 금지 사항입니다
- 게이트: 0 / 0, jest 925 대비 감소 없음

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {} / worker 경고: {없음 / 있음 — 두 번 연속이면 읽기 결과}

## 착수 전 보고 (에이전트가 올린 그대로)
1~7: {}
- 멈춤 여부: {멈춤 — 조건 / 구현으로 진행}

## 검증 (구현했을 때)
| PM 범위 | 위치 | 확인 |
|---|---|---|

## 변경
- git diff --stat: {}
- 설정·docs 변경: {없음 / 있음}
- 골격·기존 테스트 변경: {없음 / 있음 — 내용}

## 게이트
- {}

## git status --porcelain
- {전문}

## 질문 (에이전트가 올린 그대로)
- {}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 에이전트가 멈춘 뒤 이어서 구현하게 하는 것 — PM 판단을 기다립니다
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- jest 명령에 `--forceExit`·`--detectOpenHandles`를 넣는 것
- 커밋·푸시
