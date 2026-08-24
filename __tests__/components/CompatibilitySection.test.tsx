import { render } from '@testing-library/react-native'
import { CompatibilitySection } from '../../src/components/CompatibilitySection'
import { COMPATIBILITY_FRAMING_TEXT } from '../../src/constants/compatibility'
import type { EnneagramCore } from '../../src/constants/enneagram'

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('CompatibilitySection — 궁합 섹션 렌더링(Part 10-6-6)', () => {
  it.each(ALL_CORES)(
    '코어 %i: 프레이밍 문구(Part 10-6-0)가 항상 렌더링된다',
    async (core) => {
      const { getByTestId } = await render(
        <CompatibilitySection enneagramCore={core} />,
      )
      expect(getByTestId('compatibility-framing-text').props.children).toBe(
        COMPATIBILITY_FRAMING_TEXT,
      )
    },
  )

  it('온도가 잘 맞는 유형 3개 + 온도차가 있는 유형 2개 라벨이 모두 렌더링된다', async () => {
    const { getByText } = await render(<CompatibilitySection enneagramCore={1} />)
    expect(getByText('온도가 잘 맞는 유형')).toBeTruthy()
    expect(getByText('온도차가 있는 유형')).toBeTruthy()
  })

  it('온도차 항목 2개 모두에 실행 팁 텍스트가 동반된다', async () => {
    const { getAllByText } = await render(
      <CompatibilitySection enneagramCore={1} />,
    )
    expect(getAllByText(/실행 팁 ·/)).toHaveLength(2)
  })
})
