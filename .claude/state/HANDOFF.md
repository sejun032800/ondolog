# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료 항목은 `.claude/state/archive/`로 옮긴다** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지 않았다.
> 프롬프트 #13도 상태 파일 기록 삭제·이동·재편을 금지해 유지한다.
> `#13-r4`(브랜드 생성자 이전)도 같은 이유로 `#13` 절을 그대로 두고
> 위에 새 절만 추가한다.)
HANDOFF에 무언가를 더할 때는 끝에 붙이지 말고 "열린 항목"이나 새 섹션에 넣는다.

## 열린 항목

> 완료 항목은 `.claude/state/archive/`로 옮긴다. 이 파일에는 열린 것만 둔다.
> 이 표는 원본을 가리키기만 한다. 본문을 옮겨 적지 않는다.

| 항목 | 상태 | 원본 |
|---|---|---|
| 모듈 경로 계약 | 유효 | `__tests__/engine/cornerPipelineStaticRules.test.ts`의 `LLM_CALL_MODULE` · `APP_CONFIG_LOOKUP_MODULE` · `APPROVED_BRAND_CONSTRUCTOR_MODULES` |
| 발행 시 테마 복사 트리거 | 미적용 (Phase 7 발행 묶음) | `docs/ONDOLOG_SCHEMA.md` §9-C-7 |
| 테마 잠금 DB 강제 | 미적용 (Phase 9, 그 전 공개 배포 금지) | `docs/ONDOLOG_SCHEMA.md` §9-C-8 |
| 루트 `include`가 `docs/`의 `.ts`까지 먹음 | 알려진 제약 | `tsconfig.json`의 `include` |
| `TYPE_AFFINITY_ENGINE_VERSION` 도입 + 산출 시 기록 | 미구현 | `docs/ONDOLOG_MASTER.md` §10-7-5 |
| 발행 경로 설계 | 보고 완료(`46`), 승인 대기. 질문 Q1~Q17·문서 어긋남 D1~D7 | 이 파일 "발행 경로 설계 보고 (`46`)" 절 |

## 입력 조립 (`44-r2`, 2026-10-09, corner-pipeline) - 열린 판단 있음

원본은 MASTER §17-0-9. 만든 것: `supabase/functions/_shared/inputAssembly.ts`(`assembleCornerInput(client, context)` -> `{messages, photos, dates, records, exclusions}`), `_shared/kstTime.ts`(시각 변환 모듈 하나, import 없음), 시험 `_shared/inputAssembly.test.ts`·`_shared/testFixtures/inputAssemblyFake.ts`. 시간대 시험(`__tests__/functions/timeOfDayLabelTimezone.test.ts`)에 `kstTime` 케이스를 더했다(기존 케이스 무변경). 바꾼 타입(`corners/cornerCommon.ts`): 머리 주석 교체, `ChatMessageSource.attribution`을 `Attribution & { source: 'chat' }`로 좁힘, `DateSource.dateLevel?` 추가(선택). 멈춘 부분은 없다. 아래는 §17-0-9가 정하지 않아 고른 것이다.

| 판단 | 고른 것 | 근거 / 확인할 것 |
|---|---|---|
| 데이트 단위(`date_id`만 있는) 사진·유저 기록의 자리 | `DateSource.dateLevel?: {photos, userNotes}` 신설(선택 필드) | F "데이트 단위에 붙인다"인데 타입에 자리가 없었다. 코너(17-1)가 이 값을 지면에 쓸지는 기획 몫 |
| `Attribution.source` 1:1 | 메시지 레코드만 `attribution`을 싣고 값은 `'chat'`. 사진·데이트는 `attribution`이 없다 | `'feed'`·`'story'`에 대응하는 레코드 종류가 없다. 값 대응이 필요하면 PM 확인 |
| 유료 커플의 `access_locked=true` 행 | 열람 가능으로 본다(`is_entry_visible`과 같은 결과) | A-3 "같은 결과"와 D "잠긴 항목은 넣지 않는다"가 이 칸에서만 갈린다. D는 유료 전환 시 잠금이 풀린다고 전제 |
| `profiles.deleted_at` | 걸지 않는다 | A-2 "컬럼이 있으면 모두"와 F "탈퇴 유예 중에도 그대로 쓴다"가 충돌 - 구체적인 F를 따름. `profiles`엔 `couple_id`도 없어 `id`로만 읽음 |
| "기간을 N년 앞으로 옮긴 구간" | 과거 방향(`[start-N년, end-N년)`), N은 포함하는 가장 작은 N, 말일 보정(2월 29일 -> 28일) | C-1 "기간 시작 이전"과 한 방향. 일자 보정 규칙은 문서에 없다 |
| 6개월 / `last_featured_at` 비교 | `kstShiftMonths(기간 시작, -6)`, 엄격 `<`(경계 시각은 부적격), 일자가 없으면 말일 | 위와 같음 |
| 후보 4 "열람 가능한 사진" | 크기(width/height) 없는 사진도 센다 | 문자 그대로. 그 사진만 있는 과거 데이트는 후보가 되지만 지면엔 사진 0장 - 엄격히 하려면 PM 결정 |
| 날짜 컬럼 상한 | `lt`에 `kstDateExclusiveUpperBound(end)` (끝이 자정이면 그 날짜, 아니면 다음 날짜) | B "기간보다 좁지 않다". 끝이 자정이 아닌 기간을 시험으로 고정 |
| 잠긴 항목 건수의 범위 | 이번 기간 범위(기간 안 촬영 사진 + 이번 기간 데이트에 묶인 항목)만 센다. 재소환 후보의 잠긴 항목은 세지 않는다 | F가 범위를 정하지 않았다. 보조 쿼리(`access_locked=true`)는 세기만 하고 A-3의 보수다 |
| 시각 없는 독립 사진 건수 | 기간과 무관하게 전체 건수 | 시각이 없어 기간에 귀속할 수 없다 |
| 재소환 데이트의 사진 | `PhotoRecord`로 따로 내지 않고 정거장(`PhotoRef`)에만 싣는다 | 기간 이전이라 `recalled:false` 사진 레코드는 골격의 기간 단언에 걸린다 |
| `kstDisplayStamp`(`"2026.08.22 09:20"`) | `kstTime.ts`에 함수 추가 | 출처 표기 형식은 CORNER_CONTENT §2 예시. E 표에 없지만 "형식 변환 함수" 범위로 봄 |
| 페이지네이션·`in` 쪼개기 | 1000행 단위 `range`, `in` 목록 100개씩 | PostgREST 행 상한·URL 길이. 값은 구현 선택 |
| `last_featured_at` 필터 | 쿼리가 아니라 코드에서 거른다(과거 데이트 전체를 읽음) | `or` 필터를 클라이언트 타입에 넣지 않으려는 것. 데이트 수는 채팅보다 작다 |

발행 경로로 넘긴 것(범위 밖): `last_featured_at`·`feature_count` 갱신, 채팅 입력량 상한, 해제 유예 커플 발행 여부, 17-5 기간 넓히기, 17-1 선별 상한, 실제 `SupabaseClient`가 `InputAssemblyClient`를 구조적으로 만족하는지의 실물 확인(가짜 클라이언트로만 시험).

## 입력 조립 후속 (`45`, 2026-10-09, corner-pipeline, r50 반영)

원본은 MASTER §17-0-9 (r50). 위 `44-r2` 표의 해당 두 행("후보 4"·"잠긴 항목 건수의 범위")은 이 절이 대체한다. 멈춘 부분 없음.

| # | 항목 | 변경 전 | 변경 후 |
|---|---|---|---|
| 1 | 후보 4 (C-4) | 크기(width/height) 없는 사진도 "사진 1장 이상"으로 셌다 | D·F에서 빠지지 않고 남는 사진만 센다(`inputAssembly.ts` 후보 판정 루프에서 크기 null 사진 건너뜀). 이 판정에서 거른 사진은 `photosWithoutSize`에 세지 않는다(후보 판정의 일부). 시험 추가: 크기 없는 사진만 있는 과거 데이트는 후보가 아니다, 크기 있는 사진이 하나라도 있으면 후보다. 잠긴 사진만 있는 과거 데이트 시험은 그대로 통과 |
| 2 | `kstDisplayStamp` (F 출처 표기) | 코드 확인 결과 이미 `"2026.08.22 09:20"` 형식이고 `— `가 없었다 | **코드 무변경.** 시험만 추가: 1월 5일 03:07 KST에 `"2026.01.05 03:07"`, 모든 표기가 `^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$`이고 `—`로 시작하지 않음(시간대 5곳 자식 프로세스) |
| 3 | 잠긴 건수 범위 (D 마지막 문단) | 확인 결과 이미 이번 기간 조회(기간 안 촬영 사진 + 이번 기간 데이트에 묶인 항목)만 센다. 재소환 후보 조회는 `countLocked=false` | **코드 무변경.** 시험만 추가: 재소환 후보의 잠긴 사진(`lock-old`)은 세지 않아 기존 데이터에서 3, 과거 데이트만 있는 경우 0 |

고친 기댓값 없음(기존 assertion 무수정, 시험 추가만). 바꾼 파일: `supabase/functions/_shared/inputAssembly.ts`(1), `_shared/inputAssembly.test.ts`(1·3), `__tests__/functions/timeOfDayLabelTimezone.test.ts`의 `kstTime` describe(2; 한 자리 시각 순간 하나를 `kstEpochs`에 더하고 it 하나 추가). `kstTime.ts` 무변경.

## 발행 경로 설계 보고 (`46`, 2026-10-09, corner-pipeline) - 코드 없음, 승인 대기

코드·테스트·마이그레이션·docs 변경 없음. DB·외부 API 접속, 비밀값 접근 없음(저장소 안 파일만 읽음). 원본: ROADMAP r10 Phase 7 행, MASTER §17-0-4-B·§17-0-5-B/E/F·§17-0-6·§17-0-8·§17-0-9, §8-3, §6-7, SCHEMA §9-1·§9-2·§9-C·§10-6·§12, 코드 `_shared/` 전부. 아래 "공급자(Anthropic) API 사실"로 표시한 것은 저장소 문서에 없는 내 지식이며 구현 전 공급자 문서로 확인해야 한다.

### 1. 호 하나의 발행 흐름과 상태 전이

새 컬럼 없이 기존 컬럼으로 표현한다. 호의 상태는 `issues.published_at`(null=초안)과 코너 행의 `status`에서 읽는다.

| 단계 | 하는 일 | 코너 `status` | 실패하면 어디로 / 무엇이 남나 |
|---|---|---|---|
| P0 호 준비 | 대상 커플 선별, 기간 산출(발행 주기 config), `issues` 행(`published_at` null)과 대상 코너 3종 행 `pending` 생성 | 없음 -> `pending` | insert 실패는 던지고 그 커플만 건너뛴다. 남는 것: 만들어진 행. 재실행은 같은 `(couple, issue_type, issue_number)` 행을 재사용(issues는 unique로 멱등, corners는 unique 없음 - Q2) |
| P1 입력 조립 | `assembleCornerInput(service_role 클라이언트, context)`. 17-5 기간 넓히기는 호출 전에 `context.period`를 넓혀 넘긴다. 채팅 입력량 상한의 적용 자리는 조립 결과를 코너 입력으로 넘기기 전(값은 실측 후) | `pending` 유지 | DB 오류는 일반 `Error`: 그 커플의 이 호를 이번 실행에서 보류, 행은 `pending`으로 남고 다음 실행이 다시 시도. `CoupleMembershipError`는 P2와 같은 처리 |
| P2 요청 만들기 + 소속 단언 + 선행 검사 (배리어) | 3코너 **전부**에 대해 ⓪ 소속 단언, ① 선행 검사, `buildRequest`를 먼저 끝낸다. 하나라도 `CoupleMembershipError`면 **그 호 전체 중단 + 운영 경보**(r48, 호출자 몫). 전부 통과한 뒤에야 재료 0인 코너를 `skipped`(`insufficient_input`, attempts 0)로 저장 | 통과 후 일부 `pending`->`skipped` | 중단 시: 어떤 코너도 제출·저장되지 않았고 전부 `pending` 그대로, 사유 4값은 기록하지 않는다(17-0-4-B). 배치라서 이 배리어가 자연스럽다(제출 전에 3코너의 단언을 모두 본다). **골격 변경 필요**: 지금 `runCornerPipeline`은 ⓪~⑤를 한 함수에서 부르며 호출이 안에 있다. 배치는 "요청 준비(⓪+①+buildRequest)"와 "응답 마무리(④⑤)"를 나눠야 한다. 코너 코드는 건드리지 않는다(17-0-5-F) |
| P3 배치 제출 | 요청이 있는 코너를 한 배치로 제출(코너 행 ID를 요청 식별자로). 제출 성공 후 배치 ID와 코너의 대응을 보관 | `pending`->`generating` | 제출 실패는 `pending` 유지, 다음 실행이 재제출(이중 제출 방지는 `generating`+보관된 배치 ID로). 배치 ID 보관 위치가 스키마에 없다(Q4) |
| P4 결과 수신 | 배치가 끝나면 결과를 코너별로 받는다. 성공 응답의 사용량(`cache_creation_input_tokens`·`cache_read_input_tokens`)을 읽어 §17-0-8 확인 | `generating` 유지 | 항목이 오류·만료·취소면 전송 수준 실패와 같은 취급(호출 1회 소모). 예산 남음 -> 다음 라운드 재제출, 소진 -> P5의 `generation_failed`. 배치가 안 끝나면 `generating`으로 남아 다음 실행이 이어서 폴링(최대 대기 Q5) |
| P5 검증·저장 | `processCornerResponse`(JSON.parse -> FORBIDDEN_KEYS -> Zod -> 빈 결과 -> ID 해석 -> 원문 채우기 -> 파생값 -> 저장 스키마) 후 `saveCornerSuccess`/`saveCornerFailure` | `generating`->`ready` / `skipped`(`insufficient_input`, attempts>=1) / `failed`(`schema_invalid`·`forbidden_content`·`generation_failed`) | `schema_invalid`는 1회만 다음 라운드(P3)로 되돌린다. `forbidden_content`·빈 결과는 재시도 없음. 호출 예산 3회(17-0-5-A/C)는 **라운드를 넘어 코너 단위**로 세야 하므로(17-0-5-F 마지막 문단) `generation_attempts`에 영속해야 한다. 지금의 `createLlmClient` 예산은 프로세스 메모리 안이라 배치에는 맞지 않는다 |
| P6 발행 판정 | 모든 코너가 `ready`/`skipped`/`failed` 중 하나가 되면 `ready` >= 1을 본다(17-0-6) | 변화 없음 | `ready` 0개면 **발행하지 않는다**: 호는 초안, 코너는 `skipped`/`failed`로 남고 사유가 기록돼 있다. 실패한 코너만 다시 만든다(멱등). 성공한 산출물은 그 달에 귀속된 채 남고 다음 호로 넘기지 않는다 |
| P7 미디어 복제 | `ready` 코너 content의 미디어 경로 필드를 `magazine` 버킷으로 복제(service_role)하고 경로를 치환해 content 갱신 | `ready` 유지 | 복제 실패는 4값에 없다(Q9) -> 코너 상태를 바꾸지 않고 **발행을 중단**, 호는 초안. 이미 복제된 파일은 남는다: 목적지 경로를 결정적으로 정하면 재실행이 같은 경로를 덮어써 멱등. 호가 영영 발행되지 않을 때의 고아 파일 정리는 문서에 없다 |
| P8 발행 확정 | 한 번의 원자적 확정: `issues.published_at` 설정(이 UPDATE에서 테마 복사 트리거 작동, §9-C-7), `ready`->`published`, 실린 데이트의 `last_featured_at`·`feature_count` 갱신 | `ready`->`published` | 전부 롤백되어 P7 직후 상태(초안, 복제 완료, `ready`)로 돌아가고 P8만 재시도한다. 원자성은 Postgres 함수(RPC) 하나로만 문서대로 닿는다(아래 4번 옵션 P) |

`skipped`/`failed` 코너는 `published`로 바뀌지 않는다(`corners_select` RLS는 `published`만 보인다).

### 2. "발행 성공"의 정의 (한 줄)

**한 호의 발행 성공이란, `ready` 코너가 1개 이상인 호에서 그 코너들의 미디어 복제·경로 치환이 끝난 뒤 `issues.published_at` 설정(테마 복사 트리거 포함)·`ready`->`published` 전이·실린 데이트의 `last_featured_at`/`feature_count` 갱신이 한 번에 커밋된 것이다.**

- `last_featured_at` 갱신(r49 §17-0-9-C): 이 커밋의 일부이므로 생성만 되고 발행 안 된 호는 간격 판정을 오염시키지 않는다. 별도 후처리로 두면 "발행은 됐는데 갱신이 안 된" 호가 생겨 감지할 표지가 없다(그래서 옵션 P).
- r48 중단: 발행 **이전**(P2)의 일이라 이 정의에 직접 걸리지 않는다. 중단된 호는 P2에서 아무것도 저장하지 않으므로 발행 후보가 될 수 없다. 걸리는 지점은 "중단 뒤 재개 규칙"(Q7).
- 미디어 복제(8-3): 이 정의의 선행 조건이다. 복제 전에는 발행으로 치지 않는다.

### 3. ROADMAP r10 발행 경로 항목 11개 - 단계 매핑

| # | 항목 | 붙는 단계 |
|---|---|---|
| 1 | 배치 API | P3·P4 (+ P5의 라운드 재제출). 엔드포인트는 규칙 C상 `llmClient.ts` 안에만 둘 수 있다 (Q15) |
| 2 | 미디어 복제 | P7 |
| 3 | 테마 복사 | P8 (DB 트리거, SCHEMA §9-C-7) |
| 4 | `skip_reason` CHECK | P5 저장(DB 강제). 마이그레이션 |
| 5 | Deno import map | 전 단계의 배포 선행 조건(사람 작업) |
| 6 | 캐시 적중 확인 | P4. 지금 `llmClient.call`은 텍스트만 돌려줘 사용량을 못 읽는다 -> 결과 타입 확장 필요 |
| 7 | 소속 단언 실패 -> 호 전체 중단·운영 경보 | P2 (배리어) |
| 8 | 발행 성공 후 `last_featured_at`·`feature_count` 갱신 | P8 |
| 9 | 채팅 입력량 상한 실측 | P1 (적용 자리) / 실측은 P4의 사용량으로 |
| 10 | 해제 유예 커플 발행 여부 | P0 (대상 선별) |
| 11 | 입력 조립의 실제 SupabaseClient 연결 확인 | P1 (쿼리 문법·컬럼명) |

### 4. 마이그레이션이 필요한 것

번호는 예약하지 않는다(SCHEMA §13: 착수 시점의 다음 번호).

| 항목 | SCHEMA 절 | 상태 |
|---|---|---|
| 발행 시 테마 복사 트리거 | §9-C-7 | 골격 SQL만 있다. 함수·트리거 이름과 완전한 DDL 없음 |
| `corners.skip_reason` CHECK + `comment` 갱신 | **SCHEMA에 정의된 절이 없다.** MASTER §17-0-5-B와 SCHEMA §9-C-7 끝 문장("한 묶음")에서만 언급. `db-architect`는 SCHEMA만 근거로 삼으므로 절이 먼저 필요하다 | 4값 + NULL 허용 |
| (옵션 P) 발행 확정 함수 | 없음 | 문서에 없는 제안. 이 함수가 P8의 원자성을 준다 |
| (필요하면) 배치 ID 보관 | 없음 | Q4 |
| (필요하면) 제작 탭이 초안 코너 사유를 읽는 경로 | §10-6와 충돌 (D2) | 뷰 또는 정책 |

원자성 옵션: **P(권장)** `security definer` 함수 하나(service_role 전용 실행, 013의 `revoke execute from public` 선례 - DECISIONS 2026-08-23)가 위 세 가지를 한 트랜잭션에서 한다. PostgREST로는 다중 테이블 트랜잭션이 없고 `feature_count = feature_count + 1` 같은 식 갱신도 못 한다. **Q** 함수 없이 순서 쓰기(코너 `published` -> 데이트 갱신 -> 마지막에 `published_at`)는 커밋 지점이 `published_at`이지만, 데이트 갱신이 앞서면 발행 실패 시 오염이 남고 뒤에 두면 충돌 시 갱신 누락을 감지할 표지가 없다. 이 판단은 PM 몫(Q1과 함께).

두 트리거 순서: `tg_issues_theme_immutable`은 `old.published_at is not null`일 때만 막으므로 발행 전이 UPDATE에서는 통과하고, 새 트리거 이름 순서와 무관하게 충돌하지 않는다.

### 5. 사람 작업

1. **Deno import map**: 현재 맨 import 스펙파이어는 `zod` 하나(7개 파일). `supabase/functions/` 아래에 `zod`를 `npm:` 스펙으로 매핑하는 import map이 없다(저장소에 `deno.json` 없음). 버전은 jest가 도는 설치본과 같아야 한다(설치본 zod 4.4.3, supabase-js 2.112.3). 진입점이 생기면 `@supabase/supabase-js` 매핑도 필요. `../../../src/...` 상대 import가 배포 번들에서 해석되는지는 `supabase functions serve`/배포 드라이런으로 사람이 확인해야 한다(나는 접속하지 않았다). `ambient.d.ts`가 `npm:*`를 `any`로 두므로 tsc는 이 오류를 못 잡는다.
2. **비밀값**(절대 규칙 7): LLM API 키를 Edge Function 비밀로 등록. 이름은 문서에 없다(Q12). service_role 키는 앱 코드·저장소에 넣지 않는다 - Edge Function 환경 변수로만. 기본 주입 여부는 배포 환경에서 확인.
3. **LLM 공급자 계정**: 배치 API 사용 가능 여부, 지출 한도, 학습 미사용·데이터 보존 정책 확인(MASTER §6-7 미해결 ② / Part 16-3 법무). ROADMAP "Phase 7 전: 채팅 데이터 AI 활용 고지 문구(법무, 필수)"가 이 단계의 선행인지 PM 확인 - 실제 채팅을 처음 외부 API로 보내는 단계다.
4. **모델 식별자 값**: `app_config.llm_provider`는 `tbd`(010 시드). 정해서 넣는 것은 사람/PM. ROADMAP "LLM 한국어 품질 실측 비교"도 미해결.
5. **마이그레이션 검토·적용**: `db-architect` 산출물을 사람이 검토 후 적용(절대 규칙 5·6).
6. **스케줄 설정**: SCHEMA §11-4는 "Edge Function 스케줄러"라고만 한다. 어떤 메커니즘으로 부를지(Q17)와 그 설정은 사람.
7. **배포**: 함수 배포는 사람(절대 규칙 6).
8. **실물 확인**: 입력 조립 쿼리가 실제 `SupabaseClient`를 구조적으로 만족하는지, 쿼리 문법·컬럼명(항목 11)은 실제 DB에서만 닿는다.

### 6. 문서에 없는 값 / 질문

번호는 이후 지시에서 가리키기 위한 것이다. 값을 정하지 않았다.

- **Q1** 발행 확정의 트리거: 스케줄(17-0-0, 앱이 꺼져 있어도)인가, 유저의 발행 확인(MASTER §9-7-3 "발행 확인 단계는 항상")인가, 둘의 조합인가. 설계는 "생성 완료(`ready`)"와 "발행 확정(P8)"을 분리해 두었으므로 어느 쪽이든 붙는다.
- **Q2** `issues`/`corners` 행을 누가 언제 만드나, `issue_number` 채번 규칙, `corners`에 `(issue_id, corner_type)` 유일성이 없어 재실행 때 중복 행이 생길 수 있음.
- **Q3** 대상 커플 상태 집합(`active`만인가, `dissolving`·`pending` 포함인가) = 해제 유예 항목.
- **Q4** 배치 ID·재제출 상태를 보관할 곳(컬럼·테이블이 없다. 테이블이면 RLS 필요).
- **Q5** 폴링 주기, 최대 대기, 배치 만료·취소 결과를 4값 중 무엇으로 볼지(`generation_failed`로 보는 것이 자연스러우나 문서 없음), 제출 실패가 호출 예산을 쓰는지.
- **Q6** 라운드 간 재시도 간격과 `generation_attempts`의 의미(누적 호출 횟수로 영속)는 17-0-5-F가 "그 작업에서 정한다"고 남긴 것.
- **Q7** 호 전체 중단: 운영 경보의 저장소·수신처, 중단된 호의 재개 규칙(같은 입력 버그로 매 실행 재중단·재경보하는 것을 어떻게 막나).
- **Q8** 전부 실패한 호의 재시도 횟수·간격·트리거, 제작 탭에 사유 표시하는 경로.
- **Q9** 미디어: 저장 경로 형식(`magazine/{coupleId}/{issueId}/...`의 버킷 접두 포함 여부, D5), 파일명 규칙, 복제 대상 필드 목록(`PhotoRef.path`·`thumbPath`·`UserNote.path`·17-5 `photoPath`), 복제 실패·원본 이미 삭제된 경우, 저해상도 상호작용(CORNER_CONTENT §10 열린 항목), 고아 파일 정리.
- **Q10** `last_featured_at`에 쓸 시각(발행 시각? 기간 끝?), `feature_count` 증분 단위, 갱신 대상을 어떻게 아나(17-1 근거 데이트만인가, 17-5가 인용한 데이트도 "실린" 것인가; `corners.source_date_ids`가 있으나 `saveCornerSuccess`는 `source_*_ids`를 쓰지 않는다).
- **Q11** `ValidatedContent`가 된 content의 경로를 치환해 다시 저장하는 합법 경로. 브랜드 생성자는 `validateCornerResponse` 하나뿐이고(r40) 규칙 E가 지킨다. 선택지: (A) 목적지 경로를 입력 조립 단계에서 미리 정해 content가 처음부터 magazine 경로를 갖게 하고 P7은 파일만 옮김(단 "코너는 하지 않는다" 주석과 조립 계약 §17-0-9 변경 필요), (B) 승인 모듈(`cornerPipeline.ts`) 안에 재검증 후 브랜드를 붙이는 두 번째 공개 경로 추가(r40 취지와 충돌, 규칙 E 시험 변경), (C) 치환을 저장 스키마 검증이 없는 별도 쓰기로 둠(0-2 "검증 없이 저장하지 않는다"와 충돌). 고르지 않았다.
- **Q12** LLM 비밀의 이름, 모델 식별자(위 5-4), 코드에 이미 있는 문서 밖 값: `llmClient`의 `maxTokens` 기본 4096, 백오프 시작 500ms.
- **Q13** 커플당 월 비용 상한을 하드 한도로 강제하는지(6-7의 $0.31은 추정치), 비용·사용량 기록의 저장 위치, 배치에서 캐시 유효시간.
- **Q14** 6-7 "비전 필요(이미지 입력 지원 필수)" vs 현재 `LlmRequest`가 텍스트 블록만 가짐(17-1이 사진 연관성을 읽어야 하는가).
- **Q15** 발행 주기·모델을 `app_config`에서 읽을 자리: 규칙 D는 `.from('app_config')`를 `coeffLookup.ts`에만 허용한다. 읽기 모듈을 늘리면 정적 규칙 상수 변경이 필요. 배치 엔드포인트도 규칙 C로 `llmClient.ts`에만 둘 수 있다(같은 호스트).
- **Q16** `issues.is_trial`(첫 호 무료 체험)을 누가 언제 세팅하나.
- **Q17** 발행을 부르는 스케줄 메커니즘.
- **채팅 입력량 상한 - 값 없음, 실측 방법만**: (1) 읽기 전용 집계로 커플·기간별 메시지 수와 글자 수의 분포를 본다(실제 DB 접속은 사람 허가 후). (2) 대표 입력(17-4·17-5, 월간·일간)으로 공급자가 보고하는 입력 토큰 수를 기록해 글자 수와 토큰 수의 관계를 얻는다(소규모 실호출 또는 토큰 세기 기능 - 공급자 문서 확인). (3) 6-7 가정(월간 5코너 입력 70K 등)과 코너별로 비교해 중앙값·상위 분포·최댓값을 본다. (4) 가장 긴 달에 한 요청의 컨텍스트 한도와 비용이 어떻게 되는지 합성 최악 입력으로 한 번 본다. 상한의 값과 형태(토큰 수/건수/사전 선별)는 그 숫자를 보고 PM이 정한다.

공급자(Anthropic) API 사실, 문서 밖이라 확인 필요: 배치는 항목별 식별자를 주고 결과 순서가 요청 순서와 다를 수 있으며, 항목 결과는 성공/오류/취소/만료로 나뉘고 일정 시간 안에 끝나지 않으면 만료된다. 배치 안에서 프롬프트 캐시 적중은 보장되지 않고 최선 노력이라고 알고 있다 - 맞다면 §17-0-8 확인은 "켜져 있다"가 아니라 "실제 적중률"을 재야 하고 6-7 비용 모델의 캐시 가정이 흔들릴 수 있다.

문서 어긋남(고르지 않고 보고):
- **D1** ROADMAP Phase 7 상세(304~314행)의 "7단계"(6단계 미디어 복제, 대상 6종)는 낡았다. r10 Phase 7 행·MASTER §17-0-5-E(미디어 복제는 발행 묶음)·§17-0 머리말(3종)과 다르다. 또 코드 주석(`saveCornerResult.ts` 63~65행, `pipelineContracts.ts` 46~49행)은 `published` 전이를 "Phase 8(발행 로직)의 몫"이라 쓰는데 ROADMAP r10은 발행 경로를 Phase 7에 둔다(Phase 8은 PDF 조판).
- **D2** MASTER §17-0-6은 전부 실패 시 "제작 탭에 사유를 표시"하라는데 SCHEMA §10-6 `corners_select`는 `status='published'`만 보인다. 초안 코너의 `skip_reason`을 앱이 읽을 길이 없다.
- **D3** MASTER §17-0-0(앱이 꺼져도 배치 발행)과 §9-7-3(발행 확인 단계는 항상) - Q1.
- **D4** SCHEMA §9-C-3은 발행 전 `issues.theme`을 바꿀 수 있다고 하고(제작 현황에서 고르는 구간) §9-C-7은 발행 전이에서 `couples.magazine_theme`로 덮어쓴다. 선택값이 어디에 저장되는지(9-C-2는 `magazine_theme`가 "다음 호에 적용될 테마")가 하나로 읽히지 않는다. 또 이번 지시의 원본 표가 이 트리거를 "MASTER §9-7-1"로 적었으나 실제 트리거 서술은 SCHEMA §9-C-7이다.
- **D5** CORNER_CONTENT `PhotoRef.path` 주석은 `magazine/{coupleId}/{issueId}/...`(버킷 이름 포함)인데 `magazine` 버킷 Storage 정책은 객체 경로 첫 폴더가 `couple_id`여야 접근을 준다(015). 저장 값이 버킷 접두를 포함하는지 하나로 읽히지 않는다. (015는 `magazine` 버킷에 구성원 INSERT 정책도 둔다 - 동결 산출물이라는 8-3과 맞는지 확인 필요.)
- **D6** MASTER §17-0-5-B는 "Phase 7은 마이그레이션 없이 끝낸다 / CHECK는 폰 복귀 후 재빌드 묶음으로 미룬다"인데 ROADMAP r10과 SCHEMA §9-C-7은 CHECK·트리거를 Phase 7 발행 묶음에 둔다.
- **D7** MASTER §6-7 "추상화 레이어는 `src/services/llm/`"와 §17-0-0·규칙 C(`supabase/functions/_shared/llmClient.ts`가 유일한 호출 경로).

### 7. 확인 하나 - 17-4가 대화의 출처 표기로 첫 턴 메시지의 것을 고르는가

**고른다.** 코드: `supabase/functions/_shared/corners/sweetWords.ts` `deriveFor`(133~139행) - 대화 안 턴을 `Date.parse(at)` 오름차순으로 정렬(같은 시각이면 입력 순서 유지)한 뒤 `attribution: turns[0].attribution`. 근거 메시지의 `attribution`은 골격이 원문 채우기에서 선언(`SWEET_WORDS_REFERENCES`, 94행 `copy`)대로 레코드에서 옮긴다. LLM은 쓰지 않는다. 시험: `sweetWords.test.ts` 163~173행(정상 경로에서 입력 순서가 뒤바뀐 두 턴 -> 턴 순서 `['세준','서영']`, 대화 표기 `.at`이 가장 이른 메시지의 것) 및 388~408행(`derive` 직접 호출: 표기 문자열이 `'첫째 표기'`이고 턴 텍스트가 `['첫째','둘째']`). 고친 것 없음.

## node_modules 백업 (2026-09-12, main session)

node_modules 백업: ..\ondolog-node_modules-20260910.zip (219548890 bytes, 2026-09-10)
현재 node_modules는 lock으로 재현 불가 — npm install --legacy-peer-deps로
설치 후 lock만 되돌려진 상태. npm ci는 lock 내부 불일치로 거부됨.
이 백업은 폰 복귀 후 lock 재생성 시 폐기한다. 해결이 아니라 다리다.

## package.json ↔ package-lock.json 정합 — 목표 달성 불가로 중단 (2026-09-12, main session)

Phase 7 위임(`.claude/state/prompts/phase-7/15-main-session-package-align.md`).
**중단 — 목표 자체가 달성 불가능함을 확인.** `package.json`은
`git checkout -- package.json`으로 되돌렸다(`git status --porcelain` 클린
확인 완료). `CLAUDE.md`는 손대지 않았다. 커밋 없음.

1. **`package-lock.json`이 내부적으로 낡았다.** `expo@57.0.17`이 요구하는
   전이 의존 7건의 버전 요구가 lock에 고정된 버전보다 높다. `npm ci`는
   어떤 플래그로도 통과하지 않는다(`--legacy-peer-deps`는 peer 충돌만
   무시할 뿐, 이건 peer 충돌이 아니라 lock 자체 무결성 오류라 무시
   대상이 아니다):
   `expo-updates-interface`(57.0.1→57.0.2 요구), `expo-json-utils`
   (57.0.1→57.0.2), `@expo/metro-runtime`(57.0.14→57.0.15), `@expo/ui`
   (57.0.12→57.0.18), `expo-glass-effect`(57.0.1→57.0.3), `expo-symbols`
   (57.0.2→57.0.3), `@expo-google-fonts/material-symbols`
   (0.4.44→0.4.47).

   별도로, **`package.json` 대 lock 루트 선언 자체의 불일치도 5건** 확인됨
   (`node -e`로 `package.json` vs `package-lock.json`
   `packages[""].dependencies`를 직접 비교, 2026-09-12 확인):

   | 필드 | package.json | lock 루트 선언 |
   |---|---|---|
   | react-native | 0.86.3 | 0.86.2 |
   | expo-router | ~57.0.17 | ~57.0.15 |
   | expo-dev-client | ~57.0.16 | ~57.0.14 |
   | expo-linking | ~57.0.8 | ~57.0.7 |
   | expo-auth-session | ~57.0.10 | ~57.0.9 |

   이 5건은 이번 세션 산출물이 아니다 — `git diff c4e0231 11ce24b --
   package.json`으로 확인한 결과 **commit `11ce24b`("0831 시작 커밋",
   2026-08-31)에서 `package.json`의 이 5개 필드만 올라가고
   `package-lock.json`의 루트 선언은 그대로 남았다.** 그 뒤 `0904`·`0906`·
   `0909`×2·`0912` 커밋 전부 `package.json`/`package-lock.json`을
   건드리지 않아 그대로 이어졌다. `npm ci`를 한 번도 정상 실행하지 않아
   지금까지 발견되지 않았던 것으로 보인다.

2. **`CLAUDE.md` 45행은 여전히 잘못된 명령이다.** `npm install
   --legacy-peer-deps`는 lock을 덮어쓴다(절대 규칙 8 위반 소지). 대체안으로
   시도한 `npm ci`는 위 1번 때문에 작동하지 않는다. 45행은 손대지 않았다 —
   현재 맞는 명령이 없다.

3. **현재 동작 중인 `node_modules`를 만든 절차 — PSReadLine 히스토리로
   재구성(추측 아님, 하지만 불완전)**. 이번 세션(main session, 2026-09-12)
   대화 이전에 있었던 별도 라운드의 명령이라 이 세션은 직접 실행을
   지켜보지 못했다. 출처: `%APPDATA%\Microsoft\Windows\PowerShell\
   PSReadLine\ConsoleHost_history.txt`(줄 396~452 부근). **이 파일은
   타임스탬프를 남기지 않아 정확한 실행 시각은 전부 불명 — 순서(줄 번호
   순)만 확인 가능.**

   - `npm install --legacy-peer-deps` 실행 (416번째 줄 부근) —
     **이 시점에 `package-lock.json`이 다시 쓰였다.** `node_modules`도
     이때 갱신됨(→ 지금 설치돼 있는 `node_modules`의 실제 출처).
   - `Test-Path package-lock.json` / `Select-String package.json` /
     `git log --oneline -3 -- package.json package-lock.json` 등 확인성
     명령 다수.
   - **`git checkout -- package-lock.json`** — **이 시점에 방금 다시
     써진 lock을 커밋 상태로 되돌림.** `node_modules`는 그대로 두었다 —
     즉 이 순간부터 `node_modules`는 디스크상 lock이 선언하는 트리와
     달라졌다(lock으로 재현 불가능한 상태가 됨).
   - `npx jest --ci --watchAll=false` 실행 → 통과(348/26 기준선이 이
     시점 산출물로 추정 — 이 세션이 직접 목격하지 않아 "추정").
   - `Test-Path node_modules/@react-native/jest-preset` 확인.
   - `npx tsc --noEmit -p .` 실행 → 통과 추정(출력 미보존).
   - `package.json` vs lock 루트 선언 비교 PowerShell 스크립트(foreach
     dependencies/devDependencies) 실행 → 위 5건 발견한 것으로 추정.
     **이 스크립트의 실제 출력은 어디에도 저장되지 않아 그 결과 자체는
     불명** — 이번 세션이 2026-09-12에 동일 비교를 `node -e`로 독립
     재실행해 같은 5건을 확인했다(위 표).
   - `npm ci` 재실행 → 실패한 것으로 추정(오늘 이 세션이 동일 실패를
     재현함).

   **결론: 지금 `node_modules`는 그 `npm install --legacy-peer-deps`
   1회 실행의 산출물이고, 그 뒤 되돌려진 lock으로는 `npm ci`로 재현할
   방법이 없다. `node_modules`가 지금 지워지면(디스크 정리, 재클론 등)
   복구 경로가 없다.** 이 세션은 `npm ci`를 2회 실행했으나 둘 다
   의존성 해석 단계에서 실패해 `node_modules`를 건드리지 않았다(설치
   전 단계 실패 확인 — `npx jest`/`npx tsc`가 여전히 348/26·0에러로
   통과하는 것으로 재확인, 2026-09-12).

4. **해소 시점**: 폰 복귀 후 재빌드 때 `expo install --fix` + lock
   재생성 + EAS 빌드 + 실기기 검증을 한 벌로 다룬다(재빌드 대기 5종
   미검증 상태로는 네이티브 스택을 건드릴 수 없음).

## Phase 6 1~2단계(생체정보 동의 + 대표사진 등록) 산출 요약 — Phase 6 3단계(메인 세션)가 가져다 쓰는 용도

- **동의 상태의 단일 진실 소스는 `profiles.biometric_consent_at`/
  `biometric_consent_revoked_at`이다.** "현재 동의가 유효한가"는 어디서도
  직접 두 컬럼을 비교하지 말고 `src/utils/biometricConsent.ts`의
  `isBiometricConsentActive(consentAt, revokedAt)`를 불러 써라 — 재동의 시
  `revoked_at`을 `null`로 되돌리는 규칙(문서에 없는 자체 판단,
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조)이 이 함수 안에만
  있고 다른 곳에 중복돼 있지 않다.
- **`src/store/profileStore.ts`/`src/store/coupleStore.ts`가 대표사진
  경로(`referencePhotoPath`)까지 함께 들고 있다.**
  `setPersonalReferencePhoto(userId, localUri)`(profileStore)/
  `setReferencePhoto(localUri)`(coupleStore, 연결 상태에서만)가 업로드
  + DB 반영 + 로컬 상태 갱신을 한 번에 한다. 실제 업로드는
  `src/services/referencePhotoApi.ts`(`uploadReferencePhoto`,
  `getReferencePhotoSignedUrl`)에 있다 — Storage 경로 규칙은 아래
  참조.
- **⚠️ `019_avatars_storage_policies.sql`을 원격에 적용해야 대표사진
  업로드가 동작한다.** 개인 `{user_id}/reference`, 커플
  `{couple_id}/reference` 규칙으로 경로를 확정했다(015가 미확정으로
  남겨뒀던 부분). 적용 전까지는 `app/(modals)/reference-photo.tsx`의
  저장이 전부 RLS 거부(42501)로 실패한다 — `.claude/state/PROGRESS.md`
  "막힌 것" 참조.
- **화면 C(대표사진 등록)는 이미 완성돼 재사용 가능하다.**
  `src/components/ReferencePhotoSlot.tsx`(프레젠테이션, 개인/커플 공용) +
  `app/(modals)/reference-photo.tsx`(라우팅/스토어 연결). "사진 선택"만
  플레이스홀더다(`src/constants/referencePhotoPlaceholders.ts`) — 실제
  갤러리 연동 시 이 상수 파일의 소스를 `expo-image-picker` 결과로
  바꾸고, `ReferencePhotoSlot`에 넘기는 `onSave` 콜백 인자(로컬 URI)
  타입만 유지하면 나머지(미리보기·업로드·DB 반영)는 그대로 동작한다.
- **`profiles.photo_sync_enabled`/`photo_scan_completed_at`/
  `photo_scan_cursor`는 여전히 전혀 건드리지 않았다.** 피드 탭 안내
  카드(`app/(tabs)/feed.tsx`의 `PhotoSyncPromptCard`)는 생체정보 동의
  상태만으로 두 상태(미동의/동의완료)를 보여준다 — 화면 B(권한)·SDK
  연동 후에는 이 카드를 "동의 완료 → 권한 미허용 → 대표사진 등록
  완료 → 스캔 중"처럼 더 세분화해야 할 것이다.
- **⚠️ 철회 시 로컬 얼굴 데이터 삭제가 구현되지 않았다.** MASTER.md
  "철회 시 반드시 함께 일어나야 하는 일" 3번 — SDK 연동 시
  `revokeBiometricConsent`(`src/store/profileStore.ts`) 안에 온디바이스
  삭제 호출을 반드시 추가할 것. 자동 테스트로 강제할 수 없는 항목이라
  QA 체크리스트에 수동으로 남아 있다(`.claude/state/PROGRESS.md`
  "막힌 것" 참조).
- **(2026-09-02) `src/engine/faceMatch.ts`의 `threshold` 인자는 다섯 번째
  자리표시자였다** — 어느 문서에도 값이 없었고 자리표시자 목록에도 없었다.
  코드는 규칙을 정확히 지켰지만(인자로 받고 하드코딩하지 않음) 그래서
  아무도 추적하지 않았다. **판정 정책은 확정됐다** — MASTER Part 9-4:
  **오탐 회피 우선**, 판정이 애매한 구간은 매칭하지 않는다. 이중 임계값은
  범위 밖(분포 관측 후 Phase 10과 재검토).
  **값은 실기기 캘리브레이션 대기** → `UNRESOLVED('faceMatch.threshold')`.
  SDK 반환값이 유사도인지 거리인지, 정규화 범위가 무엇인지, 실제 커플
  사진에서 어느 대역에 분포하는지가 재빌드 후에만 관측된다. 측정은
  **온디바이스에서 하고 사람이 화면에서 읽어 손으로 기록한다** — 유사도
  로그나 특징 벡터를 서버로 보내면 절대 규칙 1 위반이다. 실기기
  작업이므로 위임 대상이 아니다.
- **법률 문구는 여전히 자리표시자다** — `src/constants/legalDocuments.ts`
  의 `biometric` 항목. 실제 법무 검토 텍스트로 교체 필요(다른 3개
  문서와 동일한 미해결 상태, "여전히 필요한 처리" 5번 항목에 함께
  추적).

## 여전히 필요한 처리 (사람 작업)

### 2026-09-02 추가

- **`docs/` 5종 교체** — MASTER·DESIGN·ROADMAP·SCHEMA·CORNER_CONTENT.
- **`ui-builder_phase6_guard.md` 내용을 `.claude/agents/ui-builder.md`
  끝에 이어 붙이기** — 새 파일이 아니다. Phase 6(생체정보 동의) +
  Phase 10(매거진 제작 탭) 주의사항.
- **마스터 PM 문서 / 프롬프트 엔지니어 인수인계서를 `docs/`에 넣을지 결정**
  — 현재 저장소 밖이라 버전 관리가 안 된다. 마스터 PM 문서는 "새 세션에서
  문서 하나로 복구"가 존재 이유라 특히 그렇다.
- **`018_realtime_publication.sql` 원격 적용 여부 확인** — 로컬 파일 존재와
  원격 적용은 별개다. 아래 1번과 같은 사안이며, 0831 대조 문서가 "다음
  확인 3가지"로 올렸으나 그 문서는 스냅샷이라 갱신되지 않는다.

### 기존

1. **`supabase_realtime` publication에 `messages`(및 필요 시 `stories`)가
   빠져 있다** — 원격 프로젝트에 직접 쿼리(`select * from
   pg_publication_tables where pubname = 'supabase_realtime'`)해 확인함,
   결과 0행. `alter publication supabase_realtime add table
   public.messages;`를 마이그레이션으로 적용해야 상대방 기기가 채팅을
   실시간으로 수신한다(현재는 화면 재진입 시에만 최신화됨). db-architect
   영역 — Phase 5는 읽기 전용 확인만 하고 적용하지 않았다(작업 지시 준수).
2. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
3. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
4. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
5. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
   약관 동의 UI는 구현 완료(`app/(onboarding)/auth.tsx`,
   `src/components/ConsentChecklist.tsx` 등). 단
   `supabase/migrations/017_profiles_marketing_consent.sql`
   (marketing_agreed_at 컬럼 추가 + terms/privacy_agreed_at
   default now() 제거)을 원격에 아직 push하지 않았다 — 사람이
   `npx supabase db push` 실행 후 `supabase gen types`로
   `src/types/database.ts` 재생성 필요(지금은 수동 패치 상태).
   미적용 상태에서는 marketing_agreed_at upsert가 실패한다.
   상세는 `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
   약관/개인정보처리방침/AI 활용 고지 **본문은 여전히 자리표시자**다
   (`src/constants/legalDocuments.ts`) — 출시 전 법무 검토 본문으로
   교체 필요. **(2026-08-27 추가)** 같은 파일의 `biometric`(생체정보
   동의) 항목도 동일하게 자리표시자 — 아래 "Phase 6 1단계" 절 참조.
6. **(2026-08-27 구현 완료, 원격 미적용) avatars Storage 버킷 정책** —
   경로 규칙을 개인 `{user_id}/reference` / 커플 `{couple_id}/reference`로
   확정하고 `supabase/migrations/019_avatars_storage_policies.sql`
   작성 완료(`app/(modals)/reference-photo.tsx` 대표사진 등록 화면이
   이 정책에 의존한다). **`npx supabase db push`로 원격 적용 필요** —
   적용 전까지는 대표사진 업로드가 전부 RLS 거부(42501)로 실패한다.
   적용 후 `supabase gen types typescript --linked`로
   `src/types/database.ts` 재생성은 불필요(테이블 컬럼이 아니라
   Storage 정책만 추가했다).
7. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
8. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
9. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
10. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
11. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
12. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.


