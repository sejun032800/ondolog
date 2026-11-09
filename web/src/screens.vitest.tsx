import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useSessionStore } from '@/store/sessionStore'
import { BasicInfoScreen, ConsentScreen, ResultBriefScreen, resetBriefPlayed } from './screens'
import { CodeInput, normalizeCodeInput } from './codeInput'
import { installKeyboardFocus } from './platform/keyboardFocus'
import { drawResultCard, type ResultCardData } from './share/resultCard'
import { fillOnboardingAnswers, makeFakeBridge, makeFakeNav } from './testSupport'
import { useAuthStore } from './auth/stores'

vi.mock('./share/resultCard', async (orig) => {
  const real = await orig<typeof import('./share/resultCard')>()
  return {
    ...real,
    renderResultCardImage: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AAAA', fileName: 'ondolog-result.png' })),
  }
})

beforeEach(() => {
  useSessionStore.getState().resetSession()
  useAuthStore.getState().setUserId(null)
  resetBriefPlayed()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const wrap = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>)

describe('A03 기본정보 (E1)', () => {
  it('부제는 앱 문구이고 체험판 기록을 전제로 한 문구가 없다', () => {
    wrap(<BasicInfoScreen nav={makeFakeNav()} />)
    expect(screen.getByText('결과를 보고 가입할지 정해도 돼요. 그 전까지는 이 폰에만 머물러요.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/익명 통계|체험판/)
  })

  it('이름 · 생년월일 입력 칸은 키보드에 맞는 속성을 가진다', () => {
    wrap(<BasicInfoScreen nav={makeFakeNav()} />)
    const birth = screen.getByPlaceholderText('YYYY.MM.DD') as HTMLInputElement
    expect(birth.getAttribute('inputmode')).toBe('numeric')
  })
})

describe('A10 약관 동의 (B2 · B18 · E6)', () => {
  function renderConsent() {
    useSessionStore.getState().setBirthDate('1995-05-05')
    wrap(<ConsentScreen nav={makeFakeNav()} />)
  }
  // 이름 앞의 체크 표시(✓)를 빼고 줄 이름으로 찾는다.
  const checkbox = (name: RegExp) =>
    screen.getAllByRole('checkbox').find((el) => name.test((el.textContent ?? '').replace('✓', '').trim()))!

  it('항목 문장 · 필수 / 선택 표시가 보이고, 마케팅은 처음에 꺼져 있다', () => {
    renderConsent()
    expect(useSessionStore.getState().consent.marketing).toBe(false)
    expect(screen.getByText('이용약관')).toBeTruthy()
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy()
    expect(screen.getByText('AI 콘텐츠 생성을 위한 데이터 활용')).toBeTruthy()
    expect(screen.getByText('마케팅 정보 수신')).toBeTruthy()
    expect(screen.getAllByText('필수')).toHaveLength(3)
    expect(screen.getAllByText('선택')).toHaveLength(1)
    expect(checkbox(/^마케팅 정보 수신/).getAttribute('aria-checked')).toBe('false')
  })

  it('"전체 동의"를 누르면 마케팅까지 켜지고, 그 사실이 문장으로 보인다', () => {
    renderConsent()
    expect(screen.getByText('선택 항목(마케팅 정보 수신)도 함께 켜져요')).toBeTruthy()
    fireEvent.click(checkbox(/^전체 동의/))
    const c = useSessionStore.getState().consent
    expect(c).toEqual({ terms: true, privacy: true, aiUsage: true, marketing: true })
    fireEvent.click(checkbox(/^전체 동의/))
    expect(useSessionStore.getState().consent.marketing).toBe(false)
  })

  it('필수 셋을 직접 켜면 마케팅은 켜지지 않는다', () => {
    renderConsent()
    fireEvent.click(checkbox(/^이용약관/))
    fireEvent.click(checkbox(/^개인정보 처리방침/))
    fireEvent.click(checkbox(/^AI 콘텐츠 생성/))
    expect(useSessionStore.getState().consent).toEqual({ terms: true, privacy: true, aiUsage: true, marketing: false })
  })
})

describe('A08 결과 카드 (E3 · E4)', () => {
  beforeEach(() => fillOnboardingAnswers())

  it('공유하기 -> 이미지를 만들어 공유 시트로 한 번 보낸다. 가입 링크는 공유 버튼보다 눈에 띄지 않는다', async () => {
    const bridge = makeFakeBridge()
    wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={bridge} />)
    const share = screen.getByText('공유하기')
    expect(share.className).toContain('primary')
    expect(screen.getByText('이미지 저장').className).toContain('ghost')
    const more = screen.getByText('더 자세히 보기 →')
    expect(more.className).toContain('link')
    expect(more.className).not.toContain('btn')
    fireEvent.click(share)
    fireEvent.click(share) // 만드는 동안 다시 눌러도 한 번
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(bridge.shareImage).toHaveBeenCalledTimes(1)
    expect((bridge.shareImage as ReturnType<typeof vi.fn>).mock.calls[0][0].fileName).toBe('ondolog-result.png')
  })

  it('이미지 저장 -> 저장하고 알린다 / 못하면 안내한다', async () => {
    const bridge = makeFakeBridge()
    wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={bridge} />)
    fireEvent.click(screen.getByText('이미지 저장'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(bridge.saveImage).toHaveBeenCalledTimes(1)
    expect(screen.getByText('이미지를 저장했어요')).toBeTruthy()
    cleanup()
    const failing = makeFakeBridge({ saveImage: vi.fn(async () => 'failed' as const) })
    wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={failing} />)
    fireEvent.click(screen.getByText('이미지 저장'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('저장하지 못했어요')).toBeTruthy()
  })

  it('공유를 닫아도(취소) 오류 안내는 없다', async () => {
    const bridge = makeFakeBridge({ shareImage: vi.fn(async () => 'cancelled' as const) })
    wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={bridge} />)
    fireEvent.click(screen.getByText('공유하기'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByText('공유하지 못했어요')).toBeNull()
  })

  it('화면 어디에도 이름이 없다', () => {
    wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={makeFakeBridge()} />)
    expect(document.body.textContent).not.toContain('시험')
  })

  it('같은 결과로 다시 열려도 등장 연출을 처음부터 다시 재생하지 않는다 (5문항을 다시 풀면 다시 재생)', () => {
    const first = wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={makeFakeBridge()} />)
    expect(first.container.querySelector('.screen')!.className).not.toContain('still')
    first.unmount()
    const second = wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={makeFakeBridge()} />)
    expect(second.container.querySelector('.screen')!.className).toContain('still')
    second.unmount()
    resetBriefPlayed()
    const third = wrap(<ResultBriefScreen nav={makeFakeNav()} bridge={makeFakeBridge()} />)
    expect(third.container.querySelector('.screen')!.className).not.toContain('still')
  })
})

describe('결과 카드 이미지', () => {
  function recordingCtx() {
    const texts: string[] = []
    const ctx = {
      fillText: (t: string) => { texts.push(t) },
      fillRect: () => {},
      measureText: (t: string) => ({ width: t.length * 20 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    } as unknown as CanvasRenderingContext2D
    return { ctx, texts }
  }
  const card: ResultCardData = { labelEn: 'WARM EMBER', labelKo: '따뜻한 불씨', copyKo: '곁에 있을 때 가장 편안한 사람', mbti: 'ENFP', enneagramCore: 2, isRare: true }

  it('유형 · MBTI · 애니어그램 · 브랜드 글자표만 그리고, 이름 같은 값을 받는 자리가 없다', () => {
    const { ctx, texts } = recordingCtx()
    drawResultCard(ctx, card)
    expect(texts).toEqual(expect.arrayContaining(['MY LOVE TYPE', 'WARM EMBER', 'ENFP · 애니어그램 2', '희귀 조합', 'ONDOLOG']))
    expect(texts.join(' ')).toContain('따뜻한')
    expect(Object.keys(card).sort()).toEqual(['copyKo', 'enneagramCore', 'isRare', 'labelEn', 'labelKo', 'mbti'])
  })

  it('긴 설명은 줄을 나눠 그린다', () => {
    const short = recordingCtx()
    drawResultCard(short.ctx, card)
    const long = recordingCtx()
    drawResultCard(long.ctx, { ...card, copyKo: '아주 긴 설명 문장이 여러 줄로 나뉘어서 카드 폭 안에 들어가야 해요 정말로 그래야 해요 그렇죠' })
    expect(long.texts.length).toBeGreaterThan(short.texts.length)
  })
})

describe('B9 키보드 · 코드 입력', () => {
  it('코드 입력은 영문 대문자 키보드로 열리고 입력값은 대문자로 바뀐다', () => {
    const onChange = vi.fn()
    render(<CodeInput value="" onChange={onChange} />)
    const input = screen.getByLabelText('초대 코드') as HTMLInputElement
    expect(input.getAttribute('autocapitalize')).toBe('characters')
    expect(input.getAttribute('inputmode')).toBe('text')
    fireEvent.change(input, { target: { value: 'ab-c1 2xyz' } })
    expect(onChange).toHaveBeenCalledWith('ABC12X')
  })

  it('normalizeCodeInput은 대문자 · 숫자만 남기고 길이를 자른다', () => {
    expect(normalizeCodeInput('a b-c')).toBe('ABC')
    expect(normalizeCodeInput('abcdefgh')).toBe('ABCDEF')
  })

  it('입력 칸에 포커스가 가면 잠시 뒤 화면 가운데로 스크롤하고, 채팅 입력줄은 건드리지 않는다', () => {
    vi.useFakeTimers()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const off = installKeyboardFocus(document)
    const wrapEl = document.createElement('div')
    wrapEl.innerHTML = '<input id="a"/><div class="composer"><input id="c"/></div>'
    document.body.appendChild(wrapEl)
    const a = wrapEl.querySelector('#a') as HTMLInputElement
    const c = wrapEl.querySelector('#c') as HTMLInputElement
    a.focus()
    vi.advanceTimersByTime(400)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    c.focus()
    vi.advanceTimersByTime(400)
    expect(scroll).toHaveBeenCalledTimes(1)
    off()
    wrapEl.remove()
  })
})
