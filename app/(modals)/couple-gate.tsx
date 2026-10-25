/**
 * 초대 모달(F02 미연결 진입 - 초대) - Part 11-3 `couple-gate.tsx`. `<CoupleGate>`의 초대 진입(채팅은 진입 즉시, 그 밖은 버튼)이
 * 여기로 온다. 아래 화면이 비치는 투명 모달 위에 시트(`InviteSheet`)를 올린다. 나가는 길 = 바깥(어둡게 한 면) 누르기.
 *
 * 코드 발급·입력은 기존 함수(`coupleApi`)를 그대로 쓴다. 연결되면 사귄 날짜 입력(`/start-date`)으로 간다(기존 동작).
 * `?from=chat`이면 안내 문구가 채팅 문구가 된다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { InviteSheet } from '../../src/components/couple/InviteSheet'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function CoupleGateModal() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string }>()
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  if (!session) return <View style={{ flex: 1 }} />

  return (
    <InviteSheet
      userId={session.user.id}
      fromChat={params.from === 'chat'}
      onClose={() => router.back()}
      onConnected={() => router.replace('/start-date')}
    />
  )
}
