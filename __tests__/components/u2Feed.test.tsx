/**
 * U2 (`56-`) 화면 부품 시험 - U0 손질(R20-3 · R20-5 · R20-6)과 피드·타임라인 부품의 렌더 계약.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AddFab } from '../../src/components/feed/AddFab'
import { FeedChapterView } from '../../src/components/feed/FeedChapterView'
import { monthCountsLabel } from '../../src/components/feed/MonthChapterHeader'
import { SoloBanner } from '../../src/components/feed/SoloBanner'
import { StopTimeline } from '../../src/components/date/StopTimeline'
import { GhostButton, PrimaryButton } from '../../src/components/nocturne/Buttons'
import { StatusChip } from '../../src/components/nocturne/Chips'
import { GRAIN_TILE_PT, grainLayout } from '../../src/components/nocturne/Grain'
import { ListGroup, ListRow } from '../../src/components/nocturne/ListGroup'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { nocturne } from '../../src/theme/nocturne'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

function colorsOf(node: unknown): string[] {
  return JSON.stringify(node).match(/"color":"[^"]+"/g) ?? []
}

describe('U0 손질', () => {
  it('R20-3 그레인 표시 크기는 128pt(256px 타일 @2x)', () => {
    expect(GRAIN_TILE_PT).toBe(128)
    const l = grainLayout(390, 844)
    expect(l.scale).toBe(0.5)
    expect(l.width).toBe(780)
    expect(l.height).toBe(1688)
  })

  it('R20-3 그레인은 화면 틀에 있다', async () => {
    await render(
      <ScreenFrame>
        <Text>내용</Text>
      </ScreenFrame>,
    )
    expect(screen.getByText('내용')).toBeTruthy()
    expect(screen.getByTestId('grain', { includeHiddenElements: true })).toBeTruthy()
  })

  it('R20-5 비활성 버튼 글자는 textFaint', async () => {
    const { toJSON } = await render(
      <>
        <PrimaryButton label="가" disabled />
        <GhostButton label="나" disabled />
      </>,
    )
    expect(colorsOf(toJSON())).toContain(`"color":"${nocturne.textFaint}"`)
  })

  it('R20-5 비활성 ListRow는 투명도 대신 textFaint 글자', async () => {
    const { toJSON } = await render(
      <ListGroup>
        <ListRow label="재검사" value="사용함" disabled onPress={() => {}} />
      </ListGroup>,
    )
    const json = JSON.stringify(toJSON())
    expect(json).toContain(nocturne.textFaint)
    expect(json).not.toContain('"opacity":0.55')
  })

  it('R20-6 참여 대기 칩 글자는 lilacText', async () => {
    expect(nocturne.lilacText).toBe('#D7C9FA')
    const { toJSON } = await render(<StatusChip label="대기 중" tone="waiting" onPress={() => {}} />)
    expect(JSON.stringify(toJSON())).toContain(nocturne.lilacText)
  })
})

describe('피드 부품', () => {
  it('월 머리 카운트는 "기록 N · 사진 N · 데이트 N"이고 별은 쓰지 않는다', () => {
    const label = monthCountsLabel({ memoTotal: 4, photoTotal: 18, dateTotal: 3 })
    expect(label).toBe('기록 4 · 사진 18 · 데이트 3')
    expect(label).not.toContain('별')
  })

  it('FeedChapterView: 대표 카드 아래 원문 한 줄과 작성자', async () => {
    const chapter = {
      key: '2026-10',
      month: 10,
      year: 2026,
      photoTotal: 4,
      memoTotal: 1,
      dates: [
        {
          id: 'd1',
          date_on: '2026-10-15',
          dateOn: '2026-10-15',
          region: null,
          title: null,
          photoCount: 4,
          memoCount: 1,
          coverPath: null,
          quote: { text: '창밖 보면서 한참 있었다.', authorId: 'u1' },
        },
        {
          id: 'd2',
          date_on: '2026-10-03',
          dateOn: '2026-10-03',
          region: null,
          title: null,
          photoCount: 1,
          memoCount: 0,
          coverPath: null,
          quote: null,
        },
      ],
    }
    const onOpen = jest.fn()
    await render(<FeedChapterView chapter={chapter} urls={{}} names={{ u1: '서영' }} onOpenDate={onOpen} />)
    expect(screen.getByTestId('feed-quote').props.children).toBe('“창밖 보면서 한참 있었다.”')
    expect(screen.getByText('서영')).toBeTruthy()
    // 제목이 비어 있으면 날짜 말로(앱이 지어내지 않는다)
    expect(screen.getByText('10월 15일 목요일')).toBeTruthy()
    expect(screen.getByText('사진 4 · 메모 1')).toBeTruthy()
    await fireEvent.press(screen.getByText('10월 15일 목요일'))
    expect(onOpen).toHaveBeenCalledWith('d1')
  })

  it('E13 배너: 기록할 수 있으면 디자인 문구, 없으면 이유를 글로 적는다', async () => {
    const { rerender } = await render(<SoloBanner canRecord onInvite={() => {}} />)
    expect(screen.getByText('혼자서도 기록할 수 있어요')).toBeTruthy()
    await rerender(<SoloBanner canRecord={false} onInvite={() => {}} />)
    expect(screen.getByText('초대 코드를 만들면 기록할 수 있어요')).toBeTruthy()
  })

  it('FAB: 비활성이면 눌러도 전달되지 않는다', async () => {
    const onPress = jest.fn()
    await render(<AddFab onPress={onPress} disabled />)
    await fireEvent.press(screen.getByTestId('feed-add-fab'))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('E03 타임라인', () => {
  const stops = [
    { id: 's0', seq: 0, arrived_at: '2026-10-03T00:00:00+09:00', place_name: null, photos: [] },
    { id: 's1', seq: 1, arrived_at: '2026-10-03T14:20:00+09:00', place_name: '홍대 CGV', photos: [] },
  ]

  it('시각 모름 stop은 시각을 그리지 않고, 말한 시각은 그린다', async () => {
    await render(<StopTimeline dateOn="2026-10-03" stops={stops} urls={{}} onEditStop={() => {}} />)
    expect(screen.queryByText('00:00')).toBeNull()
    expect(screen.getByText('14:20')).toBeTruthy()
    expect(screen.getByText('홍대 CGV')).toBeTruthy()
    expect(screen.getByText('장소 이름 더하기')).toBeTruthy()
  })

  it('장소 줄을 누르면 E15로 간다', async () => {
    const onEdit = jest.fn()
    await render(<StopTimeline dateOn="2026-10-03" stops={stops} urls={{}} onEditStop={onEdit} />)
    await fireEvent.press(screen.getByText('홍대 CGV'))
    expect(onEdit).toHaveBeenCalledWith('s1')
  })
})
