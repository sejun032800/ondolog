/// <reference types="jest" />
/**
 * 84-c ④ 합성 데이터셋 연도 정정(2026 -> 2025) · 다시 검사(`recheck`) (ROADMAP r133 R133-5 ④).
 * 위임: .claude/state/prompts/phase-7/84-c-dispatch-auto-checks.md
 *
 * 메시지 문구는 그대로 두고 날짜만 1년 앞당겼다. 문구 안의 요일(메시지 20건 · 요일 낱말 22개)과 추석 대화가 데이터 날짜의
 * 달력과 맞는지 단언한다. LLM 호출 0 · 네트워크 0.
 */
import { weekdayOf } from '../../src/engine/corners/contentChecks.ts'
import { FIXTURE_YEAR, PERIOD, buildTables, periodOf } from './fixtures/m1-month/dataset.ts'
import { LEGACY_FIXTURE_YEAR, categoryOf, recheckRecords, renderRecheck } from './m1Recheck.ts'
import type { RunRecord } from './m1Review.ts'

type Row = Record<string, unknown>
const day = (iso: unknown) => String(iso).slice(0, 10)
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * 메시지마다 요일 낱말이 가리키는 날(메시지 날짜에서 며칠 뒤인가) - 사람이 문구를 읽고 정한 표.
 * "오늘만 버티면 화요일" = 다음 날 · "다음 주 토요일"(09-07) = 6일 뒤 · "이번 주 목요일"(09-15) = 3일 뒤 …
 */
const WEEKDAY_REFERENCES: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  'msg-0001': [['월요일', 0]],
  'msg-0002': [['화요일', 1]],
  'msg-0046': [['금요일', 0]],
  'msg-0077': [['일요일', 0]],
  'msg-0079': [['토요일', 6]],
  'msg-0086': [['월요일', 1]],
  'msg-0140': [['월요일', 0]],
  'msg-0141': [['월요일', 0]],
  'msg-0144': [['목요일', 3]],
  'msg-0148': [['금요일', 3]],
  'msg-0150': [['금요일', 3]],
  'msg-0151': [
    ['목요일', 2],
    ['금요일', 3],
  ],
  'msg-0152': [['금요일', 3]],
  'msg-0169': [['금요일', 3]],
  'msg-0185': [
    ['금요일', 2],
    ['토요일', 3],
  ],
  'msg-0186': [['토요일', 3]],
  'msg-0192': [['금요일', 1]],
  'msg-0222': [['월요일', 0]],
  'msg-0236': [['토요일', 2]],
  'msg-0283': [['월요일', 0]],
}

describe('84-c ④ 합성 데이터셋 연도 = 2025 (문구 그대로 · 날짜만)', () => {
  const tables = buildTables()
  const messages = tables.messages as readonly Row[]

  it('데이터 연도 · 기간', () => {
    expect(FIXTURE_YEAR).toBe(2025)
    expect(PERIOD.start.toISOString()).toBe('2025-08-31T15:00:00.000Z')
    expect(day((tables.dates as readonly Row[]).find((d) => d.id === 'date-0913')?.date_on)).toBe('2025-09-13')
    expect(day((tables.dates as readonly Row[]).find((d) => d.id === 'date-2025-0920')?.date_on)).toBe('2024-09-20') // 재소환도 1년 앞
  })

  it('요일이 들어간 메시지 20건 · 요일 낱말 22개가 모두 데이터 날짜의 요일과 맞는다', () => {
    const withWeekday = messages.filter((m) => /[월화수목금토일]요일/.test(String(m.body)))
    expect(withWeekday.map((m) => m.id).sort()).toEqual(Object.keys(WEEKDAY_REFERENCES).sort())
    let words = 0
    for (const m of withWeekday) {
      const found = [...String(m.body).matchAll(/([월화수목금토일])요일/g)].map((x) => x[0])
      const refs = WEEKDAY_REFERENCES[String(m.id)]
      expect(found).toEqual(refs.map(([w]) => w))
      for (const [word, offset] of refs) {
        expect([m.id, weekdayOf(addDays(day(m.sent_at), offset))]).toEqual([m.id, word])
        words += 1
      }
    }
    expect(words).toBe(22)
  })

  it('데이트 날도 문구와 맞는다 - 성수(09-13) · 양평(09-27) = 토요일', () => {
    expect(weekdayOf(`${FIXTURE_YEAR}-09-13`)).toBe('토요일')
    expect(weekdayOf(`${FIXTURE_YEAR}-09-27`)).toBe('토요일')
  })

  it('추석: "이번 주만 지나면 추석"(09-29) - 2025년 추석(10-06)은 다음 주 · 2026년 추석(09-25)은 이미 지남', () => {
    const chuseok = messages.filter((m) => String(m.body).includes('추석'))
    expect(chuseok.map((m) => m.id)).toEqual(['msg-0284', 'msg-0285'])
    const said = day(chuseok[0].sent_at)
    expect(said).toBe('2025-09-29')
    expect(weekdayOf(said)).toBe('월요일')
    const CHUSEOK_2025 = '2025-10-06' // 음력 8월 15일
    expect(addDays(said, 7)).toBe(CHUSEOK_2025) // 이번 주(월~일)가 지난 다음 월요일
    const CHUSEOK_2026 = '2026-09-25'
    expect(CHUSEOK_2026 < addDays(said, 365)).toBe(true) // 2026년이었다면 이미 지난 추석이다
  })

  it('buildTables(2026)은 84-b 2차 입력과 같다 - 날짜만 1년 뒤 · ID 그대로', () => {
    const t26 = buildTables(2026)
    expect(day((t26.dates as readonly Row[]).find((d) => d.id === 'date-0913')?.date_on)).toBe('2026-09-13')
    expect(day((t26.dates as readonly Row[]).find((d) => d.id === 'date-2025-0920')?.date_on)).toBe('2025-09-20')
    expect((t26.messages as readonly Row[])[0].sent_at).toBe('2026-09-01T08:12:00+09:00')
    expect((t26.messages as readonly Row[]).map((m) => m.id)).toEqual(messages.map((m) => m.id))
    expect(periodOf(2026).start.toISOString()).toBe('2026-08-31T15:00:00.000Z')
  })
})

describe('84-c 다시 검사(recheck) - 실행 기록의 데이터 연도로 입력을 다시 만든다', () => {
  const output = (body: string) =>
    JSON.stringify({
      kind: 'theme',
      theme: {
        headline: '성수와 양평의 달',
        lead: '9월에는 성수와 양평에 다녀온 기록이 남았습니다.',
        polarity: 'neutral',
        signals: [{ kind: 'place', value: '성수', evidence: [{ type: 'date', dateId: 'date-0913' }] }],
      },
      articles: [
        { title: '성수의 하루', body, evidence: [{ type: 'date', dateId: 'date-0913' }] },
        { title: '양평의 하루', body: '9월 27일에는 양평에 다녀왔습니다.', evidence: [{ type: 'date', dateId: 'date-0927' }] },
      ],
      closing: '다음 달에도 기록이 이어집니다.',
    })
  const record = (fixtureYear: number | undefined, text: string, outcome: RunRecord['outcome'] = 'success'): RunRecord => ({
    model: 'claude-sonnet-5-5',
    corner: 'this_month',
    run: 1,
    tag: 't',
    startedAt: '',
    maxTokens: 16000,
    totalLatencyMs: 0,
    httpCalls: [],
    attempts: [{ index: 1, text, validation: { ok: true } }],
    outcome,
    failureReason: null,
    failureDetail: null,
    llmCallAttempts: 1,
    truncated: false,
    content: null,
    usageTotal: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    ...(fixtureYear === undefined ? {} : { fixtureYear }),
  })

  it('같은 문장 - 2025 데이터면 통과, 연도 없는 옛 기록(2026)이면 요일이 틀려 잡힌다', async () => {
    const text = output('9월 13일 토요일에 성수에 다녀왔습니다.')
    const [now] = await recheckRecords([record(2025, text)])
    expect(now).toMatchObject({ parsed: true, published: true, violations: [] })
    const [legacy] = await recheckRecords([record(undefined, text)])
    expect(LEGACY_FIXTURE_YEAR).toBe(2026)
    expect(legacy.violations).toEqual(['articles[0].body: 요일 「토요일」≠ 2026-09-13(일요일)'])
    expect(categoryOf(legacy.violations[0])).toBe('요일')
  })

  it('말투 · 시각도 같은 검사 - 표에는 칸 · 규칙만', async () => {
    const rows = await recheckRecords([record(2025, output('9월 13일에는 13시 10분에 서울숲에 갔다.'), 'failure')])
    expect(rows[0].published).toBe(false)
    expect(rows[0].violations.map(categoryOf).sort()).toEqual(['말투', '시각'])
    const md = renderRecheck(rows)
    expect(md).toContain('| claude-sonnet-5-5 | this_month | 1 | 1 | 안 실림 | 1 | 1 | 0 | 0 | 0 |')
    expect(md).not.toContain('서울숲에 갔다')
  })

  it('스키마로 읽히지 않는 시도는 대상 아님', async () => {
    const rows = await recheckRecords([record(2025, '{깨진')])
    expect(rows[0]).toMatchObject({ parsed: false, violations: [] })
  })
})
