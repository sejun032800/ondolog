/**
 * 최소 체크박스 — 화면 6 동의 항목용. 라이브러리 없이 PrimaryButton/
 * SecondaryButton과 같은 방식(Pressable 커스텀 스타일)으로 구현한다
 * (`@react-native-community/checkbox` 등은 신규 네이티브 의존성이라
 * 추가하지 않는다 — DateInput.tsx가 같은 이유로 택한 패턴).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

interface CheckboxProps {
  checked: boolean
  onPress: () => void
  label: string
  bold?: boolean
  /** 전문 [보기] 링크 라벨. 있으면 오른쪽에 별도 탭 영역으로 렌더링한다. */
  linkLabel?: string
  onPressLink?: () => void
  testID?: string
}

export function Checkbox({
  checked,
  onPress,
  label,
  bold = false,
  linkLabel,
  onPressLink,
  testID,
}: CheckboxProps) {
  const { colors, typography, radius } = useTheme()

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={styles.pressable}
        testID={testID}
        hitSlop={4}
      >
        <View
          style={[
            styles.box,
            { borderColor: colors.inkFull, borderRadius: radius.touch },
            checked && { backgroundColor: colors.inkFull },
          ]}
        >
          {checked && <Text style={[styles.check, { color: colors.paper }]}>✓</Text>}
        </View>
        <Text
          style={[
            bold ? typography.title : typography.body,
            { color: colors.inkFull, flexShrink: 1 },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      {linkLabel && onPressLink && (
        <Pressable
          accessibilityRole="link"
          onPress={onPressLink}
          hitSlop={8}
          testID={testID ? `${testID}-link` : undefined}
        >
          <Text
            style={[typography.caption, { color: colors.inkFull, textDecorationLine: 'underline' }]}
          >
            {linkLabel}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pressable: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  box: {
    alignItems: 'center',
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  check: { fontSize: 14 },
})
