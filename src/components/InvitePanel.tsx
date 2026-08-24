/**
 * 연인 초대 패널 — 화면 8(`app/(onboarding)/invite.tsx`)과 초대 모달
 * (`app/(modals)/couple-gate.tsx`)이 공유하는 실제 구현체.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 11-3 라우트 트리 주석 —
 *   "couple-gate.tsx # 초대 모달(화면 8과 동일 컴포넌트 재사용)"
 *
 * 두 맥락의 차이(온보딩 중 vs 온보딩 이후 모달)는 콜백으로 흡수한다 —
 * 컴포넌트 자체는 어느 화면에서 왔는지 모른다.
 */
import { useState } from 'react'
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton } from './PrimaryButton'
import { SecondaryButton } from './SecondaryButton'
import { COLORS } from '../constants/theme'
import {
  getOrCreateInvite,
  redeemInviteCode,
  type InviteStatus,
} from '../services/coupleApi'

interface InvitePanelProps {
  userId: string
  /** 코드 입력/발급으로 실제 연결됐을 때. */
  onConnected: () => void
  /** "나중에 할게요" / "솔로예요" — 커플 없이 넘어갈 때. */
  onSkip: () => void
}

export function InvitePanel({ userId, onConnected, onSkip }: InvitePanelProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const handleIssue = async () => {
    setIssuing(true)
    try {
      const result: InviteStatus = await getOrCreateInvite(userId)
      if (result.status === 'connected') {
        onConnected()
        return
      }
      setInviteCode(result.couple.invite_code)
    } catch (e) {
      Alert.alert('코드 발급에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setIssuing(false)
    }
  }

  const handleShareCode = async () => {
    if (!inviteCode) return
    try {
      await Share.share({ message: `온돌로그에서 연결해요! 초대 코드: ${inviteCode}` })
    } catch {
      // 취소 등 — 별도 처리 불필요
    }
  }

  const handleRedeem = async () => {
    if (enteredCode.trim().length === 0) return
    setRedeeming(true)
    try {
      const couple = await redeemInviteCode(userId, enteredCode.trim())
      if (!couple) {
        Alert.alert(
          '연결할 수 없어요',
          '코드를 다시 확인해주세요. 만료됐거나 이미 연결된 코드일 수 있어요.',
        )
        return
      }
      onConnected()
    } catch (e) {
      Alert.alert('연결에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setRedeeming(false)
    }
  }

  const handleSkip = async () => {
    setFinishing(true)
    try {
      onSkip()
    } finally {
      setFinishing(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        {inviteCode ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>내 초대 코드</Text>
            <Text style={styles.codeText}>{inviteCode}</Text>
            <PrimaryButton label="코드 공유하기" onPress={handleShareCode} />
          </View>
        ) : (
          <PrimaryButton label="초대코드 발급하기" onPress={handleIssue} loading={issuing} />
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <Text style={styles.blockTitle}>상대 코드 입력</Text>
        <TextInput
          value={enteredCode}
          onChangeText={(t) => setEnteredCode(t.toUpperCase())}
          placeholder="코드를 입력해주세요"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          style={styles.input}
        />
        <PrimaryButton
          label="연결하기"
          onPress={handleRedeem}
          disabled={enteredCode.trim().length === 0}
          loading={redeeming}
        />
      </View>

      <View style={styles.skipRow}>
        {finishing ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <SecondaryButton label="나중에 할게요" onPress={handleSkip} />
            <SecondaryButton label="솔로예요" onPress={handleSkip} />
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  block: { gap: 10 },
  blockTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  divider: { backgroundColor: COLORS.border, height: StyleSheet.hairlineWidth },
  codeBox: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    gap: 8,
    padding: 20,
  },
  codeLabel: { color: COLORS.textMuted, fontSize: 13 },
  codeText: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  skipRow: { gap: 10 },
})
