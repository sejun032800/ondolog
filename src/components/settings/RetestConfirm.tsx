/**
 * H06 재검사 확인 - 계정당 한 번이라는 것을 알리는 확인 시트. 디자인 `N-S-H1-Settings`(H06).
 * 화면 위에 어두운 막(ink .66) + 카드(inkRaise, 모서리 sheet) + 주 버튼 "다시 하기"(달빛 흰 면) + "취소". 블러 없음, 열고 닫는 모션 없음.
 * 문장은 보드 그대로다.
 */
import { Modal, StyleSheet, Text, View } from 'react-native'
import { GhostButton, PrimaryButton } from '../nocturne/Buttons'
import { fontFamily, glow, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export const RETEST_CONFIRM_COPY = {
  title: '다시 하기는 한 번뿐이에요',
  message:
    '5문항을 다시 풀면 연애 유형이 바뀔 수 있어요. 이미 발행된 호는 그대로 남아요. 한 번 쓰면 이 버튼은 다시 열리지 않아요.',
  confirm: '다시 하기',
  cancel: '취소',
} as const

export interface RetestConfirmProps {
  visible: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function RetestConfirm({ visible, onConfirm, onCancel }: RetestConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.dim} testID="retest-confirm">
        <View style={[styles.card, glow.lift]} accessibilityViewIsModal>
          <Text style={styles.title}>{RETEST_CONFIRM_COPY.title}</Text>
          <Text style={styles.message}>{RETEST_CONFIRM_COPY.message}</Text>
          <View style={styles.buttons}>
            <PrimaryButton label={RETEST_CONFIRM_COPY.confirm} onPress={onConfirm} testID="retest-confirm-yes" />
            <GhostButton label={RETEST_CONFIRM_COPY.cancel} onPress={onCancel} testID="retest-confirm-cancel" />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  dim: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: withAlpha(nocturne.ink, 0.66) },
  card: {
    borderRadius: shape.radius.sheet,
    backgroundColor: nocturne.inkRaise,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 20,
    gap: 12,
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 28, letterSpacing: -0.4, color: nocturne.text },
  message: { ...type.body, color: nocturne.textSub },
  buttons: { gap: 8, marginTop: 6 },
})
