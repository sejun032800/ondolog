/**
 * `useTheme()` — docs/ONDOLOG_DESIGN.md §7, §9-1, §13-6.
 *
 * 라이트/다크는 시스템 설정을 기본값으로 감지하고(§7 "기본값: 시스템
 * 설정"), 설정 탭에서 라이트/다크/시스템 중 수동 전환도 지원한다(§7
 * "수동: 설정 탭에서 라이트/다크/시스템", §13-6 "테마 · 시스템 설정 →").
 *
 * 수동 선택은 AsyncStorage에 저장한다 — 이것은 온보딩 비로그인 구간
 * (화면 2~5)의 세션 데이터가 아니라 앱 전역 UI 프리퍼런스이므로
 * "메모리 전용" 제약(그 구간 전용 규칙)의 대상이 아니다. AsyncStorage는
 * 이미 프로젝트 의존성에 있다(package.json) — 신규 네이티브 모듈 추가 아님.
 */
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import {
  ATTACHMENT_CLIMATE,
  BROADSHEET_ON_DARK,
  BROADSHEET_ON_LIGHT,
  CLIMATE_DARK,
  CLIMATE_LIGHT,
  DARK_PALETTE,
  LIGHT_PALETTE,
  type BroadsheetInsert,
  type BroadsheetPalette,
  type ClimateKey,
  type ClimatePalette,
} from './palette'
import { createInk, type InkFn } from './inkHierarchy'
import { typography } from './typography'
import { layout, lines, radius, spacing } from './spacing'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'ondolog.theme.mode'

interface ThemePreferenceState {
  mode: ThemeMode
  hydrated: boolean
  setMode: (mode: ThemeMode) => void
  hydrate: () => Promise<void>
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export const useThemePreferenceStore = create<ThemePreferenceState>((set) => ({
  mode: 'system',
  hydrated: false,
  setMode: (mode) => {
    set({ mode })
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      // 저장 실패해도 현재 세션의 표시는 이미 반영됐다 — 무시 가능.
    })
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY)
      if (isThemeMode(stored)) {
        set({ mode: stored, hydrated: true })
        return
      }
    } catch {
      // 읽기 실패 — 기본값(system) 유지.
    }
    set({ hydrated: true })
  },
}))

/** `app/_layout.tsx`가 앱 시작 시 1회 호출해 저장된 테마 선택을 불러온다. */
export function useHydrateThemePreference() {
  const hydrate = useThemePreferenceStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export interface Theme {
  mode: ThemeMode
  resolvedMode: ResolvedMode
  colors: BroadsheetPalette
  /** 연애리그(별지) 전용 — 본지와 반대 지질(§1-3). */
  broadsheet: BroadsheetInsert
  climate: ClimatePalette
  attachmentClimate: typeof ATTACHMENT_CLIMATE
  ink: InkFn
  typography: typeof typography
  spacing: typeof spacing
  layout: typeof layout
  lines: typeof lines
  radius: typeof radius
  setMode: (mode: ThemeMode) => void
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme()
  const mode = useThemePreferenceStore((s) => s.mode)
  const setMode = useThemePreferenceStore((s) => s.setMode)

  const resolvedMode: ResolvedMode =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode

  const colors = resolvedMode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
  const broadsheet = resolvedMode === 'dark' ? BROADSHEET_ON_DARK : BROADSHEET_ON_LIGHT
  const climate = resolvedMode === 'dark' ? CLIMATE_DARK : CLIMATE_LIGHT

  return {
    mode,
    resolvedMode,
    colors,
    broadsheet,
    climate,
    attachmentClimate: ATTACHMENT_CLIMATE,
    ink: createInk(colors),
    typography,
    spacing,
    layout,
    lines,
    radius,
    setMode,
  }
}

export type { ClimateKey }
export { LIGHT_PALETTE, DARK_PALETTE }
