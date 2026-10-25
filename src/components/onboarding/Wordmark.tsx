/** ONDOLOG 글자표 - 점(빛) + 간격 넓은 영문. 스플래시(A01)·시작(A02)이 쓴다. */
import { StyleSheet, Text, View } from 'react-native'
import { fontFamily, nocturne, withAlpha } from '../../theme/nocturne'

export function Wordmark({ size = 17, caption }: { size?: number; caption?: string }) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel="ONDOLOG">
      <View style={styles.dot} />
      <Text style={[styles.word, { fontSize: size, letterSpacing: size * 0.46, paddingLeft: size * 0.46 }]}>
        ONDOLOG
      </Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: nocturne.text,
    boxShadow: `0 0 14px 5px ${withAlpha(nocturne.rose, 0.5)}`,
  },
  // 글자 사이를 벌리면 마지막 글자 뒤에도 간격이 붙어 가운데에서 어긋난다 - 같은 만큼 왼쪽을 채운다.
  word: { fontFamily: fontFamily.medium, color: nocturne.text },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    letterSpacing: 3.6,
    paddingLeft: 3.6,
    color: nocturne.textMute,
  },
})
