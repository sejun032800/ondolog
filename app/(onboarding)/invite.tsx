/**
 * A17 연인 초대 + A18 초대 코드 입력 (MASTER 9-1 화면 8). 디자인 `N-S-A3-Onboarding`.
 *
 * 라우트는 하나(`invite`, MASTER 11-3)이고 A18은 같은 화면의 다른 모습이다([상대에게 코드를 받았어요 →]로 들어가고 ← 로 돌아온다).
 * 서버 일은 **전부 기존 함수**다 - 연결 로직은 바꾸지 않았다:
 *   - 코드 발급: `getOrCreateInvite`(이미 있으면 그대로, 없으면 새로). **사람이 [초대 코드 만들기]를 누를 때만** 부른다 - 이 화면을 연다고
 *     커플 행이 생기지 않는다(`fetchExistingInvite`는 읽기만 한다). 보드는 코드가 처음부터 보이지만, 열기만 해도 행이 생기면 코드를
 *     받아 입력하는 쪽에 쓰이지 않는 대기 코드가 남기 때문이다.
 *   - 코드 입력: `redeemInviteCode`. 자기 코드 · 이미 연결된 코드 · 없는 코드는 모두 null(= 무효)이고 판정은 서버 조건이다.
 *   - 연결되면 `markInviteDoneAwaitingStartDate`(진행 단계 INVITE, `advanceOnboardingStep` 경유) 뒤 사귄 날짜(A19)로 간다.
 *     코드를 만들어 두고 기다리는 쪽은 4초마다 읽어서(`fetchExistingInvite`) 상대가 입력했는지 안다.
 *   - [나중에 할게요] · [솔로예요]: 둘 다 `completeOnboardingWithoutCouple`(진행 단계 COMPLETE) 뒤 바로 메인. 솔로 기록은 M4다.
 * 코드 복사 버튼은 없다(R37-4) - 코드 글자를 길게 눌러 복사한다(`selectable`). 공유는 RN 기본 `Share`.
 */
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { useSession } from '../../src/hooks/useSession'
import {
  completeOnboardingWithoutCouple,
  fetchExistingInvite,
  getOrCreateInvite,
  markInviteDoneAwaitingStartDate,
  redeemInviteCode,
} from '../../src/services/coupleApi'
import { ConnectCoupleError } from '../../src/services/coupleConnectCore'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../src/theme/nocturne'

const INVITE_POLL_MS = 4000
const CODE_LENGTH = 6

const INVITE_SCREEN_COPY = {
  title: '연인을 초대해요',
  subtitle: '상대가 이 코드를 입력하면 두 사람이 연결돼요',
  myCode: 'MY CODE',
  make: '초대 코드 만들기',
  share: '공유하기',
  received: '상대에게 코드를 받았어요',
  later: '나중에 할게요',
  solo: '솔로예요',
  enterTitle: '받은 코드를\n입력해주세요',
  enterHint: '이미 다른 사람과 연결된 코드는 쓸 수 없어요',
  connect: '연결하기',
  redeemError: '연결하지 못했어요. 다시 시도해주세요.',
  issueFailed: '코드를 만들지 못했어요. 다시 시도해주세요.',
  stepFailed: '처리하지 못했어요. 다시 시도해주세요.',
} as const

type CodeState = { kind: 'checking' } | { kind: 'none' } | { kind: 'code'; code: string }

export default function InviteScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const [view, setView] = useState<'invite' | 'enter'>('invite')
  const [codeState, setCodeState] = useState<CodeState>({ kind: 'checking' })
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const movingRef = useRef(false)
  // 라우터 객체가 렌더마다 달라도 아래 효과(읽기 · 4초 확인)가 다시 시작되지 않게 ref로 잡는다.
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  /** 연결이 확인됐다 - 진행 단계를 올리고 사귄 날짜(A19)로. 두 번 가지 않는다. */
  const goConnected = useCallback(async () => {
    if (!userId || movingRef.current) return
    movingRef.current = true
    try {
      await markInviteDoneAwaitingStartDate(userId)
      routerRef.current.replace('/start-date')
    } catch {
      movingRef.current = false
      setError(INVITE_SCREEN_COPY.stepFailed)
    }
  }, [userId])

  // 처음 열 때: 이미 발급한 코드가 있으면 보이고, 이미 연결됐으면 건너간다. 읽기만 한다.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchExistingInvite(userId)
      .then((existing) => {
        if (cancelled) return
        if (existing?.status === 'connected') {
          void goConnected()
          return
        }
        setCodeState(existing ? { kind: 'code', code: existing.couple.invite_code } : { kind: 'none' })
      })
      .catch(() => {
        if (!cancelled) setCodeState({ kind: 'none' })
      })
    return () => {
      cancelled = true
    }
  }, [userId, goConnected])

  // 코드를 만들어 둔 채 기다리는 동안: 상대가 입력해 연결됐는지 4초마다 읽는다.
  const hasCode = codeState.kind === 'code'
  useEffect(() => {
    if (!userId || !hasCode) return
    const timer = setInterval(() => {
      fetchExistingInvite(userId)
        .then((existing) => {
          if (existing?.status === 'connected') void goConnected()
        })
        .catch(() => {
          // 일시 오류 - 다음 주기에 다시 읽는다.
        })
    }, INVITE_POLL_MS)
    return () => clearInterval(timer)
  }, [userId, hasCode, goConnected])

  const makeCode = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const result = await getOrCreateInvite(userId)
      if (result.status === 'connected') {
        void goConnected()
        return
      }
      setCodeState({ kind: 'code', code: result.couple.invite_code })
    } catch {
      setError(INVITE_SCREEN_COPY.issueFailed)
    } finally {
      setBusy(false)
    }
  }

  const shareCode = async () => {
    if (codeState.kind !== 'code') return
    try {
      await Share.share({ message: `온돌로그에서 연결해요! 초대 코드: ${codeState.code}` })
    } catch {
      // 취소 등 - 별도 처리 불필요
    }
  }

  const redeem = async () => {
    if (!userId || entered.length < CODE_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      await redeemInviteCode(userId, entered)
      await goConnected()
    } catch (e) {
      setError(e instanceof ConnectCoupleError ? e.message : INVITE_SCREEN_COPY.redeemError)
    } finally {
      setBusy(false)
    }
  }

  const skip = async () => {
    if (!userId) return
    setError(null)
    try {
      await completeOnboardingWithoutCouple(userId)
      router.replace('/main')
    } catch {
      setError(INVITE_SCREEN_COPY.stepFailed)
    }
  }

  if (!session) return <ScreenFrame />

  if (view === 'enter') {
    return (
      <OnboardingScreen
        key="enter"
        onBack={() => {
          setError(null)
          setView('invite')
        }}
        title={INVITE_SCREEN_COPY.enterTitle}
        footer={
          <PrimaryButton
            label={INVITE_SCREEN_COPY.connect}
            onPress={redeem}
            disabled={busy || entered.length < CODE_LENGTH}
            testID="invite-connect"
          />
        }
      >
        <CodeBoxes value={entered} onChange={setEntered} />
        <Text style={styles.hint} testID="invite-enter-hint">
          {INVITE_SCREEN_COPY.enterHint}
        </Text>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert" testID="invite-error">
            {error}
          </Text>
        ) : null}
      </OnboardingScreen>
    )
  }

  return (
    <OnboardingScreen
      key="invite"
      title={INVITE_SCREEN_COPY.title}
      subtitle={INVITE_SCREEN_COPY.subtitle}
      footer={
        <View style={styles.skipRow}>
          <PressScale onPress={skip} accessibilityLabel={INVITE_SCREEN_COPY.later} style={styles.skip} testID="invite-later">
            <Text style={styles.skipLabel}>{INVITE_SCREEN_COPY.later}</Text>
          </PressScale>
          <PressScale onPress={skip} accessibilityLabel={INVITE_SCREEN_COPY.solo} style={styles.skip} testID="invite-solo">
            <Text style={styles.skipLabel}>{INVITE_SCREEN_COPY.solo}</Text>
          </PressScale>
        </View>
      }
    >
      <View style={styles.codeCard}>
        <Text style={styles.kicker}>{INVITE_SCREEN_COPY.myCode}</Text>
        {codeState.kind === 'code' ? (
          <>
            <Text style={styles.code} selectable testID="invite-code">
              {codeState.code}
            </Text>
            <PrimaryButton label={INVITE_SCREEN_COPY.share} onPress={shareCode} style={styles.shareButton} testID="invite-share" />
          </>
        ) : (
          <PrimaryButton
            label={INVITE_SCREEN_COPY.make}
            onPress={makeCode}
            disabled={busy || codeState.kind === 'checking'}
            style={styles.makeButton}
            testID="invite-make"
          />
        )}
      </View>
      <PressScale
        onPress={() => {
          setError(null)
          setView('enter')
        }}
        accessibilityLabel={INVITE_SCREEN_COPY.received}
        style={styles.receivedRow}
        testID="invite-received"
      >
        <Text style={styles.receivedLabel}>{INVITE_SCREEN_COPY.received}</Text>
        <Text style={styles.receivedArrow}>{'→'}</Text>
      </PressScale>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" testID="invite-error">
          {error}
        </Text>
      ) : null}
    </OnboardingScreen>
  )
}

/** 6칸 코드 입력 - 숨은 입력 하나가 글자를 받고 칸이 보여 준다. 영문 대문자와 숫자만 받는다. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(true)
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1)
  return (
    <View style={styles.boxesWrap}>
      <PressScale onPress={() => inputRef.current?.focus()} accessibilityLabel="초대 코드 칸" style={styles.boxes} testID="invite-boxes">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <View key={i} style={[styles.box, focused && i === activeIndex && styles.boxActive]}>
            <Text style={styles.boxChar}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </PressScale>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={CODE_LENGTH}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        selectionColor={nocturne.lilac}
        style={styles.hiddenInput}
        accessibilityLabel="초대 코드"
        testID="invite-input"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  codeCard: {
    marginTop: 28,
    alignItems: 'center',
    gap: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: shape.radius.card,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
  },
  kicker: { ...type.kicker, color: nocturne.textMute },
  code: { fontFamily: fontFamily.regular, fontSize: 44, lineHeight: 52, letterSpacing: 8, color: nocturne.text },
  shareButton: { alignSelf: 'stretch' },
  makeButton: { alignSelf: 'stretch' },
  receivedRow: {
    marginTop: 16,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    borderRadius: shape.radius.card,
    backgroundColor: nocturne.inkRaise,
  },
  receivedLabel: { ...type.body, fontSize: 16, color: nocturne.text },
  receivedArrow: { fontFamily: fontFamily.regular, fontSize: 18, color: nocturne.textMute },
  skipRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  skip: { minHeight: shape.touch, justifyContent: 'center', paddingHorizontal: 8 },
  skipLabel: { ...type.body, fontSize: 15.5, color: nocturne.textSub },
  boxesWrap: { marginTop: 32 },
  boxes: { flexDirection: 'row', gap: 10 },
  box: {
    flex: 1,
    aspectRatio: 0.84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
  },
  boxActive: { borderColor: withAlpha(nocturne.text, 0.5), backgroundColor: nocturne.inkRaise2 },
  boxChar: { fontFamily: fontFamily.regular, fontSize: 30, lineHeight: 36, color: nocturne.text },
  hiddenInput: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0 },
  hint: { ...type.sub, color: nocturne.textMute, marginTop: 18 },
  error: { ...type.sub, color: nocturne.textSub, marginTop: 14 },
})
