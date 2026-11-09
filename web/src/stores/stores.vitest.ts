import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSupabaseForTest } from '../auth/client'
import type { WebSupabase } from '../auth/client'
import { useCoupleStore } from './coupleStore'
import { useProfileStore } from './profileStore'
import { useSheetStore } from './sheetStore'
import { TOAST_DURATION_MS, showToast, useToastStore } from './toastStore'

type Row = Record<string, unknown> | null

/** 질의 사슬을 흉내 내는 가짜 클라이언트. 질의 기록을 돌려준다. */
function fakeClient(tables: Record<string, { data?: Row; error?: unknown; throws?: boolean }>) {
  const queries: Array<{ table: string; calls: string[] }> = []
  const from = (table: string) => {
    const q = { table, calls: [] as string[] }
    queries.push(q)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'or', 'eq', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        q.calls.push(`${m}(${args.join(',')})`)
        return b
      }
    }
    b.maybeSingle = async () => {
      const t = tables[table] ?? { data: null }
      if (t.throws) throw new Error('network')
      return { data: t.data ?? null, error: t.error ?? null }
    }
    return b
  }
  return { client: { from } as unknown as WebSupabase, queries }
}

beforeEach(() => {
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
})
afterEach(() => {
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

describe('커플 상태 저장소', () => {
  it('처음에는 조회 전이고 온도는 36.5다', () => {
    expect(useCoupleStore.getState().status).toBe('unknown')
    expect(useCoupleStore.getState().temperature).toBe(36.5)
  })

  it('커플 행이 없으면 미연결 - 온도 36.5 고정', async () => {
    const { client, queries } = fakeClient({ couples: { data: null } })
    setSupabaseForTest(client)
    await useCoupleStore.getState().refresh('me')
    const s = useCoupleStore.getState()
    expect(s.status).toBe('disconnected')
    expect(s.temperature).toBe(36.5)
    expect(s.coupleId).toBeNull()
    // RN `coupleStore.refresh`와 같은 질의: 내가 a 또는 b, status = active.
    expect(queries[0].table).toBe('couples')
    expect(queries[0].calls).toContain('or(user_a_id.eq.me,user_b_id.eq.me)')
    expect(queries[0].calls).toContain('eq(status,active)')
  })

  it('연결이면 상대 id · 닉네임 · 사귄 날짜와 저장된 최신 온도를 읽기만 한다', async () => {
    const { client, queries } = fakeClient({
      couples: { data: { id: 'c1', user_a_id: 'partner', user_b_id: 'me', nickname: '늘봄', relationship_start_date: '2025-01-02', reference_photo_path: null } },
      daily_temperature: { data: { temperature: 38.2, date_on: '2026-11-08' } },
    })
    setSupabaseForTest(client)
    await useCoupleStore.getState().refresh('me')
    const s = useCoupleStore.getState()
    expect(s).toMatchObject({ status: 'connected', coupleId: 'c1', partnerId: 'partner', nickname: '늘봄', relationshipStartDate: '2025-01-02', temperature: 38.2, temperatureDateOn: '2026-11-08' })
    expect(queries[1].table).toBe('daily_temperature')
  })

  it('연결인데 저장된 온도가 없으면 null이다(숫자를 지어내지 않는다)', async () => {
    const { client } = fakeClient({ couples: { data: { id: 'c1', user_a_id: 'me', user_b_id: 'p', nickname: null, relationship_start_date: null, reference_photo_path: null } } })
    setSupabaseForTest(client)
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('connected')
    expect(useCoupleStore.getState().temperature).toBeNull()
  })

  it('처음 조회가 오류면 RN처럼 미연결, 이미 연결로 알던 값은 오류로 지우지 않는다', async () => {
    setSupabaseForTest(fakeClient({ couples: { error: { message: 'x' } } }).client)
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('disconnected')

    const ok = fakeClient({ couples: { data: { id: 'c1', user_a_id: 'me', user_b_id: 'p', nickname: null, relationship_start_date: null, reference_photo_path: null } } })
    setSupabaseForTest(ok.client)
    await useCoupleStore.getState().refresh('me')
    setSupabaseForTest(fakeClient({ couples: { throws: true } }).client)
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('connected')
    setSupabaseForTest(fakeClient({ couples: { error: { message: 'x' } } }).client)
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('connected')
  })

  it('reset은 조회 전으로 되돌린다', async () => {
    setSupabaseForTest(fakeClient({ couples: { data: { id: 'c1', user_a_id: 'me', user_b_id: 'p', nickname: 'n', relationship_start_date: null, reference_photo_path: null } } }).client)
    await useCoupleStore.getState().refresh('me')
    useCoupleStore.getState().reset()
    expect(useCoupleStore.getState()).toMatchObject({ status: 'unknown', coupleId: null, temperature: 36.5 })
  })
})

describe('내 프로필 저장소', () => {
  it('profiles 한 행을 읽어 화면이 쓰는 모양으로 둔다', async () => {
    setSupabaseForTest(fakeClient({ profiles: { data: { id: 'me', display_name: '세준', gender: 'male', birth_date: '1995-05-05', mbti: 'ENFP', onboarding_step: 2, deleted_at: null } } }).client)
    await useProfileStore.getState().refresh('me')
    expect(useProfileStore.getState()).toMatchObject({ status: 'loaded', profile: { id: 'me', displayName: '세준', onboardingStep: 2, deletedAt: null } })
  })

  it('조회가 던지면 failed, reset하면 비운다', async () => {
    setSupabaseForTest(fakeClient({ profiles: { throws: true } }).client)
    await useProfileStore.getState().refresh('me')
    expect(useProfileStore.getState().status).toBe('failed')
    useProfileStore.getState().reset()
    expect(useProfileStore.getState()).toMatchObject({ status: 'unknown', profile: null })
  })
})

describe('시트 한 칸 (B4 · B12)', () => {
  it('이미 열려 있으면 같은 시트도 다른 시트도 다시 열지 않는다', () => {
    const s = useSheetStore.getState()
    expect(s.open('couple-gate')).toBe(true)
    expect(useSheetStore.getState().open('couple-gate')).toBe(false)
    expect(useSheetStore.getState().current).toBe('couple-gate')
  })

  it('닫으면 비고, 다른 시트의 닫기는 무시하며, closeAll은 모두 닫는다', () => {
    useSheetStore.getState().open('couple-gate')
    useSheetStore.getState().close(undefined)
    expect(useSheetStore.getState().current).toBeNull()
    useSheetStore.getState().open('couple-gate')
    useSheetStore.getState().closeAll()
    expect(useSheetStore.getState().current).toBeNull()
  })
})

describe('토스트 (I06)', () => {
  it('한 번에 하나 - 새 토스트가 이전 것을 바꾸고 번호가 올라간다', () => {
    showToast('하나')
    const first = useToastStore.getState().toast!
    showToast('둘')
    const second = useToastStore.getState().toast!
    expect(second.message).toBe('둘')
    expect(second.id).toBeGreaterThan(first.id)
  })

  it('보기 같은 글자 버튼과 눌림 함수를 싣는다', () => {
    const onPress = vi.fn()
    showToast('기록을 남겼어요', { label: '보기', onPress })
    const t = useToastStore.getState().toast!
    expect(t.actionLabel).toBe('보기')
    t.onAction?.()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('사라지는 시간은 3초다', () => {
    expect(TOAST_DURATION_MS).toBe(3000)
  })
})
