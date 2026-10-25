/**
 * F02 미연결 진입 - 초대 시트. 디자인 `N-S-F-Chat` F02 (같은 모양이 `N-S-H4-Settings` I01 커플 게이트).
 *
 * - 어두운 면 위에 아래에서 올라온 시트(손잡이만, 나가는 길 = 바깥 누르기). 두 개의 원(채운 것 + 점선)과 한 줄 안내.
 * - 초대 코드 발급·입력은 **기존 함수**(`getOrCreateInvite`·`redeemInviteCode`)를 그대로 쓴다. 이 시트는 화면만 바꿨다.
 * - 보드의 두 번째 문장 "여기서 나눈 대화가 온도와 잡지의 재료가 돼요"는 넣지 않았다 - 채팅이 잡지에 실릴 수 있다는 안내를
 *   새로 두지 않는다(AI 활용 고지는 동의 단계의 일). 코드 복사(`복사하기`)는 클립보드 의존성이 새로 필요해 공유만 둔다.
 * - 코드 발급 뒤·코드 입력은 같은 시트 안의 상태다(온보딩 A17·A18의 내용을 시트 안에 줄여 담았다).
 */
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { getOrCreateInvite, redeemInviteCode } from '../../services/coupleApi'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'
import { GhostButton, PrimaryButton } from '../nocturne/Buttons'
import { PressScale } from '../nocturne/PressScale'

export const INVITE_COPY = {
  title: '상대만 있으면 돼요',
  /** 채팅에서 온 경우(F02). 보드의 두 번째 문장은 뺐다. */
  bodyChat: '채팅은 연인과 연결되면 열려요.',
  body: '연인과 연결되면 열려요.',
  send: '초대 코드 보내기',
  enter: '받은 코드 입력하기',
  myCode: 'MY CODE',
  share: '공유하기',
  connect: '연결하기',
  back: '← 뒤로',
  codePlaceholder: '코드를 입력해주세요',
  issueFailed: '코드를 만들지 못했어요. 다시 시도해주세요.',
  redeemFailed: '연결할 수 없어요. 코드를 다시 확인해주세요. 만료됐거나 이미 연결된 코드일 수 있어요.',
  redeemError: '연결하지 못했어요. 다시 시도해주세요.',
} as const

export type InviteStep = 'intro' | 'code' | 'enter'

export interface InviteSheetProps {
  userId: string
  /** 채팅에서 열었으면 true - 안내 문구가 채팅 문구가 된다. */
  fromChat?: boolean
  onClose: () => void
  /** 코드 발급 중 이미 연결돼 있었거나, 받은 코드로 연결됐을 때. */
  onConnected: () => void
}

export function InviteSheet({ userId, fromChat, onClose, onConnected }: InviteSheetProps) {
  const [step, setStep] = useState<InviteStep>('intro')
  const [code, setCode] = useState<string | null>(null)
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const issue = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await getOrCreateInvite(userId)
      if (result.status === 'connected') {
        onConnected()
        return
      }
      setCode(result.couple.invite_code)
      setStep('code')
    } catch {
      setError(INVITE_COPY.issueFailed)
    } finally {
      setBusy(false)
    }
  }

  const shareCode = async () => {
    if (!code) return
    try {
      await Share.share({ message: `온돌로그에서 연결해요! 초대 코드: ${code}` })
    } catch {
      // 취소 등 - 별도 처리 불필요
    }
  }

  const redeem = async () => {
    const value = entered.trim()
    if (value.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const couple = await redeemInviteCode(userId, value)
      if (!couple) {
        setError(INVITE_COPY.redeemFailed)
        return
      }
      onConnected()
    } catch {
      setError(INVITE_COPY.redeemError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.root} testID="invite-sheet">
      <Pressable style={styles.dim} onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" testID="invite-dim" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.circles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.circleSelf} />
            <View style={styles.circleOther} />
          </View>

          {step === 'intro' ? (
            <>
              <View style={styles.copy}>
                <Text style={styles.title}>{INVITE_COPY.title}</Text>
                <Text style={styles.body}>{fromChat ? INVITE_COPY.bodyChat : INVITE_COPY.body}</Text>
              </View>
              <PrimaryButton label={INVITE_COPY.send} onPress={issue} disabled={busy} testID="invite-send" />
              <PressScale onPress={() => { setError(null); setStep('enter') }} accessibilityLabel={INVITE_COPY.enter} style={styles.linkWrap} testID="invite-enter">
                <Text style={styles.link}>{INVITE_COPY.enter}</Text>
              </PressScale>
            </>
          ) : null}

          {step === 'code' && code ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.kicker}>{INVITE_COPY.myCode}</Text>
                <Text style={styles.code} selectable testID="invite-code">{code}</Text>
              </View>
              <PrimaryButton label={INVITE_COPY.share} onPress={shareCode} testID="invite-share" />
              <PressScale onPress={() => { setError(null); setStep('enter') }} accessibilityLabel={INVITE_COPY.enter} style={styles.linkWrap} testID="invite-enter">
                <Text style={styles.link}>{INVITE_COPY.enter}</Text>
              </PressScale>
            </>
          ) : null}

          {step === 'enter' ? (
            <>
              <TextInput
                value={entered}
                onChangeText={(t) => setEntered(t.toUpperCase())}
                placeholder={INVITE_COPY.codePlaceholder}
                placeholderTextColor={nocturne.textMute}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                testID="invite-input"
              />
              <PrimaryButton
                label={INVITE_COPY.connect}
                onPress={redeem}
                disabled={busy || entered.trim().length === 0}
                testID="invite-connect"
              />
              <GhostButton label={INVITE_COPY.back} onPress={() => { setError(null); setStep(code ? 'code' : 'intro') }} testID="invite-back" />
            </>
          ) : null}

          {error ? (
            <Text style={styles.error} accessibilityRole="alert" testID="invite-error">
              {error}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(nocturne.ink, 0.62) },
  sheet: {
    borderTopLeftRadius: shape.radius.sheet,
    borderTopRightRadius: shape.radius.sheet,
    backgroundColor: nocturne.inkRaise,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: nocturne.hairline,
    paddingTop: 12,
    paddingHorizontal: shape.space.screen,
    paddingBottom: 40,
    gap: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.2),
  },
  circles: { flexDirection: 'row', alignSelf: 'center', marginTop: 8 },
  circleSelf: {
    width: 48,
    height: 48,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.mist, 0.55),
    borderWidth: 2,
    borderColor: nocturne.inkRaise,
  },
  circleOther: {
    width: 48,
    height: 48,
    marginLeft: -12,
    borderRadius: shape.radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.3),
    backgroundColor: nocturne.inkRaise,
  },
  copy: { gap: 8, alignItems: 'center' },
  title: { fontFamily: fontFamily.semiBold, fontSize: 21, lineHeight: 28, color: nocturne.text, textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: 13.5, lineHeight: 21, color: nocturne.textSub, textAlign: 'center' },
  linkWrap: { alignItems: 'center', justifyContent: 'center', minHeight: shape.touch },
  link: { fontFamily: fontFamily.medium, fontSize: 13.5, lineHeight: 20, color: nocturne.mist },
  codeBox: { alignItems: 'center', gap: 10 },
  kicker: { fontFamily: fontFamily.semiBold, fontSize: 10.5, lineHeight: 14, letterSpacing: 2.7, color: nocturne.textMute },
  code: { fontFamily: fontFamily.regular, fontSize: 40, lineHeight: 48, letterSpacing: 6, color: nocturne.text },
  input: {
    height: 54,
    borderRadius: shape.radius.button,
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: 20,
    letterSpacing: 4,
    color: nocturne.text,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.14),
  },
  error: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: nocturne.textSub, textAlign: 'center' },
})
