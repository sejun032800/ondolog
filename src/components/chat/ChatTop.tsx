/**
 * 채팅 머리(F01) - 상대 이름 · D+N · 스토리 줄 · 머리카락 선. 디자인 `N-T-Tabs` F01.
 *
 * - D+N은 KST 하나로 센 값(`computeDaysTogetherKst`)이고, 시작일을 모르면 그리지 않는다.
 * - 스토리 줄: [올리기] + 사람별 둥근 썸네일(가장 최근 스토리 사진). 상대 스토리는 orchid 고리, 내 것은 고리 없음.
 *   스토리는 24시간 보이고(만료는 서버 배치), 올리기는 "고르면 바로 올린다"(R13-11 #6) - 편집 화면 없음.
 */
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'
import { PressScale } from '../nocturne/PressScale'

export const CHAT_COPY = {
  addStory: '올리기',
  myStoryName: '나',
} as const

export function ChatHeader({ name, days }: { name: string; days: number | null }) {
  return (
    <View style={styles.header} testID="chat-header">
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {days !== null ? (
        <Text style={styles.days} testID="chat-days">{`D+${days}`}</Text>
      ) : null}
    </View>
  )
}

export interface StoryPerson {
  key: string
  /** 줄에 적는 이름. 내 것은 "나". */
  label: string
  isMine: boolean
  /** 가장 최근 스토리 사진의 서명 URL. 아직 못 받았으면 빈 면. */
  thumbUri: string | undefined
  onPress: () => void
}

export interface StoryRowProps {
  people: StoryPerson[]
  onAdd: () => void
  /** 올리는 중이면 중복으로 누르지 않게 막는다(스피너 없음 - 글자로만). */
  posting?: boolean
}

const THUMB = 58

export function StoryRow({ people, onAdd, posting }: StoryRowProps) {
  return (
    <View style={styles.storyWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyContent}
        testID="chat-story-row"
      >
        <PressScale
          onPress={onAdd}
          disabled={posting}
          accessibilityLabel="스토리 올리기"
          style={styles.person}
          testID="chat-story-add"
        >
          <View style={styles.ringPad}>
            <View style={styles.addCircle}>
              <Text style={styles.plus}>+</Text>
            </View>
          </View>
          <Text style={[styles.personLabel, styles.muted]}>{posting ? '올리는 중' : CHAT_COPY.addStory}</Text>
        </PressScale>
        {people.map((p) => (
          <PressScale
            key={p.key}
            onPress={p.onPress}
            accessibilityLabel={`${p.label}의 스토리`}
            style={styles.person}
            testID={`chat-story-${p.isMine ? 'mine' : 'partner'}`}
          >
            <View style={[styles.ringPad, p.isMine ? null : styles.ring]}>
              <View style={styles.thumb}>
                {p.thumbUri ? (
                  <Image source={{ uri: p.thumbUri }} style={styles.thumbImage} resizeMode="cover" accessibilityIgnoresInvertColors />
                ) : null}
              </View>
            </View>
            <Text style={[styles.personLabel, p.isMine ? styles.muted : styles.strong]} numberOfLines={1}>
              {p.label}
            </Text>
          </PressScale>
        ))}
      </ScrollView>
      <View style={styles.rule} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: shape.space.screen,
  },
  name: { flexShrink: 1, fontFamily: fontFamily.semiBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.52, color: nocturne.text },
  days: { marginLeft: 'auto', fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: nocturne.textMute },

  storyWrap: { marginTop: 14 },
  storyContent: { paddingHorizontal: 22, gap: 14 },
  person: { alignItems: 'center', gap: 6, minWidth: THUMB + 4 },
  ringPad: { padding: 2, borderRadius: shape.radius.pill },
  ring: { borderWidth: 1.5, borderColor: nocturne.orchid },
  addCircle: {
    width: THUMB,
    height: THUMB,
    borderRadius: shape.radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: fontFamily.regular, fontSize: 20, lineHeight: 24, color: nocturne.textSub },
  thumb: { width: THUMB, height: THUMB, borderRadius: shape.radius.pill, backgroundColor: nocturne.inkRaise2, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  personLabel: { ...type.tab, letterSpacing: 0 },
  muted: { color: nocturne.textMute },
  strong: { color: nocturne.text },
  rule: { height: StyleSheet.hairlineWidth, marginTop: 14, backgroundColor: nocturne.hairline },
})
