/**
 * 화면 7 "④ 스턴버그 삼각형(친밀/열정/헌신 비율 시각화)".
 *
 * `react-native-svg`가 설치돼 있지 않아(Phase 3 산출물 범위 밖의 신규
 * 네이티브 의존성) 정밀한 삼각형 도형 대신, 세 꼭짓점에 값을 배치하는
 * 방식으로 "삼각형" 구도를 표현한다. 값 자체는 엔진 산출값 그대로다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../constants/theme'
import type { SternbergScores } from '../engine/loveTypeInference'

export function SternbergTriangle({ sternberg }: { sternberg: SternbergScores }) {
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Vertex label="친밀" value={sternberg.intimacy} />
      </View>
      <View style={styles.bottomRow}>
        <Vertex label="열정" value={sternberg.passion} />
        <Vertex label="헌신" value={sternberg.commitment} />
      </View>
    </View>
  )
}

function Vertex({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.vertex}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  top: { alignItems: 'center' },
  bottomRow: { flexDirection: 'row', gap: 48 },
  vertex: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  value: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  label: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
})
