/**
 * 78- 푸시 - 이 기기 값 · 서버 호출 · 앱 안 상태(R100-4 · R109-1).
 *
 * 이 기기 값(`localStorage`, 기기 저장 `ondolog.dc1:` 밖 - 로그아웃에도 남는다. 사람 id · 토큰은 없다):
 *   - 기기 id: 앱이 만든 무작위 값(`crypto.randomUUID`). 서버 토큰 행의 "기기" 칸. 계정 전환 때 이전 사람 행을 가르는 열쇠.
 *   - 등록 표시: 이 기기가 서버에 토큰 행을 남겼다(값 '1'). 지우는 자리가 여러 번 불려도 한 번만 일하게.
 * 서버(78-m1): `push_register`(토큰 저장 · 갱신) · `push_claim_device`(계정 전환) · `push_tokens` 이 기기 행 삭제(본인 RLS) · `notification_settings`(H10).
 * 토큰 삭제 자리(76- 기기 저장 삭제와 같은 자리, `forgetThisDevicePush`): 로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 유예 / 완료(커플이 더는 active 아님) + 계정 전환(`claimThisDevice`).
 *   삭제는 서버 행 + FCM 토큰 없애기(`unregister`) 둘 다 - 오프라인이라 행을 못 지워도 FCM이 "등록 안 된 토큰"이라 해 발송 함수가 지운다.
 * 76-i (R111-2): 같은 5자리에서 **먼저** 이 기기 알림 서랍의 온도록 알림을 모두 지운다(`clearDeliveredHere`) - 남은 알림에 상대 이름이 보이지 않게.
 *   순서: 서랍 지우기 -> 토큰 삭제 -> 세션 지우기(로그아웃). 하나가 실패해도 나머지는 진행. 웹 미리보기 · 플러그인 없음이면 조용히 0.
 */
import { create } from 'zustand'
import { getSupabase } from '../auth/client'
import { getPushPort, type PushNotice, type PushPermission, type PushRoute } from './pushPort'

const DEVICE_KEY = 'ondolog.push.device'
const REGISTERED_KEY = 'ondolog.push.registered'

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // 아래로
  }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/** 이 기기의 id(없으면 만든다). 저장이 막혀도 이 실행 동안은 같은 값. */
let memoryDeviceId: string | null = null
export function deviceId(): string {
  const s = store()
  try {
    const saved = s?.getItem(DEVICE_KEY)
    if (saved && saved.length >= 8) return saved
  } catch {
    // 아래로
  }
  memoryDeviceId ??= randomId()
  try {
    s?.setItem(DEVICE_KEY, memoryDeviceId)
  } catch {
    // 막힘 - 메모리 값으로
  }
  return memoryDeviceId
}

export function isRegisteredHere(): boolean {
  try {
    return store()?.getItem(REGISTERED_KEY) === '1'
  } catch {
    return false
  }
}
function setRegisteredHere(on: boolean): void {
  try {
    if (on) store()?.setItem(REGISTERED_KEY, '1')
    else store()?.removeItem(REGISTERED_KEY)
  } catch {
    // 막힘
  }
}

type LooseDb = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}
const loose = (): LooseDb | null => getSupabase() as unknown as LooseDb | null

/** 오프라인에서 로그아웃이 멈추지 않게 - 이 시간 안에 안 끝나면 넘어간다. */
export const PUSH_SERVER_TIMEOUT_MS = 3000
function withTimeout<T>(p: PromiseLike<T>, ms = PUSH_SERVER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/** 토큰을 서버에 둔다(같은 기기면 갱신). 성공하면 등록 표시. */
export async function registerToken(token: string, platform: 'android' | 'ios'): Promise<boolean> {
  const db = loose()
  if (!db || !token) return false
  try {
    const { error } = await withTimeout(db.rpc('push_register', { p_device_id: deviceId(), p_token: token, p_platform: platform }))
    if (error) return false
    setRegisteredHere(true)
    return true
  } catch {
    return false
  }
}

/** 계정 전환: 이 기기에 남은 다른 사람의 토큰 행을 지운다(서버 RPC). 실패는 조용히(다음 로그인 · 등록이 다시 정리). */
export async function claimThisDevice(): Promise<void> {
  const db = loose()
  if (!db) return
  try {
    await withTimeout(db.rpc('push_claim_device', { p_device_id: deviceId() }))
  } catch {
    // 다음 기회
  }
}

/** 76-i: 이 기기 알림 서랍의 온도록 알림을 모두 지운다. 실패 · 미지원은 조용히(던지지 않는다). */
export async function clearDeliveredHere(): Promise<void> {
  try {
    await getPushPort().clearDelivered()
  } catch {
    // 미지원 · 막힘 - 다음 단계는 그대로
  }
}

/**
 * 이 기기 토큰 삭제(로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 유예 / 완료). 이 기기가 등록한 적이 없으면 아무 일도 없다(여러 번 불려도 한 번).
 * 서버 행(본인 RLS) -> FCM 토큰 없애기. 서버가 실패 · 시간 초과여도 FCM 토큰은 없앤다.
 */
export async function forgetThisDevicePush(): Promise<void> {
  // 76-i: 서랍 먼저 - 등록 표시가 없어도(이미 한 번 지웠어도) 남은 알림은 지운다.
  await clearDeliveredHere()
  if (!isRegisteredHere()) return
  setRegisteredHere(false)
  const db = loose()
  if (db) {
    try {
      await withTimeout(db.from('push_tokens').delete().eq('device_id', deviceId()))
    } catch {
      // FCM 토큰 없애기로 막는다
    }
  }
  try {
    await getPushPort().unregister()
  } catch {
    // 막힘
  }
}

// ── H10 알림 설정 ─────────────────────────────────────────────────────────────────────────────────

export interface NotifySettings {
  messages: boolean
  changes: boolean
}
/** 행이 없으면 둘 다 켬(78-m1 기본). */
export const DEFAULT_NOTIFY: NotifySettings = { messages: true, changes: true }

export async function readNotifySettings(userId: string): Promise<NotifySettings> {
  const db = loose()
  if (!db) throw new Error('no client')
  const { data, error } = await db.from('notification_settings').select('messages, changes').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return DEFAULT_NOTIFY
  return { messages: data.messages !== false, changes: data.changes !== false }
}

export async function saveNotifySettings(userId: string, next: NotifySettings): Promise<void> {
  const db = loose()
  if (!db) throw new Error('no client')
  const { error } = await db.from('notification_settings').upsert({ user_id: userId, messages: next.messages, changes: next.changes }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── 앱 안 상태(I07 띠 · 누른 알림의 갈 곳 · 권한) ───────────────────────────────────────────────────

export interface PushUiState {
  /** I07: 앱이 앞에 있을 때 온 알림 하나(새 것이 오면 바꿔 끼운다). */
  band: (PushNotice & { at: number }) | null
  /** 알림을 눌러 앱이 열렸을 때 갈 곳 - 로그인 · 시작이 끝난 뒤 한 번만 쓴다. */
  pendingRoute: PushRoute | null
  permission: PushPermission | null
  showBand: (n: PushNotice) => void
  clearBand: () => void
  setPending: (r: PushRoute | null) => void
  takePending: () => PushRoute | null
  setPermission: (p: PushPermission | null) => void
  reset: () => void
}

export const usePushStore = create<PushUiState>((set, get) => ({
  band: null,
  pendingRoute: null,
  permission: null,
  showBand: (n) => set({ band: { ...n, at: Date.now() } }),
  clearBand: () => set({ band: null }),
  setPending: (r) => set({ pendingRoute: r }),
  takePending: () => {
    const r = get().pendingRoute
    if (r) set({ pendingRoute: null })
    return r
  },
  setPermission: (p) => set({ permission: p }),
  reset: () => set({ band: null, pendingRoute: null, permission: null }),
}))
