/**
 * 업로드 버튼(FAB, 56 원). 누르면 E11 기록 쓰기 시트로 간다.
 * 비활성(기록할 커플 행이 없을 때, 규칙 6)이면 글자색을 textFaint로 맞춘다(R20-5) - 이유는 화면의 배너가 글로 적는다.
 */
import { StyleSheet, Text } from 'react-native'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, glow, nocturne, withAlpha } from '../../theme/nocturne'

export interface AddFabProps {
  onPress: () => void
  disabled?: boolean
}

export function AddFab({ onPress, disabled }: AddFabProps) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="데이트 기록하기"
      testID="feed-add-fab"
      style={[styles.fab, disabled ? styles.off : styles.on]}
    >
      <Text style={[styles.plus, disabled ? styles.plusOff : styles.plusOn]}>+</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: nocturne.text, ...glow.lift },
  off: { backgroundColor: withAlpha(nocturne.text, 0.06) },
  plus: { fontFamily: fontFamily.regular, fontSize: 26, lineHeight: 30 },
  plusOn: { color: nocturne.ink },
  plusOff: { color: nocturne.textFaint },
})
