/**
 * F06 사진 크게 보기 - 시트(R18-2: ✕). 디자인 `N-S-F-Chat` F06.
 *
 * - 머리: ✕ · 보낸 사람 · "10월 20일 12:34". 사진은 U3 뷰어의 핀치 줌 코드(`ZoomablePage`)를 그대로 재사용한다.
 * - 보드의 [저장]·[공유]는 넣지 않았다 - 기기에 저장·공유 하려면 새 의존성(미디어 라이브러리·공유)이 필요하다(보고).
 * - 값은 `chatViewerStore`(메모리)에서 받고, 사진은 `messages` 버킷 서명 URL로 읽는다.
 */
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ZoomablePage } from '../../src/components/magazine/ZoomablePage'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { useSignedMedia } from '../../src/hooks/useSignedMedia'
import { useChatViewerStore } from '../../src/store/chatViewerStore'
import { fontFamily, nocturne, shape } from '../../src/theme/nocturne'
import { photoStampLabel } from '../../src/utils/chatMessages'

export default function PhotoViewerModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const photo = useChatViewerStore((s) => s.photo)
  const paths = useMemo(() => (photo ? [photo.path] : []), [photo])
  const urls = useSignedMedia('messages', paths)


  const top = insets.top + 8
  const frameHeight = Math.max(0, height - top - 56 - insets.bottom - 24)

  return (
    <GestureHandlerRootView style={styles.root}>
      <View testID="photo-viewer" style={styles.root}>
        <View style={[styles.head, { top }]}>
          <PressScale onPress={() => router.back()} accessibilityLabel="닫기" style={styles.close} testID="photo-close">
            <Text style={styles.closeMark}>{'✕'}</Text>
          </PressScale>
          <View style={styles.who}>
            <Text style={styles.name} testID="photo-sender">
              {photo?.senderName ?? ''}
            </Text>
            <Text style={styles.stamp}>{photo ? photoStampLabel(photo.sentAt) : ''}</Text>
          </View>
          <View style={{ width: shape.touch }} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: top + 56 }}>
          {photo ? (
            <ZoomablePage width={width} height={frameHeight} uri={urls[photo.path]} label={`${photo.senderName}이 보낸 사진`} />
          ) : null}
        </View>
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: nocturne.ink },
  head: { position: 'absolute', left: 12, right: 12, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  closeMark: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.textSub },
  who: { alignItems: 'center' },
  name: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: nocturne.text },
  stamp: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.textMute },
})
