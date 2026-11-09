/**
 * H16 회원 탈퇴 요청 - 설정 > 프로필 > [회원 탈퇴]. 보드 `N-S-H3-Settings`(H16). RN `app/settings-withdraw.tsx`의 웹판. 푸시 화면.
 *
 * 확인 틀은 공통 I05(`PhraseConfirm`): 무엇이 7일 뒤 지워지고 무엇이 남는지(MASTER 9-6 표) -> 발행물 PDF 저장 안내 -> 문구 직접 입력(`탈퇴합니다`)이 한 화면이다.
 * 확인 동작: 탈퇴 요청 함수(`fn_request_withdrawal`) -> 로그아웃(세션 지움) -> 첫 화면. 커플이면 "연결도 함께 해제돼요"를 먼저 알린다(같은 함수가 같은 트랜잭션에서 해제도 요청한다).
 * 7일 안에 다시 로그인하거나 앱을 열면 `withdraw-cancel`이 단계보다 먼저 뜬다(`auth/finalize.resolveWebRoute`).
 * 보드의 "남는 것" 두 줄은 커플일 때만 사실이라(상대가 없으면 남는 기록 · 두 사람 모두 떠나는 일이 없다) 미연결에서는 그리지 않는다.
 */
import { useEffect, useState } from 'react'
import { DissolutionError, requestWithdrawal, type DissolutionDb } from '@/services/dissolutionCore'
import { nameWithSubject, WITHDRAW_PHRASE } from '@/utils/dissolution'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { logoutToStart } from './accountActions'
import { PhraseConfirm, PhraseConfirmCard, PhraseConfirmCardTitle, PhraseConfirmLine } from './PhraseConfirm'

export const WITHDRAW_COPY = {
  title: '회원 탈퇴',
  heading: '탈퇴하기 전에\n확인해주세요',
  pdf: '발행된 호 PDF로 받아두기',
  coupleNote: '연결도 함께 해제돼요',
  phraseLabel: `확인을 위해 ‘${WITHDRAW_PHRASE}’를 입력해주세요`,
  phraseHint: '7일 안에는 언제든 취소할 수 있어요',
  submit: '탈퇴 요청하기',
  failed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

export function WithdrawScreen({ nav }: { nav: Nav }) {
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const db = getSupabase()
    if (!partnerId || !db) return
    let cancelled = false
    fetchProfile(db, partnerId)
      .then((p) => { if (!cancelled) setPartnerName(p?.display_name ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [partnerId])

  const coupled = !!coupleId
  const name = partnerName ?? '상대'

  const submit = async () => {
    const db = getSupabase()
    if (!db || busy) return
    setBusy(true)
    setError(null)
    try {
      await requestWithdrawal(db as unknown as DissolutionDb)
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : WITHDRAW_COPY.failed)
      setBusy(false)
      return
    }
    await logoutToStart(nav)
  }

  return (
    <PhraseConfirm
      title={WITHDRAW_COPY.title}
      onBack={nav.back}
      heading={WITHDRAW_COPY.heading}
      pdfLabel={WITHDRAW_COPY.pdf}
      onOpenPdf={() => nav.replace('magazine')}
      phrase={WITHDRAW_PHRASE}
      phraseLabel={WITHDRAW_COPY.phraseLabel}
      hint={WITHDRAW_COPY.phraseHint}
      submitLabel={WITHDRAW_COPY.submit}
      onSubmit={() => void submit()}
      busy={busy}
      error={error}
      testIdPrefix="withdraw"
    >
      <PhraseConfirmCard>
        <PhraseConfirmCardTitle>7일 뒤 지워지는 것</PhraseConfirmCardTitle>
        <PhraseConfirmLine>내가 올린 사진·글, 내가 보낸 대화</PhraseConfirmLine>
        <PhraseConfirmLine>성격 프로필, 계정 정보, 대표사진</PhraseConfirmLine>
        {coupled ? (
          <>
            <PhraseConfirmCardTitle>남는 것</PhraseConfirmCardTitle>
            <PhraseConfirmLine>{`${nameWithSubject(name)} 올린 기록`}</PhraseConfirmLine>
            <PhraseConfirmLine>발행된 잡지 — 두 사람 모두 떠나면 지워져요</PhraseConfirmLine>
            <p className="t-body phraseCoupleNote" data-testid="withdraw-couple-note">{WITHDRAW_COPY.coupleNote}</p>
          </>
        ) : null}
      </PhraseConfirmCard>
    </PhraseConfirm>
  )
}
