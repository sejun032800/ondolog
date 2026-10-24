/**
 * U3 서재·뷰어 읽기(`58-`) 시험 - 가짜 저장소로 어떤 테이블·칸을 읽는지, 초안·인쇄 경로가 어디에도 없는지 확인한다.
 */
import {
  countMaterials,
  fetchFrontMatterCorners,
  fetchIssueProgressRows,
  fetchPublishedIssue,
  fetchPublishedIssues,
  signDigitalPdf,
  signMagazinePaths,
  sortNewestFirst,
  toFrontMatterCorner,
  toPublishedIssue,
  type PublishedIssue,
} from '../../src/services/magazineApi'
import { loadIssueManifest, tocAvailable } from '../../src/services/issueManifest'
import type { Db } from '../../src/services/dateRecordApi'

interface Call {
  table: string
  select?: string
  filters: [string, ...unknown[]][]
  options?: unknown
}

/** supabase-js 빌더 흉내: 체인 호출을 기록하고, await하면 정해 둔 결과를 돌려준다. */
function fakeDb(results: Record<string, { data?: unknown; count?: number | null; error?: { message: string } | null }>) {
  const calls: Call[] = []
  const storageCalls: { bucket: string; paths: string[]; ttl: number }[] = []
  const rpcCalls: string[] = []
  const db = {
    from(table: string) {
      const call: Call = { table, filters: [] }
      calls.push(call)
      const result = () => ({ data: null, count: null, error: null, ...(results[table] ?? {}) })
      const builder: Record<string, unknown> = {}
      for (const name of ['not', 'eq', 'is', 'gte', 'lt', 'lte', 'order', 'limit']) {
        builder[name] = (...args: unknown[]) => {
          call.filters.push([name, ...args])
          return builder
        }
      }
      builder.select = (columns: string, options?: unknown) => {
        call.select = columns
        call.options = options
        return builder
      }
      builder.maybeSingle = () => Promise.resolve(result())
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject)
      return builder
    },
    storage: {
      from(bucket: string) {
        return {
          createSignedUrls: (paths: string[], ttl: number) => {
            storageCalls.push({ bucket, paths, ttl })
            return Promise.resolve({
              data: paths.map((p) => ({ path: p, signedUrl: `https://signed.invalid/${p}`, error: null })),
              error: null,
            })
          },
        }
      },
    },
    rpc(name: string) {
      rpcCalls.push(name)
      return Promise.resolve({ data: results.__rpc?.data ?? [], error: results.__rpc?.error ?? null })
    },
  }
  return { db: db as unknown as Db, calls, storageCalls, rpcCalls }
}

const publishedRow = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  couple_id: 'c1',
  issue_type: 'monthly',
  issue_number: 1,
  title: null,
  cover_path: 'c1/i1/render/page-01.jpg',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  pdf_digital_path: 'c1/i1/render/issue.pdf',
  page_count: 19,
  published_at: '2026-10-01T00:00:00Z',
  theme: 'basic',
  ...over,
})

describe('서재 조회 - issues_public만', () => {
  it('issues_public를 읽고, issues 테이블은 읽지 않으며, published_at이 찬 것만 건다', async () => {
    const { db, calls } = fakeDb({ issues_public: { data: [publishedRow()] } })
    const issues = await fetchPublishedIssues(db)
    expect(issues).toHaveLength(1)
    expect(calls.map((c) => c.table)).toEqual(['issues_public'])
    expect(calls[0].filters).toContainEqual(['not', 'published_at', 'is', null])
  })

  it('읽는 칸에 인쇄용 경로가 없다', async () => {
    const { db, calls } = fakeDb({ issues_public: { data: [] } })
    await fetchPublishedIssues(db)
    expect(calls[0].select).not.toMatch(/print/i)
    expect(calls[0].select).toContain('pdf_digital_path')
    expect(calls[0].select).not.toContain('*')
  })

  it('번호나 발행 시각이 없는 행(= 발행된 호가 아닌 것)은 서재에 싣지 않는다', async () => {
    const { db } = fakeDb({
      issues_public: {
        data: [publishedRow({ id: 'draft', issue_number: null, published_at: null }), publishedRow({ id: 'ok' })],
      },
    })
    expect((await fetchPublishedIssues(db)).map((i) => i.id)).toEqual(['ok'])
  })

  it('최신순: 발행 시각 내림차순, 같으면 번호 내림차순', () => {
    const mk = (id: string, publishedAt: string, n: number) => toPublishedIssue(publishedRow({ id, published_at: publishedAt, issue_number: n })) as PublishedIssue
    const sorted = sortNewestFirst([mk('a', '2026-09-01T00:00:00Z', 1), mk('c', '2026-10-01T00:00:00Z', 2), mk('b', '2026-10-01T00:00:00Z', 3)])
    expect(sorted.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('오류는 던진다(서명 URL이 아니라 메시지만)', async () => {
    const { db } = fakeDb({ issues_public: { error: { message: 'boom' } } })
    await expect(fetchPublishedIssues(db)).rejects.toThrow('발행된 호 조회 실패: boom')
  })

  it('호 하나도 issues_public + 발행됨 조건', async () => {
    const { db, calls } = fakeDb({ issues_public: { data: publishedRow() } })
    const issue = await fetchPublishedIssue(db, 'i1')
    expect(issue?.pageCount).toBe(19)
    expect(calls[0].table).toBe('issues_public')
    expect(calls[0].filters).toContainEqual(['not', 'published_at', 'is', null])
  })
})

describe('속표지 코너', () => {
  it('published 코너만 묻고, 지면 제목은 저장된 header.title을 쓴다', async () => {
    const { db, calls } = fakeDb({
      corners: {
        data: [
          { id: 'k2', corner_type: 'sweet_words', seq: 2, content: { header: { title: '다정한 말들', cornerName: '다정한 말들' } } },
          { id: 'k1', corner_type: 'date_archive', seq: 1, content: { header: { title: '함께한 하루', cornerName: '데이트 아카이브' } } },
        ],
      },
    })
    const corners = await fetchFrontMatterCorners(db, 'i1')
    expect(calls[0].filters).toContainEqual(['eq', 'status', 'published'])
    expect(corners.map((c) => c.pageTitle)).toEqual(['함께한 하루', '다정한 말들'])
    expect(corners[0].cornerName).toBe('데이트 아카이브')
  })

  it('header가 없으면 코너 상수의 지면 제목, 상수에도 없으면 싣지 않는다', () => {
    expect(toFrontMatterCorner({ id: 'x', corner_type: 'date_archive', seq: 1, content: {} })?.pageTitle).toBe('함께한 하루')
    expect(toFrontMatterCorner({ id: 'x', corner_type: 'unknown_corner', seq: 1, content: null })).toBeNull()
  })
})

describe('서명 URL', () => {
  it('magazine 버킷에서 필요한 경로만, 같은 경로는 한 번', async () => {
    const { db, storageCalls } = fakeDb({})
    const signed = await signMagazinePaths(db, ['a', 'a', 'b'])
    expect(storageCalls).toHaveLength(1)
    expect(storageCalls[0].bucket).toBe('magazine')
    expect(storageCalls[0].paths).toEqual(['a', 'b'])
    expect(Object.keys(signed)).toEqual(['a', 'b'])
  })

  it('경로가 없으면 저장소를 부르지 않는다', async () => {
    const { db, storageCalls } = fakeDb({})
    expect(await signMagazinePaths(db, [])).toEqual({})
    expect(storageCalls).toHaveLength(0)
  })

  it('PDF는 디지털 경로 하나만 서명한다. 경로가 없으면 null', async () => {
    const { db, storageCalls } = fakeDb({})
    const url = await signDigitalPdf(db, { pdfDigitalPath: 'c1/i1/render/issue.pdf' })
    expect(url).toContain('c1/i1/render/issue.pdf')
    expect(storageCalls[0].paths).toEqual(['c1/i1/render/issue.pdf'])
    expect(await signDigitalPdf(db, { pdfDigitalPath: null })).toBeNull()
  })
})

describe('다음 호 카드 데이터', () => {
  it('fn_issue_progress를 부르고, 없으면 빈 배열', async () => {
    const { db, rpcCalls } = fakeDb({})
    expect(await fetchIssueProgressRows(db)).toEqual([])
    expect(rpcCalls).toEqual(['fn_issue_progress'])
  })

  it('재료 수는 기간 안 count 조회 셋(새 RPC 없음), 삭제된 행은 세지 않는다', async () => {
    const { db, calls, rpcCalls } = fakeDb({ messages: { count: 412 }, data_entries: { count: 18 }, dates: { count: 3 } })
    const counts = await countMaterials(db, 'c1', { periodStart: '2026-10-01', periodEnd: '2026-10-31' })
    expect(counts).toEqual({ messages: 412, photos: 18, dates: 3 })
    expect(rpcCalls).toEqual([])
    expect(calls.map((c) => c.table).sort()).toEqual(['data_entries', 'dates', 'messages'])
    for (const c of calls) {
      expect(c.options).toEqual({ count: 'exact', head: true })
      expect(c.filters).toContainEqual(['is', 'deleted_at', null])
      expect(c.filters).toContainEqual(['eq', 'couple_id', 'c1'])
    }
    const messages = calls.find((c) => c.table === 'messages')
    expect(messages?.filters).toContainEqual(['gte', 'sent_at', '2026-09-30T15:00:00.000Z'])
    expect(messages?.filters).toContainEqual(['lt', 'sent_at', '2026-10-31T15:00:00.000Z'])
    const entries = calls.find((c) => c.table === 'data_entries')
    expect(entries?.filters).toContainEqual(['eq', 'entry_type', 'photo'])
    const dates = calls.find((c) => c.table === 'dates')
    expect(dates?.filters).toContainEqual(['gte', 'date_on', '2026-10-01'])
    expect(dates?.filters).toContainEqual(['lte', 'date_on', '2026-10-31'])
  })

  it('count가 null이면 0', async () => {
    const { db } = fakeDb({})
    expect(await countMaterials(db, 'c1', { periodStart: '2026-10-01', periodEnd: '2026-10-31' })).toEqual({
      messages: 0,
      photos: 0,
      dates: 0,
    })
  })
})

describe('목차 매니페스트 자리 (D12 숨김)', () => {
  it('지금은 매니페스트가 없다 - null이고 목차는 쓸 수 없다', async () => {
    expect(await loadIssueManifest({ id: 'i1', coupleId: 'c1' })).toBeNull()
    expect(tocAvailable(null)).toBe(false)
    expect(tocAvailable({ entries: [] })).toBe(false)
    expect(tocAvailable({ entries: [{ title: '발행 노트', page: 2 }] })).toBe(true)
  })
})
