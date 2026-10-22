/**
 * Segmented - 2-3개 보기 사이 전환. 선택 = 달빛 흰 알약.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'

export interface SegmentedOption<K extends string> {
  key: K
  label: string
}

export interface SegmentedProps<K extends string> {
  options: readonly SegmentedOption<K>[]
  value: K
  onChange: (key: K) => void
  style?: StyleProp<ViewStyle>
}

export function Segmented<K extends string>({ options, value, onChange, style }: SegmentedProps<K>) {
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.key === value
        return (
          <PressScale
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 7, bottom: 7 }}
            style={[styles.item, selected && styles.itemOn]}
          >
            <Text style={[styles.label, selected ? styles.labelOn : styles.labelOff]}>{o.label}</Text>
          </PressScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 6,
    padding: 4,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.06),
  },
  item: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: shape.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOn: { backgroundColor: nocturne.text },
  label: { fontSize: 13 },
  labelOn: { fontFamily: fontFamily.semiBold, color: nocturne.ink },
  labelOff: { fontFamily: fontFamily.medium, color: nocturne.textMute },
})
