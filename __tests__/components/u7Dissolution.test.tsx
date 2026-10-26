/**
 * U7 연결 해제 · 회원 탈퇴 · 마케팅 토글 시험 (`68-`) - 화면 -> `dissolutionApi`/`settingsApi` -> 코어가 진짜 코드이고, 서버는 **메모리 가짜 저장소**다.
 * 가짜 저장소는 rpc 호출 기록(`rpcCalls`)과 테이블 직접 쓰기 기록(`writes`)을 따로 남긴다 - "함수 호출로만 쓴다"는 이 기록으로 본다(정적 검사 아님).
 *
 * 지키는 것:
 *   - 해제 · 해제 취소 · 탈퇴 · 탈퇴 취소가 각 함수 호출이고, 그 뒤에도 직접 쓰기(`writes`)는 0이다
 *   - 유예 화면 양쪽: 개시자 [취소] 있음 · 상대 [취소] 없음 · 남은 날짜가 서버 `purge_scheduled_at` 기준
 *   - 탈퇴 유예 중 로그인 -> 탈퇴 취소 화면이 진행 단계보다 먼저 · 취소하면 원래 진행 단계로
 *   - 문구 직접 입력 - 틀리면 진행 불가
 *   - 마케팅 토글 켜기 · 끄기 · 실패 시 되돌림
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import SettingsCoupleScreen from '../../app/settings-couple'
import SettingsPrivacyScreen from '../../app/settings-privacy'
import SettingsUnlinkScreen from '../../app/settings-unlink'
import SettingsWithdrawScreen from '../../app/settings-withdraw'
import WithdrawCancelScreen from '../../app/withdraw-cancel'
import { resolveResumePath } from '../../src/hooks/resolveResumePath'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useDissolutionStore } from '../../src/store/dissolutionStore'
import { graceDateLabel, UNLINK_PHRASE, WITHDRAW_PHRASE } from '../../src/utils/dissolution'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack, dismissTo: jest.fn() }
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb])
    },
  }
})

let mockSession: { user: { id: string; app_metadata: { provider: string } } } | null
jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({ session: mockSession, loading: false }),
}))

type Row = Record<string, unknown>
interface Write {
  table: string
  op: 'insert' | 'update' | 'delete'
  payload: Row | null
}

class FakeDb {
  tables: Record<string, Row[]> = {}
  writes: Write[] = []
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = []
  failNextRpc: { code: string } | null = null
  failNextUpdate: { code: string } | null = null

  rpc(fn: string, args?: Record<string, unknown>) {
    this.rpcCalls.push({ fn, args })
    if (this.failNextRpc) {
      const error = this.failNextRpc
      this.failNextRpc = null
      return Promise.resolve({ data: null, error })
    }
    // 서버 함수가 하는 일을 흉내낸다(앱의 직접 쓰기 기록에는 남지 않는다).
    if (fn === 'fn_request_dissolution') return Promise.resolve({ data: 'd-new', error: null })
    if (fn === 'fn_request_withdrawal') return Promise.resolve({ data: '2026-11-02T00:00:00Z', error: null })
    if (fn === 'fn_cancel_withdrawal') {
      const me = this.tables.profiles.find((r) => r.id === ME)
      if (me) Object.assign(me, { deleted_at: null, purge_scheduled_at: null })
    }
    return Promise.resolve({ data: null, error: null })
  }

  from(table: string) {
    const db = this
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row | null = null
    const filters: Array<(r: Row) => boolean> = []
    const rowsOf = () => (db.tables[table] ??= [])
    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (op === 'update' || op === 'insert' || op === 'delete') {
        db.writes.push({ table, op, payload })
        if (db.failNextUpdate) {
          const error = db.failNextUpdate
          db.failNextUpdate = null
          return { data: null, error }
        }
        const target = rowsOf().find((r) => filters.every((f) => f(r)))
        if (target && op === 'update') Object.assign(target, payload)
        return { data: target ?? null, error: null }
      }
      return { data: rowsOf().find((r) => filters.every((f) => f(r))) ?? null, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: Row) => ((op = 'insert'), (payload = p), api),
      update: (p: Row) => ((op = 'update'), (payload = p), api),
      delete: () => ((op = 'delete'), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      is: () => api,
      or: () => api,
      in: () => api,
      order: () => api,
      limit: () => api,
      single: () => run(),
      maybeSingle: () => run(),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
    }
    return api
  }
}

let mockDb: FakeDb
const mockSignOut = jest.fn(async () => ({ error: null }))
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: (table: string) => mockDb.from(table),
    rpc: (fn: string, args?: Record<string, unknown>) => mockDb.rpc(fn, args),
    auth: { signOut: () => mockSignOut() },
  },
}))

const ME = 'me'
const PARTNER = 'p1'
const DAY = 24 * 60 * 60 * 1000

function seed(dissolution?: { initiatedBy: string; reason?: string; purgeInDays: number }) {
  mockDb = new FakeDb()
  mockDb.tables.profiles = [
    { id: ME, display_name: '세준', onboarding_step: 3, marketing_agreed_at: null, deleted_at: null, purge_scheduled_at: null },
    { id: PARTNER, display_name: '서영', onboarding_step: 3, marketing_agreed_at: null, deleted_at: null },
  ]
  mockDb.tables.couples = [
    { id: 'c1', user_a_id: ME, user_b_id: PARTNER, status: dissolution ? 'dissolving' : 'active', relationship_start_date: '2025-12-27', nickname: '늘봄' },
  ]
  mockDb.tables.couple_dissolutions = dissolution
    ? [
        {
          id: 'd1',
          couple_id: 'c1',
          initiated_by: dissolution.initiatedBy,
          reason: dissolution.reason ?? 'unlink',
          purge_scheduled_at: new Date(Date.now() + dissolution.purgeInDays * DAY).toISOString(),
          executed_at: null,
          cancelled_at: null,
        },
      ]
    : []
}

function connectStore() {
  useCoupleStore.setState({
    status: 'connected',
    coupleId: 'c1',
    partnerId: PARTNER,
    nickname: '늘봄',
    relationshipStartDate: '2025-12-27',
    refresh: (async () => {}) as never,
  })
}

async function settle() {
  await act(async () => {})
}

beforeEach(() => {
  for (const m of [mockPush, mockReplace, mockBack, mockSignOut]) m.mockClear()
  mockSession = { user: { id: ME, app_metadata: { provider: 'kakao' } } }
  seed()
  connectStore()
  useDissolutionStore.getState().reset()
})

// ── H14 유예 화면 ──

describe('H14 연결 해제 유예 화면 - 양쪽', () => {
  it('개시자: 남은 날짜(서버 값 기준)와 [해제 취소하기]가 보이고, 문구 "해제 예정 기간에는 새 호를 만들지 않아요"가 있다', async () => {
    seed({ initiatedBy: ME, purgeInDays: 5 })
    const purge = mockDb.tables.couple_dissolutions[0].purge_scheduled_at as string
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByTestId('grace-days').props.children).toBe('5일')
    expect(screen.getByTestId('grace-date').props.children).toBe(`${graceDateLabel(purge)}에 연결이 해제돼요`)
    expect(screen.getByTestId('grace-cancel')).toBeTruthy()
    expect(screen.getByText('해제 예정 기간에는 새 호를 만들지 않아요')).toBeTruthy()
    expect(screen.getByText('서영에게 해제 요청을 알렸어요')).toBeTruthy()
    expect(screen.queryByTestId('couple-unlink')).toBeNull()
  })

  it('남은 날짜는 서버 값을 따른다 - 2일 뒤면 2일(앱이 7일을 더하지 않는다)', async () => {
    seed({ initiatedBy: ME, purgeInDays: 2 })
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByTestId('grace-days').props.children).toBe('2일')
  })

  it('상대: 남은 날짜와 안내는 보이고 [취소] 버튼은 없다', async () => {
    seed({ initiatedBy: PARTNER, purgeInDays: 5 })
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByTestId('grace-days').props.children).toBe('5일')
    expect(screen.getByText('서영님이 연결 해제를 요청했어요')).toBeTruthy()
    expect(screen.getByText('해제 예정 기간에는 새 호를 만들지 않아요')).toBeTruthy()
    expect(screen.queryByTestId('grace-cancel')).toBeNull()
    expect(screen.queryByText('해제 취소하기')).toBeNull()
  })

  it('상대 화면 - 탈퇴로 생긴 해제면 탈퇴 요청이라고 알린다(취소 버튼 없음)', async () => {
    seed({ initiatedBy: PARTNER, reason: 'withdrawal', purgeInDays: 5 })
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByText('서영님이 탈퇴를 요청했어요')).toBeTruthy()
    expect(screen.queryByTestId('grace-cancel')).toBeNull()
  })

  it('개시자가 [해제 취소하기]를 누르면 fn_cancel_dissolution(해제 id) 호출 하나이고 직접 쓰기는 0이다', async () => {
    seed({ initiatedBy: ME, purgeInDays: 5 })
    await render(<SettingsCoupleScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('grace-cancel'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([{ fn: 'fn_cancel_dissolution', args: { p_dissolution_id: 'd1' } }])
    expect(mockDb.writes).toEqual([])
  })

  it('취소가 실패하면 안내 문구를 보인다(42501 = 개시자 아님)', async () => {
    seed({ initiatedBy: ME, purgeInDays: 5 })
    await render(<SettingsCoupleScreen />)
    await settle()
    mockDb.failNextRpc = { code: '42501' }
    await fireEvent.press(screen.getByTestId('grace-cancel'))
    await settle()
    expect(screen.getByTestId('couple-error').props.children).toBe('해제를 요청한 사람만 취소할 수 있어요.')
  })

  it('탈퇴로 생긴 해제는 개시자 본인 화면에도 [취소]를 두지 않는다(탈퇴 취소로만 되돌린다)', async () => {
    seed({ initiatedBy: ME, reason: 'withdrawal', purgeInDays: 5 })
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.queryByTestId('grace-cancel')).toBeNull()
  })
})

// ── H14 해제 요청 ──

describe('H14 연결 해제 요청 - 다단계 확인', () => {
  it('안내 -> 문구 입력 순서이고, 문구가 틀리면 [해제 요청하기]를 눌러도 함수가 불리지 않는다', async () => {
    await render(<SettingsUnlinkScreen />)
    await settle()
    expect(screen.getByTestId('unlink-pdf-row')).toBeTruthy() // PDF 저장 안내
    await fireEvent.press(screen.getByTestId('unlink-next'))
    await fireEvent.changeText(screen.getByTestId('unlink-phrase-input'), '연결 해제')
    await fireEvent.press(screen.getByTestId('unlink-submit'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([])
    await fireEvent.changeText(screen.getByTestId('unlink-phrase-input'), '')
    await fireEvent.press(screen.getByTestId('unlink-submit'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([])
  })

  it('문구가 맞으면 fn_request_dissolution 호출 하나(인자 없음) - 직접 쓰기 0, 그 뒤 커플 화면으로 돌아간다', async () => {
    await render(<SettingsUnlinkScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('unlink-next'))
    await fireEvent.changeText(screen.getByTestId('unlink-phrase-input'), UNLINK_PHRASE)
    await fireEvent.press(screen.getByTestId('unlink-submit'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([{ fn: 'fn_request_dissolution', args: undefined }])
    expect(mockDb.writes).toEqual([])
    expect(mockBack).toHaveBeenCalled()
  })

  it('이미 진행 중(23505)이면 안내 문구를 보이고 돌아가지 않는다', async () => {
    await render(<SettingsUnlinkScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('unlink-next'))
    await fireEvent.changeText(screen.getByTestId('unlink-phrase-input'), UNLINK_PHRASE)
    mockDb.failNextRpc = { code: '23505' }
    await fireEvent.press(screen.getByTestId('unlink-submit'))
    await settle()
    expect(screen.getByTestId('unlink-error').props.children).toBe('이미 해제를 요청한 상태예요.')
    expect(mockBack).not.toHaveBeenCalled()
  })
})

// ── H16 탈퇴 ──

describe('H16 회원 탈퇴 요청', () => {
  it('커플이면 "연결도 함께 해제돼요"가 보이고, 미연결이면 보이지 않는다', async () => {
    const { unmount } = await render(<SettingsWithdrawScreen />)
    await settle()
    expect(screen.getByTestId('withdraw-couple-note').props.children).toBe('연결도 함께 해제돼요')
    expect(screen.getByTestId('withdraw-pdf-row')).toBeTruthy()
    await unmount()
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null })
    await render(<SettingsWithdrawScreen />)
    await settle()
    expect(screen.queryByTestId('withdraw-couple-note')).toBeNull()
  })

  it('문구가 틀리면 진행할 수 없다', async () => {
    await render(<SettingsWithdrawScreen />)
    await settle()
    await fireEvent.changeText(screen.getByTestId('withdraw-phrase-input'), '탈퇴합')
    await fireEvent.press(screen.getByTestId('withdraw-submit'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([])
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('문구가 맞으면 fn_request_withdrawal 호출 하나 -> 로그아웃 -> 시작 화면. 직접 쓰기 0', async () => {
    await render(<SettingsWithdrawScreen />)
    await settle()
    await fireEvent.changeText(screen.getByTestId('withdraw-phrase-input'), WITHDRAW_PHRASE)
    await fireEvent.press(screen.getByTestId('withdraw-submit'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([{ fn: 'fn_request_withdrawal', args: undefined }])
    expect(mockDb.writes).toEqual([])
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('요청이 실패하면 로그아웃하지 않는다', async () => {
    await render(<SettingsWithdrawScreen />)
    await settle()
    await fireEvent.changeText(screen.getByTestId('withdraw-phrase-input'), WITHDRAW_PHRASE)
    mockDb.failNextRpc = { code: '08006' }
    await fireEvent.press(screen.getByTestId('withdraw-submit'))
    await settle()
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(screen.getByTestId('withdraw-error')).toBeTruthy()
  })
})

// ── 탈퇴 유예 중 다시 로그인 ──

describe('탈퇴 유예 중 다시 로그인 - 탈퇴 취소 화면이 먼저', () => {
  it('로그인 직후 분기: deleted_at이 있으면 진행 단계(3 = 메인)보다 먼저 탈퇴 취소 화면이다', async () => {
    expect(await resolveResumePath({ id: ME, onboarding_step: 3, deleted_at: '2026-10-26T00:00:00Z' })).toBe('/withdraw-cancel')
    expect(await resolveResumePath({ id: ME, onboarding_step: 0, deleted_at: '2026-10-26T00:00:00Z' })).toBe('/withdraw-cancel')
    expect(await resolveResumePath({ id: ME, onboarding_step: 3, deleted_at: null })).toBe('/main')
  })

  it('탈퇴 취소 화면은 서버 purge_scheduled_at 기준 남은 날짜를 보이고, [탈퇴 취소하기]는 fn_cancel_withdrawal 호출 하나다', async () => {
    const purge = new Date(Date.now() + 4 * DAY).toISOString()
    Object.assign(mockDb.tables.profiles[0], { deleted_at: '2026-10-26T00:00:00Z', purge_scheduled_at: purge })
    await render(<WithdrawCancelScreen />)
    await settle()
    expect(screen.getByTestId('withdraw-days').props.children).toBe('4일')
    await fireEvent.press(screen.getByTestId('withdraw-cancel-button'))
    await settle()
    expect(mockDb.rpcCalls).toEqual([{ fn: 'fn_cancel_withdrawal', args: undefined }])
    expect(mockDb.writes).toEqual([])
    // 취소하면 원래 진행 단계(3 = 메인)로
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })

  it('유예가 끝나 취소할 수 없으면(22023) 안내를 보이고 이동하지 않는다', async () => {
    Object.assign(mockDb.tables.profiles[0], {
      deleted_at: '2026-10-26T00:00:00Z',
      purge_scheduled_at: new Date(Date.now() + DAY).toISOString(),
    })
    await render(<WithdrawCancelScreen />)
    await settle()
    mockDb.failNextRpc = { code: '22023' }
    await fireEvent.press(screen.getByTestId('withdraw-cancel-button'))
    await settle()
    expect(screen.getByTestId('withdraw-cancel-error').props.children).toBe('유예 기간이 끝나 취소할 수 없어요.')
    expect(mockReplace).not.toHaveBeenCalledWith('/main')
  })

  it('탈퇴 유예가 아닌 사람이 이 화면을 열면 진행 단계로 보낸다', async () => {
    await render(<WithdrawCancelScreen />)
    await settle()
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })
})

// ── H11 마케팅 토글 ──

describe('H11 마케팅 정보 수신 토글', () => {
  it('켜기 = marketing_agreed_at에 시각, 끄기 = null - 이 칸 하나만 UPDATE', async () => {
    await render(<SettingsPrivacyScreen />)
    await settle()
    const toggle = () => screen.getByTestId('privacy-marketing-toggle')
    expect(toggle().props.accessibilityState.checked).toBe(false)
    await fireEvent.press(toggle())
    await settle()
    expect(toggle().props.accessibilityState.checked).toBe(true)
    await fireEvent.press(toggle())
    await settle()
    expect(toggle().props.accessibilityState.checked).toBe(false)
    expect(mockDb.writes).toHaveLength(2)
    expect(Object.keys(mockDb.writes[0].payload ?? {})).toEqual(['marketing_agreed_at'])
    expect(typeof mockDb.writes[0].payload?.marketing_agreed_at).toBe('string')
    expect(mockDb.writes[1]).toEqual({ table: 'profiles', op: 'update', payload: { marketing_agreed_at: null } })
  })

  it('이미 동의한 상태면 켜진 채로 보인다', async () => {
    mockDb.tables.profiles[0].marketing_agreed_at = '2026-10-01T00:00:00Z'
    await render(<SettingsPrivacyScreen />)
    await settle()
    expect(screen.getByTestId('privacy-marketing-toggle').props.accessibilityState.checked).toBe(true)
  })

  it('저장이 실패하면 토글을 원래 값으로 되돌리고 안내를 보인다', async () => {
    await render(<SettingsPrivacyScreen />)
    await settle()
    mockDb.failNextUpdate = { code: '08006' }
    await fireEvent.press(screen.getByTestId('privacy-marketing-toggle'))
    await settle()
    expect(screen.getByTestId('privacy-marketing-toggle').props.accessibilityState.checked).toBe(false)
    expect(screen.getByTestId('privacy-error')).toBeTruthy()
  })
})
