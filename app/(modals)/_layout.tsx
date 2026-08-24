import { Stack } from 'expo-router'
import { COLORS } from '../../src/constants/theme'

/** Part 11-3 — 모달 그룹. 전 화면이 모달 프레젠테이션으로 뜬다. */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen name="couple-gate" options={{ title: '연인 초대' }} />
    </Stack>
  )
}
