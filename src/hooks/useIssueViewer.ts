/**
 * 속표지(D10)·뷰어(D11) 데이터 훅 - 호 하나, 실린 코너, 두 사람의 이름, 쪽 이미지 서명 URL. 읽기만 한다.
 *
 * 쪽 이미지 서명 URL은 필요한 쪽(지금 쪽 가까이)만 받고, 만료되면 다시 받는다(`createSignedUrlCache`).
 * 이미지가 실패하면(`reportImageError`) 그 쪽의 URL을 버리고 한 번 다시 받는다. URL 값은 기록하지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDisplayNames } from '../services/dateRecordApi'
import {
  fetchFrontMatterCorners,
  fetchPublishedIssue,
  signDigitalPdf,
  signMagazinePaths,
  type FrontMatterCorner,
  type PublishedIssue,
} from '../services/magazineApi'
import { supabase } from '../services/supabase'
import {
  MAGAZINE_IMAGE_URL_TTL_SECONDS,
  createSignedUrlCache,
  pageImagePath,
  pagesNear,
} from '../utils/magazine'

export interface IssueViewerState {
  loading: boolean
  error: boolean
  issue: PublishedIssue | null
  corners: FrontMatterCorner[]
  /** "세준 · 서영" - 이름을 못 읽으면 빈 문자열. */
  names: string
  /** 쪽 번호(1부터) -> 서명 URL. 아직 못 받은 쪽은 없다. */
  pageUrls: Record<number, string>
  /** 이 쪽들 가까이의 URL을 보장한다(만료됐으면 다시 받는다). */
  ensurePages: (center: number) => Promise<void>
  /** 이 쪽 이미지가 안 열렸다 - URL을 버리고 한 번 다시 받는다. */
  reportImageError: (page: number) => Promise<void>
  /** 내려받기용 PDF의 새 서명 URL(못 만들면 null). */
  signPdf: () => Promise<string | null>
}

export function useIssueViewer(
  issueId: string | null,
  viewer: { userId: string | null; partnerId: string | null },
): IssueViewerState {
  const [base, setBase] = useState<{
    loading: boolean
    error: boolean
    issue: PublishedIssue | null
    corners: FrontMatterCorner[]
    names: string
  }>({ loading: true, error: false, issue: null, corners: [], names: '' })
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({})

  const cache = useMemo(
    () =>
      createSignedUrlCache({
        sign: (paths) => signMagazinePaths(supabase, paths, MAGAZINE_IMAGE_URL_TTL_SECONDS),
        ttlSeconds: MAGAZINE_IMAGE_URL_TTL_SECONDS,
      }),
    [],
  )
  const retried = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!issueId) return
    let cancelled = false
    ;(async () => {
      try {
        const issue = await fetchPublishedIssue(supabase, issueId)
        if (!issue) {
          if (!cancelled) setBase({ loading: false, error: true, issue: null, corners: [], names: '' })
          return
        }
        const ids = [viewer.userId, viewer.partnerId].filter((v): v is string => !!v)
        const [corners, nameMap] = await Promise.all([
          fetchFrontMatterCorners(supabase, issue.id),
          fetchDisplayNames(supabase, ids).catch(() => ({}) as Record<string, string>),
        ])
        const names = ids.map((id) => nameMap[id]).filter((n): n is string => !!n).join(' · ')
        if (!cancelled) setBase({ loading: false, error: false, issue, corners, names })
      } catch {
        if (!cancelled) setBase({ loading: false, error: true, issue: null, corners: [], names: '' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [issueId, viewer.userId, viewer.partnerId])

  const issue = base.issue
  const ensurePages = useCallback(
    async (center: number) => {
      if (!issue || !issue.pageCount) return
      const pages = pagesNear(center, issue.pageCount)
      const paths = pages.map((p) => pageImagePath(issue.coupleId, issue.id, p))
      const signed = await cache.ensure(paths)
      setPageUrls((prev) => {
        const next = { ...prev }
        pages.forEach((p, i) => {
          const url = signed[paths[i]]
          if (url) next[p] = url
        })
        return next
      })
    },
    [issue, cache],
  )

  const reportImageError = useCallback(
    async (page: number) => {
      if (!issue || retried.current.has(page)) return
      retried.current.add(page)
      cache.invalidate(pageImagePath(issue.coupleId, issue.id, page))
      await ensurePages(page)
    },
    [issue, cache, ensurePages],
  )

  const signPdf = useCallback(async () => (issue ? signDigitalPdf(supabase, issue) : null), [issue])

  return { ...base, pageUrls, ensurePages, reportImageError, signPdf }
}
