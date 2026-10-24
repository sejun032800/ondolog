/**
 * 데이트 상세(E03) 데이터 훅 - 데이트·stop·사진·메모를 읽고, 사진 배치는 규칙 4로 다시 계산한다.
 * 저장된 `date_stop_id`는 쓰지 않는다(상대가 올린 사진의 배치가 늦게 맞춰져도 보이는 배치는 같다).
 * 읽기만 한다 - 단 내가 올린 사진의 저장된 배치가 규칙과 다르면 내 행만 맞춘다(`syncOwnPlacement`).
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  comparePhotos,
  fetchDate,
  fetchDisplayNames,
  fetchEntriesOfDates,
  fetchStopsOfDate,
  signPhotoPaths,
  syncOwnPlacement,
  type DateRow,
  type EntryRow,
  type StopRow,
} from '../services/dateRecordApi'
import { supabase } from '../services/supabase'
import { assignStop } from '../utils/dateRecord'

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

const EMPTY: Loaded = {
  loading: true,
  error: null,
  notFound: false,
  date: null,
  stops: [],
  memos: [],
  photoTotal: 0,
  photoCapturedAts: [],
  urls: {},
  names: {},
}

export function useDateDetail(dateId: string, userId: string | null): DateDetailState {
  const [state, setState] = useState<Loaded>(EMPTY)

  const reload = useCallback(async () => {
    try {
      const date = await fetchDate(supabase, dateId)
      if (!date) {
        setState({ ...EMPTY, loading: false, notFound: true })
        return
      }
      const [stopRows, entries] = await Promise.all([
        fetchStopsOfDate(supabase, dateId),
        fetchEntriesOfDates(supabase, [dateId]),
      ])
      const photos = entries.filter((e) => e.entry_type === 'photo' && e.storage_path).sort(comparePhotos)
      const memos = entries.filter((e) => e.entry_type === 'memo')

      const withArrival = stopRows.map((s) => ({ ...s, arrivedAt: s.arrived_at }))
      const placed = new Map<string, EntryRow[]>(stopRows.map((s) => [s.id, []]))
      for (const p of photos) {
        const target = assignStop(p.captured_at, withArrival)
        if (target) placed.get(target.id)?.push(p)
      }
      const stops: DetailStop[] = stopRows.map((s) => ({ ...s, photos: placed.get(s.id) ?? [] }))

      const [urls, names] = await Promise.all([
        signPhotoPaths(
          supabase,
          photos.flatMap((p) => (p.storage_path ? [p.storage_path] : [])),
        ),
        fetchDisplayNames(
          supabase,
          memos.map((m) => m.author_id),
        ),
      ])
      setState({
        loading: false,
        error: null,
        notFound: false,
        date,
        stops,
        memos,
        photoTotal: photos.length,
        photoCapturedAts: photos.map((p) => p.captured_at),
        urls,
        names,
      })

      if (userId) {
        // 내 사진의 저장된 배치만 맞춘다. 실패해도 화면에는 영향이 없다.
        void syncOwnPlacement(supabase, dateId, userId).catch(() => undefined)
      }
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : '데이트를 불러오지 못했어요' }))
    }
  }, [dateId, userId])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  return { ...state, reload }
}
