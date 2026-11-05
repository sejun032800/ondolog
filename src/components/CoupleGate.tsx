/**
 * 커플 전용 기능 공통 게이팅 래퍼 (Nocturne).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8 "미연결 유저 처리 원칙(전역)"
 *   "진입 차단이 아니라 기능 단위 게이팅. 미연결 유저도 모든 탭에 들어올
 *   수 있고, 커플 전용 기능을 탭하는 순간 초대 모달이 뜬다."
 *   "잠긴 문을 보여주는 게 문을 숨기는 것보다 초대 동기가 강하다."
 * Part 11-2 탭별 게이팅 범위 표 - 탭에 따라 "진입 가능(잠긴 카드만 노출)" 또는 "진입 즉시 모달"로 강도가 다르다.
 * `autoOpenInvite`로 두 방식을 모두 지원한다. 이 컴포넌트는 연결 여부만 읽는다(useCoupleStore) - 연결 판정은 서버 조회
 * 결과를 그대로 반영할 뿐, 여기서 새로 계산하지 않는다.
 *
 * 채팅(`autoOpenInvite`)은 초대 시트(F02)를 띄우고, 시트 뒤에 비치는 면은 `fallback`이 그린다(없으면 빈 면).
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useCoupleStore } from '../store/coupleStore'
import { fontFamily, nocturne, shape, withAlpha } from '../theme/nocturne'
import { PrimaryButton } from './nocturne/Buttons'
import { PressScale } from './nocturne/PressScale'

/** I01 커플 게이트 문구 - 디자인 `N-S-H4-Settings` I01. 같은 문구가 초대 시트(`?from=gate`)에도 쓰인다(`INVITE_COPY.titleGate`). */
export const GATE_COPY = {
  title: '여기까지 왔어요. 상대만 있으면 돼요',
  body: '두 사람의 기록을 한 타임라인으로 보려면 연인과 연결해요.',
  invite: '초대 코드 보내기',
  enter: '받은 코드 입력하기',
} as const

interface CoupleGateProps {
  children: React.ReactNode
  /** 잠금 상태일 때 보여줄 대체 UI. 생략 시 기본 "잠긴 문" 카드를 쓴다. */
  fallback?: React.ReactNode
  /**
   * true면 화면 진입과 동시에 초대 시트(F02)로 이동한다(Part 11-2 "채팅" 탭처럼 "진입 즉시 초대 모달"인 기능용).
   * false(기본)면 잠긴 카드를 보여주고 탭했을 때만 시트를 띄운다("메인/피드/매거진"처럼 "진입 가능"인 기능용).
   */
  autoOpenInvite?: boolean
  /** 시트의 안내 문구를 고르는 출처. 채팅이면 'chat'. 생략하면 I01 문구('gate'). */
  inviteFrom?: 'chat'
  style?: ViewStyle
}

/** 아직 서버 조회 전(status === 'unknown' | 'loading')에는 아무것도 확정하지 않는다. */
export function CoupleGate({ children, fallback, autoOpenInvite = false, inviteFrom, style }: CoupleGateProps) {
  const router = useRouter()
  const status = useCoupleStore((s) => s.status)
  const isConnected = status === 'connected'
  const isSettled = status === 'connected' || status === 'disconnected'

  const invitePath = `/couple-gate?from=${inviteFrom ?? 'gate'}`
  useEffect(() => {
    if (autoOpenInvite && isSettled && !isConnected) {
      router.push(invitePath as never)
    }
  }, [autoOpenInvite, isSettled, isConnected, router, invitePath])

  if (isConnected) return <>{children}</>

  if (!isSettled) return null

  if (fallback) return <>{fallback}</>

  if (autoOpenInvite) return null // 시트 이동 대기 중 - 빈 화면 대신 시트가 곧 뜬다

  // I01 - 시트 모양의 안내(손잡이 · 두 원 · 한 줄 안내 · 주 버튼 · 글자 버튼). 눌러야 초대 시트가 열린다.
  return (
    <View style={[styles.sheet, style]} testID="couple-gate">
      <View style={styles.handle} />
      <View style={styles.circles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.circleSelf} />
        <View style={styles.circleOther} />
      </View>
      <Text style={styles.title}>{GATE_COPY.title}</Text>
      <Text style={styles.body}>{GATE_COPY.body}</Text>
      <View style={styles.button}>
        <PrimaryButton label={GATE_COPY.invite} onPress={() => router.push(invitePath as never)} testID="couple-gate-invite" />
      </View>
      <PressScale
        onPress={() => router.push(`${invitePath}&step=enter` as never)}
        accessibilityLabel={GATE_COPY.enter}
        style={styles.linkWrap}
        testID="couple-gate-enter"
      >
        <Text style={styles.link}>{GATE_COPY.enter}</Text>
      </PressScale>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderRadius: shape.radius.sheet,
    backgroundColor: nocturne.inkRaise,
    borderWidth: 1,
    borderColor: nocturne.hairline,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: withAlpha(nocturne.text, 0.2), marginBottom: 14 },
  circles: { flexDirection: 'row', marginBottom: 12 },
  circleSelf: { width: 48, height: 48, borderRadius: 24, backgroundColor: nocturne.mist, opacity: 0.8 },
  circleOther: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: -14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.3),
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: 21, lineHeight: 28, color: nocturne.text, textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: 13.5, lineHeight: 21, color: nocturne.textSub, textAlign: 'center' },
  button: { marginTop: 14, width: '100%' },
  linkWrap: { minHeight: shape.touch, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fontFamily.medium, fontSize: 15, color: nocturne.lilacText },
})
