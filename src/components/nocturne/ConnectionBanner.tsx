/**
 * I02 연결 끊김 띠 - 디자인 `N-S-H4-Settings` I02. 화면 위쪽 둥근 알약 한 줄(점 + "연결이 끊겼어요 · 마지막으로 받은 내용이에요").
 * 정지 점 - 스피너 없음. 눌리지 않는다(`pointerEvents none`).
 *
 * **채팅의 큐 문장과 겹치지 않는다**: 채팅은 보낼 것이 남아 있을 때 자기 문장(F05 "연결이 끊겼어요. 다시 연결되면 이어서 보내요")을 이미 보인다.
 * **채팅 화면에서**(`inChat`) 보낼 것이 남은 동안(글 · 사진 큐에 대기 항목이 있는 동안)에는 이 띠를 그리지 않는다. 다른 탭에서는 큐와 관계없이 끊김을 보인다(`72b-`) - 그 쪽이 "보낼 것"을 말하고, 이 띠는 "받은 것"을 말한다.
 * 끊김 판정은 `connectionMonitor`(감싼 fetch의 거부), 풀기는 `useOfflineProbe`다.
 */
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { chatQueueHub } from '../../services/chatQueueHub'
import { useConnectionStore } from '../../services/connectionMonitor'
import { useOfflineProbe } from '../../hooks/useOfflineProbe'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'

export const CONNECTION_COPY = {
  offline: '연결이 끊겼어요 · 마지막으로 받은 내용이에요',
} as const

/** 채팅 큐에 자동 재시도 중인 항목이 있는가(있으면 채팅의 F05 문장이 말한다). */
export function useChatQueueWaiting(): boolean {
  const [text, setText] = useState(false)
  const [photo, setPhoto] = useState(false)
  useEffect(
    () =>
      chatQueueHub.subscribe({
        onTextQueue: (queue) => setText(queue.some((item) => item.status === 'pending')),
        onPhotoQueue: (items) => setPhoto(items.some((item) => item.status === 'pending')),
      }),
    [],
  )
  return text || photo
}

export function ConnectionBanner({ inChat = false }: { inChat?: boolean }) {
  useOfflineProbe()
  const insets = useSafeAreaInsets()
  const offline = useConnectionStore((s) => s.offline)
  const queueWaiting = useChatQueueWaiting()
  if (!offline || (inChat && queueWaiting)) return null
  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[styles.pill, { top: insets.top + 8 }]}
      testID="connection-banner"
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{CONNECTION_COPY.offline}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 44,
    borderRadius: shape.radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.1),
    backgroundColor: withAlpha(nocturne.inkRaise, 0.92),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: nocturne.textMute },
  text: { fontFamily: fontFamily.regular, fontSize: 13.5, lineHeight: 20, color: nocturne.textSub },
})
