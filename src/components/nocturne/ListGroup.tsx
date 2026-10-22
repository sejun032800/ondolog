/**
 * ListGroup, ListRow - 라벨 / 값 / 이동은 "→" 문자(아이콘 없음). 행 높이 56.
 * 비활성 행은 글자색을 바꾸지 않고(가장 옅은 색은 글자 금지) 투명도로 낮춘다.
 */
import { Children, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface ListGroupProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

export function ListGroup({ children, style }: ListGroupProps) {
  const rows = Children.toArray(children)
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, i) => (
        <View key={i} style={i < rows.length - 1 ? styles.divided : undefined}>
          {row}
        </View>
      ))}
    </View>
  )
}

export interface ListRowProps {
  label: string
  /** 오른쪽 값. 이동 행이면 뒤에 " →"가 붙는다. */
  value?: string
  /** 있으면 2줄 행: 라벨 아래 설명(조건·제한). */
  description?: string
  /** 있으면 누를 수 있고 "→"가 붙는다. */
  onPress?: () => void
  /** 값 자리에 들어가는 컨트롤(Toggle 등). */
  control?: ReactNode
  disabled?: boolean
  testID?: string
}

export function ListRow({ label, value, description, onPress, control, disabled, testID }: ListRowProps) {
  const arrow = onPress ? ' →' : ''
  const content = (
    <View style={[styles.row, description ? styles.rowTall : null, disabled && styles.disabled]}>
      <View style={styles.main}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {control ?? (value || arrow ? <Text style={styles.value}>{`${value ?? ''}${arrow}`}</Text> : null)}
    </View>
  )
  if (onPress && !disabled) {
    return (
      <PressScale onPress={onPress} accessibilityLabel={label} testID={testID}>
        {content}
      </PressScale>
    )
  }
  return content
}

const styles = StyleSheet.create({
  group: {
    borderRadius: shape.radius.card,
    backgroundColor: nocturne.inkRaise,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(nocturne.text, 0.07),
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTall: { paddingVertical: 12 },
  main: { flex: 1, gap: 2 },
  label: { ...type.body, color: nocturne.text },
  description: { ...type.caption, fontFamily: fontFamily.regular, color: nocturne.textMute },
  value: { ...type.sub, color: nocturne.textMute },
  disabled: { opacity: 0.55 },
})
