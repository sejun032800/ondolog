/**
 * 채팅 탭 — Part 11-2: "채팅 | 미연결 시: 진입 즉시 초대 모달".
 * Phase 4 범위에서는 게이팅 배선 + 빈 상태만(실시간 채팅은 Phase 5 —
 * 이번 작업 범위 아님, 착수하지 않는다).
 *
 * docs/ONDOLOG_DESIGN.md §13-3: 실시간 대화 자체는 Phase 5 범위라 이번엔
 * 손대지 않는다. 지면 헤더(§4-1)만 얹는다.
 */
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CoupleGate } from '../../src/components/CoupleGate'
import { PageHeader } from '../../src/components/PageHeader'
import { useTheme } from '../../src/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function ChatTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)
  const { colors, typography } = useTheme()

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="채 팅" />
      <CoupleGate autoOpenInvite>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}>
          <Text style={[typography.body, { color: colors.inkMute }]}>
            채팅 기능은 곧 열려요. (Phase 5 범위)
          </Text>
        </View>
      </CoupleGate>
    </SafeAreaView>
  )
}
