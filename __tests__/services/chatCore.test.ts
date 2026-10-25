/**
 * U4 채팅 - 빈 본문 거부(R21-5): API 함수가 서버에 가기 전에 막는다. DB 제약은 더하지 않았다.
 */
import { sendMessage as sendViaApi } from '../../src/services/chatApi'
import { EMPTY_BODY_ERROR, createStory, sendMessage, signChatMedia, uploadChatMedia, type ChatDb } from '../../src/services/chatCore'

const mockFrom = jest.fn()
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), storage: {} },
}))

const base = { clientMsgId: 'm1', coupleId: 'c1', senderId: 'u1' }

function insertDb(result: { data?: unknown; error?: { code?: string } | null }) {
  const single = jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ insert })
  return { db: { from } as unknown as ChatDb, from, insert }
}

describe('sendMessage - 빈 본문 거부', () => {
  it.each(['', '   ', '\n\t', '　'])('공백뿐인 본문(%j)은 서버에 가지 않고 영구 실패로 돌려준다', async (body) => {
    const { db, from } = insertDb({})
    const result = await sendMessage(db, { ...base, body })
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.errorClass).toBe('permanent')
      expect((result.error as Error).message).toBe(EMPTY_BODY_ERROR)
    }
    expect(from).not.toHaveBeenCalled()
  })

  it('null 본문 + 사진 없음도 거부한다', async () => {
    const { db, from } = insertDb({})
    const result = await sendMessage(db, { ...base, body: null })
    expect(result.status).toBe('failed')
    expect(from).not.toHaveBeenCalled()
  })

  it('앱이 부르는 chatApi.sendMessage도 같은 거부다(서버를 부르지 않는다)', async () => {
    mockFrom.mockClear()
    const result = await sendViaApi({ ...base, body: '   ' })
    expect(result.status).toBe('failed')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('글자가 있는 본문은 그대로 넣는다', async () => {
    const { db, insert } = insertDb({ data: { id: 'row1' } })
    const result = await sendMessage(db, { ...base, body: '안녕' })
    expect(result.status).toBe('sent')
    expect(insert).toHaveBeenCalledWith({
      couple_id: 'c1',
      sender_id: 'u1',
      body: '안녕',
      media_path: null,
      client_msg_id: 'm1',
    })
  })

  it('사진 메시지는 본문 없이 media_path로 넣는다(본문은 null)', async () => {
    const { db, insert } = insertDb({ data: { id: 'row2' } })
    const result = await sendMessage(db, { ...base, body: null, mediaPath: 'c1/m1.jpg' })
    expect(result.status).toBe('sent')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ body: null, media_path: 'c1/m1.jpg' }))
  })

  it('중복 삽입(23505)은 이미 전송됨으로 본다(멱등 재전송은 그대로)', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'old' }, error: null })
    const eq2 = jest.fn().mockReturnValue({ maybeSingle })
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
    const selectRead = jest.fn().mockReturnValue({ eq: eq1 })
    const single = jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } })
    const selectInsert = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select: selectInsert })
    const from = jest.fn().mockReturnValue({ insert, select: selectRead })
    const result = await sendMessage({ from } as unknown as ChatDb, { ...base, body: '안녕' })
    expect(result.status).toBe('already_sent')
  })
})

describe('사진 올리기·서명·스토리', () => {
  it('같은 경로가 이미 있으면(재시도) 올리기 성공으로 본다', async () => {
    const upload = jest.fn().mockResolvedValue({ error: { message: 'The resource already exists', statusCode: '409' } })
    const db = { storage: { from: () => ({ upload }) } } as unknown as ChatDb
    expect(await uploadChatMedia(db, 'messages', 'c1/m1.jpg', new ArrayBuffer(1), 'image/jpeg')).toEqual({ ok: true })
    expect(upload).toHaveBeenCalledWith('c1/m1.jpg', expect.anything(), { contentType: 'image/jpeg', upsert: false })
  })

  it('다른 올리기 오류는 실패로 돌려준다', async () => {
    const upload = jest.fn().mockResolvedValue({ error: { message: 'boom', statusCode: '500' } })
    const db = { storage: { from: () => ({ upload }) } } as unknown as ChatDb
    expect((await uploadChatMedia(db, 'stories', 'c1/s.jpg', new ArrayBuffer(1), 'image/jpeg')).ok).toBe(false)
  })

  it('서명은 못 만든 경로를 뺀다', async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: 'c1/a.jpg', signedUrl: 'https://example.invalid/a' },
        { path: 'c1/placeholder', signedUrl: null },
      ],
      error: null,
    })
    const db = { storage: { from: () => ({ createSignedUrls }) } } as unknown as ChatDb
    expect(await signChatMedia(db, 'stories', ['c1/a.jpg', 'c1/placeholder'])).toEqual({ 'c1/a.jpg': 'https://example.invalid/a' })
  })

  it('스토리는 올린 사진 경로와 24시간 뒤 만료로 넣는다(캡션 없음)', async () => {
    const { db, insert } = insertDb({ data: { id: 's1' } })
    const now = new Date('2026-10-25T00:00:00Z')
    await createStory(db, { coupleId: 'c1', authorId: 'u1', mediaPath: 'c1/s.jpg' }, now)
    expect(insert).toHaveBeenCalledWith({
      couple_id: 'c1',
      author_id: 'u1',
      media_path: 'c1/s.jpg',
      caption: null,
      expires_at: '2026-10-26T00:00:00.000Z',
    })
  })
})
