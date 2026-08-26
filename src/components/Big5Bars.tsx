/**
 * 화면 7 "② 빅5 5축 막대그래프".
 * 축 이름(외향성/개방성/우호성/성실성/신경성)은 심리학 표준 용어이지
 * 이 프로젝트가 새로 지어낸 카피가 아니다.
 */
import { View } from 'react-native'
import { ScoreBar } from './ScoreBar'
import { useTheme } from '../theme'
import type { Big5Scores } from '../engine/loveTypeInference'

const AXES: Array<{ key: keyof Big5Scores; label: string }> = [
  { key: 'bigE', label: '외향성' },
  { key: 'bigO', label: '개방성' },
  { key: 'bigA', label: '우호성' },
  { key: 'bigC', label: '성실성' },
  { key: 'bigN', label: '신경성' },
]

export function Big5Bars({ big5 }: { big5: Big5Scores }) {
  const { spacing } = useTheme()
  return (
    <View style={{ gap: spacing.s3 }}>
      {AXES.map((axis) => (
        <ScoreBar key={axis.key} label={axis.label} value={big5[axis.key]} />
      ))}
    </View>
  )
}
