/**
 * 51- ③ 두 폰 커플 길의 읽기 어댑터(service_role 클라이언트 위 · **조회만** - 쓰기 0). 위임: .claude/state/prompts/phase-7/51-3-dispatch-phone-couple-live.md
 * - `PhoneCouplePort`(`phoneTestCouple.ts`): 이메일 -> 인증 계정 id(75- `resetTestAccount.ts` `findUserIds`와 같은 방법) · 구성원으로 커플 찾기
 * - `PreviewPort`(`phonePreview.ts`): 기록 범위(처음 · 마지막 KST 날짜)
 * 오류 문구에 값 · id를 넣지 않는다(표 이름 + 서버 문구만 - 서버 문구도 출력 전에 지울 값 목록을 거친다).
 */

import type { PhoneCouplePort, PhoneCoupleRow } from './phoneTestCouple.ts'
import type { ActivityRange, PreviewPort } from './phonePreview.ts'
import { kstDayOf } from './phonePreview.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const IN_CHUNK = 100

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? '알 수 없는 오류'}`)
}

export function phoneCouplePort(client: Db): PhoneCouplePort {
  return {
    async findUserIds(email) {
      const want = email.toLowerCase()
      const ids: string[] = []
      for (let page = 1; ; page += 1) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) fail('인증 계정 조회 실패', error)
        const users: { id: string; email?: string | null }[] = data?.users ?? []
        for (const u of users) if ((u.email ?? '').toLowerCase() === want) ids.push(u.id)
        if (users.length < 1000) break
      }
      return ids
    },
    async couplesWithAnyMember(userIds) {
      const rows: PhoneCoupleRow[] = []
      for (const column of ['user_a_id', 'user_b_id']) {
        for (let i = 0; i < userIds.length; i += IN_CHUNK) {
          const { data, error } = await client
            .from('couples')
            .select('id, status, user_a_id, user_b_id')
            .in(column, userIds.slice(i, i + IN_CHUNK))
          if (error) fail('couples 조회 실패', error)
          rows.push(...((data ?? []) as PhoneCoupleRow[]))
        }
      }
      return rows
    },
  }
}

async function edge(client: Db, table: string, column: string, ascending: boolean, coupleId: string, extra?: (q: Db) => Db): Promise<string | null> {
  let q = client.from(table).select(column).eq('couple_id', coupleId).is('deleted_at', null).not(column, 'is', null)
  if (extra) q = extra(q)
  const { data, error } = await q.order(column, { ascending }).limit(1)
  if (error) fail(`${table} 조회 실패`, error)
  const v = (data ?? [])[0]?.[column]
  return typeof v === 'string' ? v : null
}

export function previewPort(client: Db): PreviewPort {
  return {
    async activityRange(coupleId): Promise<ActivityRange> {
      const days: string[] = []
      for (const asc of [true, false]) {
        const sent = await edge(client, 'messages', 'sent_at', asc, coupleId)
        if (sent !== null) days.push(kstDayOf(new Date(sent)))
        const dateOn = await edge(client, 'dates', 'date_on', asc, coupleId)
        if (dateOn !== null) days.push(dateOn.slice(0, 10))
        const captured = await edge(client, 'data_entries', 'captured_at', asc, coupleId, (q) => q.eq('entry_type', 'photo'))
        if (captured !== null) days.push(kstDayOf(new Date(captured)))
      }
      if (days.length === 0) return { first: null, last: null }
      days.sort()
      return { first: days[0], last: days[days.length - 1] }
    },
  }
}
