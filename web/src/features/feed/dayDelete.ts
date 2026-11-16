/**
 * 76-d 하루 지우기(R98-8 · R101-4) - 피드 날짜 카드를 왼쪽으로 밀어 [지우기] -> 확인 -> **`fn_delete_my_day` RPC 하나**(76-m3).
 * 그날 **내가 남긴 장소 · 사진 · 메모**만 지운다(상대 것은 남는다). 서버가 한 번에 지우므로 중간 실패 시 0건이다. 앱은 표를 직접 고치지 않는다.
 *
 * 지운 뒤(성공):
 *  - 피드: 내 것만 있던 날이면 카드를 바로 뺀다(기기 저장분도) · 상대 것이 남으면 다시 읽어 남은 것만 그린다.
 *  - 하늘(77-) 기기 저장분: 그날 기록을 빼고(남은 것이 있으면 다시 읽기가 채운다) 그날이 든 달부터의 그날 온도를 비운다(14일 창이 바뀌므로).
 *  - 온도 v0(함께한 하루 함수): 기록 신호(`useFeedSignal`)를 올려 메인 시작 온도 · 하늘 · 피드 · 상세가 다시 읽는다.
 * 저장소(storage)의 사진 원본은 지우지 않는다 - 기존 사진 삭제 경로(023 `fn_delete_own_entry`)와 같다(보관 정책 §11-2).
 * 오프라인이면 부르지 않는다(화면이 [지우기]를 막고 짧은 안내).
 */
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { deviceSaysOffline, useConnectionStore } from '../../connection/connectionMonitor'
import { useCoupleStore } from '../../stores/coupleStore'
import type { DayRecord } from '../records/dayRecordRead'
import { dropDayFromChapters, useFeedSignal, type FeedChapter } from './feedData'

export const DAY_DELETE_COPY = {
  action: '지우기',
  title: '이 날 기록 지우기',
  confirm: '이 날 내가 남긴 장소 · 사진 · 메모를 지울까요? 상대가 남긴 것은 남아요. 이미 발행된 호에서는 지워지지 않아요.',
  offline: '연결되면 지울 수 있어요',
  failed: '지우지 못했어요. 다시 시도해 주세요',
} as const

export interface DayDeleteResult { entries: number; stops: number; oldStops: number; dayRemoved: boolean }

/** 지금 지울 수 없는가(오프라인) - 기기가 네트워크 없음이라 하거나 끊김 띠가 떠 있다. */
export function dayDeleteBlocked(): boolean {
  return deviceSaysOffline() || useConnectionStore.getState().offline
}

type RpcDb = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** RPC 한 번. 실패는 던진다(부분 성공 없음 - 서버가 원자적). */
export async function deleteMyDay(dateId: string, db: RpcDb | null = getSupabase() as unknown as RpcDb | null): Promise<DayDeleteResult> {
  if (!db) throw new Error('no client')
  const { data, error } = await db.rpc('fn_delete_my_day', { p_date_id: dateId })
  if (error) throw error instanceof Error ? error : new Error('day delete failed')
  const r = (data ?? {}) as { entries?: number; stops?: number; old_stops?: number; day_removed?: boolean }
  return { entries: r.entries ?? 0, stops: r.stops ?? 0, oldStops: r.old_stops ?? 0, dayRemoved: r.day_removed === true }
}

interface SkyCacheShape {
  coupleId: string
  records: DayRecord[]
  temps?: Record<string, number | null>
  tempStatus?: Record<string, string>
  [k: string]: unknown
}

/** 하늘 기기 저장분 고치기: 그날 기록을 빼고, 그날이 든 달부터 그날 온도를 비운다(다시 계산되게). 순수(값만). */
export function patchSkyCache(saved: SkyCacheShape, dateId: string, dateOn: string): SkyCacheShape {
  const month = dateOn.slice(0, 7)
  const temps = Object.fromEntries(Object.entries(saved.temps ?? {}).filter(([d]) => d.slice(0, 7) < month))
  const tempStatus = Object.fromEntries(Object.entries(saved.tempStatus ?? {}).filter(([m]) => m < month))
  return { ...saved, records: saved.records.filter((r) => r.id !== dateId), temps, tempStatus }
}

/** 지운 뒤 기기 저장분(피드 · 하늘)을 고치고 기록 신호를 올린다. */
export function afterDayDeleted(dateId: string, dateOn: string, result: DayDeleteResult): void {
  const userId = useAuthStore.getState().userId
  const coupleId = useCoupleStore.getState().coupleId ?? useCoupleStore.getState().graceCoupleId
  if (result.dayRemoved) {
    const feed = readCache<{ chapters: FeedChapter[]; names: Record<string, string> }>(userId, 'feed')
    if (feed && Array.isArray(feed.chapters)) writeCache(userId, 'feed', { ...feed, chapters: dropDayFromChapters(feed.chapters, dateId) })
  }
  if (coupleId) {
    const sky = readCache<SkyCacheShape>(userId, 'sky', coupleId)
    if (sky && sky.coupleId === coupleId && Array.isArray(sky.records)) writeCache(userId, 'sky', patchSkyCache(sky, dateId, dateOn), coupleId)
  }
  useFeedSignal.getState().bump()
}
