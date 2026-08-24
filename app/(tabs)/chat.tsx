/**
 * 채팅 탭 — Part 11-2: "채팅 | 미연결 시: 진입 즉시 초대 모달".
 * Phase 3 범위에서는 게이팅 배선만(실제 채팅 기능은 Phase 5+).
 */
import { useEffect } from 'react'
import { View } from 'react-native'
import { CoupleGate } from '../../src/components/CoupleGate'
import { COLORS } from '../../src/constants/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function ChatTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <View style={{ backgroundColor: COLORS.bg, flex: 1 }}>
      <CoupleGate autoOpenInvite>
        <View />
      </CoupleGate>
    </View>
  )
}
