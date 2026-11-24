# 매거진 2.0 데이터 계약 — 공통 규칙

> 2.0-0 조사 산출물(초안) · 2026-11-25 · 기준: `docs/ONDOLOG_magazine_2_0_plan.md`(기획서) 0절 · 3절 · ROADMAP r156 · MASTER r84
> 디자인 세션은 이 폴더의 계약을 보고 지면을 그립니다(기획서 P1 "구현 먼저, 모양은 나중"). 값은 모두 **합성 예시**입니다 — 실제 사람 · 원문 · 원격 값 0.

## 파일

| 파일 | 대상 | 상태 |
|---|---|---|
| `date_archive.json` | 데이트 아카이브 | **참고 계약** — 지금 렌더러가 받는 모양(형식 맞춤용) |
| `love_dna.json` | 두 사람의 결 | 초안 |
| `league_monthly.json` | 연애리그(별지 · 주간 카드 포함) | 초안 |
| `rough_guess.json` | 어림짐작 | 초안 |
| `offline_setlog.json` | 각자의 하루 | 초안 |
| `couple_interview.json` | 우리 사이 | 초안 |
| `special_guest.json` | 특별 게스트 | 초안 |
| `over_shoulder.json` | 어깨너머 | 초안 (합성 집계 예시) |
| `appendix.json` | 부록 | 초안 |
| `sponsored.json` | 협찬 | 초안 (예시 브랜드 "예시상점") |
| `photo_break.json` · `next_issue.json` · `colophon.json` · `publication_note.json` | 부속 4종(사진 한 장 · 다음 호 예고 · 판권 · 정오 · 발행 노트 새 줄) | 초안 |

## 한 파일의 모양

| 키 | 뜻 |
|---|---|
| `corner_id` | DB `corner_type` 값(`supabase/migrations/002_enums.sql:20-34`) · 부속은 새 이름 |
| `page_title` | 지면 제목(기획서 1절) |
| `pages` | 쪽 수 최소 · 최대 |
| `publish_condition` · `skip_note` | 발행 조건 · 빠질 때 발행 노트 문장(기획서 문장 그대로, 없으면 `TBD`) |
| `llm_calls` | 호당 LLM 호출 수(기획서 4절) |
| `fields[]` | `path` · `type` · `source` · `deterministic` · `required` · 길이 상한(`max_chars`) · 개수(`count.min/max`) · 범위(`range`) · 소수 자리(`decimals`) · 말투(`tone`) · 검사(`checks`) |
| `fields[].source` | 엔진 함수(파일:줄) · DB 열(마이그레이션 파일:줄) · `llm` · 운영 입력. 코드가 없으면 `TBD: …` |
| `fields[].original` | 원문 칸 — **원문 불변 · 자르지 않음(R29-3)** + 앱 · 웹 입력에서 막을 글자 수 제안(`input_limit_suggestion`) |
| `fields[].trace` | 숫자 칸이 실제 데이터로 거슬러 올라가는 경로(P4 · 판정 금지) |
| `fields[].aspect_info` | 사진 칸에 가로세로 비율 정보(`width` · `height`)가 있는지 |
| `sample` | 합성 예시 |
| `open_questions` | PM · 디자인이 닫을 것 |

## 공통 규칙 (기획서 0절 P4 · 3절에서 옮김)

1. **지면 제목** — `^[가-힣 ]{1,7}$`(라틴 문자 · 숫자 금지, 7자 이내). 코드 상수 `PAGE_TITLE_PATTERN`(`src/types/corners/cornerTitles.ts:32`) · 봉투 `header.title` 7자(`src/types/corners/storedContent.ts` `cornerEnvelopeSchema`).
2. **말투** — 지면 글 = **합니다체** · 라벨 = **명사형** · 질문 = **해요체**(앱 문장도 해요체). 84-c 칸별 말투 검사(`src/engine/corners/contentChecks.ts`)를 새 코너 LLM 산출에도 똑같이 건다(기획서 4절).
3. **원문 우선** — 사람이 쓴 칸은 바꾸지도 자르지도 않는다(R29-3). 넘치면 렌더러가 지면을 나누거나 실패한다. AI는 맥락만 · 판정 금지 · 지어내지 않음(CLAUDE.md "코너 생성 원칙").
4. **숫자** — 모든 숫자는 실제 데이터로 거슬러 올라간다. 계산은 결정론(절대 규칙 2) · 계수는 `coeffVersion`과 함께 기록한다(MASTER 17-2 "버전 기록 없는 산출은 허용하지 않는다").
5. **잉크 위계** — 진묵(원문) · 담묵(AI가 배치만) · 세이지/샴페인(계산된 지표) — `docs/ONDOLOG_CORNER_LAYOUT.md` §0-4. 부속 지면은 체계 밖(§3-0).
6. **넘침** — 모든 지면은 R152-2를 따른다: 넘침 · 잘림 · 겹침은 **되받기 또는 실패**(92- `render/page_audit.py` `route`). 기록만 하고 넘어가지 않는다. 옮길 수 있는 반복 블록(`count.max`가 있는 배열)은 되받기 대상, 자리가 정해진 칸은 실패 대상이다.
7. **쪽 수** — 본지는 **4의 배수**, 상한 **36쪽**(별지 제외). 모자라면 사진 한 장 → 판권 여백 순서로 채우고, 넘치면 사진 한 장부터 빼고 그다음 이달의 우리 기사 수를 줄인다. 빈 쪽은 만들지 않는다.
8. **별지** — 연애리그만 본지 뒤 별지(쪽 수 규칙 밖).
9. **지면 순서(기본)** — 표지 → 목차 → 발행 노트 → 데이트 아카이브 → 다정한 말들 → 이달의 우리 → 각자의 하루 → 우리 사이 → 특별 게스트 → 두 사람의 결 → 어림짐작 → 어깨너머 → 협찬 → 부록 → 다음 호 예고 → 판권 · 정오 → 뒤표지 · 별지: 연애리그.
10. **빠짐(스킵)** — 재료가 없으면 코너가 빠지고 발행 노트에 이유를 적는다. 빈 지면 · 지어낸 지면 · 예시 광고 0(기획서 P3 · 2절 12.).
11. **반복 블록** — 디자인은 `count.min`(1개)과 `count.max`(최대) 두 경우를 모두 그린다.
