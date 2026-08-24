/**
 * 화면 2. 기본정보 입력.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 2 —
 *   UI: 이름(텍스트), 성별(남/여/기타 버튼), 생년월일(날짜 피커)
 *   용도: 생년월일은 나이 확인용(사귄 일수 계산과 무관)
 *   저장: 메모리
 *   AC: 필수값 미입력 시 "다음" 비활성화, 뒤로가기 시 입력값 유지
 *
 * "뒤로가기 시 입력값 유지"는 필드를 sessionStore(zustand, 메모리)에
 * 직접 바인딩해 만족한다 — 화면이 언마운트돼도 스토어는 앱이 살아있는
 * 동안 값을 들고 있다(앱 종료 시에는 의도적으로 소멸한다).
 */
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { DateInput } from '../../src/components/DateInput'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { COLORS } from '../../src/constants/theme'
import { useSessionStore, type Gender } from '../../src/store/sessionStore'

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

  const canProceed = name.trim().length > 0 && gender !== null && birthDate !== null

  return (
    <ScreenContainer
      title="반가워요"
      subtitle="온돌로그를 시작하기 전, 몇 가지만 알려주세요."
      footer={
        <PrimaryButton
          label="다음"
          onPress={() => router.push('/mbti')}
          disabled={!canProceed}
        />
      }
    >
      <View style={styles.field}>
        <Text style={styles.label}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="이름을 입력해주세요"
          placeholderTextColor={COLORS.textMuted}
          style={styles.textInput}
          maxLength={20}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>성별</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setGender(opt.value)}
              style={[
                styles.genderButton,
                gender === opt.value && styles.genderButtonSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: gender === opt.value }}
            >
              <Text
                style={[
                  styles.genderText,
                  gender === opt.value && styles.genderTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>생년월일</Text>
        <Text style={styles.hint}>나이 확인용이에요. 사귄 날짜와는 별개예요.</Text>
        <DateInput value={birthDate} onChange={setBirthDate} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: -4 },
  textInput: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderButton: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  genderButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  genderTextSelected: { color: COLORS.primaryText },
})
