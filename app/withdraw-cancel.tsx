/**
 * H16 탈퇴 유예 중 다시 로그인 - 탈퇴 취소 화면. 로그인 직후 분기(`resolveResumePath`)가 진행 단계보다 **먼저** 이곳으로 보낸다.
 * 보드(`N-S-H3-Settings`)에 이 화면이 없어 H14 유예 화면의 형식(DISCONNECTING 카드 + 안내 + 큰 버튼)을 빌렸다(보고).
 *
 * 남은 날짜는 서버 `profiles.purge_scheduled_at` 기준이다(KST, 앱이 7일을 더하지 않는다). [탈퇴 취소하기]는 `fn_cancel_withdrawal` 호출 하나이고,
 * 성공하면 서버의 진행 단계로 돌아간다(`resolveResumePath`, 원래 가던 곳). [로그아웃]은 이 화면에서 나갈 길이다(보드에 없는 보조 길, 보고).
 * 이 화면은 탈퇴 유예가 아닌 사람이 열면(직접 경로) 바로 진행 단계로 보낸다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GhostButton, PrimaryButton } from '../src/components/nocturne/Buttons'
import { GlassCard, SoftCard } from '../src/components/nocturne/GlassCard'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { resolveResumePath } from '../src/hooks/resolveResumePath'
import { useSession } from '../src/hooks/useSession'
import { cancelWithdrawal } from '../src/services/dissolutionApi'
import { DissolutionError } from '../src/services/dissolutionCore'
import { fetchProfile } from '../src/services/personalityApi'
import { performLogout } from '../src/services/settingsApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useDissolutionStore } from '../src/store/dissolutionStore'
import { useProfileStore } from '../src/store/profileStore'
import { nocturne, type } from '../src/theme/nocturne'
import { graceDateLabel, graceDaysLeft, isWithdrawalPending } from '../src/utils/dissolution'

const WITHDRAW_CANCEL_COPY = {
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
} as const

export default function WithdrawCancelScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const resetCouple = useCoupleStore((s) => s.reset)
  const resetProfile = useProfileStore((s) => s.reset)
  const resetDissolution = useDissolutionStore((s) => s.reset)

  const [purgeAt, setPurgeAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const profile = await fetchProfile(userId)
        if (cancelled || !profile) return
        if (!isWithdrawalPending(profile)) {
          router.replace((await resolveResumePath(profile)) as never)
          return
        }
        setPurgeAt(profile.purge_scheduled_at)
      } catch {
        if (!cancelled) setError(WITHDRAW_CANCEL_COPY.failed)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, router])

  if (!session) return <ScreenFrame />

  const cancelNow = async () => {
    if (!userId || busy) return
    setBusy(true)
    setError(null)
    try {
      await cancelWithdrawal()
      const profile = await fetchProfile(userId)
      if (!profile) throw new Error('no profile')
      router.replace((await resolveResumePath(profile)) as never)
    } catch (e) {
      setError(e instanceof DissolutionError ? e.message : WITHDRAW_CANCEL_COPY.failed)
      setBusy(false)
    }
  }

  const logout = async () => {
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

  const days = purgeAt ? graceDaysLeft(purgeAt) : null

  return (
    <SettingsScreen
      title={WITHDRAW_CANCEL_COPY.title}
      onBack={logout}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label={WITHDRAW_CANCEL_COPY.cancel}
            onPress={cancelNow}
            disabled={busy || !purgeAt}
            testID="withdraw-cancel-button"
          />
          <GhostButton label={WITHDRAW_CANCEL_COPY.logout} onPress={logout} testID="withdraw-cancel-logout" />
        </View>
      }
    >
      {purgeAt ? (
        <GlassCard style={styles.card}>
          <Text style={styles.kicker}>{WITHDRAW_CANCEL_COPY.kicker}</Text>
          <Text style={styles.days} testID="withdraw-days">
            {days !== null && days > 0 ? `${days}일` : '오늘'}
          </Text>
          <Text style={styles.date} testID="withdraw-date">
            {`${graceDateLabel(purgeAt)}에 계정이 삭제돼요`}
          </Text>
        </GlassCard>
      ) : null}
      <SoftCard style={styles.bullets}>
        {WITHDRAW_CANCEL_COPY.bullets.map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </SoftCard>
      {error ? (
        <Text style={styles.note} accessibilityRole="alert" testID="withdraw-cancel-error">
          {error}
        </Text>
      ) : null}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  card: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  days: { fontFamily: type.hero.fontFamily, fontSize: 56, lineHeight: 64, letterSpacing: -2, color: nocturne.text },
  date: { ...type.body, color: nocturne.textSub },
  bullets: { gap: 12 },
  bulletRow: { flexDirection: 'row', gap: 12 },
  dot: { ...type.body, color: nocturne.textMute },
  bulletText: { ...type.body, flex: 1, color: nocturne.textSub },
  note: { ...type.sub, color: nocturne.textSub },
})
