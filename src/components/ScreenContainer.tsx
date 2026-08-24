import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS, SPACING } from '../constants/theme'

interface ScreenContainerProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  /** 하단 고정 영역(다음/제출 버튼 등). 스크롤에 밀리지 않는다. */
  footer?: React.ReactNode
  scroll?: boolean
}

export function ScreenContainer({
  title,
  subtitle,
  children,
  footer,
  scroll = true,
}: ScreenContainerProps) {
  const Body = scroll ? ScrollView : View
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Body
        style={styles.body}
        contentContainerStyle={scroll ? styles.scrollContent : styles.content}
      >
        {(title || subtitle) && (
          <View style={styles.header}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </Body>
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.bg, flex: 1 },
  body: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: SPACING.lg, padding: SPACING.lg },
  content: { flex: 1, gap: SPACING.lg, padding: SPACING.lg },
  header: { gap: SPACING.xs },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  footer: {
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: SPACING.lg,
  },
})
