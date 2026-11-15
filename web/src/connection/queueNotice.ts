/**
 * "연결이 끊겼어요. 다시 연결되면 이어서 보내요"(F05)를 보일 사진 큐 항목인가(76-A2).
 * 사진은 올리기를 시작하는 순간 큐에 `pending`으로 들어가고 첫 시도가 곧바로 돈다 - 정상 연결에서 오래 걸리는 업로드를 "끊김"이라 하면 거짓 안내다(1부 A 3:41.9 · 2부 A 2:40.5).
 * 그래서 **지금 올리는 중인 항목은 세지 않고**(진행 중인 업로드 시간은 판정에서 뺀다), 시도가 실패해 다시 시도를 기다리는 항목(`pending`이고 시도 중이 아님)만 센다.
 * 글은 첫 시도가 실패한 뒤에야 큐에 들어와 이 규칙이 필요 없다.
 */
export function photoWaitingForRetry(item: { status: 'pending' | 'failed' }, attempting: boolean): boolean {
  return item.status === 'pending' && !attempting
}
