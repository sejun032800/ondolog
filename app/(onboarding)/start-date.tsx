/**
 * A19 사귄 날짜 + 커플 닉네임 · A20 상대가 정한 날짜 확인 (MASTER 9-1 화면 +). 디자인 `N-S-A4-Onboarding`.
 *
 * 매칭 직후 양쪽에 뜬다. 라우트는 하나(`start-date`, MASTER 11-3)이고, 열 때 커플 행을 읽어 둘 중 하나를 보인다:
 *   - 사귄 날짜가 아직 없다 -> A19: 날짜(KST 오늘까지, 미래는 고를 수 없다) + 커플 닉네임(1~20자, R13-11 #4). [시작하기]는 둘 다 맞을 때만 켜진다.
 *   - 상대가 이미 정했다(`start_date_set_by`가 내가 아니다) -> A20: 먼저 정한 값이 적용돼 있고 나는 확인만 한다([확인했어요]).
 *   - 내가 이미 정했다 -> 이 화면에서 할 일이 없다. 마무리만 하고 메인으로.
 *
 * **날짜 규칙은 기존 그대로**다(`coupleApi.setOrConfirmStartDate`: 먼저 입력한 값 적용, 상대는 확인만). 닉네임은 날짜를 정한 쪽이 쓴다
 * (`saveStartDateAndNickname`). 진행 단계 COMPLETE는 `markStartDateOnboardingComplete`(= `advanceOnboardingStep`)로만 올린다.
 * 둘이 거의 동시에 A19에서 다른 날짜를 넣으면 늦은 쪽은 확인만 되고, 그때 적용된 날짜를 A20으로 보여 준다.
 *
 * 보드와 다르게 한 곳(65- 보고): A20의 "날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요"는 넣지 않았다 - 그 설정 기능이 앱에 없다(MASTER에도 없다).
 * 날짜는 피커 대신 "YYYY.MM.DD" 입력이다(새 의존성 없음, A03 생년월일과 같은 방식).
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { useSession } from '../../src/hooks/useSession'
import {
  fetchCouple,
  markStartDateOnboardingComplete,
  saveStartDateAndNickname,
  setOrConfirmStartDate,
} from '../../src/services/coupleApi'
import { fetchProfile } from '../../src/services/personalityApi'
import { useCoupleStore } from '../../src/store/coupleStore'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../src/theme/nocturne'
import {
  formatStartDateInput,
  isValidNickname,
  nicknameLength,
  NICKNAME_MAX,
  parseStartDateInput,
  startDateIsoToInput,
  withGwa,
  withIga,
} from '../../src/utils/coupleStart'
import { computeDaysTogetherKst } from '../../src/utils/relationshipDays'

const COPY = {
  subtitle: '두 가지만 정하면 시작이에요',
  dateLabel: '사귄 날짜',
  datePlaceholder: 'YYYY.MM.DD',
  dateEmpty: '시작한 날이 1일째예요',
  dateInvalid: '오늘까지의 날짜를 입력해주세요',
  nicknameLabel: '커플 닉네임',
  nicknameHint: '메인 화면 위에 보여요',
  nicknameTooLong: `${NICKNAME_MAX}자까지 쓸 수 있어요`,
  start: '시작하기',
  confirmSubtitle: '먼저 정한 날짜로 시작해요',
  confirm: '확인했어요',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  retry: '다시 시도',
} as const

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'enter' }
  | { kind: 'confirm'; date: string; nickname: string | null }

export default function StartDateScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState('상대')
  const [dateText, setDateText] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const finishingRef = useRef(false)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  /** 마무리 - 진행 단계 COMPLETE(`advanceOnboardingStep` 경유) 뒤 메인으로. */
  const finish = async (uid: string) => {
    if (finishingRef.current) return
    finishingRef.current = true
    try {
      await markStartDateOnboardingComplete(uid)
      router.replace('/main')
    } catch {
      finishingRef.current = false
      throw new Error('finish-failed')
    }
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setPhase({ kind: 'loading' })
    ;(async () => {
      try {
        await useCoupleStore.getState().refresh(userId)
        if (cancelled) return
        const couple = useCoupleStore.getState()
        if (couple.status !== 'connected' || !couple.coupleId) {
          // 연결된 커플이 없다(해제 등) - 이 화면에서 할 일이 없다.
          router.replace('/main')
          return
        }
        setCoupleId(couple.coupleId)
        if (couple.partnerId) {
          const partner = await fetchProfile(couple.partnerId).catch(() => null)
          if (!cancelled && partner?.display_name) setPartnerName(partner.display_name)
        }
        const row = await fetchCouple(couple.coupleId)
        if (cancelled) return
        if (row.relationship_start_date && row.start_date_set_by !== userId) {
          setPhase({ kind: 'confirm', date: row.relationship_start_date, nickname: row.nickname })
          return
        }
        if (row.relationship_start_date) {
          // 내가 이미 정했다.
          await finish(userId)
          return
        }
        setPhase({ kind: 'enter' })
      } catch {
        if (!cancelled) setPhase({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
    // finish는 ref와 router만 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadKey])

  if (phase.kind === 'loading' || !session) return <ScreenFrame />

  if (phase.kind === 'error') {
    return (
      <OnboardingScreen
        title={COPY.loadFailed}
        footer={<PrimaryButton label={COPY.retry} onPress={() => setReloadKey((k) => k + 1)} testID="start-retry" />}
      />
    )
  }

  if (phase.kind === 'confirm') {
    const days = computeDaysTogetherKst(phase.date)
    const confirm = async () => {
      if (!userId || !coupleId) return
      setBusy(true)
      setError(null)
      try {
        // 기존 규칙: 이미 날짜가 있으면 확인만 기록한다(`start_date_confirmed_by`).
        await setOrConfirmStartDate(coupleId, userId, phase.date)
        await finish(userId)
      } catch {
        setError(COPY.saveFailed)
      } finally {
        setBusy(false)
      }
    }
    return (
      <OnboardingScreen
        key="confirm"
        title={`${withIga(partnerName)} 날짜를\n먼저 정했어요`}
        subtitle={COPY.confirmSubtitle}
        footer={
          <>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" testID="start-error">
                {error}
              </Text>
            ) : null}
            <PrimaryButton label={COPY.confirm} onPress={confirm} disabled={busy} testID="start-confirm" />
          </>
        }
      >
        <View style={styles.sinceCard}>
          <Text style={styles.kicker}>SINCE</Text>
          <Text style={styles.sinceDate} testID="start-since-date">
            {startDateIsoToInput(phase.date)}
          </Text>
          <Text style={styles.sinceSub} testID="start-since-sub">
            {`오늘 D+${days}${phase.nickname ? ` · ${phase.nickname}` : ''}`}
          </Text>
        </View>
      </OnboardingScreen>
    )
  }

  // A19
  const now = new Date()
  const iso = parseStartDateInput(dateText, now)
  const dateComplete = dateText.length === 10
  const nicknameOk = isValidNickname(nickname)
  const canStart = iso !== null && nicknameOk && !busy

  const dateHint =
    iso !== null
      ? `${COPY.dateEmpty} · 오늘 D+${computeDaysTogetherKst(iso, now)}`
      : dateComplete
        ? COPY.dateInvalid
        : COPY.dateEmpty

  const start = async () => {
    if (!userId || !coupleId || iso === null || !nicknameOk) return
    setBusy(true)
    setError(null)
    try {
      const row = await saveStartDateAndNickname(coupleId, userId, iso, nickname)
      if (row.start_date_set_by !== userId && row.relationship_start_date && row.relationship_start_date !== iso) {
        // 상대가 먼저 정했고 날짜가 다르다 - 적용된 날짜를 보여 주고 확인받는다.
        setPhase({ kind: 'confirm', date: row.relationship_start_date, nickname: row.nickname })
        return
      }
      await finish(userId)
    } catch {
      setError(COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingScreen
      key="enter"
      footer={
        <>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" testID="start-error">
              {error}
            </Text>
          ) : null}
          <PrimaryButton label={COPY.start} onPress={start} disabled={!canStart} testID="start-submit" />
        </>
      }
    >
      <View style={styles.circles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.circleSelf} />
        <View style={styles.circleOther} />
      </View>
      <Text style={styles.headline} testID="start-headline">
        {`${withGwa(partnerName)} 연결됐어요`}
      </Text>
      <Text style={styles.sub}>{COPY.subtitle}</Text>

      <View style={styles.group}>
        <Text style={styles.label}>{COPY.dateLabel}</Text>
        <TextInput
          value={dateText}
          onChangeText={(t) => setDateText(formatStartDateInput(t))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder={COPY.datePlaceholder}
          placeholderTextColor={nocturne.textMute}
          selectionColor={nocturne.lilac}
          style={styles.input}
          accessibilityLabel={COPY.dateLabel}
          testID="start-date-input"
        />
        <Text style={styles.hint} testID="start-date-hint">
          {dateHint}
        </Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{COPY.nicknameLabel}</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="예) 늘봄"
          placeholderTextColor={nocturne.textMute}
          selectionColor={nocturne.lilac}
          style={styles.input}
          accessibilityLabel={COPY.nicknameLabel}
          testID="start-nickname-input"
        />
        <Text style={styles.hint} testID="start-nickname-hint">
          {nicknameLength(nickname) > NICKNAME_MAX ? COPY.nicknameTooLong : COPY.nicknameHint}
        </Text>
      </View>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  circles: { flexDirection: 'row', alignSelf: 'center', marginTop: 24 },
  circleSelf: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: withAlpha(nocturne.mist, 0.6),
    borderWidth: 2,
    borderColor: nocturne.ink,
  },
  circleOther: {
    width: 52,
    height: 52,
    marginLeft: -12,
    borderRadius: 26,
    backgroundColor: withAlpha(nocturne.rose, 0.6),
    borderWidth: 2,
    borderColor: nocturne.ink,
  },
  headline: { ...type.display, color: nocturne.text, textAlign: 'center', marginTop: 28 },
  sub: { ...type.sub, color: nocturne.textSub, textAlign: 'center', marginTop: 12 },
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
  hint: { ...type.sub, color: nocturne.textMute },
  error: { ...type.sub, color: nocturne.textSub, textAlign: 'center' },
  sinceCard: {
    marginTop: 32,
    alignItems: 'center',
    gap: 14,
    paddingVertical: 28,
    borderRadius: shape.radius.card,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
  },
  kicker: { ...type.kicker, color: nocturne.textMute },
  sinceDate: { fontFamily: fontFamily.regular, fontSize: 44, lineHeight: 52, letterSpacing: -1, color: nocturne.text },
  sinceSub: { ...type.body, color: nocturne.textSub },
})
