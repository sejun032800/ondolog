/**
 * R100-1 온도 v0 - 앱이 "어제까지 14일(KST)" 활동 원재료를 **읽기만** 한다(서버 쓰기 0 · 새 RPC 0).
 *  - 메시지: 지운 것(`deleted_at`) 제외, 사진 메시지 포함. (보낸 사람, 보낸 시각)만 고른다. Supabase 기본 최대 1000행이라 **페이지**로 나눠 읽고,
 *    페이지가 `ACTIVITY_MAX_PAGES`를 넘으면 (날짜 · 사람)별 `count: 'exact', head: true` 건수 읽기로 바꾼다. 오늘(KST) 메시지는 읽지 않는다.
 *  - 데이트 기록 있음: `dates`(지우지 않은 것)의 `date_on` 중 `photo_count > 0` 또는 `has_user_note`.
 *    근거: `fn_delete_own_entry`(023)가 데이트 행을 지우지 않고 파생 칸을 남은 항목 기준으로 다시 맞추므로 행 존재만으로는 모자라고,
 *    그 파생 칸이 "지우지 않은 사진 · 메모"이다. `date_stops`는 사진에서 파생되고 항목을 지워도 남으므로 보지 않는다.
 * 식은 여기서 쓰지 않는다. 값은 루트 엔진 `computeDailyTemperatureV0`가 낸다.
 */
import { ACTIVITY_V0_PROVISIONAL_COEFFICIENTS, kstDayKey, type ActivityV0CountsInput, type CoupleUserIds } from '@/engine/temperature'
import { addDays } from '@/utils/magazine'

export const ACTIVITY_PAGE_SIZE = 1000
export const ACTIVITY_MAX_PAGES = 30

// 호출부 · 시험이 같은 모양으로 쓰는 느슨한 질의 형태.
type Q = {
  select: (cols: string, opts?: { count: 'exact'; head: true }) => Q
  eq: (c: string, v: unknown) => Q
  is: (c: string, v: null) => Q
  gte: (c: string, v: string) => Q
  lt: (c: string, v: string) => Q
  lte: (c: string, v: string) => Q
  order: (c: string, o?: { ascending: boolean }) => Q
  range: (a: number, b: number) => Q
} & PromiseLike<{ data: unknown; count?: number | null; error: unknown }>
export type ActivityDb = { from: (table: string) => Q }

function kstStartIso(day: string): string {
  return new Date(`${day}T00:00:00+09:00`).toISOString()
}

type Row = { sender_id: string; sent_at: string }

/** 창 안 (날짜 | 사람)별 건수. */
async function readMessageCounts(db: ActivityDb, coupleId: string, ids: CoupleUserIds, startDay: string, todayKst: string, windowDays: number): Promise<Map<string, number>> {
  const startIso = kstStartIso(startDay)
  const endIso = kstStartIso(todayKst)
  const counts = new Map<string, number>()
  const bump = (date: string, sender: string, n: number) => counts.set(`${date}|${sender}`, (counts.get(`${date}|${sender}`) ?? 0) + n)
  for (let page = 0; page < ACTIVITY_MAX_PAGES; page += 1) {
    const from = page * ACTIVITY_PAGE_SIZE
    const { data, error } = await db
      .from('messages')
      .select('sender_id, sent_at')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .gte('sent_at', startIso)
      .lt('sent_at', endIso)
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ACTIVITY_PAGE_SIZE - 1)
    if (error) throw new Error('활동 읽기 실패(메시지)')
    const rows = (data ?? []) as Row[]
    for (const r of rows) bump(kstDayKey(r.sent_at), r.sender_id, 1)
    if (rows.length < ACTIVITY_PAGE_SIZE) return counts
  }
  // 페이지가 너무 많다 - (날짜 · 사람)별 건수만 센다(헤드 요청, 행을 받지 않는다).
  counts.clear()
  for (let i = 0; i < windowDays; i += 1) {
    const day = addDays(startDay, i)
    const next = addDays(day, 1)
    for (const id of ids) {
      const { count, error } = await db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .eq('sender_id', id)
        .is('deleted_at', null)
        .gte('sent_at', kstStartIso(day))
        .lt('sent_at', kstStartIso(next))
      if (error) throw new Error('활동 읽기 실패(건수)')
      if (count) bump(day, id, count)
    }
  }
  return counts
}

/** 어제까지 `windowDays`일의 활동 원재료 -> 엔진 `dailyCounts` 입력. 하나라도 못 읽으면 throw(호출부는 기저만 보인다). */
export async function readActivityInput(
  db: ActivityDb,
  coupleId: string,
  userIds: CoupleUserIds,
  todayKst: string,
  windowDays: number = ACTIVITY_V0_PROVISIONAL_COEFFICIENTS.windowDays,
): Promise<ActivityV0CountsInput> {
  const startDay = addDays(todayKst, -windowDays)
  const yesterday = addDays(todayKst, -1)
  const [counts, datesRes] = await Promise.all([
    readMessageCounts(db, coupleId, userIds, startDay, todayKst, windowDays),
    // 질의기가 동기로 던져도 위 메시지 읽기의 거부가 처리 안 된 채 남지 않게 비동기 함수 안에서 만든다.
    (async () =>
      db
        .from('dates')
        .select('date_on, photo_count, has_user_note')
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('date_on', startDay)
        .lte('date_on', yesterday))(),
  ])
  if (datesRes.error) throw new Error('활동 읽기 실패(데이트)')
  const dates = (datesRes.data ?? []) as { date_on: string; photo_count: number | null; has_user_note: boolean | null }[]
  const recordDates = dates.filter((d) => (d.photo_count ?? 0) > 0 || d.has_user_note === true).map((d) => d.date_on)
  const dailyCounts = [...counts.entries()].map(([k, count]) => {
    const [date, senderId] = k.split('|')
    return { date, senderId, count }
  })
  return { userIds, todayKst, recordDates, dailyCounts }
}
