/**
 * 온보딩 화면 틀(U6) - Nocturne 바탕 위 머리(← · 오른쪽 표시) · 본문 · 아래 고정 영역.
 * 머리 오른쪽에는 4칸 단계 막대(`StepBars`) 또는 "2 / 4" 같은 글자를 둔다. 진행 표시는 정지 상태 그대로 그린다
 * (채움 애니메이션 금지).
 *
 * 하늘이 필요한 화면(스플래시·시작·간략 결과·로그인)은 이 틀을 쓰지 않고 `SkyBackground`를 직접 쓴다.
 */
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PushHeader } from '../nocturne/ExitHeader'
import { ScreenFrame } from '../nocturne/ScreenFrame'
import { RiseIn } from '../nocturne/RiseIn'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface StepBarsProps {
  /** 지금 칸(1부터). */
  current: number
  total?: number
}

/** 화면 머리 오른쪽의 4칸 막대. 지금 칸까지 text, 나머지는 옅게. */
export function StepBars({ current, total = 4 }: StepBarsProps) {
  return (
    <View style={styles.bars} accessible accessibilityLabel={`${total}단계 중 ${current}단계`} testID="step-bars">
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.bar, i < current ? styles.barOn : styles.barOff]} />
      ))}
    </View>
  )
}

/** 머리 오른쪽 "2 / 4" 글자. */
export function StepCounter({ current, total }: { current: number; total: number }) {
  return (
    <Text style={styles.counter} accessibilityLabel={`${total}개 중 ${current}번째`} testID="step-counter">
      {current} / {total}
    </Text>
  )
}

export interface OnboardingScreenProps {
  /** 없으면 ← 를 그리지 않는다. */
  onBack?: () => void
  /** 머리 오른쪽(StepBars 또는 StepCounter). */
  headerRight?: ReactNode
  /** 머리 바로 아래에 가로로 펼치는 막대(A07 진행 표시). */
  belowHeader?: ReactNode
  title?: string
  subtitle?: string
  children?: ReactNode
  /** 아래 고정 영역(주 버튼·링크·안내 글). */
  footer?: ReactNode
}

export function OnboardingScreen({
  onBack,
  headerRight,
  belowHeader,
  title,
  subtitle,
  children,
  footer,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets()

  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {onBack ? <PushHeader onBack={onBack} /> : <View style={styles.headerSpacer} />}
          <View style={styles.headerRight}>{headerRight}</View>
        </View>
        {belowHeader ? <View style={styles.belowHeader}>{belowHeader}</View> : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <RiseIn>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </RiseIn>
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
    justifyContent: 'space-between',
    paddingHorizontal: shape.space.screen,
  },
  headerSpacer: { height: shape.touch },
  headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
  belowHeader: { paddingHorizontal: shape.space.screen, paddingTop: 4 },
  content: { paddingHorizontal: shape.space.screen, paddingTop: 28, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, gap: 14 },
  title: { ...type.display, color: nocturne.text },
  subtitle: { ...type.sub, color: nocturne.textSub, marginTop: 12 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { width: 22, height: 2, borderRadius: 2 },
  barOn: { backgroundColor: nocturne.text },
  barOff: { backgroundColor: withAlpha(nocturne.text, 0.14) },
  counter: { fontFamily: fontFamily.medium, fontSize: 13.5, color: nocturne.textMute },
})
