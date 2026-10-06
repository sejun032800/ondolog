import {
  DateArchiveStoredSchema,
  MonthEvidenceSchema,
  ThisMonthStoredSchema,
  sweetWordsStoredSchema,
} from '../../../src/types/corners/storedContent'

/**
 * 코너 3종 저장 스키마 (docs/ONDOLOG_CORNER_CONTENT.md §2·§6·§7, MASTER §17-0-7).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 범위 1("LLM 출력 스키마와 저장 스키마를 분리").
 *
 * 문서의 예시 JSON이 스키마를 통과하는지(문서와 스키마의 일치)와, 문서가 정한 규칙이 저장 스키마에서 걸리는지를 본다.
 */

// ---------------------------------------------------------------------------
// §2 date_archive
// ---------------------------------------------------------------------------

const DOC_DATE_ARCHIVE_EXAMPLE = {
  schemaVersion: '1.0',
  header: { cornerName: '데이트 아카이브', title: '함께한 하루', periodLabel: '2026년 8월' },
  payload: {
    summary: { dateCount: 3, regionCount: 2, regions: ['연남동', '성수동'] },
    articles: [
      {
        dateId: '9f2c...',
        dateOn: '2026-08-19',
        region: '연남동',
        title: '스파이더맨과 케이크 사이',
        featured: true,
        recalled: false,
        stops: [
          {
            seq: 0,
            time: '14:20',
            placeName: '홍대 CGV',
            lat: 37.5551,
            lng: 126.9236,
            photos: [{ path: 'magazine/9f2c/aa01.jpg', width: 3024, height: 4032, capturedAt: '2026-08-19T14:22:11+09:00' }],
            userNotes: [{ authorId: 'u1', authorName: '세준', type: 'memo', text: '스파이더맨 봤다. 서영이는 중간에 졸았음' }],
            aiCaption: null,
          },
          {
            seq: 1,
            time: '16:40',
            placeName: 'OO식당',
            lat: 37.5602,
            lng: 126.9251,
            photos: [{ path: 'magazine/9f2c/aa02.jpg', width: 3024, height: 4032 }],
            userNotes: [],
            aiCaption: '영화가 끝나고 근처에서 저녁',
          },
        ],
        closingQuestions: [
          { type: 'rating', text: '이날의 데이트는 10점 만점에 몇 점?' },
          { type: 'recall', text: '이날 중 가장 기억에 남는 건?' },
          {
            type: 'suggestion',
            text: '다음에 또 영화 보러 간다면, 이번엔 조조로 가볼까?',
            basis: '오후 영화 관람 후 저녁 식사로 이어진 동선',
          },
        ],
      },
    ],
    mapInfographic: {
      bounds: { north: 37.5651, south: 37.5501, east: 126.9301, west: 126.9186 },
      pins: [
        { lat: 37.5551, lng: 126.9236, label: '홍대 CGV', dateOn: '2026-08-19', order: 1 },
        { lat: 37.5602, lng: 126.9251, label: 'OO식당', dateOn: '2026-08-19', order: 2 },
      ],
    },
  },
}

function cloneDateArchive(): typeof DOC_DATE_ARCHIVE_EXAMPLE {
  return JSON.parse(JSON.stringify(DOC_DATE_ARCHIVE_EXAMPLE)) as typeof DOC_DATE_ARCHIVE_EXAMPLE
}

describe('date_archive 저장 스키마 (§2)', () => {
  it('문서의 예시(§2-3)가 통과한다', () => {
    expect(DateArchiveStoredSchema.safeParse(DOC_DATE_ARCHIVE_EXAMPLE).success).toBe(true)
  })

  it('aiCaption 배타 - userNotes가 있는데 aiCaption이 null이 아니면 실패', () => {
    const doc = cloneDateArchive()
    doc.payload.articles[0].stops[0].aiCaption = '캡션' as unknown as null
    expect(DateArchiveStoredSchema.safeParse(doc).success).toBe(false)
  })

  it('featured 유일성 - 0개나 2개면 실패', () => {
    const none = cloneDateArchive()
    none.payload.articles[0].featured = false
    expect(DateArchiveStoredSchema.safeParse(none).success).toBe(false)

    const two = cloneDateArchive()
    two.payload.articles.push({ ...two.payload.articles[0], dateId: 'x' })
    expect(DateArchiveStoredSchema.safeParse(two).success).toBe(false)
  })

  it('질문 3종 고정 - rating 1 + recall 1 + suggestion 1이 아니면 실패', () => {
    const missing = cloneDateArchive()
    missing.payload.articles[0].closingQuestions.pop()
    expect(DateArchiveStoredSchema.safeParse(missing).success).toBe(false)

    const duplicated = cloneDateArchive()
    duplicated.payload.articles[0].closingQuestions[1].type = 'rating'
    expect(DateArchiveStoredSchema.safeParse(duplicated).success).toBe(false)
  })

  it('기사 제목은 20자(코드포인트) 이내', () => {
    const ok = cloneDateArchive()
    ok.payload.articles[0].title = '가'.repeat(20)
    expect(DateArchiveStoredSchema.safeParse(ok).success).toBe(true)
    const over = cloneDateArchive()
    over.payload.articles[0].title = '가'.repeat(21)
    expect(DateArchiveStoredSchema.safeParse(over).success).toBe(false)
  })

  it('장소명 없음 허용 - placeName·lat·lng가 null이어도 통과한다(지어내지 않는다)', () => {
    const doc = cloneDateArchive()
    Object.assign(doc.payload.articles[0].stops[1], { placeName: null, lat: null, lng: null })
    expect(DateArchiveStoredSchema.safeParse(doc).success).toBe(true)
  })

  it('지도는 null일 수 있다(좌표가 없으면 지도 전체가 null)', () => {
    const doc = cloneDateArchive()
    Object.assign(doc.payload, { mapInfographic: null })
    expect(DateArchiveStoredSchema.safeParse(doc).success).toBe(true)
  })

  it('답변을 담을 필드가 없다 - 질문 객체에 응답 키를 넣어도 저장 결과에 남지 않는다', () => {
    const doc = cloneDateArchive()
    Object.assign(doc.payload.articles[0].closingQuestions[0], { answer: '8점' })
    const parsed = DateArchiveStoredSchema.parse(doc)
    expect(JSON.stringify(parsed)).not.toContain('8점')
  })
})

// ---------------------------------------------------------------------------
// §6 sweet_words
// ---------------------------------------------------------------------------

const DOC_SWEET_WORDS_EXAMPLE = {
  schemaVersion: '1.0',
  header: { cornerName: '다정한 말들', title: '다정한 말들', periodLabel: '2026년 8월' },
  payload: {
    warmthIndex: null,
    main: [
      {
        context: '아침 출근길에 오간 대화',
        attribution: { display: '2026.08.22 09:20, 아침 대화 중', at: '2026-08-22T09:20:00+09:00', source: 'chat' },
        turns: [
          { speaker: '세준', text: '오늘 비 온대. 우산 챙겼어?', at: '2026-08-22T09:20:00+09:00' },
          { speaker: '서영', text: '응 챙겼어. 너도 감기 조심해', at: '2026-08-22T09:21:30+09:00' },
        ],
      },
    ],
    sub: [
      {
        attribution: { display: '2026.08.11 23:40, 밤 대화 중', at: '2026-08-11T23:40:00+09:00', source: 'chat' },
        speaker: '서영',
        text: '오늘 고생했어 진짜',
      },
    ],
  },
}

describe('sweet_words 저장 스키마 (§6, 17-0-7)', () => {
  const monthly = sweetWordsStoredSchema('monthly')
  const daily = sweetWordsStoredSchema('daily')
  const withMain = (count: number) => ({
    ...DOC_SWEET_WORDS_EXAMPLE,
    payload: { ...DOC_SWEET_WORDS_EXAMPLE.payload, main: Array.from({ length: count }, () => DOC_SWEET_WORDS_EXAMPLE.payload.main[0]) },
  })

  it('문서의 예시(§6-3)가 통과한다', () => {
    expect(monthly.safeParse(DOC_SWEET_WORDS_EXAMPLE).success).toBe(true)
    expect(daily.safeParse(DOC_SWEET_WORDS_EXAMPLE).success).toBe(true)
  })

  it('main 개수: 월간 1~3, 일간 1', () => {
    expect([0, 1, 2, 3, 4].map((n) => monthly.safeParse(withMain(n)).success)).toEqual([false, true, true, true, false])
    expect([0, 1, 2].map((n) => daily.safeParse(withMain(n)).success)).toEqual([false, true, false])
  })

  it('sub는 0~6개', () => {
    const sub = (n: number) => ({
      ...DOC_SWEET_WORDS_EXAMPLE,
      payload: { ...DOC_SWEET_WORDS_EXAMPLE.payload, sub: Array.from({ length: n }, () => DOC_SWEET_WORDS_EXAMPLE.payload.sub[0]) },
    })
    expect([0, 6, 7].map((n) => monthly.safeParse(sub(n)).success)).toEqual([true, true, false])
  })

  it('turns는 1~4턴', () => {
    const turns = (n: number) => ({
      ...DOC_SWEET_WORDS_EXAMPLE,
      payload: {
        ...DOC_SWEET_WORDS_EXAMPLE.payload,
        main: [{ ...DOC_SWEET_WORDS_EXAMPLE.payload.main[0], turns: Array.from({ length: n }, () => DOC_SWEET_WORDS_EXAMPLE.payload.main[0].turns[0]) }],
      },
    })
    expect([0, 1, 4, 5].map((n) => monthly.safeParse(turns(n)).success)).toEqual([false, true, true, false])
  })

  it('warmthIndex는 0~100 또는 null', () => {
    const w = (v: unknown) => ({ ...DOC_SWEET_WORDS_EXAMPLE, payload: { ...DOC_SWEET_WORDS_EXAMPLE.payload, warmthIndex: v } })
    expect([null, 0, 100, 101, -1].map((v) => monthly.safeParse(w(v)).success)).toEqual([true, true, true, false, false])
  })

  it('평가·감상을 담을 필드가 스키마에 없다 - rating·comment·praise를 넣어도 저장 결과에 남지 않는다', () => {
    const doc = withMain(1)
    Object.assign(doc.payload.main[0], { rating: 5, comment: '좋다', praise: '다정하다' })
    const parsed = monthly.parse(doc)
    const text = JSON.stringify(parsed)
    for (const word of ['rating', 'comment', 'praise', '다정하다']) expect(text).not.toContain(word)
  })
})

// ---------------------------------------------------------------------------
// §7 this_month
// ---------------------------------------------------------------------------

const MESSAGE_EVIDENCE = {
  type: 'message',
  at: '2026-08-22T09:20:00+09:00',
  excerpt: '오늘 비 온대. 우산 챙겼어?',
  attribution: { display: '2026.08.22 09:20, 아침 대화 중', at: '2026-08-22T09:20:00+09:00', source: 'chat' },
}

const THIS_MONTH_EXAMPLE = {
  schemaVersion: '1.0',
  header: { cornerName: '이달의 우리', title: '이달의 우리', periodLabel: '2026년 8월' },
  payload: {
    theme: {
      headline: '새로운 동네를 다닌 달',
      lead: '이번 달에는 연남동과 성수동에 다녀온 기록이 남았다.',
      polarity: 'positive',
      signals: [{ kind: 'place', value: '연남동', count: 2 }],
    },
    articles: [
      { seq: 0, title: '연남동의 하루', body: '본문', evidence: [MESSAGE_EVIDENCE, { type: 'photo', at: '2026-08-19T14:22:11+09:00', photoPath: 'magazine/x/aa01.jpg' }] },
      { seq: 1, title: '성수동의 하루', body: '본문', evidence: [{ type: 'date', at: '2026-08-26' }] },
    ],
    closing: '다음 달에도 새로운 곳을 찾아가 본다.',
  },
}

describe('this_month 저장 스키마 (§7)', () => {
  const clone = () => JSON.parse(JSON.stringify(THIS_MONTH_EXAMPLE)) as typeof THIS_MONTH_EXAMPLE

  it('메시지·사진·데이트 근거를 담은 예시가 통과한다', () => {
    expect(ThisMonthStoredSchema.safeParse(THIS_MONTH_EXAMPLE).success).toBe(true)
  })

  it("polarity에 'negative'가 없다(스키마상 허용하지 않는다)", () => {
    const doc = clone()
    Object.assign(doc.payload.theme, { polarity: 'negative' })
    expect(ThisMonthStoredSchema.safeParse(doc).success).toBe(false)
  })

  it('소기사는 2~4편', () => {
    const doc = (n: number) => ({ ...THIS_MONTH_EXAMPLE, payload: { ...THIS_MONTH_EXAMPLE.payload, articles: Array.from({ length: n }, (_, i) => ({ ...THIS_MONTH_EXAMPLE.payload.articles[0], seq: i })) } })
    expect([1, 2, 4, 5].map((n) => ThisMonthStoredSchema.safeParse(doc(n)).success)).toEqual([false, true, true, false])
  })

  it('근거는 소기사마다 최소 1개', () => {
    const doc = clone()
    doc.payload.articles[1].evidence = []
    expect(ThisMonthStoredSchema.safeParse(doc).success).toBe(false)
  })

  it('headline 16자·title 20자(코드포인트)', () => {
    const headline = (n: number) => {
      const d = clone()
      d.payload.theme.headline = '가'.repeat(n)
      return ThisMonthStoredSchema.safeParse(d).success
    }
    const title = (n: number) => {
      const d = clone()
      d.payload.articles[0].title = '가'.repeat(n)
      return ThisMonthStoredSchema.safeParse(d).success
    }
    expect([headline(16), headline(17), title(20), title(21)]).toEqual([true, false, true, false])
  })

  it('근거는 종류에 맞는 필드를 갖는다 - message는 excerpt·attribution, photo는 photoPath', () => {
    expect(MonthEvidenceSchema.safeParse({ type: 'message', at: '2026-08-22T09:20:00+09:00' }).success).toBe(false)
    expect(MonthEvidenceSchema.safeParse({ type: 'photo', at: '2026-08-19T14:22:11+09:00' }).success).toBe(false)
    expect(MonthEvidenceSchema.safeParse({ type: 'date', at: '2026-08-26' }).success).toBe(true)
  })

  it('metric 근거 종류는 없다(MVP에서 뺐다)', () => {
    expect(MonthEvidenceSchema.safeParse({ type: 'metric', at: '2026-08-26' }).success).toBe(false)
  })

  it('신호의 count는 정수이고 근거 개수이므로 1 이상이다', () => {
    const doc = clone()
    doc.payload.theme.signals[0].count = 0
    expect(ThisMonthStoredSchema.safeParse(doc).success).toBe(false)
  })
})
