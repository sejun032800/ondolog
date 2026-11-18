/**
 * 83- 덧붙임(81-b 폰 확인 11번): 비행기 모드에서 글 1개를 보내 "보내는 중"으로 둔 직후 로그아웃 확인 창 -> "아직 보내지 못한 메시지 1개가 있어요…" 줄이 있어야 한다.
 * 실제 순서 그대로: 오프라인(요청이 끝나지 않거나 연결 오류) -> 방금 보낸 글(채팅의 첫 시도 `attemptText` - 큐에 들어가기 전) -> 바로 로그아웃 창.
 * 서버는 가짜(원격 0). 앱의 허브 하나(`textQueueHub` · `photoQueueHub`)를 그대로 쓴다 - 화면(ProfileScreen)이 보는 것과 같은 것.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Preferences } from '@capacitor/preferences'
import { setSupabaseForTest } from './auth/client'
import { useAuthStore } from './auth/stores'
import { resetQueueHoldForTest } from './cache/queueStorage'
import { textQueueHub } from './features/chat/textQueueHub'
import { photoQueueHub } from './photoQueue/photoQueueHub'
import { ProfileScreen } from './features/settings/ProfileScreen'
import { LOGOUT_QUEUED_NOTE, LOGOUT_SWITCH_NOTE, countUnsentMessages } from './features/settings/unsentCount'
import { hubUnsentSource } from './features/settings/unsentSource'
import { useCoupleStore } from './stores/coupleStore'
import { makeFakeNav } from './testSupport'
import type { OutgoingMessage } from '@/utils/chatQueue'

/** 끝나지 않는 요청(비행기 모드에서 응답이 오지 않는 경우) - 어떤 사슬로 불러도 같은 약속. 시험 끝에 연결 오류로 풀어 다음 시험에 남지 않게. */
const releases: Array<() => void> = []
function hangingDb() {
  let release: () => void = () => undefined
  const hang = new Promise((r) => { release = () => r({ data: null, error: { message: 'Failed to fetch' } }) })
  releases.push(release)
  const chain: unknown = new Proxy(function noop() {}, {
    get: (_t, p) => (p === 'then' ? hang.then.bind(hang) : chain),
    apply: () => chain,
  })
  return { from: () => chain, auth: { getSession: () => new Promise(() => {}) } }
}
/** 바로 연결 오류(supabase-js처럼 오류 값 - code 없음 -> 일시 실패). */
function offlineErrorDb() {
  const fail = Promise.resolve({ data: null, error: { message: 'Failed to fetch' } })
  const chain: unknown = new Proxy(function noop() {}, {
    get: (_t, p) => (p === 'then' ? fail.then.bind(fail) : chain),
    apply: () => chain,
  })
  return { from: () => chain, auth: { getSession: () => new Promise(() => {}) } }
}

const outgoing = (id: string, senderId = 'me'): OutgoingMessage => ({ clientMsgId: id, coupleId: 'c1', senderId, body: '안녕', sentAt: '2025-10-20T00:00:00Z' })
const notes = () => screen.queryAllByTestId('confirm-note').map((n) => n.textContent)

/** 채팅의 보내기와 같은 순서(`useChatMessages.sendText`): 첫 시도 -> 실패면 큐에 적재. */
async function sendLikeChat(o: OutgoingMessage) {
  const r = await textQueueHub.attemptText(o)
  if (r.outcome === 'failed') textQueueHub.getTextQueue()?.enqueueAfterInitialFailure(o, r.errorClass)
}

async function flush() {
  await act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve() })
}

beforeEach(async () => {
  localStorage.clear()
  await Preferences.clear()
  resetQueueHoldForTest()
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'partner' })
  textQueueHub.attach('c1', 'me')
  await flush() // 기기 저장 읽기(빈 대기열)
})
afterEach(async () => {
  cleanup()
  for (const r of releases.splice(0)) r()
  await flush()
  textQueueHub.detach()
  photoQueueHub.detach()
  setSupabaseForTest(undefined)
  vi.restoreAllMocks()
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

describe('83- 덧붙임: 오프라인 -> 방금 보낸 글 -> 바로 로그아웃 창', () => {
  it('요청이 끝나지 않는 동안(보내는 중 · 아직 큐 밖) -> 창에 "1개" 줄 · 계정 전환 줄', async () => {
    setSupabaseForTest(hangingDb() as never)
    void sendLikeChat(outgoing('t1'))
    await flush()
    // 기기 저장에는 아직 이 글이 없다(81-b 폰 확인 11번의 원인 - 저장값만 세면 0).
    expect(await countUnsentMessages('me', 'c1')).toEqual({ queued: 0, kept: 0 })
    render(<ProfileScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('profile-logout'))
    await vi.waitFor(() => expect(notes()).toEqual([LOGOUT_QUEUED_NOTE(1), LOGOUT_SWITCH_NOTE]))
  })

  it('바로 연결 오류 -> 큐에 들어갔지만 기기 저장이 아직 끝나지 않음 -> 메모리 큐로 "1개"', async () => {
    setSupabaseForTest(offlineErrorDb() as never)
    await sendLikeChat(outgoing('t1'))
    expect(textQueueHub.getTextQueue()?.getQueue()).toHaveLength(1)
    // 저장이 아직 안 된 기기(빈 저장소)
    const empty = { get: async () => ({ value: null }), set: async () => undefined }
    expect(await countUnsentMessages('me', 'c1', empty)).toEqual({ queued: 0, kept: 0 }) // 83- 이전 셈: 0
    expect(await countUnsentMessages('me', 'c1', empty, hubUnsentSource)).toEqual({ queued: 1, kept: 0 })
  })

  it('창을 연 뒤에 보낸 글도 창이 열려 있는 동안 줄에 반영(창이 열릴 때 한 번만 읽지 않음)', async () => {
    setSupabaseForTest(hangingDb() as never)
    render(<ProfileScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('profile-logout'))
    await flush()
    expect(notes()).toEqual([])
    void sendLikeChat(outgoing('t1'))
    await vi.waitFor(() => expect(notes()).toEqual([LOGOUT_QUEUED_NOTE(1), LOGOUT_SWITCH_NOTE]))
  })

  it('같은 글을 두 번 세지 않음: 저장 + 메모리 큐 + 보내는 중이 겹쳐도 1', async () => {
    setSupabaseForTest(offlineErrorDb() as never)
    await sendLikeChat(outgoing('t1'))
    await vi.waitFor(async () => expect((await Preferences.get({ key: 'chat_queue:c1' })).value).not.toBeNull())
    expect(await countUnsentMessages('me', 'c1', Preferences, hubUnsentSource)).toEqual({ queued: 1, kept: 0 })
  })

  it('다른 사람 항목(주인 ≠ 지금 사용자)은 메모리에 있어도 세지 않음', async () => {
    setSupabaseForTest(hangingDb() as never)
    void textQueueHub.attemptText(outgoing('x1', 'partner')) // 82- 막음으로 바로 실패(서버 0)
    void sendLikeChat(outgoing('t1'))
    await flush()
    expect(await countUnsentMessages('me', 'c1', Preferences, hubUnsentSource)).toEqual({ queued: 1, kept: 0 })
  })

  it('보내기가 끝나면(서버 확정) 줄이 사라짐 - 남은 것 0', async () => {
    let resolve: (v: unknown) => void = () => undefined
    const done = new Promise((r) => { resolve = r })
    const chain: unknown = new Proxy(function noop() {}, { get: (_t, p) => (p === 'then' ? done.then.bind(done) : chain), apply: () => chain })
    setSupabaseForTest({ from: () => chain, auth: { getSession: () => new Promise(() => {}) } } as never)
    void sendLikeChat(outgoing('t1'))
    render(<ProfileScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('profile-logout'))
    await vi.waitFor(() => expect(notes()).toEqual([LOGOUT_QUEUED_NOTE(1), LOGOUT_SWITCH_NOTE]))
    await act(async () => { resolve({ data: { id: 'm1', client_msg_id: 't1', couple_id: 'c1', sender_id: 'me', body: '안녕', media_path: null, sent_at: '2025-10-20T00:00:00Z', read_at: null }, error: null }) })
    await vi.waitFor(() => expect(notes()).toEqual([]))
  })
})
