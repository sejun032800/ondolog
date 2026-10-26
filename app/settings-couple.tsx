/**
 * H04 커플 - 설정 > 연인 · 커플 닉네임. 디자인 `N-S-H1-Settings`(H04). 푸시 화면(R18-2).
 *
 * 연결된 커플에게만 열린다 - 미연결이면 `CoupleGate`가 잠긴 문(초대하기)을 보인다(빈 화면 아님).
 * 연결 상태 카드 + 사귄 날짜 · 커플 닉네임 두 줄. 줄을 누르면 같은 화면이 입력 모습으로 바뀐다(←는 줄 목록으로 돌아온다).
 *
 * **사귄 날짜를 바꾸면 한 번의 UPDATE로 `start_date_set_by` = 나 · `start_date_confirmed_by` = null**(`updateStartDateByMe`) - 상대는 다음에 앱에
 * 들어올 때 A20 확인을 다시 본다(`useStartDateRecheck`). 날짜 규칙은 A19와 같다(실제 있는 날짜 · KST 오늘까지, 미래 불가).
 * 커플 닉네임은 1~20자. 쓰는 칸은 `couples`의 이 네 칸뿐이다(`settingsCore` 표).
 * 보드의 [연결 해제]는 `68-`이라 그리지 않는다.
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { CoupleGate } from '../src/components/CoupleGate'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { GlassCard } from '../src/components/nocturne/GlassCard'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { updateCoupleNickname, updateStartDateByMe } from '../src/services/settingsApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { nocturne, shape, type, withAlpha } from '../src/theme/nocturne'
import {
  formatStartDateInput,
  isValidNickname,
  nicknameLength,
  NICKNAME_MAX,
  parseStartDateInput,
  startDateIsoToInput,
  withGwa,
} from '../src/utils/coupleStart'
import { computeDaysTogetherKst } from '../src/utils/relationshipDays'
import { dotDate } from '../src/utils/settingsRules'

const COPY = {
  title: '커플',
  save: '저장',
  dateLabel: '사귄 날짜',
  datePlaceholder: 'YYYY.MM.DD',
  dateHint: '저장하면 상대가 다음에 앱에 들어올 때 날짜를 확인해요',
  dateInvalid: '오늘까지의 날짜를 입력해주세요',
  nicknameLabel: '커플 닉네임',
  nicknameHint: '메인 화면 위에 보여요',
  nicknameTooLong: `${NICKNAME_MAX}자까지 쓸 수 있어요`,
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
} as const

type Mode = 'view' | 'date' | 'nickname'

export default function SettingsCoupleScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const refreshCouple = useCoupleStore((s) => s.refresh)

  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [dateText, setDateText] = useState('')
  const [nicknameText, setNicknameText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  useFocusEffect(
    useCallback(() => {
      if (userId) void refreshCouple(userId)
    }, [userId, refreshCouple]),
  )

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    fetchProfile(partnerId)
      .then((p) => {
        if (!cancelled) setPartnerName(p?.display_name ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [partnerId])

  if (!session) return <ScreenFrame />

  // 다시 읽는 중(`loading`)에도 이미 있던 연결 화면을 그대로 둔다 - 저장 직후 깜빡이며 비지 않게.
  const connected = !!coupleId && (status === 'connected' || status === 'loading')
  const backToRows = () => {
    setMode('view')
    setError(null)
  }

  if (!connected) {
    return (
      <SettingsScreen title={COPY.title} onBack={() => router.back()}>
        <CoupleGate>
          <View />
        </CoupleGate>
      </SettingsScreen>
    )
  }

  // ── 입력 모습 ──
  const now = new Date()
  const dateIso = parseStartDateInput(dateText, now)
  const nicknameOk = isValidNickname(nicknameText)

  const saveDate = async () => {
    if (!userId || !coupleId || dateIso === null) return
    setBusy(true)
    setError(null)
    try {
      await updateStartDateByMe(coupleId, userId, dateIso)
      await refreshCouple(userId)
      backToRows()
    } catch {
      setError(COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const saveNickname = async () => {
    if (!userId || !coupleId || !nicknameOk) return
    setBusy(true)
    setError(null)
    try {
      await updateCoupleNickname(coupleId, nicknameText)
      await refreshCouple(userId)
      backToRows()
    } catch {
      setError(COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'date') {
    const complete = dateText.length === 10
    return (
      <SettingsScreen
        title={COPY.dateLabel}
        onBack={backToRows}
        action={{ label: COPY.save, onPress: saveDate, disabled: dateIso === null || busy, testID: 'couple-date-save' }}
      >
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
            testID="couple-date-input"
          />
          <Text style={styles.hint} testID="couple-date-hint">
            {complete && dateIso === null ? COPY.dateInvalid : COPY.dateHint}
          </Text>
        </View>
        {error ? (
          <Text style={styles.hint} accessibilityRole="alert" testID="couple-error">
            {error}
          </Text>
        ) : null}
      </SettingsScreen>
    )
  }

  if (mode === 'nickname') {
    return (
      <SettingsScreen
        title={COPY.nicknameLabel}
        onBack={backToRows}
        action={{ label: COPY.save, onPress: saveNickname, disabled: !nicknameOk || busy, testID: 'couple-nickname-save' }}
      >
        <View style={styles.group}>
          <Text style={styles.label}>{COPY.nicknameLabel}</Text>
          <TextInput
            value={nicknameText}
            onChangeText={setNicknameText}
            placeholder="예) 늘봄"
            placeholderTextColor={nocturne.textMute}
            selectionColor={nocturne.lilac}
            style={styles.input}
            accessibilityLabel={COPY.nicknameLabel}
            testID="couple-nickname-input"
          />
          <Text style={styles.hint} testID="couple-nickname-hint">
            {nicknameLength(nicknameText) > NICKNAME_MAX ? COPY.nicknameTooLong : COPY.nicknameHint}
          </Text>
        </View>
        {error ? (
          <Text style={styles.hint} accessibilityRole="alert" testID="couple-error">
            {error}
          </Text>
        ) : null}
      </SettingsScreen>
    )
  }

  // ── 줄 목록 ──
  const days = startDate ? computeDaysTogetherKst(startDate) : null
  const statusLine = partnerName ? `${withGwa(partnerName)} 연결됨` : '연결됨'
  const sinceLine = [days !== null ? `D+${days}` : null, startDate ? `${dotDate(startDate)}부터` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <SettingsScreen title={COPY.title} onBack={() => router.back()}>
      <GlassCard style={styles.card}>
        <View style={styles.circles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.circleSelf} />
          <View style={styles.circleOther} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} testID="couple-status">
            {statusLine}
          </Text>
          {sinceLine ? (
            <Text style={styles.cardSub} testID="couple-since">
              {sinceLine}
            </Text>
          ) : null}
        </View>
      </GlassCard>

      <ListGroup>
        <ListRow
          label={COPY.dateLabel}
          value={startDate ? startDateIsoToInput(startDate) : ''}
          onPress={() => {
            setDateText(startDate ? startDateIsoToInput(startDate) : '')
            setError(null)
            setMode('date')
          }}
          testID="couple-row-date"
        />
        <ListRow
          label={COPY.nicknameLabel}
          value={nickname ?? ''}
          onPress={() => {
            setNicknameText(nickname ?? '')
            setError(null)
            setMode('nickname')
          }}
          testID="couple-row-nickname"
        />
      </ListGroup>
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  circles: { flexDirection: 'row' },
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
  cardText: { flex: 1, gap: 4 },
  cardTitle: { ...type.title, color: nocturne.text },
  cardSub: { ...type.sub, color: nocturne.textSub },
  group: { gap: 10 },
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
})
