import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme'

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
  const { colors, typography, spacing, layout, lines } = useTheme()
  const Body = scroll ? ScrollView : View

  return (
    <SafeAreaView style={{ backgroundColor: colors.paper, flex: 1 }} edges={['bottom']}>
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: scroll ? 1 : undefined,
          flex: scroll ? undefined : 1,
          gap: spacing.s5,
          paddingHorizontal: layout.pageMarginX,
          paddingTop: layout.pageTopMargin,
          paddingBottom: layout.scrollBottomPadding,
        }}
      >
        {(title || subtitle) && (
          <View style={{ gap: spacing.s2 }}>
            {title && (
              <Text style={[typography.display, { color: colors.inkFull }]}>{title}</Text>
            )}
            {subtitle && (
              <Text style={[typography.body, { color: colors.inkMute }]}>{subtitle}</Text>
            )}
          </View>
        )}
        {children}
      </Body>
      {footer && (
        <View
          style={{
            borderTopColor: colors.rule,
            borderTopWidth: lines.hairline,
            paddingHorizontal: layout.pageMarginX,
            paddingVertical: spacing.s4,
          }}
        >
          {footer}
        </View>
      )}
    </SafeAreaView>
  )
}
