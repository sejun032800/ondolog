/**
 * 서재(D01) 데이터 훅 - 발행된 호(`issues_public`), 표지 서명 URL, 다음 호 카드의 값. 읽기만 한다.
 * 화면이 다시 보일 때마다 다시 읽는다.
 *
 * 다음 호 카드: `fn_issue_progress`의 초안 호 기간으로 진행률(기간 경과율, KST 오늘 기준)을 만들고,
 * 재료 수는 기간 안 count를 센다. 초안·코너 행이 없으면 `next`는 null이다(빈 결과).
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  countMaterials,
  fetchIssueProgressRows,
  fetchPublishedIssues,
  signMagazinePaths,
  type MaterialCounts,
  type PublishedIssue,
} from '../services/magazineApi'
import { supabase } from '../services/supabase'
import { issueMonthLabel, kstToday, periodElapsedPercent, pickDraftIssue } from '../utils/magazine'

export interface NextIssueData {
  /** "10월호" */
  monthLabel: string
  /** 기간 경과율 0~100 정수. */
  percent: number
  /** 기간 안 기록 수. 못 셌으면 null(카드는 수를 그리지 않는다). */
  counts: MaterialCounts | null
}

export interface LibraryState {
  loading: boolean
  error: boolean
  issues: PublishedIssue[]
  /** 표지 경로 -> 서명 URL. */
  coverUrls: Record<string, string>
  next: NextIssueData | null
  reload: () => Promise<void>
}

export function useLibrary(coupleId: string | null): LibraryState {
  const [state, setState] = useState<Omit<LibraryState, 'reload'>>({
    loading: true,
    error: false,
    issues: [],
    coverUrls: {},
    next: null,
  })

  const reload = useCallback(async () => {
    if (!coupleId) return
    try {
      const [issues, progressRows] = await Promise.all([fetchPublishedIssues(supabase), fetchIssueProgressRows(supabase)])
      const coverPaths = issues.flatMap((i) => (i.coverPath ? [i.coverPath] : []))
      const draft = pickDraftIssue(progressRows)
      const [coverUrls, counts] = await Promise.all([
        signMagazinePaths(supabase, coverPaths),
        draft
          ? countMaterials(supabase, coupleId, { periodStart: draft.periodStart, periodEnd: draft.periodEnd }).catch(() => null)
          : Promise.resolve(null),
      ])
      const next: NextIssueData | null = draft
        ? {
            monthLabel: issueMonthLabel({ periodStart: draft.periodStart, issueType: draft.issueType, title: null }),
            percent: periodElapsedPercent(draft.periodStart, draft.periodEnd, kstToday(new Date())),
            counts,
          }
        : null
      setState({ loading: false, error: false, issues, coverUrls, next })
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }, [coupleId])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  return { ...state, reload }
}
