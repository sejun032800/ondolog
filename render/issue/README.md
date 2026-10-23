# `render/issue/` v1.1.1 — 발행물 조판 템플릿

ONDOLOG 발행물의 지면 틀이다. **이 HTML이 곧 렌더 템플릿**이고, 렌더 코드는
구조를 고치지 않고 `data-*` 표시만 채운다. 지면을 고치면 이 묶음을 다시 넘겨 덮어쓰면 된다.

- 기준: `ONDOLOG_MASTER.md` 9-5, `ONDOLOG_CORNER_LAYOUT.md`, **`ONDOLOG_CORNER_CONTENT.md`**, ROADMAP r25(R25-1~8), P1 보드(patch2), 남은 6테마 × 19면 PDF
- **v1.1.1에서 바뀐 것:** R26-4(재소환 사유 표기) · R26-5(`@da.lead` 집계 기준)를 §9-②에 반영. `tools/__pycache__` 제거. 지면 구조는 `da-article`의 사유 줄 하나만 바뀌었다 — 라벨을 `data-optional` 안으로 넣었다
- **v1.1에서 바뀐 것:** 코너 안 슬롯 이름을 `CORNER_CONTENT`에 맞춰 전부 다시 판정했다 — §9 대조표. 사진 자리에 `data-optional`. 다정한 말들 오프너에 변형 2종. `tools/` 추가
- 범위: **MVP 지면만.** 연애 DNA(M3) · 연애리그(출시 후) · 참여형 코너는 없다
- 전제: **JS 없음 · 외부 URL 없음 · ASCII 파일명 · A4 210×297mm · `@page{margin:0}`**

---

## 1. 지면 종류 — 13개

| 파일 | 지면 | 기존 PDF | 비고 |
|---|---|---|---|
| `cover-photo.html` | 표지 — 사진 | p1 | "N월호" 필수. 호 번호·발행일 없음(R21) |
| `cover-type.html` | 표지 — 활자 | — (P1 신규) | 대표 사진 없거나 짧은 변 1170px 미만일 때 |
| `contents.html` | 목차 | p2 | 연애 DNA·연애리그 줄 없음. 콜로폰에서 Vol·발행일 삭제 |
| `note.html` | 발행 노트 | p3 | P1 판. 인터뷰 답·셋로그 줄 삭제, 정정 요청 → 설정 › 문의 |
| `da-opener.html` | 데이트 아카이브 ① 오프너 + 기사 헤드 | p4 | |
| `da-timeline.html` | 데이트 아카이브 ② 타임라인 | p5 | **한 면짜리 틀.** 넘치면 렌더러가 2면으로 나눈다 — §5 |
| `da-places.html` | 데이트 아카이브 ③ 장소 목록 + 세 물음 | p6 | **지도 없음**(카카오맵은 출시 후). 답 입력 UI 없음 |
| `da-article.html` | 데이트 아카이브 ④ 두 번째 기사 | p7 | 오프너 없음. 재소환 배지는 `data-if` |
| `sw-opener.html` | 다정한 말들 — 오프너(침묵면) | p10 | 변형 2종 — 사진이 있으면 `with-photo`, 없으면 `type-only` |
| `sw-quotes.html` | 다정한 말들 — 인용면 | p11·p12 | **한 면짜리 틀.** `main` 개수가 지면 수를 정한다 |
| `tm-lead.html` | 이달의 우리 ① 저중심면 | p13 | |
| `tm-articles.html` | 이달의 우리 ② 소기사 | p14 | `articles` 개수별 그리드 변형 3종 |
| `back.html` | 뒤표지 | p19 | Vol 표기 삭제(R21) |

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

**해석 순서가 중요하다.** `variant` → `repeat` → `if` → `optional` 순으로 처리한다.
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
| `@note.ratioPeople` · `.ratioOndolog` · `.sentencesPeople` · `.sentencesOndolog` | 문장의 출처 | 발행 노트 |
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
| `sw-opener.html` | `with-photo` `type-only` | `@sw.openerPhoto`가 비면 `type-only`. 사진 없는 지면에 밝은 활자를 두지 않기 위한 것이다 |

**AI가 고르는 게 아니라 개수가 결정한다**(§3-1). `grid-4`는 2×2,
`grid-2`·`grid-3`은 한 줄이다.

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

판면 가용 높이는 **953px (252.1mm)**다(위 60px · 아래 110px).
stop 하나가 차지하는 높이를 실측했다.

| `photos.length` | 유저 메모 있음 | AI 캡션만 |
|---|---|---|
| 0 | 148px / 39.2mm | 101px / 26.7mm |
| 1 | 390px / 103.3mm | 338px / 89.5mm |
| 2 | 378px / 100.1mm | 326px / 86.4mm |
| 3 (= 4 이상) | 453px / 119.9mm | 401px / 106.2mm |

**합이 953px을 넘으면 타임라인을 2면으로 나눈다.** 값은 더하면 된다 — 실측으로 확인했다.

- 들어감: stop 2개까지는 어떤 조합이든 들어간다. 사진 0장 stop은 3개도 들어간다.
  기존 p5 구성(1장+메모 · 0장+AI캡션 · 3장+메모 = 945px)도 들어간다.
- 넘침: 사진이 있는 stop 3개는 **모든 조합이 넘는다** (1장 1015~1171px · 2장 979~1135px · 3장 1204~1360px).

유저 메모와 AI 캡션은 **동시에 그리지 않는다**(§3-1 — 메모가 있으면 `aiCaption`은 `null`).
둘 다 남겨 두면 stop마다 약 52px이 더 붙어 분할 판정이 틀어진다.

넘침의 1차 방어는 **생성 단계의 문자열 길이 상한**이다(§4-1).
CSS의 `.clamp1~4`는 안전망이지 대책이 아니다.

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

## 8. 파일

```
render/issue/
  README.md
  base.css              공통 판면·활자·잉크 역할·안전망
  themes/
    basic.css hip.css neon.css lovely.css night.css ondol.css   (CSS 변수만)
  pages/*.html          지면 13종 (A4 한 면)
  tools/                참고용 — 슬롯 해석기 · 지면 감사기. 조판에는 쓰이지 않는다
  tools/README.md       이 두 가지는 꼭 — 해석 순서 · overset 검사
  fonts/
    Pretendard-Regular/Medium/Bold.otf
    MaruBuri-ExtraLight/Light/Regular/SemiBold.otf
    LICENSES.md
  images/sample/        견본 사진. 커플 사진은 data-src로 들어온다 — 배포 때 지워도 된다
```

장식 이미지는 쓰지 않는다. `images/`에 있는 것은 전부 미리보기용 견본이다.

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
| `@da.route` · `@da.articleRoute` | `stops[].placeName`을 `" → "`로 이음. `null`인 stop은 건너뜀 |
| `@da.totals` | `"사진 {합}장 · 메모 {합}"` |
| `@da.routeSummary` | `"{summary.regionCount}개 지역 · {전체 stop 수}개 장소"` |
| `@da.routeHeadline` | 고정 틀: `"{달}에 두 사람이 그린 지도"` |
| `@da.places` | 전체 `articles[].stops[]`를 순서대로 편 배열. 항목: `.date`(소속 기사 `dateOn` → `"08.19"`) · `.placeName` |
| `@da.articlePhotoCount` · `.articleNoteCount` · `.articleStopCount` · `.articleCaptionCount` | 해당 기사의 합계 |
| `@da.articlePhotos` | 그 기사 `stops[].photos[]`를 편 뒤 상위 3장. 항목: `.path` · `.caption`(그 사진이 속한 stop의 `aiCaption`, 없으면 빈 값) |
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
