/**
 * 78- 푸시 플러그인 다리(`@capacitor/push-notifications`) - 화면 · 훅은 Capacitor를 직접 부르지 않는다(시험에서 바꿔 끼운다, `platform/bridge.ts`와 같은 방식).
 * Android만 구현(실제 커플은 iPhone - iOS는 같은 다리에 APNs 등록만 더하면 된다: 플러그인이 같은 API, 서버는 FCM V1 하나).
 * 웹(개발 서버)에서는 아무 일도 하지 않는 다리(`webPushPort`) - 권한 `unsupported`.
 * 토큰 값은 이 파일 밖으로 서버 등록에만 간다(로그 · 화면 0).
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'
export type PushRoute = 'chat' | 'main'

/** 앱이 받은 알림(앞에 있을 때) · 누른 알림에서 쓰는 것만. */
export interface PushNotice {
  body: string
  kind: string
  route: PushRoute
}

export interface PushPort {
  platform: 'android' | 'ios' | null
  checkPermission(): Promise<PushPermission>
  requestPermission(): Promise<PushPermission>
  /** 토큰은 `onRegistration`으로 온다(이미 있으면 같은 값이 다시 온다 - 갱신 경로). */
  register(): Promise<void>
  /** 이 기기의 FCM 토큰을 없앤다(로그아웃 등). 서버 행을 못 지웠어도 FCM이 "등록 안 된 토큰"이라 해 발송 함수가 지운다. */
  unregister(): Promise<void>
  /** Android 알림 채널(메시지 · 변경 안내). 서버 `PUSH_CHANNEL`과 같은 id. */
  createChannels(): Promise<void>
  onRegistration(cb: (token: string) => void): () => void
  /** 앱이 앞에 있을 때 온 알림(OS 알림은 뜨지 않는다 - `presentationOptions: []`). */
  onReceived(cb: (n: PushNotice) => void): () => void
  /** 알림을 눌러 앱이 열렸다(꺼져 있었어도 · 뒤에 있었어도). */
  onAction(cb: (route: PushRoute) => void): () => void
}

/** 서버(`supabase/functions/_shared/pushSend.ts`)와 같은 값. */
export const PUSH_CHANNELS = [
  { id: 'ondolog_messages', name: '메시지', description: '상대가 보낸 메시지', importance: 4 as const },
  { id: 'ondolog_changes', name: '변경 안내', description: '사귄 날짜 · 커플 닉네임 변경', importance: 3 as const },
]

export function routeOf(data: unknown): PushRoute {
  const r = (data as { route?: unknown } | null)?.route
  return r === 'chat' ? 'chat' : 'main'
}

function toNotice(n: { body?: string; data?: unknown }): PushNotice {
  const kind = String((n.data as { kind?: unknown } | null)?.kind ?? '')
  return { body: n.body ?? '', kind, route: routeOf(n.data) }
}

function mapPermission(p: string): PushPermission {
  if (p === 'granted') return 'granted'
  if (p === 'denied') return 'denied'
  return 'prompt' // prompt · prompt-with-rationale
}

function listen<T>(event: 'registration' | 'pushNotificationReceived' | 'pushNotificationActionPerformed', cb: (v: T) => void): () => void {
  let removed = false
  let handle: { remove: () => Promise<void> } | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (PushNotifications.addListener as any)(event, cb).then((h: { remove: () => Promise<void> }) => {
    if (removed) void h.remove()
    else handle = h
  })
  return () => {
    removed = true
    if (handle) void handle.remove()
  }
}

export const capacitorPushPort: PushPort = {
  platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
  checkPermission: async () => mapPermission((await PushNotifications.checkPermissions()).receive),
  requestPermission: async () => mapPermission((await PushNotifications.requestPermissions()).receive),
  register: () => PushNotifications.register(),
  unregister: () => PushNotifications.unregister(),
  createChannels: async () => {
    if (Capacitor.getPlatform() !== 'android') return
    for (const c of PUSH_CHANNELS) await PushNotifications.createChannel({ id: c.id, name: c.name, description: c.description, importance: c.importance, visibility: 0 })
  },
  onRegistration: (cb) => listen<{ value: string }>('registration', (t) => cb(t.value)),
  onReceived: (cb) => listen<{ body?: string; data?: unknown }>('pushNotificationReceived', (n) => cb(toNotice(n))),
  onAction: (cb) => listen<{ notification: { data?: unknown } }>('pushNotificationActionPerformed', (a) => cb(routeOf(a.notification?.data))),
}

const noop = () => () => {}
export const webPushPort: PushPort = {
  platform: null,
  checkPermission: async () => 'unsupported',
  requestPermission: async () => 'unsupported',
  register: async () => {},
  unregister: async () => {},
  createChannels: async () => {},
  onRegistration: noop,
  onReceived: noop,
  onAction: noop,
}

let current: PushPort | undefined
export function getPushPort(): PushPort {
  if (!current) current = Capacitor.isNativePlatform() ? capacitorPushPort : webPushPort
  return current
}
/** 시험 전용. undefined면 기본으로 돌아간다. */
export function setPushPortForTest(port: PushPort | undefined): void {
  current = port
}
