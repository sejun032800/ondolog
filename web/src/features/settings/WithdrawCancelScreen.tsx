/**
 * H16 탈퇴 유예 중 다시 로그인 - 탈퇴 취소 화면. RN `app/withdraw-cancel.tsx`의 웹판. 경로 `withdraw-cancel`(스택, 탭 바 없음).
 * 로그인 직후(`useAccountFinalize`)와 앱을 켤 때(`useBootSession`)의 단계 판정(`auth/finalize.resolveWebRoute`)이 진행 단계보다 **먼저** 이곳으로 보낸다(patch7 ⓕ).
 * 보드(`N-S-H3-Settings`)에 이 화면이 없어 H14 유예 화면의 형식(DISCONNECTING 카드 + 안내 + 큰 버튼)을 빌렸다.
 *
 * 남은 날짜는 서버 `profiles.purge_scheduled_at` 기준이다(KST, 앱이 7일을 더하지 않는다). [탈퇴 취소하기]는 `fn_cancel_withdrawal` 호출 하나이고, 성공하면
 * 토스트 "탈퇴를 취소했어요"(B15)와 함께 서버의 진행 단계로 돌아간다(`resolveWebRoute`, 원래 가던 곳). [로그아웃]은 이 화면에서 나갈 길이다.
 * **뒤로 가기(RN 동작 그대로)**: 화면의 ← 는 로그아웃이다(RN `onBack={logout}`). 하드웨어 뒤로 가기는 이 화면이 루트라 앱 종료다(규칙표 `withdraw-cancel` = exit).
 * 탈퇴 유예가 아닌 사람이 열면(직접 경로) 바로 진행 단계로 보낸다.
 */
import { useEffect, useState } from 'react'
import { cancelWithdrawal, DissolutionError, type DissolutionDb } from '@/services/dissolutionCore'
import { graceDateLabel, graceDaysLeft, isWithdrawalPending } from '@/utils/dissolution'
import { fetchProfile, resolveWebRoute } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { showToast } from '../../stores/toastStore'
import { PrimaryButton } from '../../ui'
import { logoutToStart } from './accountActions'
import { BulletCard } from './DissolutionGrace'
import { SettingsFrame, SettingsSkeletonBlock } from './parts'

export const WITHDRAW_CANCEL_COPY = {
  title: '회원 탈퇴',
  kicker: 'WITHDRAWING',
  cancel: '탈퇴 취소하기',
  logout: '로그아웃',
  bullets: [
    '탈퇴를 요청한 상태예요',
    '7일이 지나면 내가 남긴 사진·글·대화와 계정 정보가 지워져요',
    '취소하면 하던 대로 이어서 쓸 수 있어요',
  ],
  failed: '처리하지 못했어요. 다시 시도해주세요.',
  cancelDone: '탈퇴를 취소했어요',
} as const

export function WithdrawCancelScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const [purgeAt, setPurgeAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    void (async () => {
      try {
        const profile = await fetchProfile(db, userId)
        if (cancelled || !profile) return
        if (!isWithdrawalPending(profile)) {
          const route = await resolveWebRoute(db, userId, profile.onboarding_step, profile.deleted_at)
          if (!cancelled) nav.enterAccount(route)
          return
        }
        setPurgeAt(profile.purge_scheduled_at)
      } catch {
        if (!cancelled) setError(WITHDRAW_CANCEL_COPY.failed)
      }
    })()
    return () => { cancelled = true }
    // nav는 화면이 사는 동안 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const cancelNow = async () => {
    const db = getSupabase()
    if (!userId || !db || busy) return
    setBusy(true)
    setError(null)
    try {
      await cancelWithdrawal(db as unknown as DissolutionDb)
      const profile = await fetchProfile(db, userId)
      if (!profile) throw new Error('no profile')
      const route = await resolveWebRoute(db, userId, profile.onboarding_step, profile.deleted_at)
      showToast(WITHDRAW_CANCEL_COPY.cancelDone)
      nav.enterAccount(route)
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : WITHDRAW_CANCEL_COPY.failed)
      setBusy(false)
    }
  }

  const days = purgeAt ? graceDaysLeft(purgeAt) : null

  return (
    <SettingsFrame
      title={WITHDRAW_CANCEL_COPY.title}
      onBack={() => void logoutToStart(nav)}
      testId="withdraw-cancel"
      footer={
        <>
          <button type="button" className="btn press primary" disabled={busy || !purgeAt} onClick={() => void cancelNow()} data-testid="withdraw-cancel-button">{WITHDRAW_CANCEL_COPY.cancel}</button>
          <PrimaryButton label={WITHDRAW_CANCEL_COPY.logout} variant="ghost" onClick={() => void logoutToStart(nav)} />
        </>
      }
    >
      {purgeAt ? (
        <div className="graceCard" data-testid="withdraw-card">
          <p className="t-kicker c-mute">{WITHDRAW_CANCEL_COPY.kicker}</p>
          <p className="graceDays" data-testid="withdraw-days">{days !== null && days > 0 ? `${days}일` : '오늘'}</p>
          <p className="t-body c-sub" data-testid="withdraw-date">{`${graceDateLabel(purgeAt)}에 계정이 삭제돼요`}</p>
        </div>
      ) : error ? null : <SettingsSkeletonBlock rows={3} />}
      <BulletCard lines={WITHDRAW_CANCEL_COPY.bullets} testId="withdraw-bullets" />
      {error ? <p className="t-sub c-sub" role="alert" data-testid="withdraw-cancel-error">{error}</p> : null}
    </SettingsFrame>
  )
}
