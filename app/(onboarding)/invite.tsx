/**
 * 화면 8. 연인 초대.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8 —
 *   UI: 초대코드 발급+공유 / 상대 코드 입력 / "나중에 할게요" / "솔로예요"
 *   스킵 시: 즉시 메인 탭 진입
 *   AC: 코드 중복 불가, 이미 연결된 유저 코드 무효
 *
 * 실제 UI/로직은 `src/components/InvitePanel.tsx`(초대 모달과 공유) —
 * 이 파일은 온보딩 맥락의 콜백(성공 시 화면 +로, 스킵 시 메인 탭으로)만
 * 정의한다.
 */
import { useRouter } from 'expo-router'
import { Alert, View } from 'react-native'
import { InvitePanel } from '../../src/components/InvitePanel'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useSession } from '../../src/hooks/useSession'
import {
  completeOnboardingWithoutCouple,
  markInviteDoneAwaitingStartDate,
} from '../../src/services/coupleApi'

export default function InviteScreen() {
  const router = useRouter()
  const { session } = useSession()

  if (!session) return <View />

  const userId = session.user.id

  return (
    <ScreenContainer
      title="연인을 초대해보세요"
      subtitle="상대만 있으면 모든 기능이 열려요. 나중에 해도 괜찮아요."
    >
      <InvitePanel
        userId={userId}
        onConnected={async () => {
          try {
            await markInviteDoneAwaitingStartDate(userId)
            router.replace('/start-date')
          } catch (e) {
            Alert.alert('처리에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
          }
        }}
        onSkip={async () => {
          try {
            await completeOnboardingWithoutCouple(userId)
            router.replace('/main')
          } catch (e) {
            Alert.alert('처리에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
          }
        }}
      />
    </ScreenContainer>
  )
}
