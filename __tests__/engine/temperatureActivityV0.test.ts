/**
 * 온도 활동 점수 v0 (`activity_v0_provisional`, MASTER r74 10-7-3, ROADMAP R100-1).
 * 오늘 = 2026-11-15(KST) 고정 인자. 창 = 2026-11-01 ~ 2026-11-14.
 */

import {
  ACTIVITY_V0_PROVISIONAL_COEFFICIENTS as V0,
  computeActivityDeltaV0,
  computeDailyScoresV0,
  computeDailyTemperatureV0,
  kstDayKey,
  type ActivityDailyCount,
  type ActivityV0CountsInput,
  type ActivityV0MessagesInput,
} from '../../src/engine/temperature'

const A = 'user-a'
const B = 'user-b'
const TODAY = '2026-11-15'
const BASELINE = { contrast: 36.5, neutral: 39, best: 42 }

function dayKey(n: number): string {
  // n = 1..14 -> 2026-11-(15-n)
  return `2026-11-${String(15 - n).padStart(2, '0')}`
}

/** 날짜 목록 → 그날 사진 1장(함께한 하루) 기록 수. */
function rd(dates: string[]) {
  return dates.map((date) => ({ date, stops: 0, photos: 1, memos: 0 }))
}

function counts(rows: ActivityDailyCount[], recordDates: string[] = []): ActivityV0CountsInput {
  return { userIds: [A, B], todayKst: TODAY, recordDays: rd(recordDates), dailyCounts: rows }
}

describe('kstDayKey — 한국 시간 0시 경계', () => {
  it('UTC 14:59:59Z = KST 23:59:59 → 그날', () => {
    expect(kstDayKey('2026-11-10T14:59:59Z')).toBe('2026-11-10')
  })
  it('UTC 15:00:00Z = KST 00:00 → 다음 날', () => {
    expect(kstDayKey('2026-11-10T15:00:00Z')).toBe('2026-11-11')
  })
  it('오프셋 표기와 월말/연말 경계', () => {
    expect(kstDayKey('2026-12-31T15:00:00.000Z')).toBe('2027-01-01')
    expect(kstDayKey('2026-03-01T00:00:00+09:00')).toBe('2026-03-01')
    expect(kstDayKey('2028-02-28T15:00:00Z')).toBe('2028-02-29')
  })
  it('해석 불가 시각은 RangeError', () => {
    expect(() => kstDayKey('nope')).toThrow(RangeError)
  })
})

describe('v0 하루치 점수', () => {
  it('0건인 날은 0 — 활동 없으면 변동분 0', () => {
    expect(computeActivityDeltaV0(counts([]), V0)).toBe(0)
    expect(computeDailyScoresV0(counts([]), V0)).toEqual(Array.from({ length: 14 }, () => 0))
  })

  it('한 사람만 보낸 날은 0.5배: 30건 한 사람 = 0.6 × 0.5 × 0.5 = 0.15', () => {
    const s = computeDailyScoresV0(counts([{ date: dayKey(1), senderId: A, count: 30 }]), V0)
    expect(s[0]).toBeCloseTo(0.15, 10)
  })

  it('두 사람 모두면 1배: 15+15건 = 0.6 × 0.5 = 0.3', () => {
    const s = computeDailyScoresV0(
      counts([
        { date: dayKey(1), senderId: A, count: 15 },
        { date: dayKey(1), senderId: B, count: 15 },
      ]),
      V0,
    )
    expect(s[0]).toBeCloseTo(0.3, 10)
  })

  it('60건 넘으면 포화 — 60건과 600건이 같다', () => {
    const mk = (n: number) =>
      computeDailyScoresV0(
        counts([
          { date: dayKey(1), senderId: A, count: n },
          { date: dayKey(1), senderId: B, count: n },
        ]),
        V0,
      )[0]
    expect(mk(30)).toBeCloseTo(0.6, 10)
    expect(mk(300)).toBeCloseTo(0.6, 10)
  })

  it('기록만 있는 날 = 0.4, 분모 14: 하루만 기록 → 0.4/14×55 = 1.6', () => {
    expect(computeActivityDeltaV0(counts([], [dayKey(3)]), V0)).toBe(1.6)
  })

  it('커플 밖 발신자는 무시', () => {
    expect(
      computeActivityDeltaV0(counts([{ date: dayKey(1), senderId: 'stranger', count: 99 }]), V0),
    ).toBe(0)
  })

  it('두 user id가 같으면 RangeError', () => {
    expect(() =>
      computeActivityDeltaV0({ ...counts([]), userIds: [A, A] }, V0),
    ).toThrow(RangeError)
  })
})

describe('v0 창: 어제까지 14일, 오늘 제외', () => {
  const heavy = (date: string): ActivityDailyCount[] => [
    { date, senderId: A, count: 60 },
    { date, senderId: B, count: 60 },
  ]

  it('오늘 메시지/기록은 무시', () => {
    expect(computeActivityDeltaV0(counts(heavy(TODAY), [TODAY]), V0)).toBe(0)
  })

  it('15일 전(2026-10-31) 메시지/기록은 무시', () => {
    expect(computeActivityDeltaV0(counts(heavy('2026-10-31'), ['2026-10-31']), V0)).toBe(0)
  })

  it('어제(11-14)와 14일 전(11-01)은 포함: 각 0.6+0.4=1 → 2/14×55 = 7.9', () => {
    const rows = [...heavy('2026-11-14'), ...heavy('2026-11-01')]
    expect(computeActivityDeltaV0(counts(rows, ['2026-11-14', '2026-11-01']), V0)).toBe(7.9)
  })

  it('메시지 시각 입력도 KST 경계로 나뉜다: 14:59:59Z는 11-14, 15:00:00Z는 오늘(11-15)이라 제외', () => {
    const input: ActivityV0MessagesInput = {
      userIds: [A, B],
      todayKst: TODAY,
      recordDays: [],
      messages: [
        { senderId: A, sentAt: '2026-11-14T14:59:59Z' },
        { senderId: B, sentAt: '2026-11-14T15:00:00Z' },
      ],
    }
    const s = computeDailyScoresV0(input, V0)
    // 11-14에는 A 1건만(한 사람) → 0.6 × (1/60) × 0.5
    expect(s[0]).toBeCloseTo(0.6 * (1 / 60) * 0.5, 10)
  })
})

describe('v0 MASTER 예시: 하루 30건 · 두 사람 다 · 14일 중 4일 데이트 기록', () => {
  const rows: ActivityDailyCount[] = []
  for (let n = 1; n <= 14; n += 1) {
    rows.push({ date: dayKey(n), senderId: A, count: 15 }, { date: dayKey(n), senderId: B, count: 15 })
  }
  const records = [dayKey(2), dayKey(5), dayKey(9), dayKey(12)]

  it('실제 출력 = 22.8 (문서 "≈ +22.9"와 근사; 합 5.8/14×55 = 22.79)', () => {
    expect(computeActivityDeltaV0(counts(rows, records), V0)).toBe(22.8)
  })

  it('최종 온도: 기저 42(1·7 best) + 22.8 = 64.8', () => {
    expect(computeDailyTemperatureV0(1, 7, counts(rows, records), { baseline: BASELINE, activity: V0 })).toBe(
      64.8,
    )
  })
})

describe('v0 하한 · 상한 · 클램프 · 결정론', () => {
  const full: ActivityDailyCount[] = []
  const all: string[] = []
  for (let n = 1; n <= 14; n += 1) {
    full.push({ date: dayKey(n), senderId: A, count: 100 }, { date: dayKey(n), senderId: B, count: 100 })
    all.push(dayKey(n))
  }

  it('상한 55', () => {
    expect(computeActivityDeltaV0(counts(full, all), V0)).toBe(55)
  })

  it('하한 0 (계수 주입으로 음수 점수를 만들어도 min 아래로 안 내려간다)', () => {
    const neg = { ...V0, chatWeight: -5, recordWeight: -5 }
    expect(computeActivityDeltaV0(counts(full, all), neg)).toBe(0)
  })

  it('최종 온도 0~100 클램프: 기저 42 + 55 = 97, 큰 기저면 100', () => {
    const c = { baseline: BASELINE, activity: V0 }
    expect(computeDailyTemperatureV0(1, 7, counts(full, all), c)).toBe(97)
    const hot = { baseline: { contrast: 80, neutral: 80, best: 90 }, activity: V0 }
    expect(computeDailyTemperatureV0(1, 7, counts(full, all), hot)).toBe(100)
  })

  it('계수는 인자: 포화점을 120으로 주면 60건이 반만 찬다', () => {
    const c = { ...V0, chatSaturation: 120 }
    const s = computeDailyScoresV0(
      counts([
        { date: dayKey(1), senderId: A, count: 30 },
        { date: dayKey(1), senderId: B, count: 30 },
      ]),
      c,
    )
    expect(s[0]).toBeCloseTo(0.3, 10)
  })

  it('같은 입력 100회 → 같은 출력, 입력 순서를 섞어도 같은 출력', () => {
    const rows: ActivityDailyCount[] = []
    for (let n = 1; n <= 14; n += 1) {
      rows.push({ date: dayKey(n), senderId: n % 2 ? A : B, count: n * 3 })
    }
    const rec = [dayKey(4), dayKey(8)]
    const base = computeActivityDeltaV0(counts(rows, rec), V0)
    const outs = Array.from({ length: 100 }, () => computeActivityDeltaV0(counts(rows, rec), V0))
    expect(new Set(outs).size).toBe(1)
    const shuffled = [...rows].reverse().sort((x, y) => (x.count % 5) - (y.count % 5))
    expect(computeActivityDeltaV0(counts(shuffled, [...rec].reverse()), V0)).toBe(base)

    const msgs: ActivityV0MessagesInput = {
      userIds: [A, B],
      todayKst: TODAY,
      recordDays: rd(rec),
      messages: rows.flatMap((r) =>
        Array.from({ length: r.count }, () => ({ senderId: r.senderId, sentAt: `${r.date}T03:00:00+09:00` })),
      ),
    }
    expect(computeActivityDeltaV0(msgs, V0)).toBe(base)
    expect(computeActivityDeltaV0({ ...msgs, messages: [...msgs.messages].reverse() }, V0)).toBe(base)
  })
})
