/**
 * 서재·뷰어 읽기(U3, `58-`) - 발행된 호와 그 쪽 이미지를 읽는다. **읽기만 한다.**
 *
 * - 호는 **`issues_public` 뷰만** 읽는다(CLAUDE.md 절대 규칙 3). `issues` 테이블을 직접 읽지 않고,
 *   인쇄용 PDF 경로 칸은 이 앱 어디에서도 이름을 부르지 않는다. 뷰의 칸에도 그 칸은 없다.
 * - 초안은 서재에 나오지 않는다: 뷰는 `security_invoker`라 `issues_select` 정책(`published_at is not null`)이
 *   그대로 걸린다. 앱도 한 번 더 `published_at`이 찬 것만 읽는다(두 겹).
 * - 서명 URL은 필요할 때 받는다(`createSignedUrls`). **URL 값은 로그·저장소·오류 메시지에 남기지 않는다.**
 * - 다음 호 카드의 재료 수는 RLS 범위의 count 조회다(새 RPC 없음, R18-6).
 *
 * 저장소 클라이언트는 인자로 받는다(`Db`) - 앱은 `supabase`를, 원격 실증 스크립트는 사용자 세션 클라이언트를 넘긴다.
 */
import { CORNER_TITLES, type CornerTypeId } from '../types/corners/cornerTitles'
import {
  MAGAZINE_BUCKET,
  MAGAZINE_IMAGE_URL_TTL_SECONDS,
  MAGAZINE_PDF_URL_TTL_SECONDS,
  periodRange,
  type IssueProgressRow,
} from '../utils/magazine'
import type { Db } from './dateRecordApi'

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? '알 수 없는 오류'}`)
}

// ---------------------------------------------------------------------------
// 발행된 호 (issues_public)
// ---------------------------------------------------------------------------

export interface PublishedIssue {
  id: string
  coupleId: string
  issueType: string
  issueNumber: number
  title: string | null
  /** 표지 = 1쪽 이미지의 버킷 안 경로. */
  coverPath: string | null
  periodStart: string
  periodEnd: string
  /** 내려받기용 디지털 PDF의 버킷 안 경로. */
  pdfDigitalPath: string | null
  pageCount: number | null
  publishedAt: string
  theme: string | null
}

/** `issues_public`에서 읽는 칸. 뷰에 있는 칸만, 필요한 것만. */
const ISSUE_COLUMNS =
  'id, couple_id, issue_type, issue_number, title, cover_path, period_start, period_end, pdf_digital_path, page_count, published_at, theme'

interface IssueRowRaw {
  id: string | null
  couple_id: string | null
  issue_type: string | null
  issue_number: number | null
  title: string | null
  cover_path: string | null
  period_start: string | null
  period_end: string | null
  pdf_digital_path: string | null
  page_count: number | null
  published_at: string | null
  theme: string | null
}

/** 뷰의 행(칸이 모두 nullable)을 발행된 호로. 번호·발행 시각·기간이 없으면(= 발행된 호가 아니면) null. */
export function toPublishedIssue(row: IssueRowRaw): PublishedIssue | null {
  if (!row.id || !row.couple_id || !row.published_at || row.issue_number === null) return null
  if (!row.period_start || !row.period_end || !row.issue_type) return null
  return {
    id: row.id,
    coupleId: row.couple_id,
    issueType: row.issue_type,
    issueNumber: row.issue_number,
    title: row.title,
    coverPath: row.cover_path,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    pdfDigitalPath: row.pdf_digital_path,
    pageCount: row.page_count,
    publishedAt: row.published_at,
    theme: row.theme,
  }
}

/** 최신순(발행 시각 내림차순, 같으면 번호 내림차순). */
export function sortNewestFirst(issues: readonly PublishedIssue[]): PublishedIssue[] {
  return [...issues].sort((a, b) => {
    const t = b.publishedAt.localeCompare(a.publishedAt)
    return t !== 0 ? t : b.issueNumber - a.issueNumber
  })
}

/** 발행된 호만, 최신순. */
export async function fetchPublishedIssues(db: Db): Promise<PublishedIssue[]> {
  const { data, error } = await db
    .from('issues_public')
    .select(ISSUE_COLUMNS)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(200)
  if (error) fail('발행된 호 조회 실패', error)
  const issues = ((data ?? []) as IssueRowRaw[]).flatMap((r) => {
    const issue = toPublishedIssue(r)
    return issue ? [issue] : []
  })
  return sortNewestFirst(issues)
}

export async function fetchPublishedIssue(db: Db, issueId: string): Promise<PublishedIssue | null> {
  const { data, error } = await db
    .from('issues_public')
    .select(ISSUE_COLUMNS)
    .eq('id', issueId)
    .not('published_at', 'is', null)
    .maybeSingle()
  if (error) fail('호 조회 실패', error)
  return data ? toPublishedIssue(data as IssueRowRaw) : null
}

// ---------------------------------------------------------------------------
// 속표지 - 실린 코너 (corners, published만 RLS가 허락)
// ---------------------------------------------------------------------------

export interface FrontMatterCorner {
  id: string
  /** 지면 제목(MASTER 17-0-7). 저장된 content의 header.title. */
  pageTitle: string
  /** 코너 이름(앱 화면·목차용). */
  cornerName: string | null
}

interface CornerRowRaw {
  id: string
  corner_type: string
  seq: number | null
  content: unknown
}

function headerOf(content: unknown): { title?: unknown; cornerName?: unknown } {
  if (typeof content !== 'object' || content === null) return {}
  const header = (content as { header?: unknown }).header
  return typeof header === 'object' && header !== null ? (header as { title?: unknown; cornerName?: unknown }) : {}
}

/** 코너 행 -> 속표지 줄. 지면 제목을 못 읽으면 코너 상수를 쓰고, 상수에도 없으면 싣지 않는다(지어내지 않는다). */
export function toFrontMatterCorner(row: CornerRowRaw): FrontMatterCorner | null {
  const header = headerOf(row.content)
  const known = CORNER_TITLES[row.corner_type as CornerTypeId] as (typeof CORNER_TITLES)[CornerTypeId] | undefined
  const title = typeof header.title === 'string' && header.title.length > 0 ? header.title : known?.pageTitle
  if (!title) return null
  const cornerName =
    typeof header.cornerName === 'string' && header.cornerName.length > 0 ? header.cornerName : known?.cornerName ?? null
  return { id: row.id, pageTitle: title, cornerName }
}

/** 그 호의 published 코너, 지면 순서(`seq`, 없으면 뒤로). */
export async function fetchFrontMatterCorners(db: Db, issueId: string): Promise<FrontMatterCorner[]> {
  const { data, error } = await db
    .from('corners')
    .select('id, corner_type, seq, content')
    .eq('issue_id', issueId)
    .eq('status', 'published')
  if (error) fail('코너 조회 실패', error)
  const rows = [...((data ?? []) as CornerRowRaw[])].sort(
    (a, b) => (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER) || a.corner_type.localeCompare(b.corner_type),
  )
  return rows.flatMap((r) => {
    const corner = toFrontMatterCorner(r)
    return corner ? [corner] : []
  })
}

// ---------------------------------------------------------------------------
// 서명 URL (magazine 버킷, 커플 구성원 SELECT)
// ---------------------------------------------------------------------------

/** 경로들의 서명 URL(경로 -> URL). 못 만든 경로는 빠진다. */
export async function signMagazinePaths(
  db: Db,
  paths: readonly string[],
  ttlSeconds: number = MAGAZINE_IMAGE_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  const out: Record<string, string> = {}
  if (unique.length === 0) return out
  const { data, error } = await db.storage.from(MAGAZINE_BUCKET).createSignedUrls(unique, ttlSeconds)
  if (error || !data) return out
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  }
  return out
}

/** 디지털 PDF 한 개의 서명 URL. 못 만들면 null. 인쇄용 경로는 인자로도 받지 않는다. */
export async function signDigitalPdf(db: Db, issue: Pick<PublishedIssue, 'pdfDigitalPath'>): Promise<string | null> {
  if (!issue.pdfDigitalPath) return null
  const signed = await signMagazinePaths(db, [issue.pdfDigitalPath], MAGAZINE_PDF_URL_TTL_SECONDS)
  return signed[issue.pdfDigitalPath] ?? null
}

// ---------------------------------------------------------------------------
// 다음 호 카드 - 초안 진행 + 재료 수
// ---------------------------------------------------------------------------

/** `fn_issue_progress()` - 초안 호의 기간과 코너 상태. 초안·코너 행이 없으면 빈 배열이다. */
export async function fetchIssueProgressRows(db: Db): Promise<IssueProgressRow[]> {
  const { data, error } = await db.rpc('fn_issue_progress')
  if (error) fail('제작 현황 조회 실패', error)
  return (data ?? []) as IssueProgressRow[]
}

export interface MaterialCounts {
  messages: number
  photos: number
  dates: number
}

async function headCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  what: string,
): Promise<number> {
  const { count, error } = await query
  if (error) fail(what, error)
  return count ?? 0
}

/** 기간 안 기록 수(대화·사진·데이트). RLS 범위의 count 조회이고 새 RPC는 없다. */
export async function countMaterials(
  db: Db,
  coupleId: string,
  period: { periodStart: string; periodEnd: string },
): Promise<MaterialCounts> {
  const range = periodRange(period.periodStart, period.periodEnd)
  const [messages, photos, dates] = await Promise.all([
    headCount(
      db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('sent_at', range.startIso)
        .lt('sent_at', range.endExclusiveIso),
      '대화 수 조회 실패',
    ),
    headCount(
      db
        .from('data_entries')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .eq('entry_type', 'photo')
        .is('deleted_at', null)
        .gte('captured_at', range.startIso)
        .lt('captured_at', range.endExclusiveIso),
      '사진 수 조회 실패',
    ),
    headCount(
      db
        .from('dates')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('date_on', range.startDate)
        .lte('date_on', range.endDate),
      '데이트 수 조회 실패',
    ),
  ])
  return { messages, photos, dates }
}
