# `render/issue/` v2.0.0 — 발행물 조판 템플릿

ONDOLOG 발행물의 지면 틀이다. **이 HTML이 곧 렌더 템플릿**이고, 렌더 코드는
구조를 고치지 않고 `data-*` 표시만 채운다. 지면을 고치면 이 묶음을 다시 넘겨 덮어쓰면 된다.

- 기준: `ONDOLOG_MASTER.md` 9-5, `ONDOLOG_CORNER_LAYOUT.md`, **`ONDOLOG_CORNER_CONTENT.md`**, ROADMAP r25(R25-1~8), P1 보드(patch2), 남은 6테마 × 19면 PDF
- **v2.0.0에서 바뀐 것:** §10 맨 위 · §13 전부. 핵심 — **매거진 2.0 새 지면 15틀**(두 사람의 결 2 · 어림짐작 · 연애리그 별지 2 · 각자의 하루 · 우리 사이 · 특별 게스트 · 어깨너머 · 협찬 · 부록 2 · 사진 한 장 · 다음 달 · 판권 · 정오) · 목차 17항목(`long` 변형) · 발행 노트 재료 두 단(`grid` 변형) · 빠진 코너 줄 · **덩어리 꺾기를 틀이 스스로**(`overflow-wrap:anywhere` → 렌더러 `DEV_TEMP_CSS_92` 삭제) · 뒤표지 바닥 상자 판면 폭 · 높이 표에 새 원문 칸(`measure.json` `v2`) · 견본 호 PDF(`samples/`)
- **v1.2.4에서 바뀐 것:** §10 맨 위 표. 핵심 — **모든 글 칸 낱말 단위 줄바꿈**(`base.css`) · 높이 표에 여유 한 줄 · 0인 조각 규칙 · 근거 날짜는 발췌마다 · 이달의 우리 없는 호의 표지
- **v1.2.3에서 바뀐 것:** §10 표가 전부다. 핵심 — 높이는 **규칙 문장이 아니라 실측 표(`measure.json`)가 원본**(§12) · 기사 지면 `hero-photo` / `hero-none`(사진 0인 기사도 싣는다) · 기사 사진 캡션에 AI 캡션 라벨 줄 · 이달의 우리 소기사 사진(근거가 사진인 기사만) · 발행 노트 AI 안내 한 줄 슬롯 · 판면 밖 글자 0 · 0인 칸 `data-optional`
- **v1.2.2에서 바뀐 것:** `55-3` 지시서 대조용 두 가지 — `tools/resolve.js`의 `data-width`가 **값 없음·범위 밖이면 요소를 지운다**(PM 규칙에 맞춤) · §8이 48개 **전수 목록** · `.gitignore` 추가
- **v1.2.1에서 바뀐 것:** R44 — `tm-articles`의 사진을 **붙이지 않는다**(§11 ②). 사진이 없으면 한 단으로 내린다
- **v1.2에서 바뀐 것:** §10이 대조표다. 사실과 어긋나던 표시 7건 · 원문에서 줄 수 제한 제거 · `data-width` 표시 추가 · 임시 7건 확정(§11)
- **v1.1.1에서 바뀐 것:** R26-4(재소환 사유 표기) · R26-5(`@da.lead` 집계 기준)를 §9-②에 반영. `tools/__pycache__` 제거. 지면 구조는 `da-article`의 사유 줄 하나만 바뀌었다 — 라벨을 `data-optional` 안으로 넣었다
- **v1.1에서 바뀐 것:** 코너 안 슬롯 이름을 `CORNER_CONTENT`에 맞춰 전부 다시 판정했다 — §9 대조표. 사진 자리에 `data-optional`. 다정한 말들 오프너에 변형 2종. `tools/` 추가
- 범위: **매거진 2.0 전 지면**(기획서 `ONDOLOG_magazine_2_0_plan.md` r157 · 계약 `docs/magazine-2-0/contracts/`). v1.2.4까지는 MVP 3코너만이었다
- 전제: **JS 없음 · 외부 URL 없음 · ASCII 파일명 · A4 210×297mm · `@page{margin:0}`**

---

## 1. 지면 종류 — 28개 (v1.2.4의 13 + v2.0.0 새 15 · 아래 두 번째 표)

| 파일 | 지면 | 기존 PDF | 비고 |
|---|---|---|---|
| `cover-photo.html` | 표지 — 사진 | p1 | "N월호" 필수. 호 번호·발행일 없음(R21) |
| `cover-type.html` | 표지 — 활자 | — (P1 신규) | 대표 사진 없거나 짧은 변 1170px 미만일 때 |
| `contents.html` | 목차 | p2 | 연애 DNA·연애리그 줄 없음. 콜로폰에서 Vol·발행일 삭제 |
| `note.html` | 발행 노트 | p3 | P1 판. 인터뷰 답·셋로그 줄 삭제, 정정 요청 → 설정 › 문의 |
| `da-opener.html` | 데이트 아카이브 ① 오프너 + 기사 헤드 | p4 | |
| `da-timeline.html` | 데이트 아카이브 ② 타임라인 | p5 | **한 면짜리 틀.** 넘치면 렌더러가 2면으로 나눈다 — §5 |
| `da-places.html` | 데이트 아카이브 ③ 장소 목록 + 세 물음 | p6 | **지도 없음**(카카오맵은 출시 후). 답 입력 UI 없음 |
| `da-article.html` | 데이트 아카이브 ④ 두 번째 기사 | p7 | 오프너 없음. 재소환 배지는 `data-if`. **변형 2종** — 사진이 있으면 `hero-photo`, 0이면 `hero-none`(글만 있는 기사) |
| `sw-opener.html` | 다정한 말들 — 오프너(침묵면) | p10 | 변형 2종 — 사진이 있으면 `with-photo`, 없으면 `type-only` |
| `sw-quotes.html` | 다정한 말들 — 인용면 | p11·p12 | **한 면짜리 틀.** `main` 개수가 지면 수를 정한다 |
| `tm-lead.html` | 이달의 우리 ① 저중심면 | p13 | |
| `tm-articles.html` | 이달의 우리 ② 소기사 | p14 | `articles` 개수별 변형 3종. 사진은 근거가 사진인 기사에만 — 섞이면 격자, 하나도 없으면 한 단 |
| `back.html` | 뒤표지 | p19 | Vol 표기 삭제(R21) |


**v2.0.0 새 지면 15틀** — 계약 파일은 `docs/magazine-2-0/contracts/`. 경로는 계약 + §13 필드 요청 기준.

| 파일 | 지면 | 계약 | 쪽 | 비고 |
|---|---|---|---|---|
| `dna-figure.html` | 두 사람의 결 ① 숫자면 | `love_dna` | 1 | 변형 묶음 둘: `delta`/`first`(지난 호 값 유무) · `chat`/`chat-pending`(`chatApplied`) |
| `dna-axes.html` | 두 사람의 결 ② 축 비교면 | `love_dna` | 1 | 헤어라인 위 점(빅5 · 스턴버그) · 실천 팁(≤60인 달만, `data-optional`) |
| `rough-guess.html` | 어림짐작 | `rough_guess` | 1 | 짐작 ◇ "쯤" / 셈 ◆ · 비슷함 · 채팅 30건 미만이면 셈 칸째 빠짐 |
| `league-board.html` | 연애리그 별지 ① 스코어보드 | `league_monthly` | 1 | `body.sheet` 별지 지면색 · 꼬리표 · 폴리오 "별지 N" |
| `league-report.html` | 연애리그 별지 ② 해설 | `league_monthly` | 1 | 매치 리포트 · 능력치 배분 · 변동 해설(넘치면 되받기) |
| `setlog.html` | 각자의 하루 | `offline_setlog` | 1~2 | 변형 `two`/`one`(한쪽만 기록) · 조각째 되받기 |
| `interview.html` | 우리 사이 | `couple_interview` | 1~2 | 답 + 상대의 짐작 · 판정 표시 0 · 회차 · 문항째 되받기 |
| `guest.html` | 특별 게스트 | `special_guest` | 1~2 | 방명록 두 단 · 글째 되받기 |
| `over-shoulder.html` | 어깨너머 | `over_shoulder` | 1 | 집계 숫자만 · 이 커플 값 나란히 0 |
| `sponsored.html` | 협찬 | `sponsored` | 1 | 변형 `with-image`/`type-only` · 맨 위 "협찬" 띠 · 지면 테 |
| `appendix-calendar.html` | 부록 ① 다음 달 달력 | `appendix` | 1 | A5 가로 재단선 · 관계 기념일만 |
| `appendix-postcard.html` | 부록 ② 사진 엽서 | `appendix` | 1 | A6 엽서 1~2장 + 재단선 · 0장이면 면째 빠짐 |
| `photo-break.html` | 사진 한 장 | `photo_break` | 1 | 변형 `land`/`port`(사진 비율) · 쪽 수 맞춤 |
| `next.html` | 다음 달 | `next_issue` | 1 | 사실만 · 약속 문장 0 |
| `colophon.html` | 판권 · 정오 | `colophon` | 1 | 정오(errata · 있을 때만) + 창구 |

---

## 2. 슬롯 표시

| 표시 | 뜻 |
|---|---|
| `data-slot="경로"` | 그 요소의 글자를 값으로 바꾼다. 안의 견본 글자는 미리보기용이다 |
| `data-src="경로"` | `<img>`의 `src`를 사진 경로로 바꾼다 |
| `data-repeat="배열"` | **첫 자식**이 항목 틀. 항목 안의 경로는 `.`으로 시작한다 |
| `data-optional` | 안의 슬롯 값이 **전부** 비면 요소째 지운다. **`data-slot`(글자)과 `data-src`(사진 경로)를 모두 센다** — 사진 틀은 `data-src`밖에 없다 |
| `data-if="경로"` | 값이 참일 때만 남긴다 |
| `data-variant="이름"` | 같은 부모 아래 변형. 렌더러가 하나만 남긴다 |
| `data-margin` | **판면 밖이 정위치인 글자**(§6). 지면 검사(`safe`)가 이 요소와 그 안을 판정에서 뺀다. 지금은 발행 노트의 `ONDOLOG` 워드마크 하나 |
| `data-width="경로"` | 값(0~100)을 그 요소의 `width:%`로. **막대·게이지는 데이터가 폭을 정한다** — 지면에 박힌 폭은 사실과 어긋난다(R29-1). **값이 없거나 범위 밖이면 그 요소를 지운다** — 렌더를 실패시키지 않는다. 박힌 폭을 남기면 고치려던 결함이 그대로 남는다 |

### 문법 — 이대로 읽는다

- **`data-repeat`는 컨테이너에 붙는다.** 첫 자식이 항목 틀이고, 나머지 자식은 견본이라 지운다
- **`data-variant`는 같은 부모 아래 형제끼리 한 묶음**이다. 하나만 남기고 나머지는 지운다
- **경로 문법** — `[0]`처럼 숫자 첨자 · `[featured]`(`featured: true`인 항목 하나) ·
  `[i]`(지금 그리는 기사) · `.length`(배열 길이). 항목 안의 경로는 `.`으로 시작한다
- **처리한 표시 속성은 출력에서 지우지 않는다.** `base.css`가
  `[data-repeat=".turns"] > *:nth-child(even)` · `[data-variant="grid-4"] .art-ph`처럼
  **선택자로 쓴다.** 지우면 들여쓰기와 사진 높이가 사라진다
- **글자 하나짜리 배열**(`@note.notUsed` · `@note.emptyCorners`)은 항목 틀 요소의 **글자 자체**가 값이다.
  안에 `data-slot`이 없다
- **값 안의 줄바꿈은 `<br>`**로 넣는다. `\n`은 HTML에서 공백이 된다

**해석 순서가 중요하다.** `variant` → `repeat` → `if` → `optional` 순으로 처리한다.
`data-width`는 `optional` 다음에 적용한다 — 지워질 요소의 폭을 계산할 이유가 없다.
`repeat`을 먼저 돌리면 지워질 변형 안에서도 항목이 복제되고, `if`를 나중에 돌리면
`optional` 판정이 이미 지워질 가지의 빈 슬롯에 걸린다.

### 코너 밖 값 — 렌더러가 계산해 넣는다

| 이름 | 값 | 쓰는 지면 |
|---|---|---|
| `@issue.month` | "9월호" | 표지 2종 |
| `@issue.period` | "9월 1일 ~ 9월 30일" | 발행 노트, 다정한 말들 오프너, 이달의 우리 |
| `@issue.nickname` · `@issue.names` | "늘봄" · "세준 · 서영" | 표지 2종, 발행 노트, 뒤표지 |
| `@cover.photo` · `.headline` · `.quote` · `.quoteBy` · `.temperature` | 표지 원천(MASTER 9-5) | 표지 2종 |
| `@toc` (배열: `.title` `.desc` `.page`) | 목차 | 목차 |
| `@contents.photo` | 목차 우상단 사진 — 데이트 아카이브에 실린 사진 중 표지 사진이 아닌 **첫** 사진. 없으면 틀째 삭제 | 목차 |
| `@note.materials` (배열: `.label` `.collected` `.used`) | 수집한 재료 | 발행 노트 |
| `@note.ratioPeople` · `.ratioOndolog` · `.sentencesPeople` · `.sentencesOndolog` | 문장의 출처 — **글자**(`"34%"`) | 발행 노트 |
| `@note.ratioPeopleWidth` · `.ratioOndologWidth` | v1.2.3 — 출처 막대의 **폭**(숫자 0~100). `data-width`는 이 경로만 받는다(#6). 글자 경로와 섞지 않는다 | 발행 노트 |
| `@note.recalledPhotosLine` | v1.2.3 확정 — 재소환 사진 한 줄 `"그때 그 시절 · 지난 기록에서 다시 실은 사진 N장"`. 0이면 빈 값 → 줄째 빠진다 | 발행 노트 |
| `@note.aiNotice` | v1.2.3 — 발행 노트 끝 AI 안내 한 줄(#19). 문장은 렌더러가 넣는다 — 법무 검토(M4-7)에서 바뀔 수 있어 지면에 박지 않았다. 빈 값이면 줄째 빠진다 | 발행 노트 |
| `@note.notUsed` · `@note.emptyCorners` (배열: `.text` 없이 요소 글자 자체) | 싣지 않은 것 / 비어 있는 코너 | 발행 노트 |
| `@back.photo` | 뒤표지 사진 — 같은 집합의 **마지막** 사진. 없으면 틀째 삭제 | 뒤표지 |
| `@back.closing` | 고정 문구 "N월의 온도를 / 여기에 두고 갑니다"(렌더러가 달만 넣는다) | 뒤표지 |
| `@back.nextMonth` | 다음 호 달 (영문) | 뒤표지 |
| `@page` | 폴리오 쪽 번호 | 표지·뒤표지 외 전부 |

이름 4개(`@contents.photo` · `@back.photo` · `@back.closing` · `@back.nextMonth`)와
`@toc`의 `.desc`는 R25-3으로 승인됐다. `@toc`에 `.no`가 없는 이유는 기존 p2의 항목이
번호가 아니라 **설명 줄**("화보 · 8월의 두 번의 하루 · 기사 2편")을 달고 있고
번호 자리는 ■ 기호가 쓰고 있어서다.

`@da.*` · `@sw.*`는 **코너 안 값에서 결정론으로 계산되는 것**이다. 계산 방법은 §9-②에 적었다.

### 코너 밖 값 — v2.0.0 새 지면 (렌더러가 계산해 넣는다)

| 이름 | 값 | 지면 |
|---|---|---|
| `@dna.chatDeltaText` | `payload.score.chatDelta`에 부호를 붙인 글자 "+6.4" · "−3.0" · "0.0"(마이너스는 U+2212) | 두 사람의 결 ① |
| `@setlog.overlapLine` | `"같은 시간대 · 08:20 · 19:40"` — `overlaps[]`가 비면 빈 값(줄째 빠짐) | 각자의 하루 |
| `@os.activeCouplesText` · `@os.redactedText` | `"1,240쌍"` · 지운 칸 수 `"2칸"`(0이면 빈 값 → 그 조각째 빠짐) | 어깨너머 |
| `@calendar.monthNum` · `.yearText` · `.monthEn` · `.milestoneLine` · `.noStartNote` · `.weeks[].days[]{day, mark}` | 다음 달 달력. 일요일 시작 · 다른 달 칸 `day` 빈 값 · `mark` = 그날 관계 기념일 라벨("500일") 아니면 빈 값 · 사귄 날이 없으면 `noStartNote`="사귄 날을 적으면 기념일이 표시됩니다" | 부록 ① |
| `@appendix.postcards[]{path, caption}` | 엽서 사진 1~2장 · 캡션 "09.20 · 장소"(장소 없으면 날짜만) | 부록 ② |
| `@next.monthNum` · `.monthLine` · `.emptyLine` | "10" · "2026년 10월 · 31일 · 일요일 5번" · 기념일 · 열 코너가 모두 없을 때만 "다음 달에는 표시할 기념일이 없습니다"(아니면 빈 값) | 다음 달 |
| `@colophon.issueLabel` · `.names` · `.writers` · `.photographers` · `.maker` · `.typeset` · `.fonts` · `.themeLabel` · `.versions` | 판권 줄. 빈 값이면 그 줄째 빠짐. `versions` = 그 호에 쓴 `coeffVersion` · `normVersion`을 " · "로 | 판권 · 정오 |
| `@sample.stamp` | 견본 PDF에서만 "견본". **실제 호는 빈 값**(요소째 빠짐) | 협찬 |

### 코너 안 값

**경로는 코너 봉투(`CornerEnvelope`) 기준이다** — `header.*` / `payload.*`(`CORNER_CONTENT` §0-3).
`date_archive`는 `payload.articles[featured]`(오프너·타임라인·세 물음)와
`payload.articles[i]`(두 번째 기사)를 나눠 쓴다. `[featured]`는 `featured: true`인 기사 하나다(§2-2).

---

## 3. `data-variant` 목록

| 지면 | 변형 | 고르는 기준 |
|---|---|---|
| `da-timeline.html` | `photos-0` `photos-1` `photos-2` `photos-3` | `stops[j].photos.length` (4 이상이면 상위 3장만 → `photos-3`) |
| `tm-articles.html` | `grid-2` `grid-3` `grid-4` | `payload.articles.length` |
| `da-opener.html` | `with-photo` `type-only` | `@da.openerPhoto`가 비면 `type-only`. 대표 기사 전체 stop에 사진이 하나도 없을 때다 |
| `da-article.html` | `hero-photo` `hero-none` | 그 기사 전체 stop에 사진이 하나라도 있으면 `hero-photo`, 0이면 `hero-none`. **사진 0인 기사를 빼지 않는다**(v1.2.3) |
| `sw-opener.html` | `with-photo` `type-only` | `@sw.openerPhoto`가 비면 `type-only`. 사진 없는 지면에 밝은 활자를 두지 않기 위한 것이다 |
| `dna-figure.html` | `delta` `first` · `chat` `chat-pending` | 묶음이 둘(§2 문법 — 같은 부모 아래 형제끼리). `previousTotal` null → `first` · `chatApplied` false → `chat-pending` |
| `rough-guess.html` | (없음) | 비슷함은 변형이 아니라 `data-if=".similar"` + CSS(`.sim ~ *` 숨김) |
| `setlog.html` | `two` `one` | `columns.length` |
| `sponsored.html` | `with-image` `type-only` | `payload.image` 유무 |
| `photo-break.html` | `land` `port` | 사진 `width ≥ height` → `land` |
| `contents.html` | `short` `long` | `@toc.length` 8 이하 `short`(v1.2.4 모양 그대로) · 9~18 `long` |
| `note.html` | `rows` `grid` | `@note.materials.length` 5 이하 `rows`(v1.2.4 표 그대로) · 6~10 `grid` |

**AI가 고르는 게 아니라 개수가 결정한다**(§3-1). `grid-4`는 2×2,
`grid-2`·`grid-3`은 한 줄이다.

`tm-articles`는 렌더러가 `grid-2/3/4`만 고르고, **사진 유무에 따른 모양은 CSS가 고른다**(§11 ②).

---

## 4. 테마

`<html data-theme="basic">`의 값만 바꾼다. 지면 HTML 하나가 6테마를 모두 그린다.
각 지면은 `base.css` 하나와 테마 6개를 모두 링크하고, 테마 파일은 CSS 변수만 담는다.

| 키 | 바탕 | 잉크 | 서브 | 액센트 | 상단 바 |
|---|---|---|---|---|---|
| `basic` | `#F2EDE4` | `#2B2723` | `#8C8378` | `#7E7568` | 없음 |
| `hip` | `#EAF8F0` | `#07110D` | `#4C6659` | `#0E5C3F` | 4단 |
| `neon` | `#FFE4F0` | `#12040B` | `#7C2A52` | `#6E1240` | 4단 |
| `lovely` | `#F7E3E6` | `#4A2836` | `#8A8072` | `#7C5566` | 없음 |
| `night` | `#111527` | `#EDEAE2` | `#8D93A8` | `#B9AE8C` | 없음 |
| `ondol` | `#F0EBDE` | `#1F1B18` | `#8E8474` | `#6B6055` | 없음 |

전부 **기존 발행물 PDF의 콘텐츠 스트림에서 그대로 읽은 값**이다(래스터 추정이 아니다).

### 테마별로 다른 것

- **상단 3mm 그라디언트 바**는 `hip`과 `neon`에만 있다. 모든 지면 위쪽에 깔린다.
  - `hip` — `#0E5C3F 0% · #42E695 45% · #2BFF9E 72% · #17EAD9 100%`
  - `neon` — `#4A0A38 0% · #C4126A 32% · #FF2E88 62% · #E879F9 100%`
  - 둘 다 PDF 셰이딩 객체(`FunctionType 3`, `Bounds`)에서 그대로 옮겼다. **3단이 아니라 4단이다.**
- **활자 표지 전용 장치**는 `lovely`(아치)와 `ondol`(광택)에만 있다(P1 보드). `.theme-device`가 그린다.
- **어두운 바탕은 `night` 하나뿐이다.** `hip`·`neon`은 밝다(R24-1 정정 반영).

### 명도 주의

`basic`·`lovely`·`ondol`의 서브 잉크는 바탕 대비 **3.1~3.2:1**이다(8pt 라벨에 쓰인다).
기존 발행물의 값을 그대로 옮긴 것이라 이번 재구성에서 바꾸지 않았다.
실물 인쇄(Year 2)로 갈 때 한 번 다시 보기를 권한다.

---

## 5. 넘침 — 타임라인 2면 분할 기준

판면 가용 높이는 **953px (252.1mm)**다(위 60px · 아래 110px). v1.2.3부터 **높이의 원본은 §12의 실측 표(`measure.json`)**다.
v1.2.2까지 이 자리에 있던 stop 높이표(메모 50자 기준)와 "50자마다 29px" 규칙은 **폐기한다** — 줄바꿈과 긴 장소 이름을 세지 못했고,
짧은 메모 · 메모 없는 구간은 실제보다 크게 잡았다(§12 비교표).

- 나누기: 구간 높이(§12 식)를 앞에서부터 더해 953px을 넘으면 다음 면. 한 구간이 953px을 넘으면 렌더 실패(원문을 자르지 않는다).
- **두 면이 되면 순서를 지킨 채 두 면 높이 차가 가장 작게 다시 나눈다**(v1.2.3, #9) — 둘째 면 아래 절반이 비던 것.
- 유저 메모와 AI 캡션은 **동시에 그리지 않는다**(§3-1 — 메모가 있으면 `aiCaption`은 `null`).
- 1차 방어는 **생성 단계의 문자열 길이 상한**(84-c), CSS `.clamp*`는 안전망. 원문(메모)은 상한도 clamp도 없다 — 그래서 실측 표가 필요하다.

---

## 6. 판면 규격

`CORNER_LAYOUT` §0-3b를 그대로 구현했고, 기존 PDF 실측과 일치한다.

| 항목 | 값 | px(96dpi) |
|---|---|---|
| 상단 마진 | 16mm | 60 |
| 하단 마진 | 20mm | 76 |
| 좌우 마진 | 18 / 18mm | 68 |
| 판면 | 174 × 261mm | 658 × 987 |
| 본문 | 9.4pt / 행간 172% | 12.5px / 1.72 |
| 본문 폭 | 140mm | 529 |
| 인용 폭(`sw-quotes`) | 118mm | 446 |

내부 치수는 **px @96dpi**로 적었다(1px = 0.75pt). P1 보드가 같은 좌표계로 그려져 있어
보드 값을 그대로 옮길 수 있다.

### 판면 밖 허용 요소 (#3)

지면 검사(`safe`)가 판정에서 빼는 것 — **이것 말고 판면 밖 글자는 0이어야 한다**(인쇄 프로필 M4-3 전 조건).

| 요소 | 표시 | 왜 |
|---|---|---|
| 러닝헤드 | `.run` | 위 여백 안이 정위치 |
| 폴리오 | `.folio` | 아래 여백 안이 정위치 |
| 사진 위 글자 | `.ph` 안 | 풀블리드 사진 위 |
| 발행 노트 `ONDOLOG` 워드마크 | `data-margin` | 폴리오 줄의 짝 |

v1.2.2까지 판면 밖에 있던 `bottom:62px` 줄(타임라인 경로 · 합계, 인용면 안내, 이달의 우리 마무리)과 뒤표지 이름 줄(`bottom:60px`),
목차 고지(`bottom:72px`), 활자 표지 표제(`left:64px`)는 **모두 판면 안(`bottom:76px` · `left:68px`)으로 옮겼다.** 시험 6권에서 safe 0.

> `CORNER_LAYOUT` §3-3의 "텍스트 블록 폭 최대 55%"는 §0-3b가 "55% 규칙을 폐기하고
> `sweet_words`는 68%(118mm)"로 덮어썼다. **68%를 따랐다.** §3-3 본문이 낡았다.

---

## 7. 남은 것

1. **다정 지수(`payload.warmthIndex`) 산출식이 아직 없다**(`CORNER_CONTENT` §10). 그래서 지면에서
   `data-optional`이다 — `null`이면 줄째 빠진다(R25-1).
2. **`@sw.openerPhoto`의 원천을 디자인이 정했다** — 이미 지면에 실린 사진 중 표지·목차·뒤표지가
   쓰지 않은 첫 사진. `sweet_words` 스키마에 사진 필드가 없어서다(§3-3은 오프너 사진 1장을 요구한다).
   다른 원천을 쓰실 거면 알려 주세요.
3. **`.evidence`(tm-articles) 한 줄 조립**은 `CORNER_LAYOUT` §3-4 규칙을 렌더러가 수행한다.
   지면은 완성된 한 줄을 받는다.

## 8. 파일 — 68개 (v2.0.0)

반입 뒤 **개수와 이름을 이 표로 대조**한다. 글롭이 아니라 전부 적었다.

> v2.0.0 — 이번 압축에는 **`measure.json`이 들어 있다**(새 지면 칸 `v2`가 처음 생겨서). 값은 디자인 환경(Linux · Chromium) 실측이다 — **저장소의 환경 실측판을 덮으므로 같은 커밋에서 `tools/measure.py`를 렌더 PC에서 다시 돌린다**(R138 · §10 ④ F1). 개발의 `measure.env.json`은 개발 파일이라 세지 않는다.

| 자리 | 개수 | 파일 |
|---|---|---|
| `(루트)` | 4 | `.gitignore` · `README.md` · `base.css` · `measure.json` |
| `pages` | 28 | `appendix-calendar.html` · `appendix-postcard.html` · `back.html` · `colophon.html` · `contents.html` · `cover-photo.html` · `cover-type.html` · `da-article.html` · `da-opener.html` · `da-places.html` · `da-timeline.html` · `dna-axes.html` · `dna-figure.html` · `guest.html` · `interview.html` · `league-board.html` · `league-report.html` · `next.html` · `note.html` · `over-shoulder.html` · `photo-break.html` · `rough-guess.html` · `setlog.html` · `sponsored.html` · `sw-opener.html` · `sw-quotes.html` · `tm-articles.html` · `tm-lead.html` |
| `themes` | 6 | `basic.css` · `hip.css` · `lovely.css` · `neon.css` · `night.css` · `ondol.css` |
| `tools` | 7 | `README.md` · `audit.py` · `measure.py` · `preview.py` · `resolve.js` · `sample.py` · `sweep.py` |
| `fonts` | 8 | `LICENSES.md` · `MaruBuri-ExtraLight.otf` · `MaruBuri-Light.otf` · `MaruBuri-Regular.otf` · `MaruBuri-SemiBold.otf` · `Pretendard-Bold.otf` · `Pretendard-Medium.otf` · `Pretendard-Regular.otf` |
| `images/sample` | 13 | `back.jpg` · `contents.jpg` · `cover.jpg` · `da_01.jpg` · `da_02.jpg` · `da_03.jpg` · `da_04.jpg` · `da_05.jpg` · `da_06.jpg` · `da_open.jpg` · `p_park0.jpg` · `sw_open.jpg` · `tm_01.jpg` |
| `samples` | 2 | `sample_issue_basic.pdf` · `sample_issue_night.pdf` — 견본 호(본지 24쪽 + 별지 2). **렌더 결과가 아니라 틀의 견본 글자 그대로** |
| **합계** | **68** | v1.2.4 50 → +15 지면 · +1 `tools/sample.py` · +2 견본 PDF. 지울 파일 0 |

장식 이미지는 쓰지 않는다. `images/`에 있는 것은 전부 미리보기용 견본이다.
`images/sample/`은 렌더 결과에 들어가면 안 된다.

---

## 9. v1 → v1.1 이름 대조표

`ONDOLOG_CORNER_CONTENT.md`에 맞춰 코너 안 슬롯을 전부 다시 판정했다.
**경로는 코너 봉투 기준**이다 — `header.*` / `payload.*`(§0-3). 셋으로 나뉜다.

### ① 문서에 있는 필드 — 이름만 바꿈

| v1 | v1.1 | 지면 |
|---|---|---|
| `articles[featured].title` | `payload.articles[featured].title` | da-opener |
| `articles[featured].stops[0].photos[0]` | `payload.articles[featured].stops[0].photos[0].path` | da-opener |
| `articles[i].stops` | `payload.articles[i].stops` | da-timeline |
| `.photos[0]` · `[1]` · `[2]` | `.photos[0].path` · `[1].path` · `[2].path` | da-timeline |
| `.photoLabel` | `.photos.length` (앞 글자 "사진 "은 지면에 박음) | da-timeline |
| `.userNotes[0].by` | `.userNotes[0].authorName` | da-timeline |
| `closingQuestions` | `payload.articles[featured].closingQuestions` | da-places |
| `.basis` | `.basis` (그대로, `suggestion`만 값이 있어 `data-optional`) | da-places |
| `articles[i].recalled` | `payload.articles[i].recalled` | da-article |
| `articles[i].recallReason` | `payload.articles[i].recallReason` | da-article |
| `articles[i].title` | `payload.articles[i].title` | da-article |
| `warmthIndex` | `payload.warmthIndex` | sw-opener |
| `main` · `sub` | `payload.main` · `payload.sub` | sw-quotes |
| `.at` | `.attribution.at` | sw-quotes |
| `theme.headline` · `theme.lead` | `payload.theme.headline` · `payload.theme.lead` | tm-lead |
| `summary.metrics` | `payload.theme.signals` (`.count` · `.value`) | tm-lead |
| `articles` · `.title` · `.body` · `.evidence` | `payload.articles` · (항목 경로 그대로) | tm-articles |
| `.no` | `.seq` | tm-articles |
| `articles.count` | `payload.articles.length` | tm-articles |
| `closing` | `payload.closing` | tm-articles |
| `header.title`(코너명) | `header.title` · `header.periodLabel` | sw-opener · tm-lead |

### ② 결정론으로 계산되는 값 — 코너 밖 이름으로

렌더러가 계산한다. **LLM이 만들지 않는다.**

| v1.1 이름 | 계산 방법 |
|---|---|
| `@da.regionLine` | `payload.summary.regions.join(", ")` + `" · "` + `header.periodLabel` |
| `@da.lead` | 고정 틀: `"{periodLabel의 달}에 두 사람이 함께 보낸 날은 {데이트 수}번이었습니다. {regions.join(", ")}, {stop 수}곳을 거치며 남긴 {사진 수}장의 사진과 {메모 수}개의 메모를 그대로 실었습니다."` — 숫자와 지역명만 들어간다. **숫자는 지면에 실제로 실린 것만 센다**(R26-5): 사진은 stop당 3장 상한을 적용한 뒤의 수, 데이트는 재소환(`recalled: true`)을 뺀 이번 기간 것만. 틀이 "그대로 실었습니다"라고 말하므로 세는 대상도 실린 것이어야 한다 |
| `@da.featuredDate` · `@da.articleDate` | `dateOn`("2026-08-19") → `"2026.08.19"` |
| `@da.regionEn` | `region`을 국어의 로마자 표기법으로. 실패하면 빈 값 → 줄 삭제 |
| `@da.startTime` · `@da.endTime` | featured 기사의 `stops[0].time` · `stops[마지막].time` |
| `@da.stopCount` · `@da.photoCount` | `stops.length` · `stops[].photos.length` 합 |
| `@da.records` | `"남긴 기록 · 메모 {userNotes 합}"` + `aiCaption`이 있으면 `" · AI 캡션 {수}"`. 둘 다 0이면 빈 값 → 줄 삭제 |
| `@da.articleNo` | `articles` 안 순번(1부터), 두 자리 |
| `@da.route` · `@da.articleRoute` | `stops[].placeName`을 `" → "`로 이음. 이름이 `null`인 stop은 **"이름을 남기지 않은 곳"**(v1.2.4 정정 — 타임라인 · 장소 목록 · 경로 · 글만 있는 기사 구간 목록 모두 같은 말, R50-3) |
| `@da.totals` | `"사진 {합}장 · 메모 {합}"` |
| `@da.routeSummary` | `"{summary.regionCount}개 지역 · {전체 stop 수}개 장소"` |
| `@da.routeHeadline` | 고정 틀: `"{달}에 두 사람이 그린 지도"` |
| `@da.places` | 전체 `articles[].stops[]`를 순서대로 편 배열. 항목: `.date`(소속 기사 `dateOn` → `"08.19"`) · `.placeName` |
| `@da.articlePhotoCount` · `.articleNoteCount` · `.articleStopCount` · `.articleCaptionCount` | 해당 기사의 합계 |
| `@da.articlePhotos` | 그 기사 `stops[].photos[]`를 편 뒤 상위 3장. 항목: `.path` · `.caption`(유저 메모 원문) · `.authorName` · `.aiCaption`. **v1.2.3**: 그 사진이 속한 구간의 **첫 사진**에만 그 구간의 메모(`.caption`) 또는 메모가 없을 때 `aiCaption`(`.aiCaption`) — 둘을 함께 싣지 않는다 |
| `@da.articleHero` | v1.2.3 — 기사 히어로 사진 = 구간 순서대로 사진이 있는 첫 구간의 첫 사진(R84-1). 없으면 빈 값 → `hero-none` |
| `@da.articleStops` | v1.2.3 — `hero-none`의 구간 목록. 항목: `.time`(`14:20`) · `.placeName` · `.userNotes`(메모 원문) · `.aiCaption`(메모가 없을 때만). §12 가용 높이에 들어가는 데까지 |
| `@sw.openerPhoto` | 이미 지면에 실린 사진 중 표지·목차·뒤표지가 쓰지 않은 첫 사진. 없으면 빈 값 → 사진 틀 삭제 |

`.type`(세 물음)은 열거값을 한글로 바꿔 넣는다 — `rating` → 평가 · `recall` → 회상 · `suggestion` → 제안.

**`payload.articles[i].recallReason`은 `anniversary`일 때만 적는다**(R26-4).
`"{이번 호 연도 − dateOn 연도}년 전 이맘때"`. `sparse_month`·`never_featured`는 **빈 값**이고,
지면에서 사유 줄이 라벨째 빠진다(`data-optional`). 배지와 날짜만 남는다.

> `sparse_month`를 "기록이 적은 달"로 적으면 두 사람의 한 달을 평가하는 말이 되고,
> `never_featured`는 내부 용어다. v1.1의 번역 두 개는 쓰지 않는다.

**렌더러가 조립한 고정 틀 문장은 발행 노트에서 "온도록이 쓴 문장"으로 센다**(R26-5) —
`@da.lead` · `@da.routeHeadline` · `@back.closing`.

`.evidence`(tm-articles)는 `Evidence[]`를 §3-4 규칙대로 한 줄로 조립한다
(`message` → `excerpt`를 따옴표로, 15자 초과면 날짜만 · `photo` → `"사진 n장"` · `metric` → 한글 라벨 + 값).

### ③ 어디에도 없어 지면에서 뺀 것

| v1 | 왜 뺐나 |
|---|---|
| `summary.weather` | **날씨는 수집하지 않는다.** 지면이 요구하면 생성 단계가 지어낸다 |
| `articles[featured].lead` · `articles[i].lead` | `DateArticle`에 기사 본문 필드가 없다. 그날의 서사는 타임라인 지면이 사진과 메모로 말한다 |
| `route.caption` | "같은 동네 이동 · 평점 · 다른 날" — 어느 필드에서도 나오지 않는다 |
| 장소 목록의 `.badge`("처음") | 첫 방문 여부는 content에 없다. `@da.routeSummary`의 "그중 n곳이 처음"도 같은 이유로 뺐다 |
| `articles[i].kicker` | "그때 그 시절"은 `recalled` 배지의 고정 문구다. 슬롯이 아니라 지면에 박았다 |
| `recallReason`의 `sparse_month` · `never_featured` | R26-4. 적지 않는다 — 위 ②의 단서 |
| `page.kicker` · `page.disclosure` | 고정 문구. 지면에 박았다 |
| 장소 번호 · 물음 번호 | 스키마에 순번이 없어 **CSS 카운터**로 센다. 없는 필드를 만들지 않았다 |

### ④ 문구 하나를 바꿨습니다

`— 세준이 남긴 메모` → **`— 세준의 메모`**.
앞 형태는 이름의 받침에 따라 조사가 달라져(…이/…가) 렌더러가 한국어 문법을 판정해야 합니다.
`의`는 받침과 무관해서 이름을 그대로 끼우면 됩니다. 뜻은 같습니다.

---

## 10. v1.2.4 → v2.0.0 바뀐 것 (묶음 5 · 2026-11-26)

> 근거: `PM_request_design_batch5_2026-11-25.md` · 기획서 r157 · ROADMAP R157 · 계약 `docs/magazine-2-0/contracts/`(초안). **계약에 없는 칸은 그리지 않고 ③ 필드 요청으로 적었다.**

### ① 정정 묶음 (요청서 3부)

| # | 항목 | 처리 | 근거 · 검증 |
|---|---|---|---|
| 1 | 뒤표지 바닥 상자가 판면보다 넓음(`back.html` `left:0;right:0`) | **고침** — 바닥 상자 · 맺음 상자 모두 `.col`(판면 폭) | ㅋ×60 별명 · 긴 이름+URL: 판면 밖 글자 7 → 0 |
| 2 | tm-lead 표제 상자 폭 없음 | **고침** — `.col` | ㅋ×70 표제: 2,588px까지 나감 → 0 |
| 3 | tm-lead 요약 숫자 `flex:none` | **고침** — `0 1 auto`(최소 96px) · 라벨이 꺾임 | |
| 4 | 발행 노트 막대 안 퍼센트가 13% 미만에서 숨음 | **그대로** — 아래 문장 수 줄에 두 숫자가 다 있다. 제안만: 퍼센트를 막대 **위 줄 양 끝**("두 사람 8%" 왼쪽 · "온도록 92%" 오른쪽)으로 옮기면 폭과 상관없이 늘 보인다(막대는 그림만) | 요청서 "지금대로 둬도 됨" |
| 5 | 덩어리를 틀이 스스로 꺾기 | **고침** — `base.css` `overflow-wrap:break-word` → `anywhere`(keep-all 그대로) | 28지면 글 칸 전부 ㅋ×80: 판면 밖 0 · v1.2.4 13지면 견본 **픽셀 같음** · 높이 표 **값 같음** → **`DEV_TEMP_CSS_92` 삭제 가능** |
| 6 | 예전 D1 남은 것 | `measure.py` 판 이름 **v2.0.0** · README 재소환 사진 셈(R51-2 · R138-3) · "두 사람 48%" · 표지 겹침(R145-6) · 0인 조각 · 낱말 단위 줄바꿈 + 높이 표 = **v1.2.4에서 이미 처리**(§10-1 · §11 ⑬ ⑭) — 바꿀 것 없음 | §10-1 |

### ② 새 지면 · 호 전체

- 새 15틀 = §1 두 번째 표. 규칙은 §13.
- **목차** — `long` 변형(두 단 · 한 단 9줄 · 18항목까지). 8항목 이하는 v1.2.4 모양 그대로(`short`).
- **발행 노트** — 재료 6줄 이상이면 두 단(`grid`). "비어 있는 코너" → **"빠진 코너"**: "코너 — 이유" 한 줄씩 위아래로(기획서 문장 그대로). 흐르는 한 단이라 줄이 늘면 아래가 밀리고, 지면을 넘으면 렌더 실패(R152-2).
- **뒤표지** 주석 — R157-7 뜻("사실은 허용 · 약속 문장 금지")으로 정정. 다음 달의 사실은 「다음 달」 지면이 싣는다.
- **쪽 수** — 견본 호 = 본지 24쪽(4의 배수) + 별지 2. 사진 한 장은 `land` · `port` 두 변형이라 어느 사진으로도 한 쪽을 채운다. 판권 · 정오는 아래 여백을 비워 두는 지면이라 "판권 여백" 순서에 맞다.

### ③ 필드 요청 (계약에 넣을지 PM 결정)

| 계약 | 요청 |
|---|---|
| `love_dna` | `partners[].name` 등재 · `partners[].bigFive` 키 `o c e a n`(정수) 확정 — 축 비교면이 바로 읽으므로 **`bigFiveComparison[]`은 지면에서 안 씀**(relation 판정 기준 질문도 닫힘) · `sternbergOverlap` = `{intimacy:{a,b}, passion:{a,b}, commitment:{a,b}, note}`(삼각형 대신 세 축) · `score.chatApplied: boolean`(A1 ⑨ 전 "채팅 반영 전") |
| `rough_guess` | `items[]`를 꼴별로 나눔 — `estimates[3]{key,label,subject,percent,similar}` · `measured`(채팅 30건 미만 null)`{reply:{a:{name,text},b:{name,text},similar}, talkFirst:{a:{name,percent,percentText},b:{name,percentText},similar}, emoji:(같은 꼴)}` · `busiestDay.dateText`(null 허용) · `monthlyTopic.title` · `.text` · 라벨 승인: 1 먼저 고백했을 확률 · **2 한발 먼저 물러서는 쪽**(MASTER "갈등 회피 지수"를 따뜻한 말로) · 3 기념일을 챙기는 정도 · 비슷함 규칙을 4 · 5 · 6에도(4번 시간은 작은 값 ÷ 큰 값 ≥ 0.9 제안) · `skip_note` = DNA와 같은 문장 |
| `league_monthly` | `current.cards[2]{name, ovr, ovrDeltaText, stats}`(문법에 `[last]` 없음) · `matchReport{weekLabel, items[11]{term,label,valueText,measured}}`(마지막 주만) · `statChanges[]{name,statLabel,changeText,explanation,evidence[]{dateText,excerpt}}` · `statBreakdown[6]{statKey,a,b}` · `normVersion` · `coeffVersion` · **`pages.max` 2 → 3**(변동 해설 원문이 길면 되받기) · `skip_note` "연애리그는 대화가 오간 주가 두 주 이상인 달에 실립니다" |
| `offline_setlog` | `dayText`("9월 17일 수요일") · 한 열 최대 조각 **6**(2면 × 3) · `overlaps[]` → `@setlog.overlapLine` · `skip_note` "이번 달에는 셋로그가 없어 싣지 않았습니다" |
| `couple_interview` | `answers[]{name, own, partnerName, predictedByPartner}` — 지면은 **그 사람의 답 + 상대가 짐작한 그 사람의 답**을 짝지어 싣는다(저장은 "내가 짐작한 상대 답"이니 렌더러가 짝을 바꿔 넣음) · `rounds[].label` · **`mostDivergent` 삭제**(판정에 가까움 · 지면에 안 실음) · `pages.max` 3(문항 단위 되받기) · `skip_note` "이번 달에는 두 사람이 모두 답한 회차가 없어 싣지 않았습니다" |
| `special_guest` | `responses[].answers[3]{text}`(질문별 · 빈 질문 빠짐) — 웹은 질문마다 **100자**(한 사람 최대 300자 = 계약 제안 300) · 닉네임 20자 · `skip_note`는 **기념일 달인데 실을 글이 0일 때만** "실을 글이 없어 싣지 않았습니다"(기념일 없는 달마다 적으면 소음) |
| `over_shoulder` | `cells[]{label, valueText, nText}` · `redactedCount` · `activeCouples` · **`ourValue` 삭제**(나란히 싣지 않음 — 17-2 절대평가) |
| `sponsored` | `image{path,width,height}` · `skip_note`: **적지 않음**(협찬 없음은 독자에게 사유가 아님 — 계약 열린 질문에 답) |
| `appendix` | 달력 값은 렌더러 계산(§2 `@calendar.*`) · `postcards[]{path, caption}` · 사진 1장이면 엽서 한 장만(면 유지) |
| `next_issue` | `milestones[]{label, dateText}` · `openingCorners[]{text}` = **사실 문장 상수표**(예: 특별 게스트 → "기념일이 있는 달이라 특별 게스트 링크를 만들 수 있습니다") — 달력 사실로 정해지는 코너만 |
| `colophon` | 판권 줄 9개(§2 `@colophon.*`) · `errata[]{where, text}`(지난 호 정정 · 없으면 빠짐 — 입력 길은 운영) · 호 번호 · 발행일은 찍지 않음(표지 규칙과 같게) |
| `publication_note` | 계약 `payload.notUsed[]`(빠진 코너 문장)는 이름이 기존 `@note.notUsed`(싣지 않은 재료)와 겹친다 → **`skippedCorners`로** 바꾸고 틀은 `@note.emptyCorners`에 "코너 — 이유" 한 줄로 받는다 · 새 재료 줄은 `@note.materials[]{label,collected,used}`에 그대로 더함 |

### ④ 개발이 할 일 (반입 위임 — R157-12 ⑨)

| # | 할 일 |
|---|---|
| F1 | **`render/issue/tools/measure.py`를 렌더 PC에서 다시 돌려 `measure.json`을 같은 커밋에** — 이 압축의 값은 디자인 환경 실측이다(R138) |
| F2 | 렌더러 `DEV_TEMP_CSS_92` 삭제(§10 ① 5) · `.gitignore`에 `*.zip` 한 줄(R157-12) |
| F3 | 새 변형 고르기(§3 v2.0.0 줄) · 새 계산 값(§2 v2.0.0 표) · `@sample.stamp`는 실제 호에서 **늘 빈 값** |
| F4 | 되받기 대상 반복 블록 등록(R152-2): `setlog` `.entries` · `interview` `payload.rounds` / `.questions` · `guest` `payload.responses` · `league-report` `payload.statChanges`. 높이는 `measure.json` `v2`(§13-3) |
| F5 | 약속 문장 금지 검사(R157-7)를 `next.html` · `colophon.html` · `note.html` 출력에 건다 — 틀의 고정 문구는 모두 통과하게 썼다 |
| F6 | 2.0-A1 임시 틀(`render/temp_pages/`)을 이 틀로 교체 · 지면 제목 표에 새 제목(「두 사람의 결」 · 「어림짐작」 · 「각자의 하루」 · 「우리 사이」 · 「특별 게스트」 · 「어깨너머」 · 「협찬」 · 「부록」 · 「사진 한 장」 · 「다음 달」 · 「판권 정오」*) — *「판권 · 정오」의 가운뎃점은 정규식 `^[가-힣 ]{1,7}$` 밖이다 → 제목 표는 "판권 정오", 지면 러닝헤드만 "판권 · 정오"(PM 확인) |
| F7 | 목차 `long` 변형 · 발행 노트 `grid` 변형 선택 · 빠진 코너 문장 = "코너 — 이유" |

## 10-0. v1.2.3 → v1.2.4 바뀐 것

> 바탕: 디자인 보관 v1.2.3(저장소에 들어간 판과 같은 틀). 요청 번호는 `PM_request_design_batch4_2026-11-23.md` 1부.

### ① 개발 임시 수정 — 확정 / 다르게

| # | 자리 | 처리 | 내용 |
|---|---|---|---|
| a | 기사 · 오프너 제목 `keep-all` | **확정 · 넓힘** | 제목 칸만이 아니라 **모든 글 칸**에 `base.css` `body{word-break:keep-all; overflow-wrap:break-word}`. 틀 하나하나의 `keep-all`은 필요 없다(개발이 넣은 것은 지워도 되고 둬도 같다) |
| b | 발행 노트 막대 "두 사람 48%" | **확정 · 틀이 맡음** | 원인: 막대가 `display:flex`라 글자와 숫자 사이 공백이 사라졌다. 틀에 `gap:.35em` — **데이터 쪽에서 공백을 넣었다면 빼 주세요**(두 번 띄워진다) |
| c | 0인 조각 4곳 | **확정** | §11 ⑬ 표 |
| d | 근거 날짜 발췌마다 | **확정** | §11 ⑤ 덧붙임. 같은 날이면 끝에 한 번 |

### ② 새로 고친 것

| # | 내용 |
|---|---|
| e | 모든 글 칸 낱말 단위 줄바꿈(위 a). 높이 표에 여유 한 줄(§12). **바뀐 칸 목록 → ③** |
| f | §9-② `@da.route` 문장 정정 — "건너뜀" → "이름을 남기지 않은 곳" |
| g | §11 ⑩ · §10-v1.2.3 7번 문장 정정 — 발행 노트 게재 수는 재소환을 빼고 표 아래 줄로 따로(R51-2) |
| h | §11 ⑭ — 이달의 우리가 빠진 호의 표지. 틀 `cover-photo` · `cover-type`에 `@cover.headlineBy` 줄 |

### ③ e로 높이가 바뀐 칸 — 렌더 환경에서 다시 잴 것

**`measure.json`의 모든 줄 수 표**를 다시 잰다(`tools/measure.py`를 그대로 돌리면 된다). 디자인 환경에서 v1.2.3 표 대비 바뀐 칸:

| 표 (`measure.json` 경로) | 칸 · 서체 · 폭 | 낱말 단위만(여유 전) 바뀐 칸 | 여유 줄 뒤 |
|---|---|---|---|
| `timeline.memoLines` | 타임라인 메모 · MaruBuri 16.7/29 · 545px | 8 / 84 | 두 줄 이상 칸 모두 +1 |
| `timeline.captionLines` | 타임라인 AI 캡션 · Pretendard 10.9 · 545px | 5 / 84 | 같음 |
| `timeline.placeLines` | 타임라인 장소 이름 · 11.5px · **68px** | 11 / 20 (최대 +2줄) | 같음 |
| `quotes.turnLines.odd` · `.even` | 인용 턴 · MaruBuri 12.5/1.75 · 446 · 404px | 8 / 84 · 10 / 84 | 같음 |
| `quotes.contextLines` | 인용 정황 · 9.5px · 446px | 0 / 32 | 같음 |
| `article.stopMemoLines` | 글만 있는 기사 메모 · MaruBuri 15/26 · 545px | 10 / 84 | 같음 |
| `article.photoCaption.{1,2,3}.memoLines` | 기사 사진 아래 메모 · 10.1px · 658 · 320 · 208px | 1 · 8 · 9 / 60 | 같음 |

상자 식(고정 높이 · 줄 높이 · 가용 높이)은 바뀌지 않았다. **표에 없는 칸**(높이를 미리 재지 않고 clamp가 받는 칸 — 리드 · 소기사 본문 · 마무리 · 제목 · 표지 · 장소 목록 질문 등)도 줄바꿈이 낱말 단위로 바뀌었다. 이 칸들은 clamp · 길이 상한(84-c)이 받는다 — 시험 7권에서 넘침 · 잘림 0. `tools/sweep.py` 106조합 결과도 v1.2.3과 같다.

### ④ 개발이 고칠 것

| # | 할 일 |
|---|---|
| E1 | `render/issue/` 반입 뒤 `tools/measure.py`를 렌더 환경에서 돌려 `measure.json` · `measure.env.json` 갱신. **이 압축에는 `measure.json`이 없다** — 저장소의 환경 실측판을 덮지 않으려고 뺐다. 다시 재기 전까지 저장소 표는 낱말 단위 줄바꿈을 모른다(작게 어림할 수 있다 — 반입과 재측정은 같은 커밋으로) |
| E2 | 막대 라벨에 넣은 공백이 있으면 빼기(① b) |
| E3 | 표지 `_cover_values`: 표제가 이 달의 말로 바뀌면(`headlineFrom == 'quote'`) `quote` · `quoteBy`를 빈 값, `headlineBy` = 말한 사람. 아니면 `headlineBy` 빈 값 |
| E4 | 리드 둘째 문장 · `@da.records` · `@da.routeSummary`가 §11 ⑬ 표와 같은지 확인(임시 수정이 이미 그렇다면 할 일 없음) |
| E5 | 시험: 대조 권 `batch4_scenario`(메모 0 · 지역 0 · 이달의 우리 없음 · 긴 제목)를 더할 것을 권한다 — 참고 코드는 검토 묶음 diff |

---

## 10-1. v1.2.2 → v1.2.3 바뀐 것

> 바탕: 개발 저장소 `render/` 11/15 사본(로드맵 r99) + 표지 문서 §1-2 · §1-3(84-c2의 두 가지)을 문장대로 반영. 요청 번호는 `PM_request_design_2026-11-18.md`.

### ① 개발이 렌더러에서 바꾼 것 — 디자인 판으로 확정 / 다르게 바꿈

| 개발 수정 | 처리 | 내용 |
|---|---|---|
| 대표 사진 고르기(R84-1 · R85-1) | **확정** | 히어로 = 구간 순서대로 사진이 있는 첫 구간의 첫 사진. 지면은 이 값을 **`@da.articleHero`**로 받는다 — 보기 사본에서 구간 순서를 바꾸던 처리는 필요 없다 |
| 사진 0인 데이트 빼기(R84-2) | **다르게** | 빼지 않는다. `da-article` **`hero-none`** 변형(글만 있는 기사)으로 싣는다. 대표 기사는 그대로 활자 오프너(`type-only`) |
| 사진 축소 150DPI(R85-2 · R87-1) | 확정 · 칸 크기 바뀜 | 바뀐 칸: 오프너 사진 794×491 → **794×560** · 기사 사진 칸 높이 150 → **160** · 이달의 우리 사진 칸 새로(격자별 333 · 234 · 204px 높이). 축소 규칙은 그대로 따른다 |
| AI 문장 길이 상한(84-c) | 확정 · 상한 그대로 | 틀이 받는다: 리드 126 · 소기사 본문 240(clamp 4~6줄) · 마무리 42(한 줄) · 맞춤 질문 60(clamp 3) · 근거 100. **기사 사진 AI 캡션은 3줄(clamp3)**, 이달의 우리 사진 위 AI 캡션은 **한 줄**(넘으면 말줄임) — 캡션 상한이 따로 있다면 30자 이하를 권한다 |
| 시험 데이터 2025년 9월 | 해당 없음 | 대조 그림의 연도는 시험 데이터 그대로 |
| 기사 사진 아래 유저 메모 — 첫 사진 아래 기사의 첫 메모(R50-6 #7) | **다르게** | 사진마다 캡션 칸 하나. **그 사진이 속한 구간의 첫 사진에만** 그 구간의 메모(라벨 없음) 또는 AI 캡션(라벨 줄). 다른 구간의 메모를 끌어오지 않는다(사진과 메모가 어긋나 보였다) |
| 뒤표지 NEXT ISSUE 줄 삭제(R50-6 #10) | **확정** | `@back.nextMonth`는 쓰지 않는다 |
| 목차 재소환 조각(R50-6 #2) | **확정** | §11 ① 표에 반영 |
| 경유지 이름 없음 → "이름을 남기지 않은 곳" | **확정** | 타임라인 · 장소 목록 · 경로 모두 같은 말 |
| 타임라인 "사진 3 / 4"(R50-6 #8) | **확정** | 실린 수 / 전체 수. 0이면 라벨째 빠진다(`data-optional`) |
| `sw-opener` 사진 위 폴리오 밝은 잉크(R50-6 #11) | **확정** | |
| 0인 칸 지우기(`drop_empty_count_cells`, 55-3b · c) | **틀이 맡음** | 칸마다 `data-optional`. 줄의 두 칸이 다 빠지면 줄도 빠진다 — 렌더러 처리는 없앤다 |
| 활자 오프너의 작은 줄 숨김(55-3b) | **확정** | 작은 줄은 `with-photo`에만 있다 |
| 발행 노트 재소환 줄 + 블록 36px 내리기(55-3c) | **틀이 맡음** | 표 아래 줄 자리(`@note.recalledPhotosLine`)를 틀에 두고, 세 블록을 **흐르는 한 단**으로 바꿨다 — top을 고치는 처리는 없앤다 |
| 발행 노트 끝 AI 안내 한 줄(84-c2) | **자리 · 크기 확정** | 정정 요청 위, 괘선 위. 11px · 본문 잉크(정정 요청보다 한 단계 진하게) · 폭 140mm. 슬롯 `@note.aiNotice` |
| 고정 질문 해요체(84-c2) | **확정** | 틀 견본 문구도 해요체(`da-places.html`) |

### ② 요청 번호별

| # | 지면 | v1.2.3 |
|---|---|---|
| 1 | `da-article` | 히어로 틀 `data-optional` + 변형 `hero-photo` / `hero-none`. `hero-none`은 사진 자리 없이 구간 목록(시각 · 장소 · 메모 원문 또는 AI 캡션 라벨 줄)이 지면을 받는다 |
| 2 | `da-article` | 사진 캡션 칸에 **AI 캡션 라벨 줄**(타임라인과 같은 모양: 8.8px 라벨 + 10.1px 문장). 유저 메모에는 라벨 없음 |
| 18 | `tm-articles` | `.photo` = 그 기사 evidence 중 `type:'photo'` 첫 항목의 `photoPath`(남는 사진으로 채우지 않음). 사진 있는 칸이 하나라도 있으면 **격자** — 사진 없는 칸은 같은 높이의 큰 순번 숫자가 받는다(빈 틀 없음). 하나도 없으면 한 단(v1.2.1). 사진 위 한 줄은 **AI 캡션만**(`.photoAiCaption`, 라벨 줄) — 유저 메모는 원문이라 한 줄 칸에 싣지 않는다 |
| 19 | `note` | 위 ① 마지막에서 둘째 줄 |
| 26 | `da-places` | 고정 질문 견본을 해요체로. 정확한 문구는 코드가 정본 |
| 1-1 | 템플릿 고정 문구 | 합니다체로: 속표지(목차 바닥) 고지 = **"두 사람이 남긴 말과 사진은 고치지 않고 실었습니다. 온도록이 쓴 문장은 발행 노트에 따로 적었습니다."**(정본, "따로" 추가) · 발행 노트 정정 요청 "알려 주세요" → **"알려 주십시오"**. 칸별 말투는 §11 ⑪ |
| 3 | 판면 | 판면 밖 글자 0 — §6 "판면 밖 허용 요소" |
| 4 | 날짜 | §11 ⑧ · ⑨ — 지금 렌더러 값을 받는다 |
| 5 | 높이 | §12 — 실측 표가 원본. 규칙 문장 폐기 |
| 6 | `note` | 막대 폭 경로 `@note.ratioPeopleWidth` · `@note.ratioOndologWidth`(숫자) / 글자 경로 `@note.ratioPeople` · `@note.ratioOndolog`(`"34%"`) |
| 7 | `da-opener` | 문구를 바꾸지 않는다. 오프너의 사진 수는 "이날의 기록"(대표 기사의 하루), 리드의 사진 수는 "이번 달에 남긴 사진"으로 읽힌다 — 둘 다 재소환을 빼고 세는 것이 사실과 맞다. 발행 노트 표의 게재 수는 재소환을 **빼고**, 재소환 사진은 표 아래 `@note.recalledPhotosLine` 줄로 따로 센다(R51-2, v1.2.4 정정) — 세 숫자의 뜻이 다르다는 것을 §11 ⑩에 적었다 |
| 8 | 여러 지면 | 위 ① |
| 9 | 빈 공간 | `da-opener`: 사진 560px로 키우고 아래 블록을 내려 받음 · 타임라인 둘째 면: 고르게 나누기(§5) · `tm-articles` 한 단: 2~3편이면 활자를 키움 · **`sw-quotes` 대화 2개 사이 여백과 `tm-lead` 위쪽 절반은 의도된 여백**(인용면은 침묵면의 연장, `tm-lead`는 저중심면 — 원문 · 숫자를 늘려 채우지 않는다) |
| 10 | 55-3 | 위 ① · 표지 이 달의 말 상한은 §11 ⑫ · `tm-lead` 숫자 칸 라벨은 데이터 라벨(12자 안팎)까지 한 줄로 확인 — 더 길면 두 줄로 꺾이고 칸이 넓어진다(겹치지 않음) |

### ③ 개발이 고칠 것 (렌더러 · 시험)

디자인이 렌더러를 고치지 않았다. 아래는 **v1.2.3 틀을 그대로 쓰려면 필요한 것**이다. 디자인 쪽 대조 렌더에서 **D1 · D3 · D4 · D6~D11 · D13과 D2의 값 부분**을 임시로 넣어 시험 6권(새 대조 권 포함)을 통과시켰고, 그 차이를 참고용 diff로 함께 넘긴다. **D2의 "싣지 않은 것" 줄 · D5 · D12는 대조 렌더에 넣지 않았다**(시험 데이터에 그 경우가 없다).

| # | 파일 | 할 일 |
|---|---|---|
| D1 | `compose.py` `choose_variant` | `hero-photo` / `hero-none` — 그 기사(`bind.i`)에 사진이 하나라도 있으면 `hero-photo` |
| D2 | `compose.py` 기사 지면 값 | `@da.articleHero` = `hero_photo_path(a)` · `@da.articleStops`(hero-none일 때만) = 구간 보기 목록(`userNotes` = `memo_notes`, `time` = `14:20`, 메모가 있으면 `aiCaption` null). §12 `article.stopsCapacity`에 들어가는 데까지만 싣고 나머지 구간은 발행 노트 "싣지 않은 것"에 적는다. 보기 사본에서 구간 순서를 바꾸던 처리 삭제 |
| D3 | `compose.py` R84-2 | 사진 0인 일반 기사를 빼지 않는다 |
| D4 | `facts.py` `article_photos` | 캡션 규칙을 ① 표대로(구간의 첫 사진에만 그 구간의 메모 또는 `aiCaption`). 항목에 `aiCaption` 추가. 기사 지면의 `ai_captions_shown` · `memos_shown`을 이 결과로(hero-none은 구간 목록으로) 센다. 문장 출처: 사진 AI 캡션은 온도록 문장 |
| D5 | 기사 사진 아래 메모 높이 | 메모가 칸에 들어가는지 §12 `article.photoCaption`으로 미리 잰다(칸이 쓸 수 있는 높이 104px). 넘으면 그 메모를 싣지 않고 "싣지 않은 것"에 적는다 — 원문을 자르지 않는다 |
| D6 | `compose.py` 이달의 우리 | `a.pop('photo')` 대신 `a['photo']` = 첫 사진 근거의 `photoPath`(**evidence를 한 줄로 바꾸기 전에** 읽는다), `a['photoAiCaption']` = 그 사진이 속한 구간의 `aiCaption`(그 구간에 메모가 있으면 빈 값). 사진은 실린 사진으로 센다(`show`) |
| D7 | `compose.py` 발행 노트 | `ratioPeopleWidth` · `ratioOndologWidth` 숫자 값(+ `note_widths` 키 이름) · `aiNotice` 문장 |
| D8 | `render_issue.py` | `add_note_recalled_line` · `drop_empty_count_cells` 호출 삭제(틀이 맡는다) |
| D9 | `page_audit.py` | safe 판정에서 `[data-margin]` 안을 뺀다(`.run, .folio, .ph`에 더함) |
| D10 | `compose.py` 높이 | `stop_height` · `conversation_height` · 인용 가용 높이를 **`render/issue/measure.json`**에서 읽는다(§12 식). 줄 수는 표의 "글자 수 이상인 첫 칸"(보간 없음), 줄바꿈 조각마다 따로. 인용 가용 높이 3단: 단문 0개 · 1~3개 · 4개 이상 |
| D11 | `compose.py` `split_timeline` | 두 면이면 순서를 지켜 두 면 높이 차가 가장 작게 다시 나눈다 |
| D12 | `render_issue.py` 표지 | 이 달의 말이 **두 줄을 넘으면 줄째 지운다**(§11 ⑫) — `COVER_PROBE_JS`가 줄 수를 센다 |
| D14 | 단위 시험 | 개발의 11/15 사본에서 `pytest render/tests`는 기준선 1건 실패(vol4 "멈춰야 한다" — 위 D13), 대조 사본(D1~D11 · D13 반영)에서 **46건 실패 · 277건 통과**. 실패는 모두 옛 규칙을 박은 시험이다 — 50자마다 29px · 844/781 · R84-2 빼기 · 기사 캡션은 메모만 · 소기사 사진 없음 · `@note.ratioPeople` 막대 경로 · 틀의 `R50-6 임시` 주석 표시 · 뒤표지 사진(실린 사진의 마지막이 이제 소기사 사진일 수 있다). 목록은 대조 묶음의 `test_failures_v1_2_3.txt` |
| D13 | 시험 | `local_volumes.py` 사실 확인의 막대 경로를 `@note.ratioPeopleWidth` · `@note.ratioOndologWidth`로 · `vol4-timeline-overflow`는 **통과 권**으로(실측 944px, 한 면에 들어간다 — "멈춰야 한다"는 옛 어림 기준의 기대였다) · 넘침 판정은 "타임라인 면마다 어림 ≥ 실제" · 디자인 대조 권 `batch2_scenario`(hero-none · 사진 캡션 · 섞인 소기사 사진 · 재소환 줄)를 시험에 더할 것을 권한다 |

### ④ 그 밖

- 지난번(v1.2.2 뒤) **`contents.html` 고정 문구를 합니다체로** 바꾼 것을 이 판에서 확정했다(속표지 고지 · 잉크 설명).
- `tools/measure.py` · `measure.json` 추가(§12). `tools/preview.py` · `sweep.py`의 설정을 새 이름 · 변형에 맞췄다.
- 디자인 감사기(`tools/audit.py`) 13지면 × 6테마 0건 · 쓸기 106조합 결과는 v1.2.2와 같다(사진 3장 구간 3개 같은 의도된 넘침 12건만).

---

## 10-2. 이전 판 — v1.1.1 → v1.2 바뀐 것

### 사실과 어긋나던 표시 (요청 §1·§2)

| # | 지면 | v1.1.1 | v1.2 |
|---|---|---|---|
| 1 | `note` | 출처 막대 폭이 `42%`로 박혀 있었다 | `data-width="@note.ratioPeople"` · `"@note.ratioOndolog"`. **두 칸 모두** 데이터가 폭을 정한다 |
| 2 | `da-article` | 러닝헤드의 "그때 그 시절"이 고정 | `data-if="payload.articles[i].recalled"`로 감쌌다. **배지(본문)는 v1.1.1부터 이미 조건부였다** — 고정이던 건 러닝헤드다 |
| 3 | `da-article` | "Article Two" 고정 | `Article <span data-slot="@da.articleOrdinalEn">` |
| 4 | `da-article` | "그날 남은 사진 중 세 장" 고정 | `data-slot="@da.articlePhotoNote"`. 사진이 없으면 블록째 빠진다(`data-optional`) |
| 5 | `da-opener` | "Article One" 고정 | `Article <span data-slot="@da.featuredOrdinalEn">` |
| 6 | `da-opener` | 첫 stop에 사진이 없으면 빈 자리 | `@da.openerPhoto`(대표 기사 **전체 stop** 중 첫 사진) + `with-photo`/`type-only` 변형 |
| 7 | `sw-opener` | `data-optional`이 기간까지 감싸 라벨이 남았다 | 다정 지수 부분만 감싼다. 지수가 없으면 `"2026년 8월"`만 남는다 |

### 새 이름

| 이름 | 계산 방법 |
|---|---|
| `@da.featuredOrdinalEn` · `@da.articleOrdinalEn` | 영문 서수 — `One` `Two` `Three` `Four` `Five`. 여섯째부터는 숫자(`6`). 대표 기사도 **실제 순번**을 쓴다(첫 기사가 아닐 수 있다) |
| `@da.openerPhoto` | 대표 기사 `stops[].photos[]`를 순서대로 편 뒤 **첫 사진**(§3-1 폴백). 하나도 없으면 빈 값 → `type-only` |
| `@da.articlePhotoNote` | 실린 수 < 전체 수면 `"그날 남은 사진 {전체}장 중 {실린}장"`, 같으면 `"그날 남은 사진 {실린}장"`. 0이면 빈 값 → 블록 삭제 |

### v1.2.1 (R44)

- `tm-articles` 소기사 사진을 **붙이지 않는다**. 사진이 없으면 **한 단**으로 내린다 — §11 ②
- 앱 말투는 해요체로 정해졌다(R44). **발행물은 그대로 합니다체다** — 지면과 앱은 말투가 다르다

### 그 밖

- **원문에서 줄 수 제한을 뺐다** — §12
- **`data-width` 표시를 계약에 더했다** — §2
- **임시 7건을 확정했다** — §11
- 문법 6가지를 §2에 명시했다 — 특히 **처리한 표시 속성을 지우지 않는다**(CSS가 선택자로 쓴다)

---

## 11. 확정 규칙 — ①~⑦ v1.2 · ⑧~⑫ v1.2.3

①~⑦은 개발이 `55-2`에서 임시로 정한 것을 v1.2에서 확정한 것이다. ⑧~⑫는 v1.2.3에서 더했다.

### ① `@toc.desc` — 목차 항목의 설명 줄

**코너가 담은 것을 종류와 개수로 적는다. 형용사를 쓰지 않는다.**

| 코너 | 틀 |
|---|---|
| 데이트 아카이브 | `화보 · {달}의 하루 {이번 기간 기사 수}편` + 재소환이 있으면 ` · 그때 그 시절 {재소환 기사 수}편`(v1.2.3 확정, R50-6) |
| 다정한 말들 | `인용 · 원문 그대로` |
| 이달의 우리 | `기사 · {theme.headline} · 소기사 {articles.length}편` |

목차는 **읽기 전에 재료를 알리는 자리**다(§3-0의 발행 노트와 같은 역할).
"특별한"·"따뜻한" 같은 말이 들어가면 읽기도 전에 평가가 된다.

### ② `tm-articles`의 `.photo` 원천 — **근거가 사진인 기사에만 그 사진**(v1.2.3, 11/18 PM)

`.photo` = 그 기사 `evidence` 중 `type: 'photo'`인 **첫 항목의 `photoPath`**. 근거가 사진이 아닌 기사에는 붙이지 않고, 남는 사진으로 채우지 않는다.

| 그 면의 사진 | 모양 |
|---|---|
| 하나 이상 | 격자(`grid-2/3/4`). 사진 없는 칸은 **같은 높이에 큰 순번 숫자**(`.art-num`, MaruBuri 72px · 액센트 잉크 · 위 괘선)가 받는다 — 줄 높이가 맞고 빈 틀이 남지 않는다 |
| 0 | 한 단(v1.2.1). 기사 2~3편이면 제목 25px · 본문 14px로 키운다(#9) |

사진 위 한 줄은 **AI 캡션만**(`.photoAiCaption` — 그 사진이 속한 구간의 `aiCaption`, 그 구간에 메모가 있으면 빈 값). 라벨 줄 "AI 캡션" + 문장 한 줄.
유저 메모는 원문이라 한 줄 칸에 자르지 않고 넣을 수 없어 싣지 않는다 — 그 메모는 타임라인 · 기사 지면에 이미 있다.

### ③ 시각 표기 — `14:20`

24시간 · 두 자리 : 두 자리 · 콜론. 자정은 `00:00`.
`@da.startTime` · `@da.endTime` · `.time` 모두 같다.

> 타임라인에서 시각이 **세로로 정렬**돼야 한다. "오후 2시 20분"은 자릿수가 들쭉날쭉해 축이 흔들린다.

### ④ `.seq` 표기 — `01`

두 자리, 앞에 0. `seq`가 0부터면 +1 해서 쓴다.

> 지면의 다른 번호가 모두 두 자리다 — 폴리오 `0 4`, 세 물음 `01`, 장소 목록 `01`. 리듬을 맞춘다.

### ⑤ 근거(evidence) 날짜 표기 — `08.22`

월.일, 각 두 자리. **연도는 적지 않는다** — 한 달치 호라 연·월이 자명하다.
**예외: 재소환 기사**(다른 해)는 `2025.08.20`처럼 연도를 붙인다.

**v1.2.4 (#d) — 발췌가 여러 날이면 발췌마다 날짜**: `근거 · “우산 챙겼어?” 09.12 · “연남동 또 가자” 09.20`. 발췌가 모두 같은 날이면 날짜는 끝에 한 번. 15자 넘는 발췌는 지금처럼 날짜만(개발 임시 수정 확정). 줄이 길어지면 소기사 칸 안에서 두 줄로 꺾인다 — 근거 상한 100자 안에서 칸이 받는다.

### ⑥ 캡션 접두 — 접두사를 쓰지 않는다

`AI 캡션`은 **별도 줄의 라벨**로 두고 문장 앞에 붙이지 않는다(타임라인이 이미 그렇다).
`da-article`의 사진 캡션도 같다 — 라벨 한 줄 + 문장 한 줄.
**유저 메모에는 라벨이 없다.** 기본값이 사람이고, 표시는 AI가 쓴 쪽에만 붙는다(§0-4 잉크 3단계와 같은 원리).

### ⑦ 폴리오 형식 — `0 4`

두 자리 + 글자 사이 `.3em`. 쪽 번호는 **표지를 뺀 본문 기준 1부터**.
**표지 2종과 뒤표지에는 폴리오가 없다.**

### ⑧ 다정한 말들 단문 출처 `.attribution.at` — `09.11 23:40` (#4)

지금 렌더러 값을 받는다. **근거 날짜(⑤)와 같은 날짜 규칙 + 시각(③)**: `월.일 시:분`, 이 호의 연도와 다른 해이거나 재소환 날짜면 `2025.09.11 23:40`.
인용 블록의 `attribution.display` 앞 날짜 · 시각도 같은 규칙이고, 뒤의 정황 말(`, 아침 대화 중`)은 그대로 둔다.

### ⑨ 장소 목록 `@da.places .date` — `09.12` (#4)

근거 날짜(⑤)와 같다. 장소 목록은 이번 달 경로라 재소환 장소가 없다(R50-3) — 연도가 붙는 경우가 없다.

> 지면의 **숫자 칸**(시각 · 날짜)은 ③ · ⑤ 표기다. AI가 쓰는 **문장 안**의 시각("오후 1시 10분")은 84-c 규칙이다 — 둘은 다른 자리다.

### ⑩ 사진 수 — 세 자리의 뜻 (#7)

| 자리 | 세는 것 | 재소환 |
|---|---|---|
| 오프너 "이날의 기록 · 사진" | 대표 기사의 하루에 남긴 사진 | 해당 없음 |
| 오프너 리드 "…남긴 N장의 사진" | 이번 달 기사에 실린 사진 | **뺀다** |
| 발행 노트 "실제 게재" | 이번 기간에 실린 사진 | **뺀다** — 표 아래 `@note.recalledPhotosLine` 줄로 따로(R51-2, v1.2.4 정정) |

문구는 바꾸지 않는다 — 리드는 "이번 달에 남긴 사진"으로 읽히므로 재소환을 빼고 세는 것이 사실이다.

### ⑪ 칸별 말투 (R133-4)

| 칸 | 말투 |
|---|---|
| 글 칸 — 리드 · 소기사 본문 · 마무리 · 다정한 말들 해설 | 합니다체 |
| 라벨 칸 — 헤드라인 · 기사 제목 · 신호 값 · AI 캡션 · 정황 · 근거 | 명사형 · 연결형 허용, ~다체 · 반말 없음 |
| 질문 칸 — 맞춤 질문 · 고정 질문 2개 | 해요체("~인가요?") |
| 고정 문구 — 속표지 · 발행 노트 · 목차 등 틀 글 | 합니다체 |
| 원문 인용(두 사람의 메시지 · 메모) | 규칙 밖 — 그대로 |

틀의 고정 문구는 모두 합니다체다(v1.2.3에서 발행 노트 정정 요청을 "알려 주십시오"로 고침).

### ⑫ 표지 이 달의 말 — **두 줄까지** (55-3c)

자리는 그대로(18px MaruBuri, 판면 폭). 두 줄은 약 80자 안팎이지만 **판정은 렌더 결과의 줄 수**로 한다(글자 수 어림이 아니다).
두 줄을 넘으면 **줄째 지운다** — 원문을 자르지 않는다(§12). 64px 표제 아래에서 네 줄짜리 원문은 표제를 누른다.

### ⑬ 0인 조각 (#c, v1.2.4 — 개발 임시 수정 확정)

**0은 문장 · 줄에 쓰지 않는다.** 조각째 빼고, 남는 조각이 없으면 줄째 빠진다(틀의 `data-optional`).

| 자리 | 모양 |
|---|---|
| 오프너 리드 둘째 문장 | 사진 · 메모 둘 다: `…N곳을 거치며 남긴 3장의 사진과 2개의 메모를 그대로 실었습니다.` / 하나만: `…남긴 3장의 사진을 그대로 실었습니다.` · `…남긴 2개의 메모를 그대로 실었습니다.` / 둘 다 0: `…N곳을 거쳤습니다.` |
| 오프너 기록 줄 `@da.records` | `남긴 기록 · 메모 2 · AI 캡션 1`에서 0인 조각을 뺀다. 모두 0이면 빈 값 → 줄째 빠진다 |
| 장소 지도 머리 `@da.routeSummary` | `2개 지역 · 5개 장소` → 지역 0이면 `5개 장소` |
| 발행 노트 "싣지 않은 것" | `(사진 0장)` 같은 괄호 조각을 붙이지 않는다 |
| 타임라인 합계 · 기사 숫자 칸 | v1.2.3 그대로(조각 빼기 · 칸 `data-optional`) |

### ⑭ 이달의 우리가 빠진 호의 표지 (#h, v1.2.4)

이달의 우리가 없으면 표제가 이 달의 말로 바뀐다(MASTER 9-5 r64 — 그대로). 그때 **같은 문장을 두 번 싣지 않는다**:

- 인용 줄(`@cover.quote` · `@cover.quoteBy`)은 **빈 값** → 줄째 빠진다
- 표제 아래 한 줄 **`이 달의 말 · {말한 사람}`**(`@cover.headlineBy`, 13px · 보조 잉크). 활자 표지는 인용 블록 자리(top 676px)에 같은 줄
- 표제를 호 번호나 달 이름으로 바꾸지 않은 이유: 표지 아래 띠에 `9월호`가 이미 있다. 그 달의 문장이 표제인 쪽이 표지답다

표제가 이달의 우리 headline일 때는 지금처럼 `@cover.headlineBy`는 빈 값(줄이 빠짐)이고 인용 줄이 그대로 나온다.

---

## 12. 원문은 자르지 않는다 (R29-3 · MASTER 9-5 r67)

**두 사람이 쓴 문장에는 줄 수 제한을 두지 않는다.** 잘린 원문은 원문이 아니다.

| 자르지 않는 것 (제한 없음) | 어디 |
|---|---|
| `.userNotes[].text` | `da-timeline` · `da-article`(hero-none 구간 목록) |
| `@da.articlePhotos[].caption` | `da-article` 사진 아래 — 칸에 안 들어가면 싣지 않고 발행 노트에 적는다 |
| `.turns[].text` | `sw-quotes` |
| `payload.sub[].text` | `sw-quotes` |
| `evidence.excerpt`(조립된 `.evidence` 줄 안) | `tm-articles` |
| `@cover.quote` 이 달의 말 | 표지 2종 |

| 안전망을 남긴 것 (`.clamp*`) | 왜 |
|---|---|
| `@cover.headline` · `payload.theme.headline` · 기사 제목 | 온도록이 썼다 |
| `.aiCaption` · `@da.lead` · `@da.routeHeadline` · `.context` · `closingQuestions[].text` · 소기사 본문 | 온도록이 썼다 |
| 기사 사진 AI 캡션(3줄) · 이달의 우리 사진 위 AI 캡션(한 줄, 말줄임) | 온도록이 썼다(v1.2.3) |
| `@back.closing` | 고정 문구 |

**긴 원문은 렌더러가 지면을 나눠 받는다.** 나눌 수 없는 자리에서 넘치면 렌더가 실패하고 운영자가 본다.
**표지의 이 달의 말**은 자리를 그대로 두고, 규격에 들어가지 않거나 **두 줄을 넘으면**(§11 ⑫) 렌더러가 **줄째 지운다.**

### 높이 — 실측 표가 원본 (#5, v1.2.3 · v1.2.4 여유 한 줄)

> **v1.2.4 — 낱말 단위 줄바꿈과 여유 한 줄.** 모든 글 칸이 `word-break: keep-all`이 되면서 같은 글자 수라도 줄 끝 낱말 길이에 따라 한 줄이 더 꺾인다.
> 견본 밖 문장 3,000개(시험 데이터 문장 + 낱말 길이를 섞은 합성 문장)로 잰 결과 위 덮개보다 **많아야 +1줄, 약 9%**였다.
> 그래서 `tools/measure.py`가 **두 줄 이상인 칸과 한 줄 칸의 끝자락(다음 칸이 두 줄)에 여유 1줄(`SAFETY_LINES`)을 더해** 적는다. 측정 전 값은 `sampledLines`에 남긴다.
> 같은 3,000개로 다시 맞대 작게 어림한 경우 **0건**. 대가로 크게 잡는 폭이 늘었다(구간 최대 +58px · 대화 최대 +166px — 6턴 모두에 여유가 붙는 경우).
> 여유가 붙은 대화가 가용 높이(841px)를 넘으면 실제로는 들어가도 렌더 실패가 난다 — 이런 대화는 턴 6개 × 300자 이상이라 드물다.
> **이 값들은 디자인 환경(Linux Chromium) 기준이다. 개발은 렌더 환경에서 다시 잰다**(같은 도구 · 같은 여유 규칙).


**규칙 문장("35자마다 22px", "메모 50자마다 29px")은 폐기한다.** 원본은 `render/issue/measure.json`이고, 이 절은 그 요약이다.
`tools/measure.py`가 지면 틀을 개발의 `slot_fill.py`로 그대로 채워 Chromium에서 잰다 — **틀의 활자 · 폭 · 여백을 바꾸면 반드시 다시 잰다.**

측정 조건: Chromium(Playwright) · 794×1123 @96dpi · 글꼴 `fonts/`(Pretendard · MaruBuri otf) · 견본 문장은 시험 데이터의 메모 · 대화 문장과 채팅 말투를 섞은 말뭉치에서
글자 수마다 여러 시작점으로 자른 것.

#### 두 가지로 나눠 잰다

1. **줄 수 표** — 활자 칸마다 "글자 수 → 최대 줄 수". 견본 여러 개 중 **가장 많이 꺾인 값**(위 덮개)이다. 조회는 **글자 수 이상인 첫 칸**(5자 간격).
   보간하지 않는다 — 줄 수는 계단이라, 보간하면 꺾이는 자리에서 작게 어림한다. **줄바꿈으로 나뉜 조각은 따로 세어 더한다**(옛 규칙은 줄바꿈을 세지 못했다).
2. **상자 식** — 상자 높이 = 고정 + 줄 높이 × 줄 수. 줄 수 1~4로 재서 직선인지 확인했고, 직선이 아니면 가장 큰 증가분을 쓴다.

#### 줄 수 표 (발췌 — 전체는 `measure.json`, 5자 간격 · 420자까지)

| 칸 (서체 · 크기 / 행간 · 폭) | 20 | 40 | 60 | 80 | 100 | 150 | 200 | 250 | 300 | 350 | 400 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 타임라인 메모 (MaruBuri 16.7/29 · 545px) | 1 | 1 | 2 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| 인용 턴 홀수 (MaruBuri 12.5/1.75 · 446px) | 1 | 1 | 2 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| 인용 턴 짝수 (같음 · **404px** — 42px 들여씀) | 1 | 1 | 2 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| 글만 있는 기사 메모 (MaruBuri 15/26 · 545px) | 1 | 1 | 2 | 2 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |

AI 캡션(10.9/1.6 · 545px) · 인용 정황(9.5/1.6 · 446px)은 20~150자에서 1 | 1 | 1 | 2 | 2 | 3줄. 장소 이름(11.5px · 폭 68px)은 **6자 1줄 · 14자 2줄 · 22자 4줄 · 30자 6줄** — 왼쪽 단이 좁아 장소 이름이 길면 사진 없는 구간에서는 장소가 높이를 정한다.

#### 상자 식

**타임라인 구간** = max(왼쪽 단, 오른쪽 단) + 36px

| 오른쪽 단 | 메모 | AI 캡션 | 둘 다 없음 |
|---|---|---|---|
| `photos-0` | 54.3 + 29.0·줄 | 43.9 + 17.5·줄 | 40 |
| `photos-1` | 296.3 + 29.0·줄 | 285.9 + 17.5·줄 | 242 |
| `photos-2` | 284.3 + 29.0·줄 | 273.9 + 17.5·줄 | 230 |
| `photos-3` | 359.3 + 29.0·줄 | 348.9 + 17.5·줄 | 305 |

왼쪽 단 = 장소 있음 · 사진 라벨 있음 67 / 장소 있음 · 라벨 없음(사진 0) 40 / 장소 없음 · 라벨 있음 41 / 둘 다 없음 14 + 16px × (장소 줄 수 − 1). 가용 953px.

**인용 대화 하나** = 100.6 + 15.2 × 정황 줄 수 + Σ턴 [ 65.9 + 21.9 × (그 턴 줄 수 − 1) ]

| 그 면의 단문 | 인용 가용 높이 |
|---|---|
| 0개 | **940px** |
| 1~3개(한 줄) | **841px** |
| 4~6개(두 줄) | **778px** |

(가용 = 인용 블록 위 66px부터 단문 묶음 윗변 − 숨 24px. 단문이 없으면 판면 바닥 줄 윗변 − 24px. v1.2.2의 844 · 781은 단문 한 줄 · 두 줄에 해당한다.)

**글만 있는 기사(`hero-none`) 구간** = 메모 71.3 + 26.0 × 줄 / AI 캡션 67.5 + 17.5 × 줄 / 가용 592.5px.

**기사 사진 아래 메모 칸** = 22.3 + 15.2 × 줄, 칸이 쓸 수 있는 높이 **104px**(사진 아래 ~ 판면 바닥) → **메모 5줄까지**.
줄 수는 사진 수에 따라 칸 폭이 달라 표가 셋이다 — 100자 기준 사진 1장 2줄 · 2장 3줄 · 3장 4줄.

#### 검증 — 무작위 견본으로 식의 예측과 실제를 맞댐

| | 견본 | 예측 − 실제 | 예측이 실제보다 작은 경우 |
|---|---|---|---|
| 타임라인 구간(사진 0~3 · 메모/캡션/없음 · 줄바꿈 · 장소 섞음) | 40 | -0.0 ~ +29.0px | **0** |
| 인용 대화(턴 1~6 · 5~400자 · 정황 섞음) | 30 | +2.1 ~ +56.6px | **0** |

크게 잡는 쪽은 최대 메모 한 줄(29px) · 대화 두세 줄(57px)이다 — 들어가는 대화를 다음 면으로 넘길 수는 있어도, 넘치는 지면을 통과시키지는 않는다.

#### 요청한 격자 — 실제 / **새 식** / 옛 규칙 (px)

인용 대화 하나(턴 수 × 턴마다 글자 수, 정황 한 줄):

| 턴 | 12자 | 30자 | 60자 | 100자 | 160자 | 240자 | 320자 | 400자 |
|---|---|---|---|---|---|---|---|---|
| 1 | 180 / **182** / 177 | 180 / **182** / 177 | 202 / **204** / 199 | 223 / **225** / 221 | 245 / **247** / 265 | 267 / **269** / 309 | 311 / **312** / 375 | 333 / **356** / 419 |
| 2 | 244 / **248** / 241 | 244 / **248** / 241 | 287 / **291** / 285 | 331 / **335** / 329 | 375 / **378** / 417 | 440 / **444** / 505 | 528 / **531** / 637 | 572 / **596** / 725 |
| 3 | 307 / **314** / 305 | 307 / **314** / 305 | 373 / **379** / 371 | 439 / **444** / 437 | 504 / **510** / 569 | 592 / **597** / 701 | 723 / **728** / 899 | 789 / **837** / 1031 |
| 4 | 371 / **379** / 369 | 371 / **379** / 369 | 459 / **467** / 457 | 546 / **554** / 545 | 634 / **641** / 721 | 765 / **772** / 897 | 918 / **946** / 1161 | 1028 / **1077** / 1337 |
| 5 | 435 / **445** / 433 | 435 / **445** / 433 | 545 / **554** / 543 | 654 / **663** / 653 | 763 / **772** / 873 | 916 / **925** / 1093 | 1113 / **1143** / 1423 | 1245 / **1317** / 1643 |
| 6 | 499 / **511** / 497 | 499 / **511** / 497 | 630 / **642** / 629 | 762 / **773** / 761 | 893 / **904** / 1025 | 1090 / **1100** / 1289 | 1330 / **1361** / 1685 | 1483 / **1558** / 1949 |

옛 규칙은 **160자 이상에서 크게**(400자 6턴: 실제 1483 · 옛 1949 — 한 면에 들어가는 대화를 실패로), **짧은 대화에서는 2~3px 작게** 잡았다.

타임라인 구간 하나(장소 "연남동 카페", 메모 글자 수, 줄바꿈 없는 견본):

| 사진 | 0자 | 20자 | 50자 | 100자 | 150자 | 200자 | 250자 | 300자 | 350자 | 400자 |
|---|---|---|---|---|---|---|---|---|---|---|
| 사진 0 | 76 / **76** / 101 | 119 / **119** / 148 | 148 / **148** / 148 | 177 / **177** / 177 | 206 / **206** / 206 | 235 / **235** / 235 | 264 / **264** / 264 | 293 / **293** / 293 | 322 / **322** / 322 | 351 / **351** / 351 |
| 사진 1 | 278 / **278** / 338 | 361 / **361** / 390 | 390 / **390** / 390 | 419 / **419** / 419 | 448 / **448** / 448 | 477 / **477** / 477 | 506 / **506** / 506 | 535 / **535** / 535 | 564 / **564** / 564 | 593 / **593** / 593 |
| 사진 3 | 341 / **341** / 401 | 424 / **424** / 453 | 453 / **453** / 453 | 482 / **482** / 482 | 511 / **511** / 511 | 540 / **540** / 540 | 569 / **569** / 569 | 598 / **598** / 598 | 627 / **627** / 627 | 656 / **656** / 656 |

줄바꿈 없는 견본에서는 옛 규칙도 50자 이상에서 맞았다. 옛 규칙이 틀리는 것은 **메모 안의 줄바꿈**(한 줄짜리 조각도 한 줄을 다 쓴다) · **긴 장소 이름** · **메모 없는 구간**(크게 잡음) — 실제 기록의 메모는 줄바꿈이 많다.

#### 렌더러가 하는 일

- 지면을 나눌 때 위 식으로 높이를 더한다(`measure.json`을 읽는다 — 값을 코드에 옮겨 적지 않는다).
- 한 구간 · 한 대화가 가용 높이를 넘으면 렌더 실패(원문을 자르지 않는다). 타임라인 2면 상한을 넘는 구간은 싣지 않고 발행 노트에 적는다(그대로).
- 렌더 뒤 지면 검사(`overset`)가 마지막 방어다 — 식이 어긋나도 넘친 지면은 나가지 않는다.

## 13. v2.0.0 새 지면 규칙

### 13-1. 모든 새 지면

- **잉크** — 원문(두 사람의 글) = 마루부리 · 진묵 · 자르지 않음 · AI 문장 = `.ai-l`(라벨 한 줄) + `.ai-t` — **크기 11px · 굵기 400**으로 한 단계 낮춤(색만으로 가르지 않음) · 계산된 숫자 = 지표 잉크(`--acc`).
- **판정 0** — `/100` · 등급 · 순위 · 상위 % · ○× · "맞혔다" · "가장 크게 갈린" · 평균선 · 다른 커플과 나란히 0. 숫자 옆에는 그 숫자가 어디서 왔는지(바닥 줄 · "성격에서 65 + 대화에서 +6.4").
- **두 사람 구분** — 점: 채운 점(진묵) / 빈 고리(지표 잉크 · 더 큼) · 막대: 진묵 / 지표 잉크 45% — **모양 · 명도**로. 범례 늘 같이. 같은 값이면 고리 안에 점이 보인다.
- **AI 칸 길이** — 계약 `max_chars` 그대로 받게 그렸다(이름 10자 · AI 칸 상한 · ㅋ×34 덩어리로 판면 밖 · 겹침 0 확인). 그래서 AI 칸은 높이 표가 없다.
- **별지** — `body.sheet`(지면색 = 지표 잉크 11%를 바탕에 · 서브 잉크를 진묵 쪽으로 30% 당겨 대비 3.0 이상) + `.sheet-tab`(`data-margin`) + 폴리오 "별지 N". 게임 문법(OVR · 영문 약어 · ▲▼ · 카드)은 별지에만.
- **견본 이름** — 세준 · 서영(v1.2.4 견본과 같은 합성 이름). 협찬 견본 브랜드는 지어낸 "견본상점" + "견본" 표시.

### 13-2. 지면별

| 지면 | 정한 것 |
|---|---|
| 두 사람의 결 | 스턴버그 삼각형 겹침 → **세 축의 점**(두 삼각형 면적이 크기 · 우열로 읽힘) · "신경성" → **"감정의 진폭"**(잔잔함—출렁임) · 양 끝 말은 특성 · 실천 팁은 번호 · 체크 · 굵은 제목 없이 "— " 문장 · 바닥 "다른 커플과 견주지 않습니다" |
| 어림짐작 | 짐작 = ◇ + "쯤" / 셈 = ◆ · 비슷함 = "두 사람 비슷합니다"(이름 · 숫자 숨김) · 면책 점선 테 · 표 · 축 · 눈금 0 |
| 연애리그 | 1면 스코어보드(카드 · 여섯 스탯 막대 · 주마다) · 2면 매치 리포트 · 능력치 배분 · 왜 움직였나. 하락 해설은 상황 귀속(17-3) |
| 각자의 하루 | 한 사람 = 한 열 · 한쪽만이면 `one`(빈 열을 그리지 않음) · 같은 시간대는 한 줄 · 시각은 §11 ③ `08:20` |
| 우리 사이 | 답 아래 "{상대}의 짐작 — …"(원문 · 한 단계 작게) · Q4는 "AI 질문 · 그 주의 일에서" 한 줄 · 질문 번호는 CSS 카운터 |
| 특별 게스트 | 방명록 두 단 · 질문 번호 ①②③ · 서명 "— 닉네임" · 글 고치지 않음 |
| 어깨너머 | 칸 = 라벨 · 큰 값 · "N쌍에서 셈" · 지운 칸이 있으면 바닥 줄 · 이 커플 값 0 |
| 협찬 | 맨 위 진묵 띠 "협찬" + "이 면은 {브랜드}의 협찬으로 실었습니다" · 지면 전체 테 · 고딕만 · 러닝헤드 "협찬 지면 · 본지 기사와 따로 만들었습니다" |
| 부록 | 달력 A5 가로 재단선 · 일요일 시작 · 기념일만 지표 잉크 · 엽서 A6(148×105mm) 재단선 |
| 다음 달 | 큰 달 숫자 · "다음 달의 날" · "다음 달에 할 수 있는 것" · 고정 문구도 사실뿐("날짜와 기념일만 적었습니다") |
| 판권 · 정오 | 호 · 만든 이 · 글 · 사진 · 만든 곳 · 조판 · 서체 · 테마 · 계산 기준 · 정오(있을 때) · 창구(설정 › 문의) |

### 13-3. 높이 — `measure.json` `v2` (디자인 환경 · 렌더 PC에서 다시 잼)

원문 칸만. 줄 수 표는 §12와 같은 방식(위 덮개 + 여유 한 줄). **블록 높이 = `blockBase` + Σ 칸마다 (줄 수 − 1) × 그 칸 `perLine`.**

| 지면 | 칸(줄 수 표 · perLine px) | 블록 바닥 | 첫 면 쓸 수 있는 높이 |
|---|---|---|---|
| 각자의 하루 | `entryTwoLines` · 22.4 (한 열 `entryOneLines`) | 조각 240.4 | 785 — 한 열 1줄 조각 3개 |
| 우리 사이 | `questionLines` 19.5 · `ownLines` 23.2 · `predictedLines` 19.2 — 두 사람 중 큰 쪽 | 문항 135.9 | 815 |
| 특별 게스트 | `answerLines` · 23.0 | 글 = 91.9 + (답 수 − 1) × 32.9 + 줄 | 두 단 × 684.2 |
| 연애리그 ② | `explanationLines` 17.9 · `excerptLines` 21.5 | 해설 142.2 | 514 |
| 발행 노트 | `emptyCornerLines` · 16.4 | — | 지면 검사(overset)로 |
| 판권 · 정오 | `errataLines` · 19.2 | — | 지면 검사로 |
