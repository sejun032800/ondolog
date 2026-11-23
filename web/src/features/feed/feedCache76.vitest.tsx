/** 76-B5 · B3 - 피드를 다시 그릴 때(상세 -> 피드 복귀 · 오프라인) 회색 자리 표시 대신 저장값 · 받아 둔 사진 주소를 먼저 보인다. 자리 표시는 보여 줄 값이 없는 첫 로드에만. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { writeCache } from '../../cache/deviceCache'
import { clearSignedUrlCache, getSignedUrl, putSignedUrls, SIGNED_URL_TTL_MS } from '../../cache/signedUrlCache'
import { useFeed } from './feedData'

/**
 * 87-(R148-4): 오프라인 서버 - 어떤 읽기든 끊김으로 거부한다. 전에는 `setSupabaseForTest(undefined)`가 `web/.env`의 실제 접속 값으로
 * 실제 클라이언트를 만들어 이 시험이 실제 원격으로 읽기를 보냈다(시험은 원격 0 - 이제 시험 환경에서 접속 값은 빈 값).
 */
function offlineClient(): Parameters<typeof setSupabaseForTest>[0] {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? (_ok: unknown, fail: (e: unknown) => void) => fail(new TypeError('offline')) : () => chain),
    apply: () => chain,
  })
  return chain as Parameters<typeof setSupabaseForTest>[0]
}

const chapter = {
  key: '2026-10', year: 2026, month: 10, photoTotal: 1, memoTotal: 0,
  dates: [{ id: 'd1', dateOn: '2026-10-03', date_on: '2026-10-03', coverPath: 'c1/a.jpg', photoCount: 1, memoCount: 0, title: null, quote: null }],
}

beforeEach(() => {
  try { localStorage.clear() } catch { /* */ }
  clearSignedUrlCache()
  setSupabaseForTest(offlineClient())
  useAuthStore.getState().setUserId('me')
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
})

describe('B5 피드 먼저 보이기', () => {
  it('저장값이 있으면 첫 그림부터 월 묶음이 보이고(자리 표시 0), 받아 둔 사진 주소도 같이 보인다', () => {
    writeCache('me', 'feed', { chapters: [chapter], names: { u: '서영' } })
    putSignedUrls('feed', { 'c1/a.jpg': 'https://signed.invalid/a' })
    const { result } = renderHook(() => useFeed(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.urls['c1/a.jpg']).toBe('https://signed.invalid/a')
    expect(result.current.names.u).toBe('서영')
  })

  it('저장값이 없으면 첫 로드는 자리 표시', () => {
    const { result } = renderHook(() => useFeed(true))
    expect(result.current.loading).toBe(true)
  })

  it('다른 계정의 저장값은 보지 않는다', () => {
    writeCache('someone-else', 'feed', { chapters: [chapter], names: {} })
    const { result } = renderHook(() => useFeed(true))
    expect(result.current.loading).toBe(true)
    expect(result.current.chapters).toHaveLength(0)
  })

  it('읽기에 실패해도(오프라인) 먼저 보이던 값은 지우지 않는다 - 오류 화면으로 바꾸지 않는다', async () => {
    writeCache('me', 'feed', { chapters: [chapter], names: {} })
    const { result } = renderHook(() => useFeed(true)) // 오프라인 서버 = 읽기 실패
    await Promise.resolve()
    expect(result.current.chapters).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })
})

describe('B3 받아 둔 서명 URL 재사용', () => {
  it('받아 둔 주소는 만료(45분) 전에는 그대로 돌려주고, 지나면 버린다', () => {
    putSignedUrls('messages', { 'c1/p.jpg': 'https://signed.invalid/p' }, 1_000)
    expect(getSignedUrl('messages', 'c1/p.jpg', 1_000 + SIGNED_URL_TTL_MS - 1)).toBe('https://signed.invalid/p')
    expect(getSignedUrl('messages', 'c1/p.jpg', 1_000 + SIGNED_URL_TTL_MS + 1)).toBeUndefined()
  })

  it('버킷이 다르면 섞이지 않는다', () => {
    putSignedUrls('messages', { 'x.jpg': 'a' })
    expect(getSignedUrl('stories', 'x.jpg')).toBeUndefined()
  })
})
