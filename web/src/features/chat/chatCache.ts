/**
 * 채팅 기기 저장(76-A1 · R98-1) - 마지막으로 받은 메시지 **100건**(서버가 확정한 행만)을 이 기기에 남기고, 채팅이 열릴 때 서버 읽기 전에 먼저 그린다.
 * 키는 사용자 id + 커플 id(`cache/deviceCache`). 사진은 경로(메시지 행의 `mediaPath`)만 있고 파일 · 서명 URL은 없다 - 오프라인에서는 사진 칸이 자리(고정 비율)로 남는다.
 * 보내는 중 · 실패 · 기기 안 미리보기(`localUri`) 말풍선은 큐가 따로 가진다 - 여기에 저장하지 않는다.
 */
import { mergeMessages, type ChatMessage } from '@/utils/chatMessages'
import { readCache, writeCache } from '../../cache/deviceCache'

export const CHAT_CACHE_LIMIT = 100

interface ChatCacheValue {
  coupleId: string
  messages: ChatMessage[]
}

const isConfirmed = (m: ChatMessage) => !m.pending && !m.failed && !m.localUri && !m.id.startsWith('local:')

export function readChatCache(userId: string | null, coupleId: string | null): ChatMessage[] {
  if (!userId || !coupleId) return []
  const saved = readCache<ChatCacheValue>(userId, 'chat', coupleId)
  if (!saved || saved.coupleId !== coupleId || !Array.isArray(saved.messages)) return []
  return saved.messages.filter((m) => m && m.coupleId === coupleId && typeof m.sentAt === 'string')
}

export function writeChatCache(userId: string | null, coupleId: string | null, messages: readonly ChatMessage[]): void {
  if (!userId || !coupleId) return
  const confirmed = messages.filter(isConfirmed).slice(-CHAT_CACHE_LIMIT)
  writeCache(userId, 'chat', { coupleId, messages: confirmed } satisfies ChatCacheValue, coupleId)
}

/**
 * 76-r F5(R102-4): 채팅 머리의 마지막 상대 이름. 같은 저장 장치의 `chat` 범주(커플 id scope + `:head`)라 커플 자료 삭제 규칙에 그대로 든다.
 * 상대 id를 아직 모르거나(오프라인 시작) 이름 저장분이 없어도 머리가 비지 않게 한다.
 */
export function readChatHeadName(userId: string | null, coupleId: string | null): string | null {
  if (!userId || !coupleId) return null
  const saved = readCache<{ coupleId: string; name: string }>(userId, 'chat', `${coupleId}:head`)
  return saved && saved.coupleId === coupleId && typeof saved.name === 'string' && saved.name ? saved.name : null
}

export function writeChatHeadName(userId: string | null, coupleId: string | null, name: string): void {
  if (!userId || !coupleId || !name) return
  if (readChatHeadName(userId, coupleId) === name) return
  writeCache(userId, 'chat', { coupleId, name }, `${coupleId}:head`)
}

/**
 * 서버 읽기가 오면 기기 저장분을 **교체**한다: 서버가 확정한 옛 행은 서버 목록으로 바뀌고(서버에서 지워진 것은 사라진다),
 * 보내는 중 · 실패 말풍선과, 서버 목록보다 새로 실시간으로 들어온 행은 남긴다.
 */
export function replaceWithServer(prev: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const newest = server.reduce((max, m) => (m.sentAt > max ? m.sentAt : max), '')
  const keep = prev.filter((m) => !isConfirmed(m) || (newest !== '' && m.sentAt > newest))
  return mergeMessages(keep, server)
}
