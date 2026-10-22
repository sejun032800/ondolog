/**
 * QuoteText - 두 사람의 말 그대로. 앱에서 세리프는 이것뿐이다.
 * 표시는 따옴표나 1px 선 중 하나로만(둘 다 쓰지 않는다). 이탤릭 없음.
 * variant "large"(quoteLg, MaruBuri Light 23)는 유성 카드 전용.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { nocturne, type, withAlpha } from '../../theme/nocturne'

export interface QuoteTextProps {
  children: string
  /** 따옴표로 감싸거나(quotes), 왼쪽 1px 선(rule)으로 표시한다. */
  mark?: 'quotes' | 'rule'
  variant?: 'regular' | 'large'
  /** "세준의 메모"처럼 출처 한 줄. 앞에 줄표가 붙는다. */
  attribution?: string
  style?: StyleProp<ViewStyle>
}

export function QuoteText({ children, mark = 'quotes', variant = 'regular', attribution, style }: QuoteTextProps) {
  const token = variant === 'large' ? type.quoteLg : type.quote
  const color = variant === 'large' ? nocturne.text : nocturne.textSub
  const text = mark === 'quotes' ? `“${children}”` : children

  return (
    <View style={[styles.row, style]}>
      {mark === 'rule' ? <View style={styles.rule} /> : null}
      <View style={styles.body}>
        <Text style={[token, { color }]}>{text}</Text>
        {attribution ? <Text style={styles.attribution}>{`— ${attribution}`}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  rule: { width: 1, backgroundColor: withAlpha(nocturne.text, 0.18) },
  body: { flex: 1, gap: 6 },
  attribution: { ...type.caption, color: nocturne.textMute },
})
