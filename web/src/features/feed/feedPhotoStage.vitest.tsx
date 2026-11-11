/**
 * 74-h4 피드 사진(F1 · B1) 시험 - 고르기 -> 읽기(선택기 주소 fetch 0) -> 앱 소유 복사본 -> 업로드(RN 규칙), 썸네일 · "다시 고르기", EXIF 날짜, 진단 단계.
 * 서버는 가짜(`feedTestSupport.ts`), 파일 시스템 플러그인은 메모리 가짜, 선택기만 가짜(웹 입력은 jsdom에서 열 수 없다). 원격 0.
 * 자동으로 지키지 못하는 것(폰에서만): 선택기가 실제로 갤러리로 뜨는지(Android 10) · WebView에서 선택기 파일이 실제로 읽히는지 · 실제 업로드.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { PhotoSourceSheet } from '../../components/PhotoSourceSheet'
import { ToastHost } from '../../components/ToastHost'
import { useTrialDiag } from '../../platform/trialDiag'
import { useCoupleStore } from '../../stores/coupleStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeNav } from '../../testSupport'
import { DateDetailScreen } from './DateDetailScreen'
import { FEED_PICK_DIR, pickFeedPhotos, readStagedBytes, releaseStaged, stageFiles, stagedCount, type StageDeps } from './feedPhotoStage'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow, type FeedDbOptions } from './feedTestSupport'
import { RecordSheetBody } from './RecordSheet'

// ── 메모리 파일 시스템(@capacitor/filesystem 가짜) ───────────────────────────
const store = vi.hoisted(() => ({ files: new Map<string, string>(), writes: [] as { path: string; directory: string }[], failWrite: false, failRead: false }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE', Data: 'DATA', Documents: 'DOCUMENTS' },
  Filesystem: {
    writeFile: async (o: { path: string; data: string; directory: string }) => {
      if (store.failWrite) throw new Error('disk')
      store.files.set(o.path, o.data)
      store.writes.push({ path: o.path, directory: o.directory })
    },
    readFile: async (o: { path: string }) => {
      if (store.failRead) throw new Error('gone')
      const data = store.files.get(o.path)
      if (data === undefined) throw new Error('missing')
      return { data }
    },
    deleteFile: async (o: { path: string }) => { store.files.delete(o.path) },
    stat: async () => ({}),
  },
}))

// 선택기: 웹 입력 대신 시험이 정한 파일을 돌려준다(캡처 여부 기록).
const picker = vi.hoisted(() => ({ files: [] as unknown[], calls: [] as { limit: number; capture: boolean }[], exif: null as Record<string, unknown> | null }))
vi.mock('./photoPicker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./photoPicker')>()
  return { ...actual, readImageSize: async () => null, readExifTags: async () => picker.exif, chooseFiles: vi.fn(async (limit: number, capture: boolean) => { picker.calls.push({ limit, capture }); return picker.files }) }
})

const BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, 4])
const jpeg = (name = 'IMG_1.jpg', type = 'image/jpeg') => new File([BYTES as BlobPart], name, { type, lastModified: 1000 })
/** 읽을 수 없는 파일(선택기 참조가 읽히지 않는 상황) - `arrayBuffer()`도 FileReader도 실패한다. */
const unreadable = (name = 'bad.jpg') => ({ name, type: 'image/jpeg', size: 8, lastModified: 2000, arrayBuffer: async () => { throw new Error('NotReadableError') } }) as unknown as File

let urlSeq = 0
const fetchSpy = vi.fn()
const revoked: string[] = []
const made: Blob[] = []

function deps(over: Partial<StageDeps> = {}): StageDeps {
  return {
    makeUrl: (b) => { made.push(b); urlSeq += 1; return `blob:own-${urlSeq}` },
    revokeUrl: (u) => { revoked.push(u) },
    readExif: async () => null,
    readSize: async () => ({ width: 4000, height: 3000 }),
    newId: (() => { let n = 0; return () => `id${++n}` })(),
    ...over,
  }
}

beforeEach(() => {
  store.files.clear(); store.writes.length = 0; store.failWrite = false; store.failRead = false
  picker.files = []; picker.calls.length = 0; picker.exif = { DateTimeOriginal: '2026:10:03 14:20:11' } // 가짜 EXIF(촬영 시각만)
  urlSeq = 0; revoked.length = 0; made.length = 0
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
  // jsdom에는 Blob 주소 만들기가 없다 - 화면 시험용(이름만 다르게 해 앱 소유 주소임을 구분한다).
  ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => { urlSeq += 1; return `blob:own-${urlSeq}` }
  ;(URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u) => { revoked.push(u) }
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  useToastStore.getState().hide()
  useTrialDiag.getState().clearPhoto()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

function useDb(opts: Partial<FeedDbOptions> = {}) {
  const db = makeFeedDb({ me: 'me', couples: [COUPLE_ROW], profiles: PROFILES, ...opts })
  setSupabaseForTest(db.client)
  return db
}

// ---------------------------------------------------------------------------
describe('읽기 - 고르는 단계에서 File 자체를 한 번 읽고 앱이 가진 복사본만 쓴다', () => {
  it('선택기 주소를 fetch하지 않는다 · 앱 소유 미리보기 · 앱 캐시 폴더(feed-photo-picks, 채팅 큐 폴더와 분리)에 복사', async () => {
    const out = await stageFiles([jpeg()], false, deps())
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out).toHaveLength(1)
    expect(out[0].failed).toBeUndefined()
    expect(out[0].uri).toBe('blob:own-1') // 새 Blob에서 만든 앱 소유 주소
    expect(made[0]).toBeInstanceOf(Blob)
    expect(made[0].size).toBe(BYTES.length)
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0].directory).toBe('CACHE')
    expect(store.writes[0].path).toBe(`${FEED_PICK_DIR}/id1.jpg`)
    expect(FEED_PICK_DIR).not.toBe('chat-photo-queue')
    expect(new Uint8Array(await readStagedBytes(out[0].uri))).toEqual(BYTES) // 업로드용 바이트 = 복사본
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('정리: 복사본을 지우고 미리보기 주소를 놓는다 · 두 번 불러도 괜찮다', async () => {
    const out = await stageFiles([jpeg()], false, deps())
    const before = stagedCount()
    releaseStaged(out, undefined, (u) => revoked.push(u))
    releaseStaged(out, undefined, (u) => revoked.push(u))
    await waitFor(() => expect(store.files.size).toBe(0))
    expect(revoked).toEqual(['blob:own-1'])
    expect(stagedCount()).toBe(before - 1)
    await expect(readStagedBytes('blob:own-1')).rejects.toThrow()
  })

  it('읽기에 실패한 사진은 자리표시(failed)로 돌려주고 나머지는 간다', async () => {
    const out = await stageFiles([jpeg('a.jpg'), unreadable(), jpeg('c.jpg')], false, deps())
    expect(out.map((p) => !!p.failed)).toEqual([false, true, false])
    expect(out[1].uri).toBe('')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('복사에 실패하면 그 사진만 메모리에 둔다(읽기 실패로 버리지 않는다)', async () => {
    store.failWrite = true
    const out = await stageFiles([jpeg()], false, deps())
    expect(out[0].failed).toBeUndefined()
    expect(new Uint8Array(await readStagedBytes(out[0].uri))).toEqual(BYTES)
  })

  it('앨범 = 여러 장 선택기, 카메라 = 한 장 capture 선택기', async () => {
    picker.files = [jpeg()]
    await pickFeedPhotos(false, deps())
    await pickFeedPhotos(true, deps())
    expect(picker.calls).toEqual([{ limit: 30, capture: false }, { limit: 1, capture: true }])
  })
})

describe('EXIF 촬영일 - 읽은 바이트에서, 위치는 읽지 않는다', () => {
  const exif = (v: string) => async () => ({ DateTimeOriginal: v })

  it('EXIF가 있는 파일 -> 촬영 시각 · 없는 파일 -> null(날짜는 화면이 오늘로)', async () => {
    const withExif = await stageFiles([jpeg()], false, deps({ readExif: exif('2026:10:03 14:20:11') }))
    expect(withExif[0].capturedAt).toBe('2026-10-03T14:20:11+09:00')
    expect(withExif[0].lat).toBeNull()
    expect(withExif[0].lng).toBeNull()
    const without = await stageFiles([jpeg()], false, deps())
    expect(without[0].capturedAt).toBeNull()
  })

  it('EXIF 읽기는 앱 소유 Blob을 받는다(선택기 주소가 아니다)', async () => {
    const seen: unknown[] = []
    await stageFiles([jpeg()], false, deps({ readExif: async (b) => { seen.push(b); return null } }))
    expect(seen[0]).toBeInstanceOf(Blob)
    expect(typeof seen[0]).not.toBe('string')
  })

  it('카메라: EXIF 촬영 시각이 없으면 지금 시각 · 있으면 EXIF 그대로', async () => {
    const now = () => new Date('2026-11-11T05:30:00Z')
    const none = await stageFiles([jpeg()], true, deps({ now }))
    expect(none[0].capturedAt).toBe('2026-11-11T05:30:00.000Z')
    const has = await stageFiles([jpeg()], true, deps({ now, readExif: exif('2026:10:03 14:20:11') }))
    expect(has[0].capturedAt).toBe('2026-10-03T14:20:11+09:00')
    const album = await stageFiles([jpeg()], false, deps({ now }))
    expect(album[0].capturedAt).toBeNull() // 앨범은 지어내지 않는다
  })
})

// ---------------------------------------------------------------------------
describe('입구 시트 - 채팅과 같은 부품', () => {
  it('[앨범] · [카메라]를 누르면 시트가 닫히며 해당 길이 불린다(채팅과 같은 testid)', () => {
    const onAlbum = vi.fn(); const onCamera = vi.fn()
    render(<PhotoSourceSheet testId="x" onAlbum={onAlbum} onCamera={onCamera} onClosed={() => {}} />)
    expect(screen.getByTestId('chat-attach-sheet-body')).toBeTruthy()
    fireEvent.click(screen.getByTestId('chat-attach-album'))
    expect(onAlbum).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('chat-attach-camera'))
    expect(onCamera).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
describe('기록 시트 - 고르기 -> 썸네일 -> 저장(RN 규칙)', () => {
  const T = '2026:10:03 14:20:11'
  async function opened(opts: Partial<FeedDbOptions> = {}) {
    const db = useDb(opts)
    render(<><RecordSheetBody /><ToastHost aboveTabBar={false} /></>)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 남기기' })).toBeTruthy())
    return db
  }
  async function chooseVia(which: 'album' | 'camera') {
    fireEvent.click(screen.getByTestId('pick-photos'))
    await act(async () => { fireEvent.click(await screen.findByTestId(`chat-attach-${which}`)) })
  }

  it('+ -> 입구 시트 -> [앨범] -> 썸네일이 앱 소유 주소로 보이고, 저장하면 RN과 같은 버킷 · 경로 · contentType · 행으로 올라간다', async () => {
    const db = await opened()
    picker.files = [jpeg()]
    await chooseVia('album')
    await screen.findByText('1장 골랐어요')
    await waitFor(() => expect(screen.getByTestId('row-date').textContent).toContain('2026.10.03')) // 가짜 EXIF 촬영일로 날짜가 채워진다
    const img = document.querySelector('.thumb img') as HTMLImageElement
    expect(img.getAttribute('src')).toMatch(/^blob:own-/)
    expect(fetchSpy).not.toHaveBeenCalled() // 선택기 blob 주소 fetch 0
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    await waitFor(() => expect(db.uploads).toHaveLength(1))
    expect(db.uploads[0].bucket).toBe('entries')
    expect(db.uploads[0].path).toMatch(/^c1\/[0-9a-f-]+\.jpg$/)
    expect(db.uploads[0].contentType).toBe('image/jpeg')
    expect(db.uploads[0].bytes).toBe(BYTES.length)
    const photo = db.writes.find((w) => w.table === 'data_entries' && w.payload.entry_type === 'photo')
    expect(photo?.payload).toMatchObject({ couple_id: 'c1', author_id: 'me', entry_type: 'photo', lat: null, lng: null, byte_size: BYTES.length, storage_path: db.uploads[0].path })
    expect(fetchSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(store.files.size).toBe(0)) // 저장 성공 뒤 복사본 정리
    expect(revoked.length).toBeGreaterThan(0)
  })

  it('[카메라] -> 한 장 capture 선택기', async () => {
    await opened()
    picker.files = [jpeg()]
    picker.exif = null // 카메라가 EXIF를 남기지 않은 경우
    await chooseVia('camera')
    await screen.findByText('1장 골랐어요')
    expect(picker.calls.at(-1)).toEqual({ limit: 1, capture: true })
    // EXIF가 없는 카메라 사진은 지금 시각으로 날짜가 채워진다(안내 문구 = 촬영 시각 있음)
    expect(screen.getByTestId('exif-note').textContent).toBe('사진의 촬영 시각으로 날짜를 먼저 채웠어요')
  })

  it('읽기에 실패한 사진: 빈 칸 대신 "다시 고르기" · 장수에 세지 않고 저장 대상에서 제외 · 누르면 그 칸을 빼고 입구 시트', async () => {
    const db = await opened()
    picker.files = [unreadable(), jpeg('ok.jpg')]
    await chooseVia('album')
    await screen.findByText('1장 골랐어요')
    expect(screen.getByTestId('repick-photo').textContent).toBe('다시 고르기')
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: '메모' } })
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    await waitFor(() => expect(db.uploads).toHaveLength(1)) // 읽기 실패 사진은 올리지 않는다
    expect(db.writes.filter((w) => w.table === 'data_entries' && w.payload.entry_type === 'photo')).toHaveLength(1)
  })

  it('"다시 고르기"를 누르면 그 칸이 빠지고 입구 시트가 다시 열린다', async () => {
    await opened()
    picker.files = [unreadable()]
    await chooseVia('album')
    fireEvent.click(await screen.findByTestId('repick-photo'))
    expect(screen.queryByTestId('repick-photo')).toBeNull()
    expect(await screen.findByTestId('feed-attach-sheet')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
describe('데이트 상세 [사진 더하기] - 사진 0장으로 저장된 기록에 다시 올린다', () => {
  const base = { dates: [dateRow('d1', '2026-10-03')], stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대')], entries: [memoRow('m1', '메모만 저장됨')] }
  it('같은 입구 시트 -> 같은 읽기 경로 -> 업로드(날짜 고정) - 선택기 주소 fetch 0', async () => {
    const db = useDb(base)
    render(<MemoryRouter initialEntries={['/date-detail?id=d1']}><DateDetailScreen nav={makeFakeNav()} /></MemoryRouter>)
    await screen.findByTestId('detail-title')
    picker.files = [jpeg()]
    fireEvent.click(screen.getByTestId('detail-add-photos'))
    expect(await screen.findByTestId('detail-attach-sheet')).toBeTruthy()
    fireEvent.click(screen.getByTestId('chat-attach-album'))
    await waitFor(() => expect(db.uploads).toHaveLength(1))
    expect(db.uploads[0]).toMatchObject({ bucket: 'entries', contentType: 'image/jpeg' })
    expect(fetchSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(store.files.size).toBe(0))
  })
})

// ---------------------------------------------------------------------------
describe('진단(시험 빌드) - 실패 단계 이름과 짧은 분류만', () => {
  const diagText = () => screen.getByTestId('photo-diag').textContent ?? ''
  async function recordWith(opts: Partial<FeedDbOptions>, tweak?: (db: ReturnType<typeof useDb>) => void) {
    const db = useDb(opts)
    tweak?.(db)
    render(<><RecordSheetBody /><ToastHost aboveTabBar={false} /></>)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 남기기' })).toBeTruthy())
    picker.files = [jpeg('secret-name.jpg')]
    fireEvent.click(screen.getByTestId('pick-photos'))
    await act(async () => { fireEvent.click(await screen.findByTestId('chat-attach-album')) })
    await screen.findByText('1장 골랐어요')
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: '메모' } })
    return db
  }

  it('읽기 실패(고르는 단계)는 "사진 읽기"로 기록된다', async () => {
    useDb()
    render(<RecordSheetBody />)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 남기기' })).toBeTruthy())
    picker.files = [unreadable('private-photo.jpg')]
    fireEvent.click(screen.getByTestId('pick-photos'))
    await act(async () => { fireEvent.click(await screen.findByTestId('chat-attach-album')) })
    await screen.findByTestId('repick-photo')
    expect(useTrialDiag.getState().photo).toEqual({ step: 'read', kind: 'TypeError' })
  })

  it('저장 때 업로드 바이트 읽기 실패는 "사진 읽기", 화면에 단계 이름이 작게 나오고 파일 이름 · 경로 · 주소는 없다', async () => {
    await recordWith({})
    store.failRead = true
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    await waitFor(() => expect(screen.getByTestId('photo-diag')).toBeTruthy(), { timeout: 4000 })
    expect(diagText()).toContain('사진 읽기')
    expect(diagText()).not.toMatch(/secret|feed-photo-picks|blob:|https?:|\.jpg|c1\//)
  })

  it('업로드가 오류로 끝나면 "사진 올리기"', async () => {
    await recordWith({ uploadFailures: 99 })
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    await waitFor(() => expect(screen.getByTestId('photo-diag')).toBeTruthy(), { timeout: 4000 })
    expect(diagText()).toContain('사진 올리기')
    expect(useTrialDiag.getState().photo?.step).toBe('upload') // 뒤따르는 연쇄 실패가 덮어쓰지 않는다
  })

  it('사진 행 저장이 실패하면 "행 저장"', async () => {
    await recordWith({}, (db) => {
      const client = db.client as unknown as { from: (t: string) => unknown }
      const real = client.from.bind(client)
      client.from = (t: string) => (t === 'data_entries' ? { insert: async () => ({ error: { code: '42501', message: 'rls' } }) } : real(t))
    })
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    await waitFor(() => expect(screen.getByTestId('photo-diag')).toBeTruthy(), { timeout: 4000 })
    expect(diagText()).toContain('행 저장')
    expect(diagText()).toContain('Error') // `recordDate`가 오류를 글로 감싸 던지므로 분류는 `Error`(오류 원문은 읽지 않는다)
  })

  it('실패 안내 토스트는 지금 문구 그대로 · 그 아래에 진단 줄', async () => {
    await recordWith({ uploadFailures: 99 }) // 메모가 있어 기록은 저장되고 사진만 실패한다
    fireEvent.click(screen.getByRole('button', { name: '기록 남기기' }))
    expect(await screen.findByText('일부 사진은 올리지 못했어요. 1장은 다시 올려 주세요', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByTestId('photo-diag-toast').textContent).toContain('사진 올리기')
  })
})
