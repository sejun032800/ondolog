/**
 * 버튼 — docs/ONDOLOG_DESIGN.md §5-1.
 *
 * `PrimaryButton`/`SecondaryButton`(Phase 3 산출물)을 대체한다.
 *
 *   Primary   ink-full 배경 / paper 글자
 *   Secondary 투명 배경 / ink-full 테두리 1px / ink-full 글자
 *   Text      텍스트 + 밑줄, ink-full 글자
 *
 * 높이 52, radius-touch(2), title 서체(Pretendard-SemiBold). 액센트
 * 색은 쓰지 않는다(§5-1 "액센트 색을 쓰지 않는다").
 */
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { useTheme } from '../theme'

export type ButtonVariant = 'primary' | 'secondary' | 'text'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  testID?: string
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
}: ButtonProps) {
  const { colors, typography, radius } = useTheme()
  const isDisabled = disabled || loading

  if (variant === 'text') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        onPress={onPress}
        disabled={isDisabled}
        hitSlop={8}
        testID={testID}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator color={colors.inkFull} />
        ) : (
          <Text
            style={[
              typography.title,
              {
                color: colors.inkFull,
                textDecorationLine: 'underline',
                opacity: isDisabled ? 0.4 : 1,
              },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    )
  }

  const isPrimary = variant === 'primary'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { borderRadius: radius.touch },
        isPrimary
          ? { backgroundColor: colors.inkFull }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.inkFull },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.paper : colors.inkFull} />
      ) : (
        <Text
          style={[
            typography.title,
            { color: isPrimary ? colors.paper : colors.inkFull },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
})
