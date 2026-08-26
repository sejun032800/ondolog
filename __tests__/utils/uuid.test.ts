import { generateUuidV4 } from '../../src/utils/uuid'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('generateUuidV4', () => {
  it('RFC 4122 v4 형식의 문자열을 반환한다', () => {
    expect(generateUuidV4()).toMatch(UUID_V4_PATTERN)
  })

  it('호출마다 서로 다른 값을 반환한다(멱등 키 용도 — client_msg_id 충돌 회피)', () => {
    const values = Array.from({ length: 50 }, () => generateUuidV4())
    expect(new Set(values).size).toBe(50)
  })
})
