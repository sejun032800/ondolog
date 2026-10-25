/**
 * ChoiceCard - 온보딩의 고르는 카드(MBTI 알아요/몰라요 A04, 간이 질문 A06, 연애유형 문항 A07).
 * 고른 카드는 inkRaise2 면 + 밝은 테두리, 안 고른 카드는 inkRaise 면 + 머리카락 선.
 * `letter`가 있으면 A07처럼 왼쪽에 A·B·C를 둔다. 정답 표시는 없다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface ChoiceCardProps {
  label: string
  sub?: string
  letter?: string
  selected: boolean
  onPress: () => void
  testID?: string
}

export function ChoiceCard({ label, sub, letter, selected, onPress, testID }: ChoiceCardProps) {
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[styles.card, selected ? styles.cardOn : styles.cardOff]}
    >
      {letter ? <Text style={styles.letter}>{letter}</Text> : null}
      <View style={styles.texts}>
        <Text style={sub ? styles.title : styles.titleOnly}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    minHeight: 62,
    borderRadius: shape.radius.card,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  cardOn: { backgroundColor: nocturne.inkRaise2, borderColor: withAlpha(nocturne.text, 0.55) },
  cardOff: { backgroundColor: nocturne.inkRaise, borderColor: nocturne.hairline },
  letter: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: nocturne.textMute, width: 14 },
  texts: { flex: 1, gap: 4 },
  title: { ...type.title, fontSize: 17, color: nocturne.text },
  titleOnly: { ...type.body, fontFamily: fontFamily.medium, color: nocturne.text },
  sub: { ...type.sub, color: nocturne.textMute },
})
