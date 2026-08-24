/**
 * 초대 모달 — Part 11-3 "couple-gate.tsx # 초대 모달(화면 8과 동일
 * 컴포넌트 재사용)". `<CoupleGate>`의 기본 "초대하기" 버튼과 채팅 탭의
 * `autoOpenInvite`가 여기로 라우팅한다.
 *
 * 온보딩 화면 8과 달리 이 모달은 이미 온보딩을 마친 유저가 나중에
 * 초대하는 경로다 — 스킵은 그냥 모달을 닫는 것이고, 연결 성공 시에도
 * 사귄 날짜 입력(화면 +)은 여전히 필요하다.
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { InvitePanel } from '../../src/components/InvitePanel'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function CoupleGateModal() {
  const router = useRouter()
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  if (!session) return <View />

  return (
    <ScreenContainer
      title="연인을 초대해보세요"
      subtitle="상대만 있으면 이 기능이 바로 열려요."
    >
      <InvitePanel
        userId={session.user.id}
        onConnected={() => router.replace('/start-date')}
        onSkip={() => router.back()}
      />
    </ScreenContainer>
  )
}
