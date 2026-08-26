/**
 * 화면 7 "④ 스턴버그 삼각형(친밀/열정/헌신 비율 시각화)".
 *
 * 벡터 그래픽 라이브러리를 설치하지 않아(§12 "아이콘·벡터 렌더링 미사용"
 * 원칙과도 부합) 정밀한 삼각형 도형 대신, 세 꼭짓점에 값을 배치하는 방식으로
 * "삼각형" 구도를 표현한다. 값 자체는 엔진 산출값 그대로다. 꼭짓점은
 * 원(둥근 모서리)이 아니라 사각 프레임으로 그린다(§3-4 radius 0 —
 * 지면에는 둥근 모서리가 없다). 수치는 metric(세이지/샴페인), 라벨은
 * ink-mute.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import type { SternbergScores } from '../engine/loveTypeInference'

export function SternbergTriangle({ sternberg }: { sternberg: SternbergScores }) {
  const { spacing } = useTheme()
  return (
    <View style={[styles.container, { gap: spacing.s4 }]}>
      <View style={styles.top}>
        <Vertex label="친밀" value={sternberg.intimacy} />
      </View>
      <View style={[styles.bottomRow, { gap: spacing.s7 }]}>
        <Vertex label="열정" value={sternberg.passion} />
        <Vertex label="헌신" value={sternberg.commitment} />
      </View>
    </View>
  )
}

function Vertex({ label, value }: { label: string; value: number }) {
  const { colors, typography, ink } = useTheme()
  return (
    <View style={[styles.vertex, { borderColor: colors.rule }]}>
      <Text style={[typography.title, ink('metric')]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.inkMute, marginTop: 2 }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  top: { alignItems: 'center' },
  bottomRow: { flexDirection: 'row' },
  vertex: {
    alignItems: 'center',
    borderRadius: 0,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
})
