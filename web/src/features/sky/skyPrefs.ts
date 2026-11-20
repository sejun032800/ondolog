/**
 * 85- 하늘 사람 설정 - **기기에만**(MASTER 9-8-4 "값은 기기에만" · 보드 17-c "두 토글 값은 기기에만 저장"). 서버 쓰기 0.
 *  - 84-e: 유성 떨어뜨리기(H01 OUR SKY 첫 줄, 기본 켬 - 현재 H01 보드).
 *  - 별 반짝임(H01 OUR SKY, 기본 켬) · 둘러보기 처음 안내(C10)를 봤음 · 끌기 힌트(C08-alt)를 봤음 · iOS 움직임 권한을 거부했음(C09 다시 안 띄움).
 *  - 저장 = 기기 저장 `skypref`(81- 모양 버전 · 읽을 때 검사, 사용자 키). 로그아웃 · 탈퇴 요청 · 계정 전환 때 지워진다(`deviceCache.ts`).
 *  - **센서 값은 저장하지 않는다**(이 파일은 켬/끔 · 봤음 · 거부만 안다).
 */
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { readCache, writeCache } from '../../cache/deviceCache'

export interface SkyPrefs {
  meteor: boolean
  twinkle: boolean
  guideSeen: boolean
  dragHintSeen: boolean
  motionDenied: boolean
}

export const DEFAULT_SKY_PREFS: SkyPrefs = { meteor: true, twinkle: true, guideSeen: false, dragHintSeen: false, motionDenied: false }

/** 이 사용자의 하늘 설정(없거나 깨졌으면 기본값 - 깨진 값은 기기 저장이 버린다). */
export function readSkyPrefs(userId: string | null): SkyPrefs {
  return {
    meteor: readCache<{ on: boolean }>(userId, 'skypref', 'meteor')?.on ?? DEFAULT_SKY_PREFS.meteor,
    twinkle: readCache<{ on: boolean }>(userId, 'skypref', 'twinkle')?.on ?? DEFAULT_SKY_PREFS.twinkle,
    guideSeen: readCache<{ seen: boolean }>(userId, 'skypref', 'guide')?.seen ?? false,
    dragHintSeen: readCache<{ seen: boolean }>(userId, 'skypref', 'dragHint')?.seen ?? false,
    motionDenied: readCache<{ denied: boolean }>(userId, 'skypref', 'motion')?.denied ?? false,
  }
}

interface SkyPrefStore {
  userId: string | null
  prefs: SkyPrefs
  load: (userId: string | null) => void
  setTwinkle: (on: boolean) => void
  setMeteor: (on: boolean) => void
  markGuideSeen: () => void
  markDragHintSeen: () => void
  markMotionDenied: () => void
}

/** 설정 화면과 하늘 화면이 같은 값을 본다(설정에서 끄면 하늘이 바로 멈춘다). */
export const useSkyPrefStore = create<SkyPrefStore>((set, get) => ({
  userId: null,
  prefs: DEFAULT_SKY_PREFS,
  load: (userId) => set({ userId, prefs: readSkyPrefs(userId) }),
  setTwinkle: (on) => {
    writeCache(get().userId, 'skypref', { on }, 'twinkle')
    set((s) => ({ prefs: { ...s.prefs, twinkle: on } }))
  },
  setMeteor: (on) => {
    writeCache(get().userId, 'skypref', { on }, 'meteor')
    set((s) => ({ prefs: { ...s.prefs, meteor: on } }))
  },
  markGuideSeen: () => {
    writeCache(get().userId, 'skypref', { seen: true }, 'guide')
    set((s) => ({ prefs: { ...s.prefs, guideSeen: true } }))
  },
  markDragHintSeen: () => {
    writeCache(get().userId, 'skypref', { seen: true }, 'dragHint')
    set((s) => ({ prefs: { ...s.prefs, dragHintSeen: true } }))
  },
  markMotionDenied: () => {
    writeCache(get().userId, 'skypref', { denied: true }, 'motion')
    set((s) => ({ prefs: { ...s.prefs, motionDenied: true } }))
  },
}))

/** 이 사용자의 하늘 설정 - 사용자가 바뀌면 다시 읽는다. */
export function useSkyPrefs(userId: string | null): SkyPrefs {
  const prefs = useSkyPrefStore((s) => s.prefs)
  const loaded = useSkyPrefStore((s) => s.userId)
  useEffect(() => {
    if (loaded !== userId) useSkyPrefStore.getState().load(userId)
  }, [userId, loaded])
  return loaded === userId ? prefs : readSkyPrefs(userId)
}

/**
 * 기기 "움직임 줄이기"를 따라가는 값(바뀌면 다시 그린다). `matchMedia`가 없으면(jsdom) false.
 * H01은 이 값으로 줄을 비활성 + 문구 - 사용자가 켜 둔 값은 지우지 않는다(보드 17-c).
 */
export function useReducedMotionLive(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const mq = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null)
  const [reduced, setReduced] = useState(() => mq()?.matches ?? false)
  useEffect(() => {
    const m = mq()
    if (!m) return
    const on = () => setReduced(m.matches)
    on()
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return reduced
}
