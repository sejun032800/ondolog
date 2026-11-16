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
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { getSignedUrl, putSignedUrls } from '../../cache/signedUrlCache'

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

/**
 * 기록 쓰기가 열려 있는가(R30-3 · R77-1). **연결된(active) 커플일 때만** 연다. 초대 코드만 만든 대기(pending) 행이나 행이 없는 사람은 닫힌다 -
 * 혼자 기록은 MVP에서 열지 않는다(연결될 때 합치는 규칙이 없다, 병합은 M4). 첫 기록 버튼 · + 버튼 · 기록 시트 · 데이트 상세의 [사진 더하기]가 모두 이 한 판정을 쓴다.
 */
export function isRecordable(couple: RecordingCouple | null): boolean {
  return couple !== null && couple.status === 'active'
}

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
  /** 76-d: 지운 날 카드를 다시 읽기 전에 바로 뺀다(내 것만 있던 날). */
  dropDay?: (dateId: string) => void
}

/** 사진 주소는 이 실행의 메모리(`signedUrlCache`)에만 둔다 - 기기에 저장하지 않는다(서명 만료). 키 버킷 이름. */
const FEED_URL_BUCKET = 'feed'

/**
 * 76-B5: 피드를 처음 그릴 때 기기에 남긴 마지막 값(월 묶음 · 이름)과 메모리의 사진 주소가 있으면 그것을 먼저 보인다 - 상세에서 돌아와도 회색 자리 표시로 되돌아가지 않는다.
 * 자리 표시(`loading`)는 보여 줄 값이 없는 첫 로드에만 쓴다. 서버 읽기가 오면 바꾼다.
 */
function initialFeedState(): Omit<FeedState, 'reload'> {
  const saved = readCache<{ chapters: FeedChapter[]; names: Record<string, string> }>(useAuthStore.getState().userId, 'feed')
  if (!saved || !Array.isArray(saved.chapters)) return { loading: true, error: null, chapters: [], urls: {}, names: {} }
  const urls: Record<string, string> = {}
  for (const c of saved.chapters) {
    for (const d of c.dates ?? []) {
      if (d.coverPath) {
        const url = getSignedUrl(FEED_URL_BUCKET, d.coverPath)
        if (url) urls[d.coverPath] = url
      }
    }
  }
  return { loading: false, error: null, chapters: saved.chapters, urls, names: saved.names ?? {} }
}

export function useFeed(enabled: boolean): FeedState {
  const [state, setState] = useState<Omit<FeedState, 'reload'>>(initialFeedState)
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
      // 이미 받은 주소(만료 전)는 다시 받지 않는다 - 같은 주소라 사진이 다시 내려받아지며 비는 일이 없다(76-B3).
      const have: Record<string, string> = {}
      for (const p of coverPaths) {
        const url = getSignedUrl(FEED_URL_BUCKET, p)
        if (url) have[p] = url
      }
      const [signed, names] = await Promise.all([signPhotoPaths(db, coverPaths.filter((p) => !have[p])), fetchDisplayNames(db, authorIds)])
      putSignedUrls(FEED_URL_BUCKET, signed)
      const urls = { ...signed, ...have }
      setState({ loading: false, error: null, chapters, urls, names })
      writeCache(useAuthStore.getState().userId, 'feed', { chapters, names })
    } catch (e) {
      // 읽기에 실패해도 먼저 보이던 값은 지우지 않는다(오프라인에서 마지막 값 유지). 보일 값이 없을 때만 오류 화면.
      setState((s) => (s.chapters.length > 0 ? { ...s, loading: false } : { ...s, loading: false, error: e instanceof Error ? e.message : '피드를 불러오지 못했어요' }))
    }
  }, [])

  useEffect(() => { if (enabled) void reload() }, [enabled, reload, signal])
  useReloadOnVisible(() => { if (enabled) void reload() })
  const dropDay = useCallback((dateId: string) => {
    setState((s) => ({ ...s, chapters: dropDayFromChapters(s.chapters, dateId) }))
  }, [])
  return { ...state, reload, dropDay }
}

/** 월 묶음에서 그날 카드를 뺀다(빈 달은 빠지고 달 합계는 다시 센다). 순수. */
export function dropDayFromChapters(chapters: readonly FeedChapter[], dateId: string): FeedChapter[] {
  return chapters.flatMap((c) => {
    const dates = c.dates.filter((d) => d.id !== dateId)
    if (dates.length === c.dates.length) return [c]
    if (dates.length === 0) return []
    return [{ ...c, dates, photoTotal: dates.reduce((n, d) => n + d.photoCount, 0), memoTotal: dates.reduce((n, d) => n + d.memoCount, 0) }]
  })
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
