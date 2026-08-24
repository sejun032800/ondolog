/**
 * 커플 전용 기능 공통 게이팅 래퍼.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8 "미연결 유저 처리 원칙(전역)"
 *   "진입 차단이 아니라 기능 단위 게이팅. 미연결 유저도 모든 탭에 들어올
 *   수 있고, 커플 전용 기능을 탭하는 순간 초대 모달이 뜬다."
 *   "잠긴 문을 보여주는 게 문을 숨기는 것보다 초대 동기가 강하다."
 * Part 11-2 탭별 게이팅 범위 표 — 탭에 따라 "진입 가능(잠긴 카드만
 * 노출)" 또는 "진입 즉시 모달"로 강도가 다르다. `autoOpenInvite`로
 * 두 방식을 모두 지원한다.
 *
 * 이 컴포넌트는 연결 여부만 읽는다(useCoupleStore) — 연결 판정 자체는
 * 서버 조회 결과를 그대로 반영할 뿐, 여기서 새로 계산하지 않는다.
 */

import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useCoupleStore } from '../store/coupleStore'

interface CoupleGateProps {
  children: React.ReactNode
  /** 잠금 상태일 때 보여줄 대체 UI. 생략 시 기본 "잠긴 문" 카드를 쓴다. */
  fallback?: React.ReactNode
  /**
   * true면 화면 진입과 동시에 초대 모달로 이동한다(Part 11-2 "채팅" 탭처럼
   * "진입 즉시 초대 모달"인 기능용). false(기본)면 잠긴 카드를 보여주고
   * 탭했을 때만 모달을 띄운다("메인/피드/매거진"처럼 "진입 가능"인 기능용).
   */
  autoOpenInvite?: boolean
  style?: ViewStyle
}

/** 아직 서버 조회 전(status === 'unknown' | 'loading')에는 아무것도 확정하지 않는다. */
export function CoupleGate({
  children,
  fallback,
  autoOpenInvite = false,
  style,
}: CoupleGateProps) {
  const router = useRouter()
  const status = useCoupleStore((s) => s.status)
  const isConnected = status === 'connected'
  const isSettled = status === 'connected' || status === 'disconnected'

  useEffect(() => {
    if (autoOpenInvite && isSettled && !isConnected) {
      router.push('/couple-gate')
    }
  }, [autoOpenInvite, isSettled, isConnected, router])

  if (isConnected) return <>{children}</>

  if (!isSettled) return null

  if (autoOpenInvite) return null // 모달 이동 대기 중 — 빈 화면 대신 모달이 곧 뜬다

  if (fallback) return <>{fallback}</>

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.emoji}>🔒</Text>
      <Text style={styles.title}>연인과 연결하면 열려요</Text>
      <Text style={styles.body}>
        상대만 있으면 이 기능이 바로 열립니다. 아직 초대하지 않았다면
        지금 코드를 보내보세요.
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => router.push('/couple-gate')}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>초대하기</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    gap: 8,
    padding: 24,
  },
  emoji: { fontSize: 32 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { color: '#6B6258', fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#E86A3E',
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
})
