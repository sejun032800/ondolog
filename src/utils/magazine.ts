/**
 * 서재·뷰어(U3, `58-`)의 순수 규칙 - 저장소·화면과 무관한 계산만 둔다.
 *
 * - 호 이름 "N월호"는 기간 시작일의 달에서 만든다(`period_start`는 `date` 문자열이라 시간대 문제가 없다).
 * - 쪽 이미지 경로는 `55-1`이 정한 규칙(`{couple_id}/{issue_id}/render/page-NN.jpg`)과 `page_count`로 만든다.
 *   **인쇄용 PDF 경로를 아는 코드는 이 앱에 없다**(CLAUDE.md 절대 규칙 3) - 이 파일에도 없다.
 * - 진행률은 기간 경과율이다(R18-6): KST 오늘 기준, 0~100 정수, 기간이 끝나면 100. 상태 기반 %가 아니다.
 * - 서명 URL 캐시는 만료되면 다시 받는다. URL 값은 어디에도 기록하지 않는다.
 */

export const MAGAZINE_BUCKET = 'magazine'
/** 쪽 이미지·표지 서명 URL 유효 시간(초). 읽는 동안 만료되면 다시 받는다. */
export const MAGAZINE_IMAGE_URL_TTL_SECONDS = 60 * 60
/** PDF 서명 URL 유효 시간(초). 시스템에 넘기는 즉시 쓰이므로 짧다. */
export const MAGAZINE_PDF_URL_TTL_SECONDS = 60 * 10
/** 만료 직전에 미리 새로 받는 여유(ms). */
export const URL_REFRESH_MARGIN_MS = 60 * 1000

// ---------------------------------------------------------------------------
// 호 이름
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD`에서 달(1~12). 형식이 아니면 null. */
export function monthOfDate(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? month : null
}

/**
 * "9월호". 기간 시작일의 달을 쓴다. 월간이 아니거나 날짜를 못 읽으면 `title`을 쓰고, 그것도 없으면 빈 문자열이다
 * (지어내지 않는다).
 */
export function issueMonthLabel(input: { periodStart: string | null; issueType: string | null; title: string | null }): string {
  if (input.issueType === 'monthly' && input.periodStart) {
    const month = monthOfDate(input.periodStart)
    if (month !== null) return `${month}월호`
  }
  return input.title?.trim() ?? ''
}

// ---------------------------------------------------------------------------
// 쪽 이미지 경로 (55-1 규칙)
// ---------------------------------------------------------------------------

/** 한 쪽의 버킷 안 경로. `page`는 1부터. 두 자리 이상으로 0을 채운다(`page-01.jpg`). */
export function pageImagePath(coupleId: string, issueId: string, page: number): string {
  if (!Number.isInteger(page) || page < 1) throw new Error(`쪽 번호는 1 이상의 정수여야 한다 (${page})`)
  return `${coupleId}/${issueId}/render/page-${String(page).padStart(2, '0')}.jpg`
}

/** 1쪽부터 `pageCount`쪽까지의 경로. 쪽 수가 없거나 0이면 빈 배열. */
export function pageImagePaths(coupleId: string, issueId: string, pageCount: number | null): string[] {
  if (!pageCount || pageCount < 1) return []
  return Array.from({ length: pageCount }, (_, i) => pageImagePath(coupleId, issueId, i + 1))
}

/** 지금 쪽 가까이(앞뒤 `reach`쪽까지)의 쪽 번호(1부터). 서명 URL을 필요한 만큼만 받는다. */
export function pagesNear(current: number, pageCount: number, reach = 1): number[] {
  const out: number[] = []
  for (let p = Math.max(1, current - reach); p <= Math.min(pageCount, current + reach); p += 1) out.push(p)
  return out
}

/** "8 / 19" */
export function pageCounterLabel(current: number, pageCount: number): string {
  return `${current} / ${pageCount}`
}

// ---------------------------------------------------------------------------
// 다음 호 카드 - 기간 경과율 (R18-6)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 오늘 날짜 `YYYY-MM-DD`. */
export function kstToday(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

function dayNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식이 아니다 (${date})`)
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
}

/** 날짜에 일수를 더한 `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10)
}

/**
 * 기간 경과율(0~100 정수). `periodEnd`는 포함 끝 날짜다(`issues.period_end`).
 * 지난 날 수 / 기간의 날 수를 내림한다. 시작 전은 0, 끝 날짜가 지나면 100.
 * 결정론이다 - 오늘 날짜(KST)만 입력이다.
 */
export function periodElapsedPercent(periodStart: string, periodEnd: string, todayKst: string): number {
  const start = dayNumber(periodStart)
  const end = dayNumber(periodEnd)
  const today = dayNumber(todayKst)
  const total = end - start + 1
  if (total <= 0) return 0
  if (today > end) return 100
  if (today <= start) return 0
  return Math.min(100, Math.max(0, Math.floor(((today - start) / total) * 100)))
}

/** `fn_issue_progress`의 한 행(필요한 칸만). */
export interface IssueProgressRow {
  issue_id: string
  issue_type: string
  period_start: string
  period_end: string
  corner_type: string
  status: string
  skip_reason: string | null
}

export interface DraftIssue {
  issueId: string
  issueType: string
  periodStart: string
  periodEnd: string
}

/**
 * 진행 행들에서 다음 호(초안) 하나. 빈 결과(초안·코너 행 없음)면 null이다.
 * 월간을 먼저 보고, 같은 종류 안에서는 기간 시작이 가장 늦은 것을 고른다.
 */
export function pickDraftIssue(rows: readonly IssueProgressRow[]): DraftIssue | null {
  const byIssue = new Map<string, DraftIssue>()
  for (const r of rows) {
    if (!byIssue.has(r.issue_id)) {
      byIssue.set(r.issue_id, {
        issueId: r.issue_id,
        issueType: r.issue_type,
        periodStart: r.period_start,
        periodEnd: r.period_end,
      })
    }
  }
  const drafts = [...byIssue.values()]
  if (drafts.length === 0) return null
  drafts.sort((a, b) => {
    const am = a.issueType === 'monthly' ? 0 : 1
    const bm = b.issueType === 'monthly' ? 0 : 1
    if (am !== bm) return am - bm
    return b.periodStart.localeCompare(a.periodStart)
  })
  return drafts[0]
}

/** 기간 안 기록을 세는 범위. 날짜는 포함 범위, 시각은 `[start, end)`다(KST 하루 경계). */
export function periodRange(periodStart: string, periodEnd: string): {
  startDate: string
  endDate: string
  startIso: string
  endExclusiveIso: string
} {
  const endExclusiveDate = addDays(periodEnd, 1)
  return {
    startDate: periodStart,
    endDate: periodEnd,
    startIso: new Date(`${periodStart}T00:00:00+09:00`).toISOString(),
    endExclusiveIso: new Date(`${endExclusiveDate}T00:00:00+09:00`).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 서재 화면 분기
// ---------------------------------------------------------------------------

export type LibraryMode = 'pending' | 'unconnected' | 'loading' | 'error' | 'first' | 'shelf'

/**
 * 서재가 어떤 화면인가. 미연결이면 D16, 발행된 호가 0권이면 D14, 아니면 서재(D01).
 * 연결 여부가 아직 정해지지 않았으면 `pending`(아무것도 확정하지 않는다).
 */
export function libraryMode(input: {
  connection: 'unknown' | 'loading' | 'disconnected' | 'connected'
  loading: boolean
  error: boolean
  publishedCount: number
}): LibraryMode {
  if (input.connection === 'unknown' || input.connection === 'loading') return 'pending'
  if (input.connection === 'disconnected') return 'unconnected'
  if (input.loading) return 'loading'
  if (input.error) return 'error'
  return input.publishedCount === 0 ? 'first' : 'shelf'
}

// ---------------------------------------------------------------------------
// 서명 URL 캐시 - 필요할 때 받고, 만료되면 다시 받는다
// ---------------------------------------------------------------------------

export interface SignedUrlCacheOptions {
  /** 경로들의 서명 URL을 받는다(경로 -> URL). 못 만든 경로는 빠진다. */
  sign: (paths: readonly string[]) => Promise<Record<string, string>>
  ttlSeconds: number
  now?: () => number
  marginMs?: number
}

export interface SignedUrlCache {
  /** 이 경로들의 신선한 URL을 보장하고 현재 값을 돌려준다. 같은 경로를 동시에 두 번 받지 않는다. */
  ensure: (paths: readonly string[]) => Promise<Record<string, string>>
  /** 지금 캐시에 있는 신선한 URL(없으면 undefined). */
  peek: (path: string) => string | undefined
  /** 이 경로의 URL을 버린다(이미지가 403 등으로 실패했을 때). */
  invalidate: (path: string) => void
}

export function createSignedUrlCache(options: SignedUrlCacheOptions): SignedUrlCache {
  const now = options.now ?? (() => Date.now())
  const margin = options.marginMs ?? URL_REFRESH_MARGIN_MS
  const entries = new Map<string, { url: string; expiresAt: number }>()
  const inflight = new Map<string, Promise<void>>()

  const fresh = (path: string): string | undefined => {
    const e = entries.get(path)
    return e && e.expiresAt - margin > now() ? e.url : undefined
  }

  async function ensure(paths: readonly string[]): Promise<Record<string, string>> {
    const unique = [...new Set(paths)]
    const need = unique.filter((p) => fresh(p) === undefined && !inflight.has(p))
    if (need.length > 0) {
      const request = options
        .sign(need)
        .then((signed) => {
          const issuedAt = now()
          for (const [path, url] of Object.entries(signed)) {
            entries.set(path, { url, expiresAt: issuedAt + options.ttlSeconds * 1000 })
          }
        })
        .finally(() => {
          for (const p of need) inflight.delete(p)
        })
      for (const p of need) inflight.set(p, request)
    }
    await Promise.all(unique.map((p) => inflight.get(p)).filter((p): p is Promise<void> => p !== undefined))
    const out: Record<string, string> = {}
    for (const p of unique) {
      const url = fresh(p)
      if (url !== undefined) out[p] = url
    }
    return out
  }

  return {
    ensure,
    peek: fresh,
    invalidate: (path) => {
      entries.delete(path)
    },
  }
}

// ---------------------------------------------------------------------------
// 핀치 줌 계산
// ---------------------------------------------------------------------------

export const ZOOM_MIN = 1
export const ZOOM_MAX = 4
/** 두 번 탭으로 확대할 때의 배율. */
export const ZOOM_DOUBLE_TAP = 2.5

// 아래 세 함수는 제스처 워크릿(UI 스레드)에서 부르므로 `'worklet'` 지시어가 필요하다.
export function clampScale(scale: number): number {
  'worklet'
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/** 이동 가능 범위: 확대한 이미지가 화면 밖으로 빈 면을 드러내지 않게 한다. */
export function clampTranslate(translate: number, scale: number, viewportSize: number): number {
  'worklet'
  const limit = Math.max(0, (viewportSize * scale - viewportSize) / 2)
  return Math.min(limit, Math.max(-limit, translate))
}

/** 두 번 탭: 확대돼 있으면 복귀(1), 아니면 확대 배율. */
export function nextDoubleTapScale(current: number): number {
  'worklet'
  return current > ZOOM_MIN + 0.01 ? ZOOM_MIN : ZOOM_DOUBLE_TAP
}

/** 확대 중인가(넘김을 막고 이동을 허락할 기준). */
export function isZoomed(scale: number): boolean {
  return scale > ZOOM_MIN + 0.01
}
