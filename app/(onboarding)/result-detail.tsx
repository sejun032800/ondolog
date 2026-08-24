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
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Big5Bars } from '../../src/components/Big5Bars'
import { CompatibilitySection } from '../../src/components/CompatibilitySection'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScoreBar } from '../../src/components/ScoreBar'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { SecondaryButton } from '../../src/components/SecondaryButton'
import { SternbergTriangle } from '../../src/components/SternbergTriangle'
import type { EnneagramCore } from '../../src/constants/enneagram'
import { ATTACHMENT_REFRAME_KO } from '../../src/constants/attachmentDisplay'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO, LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { COLORS } from '../../src/constants/theme'
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
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </ScreenContainer>
    )
  }

  const effectiveCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
  const label = LOVE_TYPE_LABEL_BY_CODE[profile.love_type_code]
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
      footer={
        <PrimaryButton label="다음" onPress={() => router.push('/invite')} />
      }
    >
      {/* ① 연애유형 라벨 + 상세 설명 */}
      <View style={styles.section}>
        <Text style={styles.loveTypeCode}>{profile.love_type_code} · {label?.labelEn}</Text>
        <Text style={styles.labelKo}>{label?.labelKo ?? profile.love_type_code}</Text>
        {label?.copyKo && <Text style={styles.copyKo}>{label.copyKo}</Text>}
        {label?.descriptionKo && <Text style={styles.description}>{label.descriptionKo}</Text>}
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
        <Text style={styles.coreTitle}>
          {effectiveCore} {ENNEAGRAM_CORE_EN[effectiveCore]} {ENNEAGRAM_CORE_KO[effectiveCore]}
        </Text>
        <Text style={styles.coreGroup}>
          {HORNEVIAN_GROUP_KO[effectiveCore]} · {HARMONIC_GROUP_KO[effectiveCore]}
        </Text>
        {candidates.length > 0 && (
          <View style={styles.candidateBox}>
            {candidates.map((c) => (
              <Text key={c} style={styles.candidateText}>
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
        {attachmentReframe && <Text style={styles.copyKo}>{attachmentReframe}</Text>}
        <ScoreBar label="불안 축" value={assessment.attach_anxiety} />
        <ScoreBar label="회피 축" value={assessment.attach_avoidance} />
      </Section>

      {/* ⑥ 궁합 */}
      <View style={styles.section}>
        <CompatibilitySection enneagramCore={effectiveCore} />
      </View>

      {/* ⑦ "결과와 달라요" */}
      <View style={styles.section}>
        {!showOverride ? (
          <SecondaryButton label="결과와 달라요" onPress={() => setShowOverride(true)} />
        ) : (
          <View style={styles.overrideBox}>
            <Text style={styles.overrideTitle}>어떤 유형에 더 가까운가요?</Text>
            <View style={styles.overrideGrid}>
              {ALL_CORES.map((core) => (
                <Pressable
                  key={core}
                  disabled={overriding}
                  onPress={() => handleOverride(core)}
                  style={[
                    styles.overrideChip,
                    core === effectiveCore && styles.overrideChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.overrideChipText,
                      core === effectiveCore && styles.overrideChipTextSelected,
                    ]}
                  >
                    {core} {ENNEAGRAM_CORE_EN[core]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <SecondaryButton label="닫기" onPress={() => setShowOverride(false)} />
          </View>
        )}
      </View>
    </ScreenContainer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  section: { gap: 10 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  loveTypeCode: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  labelKo: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  copyKo: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22 },
  description: { color: COLORS.text, fontSize: 14, lineHeight: 21 },
  coreTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  coreGroup: { color: COLORS.textMuted, fontSize: 13 },
  candidateBox: { gap: 4, marginTop: 4 },
  candidateText: { color: COLORS.accent, fontSize: 13 },
  overrideBox: { gap: 12 },
  overrideTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  overrideGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overrideChip: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  overrideChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  overrideChipText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  overrideChipTextSelected: { color: COLORS.primaryText },
})
