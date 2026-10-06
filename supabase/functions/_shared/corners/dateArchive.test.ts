/// <reference types="jest" />
import {
  CoupleMembershipError,
  findMissingReferencePaths,
  processCornerResponse,
  runCornerModule,
} from '../cornerPipeline.ts'
import { findForbiddenKeys } from '../../../../src/engine/corners/forbiddenKeys.ts'
import {
  COUPLE_B,
  DATE_RECALLED,
  DATE_THIS_1,
  DATE_THIS_2,
  MONTHLY_CONTEXT,
  dateRecord,
  scriptedLlmClient,
} from '../testFixtures/cornerFixtures.ts'
import {
  dateArchiveLlmSchema,
  dateArchiveModule,
  DATE_ARCHIVE_FIXED_QUESTIONS,
  DATE_ARCHIVE_REFERENCES,
  type DateArchiveInput,
} from './dateArchive.ts'

/**
 * 17-1 데이트 아카이브 — 요청 만들기·응답 처리 (MASTER 17-1, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §2).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 * 입력은 픽스처다. 코너 함수는 `llmClient` 없이 직접 부른다.
 */

const INPUT: DateArchiveInput = { dates: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED] }

const question = (text: string, basis: string) => ({ text, basis })

/** 정상 응답. 일부러 날짜 순서를 섞어 보낸다 - 저장 순서는 LLM이 정하지 않는다. */
const GOOD_OUTPUT = {
  kind: 'articles',
  featuredDateId: 'd-1',
  articles: [
    {
      dateId: 'd-old',
      title: '합정 산책',
      stopCaptions: [{ seq: 0, caption: '오전에 공원을 걸었다' }],
      tailoredQuestion: question('올해도 합정에 가볼까?', '1년 전 오늘 합정 공원 방문'),
    },
    {
      dateId: 'd-2',
      title: '성수동 카페',
      stopCaptions: [
        { seq: 0, caption: '점심 무렵 카페에 들렀다' },
        { seq: 1, caption: '이어서 근처를 걸었다' },
      ],
      tailoredQuestion: question('다음엔 성수동에서 저녁을 먹어볼까?', '낮 시간 카페 방문'),
    },
    {
      dateId: 'd-1',
      title: '스파이더맨과 케이크 사이',
      stopCaptions: [{ seq: 1, caption: '영화가 끝나고 근처에서 저녁' }],
      tailoredQuestion: question('다음에 또 영화 보러 간다면, 이번엔 조조로 가볼까?', '오후 영화 관람 후 저녁 식사로 이어진 동선'),
    },
  ],
}

function run(output: unknown, input: DateArchiveInput = INPUT) {
  const raw = typeof output === 'string' ? output : JSON.stringify(output)
  return processCornerResponse(dateArchiveModule, raw, input, MONTHLY_CONTEXT)
}

/** GOOD_OUTPUT에서 기사 하나를 고친 응답. */
function withArticle(dateId: string, patch: Record<string, unknown>) {
  return {
    ...GOOD_OUTPUT,
    articles: GOOD_OUTPUT.articles.map((a) => (a.dateId === dateId ? { ...a, ...patch } : a)),
  }
}

describe('17-1 코너 상수 (r41)', () => {
  it('코너 이름 "데이트 아카이브", 지면 제목 "함께한 하루"', () => {
    expect(dateArchiveModule.cornerName).toBe('데이트 아카이브')
    expect(dateArchiveModule.pageTitle).toBe('함께한 하루')
  })

  it('고정 질문 문구는 CORNER_CONTENT 예시의 상수다', () => {
    expect(DATE_ARCHIVE_FIXED_QUESTIONS).toEqual({
      rating: '이날의 데이트는 10점 만점에 몇 점?',
      recall: '이날 중 가장 기억에 남는 건?',
    })
  })
})

describe('17-1 요청 만들기', () => {
  it('시스템 블록은 캐시 표시를 가지고, 가변 입력(user)에는 없다', () => {
    const request = dateArchiveModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    expect(request.system).toHaveLength(2)
    expect(request.system.every((b) => b.cacheBreakpoint === true)).toBe(true)
    expect(request.user.some((b) => b.cacheBreakpoint === true)).toBe(false)
  })

  it('캐시 표시 앞 블록에는 입력 레코드의 내용이 없다', () => {
    const cacheable = dateArchiveModule.buildRequest(INPUT, MONTHLY_CONTEXT).system.map((b) => b.text).join('\n')
    for (const d of INPUT.dates) {
      expect(cacheable).not.toContain(d.id)
      expect(cacheable).not.toContain(d.source.dateOn)
      for (const stop of d.source.stops) {
        if (stop.placeName !== null) expect(cacheable).not.toContain(stop.placeName)
      }
    }
    expect(cacheable).not.toContain('스파이더맨 봤다')
  })

  it('서로 다른 두 입력에서 캐시 표시까지의 접두가 같다', () => {
    const a = dateArchiveModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    const b = dateArchiveModule.buildRequest({ dates: [DATE_THIS_2] }, { ...MONTHLY_CONTEXT, periodLabel: '2026년 9월' })
    expect(b.system).toEqual(a.system)
    expect(b.user).not.toEqual(a.user)
  })

  it('user 블록에 각 데이트의 id·장소·유저 기록(맥락)이 실린다, 유저 기록이 있는 구간은 표시된다', () => {
    const user = dateArchiveModule.buildRequest(INPUT, MONTHLY_CONTEXT).user.map((b) => b.text).join('\n')
    for (const d of INPUT.dates) expect(user).toContain(`"id":"${d.id}"`)
    expect(user).toContain('홍대 CGV')
    expect(user).toContain('"recalled":true')
    expect(user).toContain('스파이더맨 봤다')
  })

  it('입력 레코드 순서가 달라도 같은 요청이다(결정론)', () => {
    const shuffled: DateArchiveInput = { dates: [DATE_RECALLED, DATE_THIS_2, DATE_THIS_1] }
    expect(dateArchiveModule.buildRequest(shuffled, MONTHLY_CONTEXT)).toEqual(
      dateArchiveModule.buildRequest(INPUT, MONTHLY_CONTEXT),
    )
  })
})

describe('17-1 LLM 출력 스키마 (r44)', () => {
  it('선언된 path가 전부 스키마에 있다', () => {
    expect(findMissingReferencePaths(dateArchiveLlmSchema, DATE_ARCHIVE_REFERENCES)).toEqual([])
  })

  it('정상 샘플의 키는 FORBIDDEN_KEYS에 걸리지 않는다 - 맞춤 질문의 키가 suggestion이 아니라 tailoredQuestion이다', () => {
    expect(findForbiddenKeys(GOOD_OUTPUT)).toEqual([])
    expect(JSON.stringify(GOOD_OUTPUT)).not.toContain('"suggestion"')
  })

  it('빈 결과를 표현하는 형태가 없다 - { "kind": "none" }은 스키마가 거부한다', () => {
    expect(dateArchiveLlmSchema.safeParse({ kind: 'none' }).success).toBe(false)
  })
})

describe('17-1 응답 처리 - 저장 내용', () => {
  const result = run(GOOD_OUTPUT)

  it('정상 응답이 통과한다', () => {
    expect(result.ok).toBe(true)
  })

  it('헤더는 상수와 호출자 맥락의 기간 표기다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.schemaVersion).toBe('1.0')
    expect(result.content.header).toEqual({ cornerName: '데이트 아카이브', title: '함께한 하루', periodLabel: '2026년 8월' })
  })

  it('기사 순서는 이번 기간 데이트 날짜순 -> 재소환 데이트 날짜순이다(LLM이 보낸 순서와 무관)', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.articles.map((a) => a.dateId)).toEqual(['d-1', 'd-2', 'd-old'])
    expect(result.content.payload.articles.map((a) => a.recalled)).toEqual([false, false, true])
  })

  it('데이트 원문(dateOn·지역·장소·좌표·사진·유저 기록)은 입력에서 옮겨 적는다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const first = result.content.payload.articles[0]
    expect(first.dateOn).toBe('2026-08-19')
    expect(first.region).toBe('연남동')
    expect(first.stops[0]).toMatchObject({ seq: 0, time: '14:20', placeName: '홍대 CGV', lat: 37.5551, lng: 126.9236 })
    expect(first.stops[0].userNotes).toEqual(DATE_THIS_1.source.stops[0].userNotes)
    expect(first.stops[0].photos).toEqual(DATE_THIS_1.source.stops[0].photos)
  })

  it('aiCaption: 유저 기록이 있는 구간은 null, 없는 구간에만 LLM의 캡션이 들어간다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const stops = result.content.payload.articles[0].stops
    expect(stops[0].aiCaption).toBeNull()
    expect(stops[1].aiCaption).toBe('영화가 끝나고 근처에서 저녁')
  })

  it('featured는 featuredDateId 하나만 true다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.articles.map((a) => a.featured)).toEqual([true, false, false])
  })

  it('재소환: recalled는 입력 레코드의 표시이고 recallReason은 입력의 사유다. 재소환이 아니면 recallReason이 없다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const [first, , recalled] = result.content.payload.articles
    expect(recalled.recallReason).toBe('anniversary')
    expect('recallReason' in first).toBe(false)
  })

  it('마무리 질문은 rating·recall(고정 문구)·suggestion(LLM 문장 + 근거) 3종이고 답변 필드가 없다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const q = result.content.payload.articles[0].closingQuestions
    expect(q).toEqual([
      { type: 'rating', text: '이날의 데이트는 10점 만점에 몇 점?' },
      { type: 'recall', text: '이날 중 가장 기억에 남는 건?' },
      {
        type: 'suggestion',
        text: '다음에 또 영화 보러 간다면, 이번엔 조조로 가볼까?',
        basis: '오후 영화 관람 후 저녁 식사로 이어진 동선',
      },
    ])
  })

  it('고정 질문의 문구를 LLM이 써 보내도 쓰이지 않는다', () => {
    const r = run(
      withArticle('d-1', {
        closingQuestions: [{ type: 'rating', text: 'LLM이 쓴 평점 질문' }],
        recallText: 'LLM이 쓴 회상 질문',
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(JSON.stringify(r.content)).not.toContain('LLM이 쓴')
  })

  it('요약은 이번 기간 데이트만 센다(재소환 제외) - dateCount 2, regions 2', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.summary).toEqual({ dateCount: 2, regionCount: 2, regions: ['연남동', '성수동'] })
  })

  it('지도: pins는 정거장에서(장소명·좌표 있는 것만) 방문 순서대로, bounds는 그 좌표의 최소·최대', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.mapInfographic).toEqual({
      bounds: { north: 37.5602, south: 37.5446, east: 127.0559, west: 126.9236 },
      pins: [
        { lat: 37.5551, lng: 126.9236, label: '홍대 CGV', dateOn: '2026-08-19', order: 1 },
        { lat: 37.5602, lng: 126.9251, label: 'OO식당', dateOn: '2026-08-19', order: 2 },
        { lat: 37.5446, lng: 127.0559, label: '성수 OO카페', dateOn: '2026-08-26', order: 3 },
      ],
    })
  })

  it('좌표가 없으면 지도 전체가 null이다', () => {
    const noCoords = (id: string, dateOn: string) =>
      dateRecord(id, dateOn, '연남동', [
        { seq: 0, time: '14:00', placeName: '어딘가', lat: null, lng: null, photos: [], userNotes: [] },
      ])
    const input: DateArchiveInput = { dates: [noCoords('n-1', '2026-08-05')] }
    const r = run(
      {
        kind: 'articles',
        featuredDateId: 'n-1',
        articles: [{ dateId: 'n-1', title: '제목', stopCaptions: [], tailoredQuestion: question('질문?', '근거') }],
      },
      input,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.content.payload.mapInfographic).toBeNull()
  })
})

describe('17-1 응답 처리 - 유저 기록이 주인공이다 (AI가 물러나는 지점)', () => {
  it('유저 기록이 있는 구간에 캡션을 달면 schema_invalid다(조용히 버리지 않는다)', () => {
    const r = run(withArticle('d-1', { stopCaptions: [{ seq: 0, caption: '캡션' }, { seq: 1, caption: '저녁' }] }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('schema_invalid')
      expect(r.detail).toContain('유저 기록이 있는 구간')
    }
  })

  it('없는 구간(seq)에 캡션을 달면 schema_invalid다', () => {
    const r = run(withArticle('d-1', { stopCaptions: [{ seq: 9, caption: '캡션' }] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('없는 구간')
  })

  it('같은 구간에 캡션이 둘이면 schema_invalid다', () => {
    const r = run(withArticle('d-2', { stopCaptions: [{ seq: 0, caption: 'a' }, { seq: 0, caption: 'b' }] }))
    expect(r.ok).toBe(false)
  })

  it('캡션이 없는 구간은 null로 둔다(지어내지 않는다)', () => {
    const r = run(withArticle('d-2', { stopCaptions: [] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      const d2 = r.content.payload.articles.find((a) => a.dateId === 'd-2')!
      expect(d2.stops.map((s) => s.aiCaption)).toEqual([null, null])
    }
  })
})

describe('17-1 응답 처리 - 날짜·제목·길이', () => {
  it('입력의 모든 데이트가 정확히 한 번씩 기사가 되어야 한다 - 빠지면 schema_invalid', () => {
    const r = run({ ...GOOD_OUTPUT, articles: GOOD_OUTPUT.articles.filter((a) => a.dateId !== 'd-2') })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('기사가 되지 않은 데이트')
  })

  it('같은 데이트가 두 번 기사가 되면 schema_invalid', () => {
    const r = run({ ...GOOD_OUTPUT, articles: [...GOOD_OUTPUT.articles, GOOD_OUTPUT.articles[0]] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('두 번')
  })

  it('제목은 20자(코드포인트) 이내 - 20자는 통과, 21자는 schema_invalid', () => {
    expect(run(withArticle('d-1', { title: '가'.repeat(20) })).ok).toBe(true)
    const over = run(withArticle('d-1', { title: '가'.repeat(21) }))
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.reason).toBe('schema_invalid')
  })

  it('길이는 코드포인트로 센다 - 이모지(UTF-16 두 단위) 20개는 20자다', () => {
    expect('😀'.repeat(20).length).toBe(40)
    expect(run(withArticle('d-1', { title: '😀'.repeat(20) })).ok).toBe(true)
    expect(run(withArticle('d-1', { title: '😀'.repeat(21) })).ok).toBe(false)
  })

  it('featuredDateId는 입력의 데이트여야 한다(존재하지 않는 ID는 schema_invalid)', () => {
    const r = run({ ...GOOD_OUTPUT, featuredDateId: 'd-없음' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('존재하지 않는 ID')
  })
})

describe('17-1 응답 처리 - 빈 결과 · 파싱 실패 · 금지 키', () => {
  it('호출 후 빈 결과는 없다 - { "kind": "none" }은 insufficient_input이 아니라 schema_invalid다(데이트가 있으면 만든다)', () => {
    const r = run({ kind: 'none' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('schema_invalid')
  })

  it.each([
    ['깨진 JSON', '{"kind":'],
    ['빈 객체', '{}'],
    ['배열', '[]'],
    ['articles가 빈 배열', '{"kind":"articles","featuredDateId":"d-1","articles":[]}'],
  ])('%s는 schema_invalid다', (_name, raw) => {
    const r = run(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('schema_invalid')
  })

  it('스키마에 없는 금지 키(verdict)는 forbidden_content다', () => {
    const r = run(withArticle('d-1', { verdict: '좋은 데이트' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('forbidden_content')
  })

  it('suggestion을 키로 쓰면 forbidden_content다 - 그래서 키 이름이 tailoredQuestion이다', () => {
    const r = run(withArticle('d-1', { suggestion: { text: 'x', basis: 'y' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('forbidden_content')
  })
})

describe('17-1 응답 처리 - ID 해석 (재소환은 기간 이전)', () => {
  it('입력에 다른 커플의 데이트가 섞여 있고 LLM이 그것을 기사로 쓰면 막는다(두 번째 방어선)', () => {
    const foreign = dateRecord('d-foreign', '2026-08-10', '타지', [], { coupleId: COUPLE_B })
    const r = run(
      { ...GOOD_OUTPUT, articles: [...GOOD_OUTPUT.articles, { ...GOOD_OUTPUT.articles[0], dateId: 'd-foreign' }] },
      { dates: [...INPUT.dates, foreign] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('다른 커플')
  })

  it('재소환 표시가 없는데 기간 이전인 데이트는 기간 밖이다', () => {
    const old = dateRecord('d-old2', '2025-08-19', '합정동', [])
    const r = run(
      { ...GOOD_OUTPUT, articles: [...GOOD_OUTPUT.articles, { ...GOOD_OUTPUT.articles[0], dateId: 'd-old2' }] },
      { dates: [...INPUT.dates, old] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('기간 밖')
  })

  it('재소환 표시가 있는데 기간 안인 데이트는 막는다(입력 조립의 불일치)', () => {
    const wrong = dateRecord('d-wrong', '2026-08-12', '연남동', [], { recalled: true, recallReason: 'sparse_month' })
    const r = run(
      { ...GOOD_OUTPUT, articles: [...GOOD_OUTPUT.articles, { ...GOOD_OUTPUT.articles[0], dateId: 'd-wrong' }] },
      { dates: [...INPUT.dates, wrong] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('기간 밖')
  })
})

describe('17-1 골격 실행 (runCornerModule)', () => {
  it('선행 검사: 조립된 데이트가 0건이면 LLM을 부르지 않고 insufficient_input(시도 0)', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const r = await runCornerModule(dateArchiveModule, { input: { dates: [] }, context: MONTHLY_CONTEXT, llmClient })
    expect(r).toMatchObject({ outcome: 'failure', reason: 'insufficient_input', llmCallAttempts: 0 })
    expect(llmClient.requests).toHaveLength(0)
  })

  it('이번 달 데이트가 0건이어도 재소환 데이트가 있으면 만든다(재소환까지 거친 결과가 0건일 때만 재료 부족)', async () => {
    const llmClient = scriptedLlmClient([
      JSON.stringify({
        kind: 'articles',
        featuredDateId: 'd-old',
        articles: [GOOD_OUTPUT.articles[0]],
      }),
    ])
    const r = await runCornerModule(dateArchiveModule, { input: { dates: [DATE_RECALLED] }, context: MONTHLY_CONTEXT, llmClient })
    expect(r.outcome).toBe('success')
    if (r.outcome === 'success') {
      expect(r.content.payload.summary).toEqual({ dateCount: 0, regionCount: 0, regions: [] })
      expect(r.content.payload.mapInfographic).toBeNull()
    }
  })

  it('정상: 성공하고 캐시 표시가 요청에 실린다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const r = await runCornerModule(dateArchiveModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(r.outcome).toBe('success')
    expect(llmClient.requests[0].system.some((b) => b.cacheBreakpoint === true)).toBe(true)
  })

  it('입력에 다른 커플 레코드가 섞이면 LLM을 한 번도 부르지 않고 호 전체가 멈춘다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const foreign = dateRecord('d-foreign', '2026-08-10', '타지', [], { coupleId: COUPLE_B })
    await expect(
      runCornerModule(dateArchiveModule, { input: { dates: [...INPUT.dates, foreign] }, context: MONTHLY_CONTEXT, llmClient }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.requests).toHaveLength(0)
  })

  it('재소환 표시가 있는데 기간 안인 레코드가 입력에 있으면 호출 전에 멈춘다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const wrong = dateRecord('d-wrong', '2026-08-12', '연남동', [], { recalled: true, recallReason: 'sparse_month' })
    await expect(
      runCornerModule(dateArchiveModule, { input: { dates: [...INPUT.dates, wrong] }, context: MONTHLY_CONTEXT, llmClient }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.requests).toHaveLength(0)
  })

  it('schema_invalid는 1회 재시도, forbidden_content는 재시도 없음', async () => {
    const retry = scriptedLlmClient(['{"kind":"articles"}', JSON.stringify(GOOD_OUTPUT)])
    const ok = await runCornerModule(dateArchiveModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: retry })
    expect(ok.outcome).toBe('success')
    expect(retry.requests).toHaveLength(2)

    const forbidden = scriptedLlmClient([JSON.stringify(withArticle('d-1', { verdict: 'x' })), JSON.stringify(GOOD_OUTPUT)])
    const bad = await runCornerModule(dateArchiveModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: forbidden })
    expect(bad).toMatchObject({ outcome: 'failure', reason: 'forbidden_content', llmCallAttempts: 1 })
  })
})
