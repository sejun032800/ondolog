/**
 * 화면 7. 결과 랜딩(상세).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 7 —
 *   노출: ① 연애유형 라벨 + 상세 설명 ② 빅5 5축 막대그래프
 *     ③ 애니어그램 코어 설명 + 후보 2개("—일 수도 있어요")
 *     ④ 스턴버그 삼각형 ⑤ 애착 유형 설명 ⑥ (온도) 궁합 ⑦ "결과와 달라요" 버튼
 *   저장: personality_profiles 정식 생성.
 *   "결과와 달라요": 애니어그램 코어만 오버라이드, 무제한, 원본/오버라이드
 *     값 둘 다 보관.
 *
 * description_ko가 null인 유형은 문구를 지어내지 않고 그 섹션만
 * 조건부로 숨긴다(완료 기준 4).
 */
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Big5Bars } from '../../src/components/Big5Bars'
import { CompatibilitySection } from '../../src/components/CompatibilitySection'
import { Button } from '../../src/components/Button'
import { ScoreBar } from '../../src/components/ScoreBar'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { TypeLabel } from '../../src/components/TypeLabel'
import { SternbergTriangle } from '../../src/components/SternbergTriangle'
import type { EnneagramCore } from '../../src/constants/enneagram'
import { ATTACHMENT_REFRAME_KO } from '../../src/constants/attachmentDisplay'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO, LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { useTheme } from '../../src/theme'
import { useSession } from '../../src/hooks/useSession'
import {
  ensurePersonalityProfile,
  fetchLatestAssessment,
  fetchPersonalityProfile,
  overrideEnneagramCore,
} from '../../src/services/personalityApi'
import type { Database } from '../../src/types/database'
import { getEnneagramCandidates } from '../../src/utils/enneagramCandidates'
import { HARMONIC_GROUP_KO, HORNEVIAN_GROUP_KO } from '../../src/utils/enneagramGroups'

type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type ProfileRow = Database['public']['Tables']['personality_profiles']['Row']

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function ResultDetailScreen() {
  const router = useRouter()
  const { colors, typography, spacing, radius, attachmentClimate } = useTheme()
  const { session, loading: sessionLoading } = useSession()
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOverride, setShowOverride] = useState(false)
  const [overriding, setOverriding] = useState(false)

  const load = useCallback(async (userId: string) => {
    setLoading(true)
    try {
      const a = await fetchLatestAssessment(userId)
      if (!a) {
        Alert.alert('결과를 찾을 수 없어요', '이전 화면부터 다시 진행해주세요.')
        return
      }
      const p = await ensurePersonalityProfile(userId, a)
      setAssessment(a)
      setProfile(p)
    } catch (e) {
      Alert.alert('불러오기에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.replace('/')
      return
    }
    load(session.user.id)
  }, [sessionLoading, session, load, router])

  if (sessionLoading || loading || !assessment || !profile) {
    return (
      <ScreenContainer>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.inkFull} size="large" />
        </View>
      </ScreenContainer>
    )
  }

  const effectiveCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
  const label = LOVE_TYPE_LABEL_BY_CODE[profile.love_type_code]
  const climate = label ? attachmentClimate[label.attachment] : 'ember'
  const candidates = profile.enneagram_override
    ? []
    : getEnneagramCandidates(assessment.q1, profile.enneagram_inferred as EnneagramCore)
  const attachmentReframe = ATTACHMENT_REFRAME_KO[assessment.attachment]

  const handleOverride = async (core: EnneagramCore) => {
    if (!session) return
    setOverriding(true)
    try {
      const updated = await overrideEnneagramCore(session.user.id, core)
      setProfile(updated)
      setShowOverride(false)
    } catch (e) {
      Alert.alert('변경에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setOverriding(false)
    }
  }

  return (
    <ScreenContainer
      footer={<Button label="다음" onPress={() => router.push('/invite')} />}
    >
      {/* ① 연애유형 라벨 + 상세 설명 */}
      <View style={{ gap: spacing.s3 }}>
        <Text style={[typography.caption, { color: colors.inkMute }]}>
          {profile.love_type_code} · {label?.labelEn}
        </Text>
        <TypeLabel
          labelEn={label?.labelEn ?? profile.love_type_code}
          labelKo={label?.labelKo ?? profile.love_type_code}
          copyKo={label?.copyKo}
          climate={climate}
        />
        {label?.descriptionKo && (
          <Text style={[typography.bodySerif, { color: colors.inkFull }]}>{label.descriptionKo}</Text>
        )}
      </View>

      {/* ② 빅5 5축 막대그래프 */}
      <Section title="성격 5요인">
        <Big5Bars
          big5={{
            bigE: assessment.big_e,
            bigO: assessment.big_o,
            bigA: assessment.big_a,
            bigC: assessment.big_c,
            bigN: assessment.big_n,
          }}
        />
      </Section>

      {/* ③ 애니어그램 코어 설명 + 후보 2개 */}
      <Section title="애니어그램 코어">
        <Text style={[typography.headline, { color: colors.inkFull }]}>
          {effectiveCore} {ENNEAGRAM_CORE_EN[effectiveCore]} {ENNEAGRAM_CORE_KO[effectiveCore]}
        </Text>
        <Text style={[typography.caption, { color: colors.inkMute }]}>
          {HORNEVIAN_GROUP_KO[effectiveCore]} · {HARMONIC_GROUP_KO[effectiveCore]}
        </Text>
        {candidates.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {candidates.map((c) => (
              <Text key={c} style={[typography.caption, { color: colors.inkFull }]}>
                {c} {ENNEAGRAM_CORE_EN[c]} {ENNEAGRAM_CORE_KO[c]}일 수도 있어요
              </Text>
            ))}
          </View>
        )}
      </Section>

      {/* ④ 스턴버그 삼각형 */}
      <Section title="사랑의 삼각형">
        <SternbergTriangle
          sternberg={{
            intimacy: assessment.stern_intimacy,
            passion: assessment.stern_passion,
            commitment: assessment.stern_commitment,
          }}
        />
      </Section>

      {/* ⑤ 애착 유형 설명 */}
      <Section title="애착">
        {attachmentReframe && (
          <Text style={[typography.body, { color: colors.inkMute }]}>{attachmentReframe}</Text>
        )}
        <ScoreBar label="불안 축" value={assessment.attach_anxiety} />
        <ScoreBar label="회피 축" value={assessment.attach_avoidance} />
      </Section>

      {/* ⑥ 궁합 */}
      <View style={{ gap: spacing.s3 }}>
        <CompatibilitySection enneagramCore={effectiveCore} />
      </View>

      {/* ⑦ "결과와 달라요" */}
      <View style={{ gap: spacing.s3 }}>
        {!showOverride ? (
          <Button variant="secondary" label="결과와 달라요" onPress={() => setShowOverride(true)} />
        ) : (
          <View style={{ gap: spacing.s4 }}>
            <Text style={[typography.title, { color: colors.inkFull }]}>어떤 유형에 더 가까운가요?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s2 }}>
              {ALL_CORES.map((core) => {
                const isSelected = core === effectiveCore
                return (
                  <Pressable
                    key={core}
                    disabled={overriding}
                    onPress={() => handleOverride(core)}
                    style={{
                      backgroundColor: isSelected ? colors.inkFull : colors.paperAlt,
                      borderColor: colors.rule,
                      borderRadius: radius.touch,
                      borderWidth: 1,
                      paddingHorizontal: spacing.s4,
                      paddingVertical: spacing.s3,
                    }}
                  >
                    <Text style={[typography.caption, { color: isSelected ? colors.paper : colors.inkFull }]}>
                      {core} {ENNEAGRAM_CORE_EN[core]}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Button variant="secondary" label="닫기" onPress={() => setShowOverride(false)} />
          </View>
        )}
      </View>
    </ScreenContainer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme()
  return (
    <View style={{ gap: spacing.s3 }}>
      <Text style={[typography.title, { color: colors.inkFull }]}>{title}</Text>
      {children}
    </View>
  )
}
