/**
 * I06 토스트 - 디자인 `N-S-I-States` I06. 하단 가운데 밝은 알약(`text` 면 + `ink` 글자) + 선택 글자 버튼("보기", lilac 계열 어두운 톤).
 * 탭 바 위에 뜬다. 시간이 지나면 저절로 사라진다(`TOAST_DURATION_MS`). 모션 없음.
 */
import { useEffect, useId } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TOAST_DURATION_MS, useToastStore } from '../../store/toastStore'
import { fontFamily, glow, nocturne, shape } from '../../theme/nocturne'
import { PressScale } from './PressScale'

export interface ToastHostProps {
  /** 탭 바 위로 띄울지(탭 · 루트 화면). 모달 층은 false. */
  aboveTabBar?: boolean
}

const ACTION_COLOR = '#5B4A9A'

export function ToastHost({ aboveTabBar = true }: ToastHostProps) {
  const insets = useSafeAreaInsets()
  const hostId = useId()
  const registerHost = useToastStore((s) => s.registerHost)
  const toast = useToastStore((s) => s.toast)
  const active = useToastStore((s) => s.hostStack[s.hostStack.length - 1] === hostId)
  const hide = useToastStore((s) => s.hide)

  useEffect(() => registerHost(hostId), [registerHost, hostId])

  const id = toast?.id
  useEffect(() => {
    if (id === undefined) return
    const timer = setTimeout(hide, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [id, hide])

  if (!toast || !active) return null
  const bottom = insets.bottom + (aboveTabBar ? shape.tabBarGap + shape.tabBarHeight + 24 : 24)
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={[styles.pill, glow.lift]} accessibilityRole="alert" testID="toast">
        <Text style={styles.message} testID="toast-message">
          {toast.message}
        </Text>
        {toast.actionLabel ? (
          <PressScale
            onPress={() => {
              hide()
              toast.onAction?.()
            }}
            accessibilityLabel={toast.actionLabel}
            hitSlop={8}
            testID="toast-action"
          >
            <Text style={styles.action}>{toast.actionLabel}</Text>
          </PressScale>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    minHeight: 44,
    maxWidth: 340,
    borderRadius: shape.radius.pill,
    backgroundColor: nocturne.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  message: { flexShrink: 1, fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 22, color: nocturne.ink },
  action: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: ACTION_COLOR },
})
