/**
 * A14 · A15 상세 결과 + A16 결과와 달라요 (MASTER 9-1 화면 7). 디자인 `N-S-A3-Onboarding`.
 *
 * 라우트는 하나(`result-detail`, MASTER 11-3)이고 A16은 같은 화면의 다른 모습이다(← 로 돌아온다).
 *   A14 · A15: ① 라벨 + 설명 ② 빅5 ③ 애니어그램 코어 + 후보 2개 ④ 스턴버그 ⑤ 애착 ⑥ best / contrast 궁합 + **고정 문장** ⑦ "결과와 달라요".
 *   값은 서버에 저장된 결과 그대로다(결정론) - 화면은 계산하지 않는다.
 *   A16: 애니어그램 9유형에서 고른다. **코어만 바뀐다**(`enneagram_override`만 쓰고 추론값 · 빅5 · 스턴버그 · 애착은 그대로). 횟수 제한 없음.
 *
 * 보드와 다르게 한 곳(65- 보고): 고정 문장은 MASTER 문장 그대로(`resultDetailCopy.ts`) · 애착 유형 이름("안정형" 등)은 쓰지 않는다(MASTER 10-5-3) ·
 * ⑤ 애착 묶음을 보드에 없지만 둔다(MASTER 화면 7) · 공유 버튼은 없다(A09 공유 카드는 M3-6) · A16 부제는 스턴버그까지 적는다(MASTER).
 *
 * **설정 모드(`?source=settings`, `67-`)**: 설정 > 성격 프로필(H05)이 같은 화면을 다시 연다 - `?view=override`면 A16부터 시작한다. 읽기만 하고(프로필 행을 만들지 않는다),
 * 지금 쓰고 있는 검사(재검사 뒤에는 새 행)를 보인다. "다음"(초대로 가는 버튼)은 없고 ←로 H05에 돌아온다. 오버라이드 저장 규칙은 그대로다(`overrideEnneagramCore`).
 *
 * 진행 단계(`onboarding_step`)는 이 화면이 직접 쓰지 않는다 - 프로필 행을 처음 만들 때 `ensurePersonalityProfile`가 `advanceOnboardingStep`으로 올린다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import {
  AttachmentCard,
  Big5Card,
  CompatibilityCards,
  EnneagramCard,
  SternbergCard,
} from '../../src/components/onboarding/ResultSections'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { SoftCard } from '../../src/components/nocturne/GlassCard'
import type { EnneagramCore } from '../../src/constants/enneagram'
import { computeLoveTypeCode } from '../../src/engine/loveTypeInference'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO, LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { COMPATIBILITY_START_TEMPERATURE_NOTICE } from '../../src/constants/resultDetailCopy'
import { useResultDetail } from '../../src/hooks/useResultDetail'
import { useSession } from '../../src/hooks/useSession'
import { fontFamily, nocturne, type, withAlpha } from '../../src/theme/nocturne'
import { getEnneagramCandidates } from '../../src/utils/enneagramCandidates'

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function ResultDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ source?: string; view?: string }>()
  const fromSettings = params?.source === 'settings'
  const startsInOverride = fromSettings && params?.view === 'override'
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const { state, reload, override } = useResultDetail(userId, fromSettings ? 'settings' : 'onboarding')
  const [view, setView] = useState<'detail' | 'override'>(startsInOverride ? 'override' : 'detail')
  const [picked, setPicked] = useState<EnneagramCore | null>(null)
  const [saving, setSaving] = useState(false)
  const [overrideError, setOverrideError] = useState(false)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  if (state.status === 'loading' || !session) {
    return <ScreenFrame />
  }

  if (state.status === 'missing' || state.status === 'error') {
    const missing = state.status === 'missing'
    return (
      <OnboardingScreen
        onBack={fromSettings ? () => router.back() : undefined}
        title={missing ? '결과를 찾을 수 없어요' : '결과를 불러오지 못했어요'}
        subtitle={missing ? (fromSettings ? '아직 저장된 결과가 없어요.' : '처음부터 다시 진행해주세요.') : '잠시 뒤에 다시 시도해주세요.'}
        footer={
          missing && fromSettings ? undefined : missing ? (
            <PrimaryButton label="처음부터 다시" onPress={() => router.replace('/basic-info')} testID="detail-restart" />
          ) : (
            <PrimaryButton label="다시 시도" onPress={reload} testID="detail-retry" />
          )
        }
      />
    )
  }

  const { assessment, profile } = state
  const effectiveCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
  const loveTypeCode = computeLoveTypeCode(effectiveCore, profile.attachment) // 실효 코어 기준(R40-4)
  const label = LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]
  const candidates = profile.enneagram_override
    ? []
    : getEnneagramCandidates(assessment.q1, profile.enneagram_inferred as EnneagramCore)

  if (view === 'override') {
    const selected = picked ?? effectiveCore
    const confirm = async () => {
      if (selected === effectiveCore) {
        setView('detail')
        return
      }
      setSaving(true)
      setOverrideError(false)
      const ok = await override(selected)
      setSaving(false)
      if (!ok) setOverrideError(true)
      else if (startsInOverride) router.back() // 설정에서 곧바로 연 길 - 저장하면 H05로 돌아간다.
      else setView('detail')
    }
    return (
      <OnboardingScreen
        key="override"
        onBack={() => {
          setPicked(null)
          setOverrideError(false)
          if (startsInOverride) router.back()
          else setView('detail')
        }}
        title={'나에게 더 가까운\n코어를 골라주세요'}
        subtitle="코어만 바뀌어요. 빅5 · 스턴버그 · 애착 결과는 그대로예요."
        footer={
          <>
            {overrideError ? (
              <Text style={styles.error} accessibilityRole="alert" testID="override-error">
                저장하지 못했어요. 다시 시도해주세요.
              </Text>
            ) : null}
            <PrimaryButton label="이 코어로 할게요" onPress={confirm} disabled={saving} testID="override-confirm" />
          </>
        }
      >
        <SoftCard style={styles.coreList}>
          {ALL_CORES.map((core, i) => {
            const on = core === selected
            return (
              <PressScale
                key={core}
                onPress={() => setPicked(core)}
                accessibilityRole="radio"
                accessibilityLabel={`${core} ${ENNEAGRAM_CORE_EN[core]} ${ENNEAGRAM_CORE_KO[core]}`}
                accessibilityState={{ selected: on }}
                testID={`core-${core}`}
                style={[styles.coreRow, i > 0 && styles.coreRowRule]}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <Text style={styles.coreName}>
                  {core} {'·'} {ENNEAGRAM_CORE_EN[core]} {ENNEAGRAM_CORE_KO[core]}
                </Text>
                {core === effectiveCore ? <Text style={styles.nowMark}>지금 결과</Text> : null}
              </PressScale>
            )
          })}
        </SoftCard>
      </OnboardingScreen>
    )
  }

  const description = label?.descriptionKo ?? label?.copyKo ?? null

  return (
    <OnboardingScreen
      key="detail"
      onBack={fromSettings ? () => router.back() : undefined}
      footer={
        <>
          {/* MASTER 9-1 화면 7 ⑥ 하단 고정 문장 - 글자 그대로. 단정하는 문장은 두지 않는다. */}
          <Text style={styles.notice} testID="compatibility-start-notice">
            {COMPATIBILITY_START_TEMPERATURE_NOTICE}
          </Text>
          {fromSettings ? null : <PrimaryButton label="다음" onPress={() => router.push('/invite')} testID="detail-next" />}
        </>
      }
    >
      <View style={styles.head}>
        <Text style={styles.labelEn} testID="detail-label-en">
          {label?.labelEn ?? loveTypeCode}
        </Text>
        <Text style={styles.labelKo} testID="detail-label-ko">
          {label?.labelKo ?? loveTypeCode}
        </Text>
        <Text style={styles.meta} testID="detail-meta">
          {assessment.mbti} {'·'} 애니어그램 {effectiveCore}
        </Text>
        {description ? (
          <Text style={styles.description} testID="detail-description">
            {description}
          </Text>
        ) : null}
      </View>

      <Big5Card
        big5={{
          bigE: assessment.big_e,
          bigO: assessment.big_o,
          bigA: assessment.big_a,
          bigC: assessment.big_c,
          bigN: assessment.big_n,
        }}
      />
      <SternbergCard
        sternberg={{
          intimacy: assessment.stern_intimacy,
          passion: assessment.stern_passion,
          commitment: assessment.stern_commitment,
        }}
      />
      <AttachmentCard
        attachment={assessment.attachment}
        anxiety={assessment.attach_anxiety}
        avoidance={assessment.attach_avoidance}
      />
      <EnneagramCard
        core={effectiveCore}
        candidates={candidates}
        onMismatch={() => {
          setPicked(effectiveCore)
          setView('override')
        }}
      />
      <CompatibilityCards core={effectiveCore} />
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  head: { gap: 8, paddingTop: 8 },
  labelEn: { ...type.kicker, fontSize: 14, lineHeight: 20, letterSpacing: 3.4, color: nocturne.orchid },
  labelKo: { ...type.display, color: nocturne.text },
  meta: { ...type.sub, color: nocturne.textSub },
  description: { ...type.body, color: nocturne.textSub, marginTop: 12 },
  notice: { ...type.sub, color: nocturne.textMute, textAlign: 'center' },
  error: { ...type.sub, color: nocturne.textSub, textAlign: 'center' },
  coreList: { marginTop: 28, paddingVertical: 8, paddingHorizontal: 22 },
  coreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 },
  coreRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: nocturne.hairline },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: withAlpha(nocturne.text, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: nocturne.text, borderColor: nocturne.text },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: nocturne.ink },
  coreName: { ...type.body, flex: 1, color: nocturne.text },
  nowMark: { ...type.sub, color: nocturne.textMute, fontFamily: fontFamily.regular },
})
