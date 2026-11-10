/**
 * 온보딩 2부 화면 시험 - A17 · A18 · A19 · A20 · 재표시 · 앱 시작 때 단계 재개 · I01 -> 초대.
 * 원본: `__tests__/components/u6Onboarding2.test.tsx`(A17~A20 · 재개) · `u7Settings.test.tsx`(A20 재표시) · `u6ExistingAccount.test.tsx`(단계별 재개).
 * 가짜 클라이언트(`testSupportCouple.ts`) + 가짜 다리 - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../../App'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useSessionStore } from '@/store/sessionStore'
import { openInvite } from '../../app/inviteEntry'
import { useStartDateRecheck } from '../../couple/useStartDateRecheck'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeBridge, makeFakeNav } from '../../testSupport'
import { makeCoupleDb, stepWrites, type CoupleDbOptions } from '../../testSupportCouple'
import { InviteScreen, INVITE_POLL_MS, inviteShareMessage } from './InviteScreen'
import { StartDateScreen } from './StartDateScreen'

beforeEach(() => {
  vi.useFakeTimers()
  useAuthStore.getState().setUserId('me')
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
  useCoupleStore.getState().reset()
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

const ME_PROFILE = { id: 'me', display_name: '나', onboarding_step: 1 }
const PARTNER = { id: 'p1', display_name: '서영', onboarding_step: 1 }
const ACTIVE = { id: 'c1', user_a_id: 'p1', user_b_id: 'me', status: 'active', invite_code: 'AB23CD' }

function setup(opts: CoupleDbOptions = {}) {
  const db = makeCoupleDb({ profiles: [ME_PROFILE, PARTNER], ...opts })
  setSupabaseForTest(db.client)
  return db
}

const stepRows = (writes: ReturnType<typeof makeCoupleDb>['writes']) => stepWrites(writes).map((w) => w.payload.onboarding_step)

describe('A17 연인 초대', () => {
  async function open(opts: CoupleDbOptions = {}, mode: 'onboarding' | 'gate' = 'onboarding') {
    const db = setup(opts)
    const nav = makeFakeNav()
    const bridge = makeFakeBridge()
    render(<InviteScreen nav={nav} bridge={bridge} mode={mode} />)
    await settle()
    return { ...db, nav, bridge }
  }

  it('열기만 해서는 커플 행을 만들지 않는다 - 읽기만 하고, [초대 코드 만들기]를 눌러야 발급한다', async () => {
    const { writes, tables } = await open()
    expect(writes).toEqual([])
    expect(screen.queryByTestId('invite-code')).toBeNull()
    fireEvent.click(screen.getByText('초대 코드 만들기'))
    await settle()
    expect(writes.filter((w) => w.table === 'couples' && w.op === 'insert')).toHaveLength(1)
    const code = tables.couples[0].invite_code as string
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    // 화면에 보이는 것은 서버에 저장된 그 코드다(화면에서 만든 무작위 값이 아니다).
    expect(screen.getByTestId('invite-code').textContent).toBe(`${code.slice(0, 3)} ${code.slice(3)}`)
    expect(screen.getByText('복사하기')).toBeTruthy()
    expect(screen.getByText('공유하기')).toBeTruthy()
  })

  it('이미 발급한 코드가 있으면 그대로 보인다(만들지 않는다)', async () => {
    const { writes } = await open({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    expect(screen.getByTestId('invite-code').textContent).toBe('AB2 3CD')
    expect(writes).toEqual([])
  })

  it('공유: OS 공유 시트로 글을 보내고 문구는 브랜드 "온도록"이다(B6) - 옛 이름 0', async () => {
    const { bridge } = await open({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    fireEvent.click(screen.getByText('공유하기'))
    await settle()
    const [text] = (bridge.shareText as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(text).toBe('온도록에서 연결해요! 초대 코드: AB23CD')
    expect(text).toBe(inviteShareMessage('AB23CD'))
    expect(text).not.toMatch(/온돌로그|온도로그|ONDOLOG/i)
  })

  it('공유 시트를 못 열면 코드를 토스트로 보여 준다(빈 버튼 0)', async () => {
    const db = setup({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    const bridge = makeFakeBridge({ shareText: vi.fn(async () => 'failed' as const) })
    render(<InviteScreen nav={makeFakeNav()} bridge={bridge} />)
    await settle()
    fireEvent.click(screen.getByText('공유하기'))
    await settle()
    expect(useToastStore.getState().toast?.message).toBe('내 코드: AB23CD')
    expect(db.writes).toEqual([])
  })

  it('복사하기: 클립보드에 코드만 쓰고 토스트를 보인다', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await open({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    fireEvent.click(screen.getByText('복사하기'))
    await settle()
    expect(writeText).toHaveBeenCalledWith('AB23CD')
    expect(useToastStore.getState().toast?.message).toBe('코드를 복사했어요')
  })

  it('이미 연결돼 있으면 진행 단계를 올리고 사귄 날짜(A19)로 간다', async () => {
    const { nav, writes } = await open({ couples: [ACTIVE] })
    expect(stepRows(writes)).toEqual([2])
    expect(nav.enterAccount).toHaveBeenCalledWith('start-date')
  })

  it('코드를 보여 둔 채 기다리면 상대가 입력해 연결됐을 때 A19로 간다 - 두 번 가지 않는다', async () => {
    const { nav, tables, writes } = await open({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    expect(nav.enterAccount).not.toHaveBeenCalled()
    tables.couples[0].status = 'active'
    tables.couples[0].user_b_id = 'p1'
    await settle(INVITE_POLL_MS + 100)
    await settle(INVITE_POLL_MS + 100)
    expect(stepRows(writes)).toEqual([2])
    expect(nav.enterAccount).toHaveBeenCalledTimes(1)
    expect(nav.enterAccount).toHaveBeenCalledWith('start-date')
  })

  it.each(['나중에 할게요', '솔로예요'])('[%s] 둘 다 같다 - 완료 처리(진행 단계 3) 뒤 바로 메인, 코드를 만들지 않는다', async (label) => {
    const { nav, writes, tables } = await open()
    fireEvent.click(screen.getByText(label))
    await settle()
    expect(stepRows(writes)).toEqual([3])
    expect(tables.profiles[0].onboarding_step).toBe(3)
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
    expect(writes.filter((w) => w.table === 'couples')).toEqual([]) // 혼자 기록용 커플 행은 만들지 않는다(RN 그대로)
  })

  it('"나중에" 뒤 앱을 다시 켜면 초대 화면으로 돌아오지 않는다(서버 단계 3 -> 메인)', async () => {
    const db = setup()
    render(<App bridge={makeFakeBridge()} initialPath="/invite" />)
    await settle()
    fireEvent.click(screen.getByText('나중에 할게요'))
    await settle()
    expect(document.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('main')
    cleanup()
    // 앱 재시작: 저장된 로그인 + 서버 진행 단계(위에서 3으로 올라감)
    const restarted = makeCoupleDb({ profiles: [{ ...ME_PROFILE, onboarding_step: db.tables.profiles[0].onboarding_step }], session: { user: { id: 'me' } } })
    setSupabaseForTest(restarted.client)
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    expect(document.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('main')
  })

  it('저장이 실패하면 넘어가지 않고 안내가 나온다', async () => {
    const { nav, client } = await open()
    ;(client as unknown as { from: () => never }).from = () => { throw new Error('x') }
    fireEvent.click(screen.getByText('솔로예요'))
    await settle()
    expect(nav.enterAccount).not.toHaveBeenCalled()
    expect(screen.getByTestId('invite-error').textContent).toBe('처리하지 못했어요. 다시 시도해주세요.')
  })
})

describe('A18 초대 코드 입력', () => {
  async function openEnter(opts: CoupleDbOptions = {}) {
    const db = setup(opts)
    const nav = makeFakeNav()
    render(<InviteScreen nav={nav} bridge={makeFakeBridge()} />)
    await settle()
    fireEvent.click(screen.getByText('상대에게 코드를 받았어요'))
    await settle()
    return { ...db, nav }
  }
  const input = () => screen.getByLabelText('초대 코드') as HTMLInputElement
  const connect = () => screen.getByText('연결하기').closest('button') as HTMLButtonElement
  const type = (v: string) => fireEvent.change(input(), { target: { value: v } })

  it('입력 칸은 영문 대문자 키보드 + 자동 대문자(B9)이고, 열리면 포커스가 간다', async () => {
    await openEnter()
    expect(input().getAttribute('autocapitalize')).toBe('characters')
    expect(input().getAttribute('autocorrect')).toBe('off')
    expect(document.activeElement).toBe(input())
  })

  it('여섯 글자가 차야 [연결하기]가 켜지고, 소문자는 대문자로 · 글자 아닌 것은 걸러진다', async () => {
    await openEnter()
    expect(connect().disabled).toBe(true)
    type('p4n-8x')
    expect(connect().disabled).toBe(true) // 5글자
    type('p4n8xq')
    expect(input().value).toBe('P4N8XQ')
    expect(connect().disabled).toBe(false)
    expect(Array.from(document.querySelectorAll('.codeBoxCell')).map((e) => e.textContent).join('')).toBe('P4N8XQ')
  })

  it('"이미 다른 사람과 연결된 코드는…" 문장은 처음에는 없다(그 오류일 때만 보인다 - 아래 23505 시험)', async () => {
    await openEnter()
    expect(screen.queryByTestId('invite-enter-hint')).toBeNull()
    expect(screen.queryByTestId('invite-error')).toBeNull()
    expect(document.body.textContent).not.toContain('이미 다른 사람과 연결된')
  })

  it('코드 칸은 영문 키보드로 열린다 - 자동 대문자 · 자동 고침 · 자동 완성 · 맞춤법 검사 끔', async () => {
    await openEnter()
    const el = input()
    expect(el.getAttribute('inputmode')).toBe('text')
    expect(el.getAttribute('autocapitalize')).toBe('characters')
    expect(el.getAttribute('autocorrect')).toBe('off')
    expect(el.getAttribute('autocomplete')).toBe('off')
    expect(el.getAttribute('spellcheck')).toBe('false')
    expect(el.getAttribute('lang')).toBe('en')
    expect(el.getAttribute('type')).toBe('text')
  })

  it.each([
    ['P0002', '쓸 수 없는 코드예요. 상대에게 코드를 다시 받아 주세요.'],
    ['22023', '내가 만든 코드는 쓸 수 없어요. 상대의 코드를 입력해 주세요.'],
    ['23505', '이미 다른 사람과 연결된 코드는 쓸 수 없어요'],
    ['XX000', '연결하지 못했어요. 다시 시도해주세요.'],
  ])('연결 오류 %s는 보드 문구만 보이고 넘어가지 않는다', async (code, message) => {
    const { nav, writes, rpcCalls } = await openEnter({ rpc: () => ({ data: null, error: { code } }) })
    type('P4N8XQ')
    fireEvent.click(connect())
    await settle()
    expect(rpcCalls[0].args).toEqual({ p_invite_code: 'P4N8XQ' })
    expect(screen.getByTestId('invite-error').textContent).toBe(message)
    expect(stepRows(writes)).toEqual([])
    expect(nav.enterAccount).not.toHaveBeenCalled()
  })

  it('받은 코드로 연결: RPC 성공 -> 진행 단계 2 -> A19', async () => {
    const db = setup({ couples: [{ id: 'c1', user_a_id: 'p1', user_b_id: null, status: 'pending', invite_code: 'P4N8XQ' }] })
    // 대기 행은 구성원이 아니면 읽히지 않는다 - 내 쪽 조회는 비어 있다(행은 RPC 성공 뒤 내가 b가 된다).
    const rpc = db.rpc
    rpc.mockImplementation(async (fn, args) => {
      db.rpcCalls.push({ fn, args })
      db.tables.couples[0].user_b_id = 'me'
      db.tables.couples[0].status = 'active'
      return { data: 'c1', error: null }
    })
    const nav = makeFakeNav()
    render(<InviteScreen nav={nav} bridge={makeFakeBridge()} />)
    await settle()
    // 내가 구성원이 아니라 조회에 안 잡힌다 -> 코드 만들기 화면이 보인다.
    fireEvent.click(screen.getByText('상대에게 코드를 받았어요'))
    await settle()
    type('p4n8xq')
    fireEvent.click(connect())
    await settle()
    expect(db.rpcCalls[0]).toEqual({ fn: 'fn_connect_couple', args: { p_invite_code: 'P4N8XQ' } })
    expect(stepRows(db.writes)).toEqual([2])
    expect(db.writes.filter((w) => w.table === 'couples')).toEqual([])
    expect(nav.enterAccount).toHaveBeenCalledWith('start-date')
  })

  it('←로 A17에 돌아간다(오류 문구는 지운다)', async () => {
    await openEnter({ rpc: () => ({ data: null, error: { code: 'P0002' } }) })
    type('P4N8XQ')
    fireEvent.click(connect())
    await settle()
    fireEvent.click(screen.getByLabelText('뒤로'))
    await settle()
    expect(screen.getByText('연인을 초대해요')).toBeTruthy()
    expect(screen.queryByTestId('invite-error')).toBeNull()
  })
})

describe('I01에서 여는 초대(gate)', () => {
  it('건너뛰기 링크가 없고, [초대 코드 보내기]로 들어왔으면 바로 발급한다(B12: 같은 문구를 한 번 더 묻지 않는다)', async () => {
    const db = setup()
    const nav = makeFakeNav()
    render(<InviteScreen nav={nav} bridge={makeFakeBridge()} mode="gate" initialStep="intro" />)
    await settle()
    expect(screen.queryByText('나중에 할게요')).toBeNull()
    expect(screen.queryByText('솔로예요')).toBeNull()
    expect(db.writes.filter((w) => w.table === 'couples' && w.op === 'insert')).toHaveLength(1)
    expect(screen.getByTestId('invite-code')).toBeTruthy()
  })

  it('[받은 코드 입력하기]로 들어왔으면 코드 입력으로 열고 발급하지 않는다. ←는 앞 화면으로', async () => {
    const db = setup()
    const nav = makeFakeNav()
    render(<InviteScreen nav={nav} bridge={makeFakeBridge()} mode="gate" initialStep="enter" />)
    await settle()
    expect(screen.getByLabelText('초대 코드')).toBeTruthy()
    expect(db.writes).toEqual([])
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(nav.back).toHaveBeenCalled()
  })

  it('연결되면 진행 단계는 건드리지 않고 사귄 날짜로 간다', async () => {
    const db = setup({ couples: [ACTIVE] })
    const nav = makeFakeNav()
    render(<InviteScreen nav={nav} bridge={makeFakeBridge()} mode="gate" />)
    await settle()
    expect(stepRows(db.writes)).toEqual([])
    expect(nav.enterAccount).toHaveBeenCalledWith('start-date')
  })

  it('앱 안: 커플 게이트의 버튼이 초대 화면을 연다 - 그 단계로, 뒤로 가기는 앞 탭으로', async () => {
    setup()
    render(<App bridge={makeFakeBridge()} initialPath="/main" />)
    await settle()
    const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
    act(() => openInvite('enter'))
    await settle(400)
    expect(screenName()).toBe('couple-invite')
    expect(screen.getByLabelText('초대 코드')).toBeTruthy()
    // 같은 입구를 또 눌러도 두 번 쌓이지 않는다.
    act(() => openInvite('enter'))
    await settle(400)
    act(() => { fireEvent.click(screen.getByLabelText('뒤로')) })
    await settle(400)
    expect(screenName()).toBe('main')
  })
})

describe('A19 사귄 날짜 + 커플 닉네임', () => {
  const NO_DATE = { ...ACTIVE, relationship_start_date: null, start_date_set_by: null, start_date_confirmed_by: null, nickname: null }
  const date = () => screen.getByTestId('start-date-input') as HTMLInputElement
  const nick = () => screen.getByTestId('start-nickname-input') as HTMLInputElement
  const submit = () => screen.getByText('시작하기').closest('button') as HTMLButtonElement

  async function openA19(extra: CoupleDbOptions = {}) {
    const db = setup({ couples: [NO_DATE], ...extra })
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} />)
    await settle()
    return { ...db, nav }
  }

  it('상대 이름으로 "…과 연결됐어요"가 나온다', async () => {
    await openA19()
    expect(screen.getByTestId('start-headline').textContent).toBe('서영과 연결됐어요')
  })

  it('날짜와 닉네임이 모두 맞아야 [시작하기]가 켜진다 - 닉네임 0자 · 21자 꺼짐, 1자 · 20자 켜짐', async () => {
    await openA19()
    expect(submit().disabled).toBe(true)
    fireEvent.change(date(), { target: { value: '20240101' } })
    expect(date().value).toBe('2024.01.01')
    expect(submit().disabled).toBe(true) // 닉네임 0자
    fireEvent.change(nick(), { target: { value: '늘봄' } })
    expect(submit().disabled).toBe(false)
    fireEvent.change(nick(), { target: { value: '가'.repeat(21) } })
    expect(submit().disabled).toBe(true)
    expect(screen.getByTestId('start-nickname-hint').textContent).toBe('20자까지 쓸 수 있어요')
    fireEvent.change(nick(), { target: { value: '가'.repeat(20) } })
    expect(submit().disabled).toBe(false)
    fireEvent.change(nick(), { target: { value: '가' } })
    expect(submit().disabled).toBe(false)
  })

  it('미래 날짜는 고를 수 없다', async () => {
    await openA19()
    fireEvent.change(nick(), { target: { value: '늘봄' } })
    fireEvent.change(date(), { target: { value: '20990101' } })
    expect(submit().disabled).toBe(true)
    expect(screen.getByTestId('start-date-hint').textContent).toBe('오늘까지의 날짜를 입력해주세요')
  })

  it('고른 날짜에는 "오늘 D+N"이 보인다', async () => {
    await openA19()
    fireEvent.change(date(), { target: { value: '20240101' } })
    expect(screen.getByTestId('start-date-hint').textContent).toMatch(/오늘 D\+\d+/)
  })

  it('[시작하기]는 날짜 + 닉네임을 저장하고, 진행 단계 3을 올린 뒤 메인으로 간다', async () => {
    const { nav, writes, tables } = await openA19({ profiles: [{ ...ME_PROFILE, onboarding_step: 2 }, PARTNER] })
    fireEvent.change(date(), { target: { value: '20240101' } })
    fireEvent.change(nick(), { target: { value: '늘봄' } })
    fireEvent.click(submit())
    await settle()
    expect(writes.filter((w) => w.table === 'couples').map((w) => w.payload)).toEqual([
      { relationship_start_date: '2024-01-01', start_date_set_by: 'me' },
      { nickname: '늘봄' },
    ])
    expect(stepRows(writes)).toEqual([3])
    expect(tables.profiles[0].onboarding_step).toBe(3)
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
  })

  it('저장이 실패하면 넘어가지 않고 안내가 나온다', async () => {
    const { nav, client } = await openA19()
    fireEvent.change(date(), { target: { value: '20240101' } })
    fireEvent.change(nick(), { target: { value: '늘봄' } })
    ;(client as unknown as { from: () => never }).from = () => { throw new Error('x') }
    fireEvent.click(submit())
    await settle()
    expect(screen.getByTestId('start-error').textContent).toBe('저장하지 못했어요. 다시 시도해주세요.')
    expect(nav.enterAccount).not.toHaveBeenCalled()
  })

  it('거의 동시에 입력해 상대 날짜가 먼저 적용됐으면 그 날짜를 A20으로 보여 준다 - 확인할 때 마무리', async () => {
    const { nav, writes, tables } = await openA19()
    fireEvent.change(date(), { target: { value: '20240101' } })
    fireEvent.change(nick(), { target: { value: '늘봄' } })
    // 내가 [시작하기]를 누르기 전에 상대가 먼저 저장했다.
    Object.assign(tables.couples[0], { relationship_start_date: '2023-05-05', start_date_set_by: 'p1', nickname: '봄' })
    fireEvent.click(submit())
    await settle()
    expect(screen.getByTestId('start-since-date').textContent).toBe('2023.05.05')
    expect(writes.filter((w) => w.table === 'couples').map((w) => w.payload)).toEqual([{ start_date_confirmed_by: 'me' }])
    expect(stepRows(writes)).toEqual([])
    expect(nav.enterAccount).not.toHaveBeenCalled()
  })

  it('연결된 커플이 없으면(해제 등) 이 화면에서 할 일이 없다 - 메인으로', async () => {
    setup()
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} />)
    await settle()
    expect(nav.reset).toHaveBeenCalledWith('main')
  })
})

describe('A20 상대가 정한 날짜 확인', () => {
  const SET_BY_PARTNER = { ...ACTIVE, relationship_start_date: '2025-12-27', start_date_set_by: 'p1', start_date_confirmed_by: null, nickname: '늘봄' }

  it('상대가 먼저 정했으면 A19가 아니라 A20이 열리고, 먼저 정한 값이 보인다', async () => {
    setup({ couples: [SET_BY_PARTNER] })
    render(<StartDateScreen nav={makeFakeNav()} />)
    await settle()
    expect(screen.queryByTestId('start-date-input')).toBeNull()
    expect(screen.getByTestId('start-since-date').textContent).toBe('2025.12.27')
    expect(screen.getByTestId('start-since-sub').textContent).toMatch(/^오늘 D\+\d+ · 늘봄$/)
    expect(document.querySelector('h1')?.textContent).toBe('서영이 날짜를\n먼저 정했어요')
    expect(screen.getByText('날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요')).toBeTruthy()
  })

  it('[확인했어요]는 입력 없이 확인만 기록하고 진행 단계를 마무리해 메인으로 간다', async () => {
    const { writes } = setup({ couples: [SET_BY_PARTNER], profiles: [{ ...ME_PROFILE, onboarding_step: 2 }, PARTNER] })
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} />)
    await settle()
    fireEvent.click(screen.getByText('확인했어요'))
    await settle()
    expect(writes.filter((w) => w.table === 'couples').map((w) => w.payload)).toEqual([{ start_date_confirmed_by: 'me' }])
    expect(stepRows(writes)).toEqual([3])
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
  })

  it('내가 이미 정한 날짜면 이 화면에서 할 일이 없다 - 마무리하고 메인으로', async () => {
    const { writes } = setup({ couples: [{ ...SET_BY_PARTNER, start_date_set_by: 'me' }], profiles: [{ ...ME_PROFILE, onboarding_step: 2 }, PARTNER] })
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} />)
    await settle()
    expect(stepRows(writes)).toEqual([3])
    expect(nav.enterAccount).toHaveBeenCalledWith('main')
  })
})

describe('A20 재표시 - 상대가 고친 날짜', () => {
  const FIXED_BY_PARTNER = { ...ACTIVE, relationship_start_date: '2025-12-27', start_date_set_by: 'p1', start_date_confirmed_by: null, nickname: '늘봄' }

  function Probe({ nav, enabled = true }: { nav: ReturnType<typeof makeFakeNav>; enabled?: boolean }) {
    useStartDateRecheck(nav, enabled)
    return null
  }

  it('확인자가 null이고 정한 사람이 상대면 확인 화면을 연다 - 같은 값으로는 한 번만', async () => {
    setup({ couples: [FIXED_BY_PARTNER] })
    const nav = makeFakeNav()
    render(<Probe nav={nav} />)
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('start-date-recheck', { urgent: true })
    // 앱이 다시 보여도(복귀) 같은 값이면 다시 열지 않는다.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('내가 정했거나 이미 확인했거나 탭 화면이 아니면 열지 않는다', async () => {
    for (const [row, enabled] of [
      [{ ...FIXED_BY_PARTNER, start_date_set_by: 'me' }, true],
      [{ ...FIXED_BY_PARTNER, start_date_confirmed_by: 'p1' }, true],
      [FIXED_BY_PARTNER, false],
    ] as const) {
      cleanup()
      setup({ couples: [row] })
      const nav = makeFakeNav()
      render(<Probe nav={nav} enabled={enabled} />)
      await settle()
      expect(nav.push).not.toHaveBeenCalled()
    }
  })

  it('재표시 길의 [확인했어요]는 확인자만 쓰고 진행 단계는 쓰지 않으며 메인으로 돌아간다', async () => {
    const { writes, tables } = setup({ couples: [FIXED_BY_PARTNER] })
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} mode="recheck" />)
    await settle()
    expect(screen.getByTestId('start-since-date').textContent).toBe('2025.12.27')
    expect(screen.getByTestId('start-confirm-note').textContent).toBe('날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요')
    fireEvent.click(screen.getByText('확인했어요'))
    await settle()
    expect(writes).toEqual([{ table: 'couples', op: 'update', payload: { start_date_confirmed_by: 'me' } }])
    expect(writes.some((w) => w.table === 'profiles')).toBe(false)
    expect(tables.couples[0].relationship_start_date).toBe('2025-12-27')
    expect(nav.reset).toHaveBeenCalledWith('main')
  })

  it('재표시 길인데 할 일이 없으면(이미 확인함) 아무것도 쓰지 않고 돌아간다', async () => {
    const { writes } = setup({ couples: [{ ...FIXED_BY_PARTNER, start_date_confirmed_by: 'me' }] })
    const nav = makeFakeNav()
    render(<StartDateScreen nav={nav} mode="recheck" />)
    await settle()
    expect(writes).toEqual([])
    expect(nav.reset).toHaveBeenCalledWith('main')
  })

  it('앱 안: 탭에 들어오면 상대가 고친 날짜 확인이 스택으로 열리고, 확인하면 메인으로 돌아온다', async () => {
    setup({ couples: [FIXED_BY_PARTNER], profiles: [{ ...ME_PROFILE, onboarding_step: 3 }, PARTNER] })
    render(<App bridge={makeFakeBridge()} initialPath="/main" />)
    await settle(400)
    expect(document.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('start-date-recheck')
    expect(screen.queryByTestId('tab-bar')).toBeNull()
    fireEvent.click(screen.getByText('확인했어요'))
    await settle(400)
    expect(document.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('main')
  })
})

describe('앱을 닫았다 열면 서버 진행 단계에서 재개한다(u6Onboarding2 · u6ExistingAccount)', () => {
  const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
  const ACTIVE_NO_DATE = { ...ACTIVE, relationship_start_date: null }
  const ACTIVE_DATE = { ...ACTIVE, relationship_start_date: '2025-12-27', start_date_set_by: 'me', start_date_confirmed_by: 'p1' }
  const PENDING = { id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', relationship_start_date: null }

  it.each([
    [0, [], 'detail'],
    [1, [], 'invite'],
    [2, [ACTIVE_NO_DATE], 'start-date'],
    [2, [ACTIVE_DATE], 'main'],
    [2, [PENDING], 'main'],
    [3, [ACTIVE_DATE], 'main'],
    [3, [], 'main'],
  ] as const)('진행 단계 %i + 커플 행 -> %s', async (step, couples, destination) => {
    const db = makeCoupleDb({
      profiles: [{ ...ME_PROFILE, onboarding_step: step }, PARTNER],
      couples: couples.map((c) => ({ ...c })),
      session: { user: { id: 'me' } },
    })
    setSupabaseForTest(db.client)
    useAuthStore.getState().setUserId(null)
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    expect(screenName()).toBe(destination)
    // 이 경로에서 진행 단계를 새로 쓰지 않는다 - 읽기만 한다(사귄 날짜 화면이 열린 뒤의 마무리 쓰기는 제외하고 첫 판정 시점엔 0).
    if (destination !== 'start-date') expect(stepWrites(db.writes)).toEqual([])
  })
})
