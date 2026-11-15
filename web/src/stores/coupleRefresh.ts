/**
 * 커플 상태 다시 읽기 한 곳(A-19) - 연결 상태(`coupleStore`)와 해제 유예(`dissolutionStore`)를 함께 읽는다.
 * 메인 · 설정 · 채팅이 같은 함수를 부르고, 읽는 중에 또 불리면 같은 읽기를 돌려준다(한 번에 하나).
 * 이미 읽은 값은 읽는 동안 비우지 않는다(두 스토어의 규칙).
 */
import { useCoupleStore } from './coupleStore'
import { useDissolutionStore } from './dissolutionStore'

let inflight: Promise<void> | null = null

export function refreshCoupleState(userId: string): Promise<void> {
  if (inflight) return inflight
  inflight = Promise.all([useCoupleStore.getState().refresh(userId), useDissolutionStore.getState().refresh(userId)])
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { inflight = null })
  return inflight
}
