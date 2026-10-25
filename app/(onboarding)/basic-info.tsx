/**
 * A03 기본정보 - 이름 · 성별(남/여/기타) · 생년월일. 디자인 `N-S-A1-Onboarding`.
 *
 * MASTER 9-1 화면 2: 생년월일은 나이 확인용. 저장은 **메모리(sessionStore)뿐**이다(앱 종료 시 소멸이 의도된 설계) -
 * 서버·영속 저장소를 부르지 않는다. 필수값이 비면 [다음]은 비활성, 뒤로 갔다 와도 입력이 남는다(칸이 스토어에 바로 묶여 있다).
 *
 * 생년월일은 숫자만 받아 "YYYY.MM.DD"로 보여주고, 실제 있는 지난 날짜일 때만 스토어에 ISO로 넣는다(아니면 null = [다음] 비활성).
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { StepBars, OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { useSessionStore, type Gender } from '../../src/store/sessionStore'
import { fontFamily, nocturne, shape, type } from '../../src/theme/nocturne'
import { birthIsoToInput, formatBirthInput, parseBirthInput } from '../../src/utils/onboardingRules'

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: '남' },
  { value: 'female', label: '여' },
  { value: 'other', label: '기타' },
]

export default function BasicInfoScreen() {
  const router = useRouter()
  const name = useSessionStore((s) => s.name)
  const gender = useSessionStore((s) => s.gender)
  const birthDate = useSessionStore((s) => s.birthDate)
  const setName = useSessionStore((s) => s.setName)
  const setGender = useSessionStore((s) => s.setGender)
  const setBirthDate = useSessionStore((s) => s.setBirthDate)
  const [birthText, setBirthText] = useState(birthIsoToInput(birthDate))

  const canProceed = name.trim().length > 0 && gender !== null && birthDate !== null

  const onBirthChange = (raw: string) => {
    const formatted = formatBirthInput(raw)
    setBirthText(formatted)
    setBirthDate(parseBirthInput(formatted, new Date()))
  }

  return (
    <OnboardingScreen
      onBack={() => router.back()}
      headerRight={<StepBars current={1} />}
      title="먼저 알려주세요"
      subtitle="결과를 보고 가입할지 정해도 돼요. 그 전까지는 이 폰에만 머물러요."
      footer={<PrimaryButton label="다음" onPress={() => router.push('/mbti')} disabled={!canProceed} testID="basic-next" />}
    >
      <View style={styles.group}>
        <Text style={styles.label}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="이름"
          placeholderTextColor={nocturne.textMute}
          selectionColor={nocturne.lilac}
          style={styles.input}
          accessibilityLabel="이름"
          testID="basic-name"
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>성별</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => {
            const selected = gender === opt.value
            return (
              <PressScale
                key={opt.value}
                onPress={() => setGender(opt.value)}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected }}
                testID={`basic-gender-${opt.value}`}
                style={[styles.gender, selected ? styles.genderOn : styles.genderOff]}
              >
                <Text style={[styles.genderLabel, selected ? styles.genderLabelOn : styles.genderLabelOff]}>
                  {opt.label}
                </Text>
              </PressScale>
            )
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>생년월일</Text>
        <TextInput
          value={birthText}
          onChangeText={onBirthChange}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="YYYY.MM.DD"
          placeholderTextColor={nocturne.textMute}
          selectionColor={nocturne.lilac}
          style={styles.input}
          accessibilityLabel="생년월일"
          testID="basic-birth"
        />
        <Text style={styles.hint}>나이 확인에만 써요</Text>
      </View>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: 28, gap: 10 },
  label: { ...type.sub, color: nocturne.textMute },
  input: {
    ...type.body,
    fontSize: 17,
    height: 56,
    borderRadius: shape.radius.button,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
    color: nocturne.text,
    paddingHorizontal: 18,
  },
  genderRow: { flexDirection: 'row', gap: 10 },
  gender: { flex: 1, height: 56, borderRadius: shape.radius.button, alignItems: 'center', justifyContent: 'center' },
  genderOn: { backgroundColor: nocturne.text },
  genderOff: { backgroundColor: nocturne.inkRaise, borderWidth: 1, borderColor: nocturne.hairline },
  genderLabel: { fontSize: 16 },
  genderLabelOn: { fontFamily: fontFamily.semiBold, color: nocturne.ink },
  genderLabelOff: { fontFamily: fontFamily.medium, color: nocturne.textSub },
  hint: { ...type.sub, color: nocturne.textMute },
})
