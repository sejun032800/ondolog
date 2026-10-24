/**
 * 피드(E01) 데이터 훅 - 이 유저에게 보이는(RLS 범위) 데이트를 월별로 읽는다. 읽기만 한다.
 * 화면이 다시 보일 때마다(기록하고 돌아왔을 때) 다시 읽는다.
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  buildFeedItems,
  fetchDates,
  fetchDisplayNames,
  fetchEntriesOfDates,
  signPhotoPaths,
  type FeedDateItem,
} from '../services/dateRecordApi'
import { supabase } from '../services/supabase'
import { groupByMonth, type MonthChapter } from '../utils/dateRecord'

/** `groupByMonth`가 읽는 date_on을 함께 든 피드 항목. */
export type FeedEntry = FeedDateItem & { date_on: string }

export interface FeedChapter extends MonthChapter<FeedEntry> {
  photoTotal: number
  memoTotal: number
}

export interface FeedState {
  loading: boolean
  error: string | null
  chapters: FeedChapter[]
  /** 사진 경로 -> 서명 URL. */
  urls: Record<string, string>
  /** 작성자 id -> 표시 이름. */
  names: Record<string, string>
  reload: () => Promise<void>
}

export function useFeed(enabled: boolean): FeedState {
  const [state, setState] = useState<Omit<FeedState, 'reload'>>({
    loading: true,
    error: null,
    chapters: [],
    urls: {},
    names: {},
  })

  const reload = useCallback(async () => {
    try {
      const dates = await fetchDates(supabase)
      const entries = await fetchEntriesOfDates(
        supabase,
        dates.map((d) => d.id),
      )
      const items = buildFeedItems(dates, entries)
      const chapters: FeedChapter[] = groupByMonth(
        items.map((i) => ({ ...i, date_on: i.dateOn })),
      ).map((c) => ({
        ...c,
        photoTotal: c.dates.reduce((n, d) => n + d.photoCount, 0),
        memoTotal: c.dates.reduce((n, d) => n + d.memoCount, 0),
      }))
      const coverPaths = items.flatMap((i) => (i.coverPath ? [i.coverPath] : []))
      const authorIds = items.flatMap((i) => (i.quote ? [i.quote.authorId] : []))
      const [urls, names] = await Promise.all([
        signPhotoPaths(supabase, coverPaths),
        fetchDisplayNames(supabase, authorIds),
      ])
      setState({ loading: false, error: null, chapters, urls, names })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : '피드를 불러오지 못했어요' }))
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (enabled) void reload()
    }, [enabled, reload]),
  )

  return { ...state, reload }
}
