/// <reference types="jest" />
import { assembleCornerInput } from './inputAssembly.ts'
import { isTrivialMessageText } from './inputPrefilter.ts'
import { COUPLE_A, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'
import { fakeClient } from './testFixtures/inputAssemblyFake.ts'

/**
 * 입력 전처리 - 의미 없는 조각 제거 (MASTER §17-0-9-F-2, r59 / 위임 52r2-).
 * 규칙은 이것 하나뿐이고(다툼 어휘·다정 단서·건수 절단은 쓰지 않는다), 뺀 것은 세어서 반환한다.
 */

describe('isTrivialMessageText - 의미 없는 조각', () => {
  it.each([
    [''],
    ['   '],
    ['ㅋ'],
    ['ㅋㅋㅋㅋ'],
    ['ㅠㅠ'],
    ['ㅇㅇ'],
    ['...'],
    ['?'],
    ['💛'],
    ['ㅋㅋ!!'],
    ['https://example.com/a?b=1'],
    ['  http://example.com  '],
    ['응'],
  ])('%j 는 뺀다', (text) => {
    expect(isTrivialMessageText(text)).toBe(true)
  })

  it.each([['응응'], ['오늘 비 온대'], ['보고 싶다'], ['ㅋㅋ 웃겨'], ['링크 봐 https://example.com'], ['A1']])('%j 는 남긴다', (text) => {
    expect(isTrivialMessageText(text)).toBe(false)
  })

  it('다툼·다정 어휘를 보지 않는다 - 내용으로 날을 지우지 않는다', () => {
    expect(isTrivialMessageText('서운해')).toBe(false)
    expect(isTrivialMessageText('화났어 진짜')).toBe(false)
    expect(isTrivialMessageText('고마워')).toBe(false)
  })
})

describe('입력 조립의 사유별 제외 건수 (F-2)', () => {
  const T = (hhmm: string) => `2026-08-22T${hhmm}:00+09:00`
  const row = (id: string, sentAt: string, body: string | null, over: Record<string, unknown> = {}) => ({
    id,
    couple_id: COUPLE_A,
    sender_id: 'u1',
    body,
    sent_at: sentAt,
    deleted_at: null,
    ...over,
  })

  it('의미 없는 조각은 레코드에서 빠지고 trivialMessages로 센다 - 본문 없는 메시지와 겹치지 않는다', async () => {
    const data = {
      couples: [{ id: COUPLE_A, subscription_tier: 'free' }],
      profiles: [{ id: 'u1', display_name: '세준' }],
      messages: [
        row('m-null', T('09:00'), null),
        row('m-k', T('09:01'), 'ㅋㅋㅋ'),
        row('m-dot', T('09:02'), '...'),
        row('m-link', T('09:03'), 'https://example.com/x'),
        row('m-ok', T('09:04'), '오늘 비 온대'),
        row('m-out', '2026-07-31T09:00:00+09:00', 'ㅋ'),
      ],
      dates: [],
      date_stops: [],
      data_entries: [],
    }
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.messages.map((m) => m.id)).toEqual(['m-ok'])
    expect(r.exclusions.messagesWithoutBody).toBe(1)
    // 이번 기간 안의 것만 센다 - 기간 밖의 'ㅋ'(m-out)은 세지 않는다.
    expect(r.exclusions.trivialMessages).toBe(3)
  })

  it('남긴 메시지의 원문은 그대로다(요약·교정 없음)', async () => {
    const body = '응  챙겼어\n(원문 그대로) ㅋㅋ'
    const data = {
      couples: [{ id: COUPLE_A, subscription_tier: 'free' }],
      profiles: [{ id: 'u1', display_name: '세준' }],
      messages: [row('m-1', T('09:00'), body)],
      dates: [],
      date_stops: [],
      data_entries: [],
    }
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.messages[0].source.text).toBe(body)
    expect(r.exclusions.trivialMessages).toBe(0)
  })
})
