/**
 * 우리의 하늘 데이터(MASTER 9-8) - **읽기만** 한다(서버 쓰기 0 · 새 테이블 0).
 *  - 별 = 함께한 하루: 날짜별 기록 수는 `features/records/dayRecordRead`(메인 온도와 같은 읽기)로 읽고, 판정은 엔진 `togetherDates` 한 곳.
 *  - 그 날의 온도(별 크기): 저장값(`daily_temperature`)이 있으면 그 값, 없으면 엔진 `computeDailyTemperatureV0`를 **그날 끝 기준**(`todayKst` = 다음 날)으로.
 *    메시지는 **보이는 달만 늦게**(`ensureTemps`) 읽는다. 어느 하나라도 못 읽으면 그 달의 별은 모두 가운데 크기(5px)다.
 *  - 달: `issues_public`(`fetchPublishedIssues`) · 진행 중 초안(`fn_issue_progress`) - `issues`는 읽지 않는다(절대 규칙 3).
 *  - 기기 저장: 종류 'sky'(커플 자료 - 로그아웃 · 탈퇴 요청 · 해제 요청 · 계정 전환에서 지워진다). 해제 유예 중에는 저장하지 않는다. 사진 서명 URL은 저장하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ACTIVITY_V0_PROVISIONAL_COEFFICIENTS,
  computeDailyTemperatureV0,
  type ActivityDailyCount,
} from '@/engine/temperature'
import type { EnneagramCore } from '@/constants/enneagram'
import { togetherDates } from '@/engine/togetherDay'
import { fetchIssueProgressRows, fetchPublishedIssues } from '@/services/magazineApi'
import { fetchDisplayNames, signPhotoPaths, type Db } from '@/services/dateRecordApi'
import { addDays, kstToday, pickDraftIssue } from '@/utils/magazine'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { getSignedUrl, putSignedUrls } from '../../cache/signedUrlCache'
import { useFeedSignal } from '../feed/feedData'
import { readMessageCounts, type ActivityDb } from '../main/activityRead'
import { START_TEMPERATURE_COEFFICIENTS } from '../main/startTemperature'
import { readDayRecords, toDayCounts, type DayRecord } from '../records/dayRecordRead'
import { monthOf, monthRange } from './skyMath'

export type TempStatus = 'ok' | 'failed'

export interface SkyMoonSource { periodStart: string; issueNumber: number }

export interface SkyData {
  /** 아직 보일 값이 하나도 없는 첫 읽기. */
  loading: boolean
  /** 읽기에 실패했고 보일 값도 없다. */
  error: boolean
  records: DayRecord[]
  /** 모든 달을 읽었는가(첫 함께한 하루가 있는 달 · 지난 달 별 수가 확정). */
  allLoaded: boolean
  /** 날짜 -> 그날의 온도(모르면 null, 아직 안 읽었으면 키 없음). */
  temps: Record<string, number | null>
  tempStatus: Record<string, TempStatus>
  moons: SkyMoonSource[]
  draftPeriodStart: string | null
  /** 이 달의 온도를 읽는다(이미 읽었거나 읽는 중이면 아무 일도 없다). 화면에 보이는 달에서만 부른다. */
  ensureTemps: (month: string) => void
}

interface SkyCache {
  coupleId: string
  records: DayRecord[]
  allLoaded: boolean
  temps: Record<string, number | null>
  tempStatus: Record<string, TempStatus>
  moons: SkyMoonSource[]
  draftPeriodStart: string | null
}

const dbOrNull = (): ActivityDb | null => getSupabase() as unknown as ActivityDb | null

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

type CoreRow = { user_id: string; enneagram_inferred: number | null; enneagram_effective: number | null }

async function readCores(userId: string, partnerId: string): Promise<[EnneagramCore, EnneagramCore]> {
  const db = getSupabase()
  if (!db) throw new Error('no client')
  const { data, error } = await db.from('personality_profiles').select('user_id, enneagram_inferred, enneagram_effective').in('user_id', [userId, partnerId])
  if (error) throw new Error('cores')
  const rows = (data ?? []) as CoreRow[]
  const core = (id: string): EnneagramCore => {
    const r = rows.find((x) => x.user_id === id)
    const c = r ? (r.enneagram_effective ?? r.enneagram_inferred) : null
    if (c == null) throw new Error('core missing')
    return c as EnneagramCore
  }
  return [core(userId), core(partnerId)]
}

export interface UseSkyInput {
  userId: string | null
  partnerId: string | null
  coupleId: string | null
  now: Date
  /** 기기에 남길 수 있는가(연결일 때만 - 해제 유예 중에는 남기지 않는다). */
  persist: boolean
}

export function useSky({ userId, partnerId, coupleId, now, persist }: UseSkyInput): SkyData {
  const today = kstToday(now)
  const thisMonth = monthOf(today)
  const signal = useFeedSignal((s) => s.version)

  const [state, setState] = useState<Omit<SkyData, 'ensureTemps'>>(() => {
    const saved = coupleId ? readCache<SkyCache>(userId, 'sky', coupleId) : null
    if (saved && saved.coupleId === coupleId && Array.isArray(saved.records)) {
      return { loading: false, error: false, records: saved.records, allLoaded: saved.allLoaded === true, temps: saved.temps ?? {}, tempStatus: saved.tempStatus ?? {}, moons: saved.moons ?? [], draftPeriodStart: saved.draftPeriodStart ?? null }
    }
    return { loading: true, error: false, records: [], allLoaded: false, temps: {}, tempStatus: {}, moons: [], draftPeriodStart: null }
  })
  const recordsRef = useRef<DayRecord[]>(state.records)
  recordsRef.current = state.records
  const statusRef = useRef<Record<string, TempStatus>>(state.tempStatus)
  statusRef.current = state.tempStatus
  const inflight = useRef(new Set<string>())
  const generation = useRef(0)

  // 기록 · 달 읽기: 이 달 먼저, 이어서 전부(첫 함께한 하루가 있는 달까지).
  useEffect(() => {
    const db = dbOrNull()
    if (!coupleId || !db) { setState((s) => ({ ...s, loading: false })); return }
    const gen = (generation.current += 1)
    inflight.current.clear()
    let cancelled = false
    const live = () => !cancelled && generation.current === gen
    void (async () => {
      try {
        const range = monthRange(thisMonth)
        const moonsP = Promise.all([
          fetchPublishedIssues(db as unknown as Db).catch(() => null),
          fetchIssueProgressRows(db as unknown as Db).catch(() => null),
        ])
        const first = await readDayRecords(db, coupleId, range)
        if (!live()) return
        setState((s) => ({ ...s, loading: false, error: false, records: mergeRecords(s.records, first, range) }))
        const [issues, progress] = await moonsP
        if (!live()) return
        if (issues || progress) {
          setState((s) => ({
            ...s,
            moons: issues ? issues.map((i) => ({ periodStart: i.periodStart, issueNumber: i.issueNumber })) : s.moons,
            draftPeriodStart: progress ? (pickDraftIssue(progress)?.periodStart ?? null) : s.draftPeriodStart,
          }))
        }
        const all = await readDayRecords(db, coupleId)
        if (!live()) return
        setState((s) => ({ ...s, records: all, allLoaded: true }))
      } catch {
        // 읽기에 실패해도 먼저 보이던 값은 지우지 않는다(오프라인에서 마지막 하늘 유지). 보일 값이 없을 때만 오류.
        if (live()) setState((s) => ({ ...s, loading: false, error: s.records.length === 0 }))
      }
    })()
    return () => { cancelled = true }
  }, [coupleId, thisMonth, signal])

  const ensureTemps = useCallback((month: string) => {
    const db = dbOrNull()
    if (!db || !coupleId || statusRef.current[month] || inflight.current.has(month)) return
    const days = togetherDates(toDayCounts(recordsRef.current.filter((r) => monthOf(r.date) === month)))
    if (days.length === 0) return
    inflight.current.add(month)
    const gen = generation.current
    void (async () => {
      const { from, to } = monthRange(month)
      let temps: Record<string, number | null>
      let status: TempStatus = 'ok'
      try {
        const stored = new Map<string, number>()
        const { data, error } = await db.from('daily_temperature').select('date_on, temperature').eq('couple_id', coupleId).gte('date_on', from).lte('date_on', to)
        if (error) throw new Error('stored')
        for (const r of (data ?? []) as { date_on: string; temperature: number }[]) stored.set(r.date_on, Number(r.temperature))
        const missing = days.filter((d) => !stored.has(d))
        temps = {}
        for (const d of days) if (stored.has(d)) temps[d] = stored.get(d) as number
        if (missing.length > 0) {
          if (!userId || !partnerId) throw new Error('no partner')
          const ids: [string, string] = [userId, partnerId]
          const windowStart = addDays(from, -13)
          const end = addDays(to, 1)
          const [cores, counts, windowRecords] = await Promise.all([
            readCores(userId, partnerId),
            readMessageCounts(db, coupleId, ids, windowStart, end, daysBetween(windowStart, end)),
            readDayRecords(db, coupleId, { from: windowStart, to }),
          ])
          const dailyCounts: ActivityDailyCount[] = [...counts.entries()].map(([k, count]) => {
            const [date, senderId] = k.split('|')
            return { date, senderId, count }
          })
          const recordDays = toDayCounts(windowRecords)
          for (const d of missing) {
            temps[d] = computeDailyTemperatureV0(cores[0], cores[1], { userIds: ids, todayKst: addDays(d, 1), recordDays, dailyCounts }, {
              baseline: START_TEMPERATURE_COEFFICIENTS,
              activity: ACTIVITY_V0_PROVISIONAL_COEFFICIENTS,
            })
          }
        }
      } catch {
        status = 'failed'
        temps = Object.fromEntries(days.map((d) => [d, null]))
      }
      inflight.current.delete(month)
      if (generation.current !== gen) return
      setState((s) => ({ ...s, temps: { ...s.temps, ...temps }, tempStatus: { ...s.tempStatus, [month]: status } }))
    })()
  }, [coupleId, userId, partnerId])

  // 기기에 남긴다(연결일 때만, 받은 값이 있을 때만).
  useEffect(() => {
    if (!persist || !coupleId || state.loading || state.records.length === 0) return
    writeCache(userId, 'sky', {
      coupleId, records: state.records, allLoaded: state.allLoaded, temps: state.temps, tempStatus: state.tempStatus, moons: state.moons, draftPeriodStart: state.draftPeriodStart,
    } satisfies SkyCache, coupleId)
  }, [persist, userId, coupleId, state])

  return { ...state, ensureTemps }
}

/** 이 달을 새로 읽은 값으로 바꾸고 나머지 달은 그대로 둔다. */
function mergeRecords(prev: DayRecord[], fresh: DayRecord[], range: { from: string; to: string }): DayRecord[] {
  const keep = prev.filter((r) => r.date < range.from || r.date > range.to)
  return [...keep, ...fresh].sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// C04 · C05 - 사진 서명 URL(이 실행의 메모리만) · 남긴 사람 이름
// ---------------------------------------------------------------------------

const SKY_URL_BUCKET = 'sky'

/** 사진 경로 -> 서명 URL. 이미 받은 것은 다시 받지 않는다. 기기에 저장하지 않는다. */
export function useSkyPhotoUrls(paths: readonly string[]): Record<string, string> {
  const [, bump] = useState(0)
  const key = paths.join('|')
  useEffect(() => {
    const db = getSupabase() as unknown as Db | null
    const missing = paths.filter((p) => getSignedUrl(SKY_URL_BUCKET, p) === undefined)
    if (!db || missing.length === 0) return
    let cancelled = false
    signPhotoPaths(db, missing)
      .then((signed) => {
        putSignedUrls(SKY_URL_BUCKET, signed)
        if (!cancelled) bump((n) => n + 1)
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const out: Record<string, string> = {}
  for (const p of paths) {
    const url = getSignedUrl(SKY_URL_BUCKET, p)
    if (url) out[p] = url
  }
  return out
}

/** 작성자 id -> 표시 이름(못 읽으면 비어 있다). */
export function useSkyNames(ids: readonly string[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({})
  const key = [...new Set(ids)].sort().join('|')
  const me = useAuthStore((s) => s.userId)
  useEffect(() => {
    const db = getSupabase() as unknown as Db | null
    if (!db || !key || !me) return
    let cancelled = false
    fetchDisplayNames(db, key.split('|')).then((n) => { if (!cancelled) setNames(n) }).catch(() => {})
    return () => { cancelled = true }
  }, [key, me])
  return names
}
