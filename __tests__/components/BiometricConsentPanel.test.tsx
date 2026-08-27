import { Alert, Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { useState } from 'react'
import { BiometricConsentPanel } from '../../src/components/BiometricConsentPanel'
import { BIOMETRIC_ON_DEVICE_NOTICE_POINTS } from '../../src/constants/legalDocuments'

/**
 * 화면 A(생체정보 동의) — docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보
 * (얼굴 인식) 별도 동의" 완료 기준을 그대로 검증한다.
 *
 * `ConsentChecklist.test.tsx`와 같은 패턴: `fireEvent.press`는 비동기라
 * 매 호출을 await한다.
 */
function ConsentHarness() {
  const [checked, setChecked] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [wentLater, setWentLater] = useState(false)
  return (
    <>
      <BiometricConsentPanel
        mode="consent"
        checked={checked}
        onChangeChecked={setChecked}
        onAgree={() => setAgreed(true)}
        onLater={() => setWentLater(true)}
      />
      {agreed && <Text>agreed-marker</Text>}
      {wentLater && <Text>later-marker</Text>}
    </>
  )
}

describe('BiometricConsentPanel — 온디바이스 처리 고지(완료 기준: 4개 요지 전부 노출, 스킵 불가)', () => {
  it('4개 요지가 모두 화면에 직접 노출된다(전문 링크 뒤에 숨지 않는다)', async () => {
    const { getByText } = await render(
      <BiometricConsentPanel mode="consent" checked={false} />,
    )
    expect(BIOMETRIC_ON_DEVICE_NOTICE_POINTS).toHaveLength(4)
    for (const point of BIOMETRIC_ON_DEVICE_NOTICE_POINTS) {
      expect(getByText(`· ${point}`)).toBeTruthy()
    }
  })

  it('전문 보기를 탭하면 전문 모달이 뜬다', async () => {
    const { getByTestId, queryByTestId } = await render(
      <BiometricConsentPanel mode="consent" checked={false} />,
    )
    expect(queryByTestId('legal-document-sheet')).toBeNull()
    await fireEvent.press(getByTestId('biometric-consent-full-document-link'))
    expect(getByTestId('legal-document-sheet')).toBeTruthy()
  })
})

describe('BiometricConsentPanel — mode: consent(완료 기준: 동의 없이는 진행되지 않는다)', () => {
  it('체크 전에는 [동의하고 계속]이 비활성 상태다', async () => {
    const { getByTestId } = await render(
      <BiometricConsentPanel mode="consent" checked={false} />,
    )
    expect(getByTestId('biometric-consent-agree').props.accessibilityState.disabled).toBe(true)
  })

  it('체크 전에 [동의하고 계속]을 눌러도 onAgree가 호출되지 않는다', async () => {
    const onAgree = jest.fn()
    const { getByTestId } = await render(
      <BiometricConsentPanel mode="consent" checked={false} onAgree={onAgree} />,
    )
    await fireEvent.press(getByTestId('biometric-consent-agree'))
    expect(onAgree).not.toHaveBeenCalled()
  })

  it('체크 후에는 [동의하고 계속]이 활성화되고 탭하면 onAgree가 호출된다', async () => {
    const { getByTestId, getByText } = await render(<ConsentHarness />)
    await fireEvent.press(getByTestId('biometric-consent-checkbox'))
    expect(getByTestId('biometric-consent-agree').props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(getByTestId('biometric-consent-agree'))
    expect(getByText('agreed-marker')).toBeTruthy()
  })

  it('체크 여부와 무관하게 [나중에]는 항상 눌린다', async () => {
    const { getByTestId, getByText } = await render(<ConsentHarness />)
    await fireEvent.press(getByTestId('biometric-consent-later'))
    expect(getByText('later-marker')).toBeTruthy()
  })
})

describe('BiometricConsentPanel — mode: manage(완료 기준: 철회 시 확인 다이얼로그를 거친다)', () => {
  it('체크박스 없이 [동의함] 상태 표시와 [동의 철회] 버튼만 보여준다', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(
      <BiometricConsentPanel mode="manage" />,
    )
    expect(getByText('동의함')).toBeTruthy()
    expect(getByTestId('biometric-consent-revoke')).toBeTruthy()
    expect(queryByTestId('biometric-consent-checkbox')).toBeNull()
  })

  it('[동의 철회]를 누르면 확인 다이얼로그가 뜨고, 즉시 onRevoke를 호출하지 않는다', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const onRevoke = jest.fn()
    const { getByTestId } = await render(
      <BiometricConsentPanel mode="manage" onRevoke={onRevoke} />,
    )
    await fireEvent.press(getByTestId('biometric-consent-revoke'))
    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(onRevoke).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('다이얼로그에서 "철회"를 확정해야 onRevoke가 호출된다', async () => {
    const onRevoke = jest.fn()
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === '철회')
      confirm?.onPress?.()
    })
    const { getByTestId } = await render(
      <BiometricConsentPanel mode="manage" onRevoke={onRevoke} />,
    )
    await fireEvent.press(getByTestId('biometric-consent-revoke'))
    expect(onRevoke).toHaveBeenCalledTimes(1)
    alertSpy.mockRestore()
  })

  it('다이얼로그에서 "취소"를 누르면 onRevoke가 호출되지 않는다', async () => {
    const onRevoke = jest.fn()
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find((b) => b.text === '취소')
      cancel?.onPress?.()
    })
    const { getByTestId } = await render(
      <BiometricConsentPanel mode="manage" onRevoke={onRevoke} />,
    )
    await fireEvent.press(getByTestId('biometric-consent-revoke'))
    expect(onRevoke).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})
