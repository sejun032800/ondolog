import { CHAT_METRICS_V0, computeChatMetrics, hasEmoji, quantile, type ChatEvent } from '../../src/engine/chatMetrics'

/**
 * 2.0-A1 ① 채팅 지표 엔진(R157-3 · R157-4) - 손으로 만든 대화 견본(합성)으로 지표마다 기대값을 고정한다.
 */

const A = 'user-a'
const B = 'user-b'
let seq = 0
function ev(senderId: string, at: string, text: string | null = '응'): ChatEvent {
  seq += 1
  return { id: `m-${String(seq).padStart(4, '0')}`, senderId, sentAt: `${at}+09:00`, kind: text === null ? 'media' : 'text', text }
}

/** 견본: 묶음 3개(9/1 아침 · 9/1 밤 · 9/3) - 6시간 공백으로 나뉜다. */
function sample(): ChatEvent[] {
  seq = 0
  return [
    // 묶음 1 (A 시작): A, B(+60s), B(+30s), A(+120s)
    ev(A, '2026-09-01T08:00:00', '좋은 아침 ☀️'),
    ev(B, '2026-09-01T08:01:00', '응 잘 잤어'),
    ev(B, '2026-09-01T08:01:30', null), // 사진
    ev(A, '2026-09-01T08:03:30', '귀엽다 😍'),
    // 묶음 2 (B 시작, 14:03:30 이후 = 6시간 이상 뒤): B, A(+300s)
    ev(B, '2026-09-01T21:00:00', '퇴근!'),
    ev(A, '2026-09-01T21:05:00', '수고했어'),
    // 묶음 3 (A 시작): A, A, B(+600s)
    ev(A, '2026-09-03T10:00:00', '점심 뭐 먹지'),
    ev(A, '2026-09-03T10:00:10', '추천해줘 🍜'),
    ev(B, '2026-09-03T10:10:10', '국수'),
  ]
}

describe('채팅 지표 v0 - 견본 기대값', () => {
  const m = computeChatMetrics(sample(), [A, B])

  it('묶음 · 건수', () => {
    expect(m.version).toBe('chat_metrics_v0')
    expect(m.messageCount).toBe(9)
    expect(m.sessionCount).toBe(3)
  })

  it('① 왕복 리듬 - 바뀐 자리마다 앞사람 마지막 -> 새 사람 첫 메시지 간격(초)', () => {
    // 바뀐 자리: 60(B) · 120(A) · 300(A) · 600(B)
    expect(m.replyGap?.all).toEqual({ count: 4, q1: 105, median: 210, q3: 375 })
    expect(m.replyGap?.byResponder.a).toEqual({ count: 2, q1: 165, median: 210, q3: 255 })
    expect(m.replyGap?.byResponder.b).toEqual({ count: 2, q1: 195, median: 330, q3: 465 })
  })

  it('② 주고받기 비율 = Σ바뀐 횟수 ÷ Σ(메시지 수 − 1)', () => {
    // 묶음 1: 바뀜 2 / 3 · 묶음 2: 1 / 1 · 묶음 3: 1 / 2 -> 4 / 6
    expect(m.turnTaking).toBe(0.6667)
  })

  it('③ 먼저 말 거는 쪽 = 묶음 첫 메시지 비율(합 1)', () => {
    expect(m.initiator).toEqual({ a: 0.6667, b: 0.3333 })
  })

  it('④ 이모지 비율 - 본문 메시지만 분모(사진 제외)', () => {
    // A 본문 5개 중 3개 · B 본문 3개(사진 1 제외) 중 0개
    expect(m.emoji).toEqual({ a: 0.6, b: 0 })
  })

  it('⑤ 가장 말이 많았던 날(KST) · 건수', () => {
    expect(m.busiestDay).toEqual({ date: '2026-09-01', count: 6 })
  })

  it('결과에 원문 · 메시지 id가 없다(숫자만)', () => {
    const text = JSON.stringify(m)
    for (const e of sample()) {
      expect(text).not.toContain(e.id)
      if (e.text !== null) expect(text).not.toContain(e.text)
    }
  })
})

describe('채팅 지표 v0 - 경계', () => {
  it('결정론: 두 번 계산 같음 · 입력 순서와 무관', () => {
    const s = sample()
    expect(computeChatMetrics(s, [A, B])).toEqual(computeChatMetrics([...s].reverse(), [A, B]))
  })

  it('묶음 경계: 공백이 정확히 6시간이면 새 묶음 · 1초 모자라면 같은 묶음', () => {
    seq = 0
    const six = [ev(A, '2026-09-01T00:00:00'), ev(B, '2026-09-01T06:00:00'), ev(A, '2026-09-01T06:00:05')]
    expect(computeChatMetrics(six, [A, B]).sessionCount).toBe(2)
    seq = 0
    const almost = [ev(A, '2026-09-01T00:00:00'), ev(B, '2026-09-01T05:59:59')]
    expect(computeChatMetrics(almost, [A, B]).sessionCount).toBe(1)
    expect(CHAT_METRICS_V0.sessionGapMs).toBe(6 * 3600 * 1000)
  })

  it('묶음 2개 미만이면 ①~④ 없음(0으로 채우지 않음) · ⑤는 있다', () => {
    seq = 0
    const m = computeChatMetrics([ev(A, '2026-09-01T09:00:00'), ev(B, '2026-09-01T09:01:00')], [A, B])
    expect(m).toMatchObject({ sessionCount: 1, replyGap: null, turnTaking: null, initiator: null, emoji: null })
    expect(m.busiestDay).toEqual({ date: '2026-09-01', count: 2 })
  })

  it('한 사람만 말함: 왕복 없음 · 주고받기 0(잰 값) · 먼저 말 거는 쪽 100/0 · 상대 이모지 없음', () => {
    seq = 0
    const m = computeChatMetrics([ev(A, '2026-09-01T09:00:00', '하나'), ev(A, '2026-09-01T09:00:10', '둘'), ev(A, '2026-09-02T09:00:00', '셋 🙂')], [A, B])
    expect(m.replyGap).toBeNull()
    expect(m.turnTaking).toBe(0)
    expect(m.initiator).toEqual({ a: 1, b: 0 })
    expect(m.emoji).toEqual({ a: 0.3333, b: null })
  })

  it('메시지 0: 모두 없음', () => {
    expect(computeChatMetrics([], [A, B])).toEqual({
      version: 'chat_metrics_v0',
      messageCount: 0,
      sessionCount: 0,
      busiestDay: null,
      replyGap: null,
      turnTaking: null,
      initiator: null,
      emoji: null,
    })
  })

  it('가장 말이 많았던 날 동점이면 이른 날 · 하루 경계는 KST 0시', () => {
    seq = 0
    const m = computeChatMetrics(
      [
        ev(A, '2026-09-02T23:59:00'),
        ev(B, '2026-09-03T00:01:00'), // KST 다음 날
        ev(A, '2026-09-01T10:00:00'),
      ],
      [A, B],
    )
    expect(m.busiestDay).toEqual({ date: '2026-09-01', count: 1 })
  })

  it('두 사람이 아닌 보낸 사람은 세지 않는다', () => {
    seq = 0
    expect(computeChatMetrics([ev('someone', '2026-09-01T09:00:00')], [A, B]).messageCount).toBe(0)
  })

  it('이모지 판정은 Extended_Pictographic 하나 - 숫자 · # · 한글 · 기호 문장부호는 아님', () => {
    expect(hasEmoji('좋아 😀')).toBe(true)
    expect(hasEmoji('❤')).toBe(true)
    expect(hasEmoji('ㅋㅋㅋ 123 #1 ^^ :)')).toBe(false)
  })

  it('분위수 R-7 선형 보간', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75)
    expect(quantile([7], 0.75)).toBe(7)
  })
})
