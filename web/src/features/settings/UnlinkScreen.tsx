/**
 * H14 연결 해제 요청 - 설정 > 커플 > [연결 해제]. 보드 `N-R43-App-States` ⓖ(문구 입력) · `N-S-H3-Settings` H14. RN `app/settings-unlink.tsx`의 웹판. 푸시 화면.
 *
 * 확인 틀은 공통 I05(`PhraseConfirm`) - 안내(무엇이 지워지고 남는지 + 발행물 PDF 저장 안내)와 문구 직접 입력(`해제합니다`)이 **한 화면**이다.
 * 확인 동작: 문구가 맞아야 [해제 요청하기]가 눌리고 -> 요청 함수(`fn_request_dissolution`) -> 상태 다시 읽기 -> 커플 화면으로 돌아가고, 그 화면이 유예 화면으로 바뀐다.
 * 이 화면은 서버를 직접 쓰지 않는다 - 함수 호출 하나뿐이다(`execute_dissolution` 등 실행 함수는 앱에 없다, R34-3).
 */
import { useEffect, useState } from 'react'
import { DissolutionError, requestDissolution, type DissolutionDb } from '@/services/dissolutionCore'
import { UNLINK_PHRASE } from '@/utils/dissolution'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { CoupleGate } from '../../components/CoupleGate'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { PhraseConfirm, PhraseConfirmCard, PhraseConfirmLine } from './PhraseConfirm'
import { SettingsFrame, SettingsSkeletonBlock } from './parts'

export const UNLINK_COPY = {
  title: '연결 해제',
  heading: '해제하기 전에\n확인해주세요',
  pdf: '발행된 호 PDF로 받아두기',
  phraseLabel: `확인을 위해 ‘${UNLINK_PHRASE}’를 입력해 주세요`,
  submit: '해제 요청하기',
  failed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

export function UnlinkScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const status = useCoupleStore((s) => s.status)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 요청이 끝났다 - 상태를 다시 읽어 미연결로 보여도 안내 카드로 바뀌지 않고 그대로 앞 화면으로 돌아간다. */
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    const db = getSupabase()
    if (!partnerId || !db) return
    let cancelled = false
    fetchProfile(db, partnerId)
      .then((p) => { if (!cancelled) setPartnerName(p?.display_name ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [partnerId])

  const name = partnerName ?? '상대'

  const submit = async () => {
    const db = getSupabase()
    if (!userId || !db || busy) return
    setBusy(true)
    setError(null)
    try {
      await requestDissolution(db as unknown as DissolutionDb)
      setRequested(true)
      await Promise.all([useDissolutionStore.getState().refresh(userId), useCoupleStore.getState().refresh(userId)])
      nav.back()
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : UNLINK_COPY.failed)
    } finally {
      setBusy(false)
    }
  }

  // 연결되지 않았으면(조회가 끝난 뒤) 이 화면에서 할 일이 없다 - I01 안내. 조회 중에는 아무것도 확정하지 않는다.
  if (status !== 'connected' && !requested) {
    return (
      <SettingsFrame title={UNLINK_COPY.title} onBack={nav.back} testId="settings-unlink">
        {status === 'disconnected' ? <CoupleGate><span /></CoupleGate> : <SettingsSkeletonBlock rows={3} />}
      </SettingsFrame>
    )
  }

  return (
    <PhraseConfirm
      title={UNLINK_COPY.title}
      onBack={nav.back}
      heading={UNLINK_COPY.heading}
      pdfLabel={UNLINK_COPY.pdf}
      onOpenPdf={() => nav.replace('magazine')}
      phrase={UNLINK_PHRASE}
      phraseLabel={UNLINK_COPY.phraseLabel}
      submitLabel={UNLINK_COPY.submit}
      onSubmit={() => void submit()}
      busy={busy}
      error={error}
      testIdPrefix="unlink"
    >
      <PhraseConfirmCard>
        <PhraseConfirmLine>해제되면 내가 남긴 사진·글·대화가 지워져요</PhraseConfirmLine>
        <PhraseConfirmLine>{`${name}의 기록은 ${name}에게 남아요`}</PhraseConfirmLine>
        <PhraseConfirmLine>발행된 잡지는 한쪽이 남아 있으면 보존돼요</PhraseConfirmLine>
        <PhraseConfirmLine>7일 안에는 언제든 취소할 수 있어요</PhraseConfirmLine>
      </PhraseConfirmCard>
    </PhraseConfirm>
  )
}
