/**
 * 유형 라벨 — docs/ONDOLOG_DESIGN.md §5-4.
 *
 *   K E E L E M B E R          ← label-en, 기후색, 자간 0.22em(§11-4 label-en)
 *   온돌 같은 원칙주의자          ← headline, ink-full
 *   늘 같은 온도로 곁에 있는 사람  ← body, ink-mute
 *   ━━                         ← 기후색 1.5px, 길이 24
 *
 * 배경 틴트를 쓰지 않는다 — 밑줄 하나로 색(기후)을 표시한다. 기후색은
 * §1-4 4기후 전용 색으로, 본문·크롬에는 쓰지 않는다(이 컴포넌트가 그
 * 유일한 사용처 중 하나다).
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import type { ClimateKey } from '../theme/palette'

interface TypeLabelProps {
  /** 영문 조어 라벨, 예: "KEELEMBER". */
  labelEn: string
  /** 한글 유형명, 예: "온돌 같은 원칙주의자". */
  labelKo: string
  /** 한 줄 설명, 예: "늘 같은 온도로 곁에 있는 사람". */
  copyKo?: string | null
  climate: ClimateKey
}

export function TypeLabel({ labelEn, labelKo, copyKo, climate }: TypeLabelProps) {
  const { colors, climate: climatePalette, typography, spacing } = useTheme()
  const climateColor = climatePalette[climate]

  return (
    <View style={{ gap: spacing.s2 }}>
      <Text style={[typography.labelEn, { color: climateColor }]}>{labelEn}</Text>
      <Text style={[typography.headline, { color: colors.inkFull }]}>{labelKo}</Text>
      {copyKo ? (
        <Text style={[typography.body, { color: colors.inkMute }]}>{copyKo}</Text>
      ) : null}
      <View style={[styles.mark, { backgroundColor: climateColor }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  mark: {
    height: 1.5,
    marginTop: 4,
    width: 24,
  },
})
