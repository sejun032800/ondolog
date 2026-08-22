# ONDOLOG `corners.content` 스키마 정의

> `corners.content`(jsonb)의 코너 타입별 구조.
> 이 구조는 **AI 생성 → 검증 → 저장 → PDF 렌더링 → 앱 표시**를 잇는 계약이다.

---

## 0. 설계 전제

### 0-1. content는 스냅샷이다

`corners.content`는 참조가 아니라 **렌더링에 필요한 모든 값의 사본**이다. 원본(`data_entries`, `messages`)이 삭제되어도 발행된 매거진이 깨지지 않아야 하기 때문이다.

따라서 다음 원칙을 따른다.

| 원칙 | 내용 |
|---|---|
| 텍스트 복사 | 메시지 본문·유저 메모는 id가 아니라 **문자열 자체**를 담는다 |
| 미디어 경로 복사 | Storage 경로를 담되, 원본 삭제 대비 **발행 시점에 magazine 버킷으로 복제**한다 |
| id는 참고용 | `*Id` 필드는 감사·디버깅용이며, 렌더러가 이를 조회해선 안 된다 |
| 이름 복사 | `authorName`을 담는다. 탈퇴 후 profiles 조회가 불가능하기 때문 |

### 0-2. 검증 없이 저장하지 않는다

LLM 출력을 그대로 `content`에 넣지 않는다. **Zod 파싱을 통과한 객체만** 저장한다.

```
LLM 출력(문자열)
  → JSON.parse
  → Zod schema.parse       ← 실패 시 재시도, 3회 실패 시 status='failed'
  → 금지 키 검사(§0-4)     ← 위반 시 재시도
  → corners.content 저장
```

배치 위치: `src/types/corners/*.ts` (Zod 스키마), `src/engine/corners/*.ts` (생성 로직)

### 0-3. 공통 봉투

모든 코너 content는 아래 봉투를 갖는다.

```ts
interface CornerEnvelope<P> {
  schemaVersion: string;   // "1.0" — 구조 변경 시 증가
  header: {
    title: string;         // 지면 제목
    subtitle?: string;
    periodLabel: string;   // "2026년 8월", "8월 3주차"
  };
  payload: P;              // 코너별 구조
}
```

### 0-4. 금지 키 (전 코너 공통)

Part 3-7의 "AI는 편집자이지 평론가가 아니다" 원칙을 스키마 수준에서 강제한다.

```ts
const FORBIDDEN_KEYS = [
  'rating', 'score',        // ← love_dna·league는 예외(§1-2 참조)
  'praise', 'compliment', 'evaluation', 'assessment',
  'advice', 'suggestion',   // ← date_archive의 closingQuestions는 예외
  'grade', 'ranking', 'verdict', 'judgement',
];
```

허용 예외는 코너별 스키마에 명시된 필드에 한정한다. 그 외 위치에서 위 키가 발견되면 **재생성**한다.

---

## 1. 공통 값 객체

### 1-1. 미디어·인용

```ts
/** 사진 참조 (발행 시 magazine 버킷으로 복제된 경로) */
interface PhotoRef {
  path: string;            // magazine/{coupleId}/{issueId}/...
  thumbPath?: string;
  width: number;
  height: number;
  capturedAt?: string;     // ISO8601
}

/** 유저가 남긴 기록 — 지면의 주인공 */
interface UserNote {
  authorId: string;        // 참고용
  authorName: string;      // 복사본 (탈퇴 대비)
  type: 'memo' | 'drawing';
  text?: string;           // memo
  path?: string;           // drawing
}

/** 채팅 인용 — 반드시 출처 표기를 동반한다 */
interface ChatTurn {
  speaker: string;         // 이름 복사본
  text: string;            // 원문 그대로. 요약·각색 금지
  at: string;              // ISO8601
}

/** "— 2026.08.22 09:20, 아침 대화 중" 형태로 렌더링 */
interface Attribution {
  display: string;         // 완성된 표기 문자열
  at: string;              // ISO8601
  source: 'chat' | 'feed' | 'story';
}
```

### 1-2. 수치 표기 — `score` 키 허용 범위

`score`/`rating`은 원칙상 금지 키지만, 아래 **두 코너에서만** 허용한다.

| 코너 | 허용 필드 | 성격 |
|---|---|---|
| `love_dna` | `score.*` | 절대평가 일치율. 관계에 대한 평가가 아니라 산출 지표 |
| `league_weekly` / `league_monthly` | `ovr`, `stats.*` | 게임적 재미. 상대평가 유지 |

그 외 코너에서 수치로 유저를 평가하는 필드는 만들지 않는다.

---

## 2. `date_archive` — 데이트 아카이브 (월간)

### 2-1. 구조

```ts
interface DateArchivePayload {
  summary: {
    dateCount: number;
    regionCount: number;
    regions: string[];
  };

  /** 하루 = 한 기사. 배열 순서가 지면 순서 */
  articles: DateArticle[];

  /** 그 달 이동 경로 인포그래픽 */
  mapInfographic: {
    bounds: { north: number; south: number; east: number; west: number };
    pins: Array<{
      lat: number; lng: number;
      label: string;
      dateOn: string;
      order: number;
    }>;
  } | null;
}

interface DateArticle {
  dateId: string;          // 참고용
  dateOn: string;          // "2026-08-19"
  region: string | null;
  title: string;           // AI 생성
  featured: boolean;       // 메인 화보 여부 (기사 1개만 true)

  /** "그때 그 시절" 재소환 */
  recalled: boolean;
  recallReason?: 'anniversary' | 'sparse_month' | 'never_featured';

  stops: DateStop[];
  closingQuestions: ClosingQuestion[];   // 기사당 3개
}

interface DateStop {
  seq: number;
  time: string;            // "14:20" — 표시용 문자열
  placeName: string | null;
  lat: number | null;
  lng: number | null;

  photos: PhotoRef[];
  userNotes: UserNote[];   // 있으면 이것이 주인공

  /** userNotes가 비어있는 구간에만 채운다. 있으면 반드시 null */
  aiCaption: string | null;
}

interface ClosingQuestion {
  type: 'rating' | 'recall' | 'suggestion';
  text: string;
  /** suggestion 타입만: 어떤 데이터에서 도출했는지 */
  basis?: string;
}
```

### 2-2. 생성 규칙

| 규칙 | 내용 |
|---|---|
| `aiCaption` 배타 | `userNotes.length > 0`이면 `aiCaption`은 반드시 `null`. AI가 물러나는 지점 |
| `featured` 유일성 | `articles` 중 `featured: true`는 정확히 1개 |
| 질문 3종 고정 | `closingQuestions`는 `rating` 1 + `recall` 1 + `suggestion` 1 |
| 답변 미저장 | 질문에 대한 **응답 필드를 만들지 않는다.** 대화 유도가 목적 |
| 재소환 배지 | `recalled: true`면 렌더러가 "그때 그 시절" 배지를 표시 |
| 장소명 없음 허용 | GPS만 있고 장소 미확정이면 `placeName: null` — 지어내지 않는다 |

### 2-3. 예시

```json
{
  "schemaVersion": "1.0",
  "header": {
    "title": "데이트 아카이브",
    "periodLabel": "2026년 8월"
  },
  "payload": {
    "summary": { "dateCount": 3, "regionCount": 2, "regions": ["연남동", "성수동"] },
    "articles": [
      {
        "dateId": "9f2c...",
        "dateOn": "2026-08-19",
        "region": "연남동",
        "title": "스파이더맨과 케이크 사이",
        "featured": true,
        "recalled": false,
        "stops": [
          {
            "seq": 0,
            "time": "14:20",
            "placeName": "홍대 CGV",
            "lat": 37.5551, "lng": 126.9236,
            "photos": [
              { "path": "magazine/9f2c/aa01.jpg", "width": 3024, "height": 4032,
                "capturedAt": "2026-08-19T14:22:11+09:00" }
            ],
            "userNotes": [
              { "authorId": "u1", "authorName": "세준", "type": "memo",
                "text": "스파이더맨 봤다. 서영이는 중간에 졸았음" }
            ],
            "aiCaption": null
          },
          {
            "seq": 1,
            "time": "16:40",
            "placeName": "OO식당",
            "lat": 37.5602, "lng": 126.9251,
            "photos": [{ "path": "magazine/9f2c/aa02.jpg", "width": 3024, "height": 4032 }],
            "userNotes": [],
            "aiCaption": "영화가 끝나고 근처에서 저녁"
          }
        ],
        "closingQuestions": [
          { "type": "rating",  "text": "이날의 데이트는 10점 만점에 몇 점?" },
          { "type": "recall",  "text": "이날 중 가장 기억에 남는 건?" },
          { "type": "suggestion",
            "text": "다음에 또 영화 보러 간다면, 이번엔 조조로 가볼까?",
            "basis": "오후 영화 관람 후 저녁 식사로 이어진 동선" }
        ]
      }
    ],
    "mapInfographic": {
      "bounds": { "north": 37.5651, "south": 37.5501, "east": 126.9301, "west": 126.9186 },
      "pins": [
        { "lat": 37.5551, "lng": 126.9236, "label": "홍대 CGV", "dateOn": "2026-08-19", "order": 1 },
        { "lat": 37.5602, "lng": 126.9251, "label": "OO식당",  "dateOn": "2026-08-19", "order": 2 }
      ]
    }
  }
}
```

---

## 3. `love_dna` — 우리의 연애 DNA (월간)

### 3-1. 구조

```ts
interface LoveDnaPayload {
  score: {
    total: number;          // 50~100 (절대평가)
    base: number;           // 성격 기반 고정 기저
    chatDelta: number;      // 채팅 변동분 (음수 가능)
    previousTotal: number | null;
    delta: number | null;   // 전월 대비
  };

  partners: [PartnerProfile, PartnerProfile];

  bigFiveComparison: Array<{
    axis: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
    axisLabel: string;      // "개방성"
    a: number; b: number;
    gap: number;
    relation: 'aligned' | 'complementary';   // 겹침 / 벌어짐
  }>;

  sternbergOverlap: {
    a: { intimacy: number; passion: number; commitment: number };
    b: { intimacy: number; passion: number; commitment: number };
    sharedDominant: 'intimacy' | 'passion' | 'commitment' | null;
    note: string;
  };

  attachmentCombo: {
    pair: [string, string];   // ["secure", "anxious"]
    pairLabel: string;        // "안정형 × 불안형"
    headline: string;
    body: string;
  };

  strengths: string[];        // 2~4개
  complements: string[];      // 2~4개. "약점"이 아니라 "보완 지점"

  /** total <= 60일 때만 채운다. 그 외에는 빈 배열 */
  actionTips: Array<{
    text: string;
    /** 이 팁이 실제로 점수를 움직이는 경로 */
    affects: 'chat_warmth' | 'chat_rhythm' | 'chat_reciprocity';
  }>;
}

interface PartnerProfile {
  userId: string;
  name: string;
  loveTypeCode: string;     // "KLE"
  labelEn: string;          // "KEELEMBER"
  labelKo: string;          // "온돌 같은 원칙주의자"
  copy: string;             // 한 줄 카피
  mbti: string;
  enneagram: number;        // 1~9 (실효 코어)
  attachment: string;
  bigFive: { o: number; c: number; e: number; a: number; n: number };
  sternberg: { intimacy: number; passion: number; commitment: number };
}
```

### 3-2. 생성 규칙

| 규칙 | 내용 |
|---|---|
| **절대평가** | 백분위·상위% 필드를 만들지 않는다. 다른 커플과 비교하지 않는다 |
| 하한 50 | `total`이 50 미만이 되는 계산 결과는 50으로 클램프 |
| 보완형 프레이밍 | `complements`에 "부족하다", "안 맞는다" 류 표현 금지. 서로 다른 지점을 서술 |
| 팁의 실효성 | `actionTips[].affects`가 실제 `chat_factors` 키와 대응해야 한다. 빈말 금지 |
| 60 초과 시 | `actionTips: []` — 팁을 억지로 만들지 않는다 |

### 3-3. 예시 (일부)

```json
{
  "schemaVersion": "1.0",
  "header": { "title": "우리의 연애 DNA", "periodLabel": "2026년 8월" },
  "payload": {
    "score": { "total": 58.4, "base": 55.0, "chatDelta": 3.4, "previousTotal": 56.1, "delta": 2.3 },
    "partners": [
      { "userId": "u1", "name": "세준", "loveTypeCode": "KLE", "labelEn": "KEELEMBER",
        "labelKo": "온돌 같은 원칙주의자", "copy": "늘 같은 온도로 곁에 있는 사람",
        "mbti": "ISTJ", "enneagram": 1, "attachment": "secure",
        "bigFive": { "o": 29, "c": 70, "e": 28, "a": 39, "n": 25 },
        "sternberg": { "intimacy": 63, "passion": 55, "commitment": 88 } },
      { "userId": "u2", "name": "서영", "loveTypeCode": "MSF", "labelEn": "MUSEFLARE",
        "labelKo": "열대야 같은 낭만주의자", "copy": "사랑 때문에 잠 못 드는 사람",
        "mbti": "ISFP", "enneagram": 4, "attachment": "anxious",
        "bigFive": { "o": 71, "c": 38, "e": 28, "a": 61, "n": 78 },
        "sternberg": { "intimacy": 88, "passion": 80, "commitment": 55 } }
    ],
    "bigFiveComparison": [
      { "axis": "openness", "axisLabel": "개방성", "a": 29, "b": 71, "gap": 42, "relation": "complementary" },
      { "axis": "extraversion", "axisLabel": "외향성", "a": 28, "b": 28, "gap": 0, "relation": "aligned" }
    ],
    "attachmentCombo": {
      "pair": ["secure", "anxious"],
      "pairLabel": "안정형 × 불안형",
      "headline": "한쪽이 흔들려도 다른 쪽이 자리를 지킵니다",
      "body": "..."
    },
    "strengths": ["둘 다 조용한 시간을 편하게 여깁니다", "..."],
    "complements": ["계획의 속도가 서로 다릅니다", "..."],
    "actionTips": [
      { "text": "채팅을 나눌 때 다정한 한 마디를 더해보세요", "affects": "chat_warmth" },
      { "text": "상대의 메시지에 이모지로 반응해보세요", "affects": "chat_reciprocity" }
    ]
  }
}
```

---

## 4. `league_weekly` — 연애리그 주간판

### 4-1. 구조

```ts
interface LeagueWeeklyPayload {
  period: { start: string; end: string; label: string };

  cards: [StatCard, StatCard];

  matchReport: {
    /** 11개 항목. 순서가 지면 순서 */
    items: MatchMetric[];
  };
}

interface StatCard {
  userId: string;
  name: string;
  positionCode: string | null;    // 네이밍 체계 미확정
  positionLabel: string | null;

  ovr: number;                    // 0~120
  ovrDelta: number | null;
  ovrTier: '하위권' | '메인' | '상위권' | '희귀' | '레전드';

  stats: { pus: number; emp: number; att: number; def: number; tac: number; rea: number };
  statDeltas: { pus: number; emp: number; att: number; def: number; tac: number; rea: number } | null;
}

interface MatchMetric {
  key: MatchMetricKey;
  label: string;                  // "예상 대화 점유율"
  format: 'split_percent' | 'split_count' | 'single_value' | 'single_percent' | 'event';

  a?: number;                     // split_* 일 때
  b?: number;
  value?: number | string;        // single_* / event 일 때
  unit?: string;

  /** 실측 채팅 데이터 기반이면 true, 성격 벡터 추정이면 false */
  measured: boolean;

  note?: string;                  // 담백한 한 줄. 평가 금지
}

type MatchMetricKey =
  | 'possession'      // 예상 대화 점유율
  | 'shots_on_target' // 드립 유효슈팅
  | 'pass_accuracy'   // 티키타카 성공률
  | 'fouls'           // 대화 태클
  | 'yellow_cards'    // 삐짐 옐로카드
  | 'final_score'     // 연애 주도권 스코어
  | 'substitution'    // 밀당 타이밍 체인지
  | 'late_winner'     // 막판 감동 극장골
  | 'var_review'      // 오해 판독 VAR
  | 'assists'         // 리액션 어시스트
  | 'offside';        // 타이밍 오프사이드
```

### 4-2. 생성 규칙

| 규칙 | 내용 |
|---|---|
| 11개 고정 | `items`는 정확히 11개, `MatchMetricKey` 전부 1회씩 |
| `measured` 정직성 | 실제 채팅 로그로 계산한 항목만 `true`. 추정치를 실측으로 표시 금지 |
| OVR 티어 | `ovrTier`는 `ovr` 값과 규준 분포 매핑에 일치해야 한다 |
| 미채택 항목 금지 | 레드카드·클린시트·MOM·홈그라운드 버프는 생성하지 않는다 |
| 델타 null 허용 | 첫 호는 `ovrDelta`/`statDeltas`가 `null` |

### 4-3. 예시 (일부)

```json
{
  "schemaVersion": "1.0",
  "header": { "title": "연애리그", "subtitle": "이번 주 경기 결과", "periodLabel": "8월 3주차" },
  "payload": {
    "period": { "start": "2026-08-17", "end": "2026-08-23", "label": "8월 3주차" },
    "cards": [
      { "userId": "u1", "name": "세준", "positionCode": null, "positionLabel": null,
        "ovr": 91, "ovrDelta": 2, "ovrTier": "상위권",
        "stats": { "pus": 68, "emp": 62, "att": 44, "def": 88, "tac": 57, "rea": 97 },
        "statDeltas": { "pus": 0, "emp": 3, "att": -1, "def": 0, "tac": 1, "rea": 0 } }
    ],
    "matchReport": {
      "items": [
        { "key": "possession", "label": "예상 대화 점유율", "format": "split_percent",
          "a": 42, "b": 58, "unit": "%", "measured": true },
        { "key": "pass_accuracy", "label": "티키타카 성공률", "format": "single_percent",
          "value": 83, "unit": "%", "measured": true },
        { "key": "yellow_cards", "label": "삐짐 옐로카드", "format": "split_count",
          "a": 0, "b": 1, "measured": false }
      ]
    }
  }
}
```

---

## 5. `league_monthly` — 연애리그 월간판

### 5-1. 구조

```ts
interface LeagueMonthlyPayload {
  season: { label: string; weekCount: number; start: string; end: string };

  standings: {
    initiativeTrend: Array<{ weekLabel: string; a: number; b: number }>;
    summary: string;              // 담백한 한 줄
  };

  cumulative: Array<{
    key: MatchMetricKey;
    label: string;
    aTotal: number | null;
    bTotal: number | null;
    unit?: string;
  }>;

  highlight: {
    weekLabel: string;
    headline: string;
    body: string;
  } | null;

  /** 월간판의 핵심 — 왜 스탯이 변했나 */
  statChanges: StatChange[];

  /** 능력치 배분표 — 투명성 */
  statBreakdown: StatBreakdown[];
}

interface StatChange {
  userId: string;
  name: string;
  stat: 'pus' | 'emp' | 'att' | 'def' | 'tac' | 'rea';
  statLabel: string;              // "감정 공감력"
  from: number;
  to: number;
  delta: number;
  explanation: string;            // 서사. 근거 기반, 평가 아님
  evidence: Evidence[];           // 최소 1개
}

interface Evidence {
  type: 'message' | 'photo' | 'metric';
  at?: string;
  excerpt?: string;               // 원문 그대로
  attribution?: Attribution;
  metricKey?: string;
  metricValue?: number | string;
}

interface StatBreakdown {
  userId: string;
  stat: 'pus' | 'emp' | 'att' | 'def' | 'tac' | 'rea';
  statLabel: string;
  value: number;
  contributions: Array<{
    source: string;               // "conscientiousness" | "sternberg_commitment" | "enneagram_competency"
    sourceLabel: string;          // "성실성"
    rawValue: number;
    weight: number;
    share: number;                // 0~1, 합이 1
  }>;
}
```

### 5-2. 생성 규칙

| 규칙 | 내용 |
|---|---|
| 변동 상위 2~3개 | `statChanges`는 절대 변동폭 기준 상위 2~3개만 |
| 근거 필수 | `statChanges[].evidence`가 비면 해당 항목을 생성하지 않는다 |
| share 합 = 1 | `contributions[].share` 합은 1.0 (±0.01) |
| 압축 모드 주의 | `publish_mode='compressed'`면 변동폭이 비현실적으로 클 수 있음. 렌더러가 배지 표시 |
| 첫 달 스킵 | 이전 스냅샷이 없으면 `statChanges: []`, `statBreakdown`만 노출 |

---

## 6. `sweet_words` — 다정한 말들 (MVP는 월간)

### 6-1. 구조

```ts
interface SweetWordsPayload {
  warmthIndex: number | null;     // 그 기간 다정 지수 (0~100)

  /** 메인 인용 — 대화 단위 */
  main: SweetExcerpt[];           // 월간 2~3개 / 일간 1개

  /** 서브 — 단문 나열 */
  sub: Array<{
    attribution: Attribution;
    speaker: string;
    text: string;                 // 원문 그대로
  }>;
}

interface SweetExcerpt {
  /** AI가 쓰는 유일한 문장. 상황·정황만. 평가 금지 */
  context: string;
  attribution: Attribution;
  turns: ChatTurn[];              // 1~4턴
}
```

### 6-2. 생성 규칙

이 코너가 원칙 위반이 가장 쉽게 일어나는 지점이다.

| 규칙 | 내용 |
|---|---|
| **원문 불변** | `turns[].text`는 채팅 원문과 **문자 단위로 일치**해야 한다. 요약·교정·이모지 제거 금지 |
| **출처 필수** | 모든 인용에 `attribution` 동반. "— 2026.08.22 09:20, 아침 대화 중" |
| **AI 문장은 `context` 하나뿐** | `context`는 정황 서술만. "정말 다정하시네요" 류 감상 금지 |
| **평가 필드 없음** | 스키마에 `rating`·`comment`·`praise` 필드를 **정의하지 않는다** |
| **스킵 우선** | 다정한 발화가 없으면 `status='skipped'`, `skip_reason='no_warm_messages'`. 억지 생성 금지 |
| 다툼 제외 | 화해 대화도 포함하지 않는다 (다툼 맥락 자체를 소환하지 않음) |

**검증**: 저장 전 `turns[].text`를 원본 `messages.body`와 대조해 불일치 시 재생성한다.

### 6-3. 예시

```json
{
  "schemaVersion": "1.0",
  "header": { "title": "이달의 다정한 말들", "periodLabel": "2026년 8월" },
  "payload": {
    "warmthIndex": 72,
    "main": [
      {
        "context": "아침 출근길에 오간 대화",
        "attribution": {
          "display": "2026.08.22 09:20, 아침 대화 중",
          "at": "2026-08-22T09:20:00+09:00",
          "source": "chat"
        },
        "turns": [
          { "speaker": "세준", "text": "오늘 비 온대. 우산 챙겼어?", "at": "2026-08-22T09:20:00+09:00" },
          { "speaker": "서영", "text": "응 챙겼어. 너도 감기 조심해", "at": "2026-08-22T09:21:30+09:00" }
        ]
      }
    ],
    "sub": [
      { "attribution": { "display": "2026.08.11 23:40, 밤 대화 중",
                         "at": "2026-08-11T23:40:00+09:00", "source": "chat" },
        "speaker": "서영", "text": "오늘 고생했어 진짜" }
    ]
  }
}
```

---

## 7. `this_month` — 이달의 우리 (월간)

### 7-1. 구조

```ts
interface ThisMonthPayload {
  theme: {
    headline: string;             // "이사 준비의 한 달"
    lead: string;                 // 왜 이 테마가 뽑혔는지, 담백하게
    /** 부정 테마 배제 — 'negative'는 스키마상 허용하지 않는다 */
    polarity: 'neutral' | 'positive';
    /** 테마 추출 근거가 된 신호 */
    signals: Array<{ kind: 'place' | 'keyword' | 'activity' | 'metric'; value: string; count: number }>;
  };

  /** 데이터량에 따라 2~4편 */
  articles: Array<{
    seq: number;
    title: string;
    body: string;
    evidence: Evidence[];         // 최소 1개
  }>;

  closing: string;                // 다음 달로 이어지는 한 줄
}
```

### 7-2. 생성 규칙

| 규칙 | 내용 |
|---|---|
| **부정 테마 배제** | `polarity`에 `'negative'`가 없다. 다툼·소원함을 테마로 삼지 않는다 |
| **포장 금지** | 부정을 긍정으로 바꾸는 게 아니라, **다른 소재로 테마를 잡는다** |
| 분량 축소 | 데이터 부족 시 코너를 빼지 않고 `articles`를 2편까지 줄인다 |
| 근거 필수 | 모든 `articles[].evidence`가 최소 1개. 테마는 AI가 뽑되 **증명은 유저 원본**이 한다 |
| 신호 투명성 | `theme.signals`에 어떤 데이터에서 뽑았는지 남긴다 |

---

## 8. 미착수 코너 (7종)

아래 코너는 **배치만 확정되었고 세부 기획이 없다.** content 스키마를 정의하지 않으며, 스키마 없이 생성 코드를 작성하지 않는다.

| corner_type | 배치 | 상태 |
|---|---|---|
| `offline_setlog` | 주간 | 기획 미착수 |
| `couple_interview` | 주간 | 기획 미착수 |
| `special_guest` | 월간 | 기획 미착수 |
| `over_shoulder` | 월간 | 기획 미착수 (콜드스타트 임계치 필요) |
| `appendix` | 월간 | Year 2 |
| `sponsored` | 월간 | Year 2 |
| `rough_guess` | 월간 | 항목 5종만 확정, 출력 구조 미정 |

---

## 9. 파일 배치

```
src/
  types/corners/
    envelope.ts          # CornerEnvelope, 공통 값 객체, FORBIDDEN_KEYS
    dateArchive.ts       # Zod schema + TS type
    loveDna.ts
    leagueWeekly.ts
    leagueMonthly.ts
    sweetWords.ts
    thisMonth.ts
    index.ts             # corner_type → schema 매핑
  engine/corners/
    generate.ts          # 공통 파이프라인 (LLM → parse → validate → save)
    validators.ts        # 금지 키 검사, 원문 대조 검증
    dateArchive.ts       # 코너별 프롬프트 + 후처리
    ...
```

### 9-1. 공통 생성 파이프라인 계약

```ts
async function generateCorner(
  cornerType: CornerType,
  coupleId: string,
  period: { start: string; end: string }
): Promise<CornerResult> {
  // 1. 원재료 수집 (해당 기간 entries/messages/dates/stats)
  // 2. 데이터 충분성 판정 → 부족하면 skip 또는 축소
  // 3. LLM 호출 (코너별 프롬프트)
  // 4. JSON.parse → Zod.parse  (실패 시 최대 3회 재시도)
  // 5. 금지 키 검사 + 코너별 추가 검증(원문 대조 등)
  // 6. 미디어를 magazine 버킷으로 복제하고 경로 치환
  // 7. corners.content 저장, status='ready'
}
```

**중요**: 6단계(미디어 복제)를 건너뛰면 원본 삭제 시 발행물이 깨진다. 스냅샷 원칙은 텍스트뿐 아니라 **미디어에도 적용**된다.

---

## 10. 남은 결정

- [ ] `positionCode` — 연애 포지션 네이밍 체계 (league_weekly/monthly 공통)
- [ ] `warmthIndex` 산출식 — 다정 지수 0~100 정의
- [ ] `rough_guess` 출력 구조 — 확률 배지 / 좌우 비교 / 게이지 3종 포맷
- [ ] 미디어 복제 시 저해상도 전환과의 상호작용 (무료 티어 잠금 데이터가 발행물에 포함될 때)
