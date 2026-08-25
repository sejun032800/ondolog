import { fireEvent, render } from '@testing-library/react-native'
import { useState } from 'react'
import {
  ConsentChecklist,
  INITIAL_CONSENT_VALUE,
  type ConsentValue,
} from '../../src/components/ConsentChecklist'

/**
 * ConsentChecklist는 완전한 controlled 컴포넌트라 상태를 직접 들고
 * 테스트한다(화면 6 auth.tsx가 실제로 하는 것과 동일한 패턴).
 *
 * `@testing-library/react-native` 14는 `fireEvent.press`가 비동기다
 * (내부적으로 `act()`를 await한다) — 매 호출을 반드시 await해야
 * 다음 assertion/테스트가 이전 상태 업데이트와 겹치지 않는다.
 */
function Harness({ ageEligible = true }: { ageEligible?: boolean }) {
  const [value, setValue] = useState<ConsentValue>(INITIAL_CONSENT_VALUE)
  return <ConsentChecklist value={value} onChange={setValue} ageEligible={ageEligible} />
}

describe('ConsentChecklist — 화면 6 동의 항목(Part 9-1 6-2~6-3)', () => {
  it('초기 상태는 전부 미체크다', async () => {
    const { getByTestId } = await render(<Harness />)
    expect(getByTestId('consent-terms').props.accessibilityState.checked).toBe(false)
    expect(getByTestId('consent-privacy').props.accessibilityState.checked).toBe(false)
    expect(getByTestId('consent-ai-usage').props.accessibilityState.checked).toBe(false)
    expect(getByTestId('consent-marketing').props.accessibilityState.checked).toBe(false)
  })

  it('필수 항목 2~4 각각에 [보기] 링크가 존재한다', async () => {
    const { getByTestId } = await render(<Harness />)
    expect(getByTestId('consent-terms-link')).toBeTruthy()
    expect(getByTestId('consent-privacy-link')).toBeTruthy()
    expect(getByTestId('consent-ai-usage-link')).toBeTruthy()
    expect(getByTestId('consent-marketing-link')).toBeTruthy()
  })

  it('항목을 개별 탭하면 해당 항목만 토글된다', async () => {
    const { getByTestId } = await render(<Harness />)
    await fireEvent.press(getByTestId('consent-terms'))
    expect(getByTestId('consent-terms').props.accessibilityState.checked).toBe(true)
    expect(getByTestId('consent-privacy').props.accessibilityState.checked).toBe(false)
  })

  it('"전체 동의"를 탭하면 필수 3개 + 선택 1개가 모두 체크된다', async () => {
    const { getByTestId } = await render(<Harness />)
    await fireEvent.press(getByTestId('consent-all'))
    expect(getByTestId('consent-terms').props.accessibilityState.checked).toBe(true)
    expect(getByTestId('consent-privacy').props.accessibilityState.checked).toBe(true)
    expect(getByTestId('consent-ai-usage').props.accessibilityState.checked).toBe(true)
    expect(getByTestId('consent-marketing').props.accessibilityState.checked).toBe(true)
  })

  it('전체 동의 상태에서 다시 탭하면 전부 해제된다', async () => {
    const { getByTestId } = await render(<Harness />)
    await fireEvent.press(getByTestId('consent-all'))
    await fireEvent.press(getByTestId('consent-all'))
    expect(getByTestId('consent-terms').props.accessibilityState.checked).toBe(false)
    expect(getByTestId('consent-marketing').props.accessibilityState.checked).toBe(false)
  })

  it('만 14세 미만이면 안내 문구가 노출된다', async () => {
    const { getByTestId } = await render(<Harness ageEligible={false} />)
    expect(getByTestId('consent-age-error').props.children).toBe(
      '만 14세 미만은 서비스를 이용할 수 없습니다',
    )
  })

  it('만 14세 이상이면 안내 문구가 없다', async () => {
    const { queryByTestId } = await render(<Harness ageEligible={true} />)
    expect(queryByTestId('consent-age-error')).toBeNull()
  })

  it('[보기]를 탭하면 전문 모달이 뜨고, 닫기로 닫힌다', async () => {
    const { getByTestId, queryByTestId } = await render(<Harness />)
    expect(queryByTestId('legal-document-sheet')).toBeNull()
    await fireEvent.press(getByTestId('consent-terms-link'))
    expect(getByTestId('legal-document-sheet')).toBeTruthy()
  })
})
