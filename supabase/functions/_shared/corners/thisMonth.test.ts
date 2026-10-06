/// <reference types="jest" />
import {
  CoupleMembershipError,
  findMissingReferencePaths,
  processCornerResponse,
  runCornerModule,
  type CornerContext,
} from '../cornerPipeline.ts'
import { findForbiddenKeys } from '../../../../src/engine/corners/forbiddenKeys.ts'
import {
  CHAT_MESSAGES,
  COUPLE_B,
  DATE_THIS_1,
  DATE_THIS_2,
  MONTHLY_CONTEXT,
  PHOTOS,
  photo,
  scriptedLlmClient,
} from '../testFixtures/cornerFixtures.ts'
import { thisMonthLlmSchema, thisMonthModule, THIS_MONTH_REFERENCES, type ThisMonthInput } from './thisMonth.ts'

/**
 * 17-5 이달의 우리 — 요청 만들기·응답 처리 (MASTER 17-5, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §7).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 * 입력은 픽스처다. 코너 함수는 `llmClient` 없이 직접 부른다.
 */

const INPUT: ThisMonthInput = { messages: CHAT_MESSAGES, photos: PHOTOS, dates: [DATE_THIS_1, DATE_THIS_2] }

const GOOD_OUTPUT = {
  kind: 'theme',
  theme: {
    headline: '새로운 동네를 다닌 달',
    lead: '이번 달에는 연남동과 성수동에 다녀온 기록이 남았다.',
    polarity: 'positive',
    signals: [
      {
        kind: 'place',
        value: '연남동',
        // 같은 근거를 두 번 적어도 개수는 서로 다른 근거의 수다.
        evidence: [{ type: 'date', dateId: 'd-1' }, { type: 'photo', photoId: 'p-1' }, { type: 'photo', photoId: 'p-1' }],
      },
      { kind: 'keyword', value: '우산', evidence: [{ type: 'message', messageId: 'm-1' }] },
    ],
  },
  articles: [
    {
      title: '연남동의 하루',
      body: '8월 19일에는 연남동에서 영화를 보고 저녁을 먹었다.',
      evidence: [{ type: 'date', dateId: 'd-1' }, { type: 'photo', photoId: 'p-1' }],
    },
    {
      title: '아침 인사',
      body: '비가 오던 아침에 오간 대화가 있었다.',
      evidence: [{ type: 'message', messageId: 'm-1' }, { type: 'message', messageId: 'm-2' }],
    },
  ],
  closing: '다음 달에도 새로운 곳을 찾아가 본다.',
}

function run(output: unknown, input: ThisMonthInput = INPUT, context: CornerContext = MONTHLY_CONTEXT) {
  const raw = typeof output === 'string' ? output : JSON.stringify(output)
  return processCornerResponse(thisMonthModule, raw, input, context)
}

function withTheme(patch: Record<string, unknown>) {
  return { ...GOOD_OUTPUT, theme: { ...GOOD_OUTPUT.theme, ...patch } }
}

describe('17-5 코너 상수 (r41)', () => {
  it('코너 이름 "이달의 우리", 지면 제목 "이달의 우리"', () => {
    expect(thisMonthModule.cornerName).toBe('이달의 우리')
    expect(thisMonthModule.pageTitle).toBe('이달의 우리')
  })
})

describe('17-5 요청 만들기', () => {
  it('시스템 블록은 캐시 표시를 가지고, 가변 입력(user)에는 없다', () => {
    const request = thisMonthModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    expect(request.system).toHaveLength(2)
    expect(request.system.every((b) => b.cacheBreakpoint === true)).toBe(true)
    expect(request.user.some((b) => b.cacheBreakpoint === true)).toBe(false)
  })

  it('캐시 표시 앞 블록에는 입력 레코드의 내용이 없다', () => {
    const cacheable = thisMonthModule.buildRequest(INPUT, MONTHLY_CONTEXT).system.map((b) => b.text).join('\n')
    for (const m of CHAT_MESSAGES) expect(cacheable).not.toContain(m.source.text)
    for (const p of PHOTOS) expect(cacheable).not.toContain(p.source.path)
    expect(cacheable).not.toContain('홍대 CGV')
    expect(cacheable).not.toContain(MONTHLY_CONTEXT.periodLabel)
  })

  it('서로 다른 두 입력에서 캐시 표시까지의 접두가 같다', () => {
    const a = thisMonthModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    const b = thisMonthModule.buildRequest({ messages: [], photos: [PHOTOS[0]], dates: [] }, { ...MONTHLY_CONTEXT, periodLabel: '2026년 9월' })
    expect(b.system).toEqual(a.system)
    expect(b.user).not.toEqual(a.user)
  })

  it('user 블록에 메시지·사진·데이트의 id가 실리고, 사진의 저장 경로는 실리지 않는다(LLM이 경로를 쓸 일이 없다)', () => {
    const user = thisMonthModule.buildRequest(INPUT, MONTHLY_CONTEXT).user.map((b) => b.text).join('\n')
    for (const id of ['m-1', 'p-1', 'd-1']) expect(user).toContain(`"id":"${id}"`)
    expect(user).not.toContain('photos/couple-a/aa01.jpg')
  })

  it('입력 레코드 순서가 달라도 같은 요청이다(결정론)', () => {
    const shuffled: ThisMonthInput = {
      messages: [...CHAT_MESSAGES].reverse(),
      photos: [...PHOTOS].reverse(),
      dates: [DATE_THIS_2, DATE_THIS_1],
    }
    expect(thisMonthModule.buildRequest(shuffled, MONTHLY_CONTEXT)).toEqual(thisMonthModule.buildRequest(INPUT, MONTHLY_CONTEXT))
  })
})

describe('17-5 LLM 출력 스키마 (r44)', () => {
  it('선언된 path 여섯 개가 전부 스키마에 있다', () => {
    expect(THIS_MONTH_REFERENCES.kind === 'fields' && THIS_MONTH_REFERENCES.fields).toHaveLength(6)
    expect(findMissingReferencePaths(thisMonthLlmSchema, THIS_MONTH_REFERENCES)).toEqual([])
  })

  it('정상 샘플의 키는 FORBIDDEN_KEYS에 걸리지 않는다', () => {
    expect(findForbiddenKeys(GOOD_OUTPUT)).toEqual([])
    expect(findForbiddenKeys({ kind: 'none' })).toEqual([])
  })

  it('LLM 출력 스키마에는 count·원문·경로가 없다 - 써 보내도 스키마가 버린다', () => {
    const parsed = thisMonthLlmSchema.parse({
      ...GOOD_OUTPUT,
      theme: {
        ...GOOD_OUTPUT.theme,
        signals: [{ kind: 'place', value: '연남동', count: 99, evidence: [{ type: 'date', dateId: 'd-1' }] }],
      },
    })
    expect(JSON.stringify(parsed)).not.toContain('99')
  })
})

describe('17-5 응답 처리 - 저장 내용', () => {
  const result = run(GOOD_OUTPUT)

  it('정상 응답이 통과한다', () => {
    expect(result.ok).toBe(true)
  })

  it('헤더는 상수와 호출자 맥락의 기간 표기, 봉투 버전 1.0', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.schemaVersion).toBe('1.0')
    expect(result.content.header).toEqual({ cornerName: '이달의 우리', title: '이달의 우리', periodLabel: '2026년 8월' })
  })

  it('theme.signals[].count는 파이프라인이 센다 - 그 신호가 참조한 서로 다른 근거 ID 개수', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.theme.signals).toEqual([
      { kind: 'place', value: '연남동', count: 2 },
      { kind: 'keyword', value: '우산', count: 1 },
    ])
  })

  it('LLM이 count를 써 보내도 쓰이지 않는다', () => {
    const r = run(
      withTheme({ signals: [{ kind: 'place', value: '연남동', count: 99, evidence: [{ type: 'date', dateId: 'd-1' }] }] }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.content.payload.theme.signals[0].count).toBe(1)
  })

  it('근거: 메시지는 원문·출처 표기, 사진은 입력의 경로, 데이트는 날짜를 입력에서 옮겨 적는다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const [dateArticle, messageArticle] = result.content.payload.articles
    expect(dateArticle.evidence).toEqual([
      { type: 'date', at: '2026-08-19' },
      { type: 'photo', at: '2026-08-19T14:22:11+09:00', photoPath: 'photos/couple-a/aa01.jpg' },
    ])
    expect(messageArticle.evidence).toEqual([
      {
        type: 'message',
        at: '2026-08-22T09:20:00+09:00',
        excerpt: '오늘 비 온대. 우산 챙겼어?',
        attribution: { display: '2026.08.22 09:20, 아침 대화 중', at: '2026-08-22T09:20:00+09:00', source: 'chat' },
      },
      {
        type: 'message',
        at: '2026-08-22T09:21:30+09:00',
        excerpt: '응 챙겼어. 너도 감기 조심해',
        attribution: { display: '2026.08.22 09:21, 아침 대화 중', at: '2026-08-22T09:21:30+09:00', source: 'chat' },
      },
    ])
  })

  it('원문·경로를 LLM이 써 보내도 저장에 들어가지 않는다 - 입력과 문자 단위로 일치한다', () => {
    const r = run({
      ...GOOD_OUTPUT,
      articles: [
        {
          ...GOOD_OUTPUT.articles[0],
          evidence: [
            { type: 'message', messageId: 'm-6', excerpt: '변조된 원문', at: '1999-01-01' },
            { type: 'photo', photoId: 'p-1', photoPath: '변조/경로.jpg' },
          ],
        },
        GOOD_OUTPUT.articles[1],
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [message, photoEvidence] = r.content.payload.articles[0].evidence
    expect(message.excerpt).toBe(CHAT_MESSAGES.find((m) => m.id === 'm-6')!.source.text)
    expect(photoEvidence.photoPath).toBe('photos/couple-a/aa01.jpg')
    expect(JSON.stringify(r.content)).not.toContain('변조')
  })

  it('소기사 seq는 배열 순서대로 0부터, 순서는 LLM이 준 그대로다', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    expect(result.content.payload.articles.map((a) => [a.seq, a.title])).toEqual([
      [0, '연남동의 하루'],
      [1, '아침 인사'],
    ])
  })

  it('metric 근거는 없다 - 저장된 근거 종류는 message·photo·date뿐', () => {
    if (!result.ok) throw new Error('정상 응답이 실패')
    const types = result.content.payload.articles.flatMap((a) => a.evidence.map((e) => e.type))
    expect(new Set(types)).toEqual(new Set(['date', 'photo', 'message']))
  })
})

describe('17-5 응답 처리 - 톤 · 개수 · 길이', () => {
  it("polarity에 'negative'가 없다 - 부정 테마는 schema_invalid", () => {
    const r = run(withTheme({ polarity: 'negative' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('schema_invalid')
  })

  it("polarity 'neutral'은 통과한다", () => {
    expect(run(withTheme({ polarity: 'neutral' })).ok).toBe(true)
  })

  it('소기사는 2~4편 - 1편·5편은 schema_invalid, 2편·4편은 통과', () => {
    const article = (i: number) => ({ ...GOOD_OUTPUT.articles[0], title: `기사 ${i}` })
    const make = (n: number) => ({ ...GOOD_OUTPUT, articles: Array.from({ length: n }, (_, i) => article(i)) })
    expect(run(make(1)).ok).toBe(false)
    expect(run(make(5)).ok).toBe(false)
    expect(run(make(2)).ok).toBe(true)
    expect(run(make(4)).ok).toBe(true)
  })

  it('theme.headline은 16자(코드포인트) 이내, articles[].title은 20자 이내', () => {
    expect(run(withTheme({ headline: '가'.repeat(16) })).ok).toBe(true)
    expect(run(withTheme({ headline: '가'.repeat(17) })).ok).toBe(false)
    const title = (n: number) => ({ ...GOOD_OUTPUT, articles: [{ ...GOOD_OUTPUT.articles[0], title: '가'.repeat(n) }, GOOD_OUTPUT.articles[1]] })
    expect(run(title(20)).ok).toBe(true)
    expect(run(title(21)).ok).toBe(false)
  })

  it('소기사마다 근거가 최소 1개다 - 없으면 schema_invalid', () => {
    const r = run({ ...GOOD_OUTPUT, articles: [{ ...GOOD_OUTPUT.articles[0], evidence: [] }, GOOD_OUTPUT.articles[1]] })
    expect(r.ok).toBe(false)
  })

  it('신호마다 근거가 최소 1개다(count는 근거 개수이므로)', () => {
    const r = run(withTheme({ signals: [{ kind: 'place', value: '연남동', evidence: [] }] }))
    expect(r.ok).toBe(false)
  })
})

describe('17-5 응답 처리 - 명시적 빈 결과 · 파싱 실패 · 금지 키', () => {
  it('{ "kind": "none" }은 insufficient_input이다(2편을 만들 재료가 안 됨)', () => {
    const r = run({ kind: 'none' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('insufficient_input')
  })

  it.each([
    ['깨진 JSON', '{"kind":'],
    ['빈 객체', '{}'],
    ['배열', '[]'],
    ['kind 오탈자', '{"kind":"nonee"}'],
    ['articles가 빈 배열', JSON.stringify({ ...GOOD_OUTPUT, articles: [] })],
  ])('파싱 실패와 섞이지 않는다 - %s는 schema_invalid다', (_name, raw) => {
    const r = run(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('schema_invalid')
  })

  it('스키마에 없는 금지 키(verdict)와 평가 키(rating)는 forbidden_content다', () => {
    for (const bad of [{ ...GOOD_OUTPUT, verdict: '잘 지냄' }, withTheme({ rating: 5 })]) {
      const r = run(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('forbidden_content')
    }
  })
})

describe('17-5 응답 처리 - ID 해석 (종류별, 판정은 골격)', () => {
  it('입력에 없는 사진 id는 schema_invalid(존재하지 않는 ID)', () => {
    const r = run({
      ...GOOD_OUTPUT,
      articles: [{ ...GOOD_OUTPUT.articles[0], evidence: [{ type: 'photo', photoId: 'p-없음' }] }, GOOD_OUTPUT.articles[1]],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('존재하지 않는 ID')
  })

  it('종류가 맞아야 한다 - 사진 id를 messageId 자리에 쓸 수 없다', () => {
    const r = run({
      ...GOOD_OUTPUT,
      articles: [{ ...GOOD_OUTPUT.articles[0], evidence: [{ type: 'message', messageId: 'p-1' }] }, GOOD_OUTPUT.articles[1]],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('존재하지 않는 ID')
  })

  it('입력 집합에 다른 커플의 사진이 섞여 있고 LLM이 그것을 근거로 쓰면 막는다(두 번째 방어선)', () => {
    const foreign = photo('p-foreign', '2026-08-20T10:00:00', 'photos/couple-b/x.jpg', { coupleId: COUPLE_B })
    const r = run(
      {
        ...GOOD_OUTPUT,
        articles: [{ ...GOOD_OUTPUT.articles[0], evidence: [{ type: 'photo', photoId: 'p-foreign' }] }, GOOD_OUTPUT.articles[1]],
      },
      { ...INPUT, photos: [...PHOTOS, foreign] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('다른 커플')
  })

  it('신호의 근거도 같이 판정한다 - 신호가 다른 커플의 메시지를 참조하면 막는다', () => {
    const foreignMessage = { ...CHAT_MESSAGES[0], id: 'm-foreign', coupleId: COUPLE_B }
    const r = run(
      withTheme({ signals: [{ kind: 'keyword', value: '우산', evidence: [{ type: 'message', messageId: 'm-foreign' }] }] }),
      { ...INPUT, messages: [...CHAT_MESSAGES, foreignMessage] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain('다른 커플')
  })

  it('기간은 context.period가 기준이다 - 넓힌 기간을 넘기면 그 안의 근거는 통과한다(17-0-4-A)', () => {
    const julyPhoto = photo('p-july', '2026-07-20T10:00:00', 'photos/couple-a/july.jpg')
    const input: ThisMonthInput = { ...INPUT, photos: [...PHOTOS, julyPhoto] }
    const output = {
      ...GOOD_OUTPUT,
      articles: [{ ...GOOD_OUTPUT.articles[0], evidence: [{ type: 'photo', photoId: 'p-july' }] }, GOOD_OUTPUT.articles[1]],
    }
    const narrow = run(output, input, MONTHLY_CONTEXT)
    expect(narrow.ok).toBe(false)
    if (!narrow.ok) expect(narrow.detail).toContain('기간 밖')

    const widened: CornerContext = {
      ...MONTHLY_CONTEXT,
      period: { start: new Date('2026-07-01T00:00:00+09:00'), end: MONTHLY_CONTEXT.period.end },
    }
    expect(run(output, input, widened).ok).toBe(true)
  })
})

describe('17-5 골격 실행 (runCornerModule) - 호출 전·후 시점', () => {
  it('선행 검사: 채팅·사진·데이트가 전부 0건이면 LLM을 부르지 않고 insufficient_input(시도 0)', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const r = await runCornerModule(thisMonthModule, {
      input: { messages: [], photos: [], dates: [] },
      context: MONTHLY_CONTEXT,
      llmClient,
    })
    expect(r).toMatchObject({ outcome: 'failure', reason: 'insufficient_input', llmCallAttempts: 0 })
    expect(llmClient.requests).toHaveLength(0)
  })

  it('하나라도 있으면 경계값 없이 LLM에 맡긴다 - 사진 한 장뿐이어도 호출한다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify({ kind: 'none' })])
    const r = await runCornerModule(thisMonthModule, {
      input: { messages: [], photos: [PHOTOS[0]], dates: [] },
      context: MONTHLY_CONTEXT,
      llmClient,
    })
    expect(llmClient.requests).toHaveLength(1)
    // 호출 후 빈 결과: 시도 1, 재시도 없음.
    expect(r).toMatchObject({ outcome: 'failure', reason: 'insufficient_input', llmCallAttempts: 1 })
  })

  it('정상: 성공하고 캐시 표시가 요청에 실린다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const r = await runCornerModule(thisMonthModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(r.outcome).toBe('success')
    expect(llmClient.requests[0].system.some((b) => b.cacheBreakpoint === true)).toBe(true)
  })

  it('입력에 다른 커플 레코드가 섞이면 LLM을 한 번도 부르지 않고 호 전체가 멈춘다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const foreign = photo('p-foreign', '2026-08-20T10:00:00', 'photos/couple-b/x.jpg', { coupleId: COUPLE_B })
    await expect(
      runCornerModule(thisMonthModule, { input: { ...INPUT, photos: [...PHOTOS, foreign] }, context: MONTHLY_CONTEXT, llmClient }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.requests).toHaveLength(0)
  })

  it('schema_invalid는 1회 재시도, forbidden_content는 재시도 없음', async () => {
    const retry = scriptedLlmClient(['{"kind":"theme"}', JSON.stringify(GOOD_OUTPUT)])
    const ok = await runCornerModule(thisMonthModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: retry })
    expect(ok.outcome).toBe('success')
    expect(retry.requests).toHaveLength(2)

    const forbidden = scriptedLlmClient([JSON.stringify({ ...GOOD_OUTPUT, verdict: 'x' }), JSON.stringify(GOOD_OUTPUT)])
    const bad = await runCornerModule(thisMonthModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: forbidden })
    expect(bad).toMatchObject({ outcome: 'failure', reason: 'forbidden_content', llmCallAttempts: 1 })
  })
})
