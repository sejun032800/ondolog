/**
 * F03 스토리 보기 - 시트(R18-2: ✕). 디자인 `N-S-F-Chat` F03.
 *
 * - 한 사람의 스토리(24시간 안)를 오래된 것부터 한 장씩. 오른쪽 절반을 누르면 다음, 왼쪽 절반은 이전, 마지막 다음은 닫기.
 * - 위 막대는 정지 표시(지금 · 지난 것은 밝게). **진행률이 차오르는 자동 넘김은 없다**(금지 모션).
 * - 올리기는 "고르면 바로 올린다"(R13-11 #6)라 이 화면에 편집·캡션이 없다.
 * - 값은 `chatViewerStore`(메모리)에서 받고, 사진은 `stories` 버킷 서명 URL로 읽는다.
 */
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { useSignedMedia } from '../../src/hooks/useSignedMedia'
import { useChatViewerStore } from '../../src/store/chatViewerStore'
import { fontFamily, nocturne, shape, withAlpha } from '../../src/theme/nocturne'
import { relativeAgeLabel } from '../../src/utils/chatMessages'

const SCRIM = `linear-gradient(180deg, ${withAlpha(nocturne.ink, 0.55)} 0%, ${withAlpha(nocturne.ink, 0)} 25%, ${withAlpha(
  nocturne.ink,
  0,
)} 70%, ${withAlpha(nocturne.ink, 0.7)} 100%)`

export default function StoryViewerModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const story = useChatViewerStore((s) => s.story)
  const [index, setIndex] = useState(0)

  const paths = useMemo(() => (story ? story.items.map((i) => i.path) : []), [story])
  const urls = useSignedMedia('stories', paths)

  const close = () => {
    router.back()
  }

  if (!story || story.items.length === 0) {
    return (
      <View style={styles.root} testID="story-empty">
        <Pressable style={styles.closeCorner} onPress={close} accessibilityRole="button" accessibilityLabel="닫기">
          <Text style={styles.closeMark}>{'✕'}</Text>
        </Pressable>
      </View>
    )
  }

  const item = story.items[Math.min(index, story.items.length - 1)]
  const uri = urls[item.path]
  const last = index >= story.items.length - 1
  const next = () => (last ? close() : setIndex((i) => i + 1))
  const prev = () => setIndex((i) => Math.max(0, i - 1))

  return (
    <View style={styles.root} testID="story-viewer">
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: SCRIM }]} />
      <View style={styles.tapRow}>
        <Pressable style={styles.tapHalf} onPress={prev} accessibilityRole="button" accessibilityLabel="이전 스토리" testID="story-prev" />
        <Pressable style={styles.tapHalf} onPress={next} accessibilityRole="button" accessibilityLabel="다음 스토리" testID="story-next" />
      </View>

      <View style={[styles.segments, { top: insets.top + 8 }]} pointerEvents="none" testID="story-segments">
        {story.items.map((it, i) => (
          <View key={it.id} style={[styles.segment, i <= index ? styles.segmentOn : styles.segmentOff]} />
        ))}
      </View>
      <View style={[styles.who, { top: insets.top + 22 }]}>
        <View style={styles.avatar}>
          {uri ? <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        </View>
        <Text style={styles.name} testID="story-author">
          {story.authorName}
        </Text>
        <Text style={styles.age}>{relativeAgeLabel(item.createdAt, new Date())}</Text>
        <PressScale onPress={close} accessibilityLabel="닫기" style={styles.close} testID="story-close">
          <Text style={styles.closeMark}>{'✕'}</Text>
        </PressScale>
      </View>
      <Text style={[styles.foot, { bottom: insets.bottom + 44 }]}>스토리는 24시간 동안 보여요</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: nocturne.ink },
  tapRow: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  tapHalf: { flex: 1 },
  segments: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 2, borderRadius: 2 },
  segmentOn: { backgroundColor: nocturne.text },
  segmentOff: { backgroundColor: withAlpha(nocturne.text, 0.25) },
  who: { position: 'absolute', left: 16, right: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: shape.radius.pill,
    borderWidth: 1.5,
    borderColor: nocturne.text,
    backgroundColor: nocturne.inkRaise2,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  name: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: nocturne.text },
  age: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.textSub },
  close: { marginLeft: 'auto', width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  closeCorner: { position: 'absolute', top: 56, right: 8, width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  closeMark: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.text },
  foot: { position: 'absolute', left: 24, right: 24, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.textSub },
})
