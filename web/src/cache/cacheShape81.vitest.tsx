/**
 * 81-(R117-2) 기기 저장값 모양 검사 시험 - 범주마다 깨진 값 · 옛 버전 값 -> 그 범주만 버림 · `cache_fail` 1회 · 화면 정상 · 서버에서 다시 채움.
 * 대기열(보내지 않은 글 · 사진)은 버리지 않는다 - 옛 모양 변환 · 변환 불가 원본 보존 · 보내기에서만 빠짐 · 사진 파일 남음.
 * 원격 0(가짜 클라이언트 · 가짜 Preferences · 가짜 파일).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { QueuedPhoto } from '@/utils/chatPhotoQueue'
import type { QueuedMessage } from '@/utils/chatQueue'
import type { AttemptedPhoto, PhotoFs } from '@/services/chatPhotoCore'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { RenderGuard } from '../components/AccountProblem'
import { clearAppErrorCounts, ERROR_LOG_KEY, setErrorScreen } from '../errorLog/errorLog'
import { TextQueueHub, createTextQueueStore } from '../features/chat/textQueueHub'
import { readChatCache } from '../features/chat/chatCache'
import { PhotoQueueHub } from '../photoQueue/photoQueueHub'
import { createPhotoQueueStore } from '../photoQueue/photoQueueStore'
import { useCoupleStore } from '../stores/coupleStore'
import { makeFakeNav } from '../testSupport'
import { FeedTab } from '../tabs/FeedTab'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow } from '../features/feed/feedTestSupport'
import { CACHE_VERSION } from './cacheShapes'
import {
  clearAllDeviceCache, clearCoupleCache, clearScreenCache, countQueueOriginals, purgeOtherUsers, readCache,
  resetCacheFailMemoryForTest, sweepDeviceCache, writeCache, type CacheKind,
} from './deviceCache'
import { QUEUE_VERSION } from './queueShapes'
import { resetQueueHoldForTest, type PrefsLike } from './queueStorage'

const ME = 'me'
const key = (kind: string, scope?: string, user = ME) => `ondolog.dc1:${user}:${kind}${scope ? `:${scope}` : ''}`

/** 기기에 모인 `cache_fail` 건수(80- 오류 건수 저장분). */
function failCount(): number {
  const raw = localStorage.getItem(ERROR_LOG_KEY)
  if (!raw) return 0
  const st = JSON.parse(raw) as { buckets: Record<string, { kind: string; count: number }> }
  return Object.values(st.buckets).filter((b) => b.kind === 'cache_fail').reduce((n, b) => n + b.count, 0)
}

beforeEach(() => {
  localStorage.clear()
  clearAppErrorCounts()
  resetCacheFailMemoryForTest()
  resetQueueHoldForTest()
  setSupabaseForTest(null) // 오류 건수를 보내지 않는다(원격 0)
  useAuthStore.getState().setUserId(ME)
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

// ---------------------------------------------------------------------------
// 0단계 표의 범주 전부: 올바른 값 · 칸 빠짐 · 타입 다름
// ---------------------------------------------------------------------------
const issue = { id: 'i1', coupleId: 'c1', issueType: 'monthly', issueNumber: 1, title: null, coverPath: null, periodStart: '2026-10-01', periodEnd: '2026-10-31', pdfDigitalPath: null, pageCount: 12, publishedAt: '2026-11-01T00:00:00Z', theme: null }
const msg = { id: 'm1', clientMsgId: null, coupleId: 'c1', senderId: 'you', body: '안녕', mediaPath: null, sentAt: '2026-10-03T00:00:00Z', readAt: null }
const feedEntry = { id: 'd1', dateOn: '2026-10-03', date_on: '2026-10-03', region: null, title: null, photoCount: 1, memoCount: 0, coverPath: null, quote: null }
const dayRec = { id: 'd1', date: '2026-10-03', stops: [], photos: [], memos: [], counts: { stops: 0, photos: 0, memos: 0 } }

interface Case { name: string; kind: CacheKind; scope?: string; good: unknown; missing: unknown; wrongType: unknown }
const CASES: Case[] = [
  { name: 'main 요약', kind: 'main', good: { coupleId: 'c1', partnerId: 'you', nickname: '우리', temperature: 37, temperatureDateOn: null, relationshipStartDate: '2026-01-01', referencePhotoPath: null },
    missing: { coupleId: 'c1', partnerId: 'you' }, wrongType: { coupleId: 'c1', partnerId: 'you', nickname: { x: 1 }, temperature: '37', temperatureDateOn: null, relationshipStartDate: null, referencePhotoPath: null } },
  { name: 'main:library', kind: 'main', scope: 'library', good: { coupleId: 'c1', issues: [issue], next: { monthLabel: '11월호', percent: 40, counts: null } },
    missing: { coupleId: 'c1', issues: [{ id: 'i1' }], next: null }, wrongType: { coupleId: 'c1', issues: 'x', next: null } },
  { name: 'main:facts', kind: 'main', scope: 'facts', good: { coupleId: 'c1', hasActivity: true, profilesComplete: true, openedIssueIds: ['i1'], openedFor: 'i1' },
    missing: { coupleId: 'c1', openedFor: 'i1' }, wrongType: { coupleId: 'c1', hasActivity: 'yes', profilesComplete: true, openedIssueIds: 'i1', openedFor: 'i1' } },
  { name: 'main:start', kind: 'main', scope: 'start', good: { coupleId: 'c1', value: 36.5, hasActivity: false }, missing: { coupleId: 'c1' }, wrongType: { coupleId: 'c1', value: '36.5', hasActivity: false } },
  { name: '닉네임 안내 표시', kind: 'main', scope: 'nickNotice', good: { key: 'k' }, missing: {}, wrongType: { key: 1 } },
  { name: '사귄 날 안내 표시(F1)', kind: 'main', scope: 'dateNotice', good: { key: 'k' }, missing: {}, wrongType: { key: [] } },
  { name: '상대 이름', kind: 'name', scope: 'you', good: { name: '서영' }, missing: {}, wrongType: { name: { first: '서영' } } },
  { name: '채팅', kind: 'chat', scope: 'c1', good: { coupleId: 'c1', messages: [msg] }, missing: { coupleId: 'c1', messages: [{ id: 'm1', coupleId: 'c1', sentAt: 'x' }] }, wrongType: { coupleId: 'c1', messages: [{ ...msg, body: 5 }] } },
  { name: '채팅 머리 이름', kind: 'chat', scope: 'c1:head', good: { coupleId: 'c1', name: '서영' }, missing: { coupleId: 'c1' }, wrongType: { coupleId: 'c1', name: 3 } },
  { name: '피드', kind: 'feed', good: { chapters: [{ key: '2026-10', year: 2026, month: 10, photoTotal: 1, memoTotal: 0, dates: [feedEntry] }], names: { you: '서영' } },
    missing: { chapters: [{ key: '2026-10', dates: [feedEntry] }], names: {} }, wrongType: { chapters: [{ key: '2026-11', year: 2026, month: 11, photoTotal: 0, memoTotal: 0, dates: 'broken' }], names: {} } },
  { name: '지우기 대기열(trash)', kind: 'feed', scope: 'trash', good: { paths: ['c1/a.jpg'] }, missing: {}, wrongType: { paths: 'c1/a.jpg' } },
  { name: '하늘', kind: 'sky', scope: 'c1', good: { coupleId: 'c1', records: [dayRec], allLoaded: true, temps: { '2026-10-03': 37 }, tempStatus: { '2026-10': 'ok' }, moons: [], draftPeriodStart: null },
    missing: { coupleId: 'c1', records: [{ id: 'd1', date: '2026-10-03' }] }, wrongType: { coupleId: 'c1', records: [dayRec], allLoaded: true, temps: {}, tempStatus: { '2026-10': 'maybe' }, moons: [], draftPeriodStart: null } },
  { name: '마지막 탭', kind: 'route', good: { route: 'chat', at: 1 }, missing: { route: 'chat' }, wrongType: { route: 'chat', at: '1' } },
  { name: '푸시 권한 안내 보임', kind: 'push', scope: 'asked', good: { asked: true }, missing: {}, wrongType: { asked: 'true' } },
]

describe('81- 범주마다: 깨진 값 · 옛 버전 -> 그 범주만 버림 · cache_fail 1회', () => {
  it('범주 표가 0단계 표의 일반 범주를 모두 덮는다', () => {
    expect(new Set(CASES.map((c) => c.kind))).toEqual(new Set(Object.keys(CACHE_VERSION).filter((k) => k !== 'qkeep')))
  })

  it.each(CASES)('$name: 올바른 값은 버전을 붙여 저장하고 그대로 읽는다', (c) => {
    writeCache(ME, c.kind, c.good, c.scope)
    expect(JSON.parse(localStorage.getItem(key(c.kind, c.scope))!)).toEqual({ __v: CACHE_VERSION[c.kind], d: c.good })
    expect(readCache(ME, c.kind, c.scope)).toEqual(c.good)
    expect(failCount()).toBe(0)
  })

  it.each(CASES)('$name: 버전 없는 81- 이전 값(지금 모양)은 받아들인다 - 업데이트 첫 실행에 비지 않음', (c) => {
    localStorage.setItem(key(c.kind, c.scope), JSON.stringify(c.good))
    expect(readCache(ME, c.kind, c.scope)).toEqual(c.good)
    expect(failCount()).toBe(0)
  })

  const broken = (c: Case) => [
    ['JSON 아님', '{깨짐'],
    ['칸 빠짐', JSON.stringify({ __v: 1, d: c.missing })],
    ['타입 다름', JSON.stringify({ __v: 1, d: c.wrongType })],
    ['버전 없는 깨진 값', JSON.stringify(c.wrongType)],
    ['옛 버전', JSON.stringify({ __v: 0, d: c.good })],
    ['모르는 새 버전', JSON.stringify({ __v: 99, d: c.good })],
  ] as const
  it.each(CASES)('$name: 깨짐 · 옛 버전 -> null · 그 키만 지움 · 다른 범주 그대로 · cache_fail 1회(다시 읽어도 더 세지 않음)', (c) => {
    for (const [, raw] of broken(c)) {
      localStorage.clear()
      clearAppErrorCounts()
      resetCacheFailMemoryForTest()
      writeCache(ME, 'route', { route: 'feed', at: 5 }) // 옆 범주(route 자신을 시험할 때는 아래에서 다른 이웃)
      writeCache(ME, 'name', { name: '이웃' }, 'nb')
      localStorage.setItem(key(c.kind, c.scope), raw)
      expect(readCache(ME, c.kind, c.scope)).toBeNull()
      expect(localStorage.getItem(key(c.kind, c.scope))).toBeNull()
      expect(readCache(ME, c.kind, c.scope)).toBeNull()
      expect(failCount()).toBe(1)
      expect(readCache(ME, 'name', 'nb')).toEqual({ name: '이웃' })
    }
  })
})

describe('81- 화면 정상 · 서버에서 다시 채움', () => {
  it('피드(80- 관찰 모양: dates가 글자) -> 대체 화면 0 · 서버 읽기로 카드 · 기기 저장분도 새 모양으로 다시 씀 · cache_fail 1', async () => {
    localStorage.setItem(key('feed'), JSON.stringify({ chapters: [{ key: '2026-11', dates: 'broken' }], names: {} }))
    const db = makeFeedDb({ me: ME, couples: [COUPLE_ROW], profiles: PROFILES, dates: [dateRow('d1', '2026-10-03')], stops: [{ ...stopRow('s1', 'd1', 0, '2026-10-03T03:00:00Z', '연남동'), author_id: ME }], entries: [photoRow('p1'), memoRow('m1', '메모')] })
    setSupabaseForTest(db.client)
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
    render(<RenderGuard nav={makeFakeNav()}><FeedTab nav={makeFakeNav()} /></RenderGuard>)
    await screen.findByTestId('day-swipe-d1')
    expect(screen.queryByTestId('account-problem')).toBeNull()
    await waitFor(() => expect(readCache<{ chapters: unknown[] }>(ME, 'feed')?.chapters).toHaveLength(1))
    expect(JSON.parse(localStorage.getItem(key('feed'))!).__v).toBe(1)
    setSupabaseForTest(null)
    expect(failCount()).toBe(1)
  })

  it('메인 요약이 깨지면 기기 값으로 채우지 않음(상태 unknown -> 서버 읽기 대기) · cache_fail 1', () => {
    localStorage.setItem(key('main'), JSON.stringify({ __v: 1, d: { coupleId: 'c1', partnerId: 'you', temperature: 'hot' } }))
    useCoupleStore.getState().hydrate(ME)
    expect(useCoupleStore.getState().status).toBe('unknown')
    expect(failCount()).toBe(1)
  })

  it('채팅 저장분이 깨지면 빈 목록(서버 읽기가 채움) · cache_fail 1', () => {
    localStorage.setItem(key('chat', 'c1'), JSON.stringify({ __v: 1, d: { coupleId: 'c1', messages: [{ id: 1 }] } }))
    expect(readChatCache(ME, 'c1')).toEqual([])
    expect(failCount()).toBe(1)
  })

  it('하늘 저장분이 깨지면 자리 표시로 시작(서버 읽기가 채움) · cache_fail 1', async () => {
    const { useSky } = await import('../features/sky/skyData')
    localStorage.setItem(key('sky', 'c1'), JSON.stringify({ __v: 1, d: { coupleId: 'c1', records: [{ id: 'd1' }] } }))
    const { result } = renderHook(() => useSky({ userId: ME, partnerId: 'you', coupleId: 'c1', now: new Date('2026-11-17T00:00:00Z'), persist: false }))
    expect(result.current.records).toEqual([])
    expect(failCount()).toBe(1)
  })
})

describe('81- 앱 시작 때 훑기', () => {
  it('깨진 · 옛 버전 키만 버리고 올바른 값 · 보존 칸 · 모르는 scope · 다른 사람 키는 그대로 · 던지지 않음', () => {
    writeCache(ME, 'route', { route: 'chat', at: 1 })
    localStorage.setItem(key('feed'), '{깨짐')
    localStorage.setItem(key('sky', 'c1'), JSON.stringify({ __v: 0, d: {} }))
    localStorage.setItem(key('main', 'library'), JSON.stringify({ __v: 1, d: { coupleId: 'c1', issues: 3 } }))
    localStorage.setItem(key('qkeep', 'text:c1'), '{보존 칸이 깨져도 버리지 않음')
    localStorage.setItem(key('main', 'future-scope'), '{모름')
    localStorage.setItem(key('feed', undefined, 'other'), '{다른 사람')
    expect(sweepDeviceCache(ME)).toBe(3)
    expect(localStorage.getItem(key('feed'))).toBeNull()
    expect(localStorage.getItem(key('sky', 'c1'))).toBeNull()
    expect(localStorage.getItem(key('main', 'library'))).toBeNull()
    expect(readCache(ME, 'route')).toEqual({ route: 'chat', at: 1 })
    expect(localStorage.getItem(key('qkeep', 'text:c1'))).not.toBeNull()
    expect(localStorage.getItem(key('main', 'future-scope'))).not.toBeNull()
    expect(localStorage.getItem(key('feed', undefined, 'other'))).not.toBeNull()
    expect(failCount()).toBe(3)
    expect(sweepDeviceCache(ME)).toBe(0) // 두 번째는 0 · 더 세지 않음
    expect(failCount()).toBe(3)
    expect(sweepDeviceCache(null)).toBe(0)
  })

  it('저장소 접근이 막혀도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('blocked') })
    expect(() => sweepDeviceCache(ME)).not.toThrow()
    spy.mockRestore()
  })
})

describe('81- RenderGuard [다시 시도] - 깨진 범주를 먼저 비운 뒤 다시 그림', () => {
  /** 검사를 지나지만 그리기를 깨뜨리는 값(모르는 원인)을 흉내 - 저장분이 남아 있으면 던진다. */
  function Fragile() {
    if (localStorage.getItem(key('feed'))) throw new Error('boom')
    return <div data-testid="fragile-ok">정상</div>
  }
  it('대체 화면 -> [다시 시도] 한 번에 정상(반복 깨짐 0) · 대기열 · 보존 칸 · 지우기 대기열 · 안내 표시는 남김', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    writeCache(ME, 'feed', { chapters: [], names: {} })
    writeCache(ME, 'feed', { paths: ['c1/x.jpg'] }, 'trash')
    writeCache(ME, 'main', { key: 'k' }, 'nickNotice')
    localStorage.setItem(key('qkeep', 'text:c1'), JSON.stringify({ __v: 1, d: { entries: [{ at: 'x', raw: '{}' }] } }))
    localStorage.setItem('CapacitorStorage.chat_queue:c1', '[]')
    setErrorScreen('feed')
    render(<RenderGuard nav={makeFakeNav()}><Fragile /></RenderGuard>)
    expect(screen.getByTestId('account-problem')).toBeTruthy()
    act(() => { fireEvent.click(screen.getByText('다시 시도')) })
    expect(screen.getByTestId('fragile-ok')).toBeTruthy()
    expect(screen.queryByTestId('account-problem')).toBeNull()
    expect(readCache(ME, 'feed', 'trash')).toEqual({ paths: ['c1/x.jpg'] })
    expect(localStorage.getItem(key('qkeep', 'text:c1'))).not.toBeNull()
    expect(localStorage.getItem('CapacitorStorage.chat_queue:c1')).toBe('[]')
    setErrorScreen('main')
    expect(readCache(ME, 'main', 'nickNotice')).toEqual({ key: 'k' })
    vi.restoreAllMocks()
  })

  it('모르는 화면 · 로그아웃 상태면 아무것도 지우지 않음', () => {
    writeCache(ME, 'feed', { chapters: [], names: {} })
    expect(clearScreenCache(ME, 'settings')).toBe(0)
    expect(clearScreenCache(null, 'feed')).toBe(0)
    expect(clearScreenCache(ME, 'feed')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 대기열
// ---------------------------------------------------------------------------
function memPrefs(init: Record<string, string> = {}): PrefsLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  return {
    data,
    get: async ({ key: k }) => ({ value: data.get(k) ?? null }),
    set: async ({ key: k, value }) => { data.set(k, value) },
  }
}
const NOW = new Date('2026-11-17T03:00:00Z')

describe('81- 글 대기열: 버리지 않음', () => {
  const current: QueuedMessage = { clientMsgId: 'q-now', coupleId: 'c1', senderId: ME, body: '지금 모양', sentAt: '2026-11-16T00:00:00Z', retryCount: 1, status: 'pending' }
  const oldShape = { clientMsgId: 'q-old', senderId: ME, body: '옛 모양(횟수 · 상태 · 시각 · 커플 칸 없음)' }
  const unconvertible = { clientMsgId: 'q-bad', senderId: ME, text: '본문 칸 이름이 다름' }

  it('옛 모양(버전 없는 배열) -> 변환 · 새 모양으로 다시 씀 · 정상 전송', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': JSON.stringify([current, oldShape]) })
    const sent: string[] = []
    const hub = new TextQueueHub({
      send: async (input) => { sent.push(input.clientMsgId); return { status: 'sent', row: { id: `r-${input.clientMsgId}`, client_msg_id: input.clientMsgId } as never } },
      store: createTextQueueStore(prefs, () => NOW),
    })
    hub.attach('c1', ME)
    await waitFor(() => expect(sent.sort()).toEqual(['q-now', 'q-old']))
    hub.detach()
    expect(countQueueOriginals(ME, 'text', 'c1')).toBe(0)
    expect(failCount()).toBe(0)
  })

  it('변환 결과: 빠진 칸만 기본값 · 키에서 채움(지어내는 칸 0)', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': JSON.stringify([oldShape]) })
    const items = await createTextQueueStore(prefs, () => NOW).load('c1', ME)
    expect(items).toEqual([{ clientMsgId: 'q-old', coupleId: 'c1', senderId: ME, body: oldShape.body, sentAt: NOW.toISOString(), retryCount: 0, status: 'pending' }])
    expect(JSON.parse(prefs.data.get('chat_queue:c1')!)).toEqual({ __v: QUEUE_VERSION, items })
  })

  it('변환 불가 항목 -> 원본 그대로 보존 칸 · 보내기에서 빠짐 · 나머지는 정상 · cache_fail 1', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': JSON.stringify([current, unconvertible]) })
    const sent: string[] = []
    const hub = new TextQueueHub({
      send: async (input) => { sent.push(input.clientMsgId); return { status: 'sent', row: { id: 'r' } as never } },
      store: createTextQueueStore(prefs, () => NOW),
    })
    hub.attach('c1', ME)
    await waitFor(() => expect(sent).toEqual(['q-now']))
    hub.detach()
    const kept = JSON.parse(localStorage.getItem(key('qkeep', 'text:c1'))!)
    expect(kept.d.entries.map((e: { raw: string }) => JSON.parse(e.raw))).toEqual([unconvertible])
    expect(failCount()).toBe(1)
  })

  it('저장 전체가 깨짐(JSON 아님 · 모르는 버전) -> 원본 글자 그대로 보존 · 새 항목은 저장되고 원본은 남음', async () => {
    for (const raw of ['{깨짐', JSON.stringify({ __v: 7, items: [] })]) {
      localStorage.clear(); clearAppErrorCounts(); resetCacheFailMemoryForTest(); resetQueueHoldForTest()
      const prefs = memPrefs({ 'chat_queue:c1': raw })
      const store = createTextQueueStore(prefs, () => NOW)
      expect(await store.load('c1', ME)).toEqual([])
      await store.save('c1', [current])
      expect(JSON.parse(prefs.data.get('chat_queue:c1')!).items).toEqual([current])
      expect(JSON.parse(localStorage.getItem(key('qkeep', 'text:c1'))!).d.entries[0].raw).toBe(raw)
      expect(failCount()).toBe(1)
      await store.load('c1', ME) // 다시 읽어도 같은 원본을 두 번 넣지 않음
      expect(countQueueOriginals(ME, 'text', 'c1')).toBe(1)
    }
  })

  it('보존 칸에 쓰지 못하면(저장 막힘) 원래 키를 덮어쓰지 않는다 - 원본이 원래 자리에 남음', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': '{깨짐' })
    const store = createTextQueueStore(prefs, () => NOW)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(await store.load('c1', ME)).toEqual([])
    await store.save('c1', [current])
    spy.mockRestore()
    expect(prefs.data.get('chat_queue:c1')).toBe('{깨짐')
  })

  it('읽기 전에 저장이 와도 읽기가 끝난 뒤에 쓴다(원본을 먼저 덮어쓰지 않음)', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((r) => { release = r })
    const base = memPrefs({ 'chat_queue:c1': JSON.stringify([oldShape]) })
    const prefs: PrefsLike = { get: async (o) => { await gate; return base.get(o) }, set: base.set }
    const store = createTextQueueStore(prefs, () => NOW)
    const loading = store.load('c1', ME)
    const saving = store.save('c1', [current])
    release()
    const items = await loading
    await saving
    expect(items.map((i) => i.clientMsgId)).toEqual(['q-old'])
  })
})

describe('81- 사진 대기열: 버리지 않음 · 파일 절대 지우지 않음', () => {
  const files = new Set<string>()
  const removed: string[] = []
  const fs: PhotoFs = {
    copyIn: async (_s, id, ext) => { const p = `chat-photo-queue/${id}.${ext}`; files.add(p); return p },
    exists: async (u) => files.has(u),
    readBytes: async () => new ArrayBuffer(1),
    remove: async (u) => { removed.push(u); files.delete(u) },
  }
  const oldPhoto = { clientId: 'p-old', kind: 'message', localUri: 'chat-photo-queue/p-old.jpg' } // 확장자 · 형식 · 커플 · 사용자 · 시각 · 횟수 · 상태 없음
  const badPhoto = { clientId: 'p-bad', localUri: 'chat-photo-queue/p-bad.png', type: 'msg' } // 종류 칸 없음 -> 변환 불가

  beforeEach(() => {
    files.clear(); removed.length = 0
    files.add(oldPhoto.localUri); files.add(badPhoto.localUri)
  })

  it('옛 모양 -> 변환되어 정상 전송 · 변환 불가 -> 원본 보존 · 보내기에서 빠짐 · 그 사진 파일은 남음', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:me': JSON.stringify([oldPhoto, badPhoto]) })
    const attempted: QueuedPhoto[] = []
    const hub = new PhotoQueueHub({
      attempt: async (item) => { attempted.push(item); return { outcome: 'done' } as AttemptedPhoto },
      fs,
      store: createPhotoQueueStore(prefs, () => NOW),
    })
    hub.attach('c1', ME)
    await waitFor(() => expect(attempted.map((a) => a.clientId)).toEqual(['p-old']))
    hub.detach()
    expect(attempted[0]).toMatchObject({ coupleId: 'c1', userId: ME, ext: 'jpg', contentType: 'image/jpeg', retryCount: 0, status: 'pending', sentAt: NOW.toISOString() })
    expect(files.has(badPhoto.localUri)).toBe(true)
    expect(removed).not.toContain(badPhoto.localUri)
    const kept = JSON.parse(localStorage.getItem(key('qkeep', 'photo:c1'))!)
    expect(kept.d.entries.map((e: { raw: string }) => JSON.parse(e.raw))).toEqual([badPhoto])
    expect(failCount()).toBe(1)
  })
})

describe('81- 삭제 규칙 회귀 0 + 보존 칸도 같은 규칙', () => {
  function seed() {
    writeCache(ME, 'feed', { chapters: [], names: {} })
    localStorage.setItem(key('qkeep', 'text:c1'), JSON.stringify({ __v: 1, d: { entries: [{ at: 'x', raw: '{"a":1}' }] } }))
    localStorage.setItem(key('qkeep', 'photo:c1', 'other'), JSON.stringify({ __v: 1, d: { entries: [{ at: 'x', raw: '{"b":1}' }] } }))
  }
  it('로그아웃 · 탈퇴 요청(clearAllDeviceCache) -> 보존 원본까지 지움', () => {
    seed(); clearAllDeviceCache()
    expect(localStorage.getItem(key('qkeep', 'text:c1'))).toBeNull()
    expect(localStorage.getItem(key('qkeep', 'photo:c1', 'other'))).toBeNull()
  })
  it('계정 전환(purgeOtherUsers) -> 다른 사람의 보존 원본을 지움 · 내 것은 남김', () => {
    seed()
    expect(purgeOtherUsers(ME)).toBe(1)
    expect(localStorage.getItem(key('qkeep', 'photo:c1', 'other'))).toBeNull()
    expect(localStorage.getItem(key('qkeep', 'text:c1'))).not.toBeNull()
  })
  it('해제 완료(clearCoupleCache) -> 커플 자료는 지우고 보존 원본은 대기열처럼 남김(기존 규칙: 대기열은 해제로 지우지 않음)', () => {
    seed(); clearCoupleCache(ME)
    expect(localStorage.getItem(key('feed'))).toBeNull()
    expect(localStorage.getItem(key('qkeep', 'text:c1'))).not.toBeNull()
  })
})

describe('81- 오류 건수 저장분(ondolog.err1)', () => {
  it('깨진 저장분 -> 빈 값으로 다시 시작 · cache_fail 1건', async () => {
    vi.resetModules()
    localStorage.setItem(ERROR_LOG_KEY, '{깨짐')
    const fresh = await import('../errorLog/errorLog')
    fresh.reportAppError('uncaught')
    const st = JSON.parse(localStorage.getItem(ERROR_LOG_KEY)!) as { v: number; buckets: Record<string, { kind: string; count: number }> }
    expect(st.v).toBe(1)
    expect(Object.values(st.buckets).map((b) => [b.kind, b.count]).sort()).toEqual([['cache_fail', 1], ['uncaught', 1]])
    fresh.clearAppErrorCounts()
  })
})
