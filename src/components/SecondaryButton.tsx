import { Pressable, StyleSheet, Text } from 'react-native'
import { COLORS } from '../constants/theme'

interface SecondaryButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
}

export function SecondaryButton({ label, onPress, disabled = false }: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  text: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
})
