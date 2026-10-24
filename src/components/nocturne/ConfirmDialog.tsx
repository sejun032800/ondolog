/**
 * 되돌릴 수 없는 확인(I05) - docs/design/nocturne `N-S-I-States` I05.
 * 화면 위에 어두운 막(ink .66) + 카드(inkRaise, 모서리 sheet(28)) + "지우기"(rose 글자·rose 선) + "취소".
 * 블러 없음. 열고 닫는 모션 없음.
 */
import { Modal, StyleSheet, Text, View } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, glow, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface ConfirmDialogProps {
  visible: boolean
  title: string
  message: string
  /** 되돌릴 수 없는 쪽 버튼 글자. 기본 "지우기". */
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** 확인을 누른 뒤 처리 중이면 두 버튼을 막는다. */
  busy?: boolean
  testID?: string
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = '지우기',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  busy = false,
  testID,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.dim} testID={testID}>
        <View style={[styles.card, glow.lift]} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <PressScale
              onPress={onConfirm}
              disabled={busy}
              accessibilityLabel={confirmLabel}
              testID={testID ? `${testID}-confirm` : undefined}
              style={[styles.button, styles.danger]}
            >
              <Text style={[styles.label, styles.dangerLabel, busy && styles.busyLabel]}>{confirmLabel}</Text>
            </PressScale>
            <PressScale
              onPress={onCancel}
              disabled={busy}
              accessibilityLabel={cancelLabel}
              testID={testID ? `${testID}-cancel` : undefined}
              style={[styles.button, styles.cancel]}
            >
              <Text style={[styles.label, styles.cancelLabel]}>{cancelLabel}</Text>
            </PressScale>
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
  button: { height: shape.buttonHeight, borderRadius: shape.radius.button, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: withAlpha(nocturne.text, 0.06), borderWidth: 1, borderColor: withAlpha(nocturne.rose, 0.35) },
  cancel: { backgroundColor: withAlpha(nocturne.text, 0.06) },
  label: { fontSize: 15.5 },
  dangerLabel: { fontFamily: fontFamily.medium, color: nocturne.rose },
  busyLabel: { color: nocturne.textFaint },
  cancelLabel: { fontFamily: fontFamily.medium, color: nocturne.text },
})
