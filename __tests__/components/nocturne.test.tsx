/**
 * Nocturne v5 토큰·공통 컴포넌트 시험 (U0, `53-`).
 * 값 계산과 렌더 계약만 본다. 시각 확인은 개발 빌드 확인 화면과 `51-` 실기기에서 한다.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import {
  NUMERAL_DECIMAL_RATIO,
  glow,
  ink,
  motion,
  nocturne,
  shape,
  type,
  withAlpha,
} from '../../src/theme/nocturne'
import { BACKGROUND_STARS, twinklePeriodMs } from '../../src/components/nocturne/BackgroundStars'
import { clampProgress, ProgressRule } from '../../src/components/nocturne/ProgressRule'
import { formatVol, VolBadge, LockBadge } from '../../src/components/nocturne/Chips'
import { GlowNumeral, splitNumeral } from '../../src/components/nocturne/GlowNumeral'
import { TabBarView } from '../../src/components/nocturne/TabBar'
import { TAB_ICON_NAMES } from '../../src/components/nocturne/TabIcons'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { Segmented } from '../../src/components/nocturne/Segmented'
import { Toggle } from '../../src/components/nocturne/Toggle'
import { ListGroup, ListRow } from '../../src/components/nocturne/ListGroup'
import { PushHeader, SheetHeader } from '../../src/components/nocturne/ExitHeader'
import { QuoteText } from '../../src/components/nocturne/QuoteText'
import { PHOTO_SCRIM_GRADIENT } from '../../src/components/nocturne/PhotoScrim'
import { SkyBackground } from '../../src/components/nocturne/SkyBackground'
import { Skeleton } from '../../src/components/nocturne/Skeleton'
import { RiseIn } from '../../src/components/nocturne/RiseIn'
import { DateCard } from '../../src/components/nocturne/DateCard'
import { Grain } from '../../src/components/nocturne/Grain'
import { Text } from 'react-native'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

describe('nocturne 토큰', () => {
  it('활자 10단과 빛 3종이 있다', async () => {
    expect(Object.keys(type)).toEqual([
      'hero',
      'display',
      'title',
      'body',
      'sub',
      'caption',
      'kicker',
      'quote',
      'quoteLg',
      'tab',
    ])
    expect(Object.keys(glow)).toEqual(['numeral', 'star', 'lift'])
  })

  it('withAlpha는 같은 색의 rgba를 만든다', async () => {
    expect(withAlpha(nocturne.text, 0.08)).toMatch(/^rgba\(\d+,\d+,\d+,0\.08\)$/)
    expect(withAlpha(nocturne.ink, 0)).toMatch(/^rgba\(\d+,\d+,\d+,0\)$/)
    expect(() => withAlpha('not-a-hex', 0.5)).toThrow()
  })

  it('모션 상수가 원본 값과 같다', async () => {
    expect(motion.rise).toEqual({ distance: 8, durationMs: 260 })
    expect(motion.press).toEqual({ scale: 0.98, durationMs: 120 })
    expect(motion.sheetSpring.damping).toBe(18)
    expect(motion.starTwinkle).toMatchObject({ minMs: 9000, maxMs: 12000, from: 0.35, to: 0.75 })
    expect(motion.skeletonPulse).toEqual({ from: 0.06, to: 0.12, durationMs: 1600 })
  })

  it('최소 터치는 48, 버튼 높이 54', async () => {
    expect(shape.touch).toBe(48)
    expect(shape.buttonHeight).toBe(54)
  })

  it('ink 위계: metric = rose + 발광, narrative = text, verbatim = textSub + 세리프', async () => {
    expect(ink('metric')).toMatchObject({ color: nocturne.rose, textShadowRadius: 28 })
    expect(ink('narrative').color).toBe(nocturne.text)
    expect(ink('verbatim')).toMatchObject({ color: nocturne.textSub, fontFamily: 'MaruBuri-Regular' })
  })

  it('같은 입력은 같은 ink를 준다(결정적)', async () => {
    expect(ink('metric')).toEqual(ink('metric'))
  })
})

describe('배경 별', () => {
  it('주기는 모든 별에서 9-12초 안이다', async () => {
    BACKGROUND_STARS.forEach((_, i) => {
      const p = twinklePeriodMs(i)
      expect(p).toBeGreaterThanOrEqual(9000)
      expect(p).toBeLessThanOrEqual(12000)
    })
  })
})

describe('GlowNumeral', () => {
  it('정수/소수를 나눈다', async () => {
    expect(splitNumeral(38.2)).toEqual({ integer: '38', decimal: '2' })
    expect(splitNumeral(36.5)).toEqual({ integer: '36', decimal: '5' })
    expect(splitNumeral(37)).toEqual({ integer: '37', decimal: '0' })
  })

  it('소수부는 정수부의 42%이고, 미연결은 textMute + 발광 없음', async () => {
    const { toJSON } = await render(<GlowNumeral value={36.5} connected={false} />)
    const json = JSON.stringify(toJSON())
    expect(json).toContain(nocturne.textMute)
    expect(json).not.toContain('textShadowRadius')
    expect(Math.round(92 * NUMERAL_DECIMAL_RATIO)).toBe(39)
  })

  it('연결 상태는 rose + 발광', async () => {
    const { toJSON } = await render(<GlowNumeral value={38.2} />)
    const json = JSON.stringify(toJSON())
    expect(json).toContain(nocturne.rose)
    expect(json).toContain('textShadowRadius')
  })
})

describe('ProgressRule', () => {
  it('진행률을 0-1로 제한한다', async () => {
    expect(clampProgress(-1)).toBe(0)
    expect(clampProgress(2)).toBe(1)
    expect(clampProgress(0.41)).toBe(0.41)
    expect(clampProgress(Number.NaN)).toBe(0)
  })

  it('정지 상태로 폭만 그린다', async () => {
    await render(<ProgressRule progress={0.41} />)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })
})

describe('배지·칩', () => {
  it('VolBadge는 두 자리로 쓴다', async () => {
    expect(formatVol(2)).toBe('VOL.02')
    expect(formatVol(12)).toBe('VOL.12')
    await render(<VolBadge volume={2} />)
    expect(screen.getByText('VOL.02')).toBeTruthy()
  })

  it('LockBadge는 글자만 그린다(기본 "구독")', async () => {
    await render(<LockBadge />)
    expect(screen.getByText('구독')).toBeTruthy()
  })
})

describe('TabBarView', () => {
  const items = [
    { key: 'main', name: 'main', label: '메인' },
    { key: 'chat', name: 'chat', label: '채팅' },
    { key: 'feed', name: 'feed', label: '피드' },
    { key: 'magazine', name: 'magazine', label: '매거진' },
    { key: 'settings', name: 'settings', label: '설정' },
  ]

  it('탭 5개를 모두 보인다', async () => {
    await render(<TabBarView items={items} activeIndex={0} onPressItem={() => {}} bottomInset={34} />)
    items.forEach((it) => expect(screen.getByText(it.label)).toBeTruthy())
    expect(TAB_ICON_NAMES).toHaveLength(5)
  })

  it('bottom = 안전영역 + 12', async () => {
    await render(<TabBarView items={items} activeIndex={0} onPressItem={() => {}} bottomInset={34} />)
    const style = screen.getByTestId('nocturne-tab-bar').props.style
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style
    expect(flat.bottom).toBe(46)
    expect(flat.position).toBe('absolute')
  })

  it('누른 탭의 인덱스를 알린다', async () => {
    const onPressItem = jest.fn()
    await render(<TabBarView items={items} activeIndex={0} onPressItem={onPressItem} bottomInset={0} />)
    await fireEvent.press(screen.getByTestId('tab-feed'))
    expect(onPressItem).toHaveBeenCalledWith(2)
  })
})

describe('입력 컴포넌트', () => {
  it('PrimaryButton은 비활성이면 누름이 전달되지 않는다', async () => {
    const onPress = jest.fn()
    await render(<PrimaryButton label="발행 확인으로" onPress={onPress} disabled />)
    await fireEvent.press(screen.getByText('발행 확인으로'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('PrimaryButton은 누르면 호출된다', async () => {
    const onPress = jest.fn()
    await render(<PrimaryButton label="발행 확인으로" onPress={onPress} />)
    await fireEvent.press(screen.getByText('발행 확인으로'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('Segmented는 고른 키를 알린다', async () => {
    const onChange = jest.fn()
    await render(
      <Segmented
        options={[
          { key: 'feed', label: '피드형' },
          { key: 'map', label: '지도형' },
        ]}
        value="feed"
        onChange={onChange}
      />,
    )
    await fireEvent.press(screen.getByText('지도형'))
    expect(onChange).toHaveBeenCalledWith('map')
  })

  it('Toggle은 반대 값을 알린다', async () => {
    const onValueChange = jest.fn()
    await render(<Toggle value={false} onValueChange={onValueChange} accessibilityLabel="유성" />)
    await fireEvent.press(screen.getByRole('switch'))
    expect(onValueChange).toHaveBeenCalledWith(true)
  })

  it('ListRow: 누를 수 있으면 → 가 붙고 button이며, 비활성이면 button이 아니다', async () => {
    const onPress = jest.fn()
    await render(
      <ListGroup>
        <ListRow label="발행물 테마" value="기본" onPress={onPress} />
        <ListRow label="재검사" value="사용함" disabled onPress={onPress} />
      </ListGroup>,
    )
    expect(screen.getByText('기본 →')).toBeTruthy()
    // 비활성 행은 누르는 요소(button)로 그려지지 않는다.
    expect(screen.queryByRole('button', { name: '재검사' })).toBeNull()
    expect(screen.getByRole('button', { name: '발행물 테마' })).toBeTruthy()
    await fireEvent.press(screen.getByText('발행물 테마'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('나가기 머리', () => {
  it('푸시: ← 로 나간다', async () => {
    const onBack = jest.fn()
    await render(<PushHeader onBack={onBack} backLabel="매거진" />)
    expect(screen.getByText('←')).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('뒤로, 매거진'))
    expect(onBack).toHaveBeenCalled()
  })

  it('시트: 손잡이 + ✕ 로 나간다', async () => {
    const onClose = jest.fn()
    await render(<SheetHeader onClose={onClose} />)
    expect(screen.getByTestId('sheet-handle')).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('QuoteText · 사진 장막', () => {
  it('따옴표 또는 1px 선 중 하나로만 표시한다', async () => {
    const { rerender } = await render(<QuoteText>기다릴게</QuoteText>)
    expect(screen.getByText('“기다릴게”')).toBeTruthy()
    await rerender(<QuoteText mark="rule">기다릴게</QuoteText>)
    expect(screen.getByText('기다릴게')).toBeTruthy()
  })

  it('장막 그라디언트는 ink 0 -> .82', async () => {
    expect(PHOTO_SCRIM_GRADIENT).toBe(
      `linear-gradient(180deg, ${withAlpha(nocturne.ink, 0)} 0%, ${withAlpha(nocturne.ink, 0.82)} 100%)`,
    )
  })
})

describe('배경·진입·뼈대 렌더', () => {
  it('SkyBackground는 장막 투명도를 sky.ts 값으로 그리고 배경 별을 포함한다', async () => {
    await render(
      <SkyBackground view="main">
        <Text>자식</Text>
      </SkyBackground>,
    )
    expect(screen.getByText('자식')).toBeTruthy()
    expect(screen.getByTestId('background-stars')).toBeTruthy()
    const veil = screen.getByTestId('sky-veil').props.style
    const flat = Array.isArray(veil) ? Object.assign({}, ...veil) : veil
    expect(flat.opacity).toBe(0.42)
  })

  it('SkyBackground stars=false면 배경 별을 그리지 않는다', async () => {
    await render(<SkyBackground stars={false} />)
    expect(screen.queryByTestId('background-stars')).toBeNull()
  })

  it('RiseIn · Skeleton · Grain · DateCard가 그려진다', async () => {
    await render(
      <>
        <RiseIn>
          <Text>떠오름</Text>
        </RiseIn>
        <Skeleton width="40%" />
        <Grain />
        <DateCard dateLabel="2026.10.03 · 연남동" title="스파이더맨과 케이크 사이" meta="사진 11 · 메모 2" />
      </>,
    )
    expect(screen.getByText('떠오름')).toBeTruthy()
    expect(screen.getByTestId('grain', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByTestId('photo-scrim')).toBeTruthy()
    expect(screen.getByText('스파이더맨과 케이크 사이')).toBeTruthy()
  })
})
