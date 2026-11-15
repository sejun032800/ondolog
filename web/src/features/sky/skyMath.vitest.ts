/** 77- 우리의 하늘 - 순수 함수 시험: 별 크기 · 자리 · 반짝임 · 달 · 기념일 · 열기 · 끌기. */
import { describe, expect, it } from 'vitest'
import { isTogetherDay, togetherDates } from '@/engine/togetherDay'
import {
  anniversariesUntil, assignStarSizes, hashId, monthRange, monthsBetween, moonOfMonth, NO_PULL, PULL_THRESHOLD_PX, pullState, skyOpenable,
  starPosition, twinkleDelaySeconds, twinklePeriodSeconds, warmestDate, weekdayKo,
} from './skyMath'

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
const mk = (temps: number[]) => temps.map((t, i) => ({ date: day(i + 1), temperature: t }))
const sizesOf = (temps: number[]) => [...assignStarSizes(mk(temps)).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, s]) => s)

describe('별 크기 - 그 달 안 순위 3단계(8 · 5 · 4px)', () => {
  it('한 달에 별 1개면 8px · 2개면 8 · 5 · 3개면 8 · 5 · 4', () => {
    expect(sizesOf([38])).toEqual([8])
    expect(sizesOf([38, 37])).toEqual([8, 5])
    expect(sizesOf([38, 37, 36])).toEqual([8, 5, 4])
  })

  it('온도가 높은 쪽이 크다(순서와 무관)', () => {
    expect(sizesOf([36, 38, 37])).toEqual([4, 8, 5])
  })

  it('31개: 상위 1/3(11개)이 8px · 가운데 10개 5px · 아래 10개 4px - 경계 정확', () => {
    const temps = Array.from({ length: 31 }, (_, i) => 50 - i) // 1일이 가장 따뜻함
    const sizes = sizesOf(temps)
    expect(sizes.filter((s) => s === 8).length).toBe(11)
    expect(sizes.filter((s) => s === 5).length).toBe(10)
    expect(sizes.filter((s) => s === 4).length).toBe(10)
    expect(sizes[10]).toBe(8)
    expect(sizes[11]).toBe(5)
    expect(sizes[20]).toBe(5)
    expect(sizes[21]).toBe(4)
  })

  it('같은 값이면 날짜가 이른 쪽이 위', () => {
    expect(sizesOf([38, 38, 38])).toEqual([8, 5, 4])
    expect(warmestDate(mk([38, 39, 39]))).toBe(day(2))
  })

  it('온도를 하나라도 모르면(읽기 실패 · 아직 못 읽음) 그 달은 모두 가운데 5px', () => {
    const sizes = assignStarSizes([{ date: day(1), temperature: 38 }, { date: day(2), temperature: null }, { date: day(3), temperature: 36 }])
    expect([...sizes.values()]).toEqual([5, 5, 5])
    expect(warmestDate([{ date: day(1), temperature: 38 }, { date: day(2), temperature: null }])).toBeNull()
  })

  it('같은 입력 -> 같은 출력(순수)', () => {
    expect([...assignStarSizes(mk([1, 2, 3, 4, 5]))]).toEqual([...assignStarSizes(mk([1, 2, 3, 4, 5]))])
  })
})

describe('별 자리 · 반짝임 - 기록 id 결정론', () => {
  it('같은 id -> 같은 자리 · 같은 주기 · 같은 지연', () => {
    for (const id of ['a', 'record-1', '0f9c-1234']) {
      expect(starPosition(id)).toEqual(starPosition(id))
      expect(twinklePeriodSeconds(id)).toBe(twinklePeriodSeconds(id))
      expect(twinkleDelaySeconds(id)).toBe(twinkleDelaySeconds(id))
      expect(hashId(id)).toBe(hashId(id))
    }
  })

  it('다른 id는 (대체로) 다른 자리 · 자리는 머리 · 지평선을 피한 범위 안', () => {
    expect(starPosition('a')).not.toEqual(starPosition('b'))
    for (let i = 0; i < 400; i += 1) {
      const p = starPosition(`id-${i}`)
      expect(p.x).toBeGreaterThanOrEqual(8)
      expect(p.x).toBeLessThanOrEqual(92)
      expect(p.y).toBeGreaterThanOrEqual(18)
      expect(p.y).toBeLessThanOrEqual(74)
    }
  })

  it('반짝임 주기는 2.8~5.2초 안', () => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 1000; i += 1) {
      const t = twinklePeriodSeconds(`id-${i}`)
      min = Math.min(min, t)
      max = Math.max(max, t)
    }
    expect(min).toBeGreaterThanOrEqual(2.8)
    expect(max).toBeLessThanOrEqual(5.2)
    expect(max - min).toBeGreaterThan(2) // 별마다 다르다
  })
})

describe('달', () => {
  const published = [{ periodStart: '2026-08-01', issueNumber: 1 }, { periodStart: '2026-09-01', issueNumber: 2 }]
  it('발행 = published(호 번호) · 진행 중 초안 = draft · 없음 = null', () => {
    expect(moonOfMonth('2026-09', published, '2026-10-01')).toEqual({ kind: 'published', volume: 2 })
    expect(moonOfMonth('2026-10', published, '2026-10-01')).toEqual({ kind: 'draft' })
    expect(moonOfMonth('2026-07', published, '2026-10-01')).toBeNull()
    expect(moonOfMonth('2026-10', published, null)).toBeNull()
  })
  it('발행된 호가 있는 달에는 초안이 있어도 발행 달', () => {
    expect(moonOfMonth('2026-09', published, '2026-09-01')).toEqual({ kind: 'published', volume: 2 })
  })
})

describe('달력 · 요일', () => {
  it('monthsBetween · monthRange(연도 경계 · 윤년 2월)', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
  it('weekdayKo', () => {
    expect(weekdayKo('2026-10-18')).toBe('일요일')
    expect(weekdayKo('2026-10-03')).toBe('토요일')
  })
})

describe('기념일 - 메인 마일스톤과 같은 규칙(시작일 = 1일차)', () => {
  it('D+100 · D+200 · 1주년(D+365)과 날짜', () => {
    const a = anniversariesUntil('2026-01-01', '2027-01-05')
    expect(a.map((x) => x.days)).toEqual([100, 200, 300, 365])
    expect(a[0]).toEqual({ days: 100, date: '2026-04-10', label: '100일' })
    expect(a[1].label).toBe('200일')
    expect(a[3]).toEqual({ days: 365, date: '2026-12-31', label: '1주년' })
  })
  it('아직 100일 전이면 없음', () => {
    expect(anniversariesUntil('2026-10-01', '2026-10-20')).toEqual([])
  })
})

describe('그날 별 있음 / 없음 판정은 엔진(함께한 하루)', () => {
  it('장소만 있는 날도 별 · 지운 것만 있는 날(수 0)은 별 없음', () => {
    expect(isTogetherDay({ stops: 1, photos: 0, memos: 0 })).toBe(true)
    expect(isTogetherDay({ stops: 0, photos: 0, memos: 0 })).toBe(false)
    expect(togetherDates([
      { date: '2026-10-01', stops: 1, photos: 0, memos: 0 },
      { date: '2026-10-02', stops: 0, photos: 0, memos: 0 },
    ])).toEqual(['2026-10-01'])
  })
})

describe('하늘 열기 - 연결 전엔 열지 않고 해제 유예 중엔 연다', () => {
  it('연결 = 열림 · 연결 전(혼자) = 닫힘 · 해제 유예 = 열림 · 확인 전 = 닫힘', () => {
    expect(skyOpenable('connected', false)).toBe(true)
    expect(skyOpenable('disconnected', false)).toBe(false)
    expect(skyOpenable('disconnected', true)).toBe(true)
    expect(skyOpenable('unknown', false)).toBe(false)
    expect(skyOpenable('loading', false)).toBe(false)
  })
})

describe('B02 끌기 판정', () => {
  const base = { startScrollTop: 0, scrollTop: 0, dy: 120, scrolledDuring: false, wasScrolling: false }
  it('맨 위에서 문턱 이상 끌면 armed', () => {
    const s = pullState(base)
    expect(s.active).toBe(true)
    expect(s.armed).toBe(true)
    expect(s.offset).toBeGreaterThan(0)
  })
  it('문턱 미달이면 active지만 armed 아님(놓으면 제자리)', () => {
    const s = pullState({ ...base, dy: PULL_THRESHOLD_PX - 10 })
    expect(s.active).toBe(true)
    expect(s.armed).toBe(false)
  })
  it('맨 위가 아니면 · 스크롤 중이면 · 위로 끌면 끌어내리기가 아니다', () => {
    expect(pullState({ ...base, startScrollTop: 30 })).toEqual(NO_PULL)
    expect(pullState({ ...base, scrollTop: 5 })).toEqual(NO_PULL)
    expect(pullState({ ...base, scrolledDuring: true })).toEqual(NO_PULL)
    expect(pullState({ ...base, wasScrolling: true })).toEqual(NO_PULL)
    expect(pullState({ ...base, dy: -40 })).toEqual(NO_PULL)
    expect(pullState({ ...base, dy: 4 })).toEqual(NO_PULL)
  })
})
