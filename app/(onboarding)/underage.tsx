/**
 * A13 만 14세 미만 안내 - 가입이 막힌다(MASTER 6-3 ①). 디자인 `N-S-A2-Onboarding`.
 *
 * ①을 체크할 수 없고(표시만, 눌러지지 않는다) [동의하고 시작하기]는 늘 비활성이다. 나가는 길은 [처음으로]뿐이다 -
 * 눌러도 서버를 부르지 않고, 메모리의 답을 비운 채 처음 화면으로 간다(그래서 "정보는 저장하지 않았어요"가 맞다).
 * 안내 문구는 MASTER 6-3 ①의 원문 그대로다.
 */
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { CheckBox } from '../../src/components/onboarding/ConsentRow'
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { SoftCard } from '../../src/components/nocturne/GlassCard'
import { useSessionStore } from '../../src/store/sessionStore'
import { nocturne, shape, type } from '../../src/theme/nocturne'

export default function UnderageScreen() {
  const router = useRouter()
  const resetSession = useSessionStore((s) => s.resetSession)

  const restart = () => {
    resetSession()
    router.replace('/')
  }

  return (
    <OnboardingScreen
      onBack={() => router.back()}
      title={'시작하기 전에\n확인해주세요'}
      footer={
        <>
          <PrimaryButton label="동의하고 시작하기" disabled onPress={() => {}} testID="underage-proceed" />
          <PressScale onPress={restart} accessibilityLabel="처음으로" style={styles.restart} testID="underage-restart">
            <Text style={styles.restartLabel}>처음으로</Text>
          </PressScale>
        </>
      }
    >
      <SoftCard style={styles.card}>
        <View style={styles.row} accessible accessibilityLabel="만 14세 이상입니다, 해당하지 않아요">
          <CheckBox checked={false} disabled />
          <Text style={styles.rowLabel}>만 14세 이상입니다</Text>
        </View>
        <Text style={styles.message} testID="underage-message">만 14세 미만은 서비스를 이용할 수 없습니다</Text>
        <Text style={styles.note}>입력한 생년월일로 확인했어요. 정보는 저장하지 않았어요.</Text>
      </SoftCard>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: 32, paddingHorizontal: 20, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 36 },
  // 비활성 컨트롤(체크할 수 없는 ①)의 글자다 - textFaint가 허용된 자리.
  rowLabel: { ...type.body, fontSize: 15.5, color: nocturne.textFaint },
  message: { ...type.body, fontSize: 15.5, color: nocturne.text },
  note: { ...type.sub, color: nocturne.textMute },
  restart: { minHeight: shape.touch, alignItems: 'center', justifyContent: 'center' },
  restartLabel: { ...type.body, fontSize: 15.5, color: nocturne.mist },
})
