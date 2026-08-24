import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { COLORS } from '../constants/theme'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.primaryText} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  text: { color: COLORS.primaryText, fontSize: 16, fontWeight: '700' },
})
