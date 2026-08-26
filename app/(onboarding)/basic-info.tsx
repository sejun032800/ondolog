/**
 * 화면 2. 기본정보 입력.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 2 —
 *   UI: 이름(텍스트), 성별(남/여/기타 버튼), 생년월일(날짜 피커)
 *   용도: 생년월일은 나이 확인용(사귄 일수 계산과 무관)
 *   저장: 메모리
 *   AC: 필수값 미입력 시 "다음" 비활성화, 뒤로가기 시 입력값 유지
 * docs/ONDOLOG_DESIGN.md §13-7 화면 2 — "지면 헤더 없음. display 질문 +
 * 입력 필드." 네이티브 Stack 헤더(작은 타이틀)는 유지하되, 본문에는
 * `<PageHeader>`(지면 헤더)를 두지 않는다 — 화면 2만의 예외.
 *
 * "뒤로가기 시 입력값 유지"는 필드를 sessionStore(zustand, 메모리)에
 * 직접 바인딩해 만족한다 — 화면이 언마운트돼도 스토어는 앱이 살아있는
 * 동안 값을 들고 있다(앱 종료 시에는 의도적으로 소멸한다).
 */
import { useRouter } from 'expo-router'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Button } from '../../src/components/Button'
import { DateInput } from '../../src/components/DateInput'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useTheme } from '../../src/theme'
import { useSessionStore, type Gender } from '../../src/store/sessionStore'

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: '남' },
  { value: 'female', label: '여' },
  { value: 'other', label: '기타' },
]

export default function BasicInfoScreen() {
  const router = useRouter()
  const { colors, typography, spacing, radius } = useTheme()
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
        <Button label="다음" onPress={() => router.push('/mbti')} disabled={!canProceed} />
      }
    >
      <View style={{ gap: spacing.s2 }}>
        <Text style={[typography.title, { color: colors.inkFull }]}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="이름을 입력해주세요"
          placeholderTextColor={colors.inkFaint}
          style={[
            typography.body,
            {
              backgroundColor: colors.paperAlt,
              borderColor: colors.rule,
              borderRadius: radius.touch,
              borderWidth: 1,
              color: colors.inkFull,
              paddingHorizontal: spacing.s4,
              paddingVertical: spacing.s3,
            },
          ]}
          maxLength={20}
        />
      </View>

      <View style={{ gap: spacing.s2 }}>
        <Text style={[typography.title, { color: colors.inkFull }]}>성별</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s3 }}>
          {GENDER_OPTIONS.map((opt) => {
            const selected = gender === opt.value
            return (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value)}
                style={{
                  alignItems: 'center',
                  backgroundColor: selected ? colors.inkFull : colors.paperAlt,
                  borderColor: colors.rule,
                  borderRadius: radius.touch,
                  borderWidth: 1,
                  flex: 1,
                  paddingVertical: spacing.s4,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[typography.title, { color: selected ? colors.paper : colors.inkFull }]}>
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={{ gap: spacing.s2 }}>
        <Text style={[typography.title, { color: colors.inkFull }]}>생년월일</Text>
        <Text style={[typography.caption, { color: colors.inkMute, marginTop: -4 }]}>
          나이 확인용이에요. 사귄 날짜와는 별개예요.
        </Text>
        <DateInput value={birthDate} onChange={setBirthDate} />
      </View>
    </ScreenContainer>
  )
}
