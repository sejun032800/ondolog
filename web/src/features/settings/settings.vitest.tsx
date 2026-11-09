/**
 * 설정 화면 시험 - H01~H06 · H11 · H14 해제 · H16 탈퇴 · 탈퇴 유예 · H19. 가짜 서버(`settingsTestSupport` + `testSupportCouple`) + 가짜 다리 - 원격 0.
 * 원본(행동 단언): `__tests__/components/u7Settings.test.tsx`(H01~H06 · H11) · `u7Dissolution.test.tsx`(H14 · H16 · 유예) · `__tests__/services/settingsCore.test.ts` · `dissolutionCore.test.ts` · `__tests__/utils/dissolution.test.ts`(루트 순수 규칙은 루트 jest가 계속 지킨다).
 * 서버 쓰기는 가짜 서버의 `writes`(직접 쓰기) · `rpcCalls`(함수 호출)로 본다. 해제 · 탈퇴는 RN이 부르던 같은 요청/취소 함수만 부르고 실행 함수는 한 번도 부르지 않는다(R34-3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LEGAL_DOCUMENTS } from '@/constants/legalDocuments'
import { SUPPORT_EMAIL } from '@/constants/support'
import { useSessionStore } from '@/store/sessionStore'
import { SETTINGS_GROUPS } from '@/utils/settingsRules'
import { ALL_ROUTES } from '../../app/routes'
import { ROUTE_ELEMENTS } from '../../app/routeTable'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { SettingsTab } from '../../tabs/SettingsTab'
import { makeFakeBridge, makeFakeNav } from '../../testSupport'
import type { FakeRow } from '../../testSupportCouple'
import pkg from '../../../package.json'
import { AboutScreen } from './AboutScreen'
import { CoupleScreen } from './CoupleScreen'
import { PersonalityScreen } from './PersonalityScreen'
import { PrivacyScreen } from './PrivacyScreen'
import { ProfileScreen } from './ProfileScreen'
import { RetestScreen } from './RetestScreen'
import { SettingsResultScreen } from './SettingsResultScreen'
import { UnlinkScreen } from './UnlinkScreen'
import { WithdrawCancelScreen } from './WithdrawCancelScreen'
import { WithdrawScreen } from './WithdrawScreen'
import {
  ACTIVE, DISSOLUTION_BY_ME, DISSOLUTION_BY_PARTNER, DISSOLVING, FORBIDDEN_RPC, ME, NOW, PERSONALITY, settingsDb, type SettingsDbOptions,
} from './settingsTestSupport'
import { resetSettingsSummaryCache } from './useSettingsSummary'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  useAuthStore.getState().setUserId('me')
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  resetSettingsSummaryCache()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  vi.useRealTimers()
})

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const byId = (id: string) => screen.getByTestId(id)
const type = (id: string, value: string) => fireEvent.change(byId(id), { target: { value } })
const click = (id: string) => fireEvent.click(byId(id))
const rpcNames = (db: ReturnType<typeof settingsDb>) => db.rpcCalls.map((c) => c.fn)
const writesTo = (db: ReturnType<typeof settingsDb>, table: string) => db.writes.filter((w) => w.table === table)
const expectNoExecutionFunctions = (db: ReturnType<typeof settingsDb>) => {
  for (const name of rpcNames(db)) expect(FORBIDDEN_RPC).not.toContain(name)
}

/** 커플이 연결된 상태로 저장소를 채운다(앱에서는 `useAccountData`가 하는 일). */
async function loadStores() {
  await useCoupleStore.getState().refresh('me')
  await useDissolutionStore.getState().refresh('me')
}

// ───────────────────────────── H01 · H02 설정 목록 ─────────────────────────────

describe('H01 · H02 설정 목록', () => {
  it('표(SETTINGS_GROUPS)의 항목만 그린다 - 갈 곳이 없는 항목과 [연결 해제] · [회원 탈퇴]는 목록에 없다', async () => {
    settingsDb()
    await loadStores()
    render(<SettingsTab nav={makeFakeNav()} />)
    await settle()
    const labels = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toEqual(['프로필', '연결된 계정', '연인', '커플 닉네임', '성격 프로필', '개인정보 & 약관', '앱 정보 · 문의'])
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy()
    for (const hidden of ['구독', '사진 앱 연동', '알림', '데이터 내려받기', '빠진 지면', '생체정보', '오픈소스', '유성', '연결 해제', '회원 탈퇴']) {
      expect(screen.queryByText(new RegExp(hidden))).toBeNull()
    }
  })

  it('남은 모든 줄은 갈 곳이 있다 - 누르면 라우터에 있는 화면으로 간다(빈 화면 0)', async () => {
    settingsDb()
    await loadStores()
    const nav = makeFakeNav()
    render(<SettingsTab nav={nav} />)
    await settle()
    const rows = SETTINGS_GROUPS.flatMap((g) => g.items)
    for (const item of rows) fireEvent.click(byId(`settings-row-${item.key}`))
    const targets = (nav.push as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(targets).toEqual(['settings-profile', 'settings-profile', 'settings-couple', 'settings-couple', 'settings-personality', 'settings-privacy', 'settings-about'])
    for (const t of targets) {
      expect(ALL_ROUTES).toContain(t)
      expect(Object.keys(ROUTE_ELEMENTS)).toContain(t)
    }
  })

  it('오른쪽 값: 이름 · 로그인 방식 · 연인 이름과 D+N · 닉네임 · 성격 영문 라벨 · 앱 버전', async () => {
    settingsDb()
    await loadStores()
    render(<SettingsTab nav={makeFakeNav()} />)
    await settle()
    expect(within(byId('settings-row-profile')).getByText('세준')).toBeTruthy()
    expect(within(byId('settings-row-social')).getByText('카카오')).toBeTruthy()
    expect(byId('settings-row-partner').textContent).toMatch(/서영 · D\+\d+/)
    expect(within(byId('settings-row-nickname')).getByText('늘봄')).toBeTruthy()
    expect(byId('settings-row-personality').textContent).toMatch(/[A-Z]{5,}/)
    expect(within(byId('settings-row-about')).getByText(pkg.version)).toBeTruthy()
  })

  it('B14: 값이 다 읽히기 전에는 오른쪽 값 자리가 뼈대다(값이 늦게 채워지지 않는다), 읽히면 뼈대가 사라진다', async () => {
    settingsDb()
    // 커플 조회 전(unknown) · 요약 읽기 전.
    render(<SettingsTab nav={makeFakeNav()} />)
    expect(within(byId('settings-row-profile')).queryByTestId('skeleton')).not.toBeNull()
    expect(within(byId('settings-row-partner')).queryByTestId('skeleton')).not.toBeNull()
    expect(within(byId('settings-row-nickname')).queryByTestId('skeleton')).not.toBeNull()
    // 읽을 값이 없는 줄(개인정보 · 앱 정보)은 바로 보인다.
    expect(within(byId('settings-row-privacy')).queryByTestId('skeleton')).toBeNull()
    expect(within(byId('settings-row-about')).queryByTestId('skeleton')).toBeNull()
    await loadStores()
    await settle()
    expect(document.querySelectorAll('[data-testid="skeleton"]').length).toBe(0)
  })

  it('하위 화면에 다녀오면 직전 값이 먼저 보이고 뼈대로 되돌아가지 않는다', async () => {
    settingsDb()
    await loadStores()
    const first = render(<SettingsTab nav={makeFakeNav()} />)
    await settle()
    first.unmount()
    render(<SettingsTab nav={makeFakeNav()} />)
    expect(within(byId('settings-row-profile')).getByText('세준')).toBeTruthy()
    expect(within(byId('settings-row-profile')).queryByTestId('skeleton')).toBeNull()
  })

  it('미연결이어도 모든 줄이 열린다 - 연인은 "연결 전", 닉네임은 비어 있다', async () => {
    settingsDb({ couples: [] })
    await loadStores()
    render(<SettingsTab nav={makeFakeNav()} />)
    await settle()
    expect(within(byId('settings-row-partner')).getByText('연결 전')).toBeTruthy()
    expect(within(byId('settings-row-nickname')).queryByText('늘봄')).toBeNull()
    expect((byId('settings-row-partner') as HTMLButtonElement).disabled).toBe(false)
  })

  it('해제 유예 중이면 연인 줄이 "해제 예정"이다(연결 전으로 오해하지 않게)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    await loadStores()
    render(<SettingsTab nav={makeFakeNav()} />)
    await settle()
    expect(within(byId('settings-row-partner')).getByText('해제 예정')).toBeTruthy()
  })
})

// ───────────────────────────── H03 프로필 ─────────────────────────────

describe('H03 프로필', () => {
  it('불러오는 동안은 뼈대, 읽히면 이름 · 성별 · 생년월일 · 연결된 계정', async () => {
    settingsDb()
    render(<ProfileScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('settings-skeleton')).not.toBeNull()
    await settle()
    expect(screen.queryByTestId('settings-skeleton')).toBeNull()
    expect((byId('profile-name-input') as HTMLInputElement).value).toBe('세준')
    expect(byId('profile-gender-male').getAttribute('aria-checked')).toBe('true')
    expect(byId('profile-birth-row').textContent).toContain('1995.05.05')
    expect(byId('profile-social-row').textContent).toContain('카카오')
  })

  it('생년월일은 읽기 전용이다 - 입력도 버튼도 없고 저장해도 쓰기에 들어가지 않는다(R42-7)', async () => {
    const db = settingsDb()
    render(<ProfileScreen nav={makeFakeNav()} />)
    await settle()
    const row = byId('profile-birth-row')
    expect(row.querySelector('input')).toBeNull()
    expect(row.tagName).not.toBe('BUTTON')
    type('profile-name-input', '새이름')
    click('profile-save')
    await settle()
    const [w] = writesTo(db, 'profiles')
    expect(Object.keys(w.payload).sort()).toEqual(['display_name', 'gender'])
    expect(JSON.stringify(db.writes)).not.toMatch(/birth_date|deleted_at|purge_scheduled_at|onboarding_step|_agreed_at/)
  })

  it('이름 1~20자만 저장할 수 있다(0자 · 21자는 저장 버튼이 꺼진다) - 공백만도 0자', async () => {
    settingsDb()
    render(<ProfileScreen nav={makeFakeNav()} />)
    await settle()
    const save = byId('profile-save') as HTMLButtonElement
    expect(save.disabled).toBe(true) // 바뀐 것이 없다
    type('profile-name-input', '')
    expect(save.disabled).toBe(true)
    expect(screen.queryByTestId('profile-name-hint')).not.toBeNull()
    type('profile-name-input', '   ')
    expect(save.disabled).toBe(true)
    type('profile-name-input', '가'.repeat(21))
    expect(save.disabled).toBe(true)
    type('profile-name-input', '가')
    expect(save.disabled).toBe(false)
    type('profile-name-input', '가'.repeat(20))
    expect(save.disabled).toBe(false)
  })

  it('저장: 이름 · 성별만 한 번 쓰고 앞 화면으로. 실패하면 남아서 안내한다', async () => {
    const db = settingsDb()
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    await settle()
    type('profile-name-input', '새이름')
    click('profile-gender-female')
    click('profile-save')
    await settle()
    expect(writesTo(db, 'profiles')).toEqual([{ table: 'profiles', op: 'update', payload: { display_name: '새이름', gender: 'female' } }])
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('저장 실패: 화면에 남고 안내가 보인다', async () => {
    settingsDb({ failUpdates: ['profiles'] })
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    await settle()
    type('profile-name-input', '새이름')
    click('profile-save')
    await settle()
    expect(byId('profile-error').textContent).toBe('저장하지 못했어요. 다시 시도해주세요.')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('[회원 탈퇴] 줄은 탈퇴 화면으로, 읽기에 실패해도 로그아웃 · 탈퇴 줄은 늘 열려 있다', async () => {
    settingsDb({ profiles: [] })
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    await settle()
    expect(screen.queryByTestId('profile-load-error')).not.toBeNull()
    click('profile-withdraw')
    expect(nav.push).toHaveBeenCalledWith('settings-withdraw')
    expect(byId('profile-logout')).toBeTruthy()
  })

  it('로그아웃: 메모리를 비우고 세션을 끝낸 뒤 첫 화면으로 간다', async () => {
    const db = settingsDb()
    await loadStores()
    useSessionStore.getState().setName('임시')
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    await settle()
    click('profile-logout')
    await settle()
    expect(db.signOutCalls).toEqual([undefined])
    expect(nav.reset).toHaveBeenCalledWith('intro')
    expect(useAuthStore.getState().userId).toBeNull()
    expect(useCoupleStore.getState().status).toBe('unknown')
    expect(useProfileStore.getState().status).toBe('unknown')
    expect(useDissolutionStore.getState().status).toBe('unknown')
    expect(useSessionStore.getState().name).toBe('')
  })

  it('서버 로그아웃이 실패해도(끊긴 연결) 이 기기의 세션은 지운다 - scope local로 한 번 더, 그리고 첫 화면', async () => {
    const db = settingsDb({ signOutError: { message: 'network' } })
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    await settle()
    click('profile-logout')
    await settle()
    expect(db.signOutCalls).toEqual([undefined, { scope: 'local' }])
    expect(nav.reset).toHaveBeenCalledWith('intro')
  })
})

// ───────────────────────────── H04 커플 · H14 유예 ─────────────────────────────

describe('H04 커플', () => {
  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    const nav = makeFakeNav()
    render(<CoupleScreen nav={nav} />)
    await settle()
    return { db, nav }
  }

  it('B14: 읽기 전에는 뼈대(빈 화면 뒤에 카드가 나타나지 않는다), 읽히면 카드 · 두 줄 · [연결 해제]', async () => {
    settingsDb()
    render(<CoupleScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('settings-skeleton')).not.toBeNull()
    expect(screen.queryByTestId('couple-card')).toBeNull()
    await settle()
    expect(screen.queryByTestId('settings-skeleton')).toBeNull()
    expect(byId('couple-status').textContent).toBe('서영과 연결됨')
    expect(byId('couple-since').textContent).toMatch(/^D\+\d+ · 2025\.01\.01부터$/)
    expect(byId('couple-row-date').textContent).toContain('2025.01.01')
    expect(byId('couple-row-nickname').textContent).toContain('늘봄')
    expect(byId('couple-unlink')).toBeTruthy()
  })

  it('patch7 ⓓ: 날짜 안내는 날짜 줄 바로 아래(같은 줄 안)에 있다 - 바꾸기 전에 읽힌다', async () => {
    await open()
    expect(byId('couple-row-date').textContent).toContain('저장하면 상대가 다음에 앱에 들어올 때 날짜를 확인해요')
    expect(byId('couple-row-nickname').textContent).not.toContain('저장하면 상대가')
  })

  it('사귄 날짜 수정: 한 번의 UPDATE에 날짜 · set_by = 나 · confirmed_by = null이 함께 들어간다', async () => {
    const { db } = await open()
    click('couple-row-date')
    type('couple-date-input', '20250301')
    expect((byId('couple-date-input') as HTMLInputElement).value).toBe('2025.03.01')
    click('couple-date-save')
    await settle()
    const updates = writesTo(db, 'couples')
    expect(updates).toHaveLength(1)
    expect(updates[0].payload).toEqual({ relationship_start_date: '2025-03-01', start_date_set_by: 'me', start_date_confirmed_by: null })
    // 저장한 뒤 줄 목록으로 돌아와 새 값이 보인다.
    expect(byId('couple-row-date').textContent).toContain('2025.03.01')
  })

  it('미래 날짜 · 없는 날짜는 저장할 수 없다(KST 오늘까지, A19와 같은 규칙)', async () => {
    const { db } = await open()
    click('couple-row-date')
    const save = byId('couple-date-save') as HTMLButtonElement
    type('couple-date-input', '20261231')
    expect(save.disabled).toBe(true)
    expect(byId('couple-date-hint').textContent).toBe('오늘까지의 날짜를 입력해주세요')
    type('couple-date-input', '20250230')
    expect(save.disabled).toBe(true)
    type('couple-date-input', '20251021') // 오늘은 가능
    expect(save.disabled).toBe(false)
    expect(writesTo(db, 'couples')).toHaveLength(0)
  })

  it('입력 모습에서 ← 는 줄 목록으로 돌아온다(화면을 나가지 않는다)', async () => {
    const { nav } = await open()
    click('couple-row-date')
    expect(byId('settings-couple-date')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(byId('settings-couple')).toBeTruthy()
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('커플 닉네임: 1자 · 20자는 저장되고 0자 · 21자는 막힌다. 쓰는 칸은 nickname 하나', async () => {
    const { db } = await open()
    click('couple-row-nickname')
    const save = byId('couple-nickname-save') as HTMLButtonElement
    type('couple-nickname-input', '')
    expect(save.disabled).toBe(true)
    type('couple-nickname-input', '가'.repeat(21))
    expect(save.disabled).toBe(true)
    expect(byId('couple-nickname-hint').textContent).toBe('20자까지 쓸 수 있어요')
    type('couple-nickname-input', '가'.repeat(20))
    expect(save.disabled).toBe(false)
    type('couple-nickname-input', '가')
    expect(save.disabled).toBe(false)
    click('couple-nickname-save')
    await settle()
    expect(writesTo(db, 'couples').map((w) => w.payload)).toEqual([{ nickname: '가' }])
  })

  it('저장 실패: 입력 모습에 남고 안내가 보인다', async () => {
    const { db } = await open({ failUpdates: ['couples'] })
    click('couple-row-nickname')
    type('couple-nickname-input', '새닉네임')
    click('couple-nickname-save')
    await settle()
    expect(byId('couple-error').textContent).toBe('저장하지 못했어요. 다시 시도해주세요.')
    expect(writesTo(db, 'couples')).toHaveLength(0)
  })

  it('[연결 해제]는 문구 입력 화면으로 간다(바로 해제하지 않는다)', async () => {
    const { db, nav } = await open()
    click('couple-unlink')
    expect(nav.push).toHaveBeenCalledWith('settings-unlink')
    expect(db.rpcCalls).toEqual([])
    expect(byId('couple-unlink-hint').textContent).toBe('해제를 요청하면 7일 동안 취소할 수 있어요. 7일이 지나면 내가 남긴 기록만 지워지고 서영의 기록은 남아요.')
  })

  it('미연결: 빈 화면이 아니라 I01 잠긴 문(초대하기)을 보인다', async () => {
    await open({ couples: [] })
    expect(byId('couple-needed')).toBeTruthy()
    expect(screen.queryByTestId('couple-row-date')).toBeNull()
    expect(screen.queryByTestId('couple-unlink')).toBeNull()
  })
})

describe('H14 해제 유예 화면 - 양쪽', () => {
  it('개시자(나): 남은 날짜(서버 purge_scheduled_at 기준 KST) · 날짜 · [해제 취소하기]', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_ME] })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    expect(byId('grace-days').textContent).toBe('5일')
    expect(byId('grace-date').textContent).toBe('10월 26일에 연결이 해제돼요')
    expect(screen.getByText('해제 취소하기')).toBeTruthy()
    expect(screen.queryByTestId('grace-cancel-reason')).toBeNull()
    expect(byId('grace-bullets').textContent).toContain('서영에게 해제 요청을 알렸어요')
    expect(byId('grace-bullets').textContent).toContain('해제 예정 기간에는 새 호를 만들지 않아요')
    expect(byId('grace-bullets').textContent).toContain('내가 남긴 사진·글·대화가 지워지고, 서영의 기록은 남아요')
  })

  it('남은 날짜는 서버 값에서만 센다 - 앱이 7일을 더하지 않는다(파기 예정일이 바뀌면 숫자도 바뀐다)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [{ ...DISSOLUTION_BY_ME, purge_scheduled_at: '2025-10-23T00:00:00+09:00' }] })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    expect(byId('grace-days').textContent).toBe('2일')
    expect(byId('grace-date').textContent).toBe('10월 23일에 연결이 해제돼요')
  })

  it('상대: 취소 버튼이 없고 이유 문장이 있으며, 주어가 바뀐다("서영이 … 요청했어요" · "내 기록은 남아요", patch7 ⓔ)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    expect(byId('grace-days').textContent).toBe('5일')
    expect(screen.queryByText('해제 취소하기')).toBeNull()
    expect(byId('grace-cancel-reason').textContent).toBe('취소는 요청한 사람만 할 수 있어요.')
    const text = byId('grace-bullets').textContent ?? ''
    expect(text).toContain('서영이 연결 해제를 요청했어요')
    expect(text).toContain('서영이 남긴 사진·글·대화가 지워지고, 내 기록은 남아요')
    expect(text).not.toContain('내가 남긴 사진')
  })

  it('상대가 탈퇴를 요청해서 생긴 해제도 상대 쪽 문장("탈퇴를 요청했어요")이고 취소 버튼이 없다', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [{ ...DISSOLUTION_BY_PARTNER, reason: 'withdrawal' }] })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    expect(byId('grace-bullets').textContent).toContain('서영이 탈퇴를 요청했어요')
    expect(screen.queryByText('해제 취소하기')).toBeNull()
  })

  it('내가 탈퇴해서 생긴 해제는 이 화면에서 취소할 수 없다(탈퇴 취소로만 되돌린다)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [{ ...DISSOLUTION_BY_ME, reason: 'withdrawal' }] })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    expect(screen.queryByText('해제 취소하기')).toBeNull()
  })

  it('[해제 취소하기]: fn_cancel_dissolution 호출 하나(해제 행 id) -> 토스트 "해제를 취소했어요" -> 다시 읽어 연결 화면으로. 직접 쓰기 0', async () => {
    let state: ReturnType<typeof settingsDb>
    state = settingsDb({
      couples: [DISSOLVING],
      dissolutions: [DISSOLUTION_BY_ME],
      rpc: (fn) => {
        if (fn === 'fn_cancel_dissolution') {
          state.tables.couples[0].status = 'active'
          state.tables.couple_dissolutions[0].cancelled_at = '2025-10-21T12:00:00+09:00'
        }
        return { data: null, error: null }
      },
    })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    fireEvent.click(screen.getByText('해제 취소하기'))
    await settle()
    expect(state.rpcCalls).toEqual([{ fn: 'fn_cancel_dissolution', args: { p_dissolution_id: 'd1' } }])
    expect(useToastStore.getState().toast?.message).toBe('해제를 취소했어요')
    expect(state.writes).toEqual([])
    expect(screen.queryByTestId('grace-card')).toBeNull()
    expect(byId('couple-status').textContent).toBe('서영과 연결됨')
    expectNoExecutionFunctions(state)
  })

  it('취소 실패(유예 끝남 22023): 서버 오류 문구가 보이고 토스트는 없다', async () => {
    settingsDb({
      couples: [DISSOLVING],
      dissolutions: [DISSOLUTION_BY_ME],
      rpc: () => ({ data: null, error: { code: '22023', message: 'x' } }),
    })
    render(<CoupleScreen nav={makeFakeNav()} />)
    await settle()
    fireEvent.click(screen.getByText('해제 취소하기'))
    await settle()
    expect(byId('couple-error').textContent).toBe('유예 기간이 끝나 취소할 수 없어요.')
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('발행물 PDF 줄은 매거진 탭으로 간다', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_ME] })
    const nav = makeFakeNav()
    render(<CoupleScreen nav={nav} />)
    await settle()
    click('grace-pdf-row')
    expect(nav.replace).toHaveBeenCalledWith('magazine')
  })
})

// ───────────────────────────── H14 문구 입력 · H16 ─────────────────────────────

describe('H14 연결 해제 요청(문구 입력)', () => {
  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    await loadStores()
    const nav = makeFakeNav()
    render(<UnlinkScreen nav={nav} />)
    await settle()
    return { db, nav }
  }

  it('안내 + 발행물 PDF 저장 안내 + 문구 입력이 한 화면이고, 상대의 기록이 남는다는 문장에 상대 이름이 들어간다', async () => {
    await open()
    expect(screen.getByText(/해제되면 내가 남긴 사진·글·대화가 지워져요/)).toBeTruthy()
    expect(screen.getByText(/서영의 기록은 서영에게 남아요/)).toBeTruthy()
    expect(byId('unlink-pdf-row').textContent).toContain('발행된 호 PDF로 받아두기')
    expect(screen.getByText('확인을 위해 ‘해제합니다’를 입력해 주세요')).toBeTruthy()
  })

  it('문구가 틀리면 진행할 수 없고, 탈퇴 확인어("탈퇴합니다")로도 켜지지 않는다. 정확히 "해제합니다"일 때만 켜진다', async () => {
    const { db } = await open()
    const submit = byId('unlink-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    type('unlink-phrase-input', '해제합니')
    expect(submit.disabled).toBe(true)
    type('unlink-phrase-input', '탈퇴합니다')
    expect(submit.disabled).toBe(true)
    type('unlink-phrase-input', '연결 해제합니다')
    expect(submit.disabled).toBe(true)
    type('unlink-phrase-input', '해제합니다')
    expect(submit.disabled).toBe(false)
    type('unlink-phrase-input', '  해제합니다  ')
    expect(submit.disabled).toBe(false)
    expect(db.rpcCalls).toEqual([])
  })

  it('[해제 요청하기]: fn_request_dissolution 호출 하나뿐 - couples · couple_dissolutions 직접 쓰기 0, 끝나면 앞 화면', async () => {
    const { db, nav } = await open({ rpc: () => ({ data: 'd9', error: null }) })
    type('unlink-phrase-input', '해제합니다')
    click('unlink-submit')
    await settle()
    expect(db.rpcCalls).toEqual([{ fn: 'fn_request_dissolution', args: undefined }])
    expect(db.writes).toEqual([])
    expect(nav.back).toHaveBeenCalledTimes(1)
    expectNoExecutionFunctions(db)
  })

  it('이미 진행 중(23505): 서버 오류 문구가 보이고 화면에 남는다', async () => {
    const { nav } = await open({ rpc: () => ({ data: null, error: { code: '23505', message: 'x' } }) })
    type('unlink-phrase-input', '해제합니다')
    click('unlink-submit')
    await settle()
    expect(byId('unlink-error').textContent).toBe('이미 해제를 요청한 상태예요.')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('발행물 PDF 줄은 매거진 탭으로 간다', async () => {
    const { nav } = await open()
    click('unlink-pdf-row')
    expect(nav.replace).toHaveBeenCalledWith('magazine')
  })

  it('미연결이면 해제할 것이 없다 - I01 안내 카드', async () => {
    await open({ couples: [] })
    expect(byId('couple-needed')).toBeTruthy()
    expect(screen.queryByTestId('unlink-submit')).toBeNull()
  })

  it('연결 확인 중에는 뼈대(안내 카드가 번쩍이지 않는다)', async () => {
    settingsDb()
    render(<UnlinkScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('settings-skeleton')).not.toBeNull()
    expect(screen.queryByTestId('couple-needed')).toBeNull()
  })
})

describe('H16 회원 탈퇴 요청(문구 입력)', () => {
  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    await loadStores()
    const nav = makeFakeNav()
    render(<WithdrawScreen nav={nav} />)
    await settle()
    return { db, nav }
  }

  it('7일 뒤 지워지는 것 + (커플이면) 남는 것 + "연결도 함께 해제돼요" + PDF 저장 안내', async () => {
    await open()
    const text = document.body.textContent ?? ''
    expect(text).toContain('7일 뒤 지워지는 것')
    expect(text).toContain('내가 올린 사진·글, 내가 보낸 대화')
    expect(text).toContain('남는 것')
    expect(text).toContain('서영이 올린 기록')
    expect(text).toContain('발행된 잡지 — 두 사람 모두 떠나면 지워져요')
    expect(byId('withdraw-couple-note').textContent).toBe('연결도 함께 해제돼요')
    expect(byId('withdraw-pdf-row').textContent).toContain('발행된 호 PDF로 받아두기')
  })

  it('미연결이면 "남는 것" · "연결도 함께 해제돼요"를 그리지 않는다(사실이 아니다)', async () => {
    await open({ couples: [] })
    expect(document.body.textContent).not.toContain('남는 것')
    expect(screen.queryByTestId('withdraw-couple-note')).toBeNull()
  })

  it('확인어는 "탈퇴합니다" - 해제 확인어로는 켜지지 않는다(서로 달라야 한다)', async () => {
    await open()
    const submit = byId('withdraw-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    type('withdraw-phrase-input', '해제합니다')
    expect(submit.disabled).toBe(true)
    type('withdraw-phrase-input', '탈퇴합니다')
    expect(submit.disabled).toBe(false)
  })

  it('[탈퇴 요청하기]: fn_request_withdrawal 호출 하나 -> 로그아웃(세션 지움) -> 첫 화면. 직접 쓰기 0', async () => {
    const { db, nav } = await open({ rpc: () => ({ data: '2025-10-28T00:00:00+09:00', error: null }) })
    type('withdraw-phrase-input', '탈퇴합니다')
    click('withdraw-submit')
    await settle()
    expect(db.rpcCalls).toEqual([{ fn: 'fn_request_withdrawal', args: undefined }])
    expect(db.writes).toEqual([])
    expect(db.signOutCalls.length).toBeGreaterThanOrEqual(1)
    expect(nav.reset).toHaveBeenCalledWith('intro')
    expectNoExecutionFunctions(db)
  })

  it('요청이 실패하면 로그아웃하지 않고 화면에 남는다', async () => {
    const { db, nav } = await open({ rpc: () => ({ data: null, error: { code: 'XX000', message: 'x' } }) })
    type('withdraw-phrase-input', '탈퇴합니다')
    click('withdraw-submit')
    await settle()
    expect(byId('withdraw-error').textContent).toBe('처리하지 못했어요. 다시 시도해주세요.')
    expect(db.signOutCalls).toEqual([])
    expect(nav.reset).not.toHaveBeenCalled()
  })
})

// ───────────────────────────── 탈퇴 유예 화면 ─────────────────────────────

describe('탈퇴 유예 화면(withdraw-cancel)', () => {
  const PENDING: FakeRow = { ...ME, deleted_at: '2025-10-19T00:00:00+09:00', purge_scheduled_at: '2025-10-26T00:00:00+09:00' }

  it('남은 날짜는 서버 purge_scheduled_at 기준이고 [탈퇴 취소하기] · [로그아웃]이 있다', async () => {
    settingsDb({ profiles: [PENDING] })
    render(<WithdrawCancelScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('settings-skeleton')).not.toBeNull()
    await settle()
    expect(byId('withdraw-days').textContent).toBe('5일')
    expect(byId('withdraw-date').textContent).toBe('10월 26일에 계정이 삭제돼요')
    expect(screen.getByText('탈퇴 취소하기')).toBeTruthy()
    expect(screen.getByText('로그아웃')).toBeTruthy()
    expect(byId('withdraw-bullets').textContent).toContain('탈퇴를 요청한 상태예요')
  })

  it('[탈퇴 취소하기]: fn_cancel_withdrawal 호출 하나 -> 토스트 "탈퇴를 취소했어요"(B15) -> 원래 진행 단계(완료 = 메인)로', async () => {
    const db = settingsDb({
      profiles: [PENDING],
      rpc: () => {
        db.tables.profiles[0].deleted_at = null
        db.tables.profiles[0].purge_scheduled_at = null
        return { data: null, error: null }
      },
    })
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await settle()
    click('withdraw-cancel-button')
    await settle()
    expect(db.rpcCalls).toEqual([{ fn: 'fn_cancel_withdrawal', args: undefined }])
    expect(db.writes).toEqual([])
    expect(useToastStore.getState().toast?.message).toBe('탈퇴를 취소했어요')
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
    expectNoExecutionFunctions(db)
  })

  it('원래 진행 단계로 돌아간다 - 단계 1이면 초대 화면', async () => {
    const db = settingsDb({
      profiles: [{ ...PENDING, onboarding_step: 1 }],
      rpc: () => {
        db.tables.profiles[0].deleted_at = null
        return { data: null, error: null }
      },
    })
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await settle()
    click('withdraw-cancel-button')
    await settle()
    expect(nav.enterAccount).toHaveBeenCalledWith('invite')
  })

  it('취소 실패(유예 끝남): 안내만 보이고 토스트 · 이동 없음', async () => {
    settingsDb({ profiles: [PENDING], rpc: () => ({ data: null, error: { code: '22023', message: 'x' } }) })
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await settle()
    click('withdraw-cancel-button')
    await settle()
    expect(byId('withdraw-cancel-error').textContent).toBe('유예 기간이 끝나 취소할 수 없어요.')
    expect(useToastStore.getState().toast).toBeNull()
    expect(nav.enterAccount).not.toHaveBeenCalled()
  })

  it('탈퇴 유예가 아닌 사람이 직접 열면 바로 진행 단계로 보낸다', async () => {
    settingsDb({ profiles: [ME] })
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await settle()
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
  })

  it('[로그아웃]과 화면의 ← 는 둘 다 로그아웃이다(RN onBack = logout) - 세션을 지우고 첫 화면', async () => {
    const db = settingsDb({ profiles: [PENDING] })
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await settle()
    fireEvent.click(screen.getByLabelText('뒤로'))
    await settle()
    expect(db.signOutCalls.length).toBe(1)
    expect(nav.reset).toHaveBeenCalledWith('intro')
    expect(nav.back).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('로그아웃'))
    await settle()
    expect(db.signOutCalls.length).toBe(2)
  })
})

// ───────────────────────────── H05 · H06 성격 프로필 · 재검사 ─────────────────────────────

describe('H05 성격 프로필', () => {
  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    const nav = makeFakeNav()
    render(<PersonalityScreen nav={nav} />)
    await settle()
    return { db, nav }
  }

  it('결과 카드(영문 · 한글 라벨 · MBTI · 코어 · 애착)와 세 줄', async () => {
    await open()
    expect(byId('personality-label-en').textContent).toMatch(/^[A-Z]+$/)
    expect(byId('personality-label-ko').textContent?.length).toBeGreaterThan(0)
    expect(byId('personality-meta').textContent).toBe('INFJ · 애니어그램 4 · 안정형')
    expect(byId('personality-row-view').textContent).toContain('결과 다시 보기')
    expect(byId('personality-row-override').textContent).toContain('몇 번이든 바꿀 수 있어요')
    expect(byId('personality-row-retest').textContent).toContain('계정당 한 번 · 아직 쓰지 않았어요')
  })

  it('카드는 오버라이드가 있으면 실효 코어 기준이다(R40-4)', async () => {
    await open({ personality: { ...PERSONALITY, enneagram_override: 7, enneagram_effective: 7 } })
    expect(byId('personality-meta').textContent).toContain('애니어그램 7')
  })

  it('결과가 없으면 안내문, 읽기에 실패하면 오류 문장(빈 화면 아님)', async () => {
    const a = await open({ personality: null })
    expect(byId('personality-missing').textContent).toBe('아직 결과가 없어요.')
    expect(screen.queryByTestId('personality-row-retest')).toBeNull()
    expect(a.nav.push).not.toHaveBeenCalled()
  })

  it('줄 이동: 결과 다시 보기 / 코어 고치기(?view=override)', async () => {
    const { nav } = await open()
    click('personality-row-view')
    click('personality-row-override')
    expect((nav.push as ReturnType<typeof vi.fn>).mock.calls).toEqual([['settings-result'], ['settings-result', { params: { view: 'override' } }]])
  })

  it('H06: [5문항 다시 하기] -> 확인 시트(문장 그대로) -> [다시 하기]가 메모리 답을 비우고 재검사로 간다', async () => {
    const { nav } = await open()
    useSessionStore.getState().setName('이전 답')
    click('personality-row-retest')
    const sheet = byId('retest-confirm')
    expect(sheet.textContent).toContain('다시 하기는 한 번뿐이에요')
    expect(sheet.textContent).toContain('5문항을 다시 풀면 연애 유형이 바뀔 수 있어요. 이미 발행된 호는 그대로 남아요. 한 번 쓰면 이 버튼은 다시 열리지 않아요.')
    click('retest-confirm-yes')
    expect(nav.push).toHaveBeenCalledWith('retest')
    expect(useSessionStore.getState().name).toBe('')
    expect(screen.queryByTestId('retest-confirm')).toBeNull()
  })

  it('확인 시트의 [취소]는 아무것도 하지 않고 닫는다', async () => {
    const { nav } = await open()
    click('personality-row-retest')
    fireEvent.click(within(byId('retest-confirm')).getByText('취소'))
    await settle(400)
    expect(screen.queryByTestId('retest-confirm')).toBeNull()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('재검사는 계정당 1회 - 이미 썼으면 줄이 비활성이고 눌러도 시트가 열리지 않는다', async () => {
    await open({ personality: { ...PERSONALITY, retest_used: true } })
    const row = byId('personality-row-retest') as HTMLButtonElement
    expect(row.disabled).toBe(true)
    expect(row.textContent).toContain('계정당 한 번 · 이미 썼어요')
    fireEvent.click(row)
    expect(screen.queryByTestId('retest-confirm')).toBeNull()
  })
})

describe('A14 · A15 · A16 설정 모드(결과 다시 보기 · 코어 고치기)', () => {
  beforeEach(() => {
    class FakeObserver { observe() {} unobserve() {} disconnect() {} }
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver
  })

  async function open(url: string, opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    const nav = makeFakeNav()
    render(<MemoryRouter initialEntries={[url]}><SettingsResultScreen nav={nav} /></MemoryRouter>)
    await settle()
    return { db, nav }
  }

  it('A14: 서버에 저장된 결과를 그대로 보인다 - [다음]이 없고 ← 가 있다. 읽기만 한다(쓰기 0)', async () => {
    const { db, nav } = await open('/settings-result')
    expect(screen.getByText('BIG FIVE')).toBeTruthy()
    expect(screen.getByText('INFJ · 애니어그램 4 · 안정형')).toBeTruthy()
    expect(screen.queryByText('다음')).toBeNull()
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(nav.back).toHaveBeenCalledTimes(1)
    expect(db.writes).toEqual([])
  })

  it('저장된 결과가 없으면 안내(빈 화면 아님)', async () => {
    await open('/settings-result', { assessment: null })
    expect(byId('result-missing').textContent).toBe('아직 저장된 결과가 없어요.')
  })

  it('A16(?view=override): 코어를 고르면 override · count · updated_at · love_type_code만 쓰고(추론값 · 빅5 · 애착 그대로) H05로 돌아간다', async () => {
    const { db, nav } = await open('/settings-result?view=override')
    expect(screen.getByText('지금 결과')).toBeTruthy()
    click('core-9')
    fireEvent.click(screen.getByText('이 코어로 할게요'))
    await settle()
    const updates = writesTo(db, 'personality_profiles')
    expect(updates).toHaveLength(1)
    expect(Object.keys(updates[0].payload).sort()).toEqual(['enneagram_override', 'love_type_code', 'override_count', 'override_updated_at'])
    expect(updates[0].payload.enneagram_override).toBe(9)
    expect(updates[0].payload.override_count).toBe(1)
    expect(writesTo(db, 'personality_assessments')).toEqual([])
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('지금 결과와 같은 코어를 고르면 저장하지 않고 돌아간다', async () => {
    const { db, nav } = await open('/settings-result?view=override')
    fireEvent.click(screen.getByText('이 코어로 할게요'))
    await settle()
    expect(db.writes).toEqual([])
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('저장 실패: 화면에 남고 안내가 보인다', async () => {
    const { nav } = await open('/settings-result?view=override', { failUpdates: ['personality_profiles'] })
    click('core-2')
    fireEvent.click(screen.getByText('이 코어로 할게요'))
    await settle()
    expect(byId('override-error').textContent).toBe('저장하지 못했어요. 다시 시도해주세요.')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('B17: 코어 목록 아래 여백이 있다(마지막 줄이 버튼 뒤로 가지 않는다)', async () => {
    await open('/settings-result?view=override')
    const list = byId('core-9').parentElement as HTMLElement
    expect(parseInt(list.style.marginBottom, 10)).toBeGreaterThanOrEqual(54)
  })
})

describe('H06 재검사 흐름(A04~A07 -> 저장)', () => {
  const OK = { data: [{ out_assessment_id: 'a2', out_recovered: false }], error: null }

  /** MBTI를 직접 고르고(ESFJ) 5문항에 첫 선택지로 답한다. */
  async function answerAll() {
    fireEvent.click(screen.getByText('알아요'))
    fireEvent.click(screen.getByText('다음'))
    for (const l of ['E 외향', 'S 감각', 'F 감정', 'J 판단']) fireEvent.click(screen.getByText(l))
    fireEvent.click(screen.getByText('다음'))
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getAllByRole('radio')[0])
      act(() => { vi.advanceTimersByTime(200) })
    }
    await settle()
  }

  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    const nav = makeFakeNav()
    render(<RetestScreen nav={nav} />)
    await settle()
    return { db, nav }
  }

  it('마지막 문항 뒤 A08 대신 바로 저장한다: fn_complete_retest 호출 하나, 두 번 쓰기(INSERT + UPDATE) 0, 끝나면 H05로(back)', async () => {
    const { db, nav } = await open({ rpc: () => OK })
    await answerAll()
    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0].fn).toBe('fn_complete_retest')
    expect(db.rpcCalls[0].args.p_mbti).toBe('ESFJ')
    expect(db.rpcCalls[0].args.p_engine_version).toBeTruthy()
    expect(typeof db.rpcCalls[0].args.p_love_type_code).toBe('string')
    // 직접 쓰기 0 - 새 assessment INSERT도 프로필 UPDATE도 앱이 하지 않는다(함수 안에서 한 트랜잭션).
    expect(writesTo(db, 'personality_assessments')).toEqual([])
    expect(writesTo(db, 'personality_profiles')).toEqual([])
    expect(nav.back).toHaveBeenCalledTimes(1)
    expect(useSessionStore.getState().q1).toBeNull() // 성공하면 메모리 답을 비운다
  })

  it('A07 첫 문항에서 ← 는 MBTI 단계로, MBTI 단계에서 ← 는 앞 화면(H05)으로', async () => {
    const { nav } = await open({ rpc: () => OK })
    fireEvent.click(screen.getByText('알아요'))
    fireEvent.click(screen.getByText('다음'))
    for (const l of ['E 외향', 'S 감각', 'F 감정', 'J 판단']) fireEvent.click(screen.getByText(l))
    fireEvent.click(screen.getByText('다음'))
    expect(screen.getByText('정답은 없어요. 가장 가까운 쪽을 골라주세요')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(screen.getByRole('heading').textContent).toContain('알고 있나요?')
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('이미 쓴 재검사: 서버로 아무것도 보내지 않고 "계정당 한 번" 안내 + [돌아가기](다시 시도 없음)', async () => {
    const { db, nav } = await open({ personality: { ...PERSONALITY, retest_used: true }, rpc: () => OK })
    await answerAll()
    expect(db.rpcCalls).toEqual([])
    expect(screen.getByText('재검사는 계정당 한 번이에요.')).toBeTruthy()
    expect(screen.queryByText('다시 시도')).toBeNull()
    fireEvent.click(screen.getByText('돌아가기'))
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('서버가 23505(이미 사용)를 돌려주면 실패로 본다 - 성공으로 삼키지 않는다', async () => {
    const { db, nav } = await open({ rpc: () => ({ data: null, error: { code: '23505', message: 'x' } }) })
    await answerAll()
    expect(db.rpcCalls).toHaveLength(1)
    expect(screen.getByText('재검사는 계정당 한 번이에요.')).toBeTruthy()
    expect(screen.queryByText('다시 시도')).toBeNull()
    expect(nav.back).not.toHaveBeenCalled()
  })

  it('네트워크 · 서버 실패: 글로 알리고 [다시 시도]가 같은 답으로 다시 보낸다', async () => {
    const results = [{ data: null, error: { code: 'XX000', message: 'x' } }, OK]
    const { db, nav } = await open({ rpc: () => results.shift() ?? OK })
    await answerAll()
    expect(screen.getByText('저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy()
    expect(nav.back).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('다시 시도'))
    await settle()
    expect(db.rpcCalls).toHaveLength(2)
    expect(db.rpcCalls[1].args).toEqual(db.rpcCalls[0].args)
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('끊겼던 재검사를 서버가 기존 행으로 마저 끝낸 경우: 알림을 먼저 보이고 [확인] 뒤에 돌아간다', async () => {
    const { nav } = await open({ rpc: () => ({ data: [{ out_assessment_id: 'a9', out_recovered: true }], error: null }) })
    await answerAll()
    expect(screen.getByText('이전에 하던 재검사를 마저 저장했어요')).toBeTruthy()
    expect(byId('retest-recovered-note').textContent).toBe('방금 답한 내용과 저장된 결과가 다를 수 있어요. 성격 프로필에서 확인해주세요.')
    expect(nav.back).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('확인'))
    expect(nav.back).toHaveBeenCalledTimes(1)
  })
})

// ───────────────────────────── H11 개인정보 & 약관 ─────────────────────────────

describe('H11 개인정보 & 약관', () => {
  async function open(opts: SettingsDbOptions = {}) {
    const db = settingsDb(opts)
    render(<PrivacyScreen nav={makeFakeNav()} />)
    await settle()
    return db
  }

  it('처리방침 · 이용약관 · AI 활용 안내 줄과 마케팅 토글만 있다 - 생체정보 · 데이터 내려받기 줄은 없다', async () => {
    await open()
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy()
    expect(screen.getByText('이용약관')).toBeTruthy()
    expect(screen.getByText('AI 활용 안내')).toBeTruthy()
    expect(screen.getByText('마케팅 정보 수신')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/생체정보|얼굴|내려받기/)
  })

  it('문서 줄은 A12 약관 전문 시트로 열고, 문장은 저장소 그대로다(자리표시자 포함) - [확인]으로 닫힌다', async () => {
    await open()
    click('privacy-row-privacy')
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(LEGAL_DOCUMENTS.privacy.title)).toBeTruthy()
    expect(dialog.getAllByText(LEGAL_DOCUMENTS.privacy.body[0]).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('확인'))
    await settle(400)
    expect(screen.queryByTestId('sheet')).toBeNull()
  })

  it('마케팅 수신은 기본 꺼짐이다(B18) - 서버 값(null)이 꺼짐', async () => {
    await open()
    expect(byId('privacy-marketing-toggle').getAttribute('aria-checked')).toBe('false')
  })

  it('켜기 = marketing_agreed_at에 지금 시각, 끄기 = null - 이 칸 하나만 쓴다', async () => {
    const db = await open()
    click('privacy-marketing-toggle')
    await settle()
    expect(byId('privacy-marketing-toggle').getAttribute('aria-checked')).toBe('true')
    click('privacy-marketing-toggle')
    await settle()
    expect(byId('privacy-marketing-toggle').getAttribute('aria-checked')).toBe('false')
    const payloads = writesTo(db, 'profiles').map((w) => w.payload)
    expect(payloads).toEqual([{ marketing_agreed_at: NOW.toISOString() }, { marketing_agreed_at: null }])
  })

  it('이미 켜져 있던 값을 읽어 켜진 채로 보인다', async () => {
    await open({ profiles: [{ ...ME, marketing_agreed_at: '2025-01-01T00:00:00Z' }] })
    expect(byId('privacy-marketing-toggle').getAttribute('aria-checked')).toBe('true')
  })

  it('저장이 실패하면 토글을 원래 값으로 되돌리고 안내한다', async () => {
    await open({ failUpdates: ['profiles'] })
    click('privacy-marketing-toggle')
    await settle()
    expect(byId('privacy-marketing-toggle').getAttribute('aria-checked')).toBe('false')
    expect(byId('privacy-error').textContent).toBe('저장하지 못했어요. 다시 시도해주세요.')
  })

  it('읽는 동안은 토글이 눌리지 않는다', async () => {
    settingsDb()
    render(<PrivacyScreen nav={makeFakeNav()} />)
    expect((byId('privacy-marketing-toggle') as HTMLButtonElement).disabled).toBe(true)
    await settle()
    expect((byId('privacy-marketing-toggle') as HTMLButtonElement).disabled).toBe(false)
  })
})

// ───────────────────────────── H19 앱 정보 · 문의 ─────────────────────────────

describe('H19 앱 정보 · 문의', () => {
  function open(bridge = makeFakeBridge()) {
    // 계정 값이 화면 어딘가에 있는 상황(문의 메일에 새어 나가지 않아야 한다).
    settingsDb()
    useAuthStore.getState().setUserId('account-id-123')
    useCoupleStore.setState({ status: 'connected', coupleId: 'couple-id-456' })
    render(<AboutScreen nav={makeFakeNav()} bridge={bridge} />)
    return bridge
  }

  it('버전은 웹 앱 버전 그대로이고 "최신" 표시 · 오픈소스 라이선스 줄이 없다', () => {
    open()
    expect(byId('about-version').textContent).toBe(`버전 ${pkg.version}`)
    expect(document.body.textContent).not.toMatch(/최신|오픈소스/)
    expect(screen.getByText('문의하기')).toBeTruthy()
    expect(screen.getByText('이용약관')).toBeTruthy()
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy()
  })

  it('문의하기: mailto 주소 = SUPPORT_EMAIL 상수, 제목 [온도록 문의], 본문 머리 세 줄(버전 · OS · 정정 요청 안내)', async () => {
    const bridge = open()
    click('about-inquiry')
    await settle()
    const [url] = (bridge.openMail as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('subject')).toBe('[온도록 문의]')
    const lines = (params.get('body') ?? '').split('\n').filter(Boolean)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(`앱 버전: ${pkg.version}`)
    expect(lines[1]).toMatch(/^OS: /)
    expect(lines[2]).toBe('발행물 정정 요청이면 몇 월호 몇 쪽인지 적어 주세요.')
  })

  it('문의 메일에 계정 id · 커플 id · 이메일 · 이름이 자동으로 들어가지 않는다(모의 값을 넣고 확인)', async () => {
    const bridge = open()
    click('about-inquiry')
    await settle()
    const [url] = (bridge.openMail as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const all = decodeURIComponent(url)
    expect(all).not.toContain('account-id-123')
    expect(all).not.toContain('couple-id-456')
    expect(all).not.toContain('세준')
    // 받는 주소 자리표시자 외에 이메일 모양이 없다.
    expect(all.replace(SUPPORT_EMAIL, '')).not.toMatch(/@/)
  })

  it('메일 앱을 열 수 없으면 토스트로 주소를 안내한다', async () => {
    open(makeFakeBridge({ openMail: vi.fn(async () => 'failed' as const) }))
    click('about-inquiry')
    await settle()
    expect(useToastStore.getState().toast?.message).toBe(`메일 앱을 열 수 없어요. ${SUPPORT_EMAIL}로 보내 주세요`)
  })

  it('이용약관 · 개인정보 처리방침은 온보딩과 같은 약관 전문 시트다', async () => {
    open()
    click('about-terms')
    expect(within(screen.getByRole('dialog')).getByText(LEGAL_DOCUMENTS.terms.title)).toBeTruthy()
  })
})
