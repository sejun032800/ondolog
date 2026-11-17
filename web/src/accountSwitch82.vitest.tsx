/**
 * 82-(R120-4 · R120-2) 계정 전환 대기열 규칙 + 채팅 진입 때 서랍 알림 지우기 시험.
 *  - 1단계 판정 재현: 이전 사람(A) 글 대기열을 둔 채 같은 커플의 B가 로그인 -> 보내기 호출 0(82- 이전 코드에서는 A 이름으로 1번 시도했다)
 *  - A 대기열 남김 -> 로그아웃 -> B 로그인 -> 전송 0 · A 항목 0 · A 사진 파일 0 / A 재로그인 -> 이어서 각 1번 / 표시 없는 항목 -> 지금 주인으로 붙어 정상 전송
 *  - 로그아웃 문구 4갈래 · 채팅 진입 -> 그 커플 메시지 알림만 지움
 * 원격 0(가짜 Preferences · 가짜 파일 · 가짜 알림 다리).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { Preferences } from '@capacitor/preferences'
import type { QueuedMessage } from '@/utils/chatQueue'
import type { QueuedPhoto } from '@/utils/chatPhotoQueue'
import type { AttemptedPhoto, PhotoFs } from '@/services/chatPhotoCore'
import { setSupabaseForTest } from './auth/client'
import { useAuthStore } from './auth/stores'
import { useAccountData } from './app/useAccountData'
import { clearAppErrorCounts, ERROR_LOG_KEY } from './errorLog/errorLog'
import { resetCacheFailMemoryForTest } from './cache/deviceCache'
import { photoKeyUser, purgeOtherOwners, queueOwnerPurgeDone, startQueueOwnerPurge, type OwnerPurgeDeps, type PrefsAllLike } from './cache/queueOwner'
import { resetQueueHoldForTest } from './cache/queueStorage'
import { TextQueueHub, createTextQueueStore } from './features/chat/textQueueHub'
import { LOGOUT_KEPT_NOTE, LOGOUT_QUEUED_NOTE, LOGOUT_SWITCH_NOTE, countUnsentMessages, logoutNotes } from './features/settings/unsentCount'
import { PhotoQueueHub } from './photoQueue/photoQueueHub'
import { createPhotoQueueStore } from './photoQueue/photoQueueStore'
import { clearCoupleMessageNoticesHere } from './push/pushCore'
import { isCoupleMessageNotice, setPushPortForTest, webPushPort, type DeliveredNotice, type PushPort } from './push/pushPort'
import { useCoupleStore } from './stores/coupleStore'
import { ChatTab } from './tabs/ChatTab'
import { makeFakeBridge } from './testSupport'
import { CHAT_PROFILES, makeChatWorld } from './features/chat/chatTestSupport'
import { burstTag, pushTag } from '../../supabase/functions/_shared/pushSend'

const A = 'user-a'
const B = 'user-b'
const NOW = new Date('2026-11-17T03:00:00Z')

function memPrefs(init: Record<string, string> = {}): PrefsAllLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  return {
    data,
    get: async ({ key: k }) => ({ value: data.get(k) ?? null }),
    set: async ({ key: k, value }) => { data.set(k, value) },
    remove: async ({ key: k }) => { data.delete(k) },
    keys: async () => ({ keys: [...data.keys()] }),
  }
}
const textItem = (id: string, owner: string): QueuedMessage => ({ clientMsgId: id, coupleId: 'c1', senderId: owner, body: `글 ${id}`, sentAt: '2026-11-16T00:00:00Z', retryCount: 0, status: 'pending' })
const photoItem = (id: string, owner: string): QueuedPhoto => ({ clientId: id, kind: 'message', coupleId: 'c1', userId: owner, localUri: `chat-photo-queue/${id}.jpg`, ext: 'jpg', contentType: 'image/jpeg', sentAt: '2026-11-16T00:00:00Z', retryCount: 0, status: 'pending' })
const v1 = (items: unknown[]) => JSON.stringify({ __v: 1, items })

/** 사진 파일(가짜) - 지운 것 기록. */
function memFs(paths: string[]): PhotoFs & { files: Set<string>; removed: string[] } {
  const files = new Set(paths)
  const removed: string[] = []
  return {
    files,
    removed,
    copyIn: async (_s, id, ext) => { const p = `chat-photo-queue/${id}.${ext}`; files.add(p); return p },
    exists: async (u) => files.has(u),
    readBytes: async () => new ArrayBuffer(1),
    remove: async (u) => { removed.push(u); files.delete(u) },
  }
}

function errorCount(): number {
  const raw = localStorage.getItem(ERROR_LOG_KEY)
  if (!raw) return 0
  const st = JSON.parse(raw) as { buckets: Record<string, { count: number }> }
  return Object.values(st.buckets).reduce((n, b) => n + b.count, 0)
}

/** 허브 둘(글 · 사진) - 지금 세션 사용자는 `useAuthStore`(앱과 같은 연결). 보낸 것 기록. */
function hubsOn(prefs: PrefsAllLike, fs: PhotoFs) {
  const sentText: { id: string; sender: string }[] = []
  const sentPhoto: { id: string; owner: string }[] = []
  const session = () => useAuthStore.getState().userId
  const text = new TextQueueHub({
    send: async (input) => { sentText.push({ id: input.clientMsgId, sender: input.senderId }); return { status: 'sent', row: { id: `r-${input.clientMsgId}`, client_msg_id: input.clientMsgId } as never } },
    store: createTextQueueStore(prefs, () => NOW),
    sessionUserId: session,
  })
  const photo = new PhotoQueueHub({
    attempt: async (item) => { sentPhoto.push({ id: item.clientId, owner: item.userId }); return { outcome: 'done' } as AttemptedPhoto },
    fs,
    store: createPhotoQueueStore(prefs, () => NOW),
    sessionUserId: session,
  })
  return { text, photo, sentText, sentPhoto }
}

const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  localStorage.clear()
  clearAppErrorCounts()
  resetCacheFailMemoryForTest()
  resetQueueHoldForTest()
  setSupabaseForTest(null)
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  setPushPortForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

describe('82- 1단계 판정 재현: 이전 사람(A) 글 대기열을 둔 채 같은 커플의 B가 로그인', () => {
  it('B 세션으로 붙은 허브가 A 항목을 보내려 하지 않는다(보내기 호출 0) - 82- 이전에는 A 이름으로 1번 시도', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': v1([textItem('a1', A)]) })
    const sent: string[] = []
    useAuthStore.getState().setUserId(B)
    // 정리(③) 없이 읽기 막음(②)만으로도 0인지 - 앱 허브와 달리 세션 확인 칸도 주지 않는다.
    const hub = new TextQueueHub({
      send: async (input) => { sent.push(input.clientMsgId); return { status: 'failed', errorClass: 'permanent', error: { code: '42501' } } },
      store: createTextQueueStore(prefs, () => NOW),
    })
    hub.attach('c1', B)
    await settle()
    expect(hub.getTextQueue()?.getQueue()).toEqual([])
    hub.detach()
    expect(sent).toEqual([])
  })

  it('보내기 막음(②): 큐에 들어온 항목이라도 주인 ≠ 지금 세션이면 서버를 부르지 않는다(글 · 사진)', async () => {
    const prefs = memPrefs()
    const fs = memFs(['chat-photo-queue/pa.jpg'])
    const h = hubsOn(prefs, fs)
    useAuthStore.getState().setUserId(B)
    expect(await h.text.attemptText(textItem('a1', A))).toEqual({ outcome: 'failed', errorClass: 'retryable' })
    h.photo.attach('c1', B)
    await settle()
    await h.photo.getPhotoQueue()!.add(photoItem('pa', A))
    await settle()
    h.photo.detach()
    expect(h.sentText).toEqual([])
    expect(h.sentPhoto).toEqual([])
    expect(errorCount()).toBe(0)
  })
})

describe('82- 계정 전환(R120-4): A 대기열 남김 -> 로그아웃 -> B 로그인', () => {
  function seedA() {
    const prefs = memPrefs({
      'chat_queue:c1': v1([textItem('a1', A), textItem('b0', B)]), // 같은 커플 키 - B 것은 남아야 한다
      'chat_photo_queue:c1:user-a': v1([photoItem('pa', A)]),
      'chat_queue:c-old': JSON.stringify([textItem('a2', A)]), // 81- 이전 모양(배열) · 다른 커플
      'chat_photo_queue:c1:user-b': v1([photoItem('pb', B)]),
      unrelated: 'x',
    })
    const fs = memFs(['chat-photo-queue/pa.jpg', 'chat-photo-queue/pb.jpg'])
    return { prefs, fs, deps: { prefs, removeFile: (u: string) => fs.remove(u) } as OwnerPurgeDeps }
  }

  it('B 로그인 순간 정리 -> A 항목 0 · A 사진 파일 0 · B 항목 그대로 · 전송은 B 것만 · 오류 기록 0', async () => {
    const { prefs, fs, deps } = seedA()
    useAuthStore.getState().setUserId(B)
    expect(await startQueueOwnerPurge(B, deps)).toBe(3) // a1 · a2 · pa
    expect(JSON.parse(prefs.data.get('chat_queue:c1')!).items.map((i: QueuedMessage) => i.clientMsgId)).toEqual(['b0'])
    expect(prefs.data.has('chat_queue:c-old')).toBe(false)
    expect(prefs.data.has('chat_photo_queue:c1:user-a')).toBe(false)
    expect(fs.files.has('chat-photo-queue/pa.jpg')).toBe(false)
    expect(fs.files.has('chat-photo-queue/pb.jpg')).toBe(true)
    expect(prefs.data.get('unrelated')).toBe('x')

    const h = hubsOn(prefs, fs)
    h.text.attach('c1', B)
    h.photo.attach('c1', B)
    await waitFor(() => expect(h.sentText.map((s) => s.id)).toEqual(['b0']))
    await waitFor(() => expect(h.sentPhoto.map((s) => s.id)).toEqual(['pb']))
    h.text.detach(); h.photo.detach()
    expect(h.sentText.every((s) => s.sender === B) && h.sentPhoto.every((s) => s.owner === B)).toBe(true)
    expect(errorCount()).toBe(0)
  })

  it('정리와 읽기가 겹쳐도: 대기열 읽기는 정리가 끝난 뒤(정리 중 붙은 허브도 A 항목 0)', async () => {
    const { prefs, fs, deps } = seedA()
    let release!: () => void
    const slow: OwnerPurgeDeps = { ...deps, prefs: { ...prefs, keys: async () => { await new Promise<void>((r) => { release = r }); return prefs.keys() } } }
    useAuthStore.getState().setUserId(B)
    const purging = startQueueOwnerPurge(B, slow)
    const h = hubsOn(prefs, fs)
    h.text.attach('c1', B)
    await settle()
    expect(h.sentText).toEqual([]) // 정리 전에는 읽지 않는다
    release()
    await purging
    await waitFor(() => expect(h.sentText.map((s) => s.id)).toEqual(['b0']))
    h.text.detach()
  })

  it('앱 경로: useAccountData(B 로그인) -> 기기 Preferences의 A 대기열 0 · B 것 남음', async () => {
    await Preferences.set({ key: 'chat_queue:c1', value: v1([textItem('a1', A), textItem('b0', B)]) })
    await Preferences.set({ key: 'chat_photo_queue:c1:user-a', value: v1([photoItem('pa', A)]) })
    useAuthStore.getState().setUserId(B)
    renderHook(() => useAccountData(null))
    await waitFor(async () => expect(JSON.parse((await Preferences.get({ key: 'chat_queue:c1' })).value!).items).toHaveLength(1))
    await queueOwnerPurgeDone()
    expect(JSON.parse((await Preferences.get({ key: 'chat_queue:c1' })).value!).items[0].senderId).toBe(B)
    expect((await Preferences.get({ key: 'chat_photo_queue:c1:user-a' })).value).toBeNull()
    await Preferences.remove({ key: 'chat_queue:c1' })
  })

  it('같은 계정 재로그인(R39-5 b): A 로그아웃 -> A 재로그인 -> 지울 것 0 · 글 · 사진 이어서 각 1번', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': v1([textItem('a1', A)]), 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A)]) })
    const fs = memFs(['chat-photo-queue/pa.jpg'])
    useAuthStore.getState().setUserId(A)
    expect(await startQueueOwnerPurge(A, { prefs, removeFile: (u) => fs.remove(u) })).toBe(0)
    const h = hubsOn(prefs, fs)
    h.text.attach('c1', A)
    h.photo.attach('c1', A)
    await waitFor(() => expect(h.sentText).toEqual([{ id: 'a1', sender: A }]))
    await waitFor(() => expect(h.sentPhoto).toEqual([{ id: 'pa', owner: A }]))
    await settle()
    h.text.detach(); h.photo.detach()
    expect(h.sentText).toHaveLength(1)
    expect(h.sentPhoto).toHaveLength(1)
  })

  it('표시 없는 기존 항목(사진 `userId` 없음) -> 처음 읽을 때의 세션 주인으로 붙음 -> 정상 전송 · 다른 계정 로그인 때는 키 주인으로 판정해 지움', async () => {
    const { userId: _drop, ...noOwner } = photoItem('px', A)
    void _drop
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': v1([noOwner]) })
    const fs = memFs(['chat-photo-queue/px.jpg'])
    useAuthStore.getState().setUserId(A)
    const h = hubsOn(prefs, fs)
    h.photo.attach('c1', A)
    await waitFor(() => expect(h.sentPhoto).toEqual([{ id: 'px', owner: A }]))
    h.photo.detach()
    // 같은 모양을 B 로그인 때 만나면 키 주인(A) 것이라 지운다.
    const prefs2 = memPrefs({ 'chat_photo_queue:c1:user-a': v1([noOwner]) })
    const fs2 = memFs(['chat-photo-queue/px.jpg'])
    expect(await purgeOtherOwners(B, { prefs: prefs2, removeFile: (u) => fs2.remove(u) })).toBe(1)
    expect(fs2.files.size).toBe(0)
    expect(photoKeyUser('chat_photo_queue:c1:user-a')).toBe(A)
  })

  it('세션이 없으면 아무것도 읽지 않는다(보내지 않음 - 다음 로그인 때 판정) · 저장값은 그대로', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': v1([textItem('a1', A)]) })
    expect(await createTextQueueStore(prefs, () => NOW).load('c1')).toEqual([])
    expect(JSON.parse(prefs.data.get('chat_queue:c1')!).items).toHaveLength(1)
  })

  it('읽을 수 없는 저장값: 다른 사용자 사진 키는 지움 · 주인을 모르는 글 키는 그대로(보내지 않는 원본)', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': '{깨짐', 'chat_queue:c1': '{깨짐' })
    expect(await purgeOtherOwners(B, { prefs, removeFile: () => undefined })).toBe(1)
    expect(prefs.data.has('chat_photo_queue:c1:user-a')).toBe(false)
    expect(prefs.data.get('chat_queue:c1')).toBe('{깨짐')
  })

  it('저장소가 막혀도 던지지 않는다(0)', async () => {
    const broken: PrefsAllLike = { get: async () => { throw new Error('x') }, set: async () => { throw new Error('x') }, remove: async () => { throw new Error('x') }, keys: async () => { throw new Error('x') } }
    await expect(purgeOtherOwners(B, { prefs: broken, removeFile: () => undefined })).resolves.toBe(0)
  })
})

describe('82- 로그아웃 확인 문구(R119-2 순서 + 계정 전환 줄)', () => {
  it('4갈래: 대기열만 · 원본만 · 둘 다 · 없음', () => {
    expect(logoutNotes({ queued: 2, kept: 0 })).toEqual([LOGOUT_QUEUED_NOTE(2), LOGOUT_SWITCH_NOTE])
    expect(logoutNotes({ queued: 0, kept: 1 })).toEqual([LOGOUT_KEPT_NOTE(1)])
    expect(logoutNotes({ queued: 1, kept: 3 })).toEqual([LOGOUT_QUEUED_NOTE(1), LOGOUT_SWITCH_NOTE, LOGOUT_KEPT_NOTE(3)])
    expect(logoutNotes({ queued: 0, kept: 0 })).toEqual([])
    expect(LOGOUT_SWITCH_NOTE).toBe('다른 계정으로 로그인하면 이 폰에서 사라져요.')
  })

  it('수는 이 사용자가 주인인 항목만(같은 커플 글 키에 상대 항목이 있어도)', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': v1([textItem('a1', A), textItem('b1', B), textItem('b2', B)]) })
    expect(await countUnsentMessages(B, 'c1', prefs)).toEqual({ queued: 2, kept: 0 })
    expect(await countUnsentMessages(A, 'c1', prefs)).toEqual({ queued: 1, kept: 0 })
  })
})

describe('82- 채팅 진입 때 서랍 알림 지우기(R120-2)', () => {
  const C1 = '11111111-2222-3333-4444-555555555555'
  const C2 = '99999999-2222-3333-4444-555555555555'
  function port(delivered: DeliveredNotice[]) {
    const removed: DeliveredNotice[][] = []
    const clearAll = vi.fn(async () => {})
    const p: PushPort = {
      ...webPushPort,
      clearDelivered: clearAll,
      listDelivered: async () => delivered.filter((d) => !removed.flat().includes(d)),
      removeDelivered: async (list) => { removed.push(list) },
    }
    return { p, removed, clearAll }
  }
  const drawer: DeliveredNotice[] = [
    { id: 1, tag: `ondolog-m-${C1}` }, // 묶음 이름(78-)
    { id: 2, tag: `ondolog-m-${C1}-t5k2a1` }, // 81-b 다시 울림 태그
    { id: 3, tag: `ondolog-c-d-${C1}` }, // 변경 안내 - 남김
    { id: 4, tag: `ondolog-m-${C2}` }, // 다른 커플 - 남김
    { id: 5, tag: 'other-app' }, // 다른 앱 - 남김
    { id: 6, tag: null },
  ]

  it('그 커플 메시지 알림만 지움(변경 안내 · 다른 커플 · 다른 앱 남음) · 두 번 들어가도 오류 0 · 모두 지우기 0', async () => {
    const { p, removed, clearAll } = port(drawer)
    setPushPortForTest(p)
    expect(await clearCoupleMessageNoticesHere(C1)).toBe(2)
    expect(removed).toEqual([[drawer[0], drawer[1]]])
    expect(await clearCoupleMessageNoticesHere(C1)).toBe(0)
    expect(removed).toHaveLength(1)
    expect(clearAll).not.toHaveBeenCalled()
  })

  it('서버 태그와 맞물림: pushTag · burstTag(메시지) = 지움 / 변경 안내 = 남김', () => {
    expect(isCoupleMessageNotice({ id: 1, tag: pushTag('message', C1) }, C1)).toBe(true)
    expect(isCoupleMessageNotice({ id: 1, tag: burstTag('message', C1, Date.parse('2026-11-17T03:00:00Z')) }, C1)).toBe(true)
    expect(isCoupleMessageNotice({ id: 1, tag: pushTag('date', C1) }, C1)).toBe(false)
    expect(isCoupleMessageNotice({ id: 1, tag: burstTag('nickname', C1, 0) }, C1)).toBe(false)
    expect(isCoupleMessageNotice({ id: 1, tag: pushTag('message', C2) }, C1)).toBe(false)
  })

  it('채팅 탭 진입(연결된 커플) -> 그 커플 메시지 알림만 지움 · 탭을 다시 열어도 오류 0', async () => {
    const { p, removed, clearAll } = port(drawer)
    setPushPortForTest(p)
    useAuthStore.getState().setUserId('me')
    useCoupleStore.setState({ status: 'connected', coupleId: C1, partnerId: 'you', relationshipStartDate: '2025-12-28' })
    const couples = [{ id: C1, status: 'active', user_a_id: 'me', user_b_id: 'you', nickname: null, relationship_start_date: '2025-12-28', reference_photo_path: null }]
    const w = makeChatWorld({ profiles: CHAT_PROFILES, couples })
    const first = render(<ChatTab bridge={makeFakeBridge()} hubs={w.hubs} />)
    await waitFor(() => expect(removed).toEqual([[drawer[0], drawer[1]]]))
    first.unmount()
    render(<ChatTab bridge={makeFakeBridge()} hubs={w.hubs} />)
    await settle()
    expect(removed).toHaveLength(1) // 이미 지워 남은 것 0 - 다시 지울 것 없음
    expect(clearAll).not.toHaveBeenCalled()
  })

  it('미연결로 채팅 탭에 들어오면 지우지 않는다', async () => {
    const { p, removed } = port(drawer)
    setPushPortForTest(p)
    useAuthStore.getState().setUserId('me')
    useCoupleStore.setState({ status: 'disconnected', coupleId: null })
    const w = makeChatWorld({ profiles: CHAT_PROFILES, couples: [] })
    render(<ChatTab bridge={makeFakeBridge()} hubs={w.hubs} />)
    await settle()
    expect(removed).toEqual([])
  })

  it('iOS 모양(태그 없음 · 요청 식별자 = apns-collapse-id)도 같은 규칙', () => {
    expect(isCoupleMessageNotice({ id: `ondolog-m-${C1}-t5k2a1` }, C1)).toBe(true)
    expect(isCoupleMessageNotice({ id: `ondolog-c-n-${C1}` }, C1)).toBe(false)
  })

  it('다리가 목록 · 골라 지우기를 못 하면 아무것도 하지 않음("모두 지우기"로 대체 0) · 던지는 다리도 0', async () => {
    const clearAll = vi.fn(async () => {})
    setPushPortForTest({ ...webPushPort, clearDelivered: clearAll })
    expect(await clearCoupleMessageNoticesHere(C1)).toBe(0)
    setPushPortForTest({ ...webPushPort, clearDelivered: clearAll, listDelivered: async () => { throw new Error('x') }, removeDelivered: async () => {} })
    expect(await clearCoupleMessageNoticesHere(C1)).toBe(0)
    expect(clearAll).not.toHaveBeenCalled()
  })
})
