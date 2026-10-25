/**
 * 실시간 메우기(R37-3) - 실시간은 알림이고 진실은 조회다.
 *
 * 구독이 `SUBSCRIBED`가 될 때(다시 연결될 때도 같은 신호), 앱이 앞으로 돌아올 때(AppState `active`)
 * "마지막으로 받은 서버 메시지" 이후를 조회해 합친다. 합치기는 `mergeMessages`(id 또는 clientMsgId가 같으면 하나)라
 * 같은 메시지가 실시간과 조회로 두 번 와도 화면에는 하나다.
 *
 * 이 파일은 순수 조각만 가진다(저장소·RN을 가져오지 않는다) - 조회 함수는 인자로 받는다.
 */
import { mergeMessages, rowToChatMessage, type ChatMessage } from './chatMessages'
import type { Database } from '../types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

/** 서버가 확정한 메시지 중 가장 늦은 `sentAt`. 임시 로컬 항목(`local:`)은 서버가 받은 적이 없어 뺀다. 없으면 null. */
export function latestServerSentAt(list: readonly ChatMessage[]): string | null {
  let latest: string | null = null
  for (const m of list) {
    if (m.id.startsWith('local:')) continue
    if (latest === null || m.sentAt.localeCompare(latest) > 0) latest = m.sentAt
  }
  return latest
}

export interface GapFillDeps {
  getMessages: () => readonly ChatMessage[]
  /** `afterSentAt` 이상(같은 시각 포함)의 메시지. null이면 처음부터. */
  fetchAfter: (afterSentAt: string | null) => Promise<MessageRow[]>
  /** 조회 결과를 화면 상태에 합친다(`prev => mergeMessages(prev, ...)`). */
  apply: (update: (prev: ChatMessage[]) => ChatMessage[]) => void
}

/** 마지막으로 받은 메시지 이후를 조회해 합친다. 조회가 실패하면 조용히 넘어간다(다음 신호 때 다시). */
export async function fillMessageGap(deps: GapFillDeps): Promise<void> {
  const after = latestServerSentAt(deps.getMessages())
  let rows: MessageRow[]
  try {
    rows = await deps.fetchAfter(after)
  } catch {
    return
  }
  if (rows.length === 0) return
  const incoming = rows.map(rowToChatMessage)
  deps.apply((prev) => mergeMessages(prev, incoming))
}
