import { Image } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ReferencePhotoSlot } from '../../src/components/ReferencePhotoSlot'
import { REFERENCE_PHOTO_PLACEHOLDERS } from '../../src/constants/referencePhotoPlaceholders'

/**
 * 화면 C(대표사진 등록) 슬롯 — docs/ONDOLOG_MASTER.md "연인 인식용
 * 대표사진" 완료 기준을 그대로 검증한다: 선택 → 미리보기 → 저장,
 * 잠금(커플 미연결) 시 선택/저장 UI 숨김.
 *
 * jest-expo의 이미지 asset 목(mock)은 `require('*.png')`를
 * `{ testUri: '...' }` 형태로 반환한다(실제 번들러의 `{uri, width,
 * height}` 형태가 아니다) — 그래서 `Image.resolveAssetSource`가 실제
 * 환경과 다르게 `.uri`가 없는 값을 돌려준다. 실제 기기/번들 환경에서는
 * 정상 동작하는 RN 표준 API이므로, 테스트에서만 소스별로 결정론적인
 * `uri`를 돌려주도록 목을 씌운다(같은 소스 객체는 매번 같은 문자열로
 * 변환 — require는 모듈 캐싱되므로 참조가 항상 동일하다).
 */
const PREFIX = 'reference-photo-personal'

jest.spyOn(Image, 'resolveAssetSource').mockImplementation((source) => ({
  uri: `resolved:${JSON.stringify(source)}`,
  width: 1,
  height: 1,
  scale: 1,
}))

describe('ReferencePhotoSlot — 선택 전', () => {
  it('선택 전에는 [저장]이 비활성 상태다', async () => {
    const { getByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl={null}
        onSave={jest.fn()}
        testIDPrefix={PREFIX}
      />,
    )
    expect(getByTestId(`${PREFIX}-save`).props.accessibilityState.disabled).toBe(true)
  })

  it('저장된 사진이 없으면 "미등록" 자리표시가 뜬다', async () => {
    const { getByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl={null}
        onSave={jest.fn()}
        testIDPrefix={PREFIX}
      />,
    )
    expect(getByTestId(`${PREFIX}-preview-empty`)).toBeTruthy()
  })

  it('이미 저장된 사진이 있으면 그 미리보기를 보여준다', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl="https://example.com/signed-url"
        onSave={jest.fn()}
        testIDPrefix={PREFIX}
      />,
    )
    expect(getByTestId(`${PREFIX}-preview`).props.source).toEqual({
      uri: 'https://example.com/signed-url',
    })
    expect(queryByTestId(`${PREFIX}-preview-empty`)).toBeNull()
  })
})

describe('ReferencePhotoSlot — 선택 후 저장(완료 기준: 선택 → 미리보기 → 저장)', () => {
  it('샘플을 탭하면 선택 표시되고 [저장]이 활성화된다', async () => {
    const { getByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl={null}
        onSave={jest.fn()}
        testIDPrefix={PREFIX}
      />,
    )
    const first = REFERENCE_PHOTO_PLACEHOLDERS[0]
    await fireEvent.press(getByTestId(`${PREFIX}-placeholder-${first.key}`))
    expect(
      getByTestId(`${PREFIX}-placeholder-${first.key}`).props.accessibilityState.selected,
    ).toBe(true)
    expect(getByTestId(`${PREFIX}-save`).props.accessibilityState.disabled).toBe(false)
  })

  it('[저장]을 누르면 선택한 사진의 URI로 onSave가 호출되고, 완료 후 선택이 초기화된다', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    const { getByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl={null}
        onSave={onSave}
        testIDPrefix={PREFIX}
      />,
    )
    const first = REFERENCE_PHOTO_PLACEHOLDERS[0]
    await fireEvent.press(getByTestId(`${PREFIX}-placeholder-${first.key}`))
    await fireEvent.press(getByTestId(`${PREFIX}-save`))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(typeof onSave.mock.calls[0][0]).toBe('string')

    await waitFor(() => {
      expect(getByTestId(`${PREFIX}-save`).props.accessibilityState.disabled).toBe(true)
    })
  })

  it('onSave가 실패해도 저장 상태가 풀린다(재시도 가능)', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('업로드 실패'))
    const { getByTestId } = await render(
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="설명"
        currentPhotoUrl={null}
        onSave={onSave}
        testIDPrefix={PREFIX}
      />,
    )
    const first = REFERENCE_PHOTO_PLACEHOLDERS[0]
    await fireEvent.press(getByTestId(`${PREFIX}-placeholder-${first.key}`))
    await fireEvent.press(getByTestId(`${PREFIX}-save`))

    // 실패했으니 선택이 초기화되지 않고, 다시 저장을 시도할 수 있어야 한다.
    expect(getByTestId(`${PREFIX}-save`).props.accessibilityState.disabled).toBe(false)
  })
})

describe('ReferencePhotoSlot — locked(완료 기준: 커플 미연결 시 잠김)', () => {
  it('locked면 안내 문구만 보이고 선택/저장 UI가 없다', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ReferencePhotoSlot
        title="커플 대표사진"
        description="설명"
        currentPhotoUrl={null}
        locked
        lockedMessage="연인과 연결하면 등록할 수 있어요."
        onSave={jest.fn()}
        testIDPrefix="reference-photo-couple"
      />,
    )
    expect(getByTestId('reference-photo-couple-locked').props.children).toBe(
      '연인과 연결하면 등록할 수 있어요.',
    )
    expect(queryByTestId('reference-photo-couple-save')).toBeNull()
    expect(queryByTestId('reference-photo-couple-preview-empty')).toBeNull()
  })
})
