/**
 * client_msg_id 등 클라이언트 측 멱등 키 생성용 UUID v4.
 *
 * `crypto.randomUUID()`가 있으면(런타임에 따라 다름) 그것을 쓰고, 없으면
 * Math.random 기반 폴백을 쓴다. 이 함수는 CLAUDE.md 절대 규칙 2("연애유형
 * 채점 로직에 랜덤 요소 금지")의 대상이 아니다 — 그 규칙은 `src/engine/`의
 * 결정론 계약(동일 입력 → 동일 출력)에 관한 것이고, 이 함수는 메시지마다
 * 매번 다른 식별자를 만드는 것 자체가 목적이라 성격이 다르다
 * (`__tests__/engine/determinismStaticRules.test.ts`도 `src/engine/`만
 * 스캔한다). 암호학적 강도는 필요 없다 — DB 유니크 제약(`uq_messages_client_id`)
 * 충돌 회피용 식별자일 뿐이다.
 */
export function generateUuidV4(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (typeof g.crypto?.randomUUID === 'function') {
    return g.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
