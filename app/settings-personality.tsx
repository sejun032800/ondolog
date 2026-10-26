/**
 * H05 성격 프로필 · H06 재검사 확인 - 설정 > 성격 프로필. 디자인 `N-S-H1-Settings`(H05 · H06). 푸시 화면(R18-2), 확인은 시트.
 *
 * 위에 지금 결과 카드(영문 라벨 · 한글 라벨 · MBTI · 애니어그램 코어), 아래 세 줄:
 *   - 결과 다시 보기 -> A14 · A15(`result-detail`, 설정 모드 - "다음" 없이 ←로 돌아온다)
 *   - 애니어그램 코어 고치기 -> A16(같은 라우트의 오버라이드 모습). 무제한, `love_type_code`는 R40-4대로 같은 UPDATE에서 다시 계산한다(기존 `overrideEnneagramCore`)
 *   - 5문항 다시 하기 -> H06 확인 시트 -> A04~A07(`mbti` -> `love-quiz`, `?retest=1`) -> 새 assessment 행 + 한 번의 UPDATE(`retestPersonality`). **계정당 1회** -
 *     `retest_used`가 true면 줄이 비활성(글자 textFaint)이고 누를 수 없다(`canRetest`).
 *
 * 카드의 한 줄은 `MBTI · 애니어그램 N`까지다. 보드의 애착 이름("안정형")은 MASTER 10-5-3(애착 유형 이름은 쓰지 않는다)과 어긋나 넣지 않았다.
 * 이 화면은 읽기만 한다 - 쓰기는 재검사 저장(`love-quiz`)과 오버라이드(`result-detail`)가 한다.
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { GlassCard } from '../src/components/nocturne/GlassCard'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { RetestConfirm } from '../src/components/settings/RetestConfirm'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import type { EnneagramCore } from '../src/constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '../src/constants/loveTypeLabels'
import { computeLoveTypeCode } from '../src/engine/loveTypeInference'
import { useSession } from '../src/hooks/useSession'
import { fetchPersonalityProfile } from '../src/services/personalityApi'
import { fetchAssessmentById } from '../src/services/settingsApi'
import { useSessionStore } from '../src/store/sessionStore'
import { nocturne, type } from '../src/theme/nocturne'
import { canRetest, retestRowDescription } from '../src/utils/settingsRules'
import type { Database } from '../src/types/database'

type PersonalityProfileRow = Database['public']['Tables']['personality_profiles']['Row']
type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'missing' }
  | { kind: 'ready'; profile: PersonalityProfileRow; assessment: AssessmentRow | null }

const COPY = {
  title: '성격 프로필',
  view: '결과 다시 보기',
  override: '애니어그램 코어 고치기',
  overrideDescription: '몇 번이든 바꿀 수 있어요',
  retest: '5문항 다시 하기',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  missing: '아직 결과가 없어요.',
} as const

export default function SettingsPersonalityScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  // 하위 화면(오버라이드 · 재검사)에서 돌아올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      let cancelled = false
      ;(async () => {
        try {
          const profile = await fetchPersonalityProfile(userId)
          if (cancelled) return
          if (!profile) {
            setLoad({ kind: 'missing' })
            return
          }
          const assessment = await fetchAssessmentById(profile.active_assessment_id).catch(() => null)
          if (!cancelled) setLoad({ kind: 'ready', profile, assessment })
        } catch {
          if (!cancelled) setLoad({ kind: 'error' })
        }
      })()
      return () => {
        cancelled = true
      }
    }, [userId]),
  )

  if (!session) return <ScreenFrame />

  const ready = load.kind === 'ready' ? load : null
  const profile = ready?.profile ?? null
  const retestOpen = canRetest(profile)

  const effectiveCore = profile ? ((profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore) : null
  const code = profile && effectiveCore ? computeLoveTypeCode(effectiveCore, profile.attachment) : null // 실효 코어 기준(R40-4)
  const label = code ? LOVE_TYPE_LABEL_BY_CODE[code] : undefined

  const startRetest = () => {
    setConfirmOpen(false)
    // 새 검사는 메모리(sessionStore)에서 처음부터 푼다 - 이전 답이 남아 있으면 지운다.
    useSessionStore.getState().resetSession()
    router.push('/mbti?retest=1' as never)
  }

  return (
    <SettingsScreen title={COPY.title} onBack={() => router.back()}>
      {load.kind === 'error' ? (
        <Text style={styles.note} accessibilityRole="alert" testID="personality-load-error">
          {COPY.loadFailed}
        </Text>
      ) : null}
      {load.kind === 'missing' ? (
        <Text style={styles.note} testID="personality-missing">
          {COPY.missing}
        </Text>
      ) : null}

      {profile && effectiveCore ? (
        <GlassCard style={styles.card}>
          <Text style={styles.labelEn} testID="personality-label-en">
            {label?.labelEn ?? code}
          </Text>
          <Text style={styles.labelKo} testID="personality-label-ko">
            {label?.labelKo ?? code}
          </Text>
          <Text style={styles.meta} testID="personality-meta">
            {ready?.assessment ? `${ready.assessment.mbti} · ` : ''}
            {`애니어그램 ${effectiveCore}`}
          </Text>
        </GlassCard>
      ) : null}

      {profile ? (
        <ListGroup>
          <ListRow
            label={COPY.view}
            onPress={() => router.push('/result-detail?source=settings' as never)}
            testID="personality-row-view"
          />
          <ListRow
            label={COPY.override}
            description={COPY.overrideDescription}
            onPress={() => router.push('/result-detail?source=settings&view=override' as never)}
            testID="personality-row-override"
          />
          <ListRow
            label={COPY.retest}
            description={retestRowDescription(profile)}
            onPress={() => setConfirmOpen(true)}
            disabled={!retestOpen}
            testID="personality-row-retest"
          />
        </ListGroup>
      ) : null}

      <RetestConfirm visible={confirmOpen} onConfirm={startRetest} onCancel={() => setConfirmOpen(false)} />
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  card: { gap: 6, paddingVertical: 24 },
  labelEn: { ...type.kicker, fontSize: 14, lineHeight: 20, letterSpacing: 3.4, color: nocturne.orchid },
  labelKo: { ...type.display, color: nocturne.text },
  meta: { ...type.sub, color: nocturne.textSub },
  note: { ...type.sub, color: nocturne.textSub },
})
