/**
 * 피드 · 데이트 상세 · 기록 시험(74-4) - 원본: `__tests__/components/u2Feed.test.tsx`(피드 부품 · E03 타임라인 · I05) · `__tests__/services/dateRecordApi.test.ts`(기록 · 삭제 · stop 시각 · 규칙 6) ·
 * `__tests__/utils/dateRecord.test.ts`(EXIF 날짜 규칙 - 순수 규칙은 웹이 `@/utils/dateRecord`를 그대로 쓰므로 루트 jest가 지킨다, 여기는 화면에서 보이는 결과).
 * 서버는 가짜(`feedTestSupport.ts`) - 원격 0. 사진 선택기는 가짜(웹 입력은 jsdom에서 열 수 없다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { SheetHost } from '../../app/sheets'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { ToastHost } from '../../components/ToastHost'
import { makeFakeNav } from '../../testSupport'
import { FeedTab } from '../../tabs/FeedTab'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow, type FeedDbOptions } from './feedTestSupport'
import { DateDetailScreen } from './DateDetailScreen'
import { useFeedSignal } from './feedData'
import { AddFab, FeedChapterView, SoloBanner, monthCountsLabel } from './FeedView'
import type { WebPickedPhoto } from './photoPicker'
import { RecordSheetBody } from './RecordSheet'
import { StopEditScreen } from './StopEditScreen'

const picker = vi.hoisted(() => ({ next: [] as unknown[] }))
vi.mock('./photoPicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./photoPicker')>()
  return { ...actual, pickPhotos: vi.fn(async () => picker.next), readLocalBytes: vi.fn(async () => new ArrayBuffer(8)) }
})

function photo(key: string, capturedAt: string | null, over: Partial<WebPickedPhoto> = {}): WebPickedPhoto {
  return { uri: `blob:${key}`, width: 4000, height: 3000, byteSize: 8, mimeType: 'image/jpeg', ext: 'jpg', capturedAt, lat: null, lng: null, fileKey: key, ...over }
}

function useDb(opts: Partial<FeedDbOptions> = {}) {
  const db = makeFeedDb({ me: 'me', couples: [COUPLE_ROW], profiles: PROFILES, ...opts })
  setSupabaseForTest(db.client)
  return db
}

beforeEach(() => {
  picker.next = []
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

// ---------------------------------------------------------------------------
describe('피드 부품 (E01 · E13)', () => {
  it('월 머리 카운트는 "메모 N · 사진 N · 데이트 N"이고 별은 쓰지 않는다', () => {
    const label = monthCountsLabel({ memoTotal: 4, photoTotal: 18, dateTotal: 3 })
    expect(label).toBe('메모 4 · 사진 18 · 데이트 3')
    expect(label).not.toContain('별')
    expect(label).not.toContain('기록 4')
  })

  it('FeedChapterView: 대표 카드 아래 원문 한 줄과 작성자 · 제목이 비면 날짜 말로 · 카드를 누르면 그 데이트 id', () => {
    const chapter = {
      key: '2026-10', month: 10, year: 2026, photoTotal: 4, memoTotal: 1,
      dates: [
        { id: 'd1', date_on: '2026-10-15', dateOn: '2026-10-15', region: null, title: null, photoCount: 4, memoCount: 1, coverPath: null, quote: { text: '창밖 보면서 한참 있었다.', authorId: 'u1' } },
        { id: 'd2', date_on: '2026-10-03', dateOn: '2026-10-03', region: null, title: null, photoCount: 1, memoCount: 0, coverPath: null, quote: null },
      ],
    }
    const onOpen = vi.fn()
    render(<FeedChapterView chapter={chapter} urls={{}} names={{ u1: '서영' }} onOpenDate={onOpen} />)
    expect(screen.getByTestId('feed-quote').textContent).toBe('“창밖 보면서 한참 있었다.”')
    expect(screen.getByText('서영')).toBeTruthy()
    expect(screen.getByText('10월 15일 목요일')).toBeTruthy() // 앱이 제목을 지어내지 않는다
    expect(screen.getByText('사진 4 · 메모 1')).toBeTruthy()
    fireEvent.click(screen.getByText('10월 15일 목요일'))
    expect(onOpen).toHaveBeenCalledWith('d1')
  })

  it('E13 배너: 기록할 수 있으면 디자인 문구, 없으면 이유를 글로 적는다', () => {
    const { rerender } = render(<SoloBanner canRecord onInvite={() => {}} />)
    expect(screen.getByText('혼자서도 기록할 수 있어요')).toBeTruthy()
    rerender(<SoloBanner canRecord={false} onInvite={() => {}} />)
    expect(screen.getByText('초대 코드를 만들면 기록할 수 있어요')).toBeTruthy()
  })

  it('FAB: 비활성이면 눌러도 전달되지 않는다', () => {
    const onPress = vi.fn()
    render(<AddFab onPress={onPress} disabled />)
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    expect(onPress).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('피드 탭 (E01 · E13) - 가짜 서버', () => {
  const dates = [dateRow('d1', '2026-10-03'), dateRow('d2', '2026-10-15'), dateRow('d3', '2026-09-20')]
  const entries = [
    photoRow('p1', { date_id: 'd1' }), photoRow('p2', { date_id: 'd1' }), memoRow('m1', '스파이더맨 봤다.\n둘째 줄', { date_id: 'd1' }),
    photoRow('p3', { date_id: 'd2' }), memoRow('m2', '창밖 보면서 한참 있었다.', { date_id: 'd2', author_id: 'you' }),
    photoRow('p4', { date_id: 'd3' }),
  ]

  it('월 챕터는 최근 달이 먼저, 달마다 "메모 · 사진 · 데이트" 수, 대표 카드는 그 달의 가장 최근 데이트 + 원문 한 줄(첫 줄만) + 작성자', async () => {
    useDb({ dates, entries })
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('chapter-2026-10')
    const chapters = Array.from(document.querySelectorAll('[data-testid^="chapter-"]')).map((e) => e.getAttribute('data-testid'))
    expect(chapters).toEqual(['chapter-2026-10', 'chapter-2026-09'])
    expect(screen.getByTestId('month-counts-2026-10').textContent).toBe('메모 2 · 사진 3 · 데이트 2')
    expect(screen.getByTestId('month-counts-2026-09').textContent).toBe('메모 0 · 사진 1 · 데이트 1')
    const oct = within(screen.getByTestId('chapter-2026-10'))
    expect(oct.getByText('10월 15일 목요일')).toBeTruthy() // 대표 = 10/15
    expect(oct.getByTestId('feed-quote').textContent).toBe('“창밖 보면서 한참 있었다.”')
    expect(oct.getByText('서영')).toBeTruthy()
    // 둘 이상의 달이면 월 바로 가기(오른쪽 숫자)
    expect(within(screen.getByTestId('feed-index')).getAllByRole('button').map((b) => b.textContent)).toEqual(['10', '09'])
  })

  it('카드를 누르면 E03(date-detail)로 가고 데이트 id를 싣는다', async () => {
    useDb({ dates, entries })
    const nav = makeFakeNav()
    render(<FeedTab nav={nav} />)
    await screen.findByTestId('chapter-2026-10')
    fireEvent.click(screen.getByLabelText(/10월 15일 목요일/))
    expect(nav.push).toHaveBeenCalledWith('date-detail', { params: { id: 'd2' } })
  })

  it('불러오는 동안 I03 뼈대, 기록이 없으면 빈 상태(첫 기록 남기기)', async () => {
    useDb({})
    render(<FeedTab nav={makeFakeNav()} />)
    expect(screen.getByTestId('feed-skeleton')).toBeTruthy()
    expect(await screen.findByTestId('feed-empty')).toBeTruthy()
    expect(screen.getByText('기록을 남기면 여기에 쌓여요')).toBeTruthy()
  })

  it('지운 기록은 피드에서 빠진다(소프트 삭제된 사진 · 메모는 읽지 않는다)', async () => {
    useDb({ dates: [dateRow('d1', '2026-10-03')], entries: [photoRow('p1'), photoRow('p2', { deleted_at: '2026-10-04T00:00:00Z' }), memoRow('m1', '남은 메모'), memoRow('m2', '지운 메모', { deleted_at: '2026-10-04T00:00:00Z' })] })
    render(<FeedTab nav={makeFakeNav()} />)
    expect((await screen.findByTestId('month-counts-2026-10')).textContent).toBe('메모 1 · 사진 1 · 데이트 1')
  })

  it('연결된 유저: E13 배너가 없다 · 미연결 유저: 합쳐진 보기 대신 배너(혼자 기록)가 있고 기록은 된다(커플 행이 있을 때)', async () => {
    useDb({ dates, entries })
    const { unmount } = render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('chapter-2026-10')
    expect(screen.queryByTestId('solo-banner')).toBeNull()
    unmount()
    cleanup()

    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null })
    useDb({ dates, entries, couples: [{ id: 'c1', status: 'pending', user_a_id: 'me', user_b_id: null }] })
    render(<FeedTab nav={makeFakeNav()} />)
    // 기록할 커플 행을 읽기 전에는 배너도 I01 카드도 없다(문구가 번쩍 바뀌지 않는다)
    expect(screen.queryByTestId('solo-banner')).toBeNull()
    expect(screen.queryByTestId('couple-needed')).toBeNull()
    await screen.findByTestId('chapter-2026-10')
    expect(await screen.findByText('혼자서도 기록할 수 있어요')).toBeTruthy()
    await waitFor(() => expect((screen.getByTestId('feed-add-fab') as HTMLButtonElement).disabled).toBe(false))
  })

  it('규칙 6: 기록할 커플 행이 없으면 FAB 비활성 + 이유를 글로 적고, 커플 행을 만들지 않는다 · [초대 →]는 I01 시트를 한 번 연다', async () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null })
    const db = useDb({ couples: [] })
    render(<><FeedTab nav={makeFakeNav()} /><SheetHost /></>)
    expect(await screen.findByText('초대 코드를 만들면 기록할 수 있어요')).toBeTruthy()
    expect((screen.getByTestId('feed-add-fab') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    expect(useSheetStore.getState().current).toBeNull() // 비활성 - 아무 일도 없다
    expect((await screen.findByTestId('feed-empty')).textContent).toContain('첫 기록 남기기')
    expect((screen.getByRole('button', { name: '첫 기록 남기기' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('초대'))
    expect(useSheetStore.getState().current).toBe('couple-gate')
    expect(db.writes.filter((w) => w.table === 'couples')).toEqual([]) // 커플 행을 만들지 않는다
  })

  it('FAB(연결됨)은 E11 기록 시트를 연다 - 시트는 한 번에 하나', async () => {
    useDb({})
    render(<><FeedTab nav={makeFakeNav()} /><SheetHost /></>)
    await screen.findByTestId('feed-empty')
    await waitFor(() => expect((screen.getByTestId('feed-add-fab') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    expect(await screen.findByTestId('record-sheet')).toBeTruthy()
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    expect(document.querySelectorAll('[data-testid="record-sheet"]').length).toBe(1)
  })

  it('조회가 실패하면 오류 안내와 [다시 불러오기]', async () => {
    setSupabaseForTest(null)
    render(<FeedTab nav={makeFakeNav()} />)
    expect(await screen.findByTestId('feed-error')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
describe('E03 데이트 상세', () => {
  const dateOn = '2026-10-03'
  const base: Partial<FeedDbOptions> = {
    dates: [dateRow('d1', dateOn)],
    stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대 CGV'), stopRow('s1', 'd1', 1, '2026-10-03T16:40:00+09:00', null)],
    entries: [
      photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00', date_stop_id: 's0' }), // 저장된 배치가 규칙과 같다 - 맞추는 쓰기가 없다
      photoRow('p2', { captured_at: '2026-10-03T17:00:00+09:00', author_id: 'you' }),
      memoRow('m1', '스파이더맨 봤다', { created_at: '2026-10-03T20:00:00Z' }),
      memoRow('m2', '케이크가 맛있었다', { author_id: 'you', created_at: '2026-10-03T21:00:00Z' }),
    ],
  }
  const open = (nav = makeFakeNav()) =>
    render(<MemoryRouter initialEntries={['/date-detail?id=d1']}><DateDetailScreen nav={nav} /><SheetHost /><ToastHost aboveTabBar={false} /></MemoryRouter>)

  it('머리(날짜 말로 · 시간 폭 · 사진 · 메모 수) · stop별 타임라인(저장된 도착 시각 · 장소 · 규칙 4로 사진 배치) · 메모는 작성자와 함께', async () => {
    useDb(base)
    open()
    expect((await screen.findByTestId('detail-title')).textContent).toBe('10월 3일 토요일')
    expect(screen.getByText('14:30–17:00 · 사진 2 · 메모 2')).toBeTruthy()
    const stop0 = within(screen.getByTestId('stop-0'))
    expect(stop0.getByText('14:20')).toBeTruthy()
    expect(stop0.getByText('홍대 CGV')).toBeTruthy()
    expect(stop0.getByTestId('photo-p1')).toBeTruthy()
    const stop1 = within(screen.getByTestId('stop-1'))
    expect(stop1.getByText('16:40')).toBeTruthy()
    expect(stop1.getByText('장소 이름 더하기')).toBeTruthy()
    expect(stop1.getByTestId('photo-p2')).toBeTruthy() // 상대가 올린 사진도 같은 규칙으로 배치
    expect(within(screen.getByTestId('detail-memos')).getByText('— 서영')).toBeTruthy()
  })

  it('실제 00:00 도착 시각은 00:00으로 보인다(가리지 않는다)', async () => {
    useDb({ ...base, stops: [stopRow('s0', 'd1', 0, '2026-10-03T00:00:00+09:00', '자정 산책')], entries: [] })
    open()
    expect(await screen.findByText('00:00')).toBeTruthy()
    expect(screen.getByText('자정 산책')).toBeTruthy()
  })

  it('장소 줄을 누르면 E15(stop-edit)로 간다 - 데이트 id와 장소 id를 싣는다', async () => {
    useDb(base)
    const nav = makeFakeNav()
    open(nav)
    fireEvent.click(await screen.findByLabelText('홍대 CGV 장소 고치기'))
    expect(nav.push).toHaveBeenCalledWith('stop-edit', { params: { id: 'd1', stop: 's0' } })
  })

  it('⋯(삭제 진입점)은 내가 올린 사진 · 메모에만 있고 상대의 것에는 없다', async () => {
    useDb(base)
    open()
    await screen.findByTestId('detail-title')
    expect(screen.getByTestId('more-photo-p1')).toBeTruthy()
    expect(screen.queryByTestId('more-photo-p2')).toBeNull()
    expect(screen.getByTestId('more-memo-m1')).toBeTruthy()
    expect(screen.queryByTestId('more-memo-m2')).toBeNull()
    expect(document.querySelectorAll('[data-testid^="more-"]').length).toBe(2)
  })

  it('⋯ -> 확인 시트(되돌릴 수 없고 발행된 호에서는 지워지지 않아요) -> [지우기] = fn_delete_own_entry RPC만, 화면에서 사라진다', async () => {
    const db = useDb(base)
    open()
    await screen.findByTestId('detail-title')
    fireEvent.click(screen.getByTestId('more-photo-p1'))
    const sheet = await screen.findByTestId('delete-confirm')
    expect(within(sheet).getByText('이 사진을 지울까요?')).toBeTruthy()
    expect(within(sheet).getByText(/이미 발행된 호에서는 지워지지 않아요/)).toBeTruthy()
    expect(db.rpcCalls).toEqual([]) // 확인 전에는 아무것도 부르지 않는다
    fireEvent.click(within(sheet).getByTestId('confirm-yes'))
    await waitFor(() => expect(screen.queryByTestId('photo-p1')).toBeNull())
    expect(db.rpcCalls).toEqual([{ fn: 'fn_delete_own_entry', args: { p_entry_id: 'p1' } }])
    expect(db.writes.filter((w) => w.table === 'data_entries' && w.op === 'update')).toEqual([]) // 직접 update 0
    expect(screen.queryByTestId('delete-confirm')).toBeNull()
  })

  it('메모도 같은 길(메모 문구) · [취소]는 아무것도 지우지 않는다', async () => {
    const db = useDb(base)
    open()
    await screen.findByTestId('detail-title')
    fireEvent.click(screen.getByTestId('more-memo-m1'))
    const sheet = await screen.findByTestId('delete-confirm')
    expect(within(sheet).getByText('이 메모를 지울까요?')).toBeTruthy()
    expect(within(sheet).getByText(/지운 메모는 되돌릴 수 없어요/)).toBeTruthy()
    fireEvent.click(within(sheet).getByTestId('confirm-no'))
    await waitFor(() => expect(screen.queryByTestId('delete-confirm')).toBeNull())
    expect(db.rpcCalls).toEqual([])
    expect(screen.getByText('스파이더맨 봤다')).toBeTruthy()
  })

  it('지우기가 실패하면 토스트 "지우지 못했어요" · 화면의 기록은 그대로', async () => {
    useDb({ ...base, deleteFails: true })
    open()
    await screen.findByTestId('detail-title')
    fireEvent.click(screen.getByTestId('more-photo-p1'))
    fireEvent.click(await screen.findByTestId('confirm-yes'))
    expect(await screen.findByText('지우지 못했어요')).toBeTruthy()
    expect(screen.getByTestId('photo-p1')).toBeTruthy()
  })

  it('사진을 누르면 크게 보기가 열리고 ✕로 닫힌다', async () => {
    useDb(base)
    open()
    fireEvent.click(await screen.findByTestId('photo-p1'))
    expect(screen.getByTestId('photo-viewer')).toBeTruthy()
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('1 / 2')
    fireEvent.click(screen.getByTestId('photo-viewer-close'))
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
  })

  it('[사진 더하기]는 E10 화면 없이 바로 선택기를 열고, 고른 사진을 이 데이트에 곧바로 올린다 - 날짜 고정 · 장소 · 메모 · 위치 0', async () => {
    const db = useDb(base)
    open()
    await screen.findByTestId('detail-title')
    picker.next = [photo('f1', null)]
    const before = useFeedSignal.getState().version
    fireEvent.click(screen.getByTestId('detail-add-photos'))
    await waitFor(() => expect(db.uploads).toHaveLength(1))
    await waitFor(() => expect(useFeedSignal.getState().version).toBe(before + 1))
    expect(db.uploads[0].path).toMatch(/^c1\/[0-9a-f-]+\.jpg$/)
    expect(db.uploads[0].contentType).toBe('image/jpeg')
    const inserts = db.writes.filter((w) => w.op === 'insert')
    expect(inserts.map((w) => w.table)).toEqual(['data_entries']) // 데이트 · stop · 메모를 새로 만들지 않는다
    expect(inserts[0].payload).toMatchObject({ date_id: 'd1', couple_id: 'c1', author_id: 'me', entry_type: 'photo', lat: null, lng: null, captured_at: null })
  })

  it('stop이 없는 데이트에 촬영 시각 없는 사진을 더하면 이유를 토스트로 알리고 아무것도 쓰지 않는다(R30-2)', async () => {
    const db = useDb({ ...base, stops: [], entries: [memoRow('m1', '메모만')] })
    open()
    await screen.findByTestId('detail-title')
    picker.next = [photo('f1', null)]
    fireEvent.click(screen.getByTestId('detail-add-photos'))
    expect(await screen.findByText('사진에 촬영 시각이 없어요. 첫 장소의 도착 시각을 써 주세요')).toBeTruthy()
    expect(db.uploads).toEqual([])
    expect(db.writes).toEqual([])
  })

  it('사진을 고르지 않고 닫으면 아무 일도 없다', async () => {
    const db = useDb(base)
    open()
    await screen.findByTestId('detail-title')
    picker.next = []
    fireEvent.click(screen.getByTestId('detail-add-photos'))
    await act(async () => { await Promise.resolve() })
    expect(db.uploads).toEqual([])
    expect(db.writes).toEqual([])
  })

  it('없는 데이트는 안내 문구', async () => {
    useDb({})
    open()
    expect(await screen.findByText('이 데이트를 찾을 수 없어요')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
describe('E15 장소 고치기', () => {
  const base: Partial<FeedDbOptions> = {
    dates: [dateRow('d1', '2026-10-03')],
    stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대 CGV'), stopRow('s1', 'd1', 1, '2026-10-03T16:40:00+09:00', '디저트 카페')],
    entries: [photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00' })],
  }
  const open = (stop: string, nav = makeFakeNav()) =>
    render(<MemoryRouter initialEntries={[`/stop-edit?id=d1&stop=${stop}`]}><StopEditScreen nav={nav} /><ToastHost aboveTabBar={false} /></MemoryRouter>)

  it('저장된 이름과 도착 시각을 채워 보이고, 이름을 고쳐 저장하면 장소만 고쳐진다(위치 칸은 건드리지 않는다)', async () => {
    const db = useDb(base)
    const nav = makeFakeNav()
    open('s0', nav)
    const name = (await screen.findByTestId('stop-name-input')) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('홍대 CGV'))
    expect((screen.getByTestId('stop-clock-input') as HTMLInputElement).value).toBe('14:20')
    fireEvent.change(name, { target: { value: '연남동 케이크' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(nav.back).toHaveBeenCalled())
    const update = db.writes.find((w) => w.table === 'date_stops' && w.op === 'update' && 'place_name' in w.payload)
    expect(update?.payload).toEqual({ place_name: '연남동 케이크', arrived_at: '2026-10-03T14:20:00+09:00' })
    expect(Object.keys(update?.payload ?? {})).not.toContain('lat')
    expect(Object.keys(update?.payload ?? {})).not.toContain('place_provider_id')
  })

  it('첫 장소는 도착 시각을 비우면 사진의 가장 이른 촬영 시각이 된다(저장 가능)', async () => {
    const db = useDb(base)
    open('s0')
    const clock = (await screen.findByTestId('stop-clock-input')) as HTMLInputElement
    await waitFor(() => expect(clock.value).toBe('14:20'))
    fireEvent.change(clock, { target: { value: '' } })
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(db.writes.some((w) => w.table === 'date_stops' && w.op === 'update')).toBe(true))
    expect(db.writes.find((w) => w.table === 'date_stops' && w.op === 'update')?.payload).toMatchObject({ arrived_at: '2026-10-03T14:30:00+09:00' })
  })

  it('둘째부터는 도착 시각이 필수 - 비우면 이유를 글로 적고 저장은 꺼진다 · 형식이 틀려도 같다', async () => {
    const db = useDb(base)
    open('s1')
    const clock = (await screen.findByTestId('stop-clock-input')) as HTMLInputElement
    await waitFor(() => expect(clock.value).toBe('16:40'))
    fireEvent.change(clock, { target: { value: '' } })
    expect(screen.getByTestId('stop-clock-note').textContent).toContain('도착 시각을 써 주세요')
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(clock, { target: { value: '2599' } })
    expect(screen.getByTestId('stop-clock-note').textContent).toBe('도착 시각은 00:00부터 23:59 사이로 써 주세요')
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true)
    expect(db.writes).toEqual([])
  })

  it('저장이 실패하면 토스트 · 화면은 그대로', async () => {
    const db = useDb(base)
    const nav = makeFakeNav()
    open('s0', nav)
    const name = (await screen.findByTestId('stop-name-input')) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('홍대 CGV'))
    // 이 데이트의 장소가 아니게 만든다(updateStop이 던진다).
    db.tables.date_stops.length = 0
    fireEvent.change(name, { target: { value: '다른 곳' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('장소를 고치지 못했어요')).toBeTruthy()
    expect(nav.back).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
describe('E11 데이트 기록 쓰기', () => {
  const T1 = '2026-10-03T14:20:11+09:00'
  const T2 = '2026-10-03T19:05:00+09:00'

  async function opened(opts: Partial<FeedDbOptions> = {}) {
    const db = useDb(opts)
    render(<><RecordSheetBody /><ToastHost aboveTabBar={false} /></>)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 남기기' })).toBeTruthy())
    return db
  }
  /** 선택기가 `photos`를 돌려주게 하고 [+]를 누른다. `total` = 고른 뒤 화면의 총 장수. */
  const pick = async (photos: WebPickedPhoto[], total: number = photos.length) => {
    picker.next = photos
    await act(async () => { fireEvent.click(screen.getByTestId('pick-photos')) })
    await screen.findByText(`${total}장 골랐어요`)
  }
  const saveBtn = () => screen.getByRole('button', { name: '기록 남기기' }) as HTMLButtonElement

  it('사진을 고르면 날짜가 가장 이른 촬영 시각의 날짜(KST)로 채워지고 안내 문구가 나온다 - 시간 칸은 없다(촬영 시각이 있으니)', async () => {
    await opened()
    await pick([photo('a', T2), photo('b', T1)])
    expect(screen.getByTestId('row-date').textContent).toContain('2026.10.03 토요일')
    expect(screen.getByTestId('exif-note').textContent).toBe('사진의 촬영 시각으로 날짜를 먼저 채웠어요')
    expect(screen.queryByTestId('row-time')).toBeNull()
  })

  it('촬영 시각이 없는 사진: 오늘 날짜 + 다른 안내 문구 + 시간 칸(장소와 도착 시각이 필요)이 나오고, 이유를 적고 기록은 꺼진다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T03:00:00Z')) // KST 2026-10-21
    await opened()
    await pick([photo('a', null)])
    await waitFor(() => expect(screen.getByTestId('row-date').textContent).toContain('2026.10.21'))
    expect(screen.getByTestId('row-date').textContent).toContain('2026.10.21')
    expect(screen.getByTestId('exif-note').textContent).toBe('촬영 시각이 없어 오늘 날짜로 채웠어요')
    expect(screen.getByTestId('row-time').textContent).toContain('장소와 도착 시각이 필요해요')
    expect(screen.getByTestId('stop-time-error').textContent).toBe('사진에 촬영 시각이 없어요. 첫 장소의 도착 시각을 써 주세요')
    expect(saveBtn().disabled).toBe(true)
    vi.useRealTimers()
  })

  it('시간 칸을 누르면 장소 칸이 열리고, 이름 + 도착 시각을 쓰면 기록이 켜지며 시간 칸은 사라진다', async () => {
    await opened()
    await pick([photo('a', null)])
    fireEvent.click(screen.getByTestId('row-time'))
    const panel = within(screen.getByTestId('places-panel'))
    fireEvent.change(panel.getByLabelText('장소 1 이름'), { target: { value: '홍대 CGV' } })
    expect(saveBtn().disabled).toBe(true) // 이름만으로는 아직(도착 시각 필요)
    fireEvent.change(panel.getByLabelText('장소 1 도착 시각'), { target: { value: '1420' } })
    expect((panel.getByLabelText('장소 1 도착 시각') as HTMLInputElement).value).toBe('14:20')
    expect(saveBtn().disabled).toBe(false)
    expect(screen.queryByTestId('row-time')).toBeNull()
    expect(screen.getByTestId('row-places').textContent).toContain('홍대 CGV')
  })

  it('사용자가 날짜를 고치면 사진을 더 골라도 더는 덮어쓰지 않는다', async () => {
    await opened()
    await pick([photo('a', T1)])
    fireEvent.click(screen.getByTestId('row-date'))
    fireEvent.change(screen.getByTestId('date-input'), { target: { value: '20260915' } })
    expect((screen.getByTestId('date-input') as HTMLInputElement).value).toBe('2026-09-15')
    fireEvent.click(screen.getByRole('button', { name: '날짜 정하기' }))
    expect(screen.getByTestId('row-date').textContent).toContain('2026.09.15')
    await pick([photo('b', '2026-08-01T10:00:00+09:00')], 2)
    expect(screen.getByTestId('row-date').textContent).toContain('2026.09.15')
    expect(screen.getByTestId('exif-note').textContent).toBe('') // 이미 날짜를 정했다
  })

  it('같은 사진을 두 번 고르면 한 번만 · 사진을 누르면 빠진다', async () => {
    await opened()
    await pick([photo('a', T1)])
    picker.next = [photo('a', T1), photo('b', T2)]
    fireEvent.click(screen.getByTestId('pick-photos'))
    await screen.findByText('2장 골랐어요')
    fireEvent.click(screen.getAllByLabelText('이 사진 빼기')[0])
    expect(screen.getByTestId('photo-count').textContent).toBe('1장 골랐어요')
  })

  it('기록 남기기: 사진 업로드(원본 그대로) -> 데이트(manual · 확인됨) -> stop -> 사진 행(위치 null) -> 메모 행 -> 파생 칸. 피드에 알린다', async () => {
    const db = await opened()
    await pick([photo('a', T1), photo('b', T2)])
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: '스파이더맨 봤다. 서영이는 중간에 졸았음' } })
    const before = useFeedSignal.getState().version
    fireEvent.click(saveBtn())
    await waitFor(() => expect(useFeedSignal.getState().version).toBe(before + 1))
    expect(db.uploads.map((u) => u.bucket)).toEqual(['entries', 'entries'])
    const inserts = db.writes.filter((w) => w.op === 'insert')
    expect(inserts.map((w) => w.table)).toEqual(['dates', 'date_stops', 'data_entries', 'data_entries', 'data_entries'])
    expect(inserts[0].payload).toEqual({ couple_id: 'c1', date_on: '2026-10-03', source: 'manual', user_confirmed: true })
    expect(inserts[1].payload).toMatchObject({ seq: 0, arrived_at: T1 }) // 첫 장소(이름 없음)의 도착 시각 = 가장 이른 촬영 시각
    const photos = inserts.filter((w) => w.payload.entry_type === 'photo').map((w) => w.payload)
    expect(photos).toHaveLength(2)
    for (const p of photos) expect(p).toMatchObject({ author_id: 'me', couple_id: 'c1', lat: null, lng: null, width: 4000, height: 3000 })
    expect(photos.map((p) => p.captured_at).sort()).toEqual([T1, T2])
    expect(inserts[4].payload).toMatchObject({ entry_type: 'memo', text_content: '스파이더맨 봤다. 서영이는 중간에 졸았음', date_stop_id: null })
    const derived = db.writes.find((w) => w.table === 'dates' && w.op === 'update')
    expect(derived?.payload).toMatchObject({ photo_count: 2, has_user_note: true, duration_minutes: 285 })
    // 앱이 쓰지 않는 값
    for (const w of db.writes) for (const k of ['title', 'narrative', 'is_new_region', 'region', 'thumb_path']) expect(Object.keys(w.payload)).not.toContain(k)
  })

  it('메모만 기록해도 된다(사진 0 · stop 0) · 같은 날짜에 다시 기록하면 그 데이트에 더한다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T03:00:00Z')) // KST 2026-10-21 - 열 때의 "오늘"
    const db = await opened({ dates: [dateRow('d9', '2026-10-21')] })
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: '오늘은 쉬었다' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(db.writes.some((w) => w.table === 'data_entries')).toBe(true))
    expect(db.writes.filter((w) => w.table === 'dates' && w.op === 'insert')).toEqual([]) // 새 데이트를 만들지 않았다
    expect(db.writes.filter((w) => w.table === 'date_stops')).toEqual([])
    expect(db.writes.find((w) => w.table === 'data_entries')?.payload).toMatchObject({ date_id: 'd9', entry_type: 'memo' })
    vi.useRealTimers()
  })

  it('사진을 올리지 못하면(재시도 뒤에도) 토스트로 알리고 행을 만들지 않는다 - 전부 실패하고 메모가 없으면 아무것도 쓰지 않는다', async () => {
    const db = await opened({ uploadFailures: 99 })
    await pick([photo('a', T1)])
    fireEvent.click(saveBtn())
    expect(await screen.findByText('기록하지 못했어요', {}, { timeout: 4000 })).toBeTruthy() // 세 번 시도(400ms 간격) 뒤
    expect(db.writes).toEqual([])
  })

  it('규칙 6: 기록할 커플 행이 없으면 기록은 꺼져 있고 이유를 적는다 - 커플 행을 만들지 않는다', async () => {
    const db = useDb({ couples: [] })
    render(<RecordSheetBody />)
    expect(await screen.findByTestId('no-couple-note')).toBeTruthy()
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: '메모' } })
    expect(saveBtn().disabled).toBe(true)
    expect(db.writes).toEqual([])
  })

  it('✕는 시트를 닫는다 · 헤더 제목은 "데이트 기록"', async () => {
    await opened()
    expect(screen.getByText('데이트 기록')).toBeTruthy()
    expect(screen.getByLabelText('닫기')).toBeTruthy()
  })
})
