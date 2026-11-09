/**
 * 피드 · 데이트 상세 데이터(RN `hooks/useFeed` · `useDateDetail` · `useRecordingCouple`의 웹판). 같은 조회 · 같은 규칙(`@/services/dateRecordApi` - 클라이언트를 인자로
 * 받는 순수 파일)을 웹 클라이언트로 부른다. **읽기만 한다** - 단 내가 올린 사진의 저장된 배치가 규칙 4와 다르면 내 행만 맞춘다(`syncOwnPlacement`, RN 그대로).
 *
 * RN `useFocusEffect`(화면이 다시 보일 때 다시 읽기)의 웹 대응: 탭 화면은 탭을 옮길 때마다 새로 그려지므로 마운트 때 읽고, 앱이 다시 보일 때(`visibilitychange`)와
 * 기록 · 삭제가 끝났을 때(`useFeedSignal`)도 한 번 더 읽는다. 다시 읽는 동안 이미 받은 값은 지우지 않는다(깜빡임 0).
 */
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import {
  buildFeedItems, comparePhotos, fetchDate, fetchDates, fetchDisplayNames, fetchEntriesOfDates, fetchStopsOfDate, findRecordingCouple,
  signPhotoPaths, syncOwnPlacement,
  type Db, type DateRow, type EntryRow, type FeedDateItem, type RecordingCouple, type StopRow,
} from '@/services/dateRecordApi'
import { assignStop, groupByMonth, type MonthChapter } from '@/utils/dateRecord'
import { getSupabase } from '../../auth/client'

const dbOrNull = (): Db | null => (getSupabase() as unknown as Db | null)

/** 기록 · 삭제가 끝났음을 열려 있는 피드 · 상세에 알린다(번호만 올린다). */
export const useFeedSignal = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}))

function useReloadOnVisible(reload: () => void): void {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])
}

// ---------------------------------------------------------------------------
// 기록할 커플 행(규칙 6) - 만들지 않는다
// ---------------------------------------------------------------------------

export interface RecordingCoupleState {
  loading: boolean
  couple: RecordingCouple | null
  error: string | null
  reload: () => Promise<void>
}

export function useRecordingCouple(userId: string | null): RecordingCoupleState {
  const [state, setState] = useState<Omit<RecordingCoupleState, 'reload'>>({ loading: true, couple: null, error: null })
  const reload = useCallback(async () => {
    const db = dbOrNull()
    if (!userId || !db) {
      setState({ loading: false, couple: null, error: null })
      return
    }
    try {
      setState({ loading: false, couple: await findRecordingCouple(db, userId), error: null })
    } catch (e) {
      setState({ loading: false, couple: null, error: e instanceof Error ? e.message : '커플 조회에 실패했어요' })
    }
  }, [userId])
  useEffect(() => { void reload() }, [reload])
  useReloadOnVisible(() => { void reload() })
  return { ...state, reload }
}

// ---------------------------------------------------------------------------
// E01 피드
// ---------------------------------------------------------------------------

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
  const [state, setState] = useState<Omit<FeedState, 'reload'>>({ loading: true, error: null, chapters: [], urls: {}, names: {} })
  const signal = useFeedSignal((s) => s.version)

  const reload = useCallback(async () => {
    const db = dbOrNull()
    if (!db) {
      setState((s) => ({ ...s, loading: false, error: '연결할 수 없어요' }))
      return
    }
    try {
      const dates = await fetchDates(db)
      const entries = await fetchEntriesOfDates(db, dates.map((d) => d.id))
      const items = buildFeedItems(dates, entries)
      const chapters: FeedChapter[] = groupByMonth(items.map((i) => ({ ...i, date_on: i.dateOn }))).map((c) => ({
        ...c,
        photoTotal: c.dates.reduce((n, d) => n + d.photoCount, 0),
        memoTotal: c.dates.reduce((n, d) => n + d.memoCount, 0),
      }))
      const coverPaths = items.flatMap((i) => (i.coverPath ? [i.coverPath] : []))
      const authorIds = items.flatMap((i) => (i.quote ? [i.quote.authorId] : []))
      const [urls, names] = await Promise.all([signPhotoPaths(db, coverPaths), fetchDisplayNames(db, authorIds)])
      setState({ loading: false, error: null, chapters, urls, names })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : '피드를 불러오지 못했어요' }))
    }
  }, [])

  useEffect(() => { if (enabled) void reload() }, [enabled, reload, signal])
  useReloadOnVisible(() => { if (enabled) void reload() })
  return { ...state, reload }
}

// ---------------------------------------------------------------------------
// E03 데이트 상세
// ---------------------------------------------------------------------------

export interface DetailStop extends StopRow {
  photos: EntryRow[]
}

export interface DateDetailState {
  loading: boolean
  error: string | null
  notFound: boolean
  date: DateRow | null
  stops: DetailStop[]
  /** 데이트 단위 메모(작성 순). */
  memos: EntryRow[]
  photoTotal: number
  /** 시간 범위 계산용 촬영 시각. */
  photoCapturedAts: (string | null)[]
  urls: Record<string, string>
  names: Record<string, string>
  reload: () => Promise<void>
}

type Loaded = Omit<DateDetailState, 'reload'>

const EMPTY_DETAIL: Loaded = {
  loading: true, error: null, notFound: false, date: null, stops: [], memos: [], photoTotal: 0, photoCapturedAts: [], urls: {}, names: {},
}

export function useDateDetail(dateId: string, userId: string | null): DateDetailState {
  const [state, setState] = useState<Loaded>(EMPTY_DETAIL)
  const signal = useFeedSignal((s) => s.version)

  const reload = useCallback(async () => {
    const db = dbOrNull()
    if (!db || !dateId) {
      setState({ ...EMPTY_DETAIL, loading: false, notFound: true })
      return
    }
    try {
      const date = await fetchDate(db, dateId)
      if (!date) {
        setState({ ...EMPTY_DETAIL, loading: false, notFound: true })
        return
      }
      const [stopRows, entries] = await Promise.all([fetchStopsOfDate(db, dateId), fetchEntriesOfDates(db, [dateId])])
      const photos = entries.filter((e) => e.entry_type === 'photo' && e.storage_path).sort(comparePhotos)
      const memos = entries.filter((e) => e.entry_type === 'memo')

      // 사진 배치는 저장된 값이 아니라 규칙 4로 다시 계산한다(상대의 사진 배치가 늦게 맞춰져도 보이는 배치는 같다).
      const withArrival = stopRows.map((s) => ({ ...s, arrivedAt: s.arrived_at }))
      const placed = new Map<string, EntryRow[]>(stopRows.map((s) => [s.id, []]))
      for (const p of photos) {
        const target = assignStop(p.captured_at, withArrival)
        if (target) placed.get(target.id)?.push(p)
      }
      const stops: DetailStop[] = stopRows.map((s) => ({ ...s, photos: placed.get(s.id) ?? [] }))

      const [urls, names] = await Promise.all([
        signPhotoPaths(db, photos.flatMap((p) => (p.storage_path ? [p.storage_path] : []))),
        fetchDisplayNames(db, memos.map((m) => m.author_id)),
      ])
      setState({
        loading: false, error: null, notFound: false, date, stops, memos, photoTotal: photos.length,
        photoCapturedAts: photos.map((p) => p.captured_at), urls, names,
      })
      // 내 사진의 저장된 배치만 맞춘다. 실패해도 화면에는 영향이 없다.
      if (userId) void syncOwnPlacement(db, dateId, userId).catch(() => undefined)
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : '데이트를 불러오지 못했어요' }))
    }
  }, [dateId, userId])

  useEffect(() => { void reload() }, [reload, signal])
  useReloadOnVisible(() => { void reload() })
  return { ...state, reload }
}
