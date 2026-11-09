/**
 * 시험 보조(시험 파일이 아니다): 서재 · 뷰어 시험용 가짜 Supabase 클라이언트.
 * `issues_public` · `corners` · `profiles` 행과 `fn_issue_progress` 응답, 기간 안 count 셋(`messages` · `data_entries` · `dates`), Storage 서명(`createSignedUrls`)을 메모리로 흉내 낸다.
 * 어느 표 · 버킷 · 칸을 읽었는지 기록한다(절대 규칙 3: `issues` 직접 0, 인쇄용 버킷 0). 실제 주소 · 키는 어디에도 없다.
 */
import type { PublishedIssue } from '@/services/magazineApi'
import { setSupabaseForTest, type WebSupabase } from '../../auth/client'

export type Row = Record<string, unknown>

export interface MagazineDbOptions {
  /** `issues_public` 행(snake_case). 순서는 일부러 섞어 두면 앱의 정렬을 확인할 수 있다. */
  issues?: Row[]
  corners?: Row[]
  profiles?: Row[]
  /** `fn_issue_progress` 응답. */
  progress?: Row[]
  counts?: { messages?: number; data_entries?: number; dates?: number }
}

export interface MagazineDbState {
  /** `issues_public` 읽기를 이 Promise가 풀릴 때까지 붙든다(로딩 상태를 관찰하려고). */
  gate: Promise<void> | null
  /** true면 `issues_public` 읽기가 던진다. */
  failIssues: boolean
  /** 서명이 빈 결과를 준다(못 만든 경로). */
  signEmpty: boolean
}

export interface SignCall { bucket: string; paths: string[]; ttl: number | undefined }

export function issueRow(over: Row = {}): Row {
  return {
    id: 'i1', couple_id: 'c1', issue_type: 'monthly', issue_number: 1, title: null, cover_path: 'c1/i1/render/page-01.jpg',
    period_start: '2026-09-01', period_end: '2026-09-30', pdf_digital_path: 'c1/i1/render/issue.pdf', page_count: 19,
    published_at: '2026-10-01T00:00:00Z', theme: 'basic', ...over,
  }
}

export function publishedIssue(over: Partial<PublishedIssue> = {}): PublishedIssue {
  return {
    id: 'i1', coupleId: 'c1', issueType: 'monthly', issueNumber: 1, title: null, coverPath: 'c1/i1/render/page-01.jpg',
    periodStart: '2026-09-01', periodEnd: '2026-09-30', pdfDigitalPath: 'c1/i1/render/issue.pdf', pageCount: 19,
    publishedAt: '2026-10-01T00:00:00Z', theme: 'basic', ...over,
  }
}

export function makeMagazineDb(opts: MagazineDbOptions = {}) {
  const tables: Record<string, Row[]> = {
    issues_public: opts.issues ?? [],
    corners: opts.corners ?? [],
    profiles: opts.profiles ?? [],
  }
  const counts = { messages: 0, data_entries: 0, dates: 0, ...opts.counts }
  const state: MagazineDbState = { gate: null, failIssues: false, signEmpty: false }
  const reads: { table: string; columns: string; filters: string[] }[] = []
  const rpcs: string[] = []
  const signs: SignCall[] = []

  const from = (table: string) => {
    const record = { table, columns: '', filters: [] as string[] }
    let head = false
    let rows = (tables[table] ?? []).slice()
    const b: Record<string, unknown> = {}
    b.select = (columns: string, o?: { head?: boolean }) => {
      record.columns = columns
      head = !!o?.head
      return b
    }
    const note = (label: string) => (col: string) => { record.filters.push(`${label}:${col}`); return b }
    b.eq = (col: string, value: unknown) => { record.filters.push(`eq:${col}`); rows = rows.filter((r) => r[col] === value); return b }
    b.is = (col: string) => { record.filters.push(`is:${col}`); return b }
    b.not = (col: string, _op: string, value: unknown) => { record.filters.push(`not:${col}`); rows = rows.filter((r) => r[col] !== value); return b }
    b.in = (col: string, values: unknown[]) => { record.filters.push(`in:${col}`); rows = rows.filter((r) => values.includes(r[col])); return b }
    b.gte = note('gte')
    b.lt = note('lt')
    b.lte = note('lte')
    b.order = () => b
    b.limit = () => b
    const run = async () => {
      reads.push(record)
      if (table === 'issues_public') {
        if (state.gate) await state.gate
        if (state.failIssues) throw new Error('network')
      }
      if (head) return { data: null, count: (counts as Record<string, number>)[table] ?? 0, error: null }
      return { data: rows, error: null }
    }
    b.maybeSingle = async () => {
      const r = await run()
      const data = (r as { data: Row[] | null }).data
      return { data: data && data.length > 0 ? data[0] : null, error: null }
    }
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => run().then(ok, bad)
    return b
  }

  const storage = {
    from: (bucket: string) => ({
      createSignedUrls: async (paths: string[], ttl?: number) => {
        signs.push({ bucket, paths: [...paths], ttl })
        if (state.signEmpty) return { data: [], error: null }
        return { data: paths.map((path) => ({ path, signedUrl: `https://signed.invalid/${bucket}/${path}` })), error: null }
      },
    }),
  }
  const rpc = async (name: string) => {
    rpcs.push(name)
    return { data: opts.progress ?? [], error: null }
  }

  const client = { from, storage, rpc, auth: {} } as unknown as WebSupabase
  return { client, state, reads, rpcs, signs }
}

export function installMagazineDb(opts: MagazineDbOptions = {}) {
  const db = makeMagazineDb(opts)
  setSupabaseForTest(db.client)
  return db
}
