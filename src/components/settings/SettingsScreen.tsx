/**
 * 설정 하위 화면 틀(U7) - Nocturne 바탕 위 머리(← 제목, 오른쪽 글자 버튼) · 본문 · 아래 고정 영역. 푸시 화면이다(R18-2).
 * 보드(`N-S-H1-Settings`)의 머리: 왼쪽 "←", 가운데 제목, 오른쪽 "저장" 같은 글자 버튼 하나.
 * 비활성 글자 버튼은 글자색을 textFaint로 맞춘다(R20-5).
 */
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PushHeader } from '../nocturne/ExitHeader'
import { PressScale } from '../nocturne/PressScale'
import { ScreenFrame } from '../nocturne/ScreenFrame'
import { fontFamily, nocturne, shape, type } from '../../theme/nocturne'

export interface SettingsScreenProps {
  title: string
  onBack: () => void
  /** 머리 오른쪽 글자 버튼(예: 저장). */
  action?: { label: string; onPress: () => void; disabled?: boolean; testID?: string }
  children?: ReactNode
  footer?: ReactNode
}

export function SettingsScreen({ title, onBack, action, children, footer }: SettingsScreenProps) {
  const insets = useSafeAreaInsets()
  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <PushHeader onBack={onBack} title={title} style={styles.headerLeft} />
          {action ? (
            <PressScale
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityLabel={action.label}
              testID={action.testID}
              style={styles.action}
            >
              <Text style={[styles.actionLabel, action.disabled && styles.actionDisabled]}>{action.label}</Text>
            </PressScale>
          ) : null}
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: shape.space.screen,
  },
  headerLeft: { flex: 1 },
  action: { minWidth: shape.touch, height: shape.touch, alignItems: 'flex-end', justifyContent: 'center' },
  actionLabel: { ...type.body, fontFamily: fontFamily.semiBold, color: nocturne.text },
  actionDisabled: { color: nocturne.textFaint },
  content: { paddingHorizontal: shape.space.screen, paddingTop: 20, paddingBottom: 32, gap: 20 },
  footer: { paddingHorizontal: 20, gap: 14 },
})
