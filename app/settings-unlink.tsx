/**
 * H14 연결 해제 요청 - 설정 > 커플 > [연결 해제]. 디자인 `N-R43-App-States` ⓖ(문구 입력) · `N-S-H3-Settings` H14. 푸시 화면(R18-2).
 *
 * 확인 틀은 공통 I05(`PhraseConfirm`) - 안내(무엇이 지워지고 남는지 + 발행물 PDF 저장 안내)와 문구 직접 입력(`해제합니다`)이 **한 화면**이다(보드 ⓖ).
 * 확인 동작은 그대로다: 문구가 맞아야 [해제 요청하기]가 눌리고 -> 요청 함수(`fn_request_dissolution`) -> 상태 다시 읽기 -> 커플 화면으로 돌아가고, 그 화면이 유예 화면으로 바뀐다.
 * 이 화면은 서버를 직접 쓰지 않는다 - 함수 호출 하나뿐이다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { CoupleGate } from '../src/components/CoupleGate'
import { SoftCard } from '../src/components/nocturne/GlassCard'
import { PhraseConfirm, PhraseConfirmLine } from '../src/components/nocturne/PhraseConfirm'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { requestDissolution } from '../src/services/dissolutionApi'
import { DissolutionError } from '../src/services/dissolutionCore'
import { fetchProfile } from '../src/services/personalityApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useDissolutionStore } from '../src/store/dissolutionStore'
import { UNLINK_PHRASE } from '../src/utils/dissolution'

const COPY = {
  title: '연결 해제',
  heading: '해제하기 전에\n확인해주세요',
  pdf: '발행된 호 PDF로 받아두기',
  phraseLabel: `확인을 위해 ‘${UNLINK_PHRASE}’를 입력해 주세요`,
  submit: '해제 요청하기',
  failed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

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

  const submit = async () => {
    if (!userId || busy) return
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

  return (
    <PhraseConfirm
      title={COPY.title}
      onBack={() => router.back()}
      heading={COPY.heading}
      pdfLabel={COPY.pdf}
      onOpenPdf={() => router.push('/(tabs)/magazine' as never)}
      phrase={UNLINK_PHRASE}
      phraseLabel={COPY.phraseLabel}
      submitLabel={COPY.submit}
      onSubmit={submit}
      busy={busy}
      error={error}
      testIDPrefix="unlink"
    >
      <SoftCard style={{ gap: 8 }}>
        <PhraseConfirmLine>해제되면 내가 남긴 사진·글·대화가 지워져요</PhraseConfirmLine>
        <PhraseConfirmLine>{`${name}의 기록은 ${name}에게 남아요`}</PhraseConfirmLine>
        <PhraseConfirmLine>발행된 잡지는 한쪽이 남아 있으면 보존돼요</PhraseConfirmLine>
        <PhraseConfirmLine>7일 안에는 언제든 취소할 수 있어요</PhraseConfirmLine>
      </SoftCard>
    </PhraseConfirm>
  )
}
