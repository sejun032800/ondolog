/**
 * 83-(R121-3 · R120-4) 사진 대기열 파일을 사용자별 폴더에 두고, 계정 전환 때 이전 주인 폴더째 지운다.
 *  - 정상 저장값 + 전환 -> 이전 주인 폴더 0 · 지금 주인 폴더 그대로
 *  - 깨진 저장값 + 전환 -> 이전 주인 폴더 0(82- 한계 닫힘)
 *  - 83- 이전 자리 파일 옮기기: 옮긴 뒤 정상 전송 1번 · 옮기다 실패 -> 원본 남음 · 다시 읽을 때 이어감 · 저장값을 못 쓰면 새 복사본만 지움
 *  - 주인을 모르는 옛 자리 파일: 지금 사용자 것이 아님이 확실할 때만 지움
 *  - 같은 계정 재로그인 -> 사진 · 글 각 1번 이어서
 * 파일은 `@capacitor/filesystem` 모양의 메모리 가짜(`FilesystemLike`)에 실제 구현(`createWebPhotoFs` · `createPhotoQueueFiles`)을 얹는다. 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { QueuedMessage } from '@/utils/chatQueue'
import type { QueuedPhoto } from '@/utils/chatPhotoQueue'
import type { AttemptedPhoto } from '@/services/chatPhotoCore'
import { setSupabaseForTest } from './auth/client'
import { useAuthStore } from './auth/stores'
import { clearAppErrorCounts } from './errorLog/errorLog'
import { resetCacheFailMemoryForTest } from './cache/deviceCache'
import { purgePhotoFolders, startQueueOwnerPurge, type OwnerPurgeDeps, type PrefsAllLike } from './cache/queueOwner'
import { resetQueueHoldForTest } from './cache/queueStorage'
import { TextQueueHub, createTextQueueStore } from './features/chat/textQueueHub'
import { PhotoQueueHub } from './photoQueue/photoQueueHub'
import { createPhotoQueueStore } from './photoQueue/photoQueueStore'
import { createPhotoQueueFiles, createWebPhotoFs, isLegacyQueuePath, userQueueDir, type FilesystemLike } from './photoQueue/webPhotoFs'

const A = 'user-a'
const B = 'user-b'
const NOW = new Date('2026-11-18T03:00:00Z')

function memPrefs(init: Record<string, string> = {}): PrefsAllLike & { data: Map<string, string>; failSet: Set<string> } {
  const data = new Map(Object.entries(init))
  const failSet = new Set<string>()
  return {
    data,
    failSet,
    get: async ({ key: k }) => ({ value: data.get(k) ?? null }),
    set: async ({ key: k, value }) => {
      if (failSet.has(k)) throw new Error('blocked')
      data.set(k, value)
    },
    remove: async ({ key: k }) => { data.delete(k) },
    keys: async () => ({ keys: [...data.keys()] }),
  }
}

/** `@capacitor/filesystem` 모양의 메모리 가짜(경로 -> base64). 폴더는 경로 접두사로 본다. */
function memFilesystem(paths: string[] = []): FilesystemLike & { files: Map<string, string>; failWrite: (p: string) => boolean } {
  const files = new Map(paths.map((p) => [p, 'QUJD'] as [string, string]))
  const self = {
    files,
    failWrite: (_p: string) => false,
    writeFile: async (o: { path: string; data: string }) => {
      if (self.failWrite(o.path)) throw new Error('disk full')
      files.set(o.path, o.data)
    },
    readFile: async (o: { path: string }) => {
      const d = files.get(o.path)
      if (d === undefined) throw new Error('missing')
      return { data: d }
    },
    stat: async (o: { path: string }) => {
      if (files.has(o.path) || [...files.keys()].some((k) => k.startsWith(`${o.path}/`))) return {}
      throw new Error('missing')
    },
    deleteFile: async (o: { path: string }) => {
      if (!files.delete(o.path)) throw new Error('missing')
    },
    readdir: async (o: { path: string }) => {
      const seen = new Map<string, 'file' | 'directory'>()
      for (const k of files.keys()) {
        if (!k.startsWith(`${o.path}/`)) continue
        const rest = k.slice(o.path.length + 1)
        const at = rest.indexOf('/')
        if (at < 0) seen.set(rest, 'file')
        else seen.set(rest.slice(0, at), 'directory')
      }
      return { files: [...seen].map(([name, type]) => ({ name, type })) }
    },
    rmdir: async (o: { path: string; recursive?: boolean }) => {
      for (const k of [...files.keys()]) if (k.startsWith(`${o.path}/`)) files.delete(k)
    },
  }
  return self as never
}

const legacy = (id: string) => `chat-photo-queue/${id}.jpg`
const inDir = (user: string, id: string) => `${userQueueDir(user)}/${id}.jpg`
const textItem = (id: string, owner: string): QueuedMessage => ({ clientMsgId: id, coupleId: 'c1', senderId: owner, body: `글 ${id}`, sentAt: '2026-11-16T00:00:00Z', retryCount: 0, status: 'pending' })
const photoItem = (id: string, owner: string, localUri = inDir(owner, id)): QueuedPhoto => ({ clientId: id, kind: 'message', coupleId: 'c1', userId: owner, localUri, ext: 'jpg', contentType: 'image/jpeg', sentAt: '2026-11-16T00:00:00Z', retryCount: 0, status: 'pending' })
const v1 = (items: unknown[]) => JSON.stringify({ __v: 1, items })
const storedUris = (prefs: { data: Map<string, string> }, key: string): string[] => JSON.parse(prefs.data.get(key)!).items.map((i: QueuedPhoto) => i.localUri)

function depsOn(prefs: PrefsAllLike, fsys: FilesystemLike, originals: (u: string) => string[] | null = () => []): OwnerPurgeDeps {
  const files = createPhotoQueueFiles(fsys)
  return { prefs, removeFile: (u) => files.remove(u), files, originals }
}

/** 허브 둘 - 사진 시도는 파일이 실제로 있을 때만 성공(없으면 사라짐 = 0건 전송). 보낸 것 기록. */
function hubsOn(prefs: PrefsAllLike, fsys: FilesystemLike) {
  const sentText: string[] = []
  const sentPhoto: { id: string; uri: string }[] = []
  const fs = createWebPhotoFs(fsys)
  const session = () => useAuthStore.getState().userId
  const text = new TextQueueHub({
    send: async (input) => { sentText.push(input.clientMsgId); return { status: 'sent', row: { id: `r-${input.clientMsgId}`, client_msg_id: input.clientMsgId } as never } },
    store: createTextQueueStore(prefs, () => NOW),
    sessionUserId: session,
  })
  const photo = new PhotoQueueHub({
    attempt: async (item) => {
      if (!(await fs.exists(item.localUri))) return { outcome: 'lost' } as AttemptedPhoto
      sentPhoto.push({ id: item.clientId, uri: item.localUri })
      return { outcome: 'done' } as AttemptedPhoto
    },
    fs,
    store: createPhotoQueueStore(prefs, () => NOW, createPhotoQueueFiles(fsys)),
    sessionUserId: session,
  })
  return { text, photo, sentText, sentPhoto, fs }
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
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  vi.restoreAllMocks()
})

describe('83- 1단계 판정 근거: 83- 이전 사진 파일 자리', () => {
  it('옛 자리 = 폴더 바로 아래(`chat-photo-queue/{파일}`) · 사용자 폴더 = `chat-photo-queue/{userId}/{파일}`', () => {
    expect(isLegacyQueuePath('chat-photo-queue/p1.jpg')).toBe(true)
    expect(isLegacyQueuePath(inDir(A, 'p1'))).toBe(false)
    expect(isLegacyQueuePath('other/p1.jpg')).toBe(false)
    expect(isLegacyQueuePath('chat-photo-queue/')).toBe(false)
  })

  it('새 사진은 지금 주인 폴더에 복사된다(허브 `enqueue`)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['x'], { type: 'image/jpeg' })))
    const prefs = memPrefs()
    const fsys = memFilesystem()
    useAuthStore.getState().setUserId(A)
    const h = hubsOn(prefs, fsys)
    h.photo.attach('c1', A)
    await settle()
    const r = await h.photo.enqueue({ uri: 'blob:x', ext: 'jpg', mimeType: 'image/jpeg' }, 'message')
    expect(r?.item.localUri.startsWith(`${userQueueDir(A)}/`)).toBe(true)
    expect(h.sentPhoto).toEqual([{ id: r!.item.clientId, uri: r!.item.localUri }])
    h.photo.detach()
  })
})

describe('83- 계정 전환: 이전 주인 폴더째 지움', () => {
  it('정상 저장값 + 전환 -> 이전 주인 폴더 0(저장값에 없는 남은 파일까지) · 지금 주인 폴더 그대로 · 지금 주인 것만 전송', async () => {
    const prefs = memPrefs({
      'chat_photo_queue:c1:user-a': v1([photoItem('pa', A)]),
      'chat_photo_queue:c1:user-b': v1([photoItem('pb', B)]),
    })
    const fsys = memFilesystem([inDir(A, 'pa'), inDir(A, 'stray'), inDir(B, 'pb')])
    useAuthStore.getState().setUserId(B)
    expect(await startQueueOwnerPurge(B, depsOn(prefs, fsys))).toBe(1)
    expect([...fsys.files.keys()]).toEqual([inDir(B, 'pb')])
    expect(prefs.data.has('chat_photo_queue:c1:user-a')).toBe(false)
    const h = hubsOn(prefs, fsys)
    h.photo.attach('c1', B)
    await waitFor(() => expect(h.sentPhoto).toEqual([{ id: 'pb', uri: inDir(B, 'pb') }]))
    h.photo.detach()
  })

  it('깨진 저장값 + 전환 -> 이전 주인 폴더 0(82- 한계: 파일 경로를 몰라도 남지 않음) · 지금 주인 폴더 그대로', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': '{깨짐', 'chat_photo_queue:c1:user-b': v1([photoItem('pb', B)]) })
    const fsys = memFilesystem([inDir(A, 'p1'), inDir(A, 'p2'), inDir(B, 'pb')])
    expect(await startQueueOwnerPurge(B, depsOn(prefs, fsys))).toBe(1)
    expect([...fsys.files.keys()].filter((k) => k.startsWith(`${userQueueDir(A)}/`))).toEqual([])
    expect(fsys.files.has(inDir(B, 'pb'))).toBe(true)
  })

  it('저장값이 아예 없어도(로그아웃 · 지운 키) 다른 사용자 폴더는 지움', async () => {
    const fsys = memFilesystem([inDir(A, 'p1'), inDir('user-c', 'p2')])
    await startQueueOwnerPurge(B, depsOn(memPrefs(), fsys))
    expect(fsys.files.size).toBe(0)
  })

  it('폴더를 못 읽거나 폴더 다루기가 없으면 아무것도 지우지 않음(던지지 않음)', async () => {
    const fsys = memFilesystem([inDir(A, 'p1'), legacy('x')])
    const deps = depsOn(memPrefs(), fsys)
    deps.files = { ...deps.files!, list: async () => null }
    expect(await purgePhotoFolders(B, deps)).toEqual({ dirs: 0, legacy: 0, legacyUnsure: true })
    expect(fsys.files.size).toBe(2)
    const bare = memFilesystem([inDir(A, 'p1')])
    delete (bare as Partial<FilesystemLike>).readdir
    await startQueueOwnerPurge(B, depsOn(memPrefs(), bare))
    expect(bare.files.size).toBe(1)
  })

  it('같은 계정 재로그인 -> 지울 것 0 · 폴더 그대로 · 글 · 사진 각 1번 이어서', async () => {
    const prefs = memPrefs({ 'chat_queue:c1': v1([textItem('a1', A)]), 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A)]) })
    const fsys = memFilesystem([inDir(A, 'pa')])
    useAuthStore.getState().setUserId(A)
    expect(await startQueueOwnerPurge(A, depsOn(prefs, fsys))).toBe(0)
    expect(fsys.files.has(inDir(A, 'pa'))).toBe(true)
    const h = hubsOn(prefs, fsys)
    h.text.attach('c1', A)
    h.photo.attach('c1', A)
    await waitFor(() => expect(h.sentText).toEqual(['a1']))
    await waitFor(() => expect(h.sentPhoto).toEqual([{ id: 'pa', uri: inDir(A, 'pa') }]))
    await settle()
    h.text.detach(); h.photo.detach()
    expect(h.sentText).toHaveLength(1)
    expect(h.sentPhoto).toHaveLength(1)
  })
})

describe('83- 기존 파일 옮기기(옛 자리 -> 사용자 폴더)', () => {
  it('처음 읽을 때 옮김 -> 저장값 경로 갱신 · 옛 파일 0 · 정상 전송 1번(새 자리에서)', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A, legacy('pa'))]) })
    const fsys = memFilesystem([legacy('pa')])
    useAuthStore.getState().setUserId(A)
    await startQueueOwnerPurge(A, depsOn(prefs, fsys))
    expect(fsys.files.has(legacy('pa'))).toBe(true) // 지금 사용자 것(저장값이 가리킴) - 정리가 지우지 않는다
    const h = hubsOn(prefs, fsys)
    h.photo.attach('c1', A)
    await waitFor(() => expect(h.sentPhoto).toEqual([{ id: 'pa', uri: inDir(A, 'pa') }]))
    await settle()
    h.photo.detach()
    expect(h.sentPhoto).toHaveLength(1)
    expect(fsys.files.has(legacy('pa'))).toBe(false)
  })

  it('옮기다 실패 -> 원본 · 저장값 그대로 / 다시 읽을 때 이어서 옮김 -> 그다음 전송 1번', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A, legacy('pa')), photoItem('pb', A, legacy('pb'))]) })
    const fsys = memFilesystem([legacy('pa'), legacy('pb')])
    fsys.failWrite = (p) => p === inDir(A, 'pb') // 한 장만 실패
    const store = createPhotoQueueStore(prefs, () => NOW, createPhotoQueueFiles(fsys))
    const first = await store.load('c1', A)
    expect(first.map((i) => i.localUri)).toEqual([inDir(A, 'pa'), legacy('pb')])
    expect(storedUris(prefs, 'chat_photo_queue:c1:user-a')).toEqual([inDir(A, 'pa'), legacy('pb')])
    expect(fsys.files.has(legacy('pa'))).toBe(false)
    expect(fsys.files.has(legacy('pb'))).toBe(true) // 원본 남음

    fsys.failWrite = () => false
    resetQueueHoldForTest()
    useAuthStore.getState().setUserId(A)
    const h = hubsOn(prefs, fsys)
    h.photo.attach('c1', A)
    await waitFor(() => expect(h.sentPhoto.map((s) => s.id).sort()).toEqual(['pa', 'pb']))
    await settle()
    h.photo.detach()
    expect(h.sentPhoto).toEqual(expect.arrayContaining([{ id: 'pa', uri: inDir(A, 'pa') }, { id: 'pb', uri: inDir(A, 'pb') }]))
    expect(h.sentPhoto).toHaveLength(2)
    expect([...fsys.files.keys()]).toEqual([]) // 보낸 뒤 복사본 정리
  })

  it('복사는 됐는데 저장값을 못 씀 -> 새 복사본만 지우고 원본 · 옛 경로 그대로(그 경로로 보내도 1번)', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A, legacy('pa'))]) })
    prefs.failSet.add('chat_photo_queue:c1:user-a')
    const fsys = memFilesystem([legacy('pa')])
    const store = createPhotoQueueStore(prefs, () => NOW, createPhotoQueueFiles(fsys))
    expect((await store.load('c1', A)).map((i) => i.localUri)).toEqual([legacy('pa')])
    expect([...fsys.files.keys()]).toEqual([legacy('pa')])
    expect(storedUris(prefs, 'chat_photo_queue:c1:user-a')).toEqual([legacy('pa')])
  })

  it('다른 사람 항목은 옮기지 않음(주인 폴더로 옮겨 남기지 않는다)', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': v1([photoItem('pa', A, legacy('pa')), photoItem('px', B, legacy('px'))]) })
    const fsys = memFilesystem([legacy('pa'), legacy('px')])
    const store = createPhotoQueueStore(prefs, () => NOW, createPhotoQueueFiles(fsys))
    expect((await store.load('c1', A)).map((i) => i.clientId)).toEqual(['pa'])
    expect(fsys.files.has(legacy('px'))).toBe(true)
    expect(fsys.files.has(inDir(B, 'px'))).toBe(false)
  })
})

describe('83- 주인을 모르는 옛 자리 파일: 지금 사용자 것이 아님이 확실할 때만 지움', () => {
  it('어떤 저장값 · 보존 칸에도 없는 옛 파일 -> 지움 / 지금 사용자 저장값이 가리키는 옛 파일 -> 남김', async () => {
    const prefs = memPrefs({ 'chat_photo_queue:c1:user-a': '{깨짐', 'chat_photo_queue:c1:user-b': v1([photoItem('pb', B, legacy('pb'))]) })
    const fsys = memFilesystem([legacy('orphan'), legacy('pb')])
    await startQueueOwnerPurge(B, depsOn(prefs, fsys))
    expect([...fsys.files.keys()]).toEqual([legacy('pb')])
  })

  it('지금 사용자의 보존 칸(81- 원본)에 이름이 있으면 남김', async () => {
    const fsys = memFilesystem([legacy('kept')])
    await startQueueOwnerPurge(B, depsOn(memPrefs(), fsys, () => ['{"localUri":"chat-photo-queue/kept.jpg"']))
    expect(fsys.files.has(legacy('kept'))).toBe(true)
  })

  it('남은 저장값이 깨져 있거나 · 보존 칸을 못 읽거나 · 저장값을 못 읽으면 옛 파일은 하나도 지우지 않음(사용자 폴더 정리는 그대로)', async () => {
    const corrupt = memPrefs({ 'chat_photo_queue:c2:user-b': '{깨짐' })
    const f1 = memFilesystem([legacy('x'), inDir(A, 'p')])
    expect(await purgePhotoFolders(B, depsOn(corrupt, f1))).toEqual({ dirs: 1, legacy: 0, legacyUnsure: true })
    expect([...f1.files.keys()]).toEqual([legacy('x')])

    const f2 = memFilesystem([legacy('x')])
    expect((await purgePhotoFolders(B, depsOn(memPrefs(), f2, () => null))).legacyUnsure).toBe(true)
    expect(f2.files.size).toBe(1)

    const blocked = memPrefs({ 'chat_photo_queue:c1:user-b': v1([]) })
    blocked.get = async () => { throw new Error('x') }
    const f3 = memFilesystem([legacy('x')])
    expect((await purgePhotoFolders(B, depsOn(blocked, f3))).legacyUnsure).toBe(true)
    expect(f3.files.size).toBe(1)
  })
})
