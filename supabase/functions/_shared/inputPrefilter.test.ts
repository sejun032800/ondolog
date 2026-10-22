/// <reference types="jest" />
import { assembleCornerInput } from './inputAssembly.ts'
import { isTrivialMessageText } from './inputPrefilter.ts'
import { COUPLE_A, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'
import { fakeClient } from './testFixtures/inputAssemblyFake.ts'
/** 시험용 호 ID - 사진의 목적지 경로가 싣는다(§17-0-10-D). */
const TEST_ISSUE_ID = 'issue-test'


/**
 * 입력 전처리 - 본문 없는 조각 제거 (MASTER §17-0-9-F-2, r61 좁힘 / 위임 52r3-).
 * 규칙은 이것 하나뿐이고(다툼 어휘·다정 단서·건수 절단은 쓰지 않는다), 뺀 것은 세어서 반환한다.
 */

describe('isTrivialMessageText - 본문이 비었거나 공백뿐인 메시지만 뺀다 (r61)', () => {
  it.each([[''], ['   '], ['\n'], ['\n\n'], ['\t \n  \r\n'], ['\u00a0\u3000']])('%j 는 뺀다', (text) => {
    expect(isTrivialMessageText(text)).toBe(true)
  })

  it.each([
    ['ㅋㅋㅋ'],
    ['❤️'],
    ['응?'],
    ['콜 🍺'],
    ['ㅋ'],
    ['ㅠㅠ'],
    ['응'],
    ['?'],
    ['...'],
    ['💛'],
    ['https://example.com/a?b=1'],
    ['응응'],
    ['오늘 비 온대'],
    ['ㅋㅋ 웃겨'],
    ['  ㅋ  '],
  ])('%j 는 남긴다', (text) => {
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

  it('본문이 비었거나 공백뿐인 메시지는 레코드에서 빠지고 trivialMessages로 센다 - 본문 없는 메시지와 겹치지 않는다', async () => {
    const data = {
      couples: [{ id: COUPLE_A, subscription_tier: 'free' }],
      profiles: [{ id: 'u1', display_name: '세준' }],
      messages: [
        row('m-null', T('09:00'), null),
        row('m-space', T('09:02'), '   '),
        row('m-nl', T('09:03'), '\n\n'),
        row('m-k', T('09:04'), 'ㅋㅋㅋ'),
        row('m-heart', T('09:05'), '❤️'),
        row('m-q', T('09:06'), '응?'),
        row('m-call', T('09:07'), '콜 🍺'),
        row('m-ok', T('09:08'), '오늘 비 온대'),
        row('m-out', '2026-07-31T09:00:00+09:00', '   '),
      ],
      dates: [],
      date_stops: [],
      data_entries: [],
    }
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT, TEST_ISSUE_ID)
    expect(r.messages.map((m) => m.id)).toEqual(['m-k', 'm-heart', 'm-q', 'm-call', 'm-ok'])
    expect(r.exclusions.messagesWithoutBody).toBe(1)
    // 이번 기간 안의 것만 센다 - 기간 밖의 공백뿐인 본문(m-out)은 세지 않는다.
    // 빈 문자열('')은 아래 R20-1 시험이 따로 본다 - 여기서는 공백·줄바꿈뿐인 둘만 센다.
    expect(r.exclusions.trivialMessages).toBe(2)
  })

  // R20-1 - 빈 문자열 본문은 공백뿐인 본문과 같이 빼고 센다. 입력 조립 전체를 실패시키지 않는다.
  it("빈 문자열('') 본문 하나가 섞여도 입력 조립이 성공하고 trivialMessages가 1 늘어난다", async () => {
    const base = [row('m-a', T('09:00'), '오늘 비 온대'), row('m-b', T('09:01'), '우산 챙겨')]
    const tablesWith = (messages: ReturnType<typeof row>[]) => ({
      couples: [{ id: COUPLE_A, subscription_tier: 'free' }],
      profiles: [{ id: 'u1', display_name: '세준' }],
      messages,
      dates: [],
      date_stops: [],
      data_entries: [],
    })
    const without = await assembleCornerInput(fakeClient(tablesWith(base)), MONTHLY_CONTEXT, TEST_ISSUE_ID)
    const withEmpty = await assembleCornerInput(
      fakeClient(tablesWith([...base, row('m-empty', T('09:02'), '')])),
      MONTHLY_CONTEXT,
      TEST_ISSUE_ID,
    )
    expect(withEmpty.exclusions.trivialMessages).toBe(without.exclusions.trivialMessages + 1)
    expect(withEmpty.messages.map((m) => m.id)).toEqual(['m-a', 'm-b'])
    expect(withEmpty.exclusions.messagesWithoutBody).toBe(0)
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
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT, TEST_ISSUE_ID)
    expect(r.messages[0].source.text).toBe(body)
    expect(r.exclusions.trivialMessages).toBe(0)
  })
})
