# 매거진 2.0-0 현황 조사 · 데이터 계약 초안 · iOS 준비 읽기 조사

> 메인 세션 · 2026-11-25 · 위임문 `.claude/state/prompts/phase-7/m20-0-dispatch-magazine-2-0-survey.md` · ROADMAP r156(R156-2~10 · R155-3 · R155-4) · MASTER r84
> **읽기 전용 조사.** 코드 · 설정 · 마이그레이션 변경 0 · 원격 0 · LLM 0. 근거는 파일:줄, 없으면 "없음 + 찾아본 곳 · 검색어".
> 시작 확인: ROADMAP `DOC_REVISION: 2026-11-24-r156`(docs/ONDOLOG_ROADMAP.md:15) · MASTER `DOC_REVISION: 2026-11-24-r84`(docs/ONDOLOG_MASTER.md:11) · 기획서 `docs/ONDOLOG_magazine_2_0_plan.md` 있음(210줄).

검색 범위(이 문서 전체 공통): `src/` · `app/`(옛 RN) · `web/src/` · `render/`(`.venv` · `out` 제외) · `supabase/`(migrations · functions) · `scripts/` · `__tests__/` · `docs/`.
검색어(코너마다): `love_dna` `dna_score` `league_weekly` `league_monthly` `leagueStats` `rough_guess` `roughGuess` `setlog` `couple_interview` `interview_` `special_guest` `guest_invite` `guest_response` `over_shoulder` `열람실` `어깨너머` `appendix` `부록` `sponsor` `협찬` `판권` `정오` `colophon` `next_issue` `사진 한 장` `두 사람의 결` `각자의 하루` `우리 사이`.

---

## ① 코너 9종 + 부속 구현 현황

**공통 사실**
- 12종 코너 값은 DB enum에 모두 있다 — `supabase/migrations/002_enums.sql:20-34`(`love_dna` :22 · `league_weekly` :23 · `league_monthly` :24 · `offline_setlog` :26 · `couple_interview` :27 · `special_guest` :29 · `over_shoulder` :30 · `appendix` :31 · `sponsored` :32 · `rough_guess` :33). `src/types/database.ts:1565-1576`이 같은 값을 갖는다. **이것 말고는 코너 이름이 코드에 거의 없다.**
- 코너 생성(LLM)은 3종뿐 — `scripts/ops/generateIssue.ts:72` `type CornerKind = 'date_archive' | 'sweet_words' | 'this_month'` · 모듈 `supabase/functions/_shared/corners/{dateArchive,sweetWords,thisMonth}.ts`.
- 저장 스키마(Zod)는 3종뿐 — `src/types/corners/storedContent.ts`(`DateArchiveStoredSchema` :175 · `ThisMonthStoredSchema` :272 · 다정한 말들 :184-206). 지면 제목 상수도 3종뿐 — `src/types/corners/cornerTitles.ts:18` `CornerTypeId = 'date_archive' | 'sweet_words' | 'this_month'`.
- 렌더러는 3종뿐 — `render/compose.py:39` `CORNER_ORDER = ('date_archive', 'sweet_words', 'this_month')` · 틀 13종(`render/issue/pages/`)은 모두 기존 3코너 + 표지 · 목차 · 발행 노트 · 뒤표지 · 측정 표 `render/issue/measure.json`(키 `timeline` · `quotes` · `article`뿐).
- 앱(`web/`)에 새 코너 입력 · 열람 화면은 없다(② 참고).

| 코너 | 엔진(계산 · 선별) | LLM 프롬프트 · 검사 | DB 표 · RLS | 앱 화면(입력 · 열람) | 렌더 틀 · 측정 표 | 시험 | 상태 |
|---|---|---|---|---|---|---|---|
| **연애 DNA** `love_dna` | 있음(일부): `computeDnaBaseScore` `src/engine/dnaScore.ts:161` · `computeDnaTotalScore` :250 · `clampDnaScore` :100 · `computeChatDelta` :203 = `UNRESOLVED` · `resolveTypeAffinity` `src/engine/typeAffinity.ts:73`. 빅5 비교 · 스턴버그 겹침 · 강점 선별 함수 없음 | 없음(찾아본 곳: `supabase/functions/_shared/corners/` · `src/engine/corners/` · 검색어 `love_dna` `dna`) | `dna_scores` 있음 `008_metrics.sql:106-133` · RLS 읽기 `012_rls_policies.sql:181`(쓰기 정책 0 = service_role만) | 없음(`web/src` 검색 `dna` 0) | 없음(틀 · 측정 표 0) | `__tests__/engine/dnaBaseScore.test.ts` · `dnaScore.test.ts` · `unresolved.test.ts:38` | **엔진만** |
| **연애리그** `league_weekly` · `league_monthly` | 있음(일부): `computeSixStats` `src/engine/leagueStats.ts:147` · `computeOvrRawScore` :203 · `percentileRank` :223 · `mapPercentileToOvr` :267 · 규준 조회 `src/engine/normPercentile.ts:143/158` · 규준 `src/engine/data/norm-synthetic-v{1,2,3}.json`. 수축(shrinkage) · 매치 리포트 11항목 · 변동 해설 근거 선별 없음(`leagueStats.ts:14` "구현하지 않음") | 없음(같은 곳 · `league`) | `stat_snapshots` `008_metrics.sql:29-71` · `match_reports` :76-101 · RLS 읽기 `012_rls_policies.sql:175/178` | 없음 | 없음 | `__tests__/engine/leagueStats.test.ts` · `normPercentile.test.ts` · `normDrift.test.ts` | **엔진만** |
| **어림짐작** `rough_guess` | 없음 — MASTER 17-9가 정한 `src/engine/roughGuess.ts` · `src/constants/roughGuessTopics.ts` 둘 다 없음(검색 `roughGuess` `rough_guess`) | 없음 | 새 표 불필요(MASTER) · 코너 저장은 `corners` | 없음 | 없음 | 없음 | **없음** |
| **셋로그** `offline_setlog` | 없음(대표 하루 선별 · 겹친 시간대) | 없음 | `data_entries` 재사용 예정이나 **`entry_type` enum에 `setlog` 없음** `002_enums.sql:10` ('photo','memo','drawing') · `data_entries` `006_archive.sql:89` · RLS `012_rls_policies.sql:123-139` | 없음(G05 · G06 시안만 - ②) | 없음 | 없음 | **없음** |
| **인터뷰** `couple_interview` | 없음 | 없음(Q4 생성 프롬프트 0) | 없음 — `interview_questions` · `interview_rounds` · `interview_answers` 마이그레이션 0(검색 `interview`) | 없음(G01~G04 시안만) | 없음 | 없음 | **없음** |
| **특별 게스트** `special_guest` | 일부: 사귄 일수 `computeDaysTogetherKst` `src/utils/relationshipDays.ts:29` · 마일스톤 `getMilestoneStatus` :77(7일 앞까지만 - 달 단위 기념일 목록 없음) | 없음 | 없음 — `guest_invites` · `guest_responses` 0 | 없음(G07~G11 시안만 · 웹 답변 페이지 0) | 없음 | 없음 | **없음** |
| **어깨너머** `over_shoulder` | 없음 | 없음 | 없음(집계 표 0) | 없음 | 없음 | 없음 | **없음** |
| **부록** `appendix` | 일부: 마일스톤 계산(위와 같음) | 없음 | 새 표 불필요 | 없음 | 없음 | 없음 | **없음** |
| **협찬** `sponsored` | 없음 | 없음 | 없음 — `sponsor_slots` 0(검색 `sponsor`: venv 패키지만) | 없음 | 없음 | 없음 | **없음** |
| 부속: 사진 한 장 | 없음(선별 규칙 0) | - | - | - | 없음 | 없음 | **없음** |
| 부속: 다음 호 예고 | 없음 · **반대 결정이 코드에 있음**: `render/issue/pages/back.html:24` 주석 "NEXT ISSUE 줄은 두지 않는다 - 다음 호를 약속하는 표시(MASTER r63)" · 시험 `render/tests/test_compose.py:507` `test_no_next_issue_promise_in_any_month` · `render/tests/test_facts.py:397` | - | - | - | 없음 | 반대 시험 2 | **없음** |
| 부속: 판권 · 정오 | 없음. 정정 창구 = 설정 › 앱 정보 › 문의하기(mailto) `web/src/features/settings/AboutScreen.tsx:56` | - | - | 문의만 | 없음 | 없음 | **없음** |
| 부속: 발행 노트 새 줄 | 기존 발행 노트 있음 — 조립 `render/compose.py`(`CORNER_LABELS` :40 · 스킵 문장 :58-60) · 틀 `render/issue/pages/note.html` | - | - | - | 있음(기존) | 기존 시험(`test_compose.py` 등) | **표만**(기존 지면 · 새 재료 줄 0) |

**상태별 수**: 완성 0 · 엔진만 2(DNA · 리그) · 표만 1(발행 노트 - 기존 지면만) · 없음 10(코너 7 · 부속 3).

**새 지면 제목이 남아 있는 곳**
| 제목 | 코드 · 틀 | 문서 |
|---|---|---|
| 「두 사람의 결」 · 「각자의 하루」 · 「어깨너머」 · 「부록」 · 「협찬」 | **없음**(검색 결과 0 - 코드 · 틀) | 기획서 1절 · MASTER r84 :349 |
| 「우리 사이」 | 없음(코드). enum 주석만 `002_enums.sql:27` "우리 사이 인터뷰" | MASTER 17-6 |
| MASTER 옛 지면 이름(우리의 연애 DNA · 연애리그 · 오프라인 셋로그 · 얼렁뚱땅 어림짐작 · 어깨너머 열람실 · 잡지 부록 · 협찬면) | enum 주석 `002_enums.sql:21-33` · CORNER_CONTENT 예시 header `docs/ONDOLOG_CORNER_CONTENT.md:357`("우리의 연애 DNA" - 7자 초과·제목 규칙 이전 예시) | MASTER 3-5 |

**가장 큰 빈 곳 3가지**
1. **참여형 입력의 바닥이 없다** — 인터뷰 3표 · 게스트 2표 · 셋로그 enum 값 · 웹 답변 페이지 · 매거진 제작 화면(D02)이 모두 0. 2.0-B · C의 대부분이 새로 짓는 일이다.
2. **채팅 "질" 지표가 결정론으로 계산되지 않는다** — DNA `chatDelta` v0 · 리그 실측 항목 · 어림짐작 4~7번이 모두 같은 지표(발화 비율 · 왕복 · 응답 속도 · 대화 시작 · 이모지)를 쓰는데, 계산 함수가 없다. `messages.warmth_score`(`007_chat.sql:16`)는 채팅 태깅 LLM이 코드 0(R124-2)이라 비어 있다. 지금 결정론으로 있는 채팅 계산은 연애 온도의 하루 건수(사람별)뿐(`src/engine/temperature.ts:349` `computeDailyScoresV0`).
3. **렌더러가 3코너 전용이다** — 짜기(`compose.py:39`) · 틀 13종 · 측정 표 3키 · 쪽 수 규칙(4의 배수 · 36쪽) · 별지 개념 모두 없다. 새 지면 10여 종은 디자인 반입 전까지 짤 수 없다(디자인 묶음이 막는 길).

---

## ② 매거진 제작 탭

**없음.** 지금 앱(`web/`)의 탭은 `main` · `chat` · `feed` · `magazine` · `settings` 다섯 개(`web/src/app/routes.ts:18`). 매거진 탭은 **서재(D01)** 하나다.

| 자리 | 지금 구조 |
|---|---|
| 매거진 탭 | `web/src/tabs/MagazineTab.tsx:15-35` — 커플 게이트 + `LibraryContent`(서재 · 다음 호 카드). 머리말 :5 "다음 호 카드의 '제작 현황 →'(D02) · 정렬 · 검색(D13)으로 가는 것은 없다(범위 밖)" |
| 서재 · 다음 호 카드 | `web/src/features/magazine/LibraryView.tsx:6` "'제작 현황 →'은 없다(D02는 범위 밖)" · 진행률 = 기간 경과율 `web/src/features/magazine/monthProgress.ts:17` `monthElapsedPercent` |
| 메인 탭 진행 카드 | `web/src/features/main/MainView.tsx:263-270` `IssueProgressCard`("제작 현황 →"은 숨김) |
| 설정 | `web/src/app/routes.ts:32-36` 하위 화면(프로필 · 커플 · 해제 · 성격 · 개인정보 · 앱 정보 · 탈퇴 · 알림 등) — 매거진 입력 항목 0 |
| 옛 RN 앱 | `app/(tabs)/magazine.tsx`(RN, 지금 운영 화면 아님) · MASTER 라우트 표의 `issue-progress.tsx`(D02)는 MASTER `docs/ONDOLOG_MASTER.md:3738`에만 있고 파일 0 |

MASTER가 말하는 제작 탭의 규격: 제작 진행률 화면 `docs/ONDOLOG_MASTER.md:1693-1731`("매거진 제작 탭은 참여형 코너의 유일한 입력 창구") · 이번 호 빠진 지면 토글 :393 · 테마 선택 :1939.

**디자인 시안 위치** — `docs/design/nocturne/screens/` · 색인 `docs/design/nocturne/screens_index.csv`
| id | 화면 | 보드 |
|---|---|---|
| D02 | 제작 현황 | N-D02-Progress |
| D03 | 제작 현황 — 참여 코너 포함 | N-S-D1-Magazine |
| D04 · D07 | 테마 만료 예고 · 이번 호 빠진 지면 표시 | N-S-D1-Magazine |
| G01 · G02 | 인터뷰 — 이번 주 질문 · 답하기 | N-S-D3-Magazine |
| G03 · G04 | 인터뷰 — 상대 기다림 · 서로의 답 | N-S-G1-Corners |
| G05 · G06 | 셋로그 — 오늘 기록 · 이번 주 | N-S-G1-Corners |
| G07 · G08 · G09 | 특별 게스트 — 질문 정하기 · 링크 관리 · 받은 답변 싣기 | N-S-G2-Corners |
| G10 · G11 | 게스트 웹 — 답변 쓰기 · 보냈어요 | N-S-G2-Corners |

지면 시안(PDF): `docs/design/magazine/ONDOLOG_Corners_{,hip_,lovely_,neon_,night_,ondol_}digital.pdf` — 무슨 지면이 들었는지는 이번에 열어 보지 않았다(PDF · 읽기 범위 밖).

---

## ③ `UNRESOLVED` 목록

레지스트리 한 곳: `src/engine/constants/unresolved.ts:50-63`. `supabase/functions/_shared/`에는 선언 0(검색 `UNRESOLVED`).

| 이름 | 파일:줄 | 지금 동작 | 기대하는 시험 | MASTER 16-2 짝 |
|---|---|---|---|---|
| `dnaScore.chatDelta` | 등록 `unresolved.ts:59-62` · 호출 `src/engine/dnaScore.ts:203-205` `computeChatDelta` | **throw**(`UnresolvedConstantError`) | `__tests__/engine/unresolved.test.ts:38` · `__tests__/engine/dnaBaseScore.test.ts:135` · `:152` | `dnaScore.chatDelta` · phase 7 · Part 17-2 — **짝 맞음** |
| `leagueStats.shrinkage` | 등록 `unresolved.ts:51-54` · **호출부 0**(`leagueStats.ts:14` "구현하지 않음") | 레지스트리에만 있음(쓰는 코드 없음) | `unresolved.test.ts:10` | `leagueStats.shrinkage` · phase 7 · Part 10-8-3 — **짝 맞음** |
| `faceMatch.threshold` | 등록 `unresolved.ts:55-58` · 호출부 0(`isMatch(similarity, threshold)`가 인자로 받음 - 16-2 "순수 함수 안에 넣지 않는다") | 레지스트리에만 | `unresolved.test.ts:24` | `faceMatch.threshold` · phase 6 · Part 9-4 — 짝 맞음 · 2.0 무관 |
| (`temperature.activityScore`) | 해소 · 제거(`unresolved.ts:45` 주석 · r74) | 미등록 키 → `UnknownUnresolvedKeyError` | `unresolved.test.ts:52` | 16-2 표에 "r75 해소" 기록 |

레지스트리 키 수 고정 시험: `unresolved.test.ts:60`("정확히 이 3개 키") — v0 승인으로 키를 지우면 이 시험과 위 throw 시험이 실패하는 것이 정상(MASTER 16-2 · 기획서 2절 4.).

**v0 안을 낼 때 필요한 입력값 — 준비 상태 (R156-6 · v0 숫자는 2.0-A)**

`dnaScore.chatDelta` (범위 `[−10, +25]` 확정, 기획서 "이미 결정론으로 계산되는 값만으로")
| 필요한 지표(MASTER 17-2 · 기획서 2절) | 결정론 함수 | 상태 |
|---|---|---|
| 다정한 발화 비율 | 없음. `messages.warmth_score`(`007_chat.sql:16`) 칸은 있으나 채움 0 — 채팅 태깅 LLM 코드 0(CLAUDE.md · R124-2). 다정한 말들은 LLM이 고른다(`sweetWords.ts:7`) · 다정 지수 `warmthIndex`는 null(`sweetWords.ts:58` "산출식 미결정") | **없음** — 기획서의 "이미 결정론으로 계산되는 값" 전제와 다름 |
| 왕복 리듬(대화 왕복의 자연스러움) | 없음(검색 `rhythm` `왕복` `turnTaking` `replyLatency`) | **없음** |
| 티키타카 성공률 | 없음(검색 `tikitaka` `티키타카`) | **없음** |
| 재료로 쓸 수 있는 결정론 계산(지금 있음) | 사람별 하루 메시지 수 `src/engine/temperature.ts:349` `computeDailyScoresV0` · `kstDayKey` :288 · 메시지 `sender_id` · `sent_at`(`007_chat.sql:7,12`) | 건수 = **양** 지표라 MASTER 17-2가 금지한 재료("`chat_delta`가 발화량에 반응하면 두 지표가 같아진다") |

→ 2.0-A가 chatDelta v0 숫자를 내려면 **먼저 결정론 채팅 지표 함수(응답 간격 · 왕복 · 발화 비율의 규칙 정의)를 새로 정해야 한다.** "다정 발화"를 LLM 없이 정할 규칙(어휘 · 이모지?)이 없으므로 PM 결정 대상이다(아래 8).

`leagueStats.shrinkage` (기획서: 규준집단 전수 열거 3,888의 사전 분산으로 v0)
| 필요한 값 | 위치 | 상태 |
|---|---|---|
| 스탯별 사전평균 · 사전 분산 | 규준 파일 `src/engine/data/norm-synthetic-v3.json` `stats.{pus,emp,att,def,tac,rea}.mean/stdDev`(파일 :3915~) · 형 `src/engine/normPercentile.ts:57-65`("mean = 베이지안 수축의 사전평균") · 3,888 = `sampleSize` | **있음** |
| 관측값(채팅 실측으로 갱신할 스탯 값) · 관측 분산 | 없음 — 스탯은 성격만으로 계산(`computeSixStats` :147). 채팅으로 스탯을 갱신하는 식 0 | **없음** — MASTER 16-2 해소 조건("관측 분산 확보 후, 사전 분산만으로는 부족")의 관측 쪽 |
| 주 단위 시계열 | `stat_snapshots` 표(`008_metrics.sql:29`) · 쓰는 배치 0 | 표만 |

→ 사전 분산은 바로 쓸 수 있다. 수축은 "관측값을 사전 쪽으로 당기는" 식이라 **관측값을 무엇으로 볼지(채팅 지표 → 스탯 변환)가 먼저 정해져야** v0 숫자가 의미를 갖는다.

---

## ④ MASTER 스키마 vs 지금 마이그레이션

| 표 · 열 | MASTER 정의 | 지금 마이그레이션 | 같음/다름/없음 | RLS |
|---|---|---|---|---|
| `interview_questions`(id, category, text, active) | 17-6 `docs/ONDOLOG_MASTER.md:6310-6311` | 없음 | **없음** | - |
| `interview_rounds`(id, couple_id, period_start/end, question_ids[], generated_question jsonb, status) | 17-6 :6313-6317 | 없음 | **없음** | - (기획서: 상대 답 행은 `revealed`일 때만 읽힘 - RLS로) |
| `interview_answers`(id, round_id, question_ref, user_id, own_answer, predicted_partner_answer, answered_at) | 17-6 :6319-6321 | 없음 | **없음** | - |
| `data_entries.entry_type = 'setlog'` | 17-7 :6447-6452 · MASTER :761 "enum 값 추가로 끝난다" | `entry_type` = ('photo','memo','drawing') `002_enums.sql:10` · 표 `006_archive.sql:89-` (`text_content` · `captured_at` · `lat`/`lng` · `date_id` 있음) | **다름**(enum 값 없음 · 열은 있음) | 있음 `012_rls_policies.sql:123-139`(커플 구성원 · 본인 작성) |
| `guest_invites`(id, couple_id, token, milestone_type, milestone_date, question_ids[], custom_question, expires_at, max_responses, revoked_at, created_at) | 17-8 :6572-6576 | 없음 | **없음** | - (토큰으로 비로그인 쓰기 - 웹 페이지 경로 설계 필요) |
| `guest_responses`(id, invite_id, question_ref, nickname, answer_text, ai_filtered, approved_by_a, approved_by_b, responded_at) | 17-8 :6578-6584 | 없음 | **없음** | - |
| 어림짐작(17-9) | 새 표 없음 — `corners.content` 스냅샷 + 엔진 파일 | 해당 없음 | 같음(표 0) | - |
| `dna_scores` | 17-2 · SCHEMA §8-4 | `008_metrics.sql:106-124`(base_score · chat_delta · total_score · breakdown · chat_factors · engine_version · unique(couple, month)) | **같음** | 읽기 `012:181` · 쓰기 정책 0(service_role) |
| `stat_snapshots` | 17-3 · SCHEMA §8-2 | `008_metrics.sql:29-61`(6스탯 · ovr · ovr_percentile · position_code · inputs · delta · engine_version) | **같음** | 읽기 `012:175` |
| `match_reports` | 17-3 · SCHEMA §8-3 | `008_metrics.sql:76-93`(metrics jsonb · measured_keys) | **같음** | 읽기 `012:178` |
| `daily_temperature` | 10-7 | `008_metrics.sql:4-15` | 같음 | 읽기 `012:172` |
| `app_config` 계수 키(DNA 61/65/69 · 델타 범위 · coeffVersion) | 17-2 "계수 출처 = app_config" | 시드 키 = publish · pdf_profiles · retention · map_provider · llm_provider `010_app_config.sql:13-24` — **DNA 계수 키 없음** | **없음** | 읽기 전체 authenticated(012) |
| `app_config.publish.mode` | 기획서 2절 5. "운영에서 production" | 시드 `compressed` `010_app_config.sql:15`(운영 원격 값은 읽지 않음) | **다를 수 있음** | - |
| `sponsor_slots` | 기획서 2절 12.(MASTER 정의 없음) | 없음 | **없음**(확인만) | - |
| 열람실 집계 표 | 기획서 2절 10.(이름 미정) | 없음 | **없음**(확인만) | - |

**기획서 vs MASTER 차이 목록**

| # | 항목 | MASTER | 기획서(우선 · R156-2) | 확인 |
|---|---|---|---|---|
| a | 인터뷰 알림 | 마감 하루 전 리마인드 `docs/ONDOLOG_MASTER.md:6294`(알림 표 :6290-6296) | "재촉 알림은 없습니다"(2절 8.) | **맞음**(PE 본 것) |
| b | 게스트 링크 유효 기간 | 7일 :6541(링크 보안 :6537-6544) | "그달 말에 만료"(2절 9.) | **맞음** |
| c | 셋로그 매일 알림 | 매일 정해진 시각(기본 밤 9시) :6342 · :6375 | 기본 꺼짐(2절 7.) | **맞음** |
| d | 인터뷰 질문 문장 | 예시 "상대가 가장 좋아하는 계절은?"(상대에 대한 질문) :6245 · 지면 예시 :6267 — 답 · 예측 칸 구조(`own_answer` · `predicted_partner_answer`)와 어긋남 | PE 초안 "나에 대한 질문 + 상대 답 예측"(PM 승인 대기) | **맞음**(어긋남 확인: 상대에 대한 질문에 "내 답"을 쓰면 예측 칸과 같은 내용이 된다) |
| e | 게스트 AI 1차 필터 | "AI 1차 필터(명백한 욕설·혐오 자동 제외)" :6517 | 게스트 LLM 0(1절 #9) | 메인 세션 찾음 — 필터를 규칙(금지어)으로 할지 정해야 |
| f | 게스트 응답 상한 | 10명 :6542 | "한 링크당 답변 수에 상한"(숫자 없음) | 메인 세션 찾음 — 숫자 확인 |
| g | 리그 지면 수 | 주간 스코어보드 1~2면 · 월간 분석 기사 3~4면(17-3 :5715) · CORNER_LAYOUT 3-5 1~2면 · 3-6 2~3면 | 별지 1~2면(월간판 + 주간 카드 묶음) | 메인 세션 찾음 |
| h | 리그 출시 시점 | r57 "연애리그는 출시 후" :336-337 | 2.0에 별지로 실음 | MASTER r84가 우선을 밝힘 :348 — 정리됨 |
| i | 다음 호 예고 | MASTER r63 "다음 호를 약속하는 표시 금지" — 틀 `back.html:24` · 시험 `test_compose.py:507` · `test_facts.py:397` | 부속 「다음 호 예고」 매호 | 메인 세션 찾음 — **정면 충돌**. r63을 어떻게 읽을지 PM |
| j | "부록 A" 참조 | MASTER에 "부록 A" 절 **없음**(검색 `부록 A` - 기획서에만) | 기획서 1절 표 MASTER 열이 "부록 A"(사진 한 장 · 다음 호 예고 · 판권) | 메인 세션 찾음 — 참조 대상이 없다 |
| k | 부재 지면 표시 | 3-7-A/B "지면을 두고 부재를 명시" · 토글 기본 "표시" :368-413(3-7-A :368 · 3-7-B :386) | "재료가 없는 달에는 빠집니다 · 빈 지면 만들지 않음"(P3) · 발행 노트에 이유 | 메인 세션 찾음 — 부재 지면(3-7-A)과 "빠짐"의 관계 정리 필요 |
| l | 셋로그 주기 | 주간(주간 리포트) | 월간 호에 대표 하루 1~2면 · 주간 발행은 2.0 뒤 | MASTER r84 :353 · 기획서 2절 7. — 정리됨 |
| m | 인터뷰 미완 회차 | "한쪽만 답변 → 미발행, 다음 주로 이월" :6303 | "답하지 않은 문항은 빈칸으로 싣는다"(2절 8.) | 메인 세션 찾음 — 문항 빈칸 vs 회차 이월 |
| n | 어림짐작 "비슷해요" | 없음(50% 미만은 주체를 바꿈 :6632) | 10%p 미만이면 "비슷합니다"(2절 6.) | 기획서가 새로 정함 — 정리됨 |
| o | 생일 기념일 | 17-8 "생일 양쪽 각각" | 같음 | 메인 세션 찾음 — `profiles.birth_date` 주석 "나이 확인용. 사귄 일수와 무관"(`003_profiles.sql:7`) - 쓰임 확장이 동의 범위인지(기획서 6절 5와 같은 결) |

---

## ⑤ 코너별 데이터 계약 초안

폴더 `docs/magazine-2-0/contracts/` — 공통 규칙 `README.md`. JSON 14개(`node JSON.parse` 모두 통과).

| 파일 | 대상 | 지면 | 필드 수 | `open_questions` |
|---|---|---|---|---|
| `date_archive.json` | 참고 계약(지금 렌더러) | 3~8 | 7 | 0 |
| `love_dna.json` | 두 사람의 결 | 2 | 18 | 5 |
| `league_monthly.json` | 연애리그 별지(주간 카드 포함) | 1~2 | 12 | 6 |
| `rough_guess.json` | 어림짐작 | 1 | 8 | 4 |
| `offline_setlog.json` | 각자의 하루 | 1~2 | 7 | 5 |
| `couple_interview.json` | 우리 사이 | 1~2 | 7 | 4 |
| `special_guest.json` | 특별 게스트 | 1~2 | 7 | 5 |
| `over_shoulder.json` | 어깨너머(합성 집계 예시) | 1 | 6 | 4 |
| `appendix.json` | 부록 | 1~2 | 4 | 3 |
| `sponsored.json` | 협찬(예시상점) | 1 | 5 | 3 |
| `photo_break.json` | 사진 한 장 | 0~2 | 2 | 3 |
| `next_issue.json` | 다음 호 예고 | 1 | 3 | 2 |
| `colophon.json` | 판권 · 정오 | 1 | 5 | 3 |
| `publication_note.json` | 발행 노트 새 줄 | 1 | 5 | 2 |

기존 구조를 가져온 곳: DNA · 리그는 `docs/ONDOLOG_CORNER_CONTENT.md` §3 · §4 · §5(이미 정의된 payload)를 바탕으로 하고 기획서 결정(별지 · v0 · 스킵 문장)을 더했다. 그 밖은 MASTER 17-6~17-9 · 기획서 2절에서 새로 적었다. CORNER_CONTENT §8(`docs/ONDOLOG_CORNER_CONTENT.md:694-717`)이 "미정의"로 둔 4종(셋로그 · 인터뷰 · 게스트 · 어림짐작)의 첫 구조 초안이다.

---

## ⑥ iOS 준비 읽기 조사 (F 사전 준비 · R155-3 · R155-4) — 매거진과 별개

| # | 항목 | 지금(파일:줄) | iOS에서 필요한 것 | Mac 없이 지금 | Mac이 와야 |
|---|---|---|---|---|---|
| 1 | iOS 프로젝트 | **없음** — `web/ios/` 없음(`web/` 목록: android · dist · public · scripts · smoke · src …). Capacitor 8.6.0(`web/package.json:17,21,36`) · `@capacitor/ios` 패키지도 없음 | `npm i @capacitor/ios@8.6.x` → `npx cap add ios` → `web/ios/App/`(Xcode 프로젝트 `App.xcodeproj` · `App/Info.plist` · `AppDelegate.swift` · `Podfile` 또는 SPM 패키지 · `capacitor.config.json` 사본 · 웹 자산 복사) | 패키지 판 고르기 · 설정 계획(이 표) · Apple Developer 가입 · App ID 등록(R155-3) | `cap add ios` · Xcode 빌드 · 서명 |
| 2 | 카카오 로그인 | **카카오 네이티브 SDK 아님** — Supabase OAuth(kakao 제공자) 웹 리디렉트: `web/src/auth/callback.ts:67-69`(`signInWithOAuth` · `redirectTo: 'ondolog://auth/callback'` :11 · `skipBrowserRedirect`) → 앱 안 브라우저 `web/src/platform/bridge.ts:138` `Browser.open` → 커스텀 스킴 복귀. Android 수신: `web/android/app/src/main/AndroidManifest.xml:25-31`(`ondolog` 스킴 intent-filter) | `Info.plist` `CFBundleURLTypes`에 `ondolog` 스킴(유니버설 링크 불필요 · `LSApplicationQueriesSchemes` 불필요 - 카카오톡 앱 호출이 없는 웹 흐름). 앱 안 브라우저 = SFSafariViewController(`@capacitor/browser` 8.0.5). Supabase 리디렉트 허용 목록은 같은 `ondolog://auth/callback`이라 그대로. 카카오 콘솔: 웹 흐름이라 iOS 플랫폼 번들 id 등록 필요 여부는 콘솔에서 확인 | 카카오 콘솔 iOS 플랫폼 · 번들 id 입력(R155-3) · Supabase 허용 목록 확인 | `Info.plist` 스킴 · 실기기 로그인 왕복 |
| 3 | 푸시 | `@capacitor/push-notifications` 8.1.3(`web/package.json:24`) · 설정 `web/capacitor.config.ts`(`PushNotifications.presentationOptions: []`) · 토큰 등록 `web/src/push/pushCore.ts:90-94`(`push_register` RPC, `platform` 'android'\|'ios' - `20261116180000_m1_push_notify.sql:32`) · 서버 FCM HTTP V1 `supabase/functions/_shared/pushSend.ts:5,99-112`(`apns` 머리 이미 실음) · Android `google-services.json` 적용 `web/android/app/build.gradle:48-53` | **주의: iOS에서 이 플러그인의 `registration` 토큰은 APNs 기기 토큰이지 FCM 토큰이 아니다.** 서버는 FCM V1에 토큰을 넘기므로(`pushSend.ts`) iOS는 FCM 토큰을 받아야 한다 → Firebase Messaging iOS SDK로 APNs 토큰을 FCM 토큰으로 바꾸는 단계(AppDelegate 코드 또는 Firebase 메시징 플러그인 - 새 의존성 = 허락 필요). 그 밖: APNs 인증 키(.p8)를 Firebase에 올림 · `GoogleService-Info.plist` · Push Notifications capability · 권한 요청 | APNs 키 발급(Apple Developer) · Firebase에 iOS 앱 추가 · `GoogleService-Info.plist` 받기 · 플러그인 길 결정(PM) | capability · AppDelegate · 실기기 토큰 · 알림 수신 |
| 4 | 센서 | **이미 처리함** — `web/src/features/sky/useSkyOrientation.ts:70-75` `orientationPermissionNeeded`(iOS + `DeviceOrientationEvent.requestPermission` 있을 때만, 플랫폼으로 가름) · :78-86 `requestOrientationPermission` · 사용자 동작 안 호출 `web/src/features/sky/SkyScreen.tsx:230`(C09 [움직임 사용하기]) · iOS 나침반 `webkitCompassHeading` :129 | `Info.plist`에 움직임 사용 설명(필요 시) · WKWebView에서 권한 창이 뜨는지 실기기 확인 | 없음(코드 준비됨) | 실기기 권한 창 · 둘러보기 |
| 5 | 사진 HEIC · 위치 지우기 | 입구 한 곳 `chooseFiles` → HEIC 막기 `web/src/photo/heicGuard.ts`(앞 바이트 판정 · 안내 문구 :11) → 위치 지우기 `web/src/photo/stripLocation.ts`(JPEG GPS IFD 지움 · PNG 청크 · 그 밖 캔버스 재인코딩 · **HEIC 통과 = PM 결정 대기** :12) · 앨범 플러그인 길은 시험 빌드만 `web/src/photo/galleryPlugin.ts:4` | 같은 JS 길이 WKWebView에서도 돈다(브라우저 API만 씀). iOS 사진 고르기(`<input type=file>`)는 보통 HEIC를 JPEG로 바꿔 넘기지만 **설정 · 경로에 따라 다르다** → HEIC 막기 문구가 iOS에서 자주 뜰 수 있다. 플러그인 길(`@capacitor/camera`)은 iOS 권한 문구(`NSPhotoLibraryUsageDescription` 등) 필요 | 없음(코드 공통) | 실기기 HEIC/JPEG · GPS 0 확인(51- B3과 같은 확인) |
| 6 | 번들 id | `web/capacitor.config.ts` `appId: 'com.ondolog.app.web'` · Android `web/android/app/build.gradle:4` `namespace` · :7 `applicationId` 모두 `com.ondolog.app.web` | iOS 번들 id 같은 값(R155-4) | App ID `com.ondolog.app.web` 등록 · 카카오 · Firebase에 같은 id | Xcode 서명 |
| 7 | 요약 | — | — | **지금**: Apple Developer 가입 · App ID · APNs 키 · Firebase iOS 앱 · `GoogleService-Info.plist` · 카카오 콘솔 iOS · 푸시 토큰 길 결정(FCM 변환) | **Mac 뒤**: `@capacitor/ios` 설치 · `cap add ios` · `Info.plist`(스킴 · 권한 문구) · capability · AppDelegate(푸시) · 서명 · 실기기 한 바퀴 |

---

## PM에게 올릴 결정(2.0-A 범위)

1. **채팅 "질" 지표를 결정론으로 어떻게 정의할지** — chatDelta v0 · 리그 실측 · 어림짐작 4~7의 공통 입력. 지금 결정론 지표가 없다(③). 후보: 응답 간격 · 왕복 수 · 대화 시작 수 · 이모지 수 · 사람별 발화 비율. "다정 발화"는 LLM 없이 정할 규칙이 없다 → chatDelta에서 뺄지, 규칙(어휘)으로 둘지.
2. **shrinkage v0의 관측 쪽** — 사전 분산은 있음. 채팅 지표 → 스탯 관측값 변환식이 없으면 수축할 대상이 없다. 2.0-A에서 리그를 "성격만 스탯 + 실측 항목 따로"로 낼지, 관측 갱신까지 넣을지.
3. **DNA 계수 거처** — `app_config`에 dna 키가 없다. 61/65/69 · 범위 · `coeffVersion`을 app_config 키로 더할지(마이그레이션 = 2.0-A "새 입력 0"과 충돌) 코드 상수로 둘지.
4. **다음 호 예고 vs MASTER r63**(차이 i) — 틀 · 시험이 "다음 호 약속 금지"를 지키고 있다. 기획서 부속을 살리려면 r63 해석을 PM이 다시 정해야 한다.
5. **"빠짐" vs 부재 지면(3-7-A/B)**(차이 k) — 2.0 새 코너도 부재 지면을 둘지, 발행 노트 한 줄로만 둘지 · 스킵 문장 7종(계약 `publication_note.json`).
6. **"부록 A" 참조**(차이 j) — 부속 지면 세부 규격의 원본이 없다. 기획서를 원본으로 볼지.
7. **2.0-A 범위의 매치 리포트 11항목** — 엔진 0. 리그 별지에 넣으면 2.0-A가 커진다.
8. 그 밖(2.0-B · C): 셋로그 enum 값 추가 마이그레이션 · 인터뷰 미완 회차(차이 m) · 게스트 AI 필터(e) · 응답 상한(f) · 생일 사용 동의(o) · 열람실 집계 칸 목록 · 협찬 표 열.
