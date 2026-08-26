/**
 * 스토리 스트립 — docs/ONDOLOG_DESIGN.md §13-3.
 *
 * "스토리는 상단에 원형 썸네일 대신 정사각 썸네일 + 이름을 가로 스크롤로
 * 둔다. 원형은 지면 문법이 아니다." 실제 이미지 업로드는 이번 범위 밖이라
 * 정사각 자리표시자 박스 + 이니셜/이름 텍스트로 대체한다(작업 지시
 * "완료 기준 5" 그대로).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

export interface StoryItem {
  id: string
  authorName: string
  isMine: boolean
}

interface StoryStripProps {
  stories: StoryItem[]
  onAddPress: () => void
}

const SQUARE_SIZE = 56

export function StoryStrip({ stories, onAddPress }: StoryStripProps) {
  const { colors, typography, spacing, radius } = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.s4, paddingHorizontal: spacing.s4, paddingVertical: spacing.s3 }}
    >
      <Pressable onPress={onAddPress} style={{ alignItems: 'center', gap: spacing.s1, width: SQUARE_SIZE }}>
        <View
          style={[
            styles.square,
            {
              alignItems: 'center',
              backgroundColor: colors.paperAlt,
              borderColor: colors.rule,
              borderRadius: radius.touch,
              borderWidth: 1,
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={[typography.title, { color: colors.inkMute }]}>+</Text>
        </View>
        <Text style={[typography.caption, { color: colors.inkMute }]} numberOfLines={1}>
          스토리 추가
        </Text>
      </Pressable>

      {stories.map((story) => (
        <View key={story.id} style={{ alignItems: 'center', gap: spacing.s1, width: SQUARE_SIZE }}>
          <View
            style={[
              styles.square,
              {
                alignItems: 'center',
                backgroundColor: colors.paperAlt,
                borderColor: colors.rule,
                borderRadius: radius.touch,
                borderWidth: 1,
                justifyContent: 'center',
              },
            ]}
          >
            <Text style={[typography.headline, { color: colors.inkFull }]}>
              {story.authorName.slice(0, 1)}
            </Text>
          </View>
          <Text style={[typography.caption, { color: colors.inkMute }]} numberOfLines={1}>
            {story.isMine ? '나' : story.authorName}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  square: { height: SQUARE_SIZE, width: SQUARE_SIZE },
})
