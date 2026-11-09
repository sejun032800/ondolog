/**
 * Supabase 세션 저장소 - 앱을 다시 켜도 로그인이 유지되도록 `@capacitor/preferences`에 둔다.
 * (웹에서는 Capacitor가 localStorage로 대신한다.) 값은 로그에 내지 않는다.
 */
import { Preferences } from '@capacitor/preferences'

export interface AsyncAuthStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export const preferencesStorage: AsyncAuthStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key) => {
    await Preferences.remove({ key })
  },
}
