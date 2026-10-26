/**
 * H14 연결 해제 요청 - 설정 > 커플 > [연결 해제]. 디자인 `N-S-H3-Settings`(H14 유예 화면) · `N-S-H1-Settings`(H04 힌트 문장). 푸시 화면(R18-2).
 *
 * 다단계 확인(MASTER 9-6 안전장치): 1) 안내 - 무엇이 지워지고 무엇이 남는지 + 발행물 PDF 저장 안내 -> 2) 문구 직접 입력(`연결 해제합니다`) -> 요청 함수(`fn_request_dissolution`).
 * 문구가 틀리면 [해제 요청하기]가 눌리지 않는다. 요청이 끝나면 커플 화면으로 돌아가고, 그 화면이 유예 화면으로 바뀐다.
 * 이 화면은 서버를 직접 쓰지 않는다 - 함수 호출 하나뿐이다. 보드에 1) 2)단계 화면이 없어 문장은 H04 힌트 · H14 · H16 보드 문장을 따랐다(보고).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { CoupleGate } from '../src/components/CoupleGate'
import { PrimaryButton } from '../src/components/nocturne/Buttons'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { SoftCard } from '../src/components/nocturne/GlassCard'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { requestDissolution } from '../src/services/dissolutionApi'
import { DissolutionError } from '../src/services/dissolutionCore'
import { fetchProfile } from '../src/services/personalityApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useDissolutionStore } from '../src/store/dissolutionStore'
import { nocturne, shape, type } from '../src/theme/nocturne'
import { isPhraseMatch, UNLINK_PHRASE } from '../src/utils/dissolution'

const COPY = {
  title: '연결 해제',
  heading: '연결을 해제하기 전에\n확인해주세요',
  pdf: '발행된 호 PDF로 받아두기',
  next: '계속',
  phraseLabel: `확인을 위해 ‘${UNLINK_PHRASE}’를 입력해주세요`,
  phraseHint: '7일 안에는 언제든 취소할 수 있어요',
  submit: '해제 요청하기',
  failed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

type Step = 'notice' | 'phrase'

export default function SettingsUnlinkScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const refreshCouple = useCoupleStore((s) => s.refresh)
  const refreshDissolution = useDissolutionStore((s) => s.refresh)

  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('notice')
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

  const connected = !!coupleId && (status === 'connected' || status === 'loading')
  if (!connected) {
    return (
      <SettingsScreen title={COPY.title} onBack={() => router.back()}>
        <CoupleGate>
          <View />
        </CoupleGate>
      </SettingsScreen>
    )
  }

  const name = partnerName ?? '상대'
  const matched = isPhraseMatch(phrase, UNLINK_PHRASE)

  const submit = async () => {
    if (!userId || !matched || busy) return
    setBusy(true)
    setError(null)
    try {
      await requestDissolution()
      await Promise.all([refreshDissolution(userId), refreshCouple(userId)])
      router.back()
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : COPY.failed)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'notice') {
    return (
      <SettingsScreen
        title={COPY.title}
        onBack={() => router.back()}
        footer={<PrimaryButton label={COPY.next} onPress={() => setStep('phrase')} testID="unlink-next" />}
      >
        <Text style={styles.heading}>{COPY.heading}</Text>
        <SoftCard style={styles.card}>
          <Text style={styles.cardTitle}>7일 뒤 지워지는 것</Text>
          <Text style={styles.line}>• 내가 올린 사진·글, 내가 보낸 대화</Text>
          <Text style={styles.cardTitle}>남는 것</Text>
          <Text style={styles.line}>{`• ${name}이 올린 기록`}</Text>
          <Text style={styles.line}>• 발행된 잡지는 한쪽이 남아 있으면 보존돼요</Text>
        </SoftCard>
        <ListGroup>
          <ListRow label={COPY.pdf} onPress={() => router.push('/(tabs)/magazine' as never)} testID="unlink-pdf-row" />
        </ListGroup>
      </SettingsScreen>
    )
  }

  return (
    <SettingsScreen
      title={COPY.title}
      onBack={() => {
        setStep('notice')
        setError(null)
      }}
      footer={<PrimaryButton label={COPY.submit} onPress={submit} disabled={!matched || busy} testID="unlink-submit" />}
    >
      <Text style={styles.label}>{COPY.phraseLabel}</Text>
      <TextInput
        value={phrase}
        onChangeText={setPhrase}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={nocturne.lilac}
        style={styles.input}
        accessibilityLabel={COPY.phraseLabel}
        testID="unlink-phrase-input"
      />
      <Text style={styles.label}>{COPY.phraseHint}</Text>
      {error ? (
        <Text style={styles.label} accessibilityRole="alert" testID="unlink-error">
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
