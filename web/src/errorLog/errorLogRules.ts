/**
 * 80- 앱 오류 기록의 규칙(순수 - 시각은 인자로 받는다). 서버(80-m1 `log_app_error`)의 허용 목록과 같은 값만 쓴다.
 *
 * - 보내는 값 = 화면 이름(라우트 이름 · 모르면 'unknown') · 오류 종류(아래 고정 값) · 앱 버전 · 플랫폼 · 건수. **메시지 · 스택 · 이름 · id는 어디에도 담지 않는다.**
 * - 기기 묶음 = (화면, 종류). 같은 묶음은 1시간에 한 번만 보낸다 - 그 사이 생긴 건수는 기기에서 세어 다음 전송에 합친다(건수만).
 * - 기기 전체로도 1시간에 30번까지만 보낸다(폭주 방어). 날짜는 서버가 정한다(보낸 날의 KST).
 */
import { ALL_ROUTES } from '../app/routes'

/** 오류 종류(서버 허용 목록과 같다 - `supabase/migrations/20261117120000_m1_app_error_log.sql`). */
export const ERROR_KINDS = [
  'uncaught', // 처리 안 된 예외(window error)
  'unhandled_rejection', // 처리 안 된 Promise 거부
  'render_crash', // 화면 그리기 오류 - 오류 경계(RenderGuard)가 대체 화면을 보였다
  'upload_fail', // 사진 올리기 실패(채팅 사진 · 이야기 큐 · 피드 기록)
  'queue_giveup', // 큐 재시도 한계 - 자동 재시도를 멈춤(채팅 글 · 사진)
  'push_register_fail', // 알림 토큰 등록 실패
  'cache_fail', // 기기 저장 실패(가득 참 · 막힘)
  'auth_return_fail', // 로그인 복귀(코드 교환) 실패
] as const
export type ErrorKind = (typeof ERROR_KINDS)[number]

export const UNKNOWN_SCREEN = 'unknown'
/** 서버가 받는 화면 이름 = 라우트 이름 + 'unknown'. */
export const ERROR_SCREENS: readonly string[] = [...ALL_ROUTES, UNKNOWN_SCREEN]

export const PER_BUCKET_INTERVAL_MS = 60 * 60 * 1000
export const HOURLY_SEND_CAP = 30
/** 한 번에 보내는 건수 상한(서버도 1~1000으로 자른다). 넘는 건수는 다음 전송으로 남는다. */
export const MAX_COUNT_PER_SEND = 1000
/** 기기에 모아 두는 묶음 하나의 건수 상한(오프라인이 길어도 저장이 커지지 않게). */
export const MAX_PENDING_PER_BUCKET = 10000

export interface PendingBucket {
  screen: string
  kind: ErrorKind
  /** 아직 보내지 않은 건수. */
  count: number
  /** 이 묶음을 마지막으로 보낸 시각(ms). */
  lastSentAt: number | null
}

export interface ErrorLogState {
  v: 1
  buckets: Record<string, PendingBucket>
  /** 최근 1시간 안에 보낸 시각들(전체 상한용). */
  sends: number[]
}

export const EMPTY_STATE: ErrorLogState = { v: 1, buckets: {}, sends: [] }

export function screenOf(name: string | null | undefined): string {
  return name && ERROR_SCREENS.includes(name) ? name : UNKNOWN_SCREEN
}

export function isErrorKind(k: unknown): k is ErrorKind {
  return typeof k === 'string' && (ERROR_KINDS as readonly string[]).includes(k)
}

export const bucketKey = (screen: string, kind: ErrorKind): string => `${screen}|${kind}`

/** 기기 저장에서 읽은 값이 모양에 맞는지 - 아니면 빈 상태(이상한 값은 보내지 않는다). */
export function sanitizeState(raw: unknown): ErrorLogState {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return { ...EMPTY_STATE, buckets: {}, sends: [] }
  const r = raw as { buckets?: unknown; sends?: unknown }
  const buckets: Record<string, PendingBucket> = {}
  if (r.buckets && typeof r.buckets === 'object') {
    for (const b of Object.values(r.buckets as Record<string, unknown>)) {
      const x = b as Partial<PendingBucket>
      if (!x || !isErrorKind(x.kind) || typeof x.screen !== 'string') continue
      const screen = screenOf(x.screen)
      const count = Number.isFinite(x.count) ? Math.max(0, Math.min(MAX_PENDING_PER_BUCKET, Math.floor(x.count as number))) : 0
      const lastSentAt = Number.isFinite(x.lastSentAt) ? (x.lastSentAt as number) : null
      buckets[bucketKey(screen, x.kind)] = { screen, kind: x.kind, count, lastSentAt }
    }
  }
  const sends = Array.isArray(r.sends) ? (r.sends as unknown[]).filter((t): t is number => Number.isFinite(t)).slice(-HOURLY_SEND_CAP) : []
  return { v: 1, buckets, sends }
}

/** 오류 한 건을 센다(화면 이름은 허용 목록으로 걸러 넣는다). */
export function addError(state: ErrorLogState, screen: string | null | undefined, kind: ErrorKind): ErrorLogState {
  const s = screenOf(screen)
  const key = bucketKey(s, kind)
  const prev = state.buckets[key]
  const count = Math.min(MAX_PENDING_PER_BUCKET, (prev?.count ?? 0) + 1)
  return { ...state, buckets: { ...state.buckets, [key]: { screen: s, kind, count, lastSentAt: prev?.lastSentAt ?? null } } }
}

export interface PlannedSend {
  key: string
  screen: string
  kind: ErrorKind
  count: number
}

/** 지금 보낼 것: 건수가 있고 · 그 묶음을 1시간 안에 보낸 적이 없고 · 전체 1시간 상한 안. 오래 기다린 묶음부터. */
export function planSends(state: ErrorLogState, now: number): PlannedSend[] {
  const recent = state.sends.filter((t) => now - t < PER_BUCKET_INTERVAL_MS && t <= now).length
  const room = Math.max(0, HOURLY_SEND_CAP - recent)
  if (room === 0) return []
  return Object.entries(state.buckets)
    .filter(([, b]) => b.count > 0 && (b.lastSentAt === null || now - b.lastSentAt >= PER_BUCKET_INTERVAL_MS || b.lastSentAt > now))
    .sort(([, a], [, b]) => (a.lastSentAt ?? 0) - (b.lastSentAt ?? 0))
    .slice(0, room)
    .map(([key, b]) => ({ key, screen: b.screen, kind: b.kind, count: Math.min(b.count, MAX_COUNT_PER_SEND) }))
}

/** 보냈음: 보낸 건수만 빼고 · 그 묶음 시각 · 전체 전송 시각을 남긴다. 다 보낸 묶음은 지운다(다음 오류 때 lastSentAt 이 남도록 시각만 둔다). */
export function markSent(state: ErrorLogState, key: string, count: number, now: number): ErrorLogState {
  const b = state.buckets[key]
  if (!b) return state
  const sends = [...state.sends.filter((t) => now - t < PER_BUCKET_INTERVAL_MS && t <= now), now]
  return { ...state, sends, buckets: { ...state.buckets, [key]: { ...b, count: Math.max(0, b.count - count), lastSentAt: now } } }
}

/** 1시간 넘게 지났고 남은 건수가 0인 묶음은 지운다(저장이 계속 커지지 않게). */
export function prune(state: ErrorLogState, now: number): ErrorLogState {
  const buckets: Record<string, PendingBucket> = {}
  for (const [k, b] of Object.entries(state.buckets)) {
    if (b.count > 0 || (b.lastSentAt !== null && now - b.lastSentAt < PER_BUCKET_INTERVAL_MS)) buckets[k] = b
  }
  return { ...state, buckets, sends: state.sends.filter((t) => now - t < PER_BUCKET_INTERVAL_MS && t <= now) }
}

/** 앱 버전 형식(서버와 같은 규칙 - 밖이면 서버가 'other'로 바꾼다). */
export function versionForLog(v: string): string {
  return /^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$/.test(v) && v.length <= 20 ? v : 'other'
}

export function platformForLog(p: string): 'android' | 'ios' | 'web' {
  return p === 'android' || p === 'ios' ? p : 'web'
}

/**
 * 큐 재시도 한계(`queue_giveup`) 세기: 자동 재시도를 멈춘(failed) 항목 하나당 한 번.
 * 기기에서 읽어 온 항목 중 이미 멈춰 있던 것(지난 실행에서 센 것)은 `prime`으로 빼 둔다.
 */
export function makeGiveUpTracker(): {
  prime: (items: readonly { id: string; failed: boolean }[]) => void
  observe: (items: readonly { id: string; failed: boolean }[]) => number
} {
  const counted = new Set<string>()
  return {
    prime(items) {
      for (const it of items) if (it.failed) counted.add(it.id)
    },
    observe(items) {
      let n = 0
      for (const it of items) {
        if (it.failed && !counted.has(it.id)) { counted.add(it.id); n += 1 }
      }
      return n
    },
  }
}
