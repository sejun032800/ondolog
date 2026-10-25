/**
 * 채팅 큐 재개 대상 판정(R39-5) - 순수 함수.
 *
 * 큐(텍스트 · 사진)는 **로그인했고 커플로 연결된 동안에만** 돈다. 그 밖(로그아웃 · 미연결 · 커플 확인 전)에는 대상이 없다(null) -
 * 돌던 큐는 멈추되 **기기에 저장된 항목은 지우지 않는다**(다음 로그인에 이어 간다).
 */
export interface ChatQueueTarget {
  coupleId: string
  userId: string
}

export function resolveChatQueueTarget(input: {
  userId: string | null
  coupleStatus: 'unknown' | 'loading' | 'disconnected' | 'connected'
  coupleId: string | null
}): ChatQueueTarget | null {
  if (!input.userId) return null
  if (input.coupleStatus !== 'connected') return null
  if (!input.coupleId) return null
  return { coupleId: input.coupleId, userId: input.userId }
}
