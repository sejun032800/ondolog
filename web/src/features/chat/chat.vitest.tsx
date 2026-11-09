/**
 * 채팅 화면 시험(74-5) - 원본: `__tests__/components/u4Chat.test.tsx`(F01 · F02 게이팅 · F04 · F05 · 사진 · 스토리) + 옛 `chatFeel.vitest.tsx`의 손맛 시험(보내기 버튼 포커스 유지 · 말풍선 등장 · 끝 유지)을
 * 실제 채팅 화면 기준으로 다시 둔다. 서버는 가짜(`chatTestSupport.ts`), 사진 선택기는 가짜(웹 입력은 jsdom에서 열 수 없다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { setInviteEntry } from '../../app/inviteEntry'
import { ToastHost } from '../../components/ToastHost'
import { handleHardwareBack } from '../../platform/backStack'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeBridge } from '../../testSupport'
import { ChatTab } from '../../tabs/ChatTab'
import { CHAT_DISCONNECTED_COPY, ChatMessageItem, LONG_PRESS_MS, MESSAGE_COPY } from './ChatView'
import { savedImageFileName } from '../../platform/imageSave'
import { CHAT_PROFILES, makeChatWorld, messageRow, type ChatWorld } from './chatTestSupport'

const picker = vi.hoisted(() => ({ next: [] as unknown[], calls: [] as unknown[][] }))
vi.mock('../feed/photoPicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../feed/photoPicker')>()
  return { ...actual, pickPhotos: vi.fn(async (...a: unknown[]) => { picker.calls.push(a); return picker.next }), releasePhotoUrls: vi.fn() }
})

const T = (min: number) => new Date(2026, 9, 20, 9, 20 + min).toISOString()
const photo = (k: string) => ({ uri: `blob:${k}`, ext: 'jpg', mimeType: 'image/jpeg', width: 10, height: 10, byteSize: 8, capturedAt: null, lat: null, lng: null, fileKey: k })

function open(opts: Parameters<typeof makeChatWorld>[0] = {}, bridge = makeFakeBridge()) {
  const w: ChatWorld = makeChatWorld({ profiles: CHAT_PROFILES, ...opts })
  render(<><ChatTab bridge={bridge} hubs={w.hubs} /><ToastHost aboveTabBar /></>)
  return { w, bridge }
}
const reduced = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as never
}

beforeEach(() => {
  picker.next = []
  picker.calls = []
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you', relationshipStartDate: '2025-12-28' })
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setSupabaseForTest(undefined)
  setInviteEntry(null)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
  delete (window as { matchMedia?: unknown }).matchMedia
})

// ---------------------------------------------------------------------------
describe('F02 게이팅 - 미연결은 화면 안 안내(시트 반복 0, B4)', () => {
  it('연결 여부가 정해지기 전에는 아무것도 확정하지 않는다', () => {
    useCoupleStore.setState({ status: 'unknown' })
    open()
    expect(screen.queryByTestId('chat-disconnected')).toBeNull()
    expect(screen.queryByTestId('chat-composer')).toBeNull()
  })

  it('미연결이면 "채팅" 머리 + F02 문구 카드, 시트는 저절로 뜨지 않고 둘째 문장("잡지의 재료")은 없다', () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null })
    open()
    expect(screen.getByTestId('chat-disconnected')).toBeTruthy()
    expect(screen.getByText(CHAT_DISCONNECTED_COPY.title)).toBeTruthy()
    expect(screen.getByText('채팅은 연인과 연결되면 열려요.')).toBeTruthy()
    expect(screen.queryByText(/재료|잡지|공유 카드/)).toBeNull()
    expect(screen.queryByTestId('chat-composer')).toBeNull()
    expect(useSheetStore.getState().current).toBeNull()
  })

  it('두 버튼은 시트를 거치지 않고 바로 초대 입구로 간다(B12)', () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null })
    const entry = vi.fn()
    setInviteEntry(entry)
    open()
    fireEvent.click(screen.getByText('초대 코드 보내기'))
    fireEvent.click(screen.getByText('받은 코드 입력하기'))
    expect(entry.mock.calls).toEqual([['intro'], ['enter']])
    expect(useSheetStore.getState().current).toBeNull()
  })
})

describe('F01 채팅 화면', () => {
  it('상대 이름 · D+N · 스토리 줄 · 날짜 구분 · 말풍선(내 것 / 상대 것) · 입력창', async () => {
    open({ messages: [messageRow('a', T(0), { body: '오늘 비 온대. 우산 챙겼어?' }), messageRow('b', T(1), { sender_id: 'me', body: '응 챙겼어', read_at: T(2) })] })
    await screen.findByText('오늘 비 온대. 우산 챙겼어?')
    expect(screen.getByText('서영')).toBeTruthy()
    expect(screen.getByTestId('chat-days').textContent).toMatch(/^D\+\d+$/)
    expect(screen.getByTestId('chat-story-add')).toBeTruthy()
    expect(screen.getByText('10월 20일 화요일')).toBeTruthy()
    const rows = screen.getAllByTestId('chat-message')
    expect(rows[0].className).toContain('partner')
    expect(rows[1].className).toContain('mine')
    expect(screen.getByTestId('chat-composer')).toBeTruthy()
  })

  it('불러오는 중에는 스피너 대신 뼈대, 메시지가 없으면 첫 마디를 권한다(공유 카드 · 잡지 문구 0)', async () => {
    open()
    expect(screen.getByTestId('chat-loading')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    const empty = await screen.findByTestId('chat-empty')
    expect(empty.textContent).toBe(MESSAGE_COPY.empty)
    expect(screen.queryByText(/잡지|공유 카드/)).toBeNull()
  })

  it('보내기: 공백뿐이면 비활성이라 보내지 않고, 글자가 있으면 보낸다 · 보낸 뒤 입력 칸 포커스 유지(키보드 유지)', async () => {
    const { w } = open()
    await screen.findByTestId('chat-empty')
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    const send = screen.getByTestId('chat-send')
    input.focus()
    expect(send.getAttribute('aria-disabled')).toBe('true')
    input.value = '   '
    fireEvent.input(input)
    fireEvent.click(send)
    expect(w.db.inserts).toHaveLength(0)
    for (const t of ['점심 먹었어?', '두 번째', '세 번째']) {
      input.value = t
      fireEvent.input(input, { inputType: 'insertText' })
      const down = new Event('pointerdown', { bubbles: true, cancelable: true })
      fireEvent(send, down)
      expect(down.defaultPrevented).toBe(true) // 보내기 버튼이 포커스를 가져가지 않는다
      fireEvent.click(send)
      expect(document.activeElement).toBe(input)
      await waitFor(() => expect(w.db.inserts.map((r) => r.body)).toContain(t))
    }
    expect(w.db.inserts.map((r) => r.body)).toEqual(['점심 먹었어?', '두 번째', '세 번째'])
    expect(input.value).toBe('')
  })

  it('큐에 자동 재시도 중인 글이 있으면 연결 끊김 안내 줄이 보이고, 큐가 비면 없다(스피너 0)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { w } = open({ offline: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    input.value = '안 가는 글'
    fireEvent.input(input, { inputType: 'insertText' })
    fireEvent.click(screen.getByTestId('chat-send'))
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(screen.getByTestId('chat-offline-banner').textContent).toContain(MESSAGE_COPY.offline)
    expect(screen.getByTestId('chat-sending').textContent).toBe(MESSAGE_COPY.sending)
    expect(screen.queryByRole('progressbar')).toBeNull()
    w.db.state.offline = false
    await act(async () => { w.hubs.text.kick(); await vi.advanceTimersByTimeAsync(10) })
    expect(screen.queryByTestId('chat-offline-banner')).toBeNull()
    expect(screen.queryByTestId('chat-sending')).toBeNull()
  })

  it('말풍선 등장: 처음 불러온 것에는 연출이 없고, 그 뒤 새로 온 것에만 붙는다(확정돼도 다시 하지 않는다)', async () => {
    const { w } = open({ messages: [messageRow('a', T(0))] })
    await screen.findByText('body-a')
    expect(screen.getByTestId('chat-message').className).not.toContain('enter')
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: messageRow('b', T(1), { read_at: T(2) }) }) })
    const rows = screen.getAllByTestId('chat-message')
    expect(rows[0].className).not.toContain('enter')
    expect(rows[1].className).toContain('enter')
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    input.value = '내 글'
    fireEvent.input(input, { inputType: 'insertText' })
    fireEvent.click(screen.getByTestId('chat-send'))
    await waitFor(() => expect(w.db.inserts).toHaveLength(1))
    const mine = (await screen.findAllByTestId('chat-message')).at(-1) as HTMLElement
    expect(mine.className).toContain('enter')
    expect(screen.queryAllByTestId('chat-message')).toHaveLength(3) // 확정된 뒤에도 하나
  })

  it('끝 유지: 내가 보낸 글은 끝으로 가고, 위로 올려 보는 중에 온 상대 글은 위치를 건드리지 않는다', async () => {
    reduced(true) // 부드러운 이동 대신 즉시 - 값만 본다
    const { w } = open({ messages: [messageRow('a', T(0))] })
    await screen.findByText('body-a')
    const list = screen.getByTestId('chat-list')
    Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 100 })
    list.scrollTop = 0
    fireEvent.scroll(list) // 위에서 보는 중(끝에서 멀다)
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: messageRow('p', T(1), { read_at: T(2) }) }) })
    expect(list.scrollTop).toBe(0)
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    input.value = '내 글'
    fireEvent.input(input, { inputType: 'insertText' })
    fireEvent.click(screen.getByTestId('chat-send'))
    await waitFor(() => expect(list.scrollTop).toBe(1000))
  })
})

describe('F05 보내는 중 · 다시 보내기 - 정지 표시, 스피너 없음', () => {
  const base = { id: 'm', clientMsgId: 'c', coupleId: 'c1', senderId: 'me', body: '저녁 뭐 먹을까', mediaPath: null, sentAt: T(0), readAt: null }
  const props = { isMine: true, senderName: '세준', photoUri: undefined, onRetry: vi.fn(), onCancel: vi.fn(), onOpenPhoto: vi.fn() }

  it('보내는 중: "보내는 중" 글자 + 말풍선 흐리게', () => {
    render(<ChatMessageItem {...props} message={{ ...base, pending: true }} />)
    expect(screen.getByText('보내는 중')).toBeTruthy()
    expect(screen.queryByText('다시 보내기')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByText('저녁 뭐 먹을까').className).toContain('queued')
  })

  it('실패: [다시 보내기]를 누르면 그 메시지로 다시 보낸다', () => {
    const onRetry = vi.fn()
    render(<ChatMessageItem {...props} onRetry={onRetry} message={{ ...base, clientMsgId: 'b', failed: true }} />)
    fireEvent.click(screen.getByTestId('chat-retry'))
    expect(onRetry).toHaveBeenCalledWith('b')
    expect(screen.queryByText('보내는 중')).toBeNull()
  })

  it('보내는 중 말풍선을 길게 누르면 전송 취소, 짧게 누르면 아무 일도 없다', () => {
    vi.useFakeTimers()
    const onCancel = vi.fn()
    render(<ChatMessageItem {...props} onCancel={onCancel} message={{ ...base, pending: true }} />)
    const bubble = screen.getByText('저녁 뭐 먹을까')
    fireEvent.pointerDown(bubble, { clientX: 5, clientY: 5 })
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 100) })
    fireEvent.pointerUp(bubble)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.pointerDown(bubble, { clientX: 5, clientY: 5 })
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10) })
    expect(onCancel).toHaveBeenCalledWith('c')
  })

  it('읽음 표시: 내 메시지를 상대가 안 읽었을 때만 숫자 1, 읽으면 사라지고 상대 메시지에는 없다', () => {
    const { unmount } = render(<ChatMessageItem {...props} message={base} />)
    expect(screen.getByTestId('chat-unread').textContent).toBe('1')
    unmount()
    const second = render(<ChatMessageItem {...props} message={{ ...base, readAt: T(1) }} />)
    expect(screen.queryByTestId('chat-unread')).toBeNull()
    second.unmount()
    render(<ChatMessageItem {...props} isMine={false} message={{ ...base, senderId: 'you' }} />)
    expect(screen.queryByTestId('chat-unread')).toBeNull()
  })

  it('사진 메시지: 올라간 사진은 눌러 크게 보고, 올리는 중인 사진은 "보내는 중"이며 눌러도 열리지 않는다', () => {
    const onOpenPhoto = vi.fn()
    const sent = render(<ChatMessageItem {...props} onOpenPhoto={onOpenPhoto} message={{ ...base, mediaPath: 'c1/p.jpg', body: null }} photoUri="https://x.invalid/p" />)
    fireEvent.click(screen.getByTestId('chat-photo'))
    expect(onOpenPhoto).toHaveBeenCalledTimes(1)
    sent.unmount()
    render(<ChatMessageItem {...props} onOpenPhoto={onOpenPhoto} message={{ ...base, body: null, localUri: 'chat-photo-queue/q.jpg', pending: true }} />)
    expect(screen.getByText('보내는 중')).toBeTruthy()
    expect(screen.queryByTestId('chat-photo')).toBeNull()
  })
})

describe('F04 첨부 · 스토리 올리기', () => {
  it('+ -> 시트 -> 앨범: 고른 사진을 한 장씩 보낸다(시스템 선택기) · 최근 사진 격자는 없다', async () => {
    const { w } = open()
    await screen.findByTestId('chat-empty')
    picker.next = [photo('a'), photo('b')]
    fireEvent.click(screen.getByTestId('chat-attach'))
    expect(screen.getByTestId('chat-attach-sheet')).toBeTruthy()
    expect(screen.queryByText('최근 사진')).toBeNull()
    fireEvent.click(screen.getByTestId('chat-attach-album'))
    await waitFor(() => expect(w.db.uploads.filter((u) => u.bucket === 'messages')).toHaveLength(2))
    expect(picker.calls[0][1]).toMatchObject({ capture: false })
    await waitFor(() => expect(screen.queryByTestId('chat-attach-sheet')).toBeNull())
  })

  it('[카메라]는 입력의 capture로 한 장만 연다', async () => {
    const { w } = open()
    await screen.findByTestId('chat-empty')
    picker.next = [photo('c')]
    fireEvent.click(screen.getByTestId('chat-attach'))
    fireEvent.click(screen.getByTestId('chat-attach-camera'))
    await waitFor(() => expect(w.db.uploads).toHaveLength(1))
    expect(picker.calls[0][0]).toBe(1)
    expect(picker.calls[0][1]).toMatchObject({ capture: true })
  })

  it('스토리 올리기: 한 장 고르면 바로 올린다(편집 화면 없음)', async () => {
    const { w } = open()
    await screen.findByTestId('chat-empty')
    picker.next = [photo('s')]
    fireEvent.click(screen.getByTestId('chat-story-add'))
    await waitFor(() => expect(w.db.tables.stories).toHaveLength(1))
    expect(picker.calls[0][0]).toBe(1)
    await waitFor(() => expect(screen.getByTestId('chat-story-mine')).toBeTruthy())
  })

  it('고르지 않고 닫으면 아무 일도 없다', async () => {
    const { w } = open()
    await screen.findByTestId('chat-empty')
    picker.next = []
    fireEvent.click(screen.getByTestId('chat-story-add'))
    await waitFor(() => expect(picker.calls).toHaveLength(1))
    expect(w.db.tables.stories).toHaveLength(0)
  })
})

describe('F03 스토리 보기 - 닫는 길은 ✕ 하나, 뒤로 가기는 이것만 닫는다', () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const stories = [
    { id: 's1', couple_id: 'c1', author_id: 'you', media_path: 'c1/s1.jpg', created_at: new Date(Date.now() - 3 * 3600_000).toISOString(), expires_at: future },
    { id: 's2', couple_id: 'c1', author_id: 'you', media_path: 'c1/s2.jpg', created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), expires_at: future },
  ]

  it('상대 스토리를 눌러 열고, 오른쪽 절반 다음 · 왼쪽 절반 이전 · 마지막에서 다음은 닫기 · 위 막대는 정지 표시', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    open({ stories })
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    fireEvent.click(screen.getByTestId('chat-story-partner'))
    expect(screen.getByTestId('story-author').textContent).toBe('서영')
    expect(screen.getByTestId('story-segments').querySelectorAll('i')).toHaveLength(2)
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
    expect(screen.getByText('스토리는 24시간 동안 보여요')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) }) // 자동 넘김 없음
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('story-next'))
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('story-prev'))
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('story-next'))
    fireEvent.click(screen.getByTestId('story-next'))
    expect(screen.queryByTestId('story-viewer')).toBeNull()
  })

  it('✕로 닫고, 하드웨어 뒤로 가기는 스토리만 닫는다(앱은 그대로)', async () => {
    open({ stories })
    fireEvent.click(await screen.findByTestId('chat-story-partner'))
    fireEvent.click(screen.getByTestId('story-close'))
    expect(screen.queryByTestId('story-viewer')).toBeNull()
    fireEvent.click(screen.getByTestId('chat-story-partner'))
    const goBack = vi.fn()
    act(() => { handleHardwareBack({ canGoBack: () => true, goBack, exitApp: vi.fn() }) })
    expect(screen.queryByTestId('story-viewer')).toBeNull()
    expect(goBack).not.toHaveBeenCalled()
    expect(screen.getByTestId('chat-conversation')).toBeTruthy()
  })
})

describe('F06 사진 크게 보기 · 복사', () => {
  it('사진을 누르면 보낸 사람 · 시각이 있는 뷰어가 열리고, ✕ 와 뒤로 가기는 뷰어만 닫는다', async () => {
    open({ messages: [messageRow('p', T(0), { body: null, media_path: 'c1/p.jpg' })] })
    fireEvent.click(await screen.findByTestId('chat-photo'))
    expect(screen.getByTestId('photo-viewer')).toBeTruthy()
    expect(screen.getByTestId('photo-sender').textContent).toBe('서영')
    fireEvent.click(screen.getByTestId('photo-viewer-close'))
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
    fireEvent.click(screen.getByTestId('chat-photo'))
    const goBack = vi.fn()
    act(() => { handleHardwareBack({ canGoBack: () => true, goBack, exitApp: vi.fn() }) })
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
    expect(goBack).not.toHaveBeenCalled()
  })

  it('[저장]은 저장할 때마다 다른 파일 이름으로 다리를 부르고, 실패하면 안내 토스트(원인 · 경로 0)', async () => {
    const saved: string[] = []
    const bridge = makeFakeBridge({ saveImage: vi.fn(async (img) => { saved.push(img.fileName); return 'saved' as const }) })
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/png' }) })))
    open({ messages: [messageRow('p', T(0), { body: null, media_path: 'c1/p.jpg' })] }, bridge)
    fireEvent.click(await screen.findByTestId('chat-photo'))
    await waitFor(() => expect((screen.getByTestId('photo-save') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByTestId('photo-save'))
    await waitFor(() => expect(saved).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 5))
    fireEvent.click(screen.getByTestId('photo-save'))
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(new Set(saved).size).toBe(2)
    expect(saved[0]).toMatch(/^ondolog-chat-\d{8}-\d{6}-\d{3}-[0-9a-z]{4}\.png$/)
    ;(bridge.saveImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce('failed')
    fireEvent.click(screen.getByTestId('photo-save'))
    await waitFor(() => expect(screen.getByText('사진을 저장하지 못했어요. 다시 시도해 주세요')).toBeTruthy())
    vi.unstubAllGlobals()
  })

  it('[공유]는 다리의 공유를 부른다', async () => {
    const shareImage = vi.fn(async () => 'shared' as const)
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })))
    open({ messages: [messageRow('p', T(0), { body: null, media_path: 'c1/p.jpg' })] }, makeFakeBridge({ shareImage }))
    fireEvent.click(await screen.findByTestId('chat-photo'))
    await waitFor(() => expect((screen.getByTestId('photo-share') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByTestId('photo-share'))
    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })

  it('파일 이름은 날짜 + 시각 + 밀리초 + 무작위 4자라 매번 다르다', () => {
    const at = new Date(2026, 10, 9, 14, 35, 2, 7)
    expect(savedImageFileName('chat', at, 'jpg', () => 0)).toBe('ondolog-chat-20261109-143502-007-0000.jpg')
    expect(savedImageFileName('chat', new Date(2026, 10, 9, 14, 35, 2, 8), 'jpg', () => 0)).not.toBe(savedImageFileName('chat', at, 'jpg', () => 0))
    expect(savedImageFileName('chat', at, 'jpg', () => 0.5)).not.toBe(savedImageFileName('chat', at, 'jpg', () => 0))
  })

  it('보낸 글을 길게 누르면 앱이 그리는 [복사] 메뉴가 뜨고, 누르면 클립보드에 그 글이 들어간다(실패하면 토스트)', async () => {
    const write = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
    open({ messages: [messageRow('a', T(0), { body: '복사할 글', read_at: T(1) })] })
    const bubble = await screen.findByText('복사할 글')
    fireEvent.pointerDown(bubble, { clientX: 1, clientY: 1 })
    await act(async () => { await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 60)) })
    within(screen.getByTestId('chat-copy-menu')).getByTestId('chat-copy')
    fireEvent.click(screen.getByTestId('chat-copy'))
    await waitFor(() => expect(write).toHaveBeenCalledWith('복사할 글'))
    await waitFor(() => expect(screen.getByText('복사했어요')).toBeTruthy())
  })
})
