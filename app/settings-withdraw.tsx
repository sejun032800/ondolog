/**
 * H16 회원 탈퇴 요청 - 설정 > 프로필 > [회원 탈퇴]. 디자인 `N-S-H3-Settings`(H16). 푸시 화면(R18-2).
 *
 * 무엇이 7일 뒤 지워지고 무엇이 남는지(MASTER 9-6 표) -> 발행물 PDF 저장 안내 -> 문구 직접 입력(`탈퇴합니다`, 보드 그대로) -> 탈퇴 요청 함수(`fn_request_withdrawal`) -> 로그아웃.
 * 커플이면 "연결도 함께 해제돼요"를 먼저 알린다(같은 함수가 같은 트랜잭션에서 해제도 요청한다). 문구가 틀리면 [탈퇴 요청하기]가 눌리지 않는다.
 * 요청 뒤에는 로그아웃해 시작 화면으로 간다 - 7일 안에 다시 로그인하면 `withdraw-cancel`이 가장 먼저 뜬다.
 * 보드의 "남는 것" 두 줄은 커플일 때만 사실이라(상대가 없으면 남는 기록 · 두 사람 모두 떠나는 일이 없다) 미연결에서는 그리지 않는다(보고).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput } from 'react-native'
import { PrimaryButton } from '../src/components/nocturne/Buttons'
import { SoftCard } from '../src/components/nocturne/GlassCard'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { requestWithdrawal } from '../src/services/dissolutionApi'
import { DissolutionError } from '../src/services/dissolutionCore'
import { fetchProfile } from '../src/services/personalityApi'
import { performLogout } from '../src/services/settingsApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useDissolutionStore } from '../src/store/dissolutionStore'
import { useProfileStore } from '../src/store/profileStore'
import { nocturne, shape, type } from '../src/theme/nocturne'
import { isPhraseMatch, WITHDRAW_PHRASE } from '../src/utils/dissolution'

const COPY = {
  title: '회원 탈퇴',
  heading: '탈퇴하기 전에\n확인해주세요',
  pdf: '발행된 호 PDF로 받아두기',
  coupleNote: '연결도 함께 해제돼요',
  phraseLabel: `확인을 위해 ‘${WITHDRAW_PHRASE}’를 입력해주세요`,
  phraseHint: '7일 안에는 언제든 취소할 수 있어요',
  submit: '탈퇴 요청하기',
  failed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

export default function SettingsWithdrawScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const resetCouple = useCoupleStore((s) => s.reset)
  const resetProfile = useProfileStore((s) => s.reset)
  const resetDissolution = useDissolutionStore((s) => s.reset)

  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

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

  const coupled = !!coupleId
  const name = partnerName ?? '상대'
  const matched = isPhraseMatch(phrase, WITHDRAW_PHRASE)

  const submit = async () => {
    if (!matched || busy) return
    setBusy(true)
    setError(null)
    try {
      await requestWithdrawal()
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : COPY.failed)
      setBusy(false)
      return
    }
    try {
      await performLogout(() => {
        resetCouple()
        resetProfile()
        resetDissolution()
      })
    } finally {
      router.replace('/')
    }
  }

  return (
    <SettingsScreen
      title={COPY.title}
      onBack={() => router.back()}
      footer={<PrimaryButton label={COPY.submit} onPress={submit} disabled={!matched || busy} testID="withdraw-submit" />}
    >
      <Text style={styles.heading}>{COPY.heading}</Text>
      <SoftCard style={styles.card}>
        <Text style={styles.cardTitle}>7일 뒤 지워지는 것</Text>
        <Text style={styles.line}>• 내가 올린 사진·글, 내가 보낸 대화</Text>
        <Text style={styles.line}>• 성격 프로필, 계정 정보, 대표사진</Text>
        {coupled ? (
          <>
            <Text style={styles.cardTitle}>남는 것</Text>
            <Text style={styles.line}>{`• ${name}이 올린 기록`}</Text>
            <Text style={styles.line}>• 발행된 잡지 — 두 사람 모두 떠나면 지워져요</Text>
            <Text style={styles.coupleNote} testID="withdraw-couple-note">
              {COPY.coupleNote}
            </Text>
          </>
        ) : null}
      </SoftCard>
      <ListGroup>
        <ListRow label={COPY.pdf} onPress={() => router.push('/(tabs)/magazine' as never)} testID="withdraw-pdf-row" />
      </ListGroup>

      <Text style={styles.label}>{COPY.phraseLabel}</Text>
      <TextInput
        value={phrase}
        onChangeText={setPhrase}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={nocturne.lilac}
        style={styles.input}
        accessibilityLabel={COPY.phraseLabel}
        testID="withdraw-phrase-input"
      />
      <Text style={styles.label}>{COPY.phraseHint}</Text>
      {error ? (
        <Text style={styles.label} accessibilityRole="alert" testID="withdraw-error">
          {error}
        </Text>
      ) : null}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  heading: { ...type.display, color: nocturne.text },
  card: { gap: 8 },
  cardTitle: { ...type.title, fontSize: 16, color: nocturne.text, marginTop: 4 },
  line: { ...type.body, color: nocturne.textSub },
  coupleNote: { ...type.body, color: nocturne.rose, marginTop: 8 },
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
})
