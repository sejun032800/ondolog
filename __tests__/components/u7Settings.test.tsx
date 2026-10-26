/**
 * U7 설정 탭 시험 (`67-`) - H01~H06 · H11 화면 동작.
 *
 * 서버는 **메모리 가짜 저장소**다(`supabase.from`) - 화면 -> `settingsApi` -> `settingsCore`가 진짜 코드이고, 가짜 저장소의 호출 기록(`writes`)으로
 * "쓰는 칸 목록 밖에 쓰기 0"을 본다. 지키는 것: 숨긴 항목은 목록에 없고 남은 항목은 모두 간다 · 생년월일은 읽기 전용(입력 없음, 쓰기 0) ·
 * 사귄 날짜 수정은 set_by = 나 · confirmed_by = null이 한 번의 UPDATE · 미래 날짜 불가 · 닉네임 0 · 21자 거부, 1 · 20자 허용 ·
 * 상대 쪽 A20 재표시 · 재검사 1회(새 행 INSERT · 이전 행 보존 · 한 번의 UPDATE · 두 번째는 비활성 · 23505는 실패) · 로그아웃 뒤 큐 유지.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import LoveQuizScreen from '../../app/(onboarding)/love-quiz'
import MbtiScreen from '../../app/(onboarding)/mbti'
import ResultDetailScreen from '../../app/(onboarding)/result-detail'
import StartDateScreen from '../../app/(onboarding)/start-date'
import SettingsTab from '../../app/(tabs)/settings'
import SettingsCoupleScreen from '../../app/settings-couple'
import SettingsPersonalityScreen from '../../app/settings-personality'
import SettingsPrivacyScreen from '../../app/settings-privacy'
import SettingsProfileScreen from '../../app/settings-profile'
import { useStartDateRecheck } from '../../src/hooks/useStartDateRecheck'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useSessionStore } from '../../src/store/sessionStore'
import { chatQueueStorageKey } from '../../src/utils/chatQueue'
import { HIDDEN_SETTINGS_ITEMS, SETTINGS_GROUPS } from '../../src/utils/settingsRules'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockDismissTo = jest.fn()
let mockParams: Record<string, string> = {}
const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack, dismissTo: mockDismissTo }
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb])
    },
  }
})

let mockSession: { user: { id: string; app_metadata: { provider: string } } } | null
jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({ session: mockSession, loading: false }),
}))

// ── 메모리 가짜 저장소 ──
type Row = Record<string, unknown>
interface Write {
  table: string
  op: 'insert' | 'update' | 'delete'
  payload: Row | null
}

class FakeDb {
  tables: Record<string, Row[]> = {}
  writes: Write[] = []
  failNextInsert: { code: string } | null = null

  from(table: string) {
    const db = this
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row | null = null
    const filters: Array<(r: Row) => boolean> = []
    const rowsOf = () => (db.tables[table] ??= [])
    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (op === 'insert') {
        db.writes.push({ table, op, payload })
        if (db.failNextInsert) {
          const error = db.failNextInsert
          db.failNextInsert = null
          return { data: null, error }
        }
        const row = payload as Row
        if (table === 'personality_assessments' && rowsOf().some((r) => r.user_id === row.user_id && r.seq === row.seq)) {
          return { data: null, error: { code: '23505' } }
        }
        const stored = { id: `a${rowsOf().length + 1}`, ...row }
        rowsOf().push(stored)
        return { data: stored, error: null }
      }
      if (op === 'update') {
        db.writes.push({ table, op, payload })
        const target = rowsOf().find((r) => filters.every((f) => f(r)))
        if (!target) return { data: null, error: { code: 'PGRST116' } }
        Object.assign(target, payload)
        return { data: target, error: null }
      }
      if (op === 'delete') {
        db.writes.push({ table, op, payload: null })
        return { data: null, error: null }
      }
      return { data: rowsOf().find((r) => filters.every((f) => f(r))) ?? null, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: Row) => ((op = 'insert'), (payload = p), api),
      update: (p: Row) => ((op = 'update'), (payload = p), api),
      delete: () => ((op = 'delete'), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      or: () => api,
      in: () => api,
      order: () => api,
      limit: () => api,
      single: () => run(),
      maybeSingle: () => run(),
    }
    return api
  }
}

let mockDb: FakeDb
const mockSignOut = jest.fn(async () => ({ error: null }))
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: (table: string) => mockDb.from(table),
    auth: { signOut: () => mockSignOut() },
  },
}))

const ME = 'me'
const PARTNER = 'p1'

function seed() {
  mockDb = new FakeDb()
  mockDb.tables.profiles = [
    { id: ME, display_name: '세준', gender: 'male', birth_date: '2004-03-28', onboarding_step: 3 },
    { id: PARTNER, display_name: '서영', gender: 'female', birth_date: '2004-05-01', onboarding_step: 3 },
  ]
  mockDb.tables.couples = [
    {
      id: 'c1',
      user_a_id: ME,
      user_b_id: PARTNER,
      status: 'active',
      relationship_start_date: '2025-12-27',
      start_date_set_by: PARTNER,
      start_date_confirmed_by: PARTNER,
      nickname: '늘봄',
    },
  ]
  mockDb.tables.personality_assessments = [
    {
      id: 'a1',
      user_id: ME,
      seq: 1,
      mbti: 'INFJ',
      q1: 'B',
      big_e: 34,
      big_o: 62,
      big_a: 70,
      big_c: 81,
      big_n: 41,
      stern_intimacy: 78,
      stern_passion: 54,
      stern_commitment: 86,
      attach_anxiety: 20,
      attach_avoidance: 30,
      attachment: 'anxious',
      enneagram_core: 1,
    },
  ]
  mockDb.tables.personality_profiles = [
    {
      user_id: ME,
      active_assessment_id: 'a1',
      enneagram_inferred: 1,
      enneagram_override: null,
      enneagram_effective: 1,
      override_count: 0,
      attachment: 'anxious',
      love_type_code: 'KLF',
      retest_used: false,
    },
  ]
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

/** 쓰는 칸 표(R42-6) - 이 시험이 보는 쓰기가 이 밖에 닿으면 실패한다. */
const ALLOWED_UPDATE_COLUMNS: Record<string, string[]> = {
  profiles: ['display_name', 'gender'],
  couples: ['relationship_start_date', 'start_date_set_by', 'start_date_confirmed_by', 'nickname'],
  personality_profiles: [
    'active_assessment_id',
    'enneagram_inferred',
    'attachment',
    'enneagram_override',
    'love_type_code',
    'retest_used',
    'override_count',
    'override_updated_at',
  ],
}

function expectWritesInsideTable() {
  for (const w of mockDb.writes) {
    expect(w.op).not.toBe('delete')
    if (w.op === 'insert') {
      expect(w.table).toBe('personality_assessments')
      continue
    }
    expect(ALLOWED_UPDATE_COLUMNS[w.table]).toBeDefined()
    for (const c of Object.keys(w.payload ?? {})) expect(ALLOWED_UPDATE_COLUMNS[w.table]).toContain(c)
  }
}

beforeEach(async () => {
  jest.useRealTimers()
  for (const m of [mockPush, mockReplace, mockBack, mockDismissTo, mockSignOut]) m.mockClear()
  mockParams = {}
  mockSession = { user: { id: ME, app_metadata: { provider: 'kakao' } } }
  seed()
  connectStore()
  useSessionStore.getState().resetSession()
  await AsyncStorage.clear()
})

async function settle() {
  await act(async () => {})
}

// ── H01 · H02 설정 목록 ──

describe('H01 · H02 설정 목록', () => {
  it('그룹 제목과 남은 항목이 보드 순서대로 보이고, 숨긴 항목은 하나도 없다', async () => {
    await render(<SettingsTab />)
    await settle()
    for (const g of SETTINGS_GROUPS) {
      expect(screen.getByText(g.kicker)).toBeTruthy()
      for (const item of g.items) expect(screen.getByText(item.label)).toBeTruthy()
    }
    for (const hidden of HIDDEN_SETTINGS_ITEMS) expect(screen.queryByText(hidden.label)).toBeNull()
    // 보드에서 뺀 그룹 제목도 없다.
    for (const kicker of ['OUR SKY', 'MAGAZINE', 'PHOTOS & DATA', 'NOTIFICATIONS', 'ETC']) expect(screen.queryByText(kicker)).toBeNull()
  })

  it('남은 항목은 모두 눌러서 갈 곳이 있다(빈 화면 0) - 경로가 서로 다른 설정 하위 화면이다', async () => {
    await render(<SettingsTab />)
    await settle()
    const hrefs: string[] = []
    for (const g of SETTINGS_GROUPS) {
      for (const item of g.items) {
        mockPush.mockClear()
        await fireEvent.press(screen.getByTestId(`settings-row-${item.key}`))
        expect(mockPush).toHaveBeenCalledTimes(1)
        hrefs.push(mockPush.mock.calls[0][0])
      }
    }
    expect(hrefs).toEqual([
      '/settings-profile',
      '/settings-profile',
      '/settings-couple',
      '/settings-couple',
      '/settings-personality',
      '/settings-privacy',
    ])
    // 각 경로가 실제 화면 파일이다.
    for (const href of new Set(hrefs)) expect(() => require.resolve(`../../app${href}`)).not.toThrow()
  })

  it('값은 읽기 전용으로 보인다 - 이름 · 카카오 · 서영 · D+N · 닉네임 · 영문 라벨', async () => {
    await render(<SettingsTab />)
    await settle()
    expect(screen.getByText('세준 →')).toBeTruthy()
    expect(screen.getByText('카카오 →')).toBeTruthy()
    expect(screen.getByText(/^서영 · D\+\d+ →$/)).toBeTruthy()
    expect(screen.getByText('늘봄 →')).toBeTruthy()
    expect(screen.getByText('KEELFLARE →')).toBeTruthy()
    expect(mockDb.writes).toEqual([])
  })

  it('미연결이어도 5개 탭 진입은 막지 않는다 - 연인 줄은 "연결 전"이고 눌러서 열린다', async () => {
    useCoupleStore.setState({
      status: 'disconnected',
      coupleId: null,
      partnerId: null,
      nickname: null,
      relationshipStartDate: null,
      refresh: (async () => {}) as never,
    })
    await render(<SettingsTab />)
    await settle()
    expect(screen.getByText('연결 전 →')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('settings-row-partner'))
    expect(mockPush).toHaveBeenCalledWith('/settings-couple')
  })
})

// ── H03 프로필 ──

describe('H03 프로필', () => {
  it('생년월일은 읽기 전용이다 - 입력은 이름 하나뿐이고 쓰기에 생년월일이 없다', async () => {
    await render(<SettingsProfileScreen />)
    await settle()
    expect(screen.getByText('2004.03.28')).toBeTruthy()
    expect(screen.getAllByDisplayValue(/./)).toHaveLength(1) // 글자 입력칸은 이름 하나뿐(날짜 · 생년월일 입력 없음)
    expect(screen.getByTestId('profile-name-input').props.value).toBe('세준')
    await fireEvent.changeText(screen.getByTestId('profile-name-input'), '새이름')
    await fireEvent.press(screen.getByTestId('profile-gender-female'))
    await fireEvent.press(screen.getByTestId('profile-save'))
    await settle()
    expect(mockDb.writes).toEqual([{ table: 'profiles', op: 'update', payload: { display_name: '새이름', gender: 'female' } }])
    expect(mockDb.writes.some((w) => w.payload && 'birth_date' in w.payload)).toBe(false)
    expect(mockDb.tables.profiles[0].birth_date).toBe('2004-03-28')
    expectWritesInsideTable()
    expect(mockBack).toHaveBeenCalled()
  })

  it('바꾼 것이 없거나 이름이 비면 [저장]은 눌리지 않는다', async () => {
    await render(<SettingsProfileScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('profile-save'))
    await fireEvent.changeText(screen.getByTestId('profile-name-input'), '   ')
    await fireEvent.press(screen.getByTestId('profile-save'))
    await settle()
    expect(mockDb.writes).toEqual([])
  })

  it('연결된 소셜 계정을 읽기로 보여 준다', async () => {
    await render(<SettingsProfileScreen />)
    await settle()
    expect(screen.getByText('카카오')).toBeTruthy()
  })

  it('[로그아웃] - 세션을 끝내고 시작 화면으로 가되, 그 사용자 키의 채팅 큐는 지우지 않는다', async () => {
    const key = chatQueueStorageKey('c1')
    await AsyncStorage.setItem(key, JSON.stringify([{ id: 'q1' }]))
    const removeItem = jest.spyOn(AsyncStorage, 'removeItem')
    await render(<SettingsProfileScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('profile-logout'))
    await settle()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/')
    expect(removeItem).not.toHaveBeenCalled()
    expect(await AsyncStorage.getItem(key)).toBe(JSON.stringify([{ id: 'q1' }]))
    expect(mockDb.writes).toEqual([])
    removeItem.mockRestore()
  })

  it('회원 탈퇴 · 사진 바꾸기는 그리지 않는다', async () => {
    await render(<SettingsProfileScreen />)
    await settle()
    expect(screen.queryByText('회원 탈퇴')).toBeNull()
    expect(screen.queryByText('사진 바꾸기')).toBeNull()
  })
})

// ── H04 커플 ──

describe('H04 커플', () => {
  it('연결 상태와 사귄 날짜 · 닉네임 줄이 보이고 [연결 해제]는 없다', async () => {
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByTestId('couple-status').props.children).toBe('서영과 연결됨')
    expect(screen.getByTestId('couple-since').props.children).toMatch(/^D\+\d+ · 2025\.12\.27부터$/)
    expect(screen.getByText('2025.12.27 →')).toBeTruthy()
    expect(screen.getByText('늘봄 →')).toBeTruthy()
    expect(screen.queryByText(/연결 해제/)).toBeNull()
  })

  it('사귄 날짜를 고치면 한 번의 UPDATE에 날짜 · set_by = 나 · confirmed_by = null이 같이 들어간다', async () => {
    await render(<SettingsCoupleScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('couple-row-date'))
    await fireEvent.changeText(screen.getByTestId('couple-date-input'), '20251101')
    expect(screen.getByTestId('couple-date-input').props.value).toBe('2025.11.01')
    await fireEvent.press(screen.getByTestId('couple-date-save'))
    await settle()
    expect(mockDb.writes).toEqual([
      {
        table: 'couples',
        op: 'update',
        payload: { relationship_start_date: '2025-11-01', start_date_set_by: ME, start_date_confirmed_by: null },
      },
    ])
    expect(mockDb.tables.couples[0]).toMatchObject({ start_date_set_by: ME, start_date_confirmed_by: null })
    expectWritesInsideTable()
  })

  it('미래 날짜는 저장할 수 없다 - 서버로 아무것도 안 간다', async () => {
    await render(<SettingsCoupleScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('couple-row-date'))
    await fireEvent.changeText(screen.getByTestId('couple-date-input'), '20991231')
    expect(screen.getByTestId('couple-date-hint').props.children).toBe('오늘까지의 날짜를 입력해주세요')
    await fireEvent.press(screen.getByTestId('couple-date-save'))
    await settle()
    expect(mockDb.writes).toEqual([])
  })

  it.each([
    [0, false],
    [1, true],
    [20, true],
    [21, false],
  ])('커플 닉네임 %i자 -> 저장 %s', async (len, ok) => {
    await render(<SettingsCoupleScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('couple-row-nickname'))
    await fireEvent.changeText(screen.getByTestId('couple-nickname-input'), '가'.repeat(len))
    await fireEvent.press(screen.getByTestId('couple-nickname-save'))
    await settle()
    if (ok) {
      expect(mockDb.writes).toEqual([{ table: 'couples', op: 'update', payload: { nickname: '가'.repeat(len) } }])
    } else {
      expect(mockDb.writes).toEqual([])
    }
    expectWritesInsideTable()
  })

  it('미연결이면 잠긴 문(초대하기)이 보인다 - 빈 화면이 아니다', async () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null, refresh: (async () => {}) as never })
    await render(<SettingsCoupleScreen />)
    await settle()
    expect(screen.getByText('연인과 연결하면 열려요')).toBeTruthy()
    expect(screen.getByText('초대하기')).toBeTruthy()
  })
})

// ── A20 재표시 ──

describe('A20 재표시 - 상대가 고친 날짜', () => {
  function Probe() {
    useStartDateRecheck()
    return null
  }

  it('확인자가 null이고 정한 사람이 상대면 사귄 날짜 확인 길(?recheck=1)을 연다 - 같은 값으로는 한 번만', async () => {
    mockDb.tables.couples[0].start_date_confirmed_by = null
    await render(<Probe />)
    await settle()
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/start-date?recheck=1')
  })

  it('내가 정했거나 이미 확인했으면 열지 않는다', async () => {
    await render(<Probe />) // 정한 사람 = 상대, 확인자 = 상대(채워져 있음)
    await settle()
    expect(mockPush).not.toHaveBeenCalled()
    mockDb.tables.couples[0].start_date_set_by = ME
    mockDb.tables.couples[0].start_date_confirmed_by = null
    await render(<Probe />)
    await settle()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('재표시 길에서 [확인했어요]는 확인자만 쓰고 진행 단계는 쓰지 않으며 메인으로 돌아간다', async () => {
    mockParams = { recheck: '1' }
    mockDb.tables.couples[0].start_date_confirmed_by = null
    await render(<StartDateScreen />)
    await settle()
    expect(screen.getByTestId('start-since-date').props.children).toBe('2025.12.27')
    expect(screen.getByTestId('start-confirm-note').props.children).toBe('날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요')
    await fireEvent.press(screen.getByTestId('start-confirm'))
    await settle()
    expect(mockDb.writes).toEqual([{ table: 'couples', op: 'update', payload: { start_date_confirmed_by: ME } }])
    expect(mockDb.writes.some((w) => w.table === 'profiles')).toBe(false) // onboarding_step 쓰기 0
    expect(mockDb.tables.couples[0].relationship_start_date).toBe('2025-12-27') // 날짜 그대로
    expect(mockDismissTo).toHaveBeenCalledWith('/main')
  })

  it('재표시 길인데 할 일이 없으면(이미 확인함) 아무것도 쓰지 않고 돌아간다', async () => {
    mockParams = { recheck: '1' }
    await render(<StartDateScreen />)
    await settle()
    expect(mockDb.writes).toEqual([])
    expect(mockDismissTo).toHaveBeenCalledWith('/main')
  })
})

// ── H05 · H06 ──

describe('H05 성격 프로필', () => {
  it('지금 결과 카드와 세 줄이 보이고, 애착 이름("안정형" 등)은 쓰지 않는다', async () => {
    await render(<SettingsPersonalityScreen />)
    await settle()
    expect(screen.getByTestId('personality-label-en').props.children).toBe('KEELFLARE')
    expect(screen.getByTestId('personality-meta').props.children.join('')).toBe('INFJ · 애니어그램 1')
    expect(screen.queryByText(/안정형|불안형|회피형/)).toBeNull()
    expect(screen.getByText('결과 다시 보기')).toBeTruthy()
    expect(screen.getByText('애니어그램 코어 고치기')).toBeTruthy()
    expect(screen.getByText('계정당 한 번 · 아직 쓰지 않았어요')).toBeTruthy()
  })

  it('결과 다시 보기 · 코어 고치기는 A14 · A16 설정 모드로 간다', async () => {
    await render(<SettingsPersonalityScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('personality-row-view'))
    expect(mockPush).toHaveBeenLastCalledWith('/result-detail?source=settings')
    await fireEvent.press(screen.getByTestId('personality-row-override'))
    expect(mockPush).toHaveBeenLastCalledWith('/result-detail?source=settings&view=override')
  })

  it('재검사 줄은 확인 시트를 거치고, [다시 하기]로 A04 재검사 길을 연다(메모리 답은 비운다)', async () => {
    useSessionStore.getState().setName('이전 답')
    await render(<SettingsPersonalityScreen />)
    await settle()
    expect(screen.getByTestId('personality-row-retest')).toBeTruthy() // 열려 있는 줄은 누르는 버튼이다
    await fireEvent.press(screen.getByTestId('personality-row-retest'))
    expect(screen.getByText('다시 하기는 한 번뿐이에요')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('retest-confirm-yes'))
    expect(mockPush).toHaveBeenCalledWith('/mbti?retest=1')
    expect(useSessionStore.getState().name).toBe('')
    expect(mockDb.writes).toEqual([]) // 확인만으로는 아무것도 쓰지 않는다
  })

  it('[취소]는 닫기만 한다', async () => {
    await render(<SettingsPersonalityScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('personality-row-retest'))
    await fireEvent.press(screen.getByTestId('retest-confirm-cancel'))
    expect(screen.queryByText('다시 하기는 한 번뿐이에요')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('이미 썼으면(retest_used) 재검사 줄이 비활성이다 - 눌러도 시트가 열리지 않는다', async () => {
    mockDb.tables.personality_profiles[0].retest_used = true
    await render(<SettingsPersonalityScreen />)
    await settle()
    expect(screen.getByText('계정당 한 번 · 이미 썼어요')).toBeTruthy()
    // 비활성 줄은 누르는 컴포넌트(접근성 라벨이 붙은 버튼)로 그려지지 않는다 - 글자만 있다(textFaint).
    expect(screen.getByText('5문항 다시 하기')).toBeTruthy()
    expect(screen.queryByTestId('personality-row-retest')).toBeNull()
    expect(screen.queryByLabelText('5문항 다시 하기')).toBeNull()
    expect(screen.queryByText('다시 하기는 한 번뿐이에요')).toBeNull()
  })
})

describe('A14 · A16 설정 모드', () => {
  it('설정 모드 A14는 "다음"이 없고 프로필 행을 만들지 않는다(진행 단계 쓰기 0)', async () => {
    mockParams = { source: 'settings' }
    await render(<ResultDetailScreen />)
    await settle()
    expect(screen.getByTestId('detail-label-en').props.children).toBe('KEELFLARE')
    expect(screen.queryByTestId('detail-next')).toBeNull()
    expect(mockDb.writes).toEqual([])
  })

  it('프로필이 없으면 만들지 않고 "아직 저장된 결과가 없어요"를 보인다', async () => {
    mockParams = { source: 'settings' }
    mockDb.tables.personality_profiles = []
    await render(<ResultDetailScreen />)
    await settle()
    expect(screen.getByText('아직 저장된 결과가 없어요.')).toBeTruthy()
    expect(mockDb.writes).toEqual([])
  })

  it('?view=override로 A16부터 열리고, 저장하면 오버라이드 칸만 쓰고 love_type_code를 같은 UPDATE에서 다시 계산한 뒤 돌아간다', async () => {
    mockParams = { source: 'settings', view: 'override' }
    await render(<ResultDetailScreen />)
    await settle()
    await fireEvent.press(screen.getByTestId('core-9'))
    await fireEvent.press(screen.getByTestId('override-confirm'))
    await settle()
    expect(mockDb.writes).toHaveLength(1)
    expect(mockDb.writes[0].table).toBe('personality_profiles')
    expect(Object.keys(mockDb.writes[0].payload ?? {}).sort()).toEqual(
      ['enneagram_override', 'love_type_code', 'override_count', 'override_updated_at'].sort(),
    )
    expect(mockDb.writes[0].payload).toMatchObject({ enneagram_override: 9, love_type_code: 'LLF' })
    expectWritesInsideTable()
    expect(mockBack).toHaveBeenCalled()
  })
})

// ── 재검사 길 A04 ~ A07 ──

describe('재검사 길', () => {
  function answerAll() {
    return (async () => {
      for (let i = 0; i < 5; i += 1) await fireEvent.press(screen.getByTestId('quiz-option-A'))
      await settle()
    })()
  }

  it('A04 · A05는 다음 화면만 ?retest=1로 잇는다', async () => {
    mockParams = { retest: '1' }
    await render(<MbtiScreen />)
    await fireEvent.press(screen.getByTestId('mbti-known'))
    await fireEvent.press(screen.getByTestId('mbti-choose-next'))
    for (const l of ['I', 'N', 'F', 'J']) await fireEvent.press(screen.getByTestId(`mbti-letter-${l}`))
    await fireEvent.press(screen.getByTestId('mbti-known-next'))
    expect(mockPush).toHaveBeenCalledWith('/love-quiz?retest=1')
  })

  it('A07 마지막 문항 뒤 새 assessment를 INSERT하고 이전 행은 그대로, 프로필은 한 번의 UPDATE, 그리고 H05로 돌아간다', async () => {
    mockParams = { retest: '1' }
    useSessionStore.getState().setMbtiSelfReported('INFJ')
    const before = { ...mockDb.tables.personality_assessments[0] }
    await render(<LoveQuizScreen />)
    await answerAll()
    const inserts = mockDb.writes.filter((w) => w.op === 'insert')
    const updates = mockDb.writes.filter((w) => w.op === 'update')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].payload).toMatchObject({ user_id: ME, seq: 2, mbti: 'INFJ' })
    expect(updates).toHaveLength(1)
    expect(Object.keys(updates[0].payload ?? {}).sort()).toEqual(
      ['active_assessment_id', 'attachment', 'enneagram_inferred', 'enneagram_override', 'love_type_code', 'retest_used'].sort(),
    )
    expect(updates[0].payload).toMatchObject({ enneagram_override: null, retest_used: true })
    expect(mockDb.writes.some((w) => w.op === 'delete')).toBe(false)
    expect(mockDb.tables.personality_assessments).toHaveLength(2)
    expect(mockDb.tables.personality_assessments[0]).toEqual(before)
    expect(mockDb.tables.personality_profiles[0].active_assessment_id).toBe(mockDb.tables.personality_assessments[1].id)
    expectWritesInsideTable()
    expect(mockDismissTo).toHaveBeenCalledWith('/settings-personality')
    expect(mockPush).not.toHaveBeenCalledWith('/result-brief') // A08 간략 결과로 가지 않는다
    expect(useSessionStore.getState().q1).toBeNull() // 메모리 답은 비운다
  })

  it('재검사 INSERT의 23505는 실패다 - 프로필은 그대로이고, 돌아가기만 보인다(다시 시도 없음)', async () => {
    mockParams = { retest: '1' }
    useSessionStore.getState().setMbtiSelfReported('INFJ')
    mockDb.failNextInsert = { code: '23505' }
    await render(<LoveQuizScreen />)
    await answerAll()
    expect(screen.getByText('이미 재검사 기록이 있어요.')).toBeTruthy()
    expect(screen.queryByTestId('retest-retry')).toBeNull()
    expect(screen.getByTestId('retest-back')).toBeTruthy()
    expect(mockDb.writes.filter((w) => w.op === 'update')).toEqual([])
    expect(mockDb.tables.personality_profiles[0].retest_used).toBe(false)
    expect(mockDismissTo).not.toHaveBeenCalled()
  })

  it('다른 오류로 실패하면 [다시 시도]가 있고, 다시 누르면 같은 답으로 저장한다', async () => {
    mockParams = { retest: '1' }
    useSessionStore.getState().setMbtiSelfReported('INFJ')
    mockDb.failNextInsert = { code: '08006' }
    await render(<LoveQuizScreen />)
    await answerAll()
    expect(screen.getByText('저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('retest-retry'))
    await settle()
    expect(mockDb.tables.personality_assessments).toHaveLength(2)
    expect(mockDb.tables.personality_profiles[0].retest_used).toBe(true)
    expect(mockDismissTo).toHaveBeenCalledWith('/settings-personality')
  })

  it('재검사가 아닌 길은 그대로 A08로 간다 - 서버 쓰기 0', async () => {
    useSessionStore.getState().setMbtiSelfReported('INFJ')
    await render(<LoveQuizScreen />)
    await answerAll()
    expect(mockPush).toHaveBeenCalledWith('/result-brief')
    expect(mockDb.writes).toEqual([])
  })
})

// ── H11 ──

describe('H11 개인정보 & 약관', () => {
  it('개인정보 처리방침 · 이용약관 · AI 활용 안내가 A12 약관 시트를 연다 - 생체정보 · 내려받기 · 마케팅 줄은 없다', async () => {
    await render(<SettingsPrivacyScreen />)
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy()
    for (const [id, key] of [
      ['privacy-row-privacy', 'privacy'],
      ['privacy-row-terms', 'terms'],
      ['privacy-row-aiUsage', 'aiUsage'],
    ]) {
      mockPush.mockClear()
      await fireEvent.press(screen.getByTestId(id))
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/legal-document', params: { key } })
    }
    expect(screen.queryByText(/생체정보/)).toBeNull()
    expect(screen.queryByText(/내려받기/)).toBeNull()
    expect(screen.queryByText(/마케팅/)).toBeNull()
    expect(mockDb.writes).toEqual([])
  })
})
