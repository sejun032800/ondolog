/**
 * U3 서재·뷰어(`58-`) 순수 규칙 시험 - 호 이름 · 쪽 이미지 경로 · 기간 경과율 · 서재 분기 · 서명 URL 캐시 · 줌 계산.
 */
import {
  MAGAZINE_IMAGE_URL_TTL_SECONDS,
  URL_REFRESH_MARGIN_MS,
  ZOOM_DOUBLE_TAP,
  ZOOM_MAX,
  addDays,
  clampScale,
  clampTranslate,
  createSignedUrlCache,
  isZoomed,
  issueMonthLabel,
  kstToday,
  libraryMode,
  nextDoubleTapScale,
  pageCounterLabel,
  pageImagePath,
  pageImagePaths,
  pagesNear,
  periodElapsedPercent,
  periodRange,
  pickDraftIssue,
  type IssueProgressRow,
} from '../../src/utils/magazine'

describe('호 이름', () => {
  it('월간은 기간 시작일의 달 "N월호"', () => {
    expect(issueMonthLabel({ periodStart: '2026-09-01', issueType: 'monthly', title: null })).toBe('9월호')
    expect(issueMonthLabel({ periodStart: '2026-10-01', issueType: 'monthly', title: 'ignored' })).toBe('10월호')
  })

  it('월간이 아니거나 날짜를 못 읽으면 title, 그것도 없으면 빈 문자열(지어내지 않는다)', () => {
    expect(issueMonthLabel({ periodStart: '2026-09-01', issueType: 'weekly', title: '9월 첫째 주' })).toBe('9월 첫째 주')
    expect(issueMonthLabel({ periodStart: null, issueType: 'monthly', title: null })).toBe('')
    expect(issueMonthLabel({ periodStart: 'x', issueType: 'monthly', title: null })).toBe('')
  })
})

describe('쪽 이미지 경로 (55-1 규칙)', () => {
  it('`{couple}/{issue}/render/page-NN.jpg`, 두 자리로 0을 채운다', () => {
    expect(pageImagePath('c1', 'i1', 1)).toBe('c1/i1/render/page-01.jpg')
    expect(pageImagePath('c1', 'i1', 19)).toBe('c1/i1/render/page-19.jpg')
    expect(pageImagePath('c1', 'i1', 100)).toBe('c1/i1/render/page-100.jpg')
  })

  it('page_count만큼 1쪽부터 만든다. 쪽 수가 없거나 0이면 빈 배열', () => {
    expect(pageImagePaths('c', 'i', 3)).toEqual(['c/i/render/page-01.jpg', 'c/i/render/page-02.jpg', 'c/i/render/page-03.jpg'])
    expect(pageImagePaths('c', 'i', 0)).toEqual([])
    expect(pageImagePaths('c', 'i', null)).toEqual([])
  })

  it('1 미만·정수 아님은 던진다', () => {
    expect(() => pageImagePath('c', 'i', 0)).toThrow()
    expect(() => pageImagePath('c', 'i', 1.5)).toThrow()
  })

  it('경로 어디에도 인쇄용을 가리키는 조각이 없다', () => {
    expect(pageImagePaths('c', 'i', 5).join(' ')).not.toMatch(/print/i)
  })

  it('지금 쪽 가까이(앞뒤 1쪽)만 고른다 - 범위를 벗어나지 않는다', () => {
    expect(pagesNear(1, 19)).toEqual([1, 2])
    expect(pagesNear(8, 19)).toEqual([7, 8, 9])
    expect(pagesNear(19, 19)).toEqual([18, 19])
    expect(pagesNear(1, 1)).toEqual([1])
  })

  it('"8 / 19"', () => {
    expect(pageCounterLabel(8, 19)).toBe('8 / 19')
  })
})

describe('기간 경과율 (R18-6)', () => {
  // 10월: 2026-10-01 ~ 2026-10-31 (포함 끝)
  const s = '2026-10-01'
  const e = '2026-10-31'

  it('시작 전·시작일은 0', () => {
    expect(periodElapsedPercent(s, e, '2026-09-30')).toBe(0)
    expect(periodElapsedPercent(s, e, '2026-10-01')).toBe(0)
  })

  it('지난 날 수 / 기간의 날 수를 내림한 정수', () => {
    expect(periodElapsedPercent(s, e, '2026-10-02')).toBe(3) // 1/31
    expect(periodElapsedPercent(s, e, '2026-10-16')).toBe(48) // 15/31
    expect(periodElapsedPercent(s, e, '2026-10-24')).toBe(74) // 23/31
  })

  it('끝 날짜까지는 100 미만, 기간이 끝나면(다음 날부터) 100', () => {
    expect(periodElapsedPercent(s, e, '2026-10-31')).toBe(96) // 30/31
    expect(periodElapsedPercent(s, e, '2026-11-01')).toBe(100)
    expect(periodElapsedPercent(s, e, '2027-01-01')).toBe(100)
  })

  it('하루짜리 기간도 안전하다', () => {
    expect(periodElapsedPercent('2026-10-05', '2026-10-05', '2026-10-05')).toBe(0)
    expect(periodElapsedPercent('2026-10-05', '2026-10-05', '2026-10-06')).toBe(100)
  })

  it('결정론: 같은 입력은 같은 출력이고 0~100 정수만 나온다', () => {
    for (let d = 0; d < 60; d += 1) {
      const today = addDays('2026-09-20', d)
      const a = periodElapsedPercent(s, e, today)
      expect(periodElapsedPercent(s, e, today)).toBe(a)
      expect(Number.isInteger(a)).toBe(true)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(100)
    }
  })

  it('KST 오늘: UTC 15:00 이후는 다음 날', () => {
    expect(kstToday(new Date('2026-10-23T14:59:59Z'))).toBe('2026-10-23')
    expect(kstToday(new Date('2026-10-23T15:00:00Z'))).toBe('2026-10-24')
  })

  it('기간 범위: 날짜는 포함, 시각은 [시작 KST 0시, 끝 다음 날 KST 0시)', () => {
    const r = periodRange('2026-10-01', '2026-10-31')
    expect(r.startDate).toBe('2026-10-01')
    expect(r.endDate).toBe('2026-10-31')
    expect(r.startIso).toBe('2026-09-30T15:00:00.000Z')
    expect(r.endExclusiveIso).toBe('2026-10-31T15:00:00.000Z')
  })
})

describe('다음 호(초안) 고르기', () => {
  const row = (issue_id: string, period_start: string, issue_type = 'monthly', corner_type = 'date_archive'): IssueProgressRow => ({
    issue_id,
    issue_type,
    period_start,
    period_end: '2026-10-31',
    corner_type,
    status: 'pending',
    skip_reason: null,
  })

  it('빈 결과(초안·코너 행 없음)면 null', () => {
    expect(pickDraftIssue([])).toBeNull()
  })

  it('코너 행이 여럿이어도 호는 하나', () => {
    const draft = pickDraftIssue([row('a', '2026-10-01'), row('a', '2026-10-01', 'monthly', 'sweet_words')])
    expect(draft).toEqual({ issueId: 'a', issueType: 'monthly', periodStart: '2026-10-01', periodEnd: '2026-10-31' })
  })

  it('월간을 먼저, 같은 종류에서는 기간 시작이 늦은 쪽', () => {
    expect(pickDraftIssue([row('w', '2026-10-20', 'weekly'), row('m', '2026-10-01')])?.issueId).toBe('m')
    expect(pickDraftIssue([row('old', '2026-09-01'), row('new', '2026-10-01')])?.issueId).toBe('new')
  })
})

describe('서재 분기', () => {
  const base = { loading: false, error: false, publishedCount: 0 }

  it('연결 여부가 정해지기 전에는 아무것도 확정하지 않는다', () => {
    expect(libraryMode({ ...base, connection: 'unknown' })).toBe('pending')
    expect(libraryMode({ ...base, connection: 'loading' })).toBe('pending')
  })

  it('미연결이면 D16', () => {
    expect(libraryMode({ ...base, connection: 'disconnected', publishedCount: 3 })).toBe('unconnected')
  })

  it('연결 + 발행된 호 0권이면 D14, 1권 이상이면 서재', () => {
    expect(libraryMode({ ...base, connection: 'connected', publishedCount: 0 })).toBe('first')
    expect(libraryMode({ ...base, connection: 'connected', publishedCount: 2 })).toBe('shelf')
  })

  it('로딩·오류는 호 수보다 앞선다', () => {
    expect(libraryMode({ ...base, connection: 'connected', loading: true })).toBe('loading')
    expect(libraryMode({ ...base, connection: 'connected', error: true })).toBe('error')
  })
})

describe('서명 URL 캐시', () => {
  function make(now: { t: number }) {
    const calls: string[][] = []
    let n = 0
    const cache = createSignedUrlCache({
      sign: async (paths) => {
        calls.push([...paths])
        n += 1
        return Object.fromEntries(paths.map((p) => [p, `signed-${n}/${p}`]))
      },
      ttlSeconds: MAGAZINE_IMAGE_URL_TTL_SECONDS,
      now: () => now.t,
    })
    return { cache, calls }
  }

  it('필요한 경로만 받고, 신선하면 다시 받지 않는다', async () => {
    const now = { t: 1_000_000 }
    const { cache, calls } = make(now)
    const first = await cache.ensure(['a', 'b'])
    expect(Object.keys(first)).toEqual(['a', 'b'])
    await cache.ensure(['a', 'b', 'c'])
    expect(calls).toEqual([['a', 'b'], ['c']])
  })

  it('만료(여유 포함)되면 다시 받는다', async () => {
    const now = { t: 0 }
    const { cache, calls } = make(now)
    const first = await cache.ensure(['a'])
    now.t = MAGAZINE_IMAGE_URL_TTL_SECONDS * 1000 - URL_REFRESH_MARGIN_MS - 1
    expect(cache.peek('a')).toBe(first.a)
    now.t = MAGAZINE_IMAGE_URL_TTL_SECONDS * 1000 - URL_REFRESH_MARGIN_MS + 1
    expect(cache.peek('a')).toBeUndefined()
    const second = await cache.ensure(['a'])
    expect(calls).toHaveLength(2)
    expect(second.a).not.toBe(first.a)
  })

  it('같은 경로를 동시에 두 번 받지 않는다', async () => {
    const now = { t: 0 }
    const { cache, calls } = make(now)
    await Promise.all([cache.ensure(['a']), cache.ensure(['a']), cache.ensure(['a', 'b'])])
    expect(calls.flat().filter((p) => p === 'a')).toHaveLength(1)
  })

  it('invalidate한 경로는 다시 받는다 (이미지 실패 뒤 한 번 다시)', async () => {
    const now = { t: 0 }
    const { cache, calls } = make(now)
    await cache.ensure(['a'])
    cache.invalidate('a')
    expect(cache.peek('a')).toBeUndefined()
    await cache.ensure(['a'])
    expect(calls).toEqual([['a'], ['a']])
  })

  it('못 만든 경로는 결과에서 빠진다', async () => {
    const cache = createSignedUrlCache({ sign: async () => ({}), ttlSeconds: 60 })
    expect(await cache.ensure(['a'])).toEqual({})
  })
})

describe('핀치 줌 계산', () => {
  it('배율은 1~4 안에 묶인다', () => {
    expect(clampScale(0.3)).toBe(1)
    expect(clampScale(2.2)).toBe(2.2)
    expect(clampScale(9)).toBe(ZOOM_MAX)
  })

  it('이동은 확대한 이미지가 빈 면을 드러내지 않는 범위', () => {
    expect(clampTranslate(500, 1, 300)).toBe(0) // 확대 전에는 움직이지 않는다
    expect(clampTranslate(500, 2, 300)).toBe(150)
    expect(clampTranslate(-500, 2, 300)).toBe(-150)
    expect(clampTranslate(40, 2, 300)).toBe(40)
  })

  it('두 번 탭: 확대돼 있으면 1로 복귀, 아니면 확대 배율', () => {
    expect(nextDoubleTapScale(1)).toBe(ZOOM_DOUBLE_TAP)
    expect(nextDoubleTapScale(2)).toBe(1)
    expect(nextDoubleTapScale(1.005)).toBe(ZOOM_DOUBLE_TAP)
  })

  it('확대 판정', () => {
    expect(isZoomed(1)).toBe(false)
    expect(isZoomed(1.005)).toBe(false)
    expect(isZoomed(1.5)).toBe(true)
  })
})
