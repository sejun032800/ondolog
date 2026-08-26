import {
  groupMessagesByDate,
  mergeMessage,
  mergeMessages,
  pickUnreadFromPartner,
  sortMessagesBySentAt,
  type ChatMessage,
} from '../../src/utils/chatMessages'

/**
 * `groupMessagesByDate`(내부 `dateKeyOf`)는 기기 로컬 타임존 기준으로
 * 날짜를 계산한다(2026-08-26 코디네이터 리뷰 — UTC slice와 `ChatBubble`의
 * 로컬 시각 표시가 어긋나던 버그 수정).
 *
 * 이 파일의 날짜 경계 테스트를 실행 환경의 타임존에 의존하지 않게
 * 만들기 위해 `process.env.TZ`를 테스트 안에서 재설정하는 방식을
 * 시도했으나, 이 프로젝트의 Jest 워커(`jest-expo`/RN 프리셋)에서는
 * 프로세스 시작 이후의 `process.env.TZ` 변경이 `Date`의 로컬 계산에
 * 반영되지 않음을 직접 확인했다(V8/Jest 워커의 타임존 캐싱 — 워커
 * 시작 시점에 상속받은 값으로 고정된다). 그래서 대신 "로컬 자정"을
 * `new Date(y, m-1, d, h, mi, s)` 생성자(로컬 시각으로 해석됨)로 직접
 * 겨냥해 만든다 — 실행 환경이 실제로 어떤 타임존이든(KST든 UTC든)
 * "이 값들은 로컬 기준 이러이러한 날짜다"라는 사실 자체는 항상
 * 참이므로, 결과적으로 환경에 무관하게 결정론적이다.
 */
function localIso(y: number, m: number, d: number, h = 0, mi = 0, s = 0): string {
  return new Date(y, m - 1, d, h, mi, s, 0).toISOString()
}

function localDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function localLabel(y: number, m: number, d: number): string {
  return `${y}년 ${m}월 ${d}일`
}

const msg = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'id-1',
  clientMsgId: null,
  coupleId: 'couple-1',
  senderId: 'user-1',
  body: 'hello',
  mediaPath: null,
  sentAt: '2026-08-26T10:00:00.000Z',
  readAt: null,
  ...overrides,
})

describe('mergeMessage — 완료 기준 1(중복 렌더링 없이 병합)', () => {
  it('새 메시지는 리스트에 추가된다', () => {
    const result = mergeMessage([], msg({ id: 'a' }))
    expect(result).toHaveLength(1)
  })

  it('낙관적 로컬 메시지(local:x)를 서버 확정 행(같은 clientMsgId, 다른 id)이 대체한다', () => {
    const optimistic = msg({
      id: 'local:client-1',
      clientMsgId: 'client-1',
      pending: true,
      sentAt: '2026-08-26T10:00:00.000Z',
    })
    const confirmed = msg({
      id: 'server-real-id',
      clientMsgId: 'client-1',
      pending: false,
      sentAt: '2026-08-26T10:00:01.000Z',
    })

    const list = mergeMessage([optimistic], confirmed)

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('server-real-id')
    expect(list[0].pending).toBe(false)
  })

  it('같은 id에 대한 갱신(예: read_at 변경)은 새 항목을 만들지 않고 교체한다', () => {
    const original = msg({ id: 'a', readAt: null })
    const updated = msg({ id: 'a', readAt: '2026-08-26T11:00:00.000Z' })

    const list = mergeMessage([original], updated)

    expect(list).toHaveLength(1)
    expect(list[0].readAt).toBe('2026-08-26T11:00:00.000Z')
  })

  it('clientMsgId가 둘 다 null이면 id로만 판단해 서로 다른 메시지로 추가된다', () => {
    const a = msg({ id: 'a', clientMsgId: null })
    const b = msg({ id: 'b', clientMsgId: null })
    expect(mergeMessage([a], b)).toHaveLength(2)
  })
})

describe('mergeMessages', () => {
  it('여러 행을 순서대로 병합한다', () => {
    const rows = [msg({ id: 'a', sentAt: '2026-08-26T10:00:00.000Z' }), msg({ id: 'b', sentAt: '2026-08-26T10:01:00.000Z' })]
    const result = mergeMessages([], rows)
    expect(result.map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('sortMessagesBySentAt', () => {
  it('sentAt 오름차순으로 정렬한다', () => {
    const list = [
      msg({ id: 'later', sentAt: '2026-08-26T12:00:00.000Z' }),
      msg({ id: 'earlier', sentAt: '2026-08-26T09:00:00.000Z' }),
    ]
    expect(sortMessagesBySentAt(list).map((m) => m.id)).toEqual(['earlier', 'later'])
  })

  it('동일 입력에 항상 동일한 순서를 반환한다(결정론)', () => {
    const list = [msg({ id: 'b' }), msg({ id: 'a' })]
    const results = Array.from({ length: 10 }, () => sortMessagesBySentAt(list).map((m) => m.id))
    expect(new Set(results.map((r) => r.join(','))).size).toBe(1)
  })
})

describe('pickUnreadFromPartner — 완료 기준 3(발신자 자신은 갱신 대상에서 제외)', () => {
  const me = 'user-me'
  const partner = 'user-partner'

  it('상대가 보낸 미확인 메시지의 id를 반환한다', () => {
    const list = [msg({ id: 'a', senderId: partner, readAt: null })]
    expect(pickUnreadFromPartner(list, me)).toEqual(['a'])
  })

  it('내가 보낸 메시지는 제외한다(읽음은 수신자만 갱신)', () => {
    const list = [msg({ id: 'a', senderId: me, readAt: null })]
    expect(pickUnreadFromPartner(list, me)).toEqual([])
  })

  it('이미 읽은 메시지는 제외한다', () => {
    const list = [msg({ id: 'a', senderId: partner, readAt: '2026-08-26T12:00:00.000Z' })]
    expect(pickUnreadFromPartner(list, me)).toEqual([])
  })

  it('아직 서버 확정 전(pending)인 항목은 제외한다', () => {
    const list = [msg({ id: 'local:x', senderId: partner, readAt: null, pending: true })]
    expect(pickUnreadFromPartner(list, me)).toEqual([])
  })
})

describe('groupMessagesByDate', () => {
  it('같은 (로컬) 날짜 메시지는 한 그룹으로 묶인다', () => {
    const list = [
      msg({ id: 'a', sentAt: localIso(2026, 8, 26, 9, 0, 0) }),
      msg({ id: 'b', sentAt: localIso(2026, 8, 26, 22, 0, 0) }),
    ]
    const groups = groupMessagesByDate(list)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe(localLabel(2026, 8, 26))
    expect(groups[0].messages.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('로컬 날짜가 다르면 여러 그룹으로 나뉘고 시간순을 유지한다', () => {
    const list = [
      msg({ id: 'day2', sentAt: localIso(2026, 8, 27, 19, 0, 0) }),
      msg({ id: 'day1', sentAt: localIso(2026, 8, 26, 19, 0, 0) }),
    ]
    const groups = groupMessagesByDate(list)
    expect(groups.map((g) => g.dateKey)).toEqual([
      localDateKey(2026, 8, 26),
      localDateKey(2026, 8, 27),
    ])
  })

  /**
   * 경계 케이스 1(버그 리포트 사례): 실제 UTC 날짜가 같은지 여부와
   * 무관하게, 로컬 자정을 사이에 둔 두 메시지는 서로 다른 그룹이어야
   * 한다. 수정 전 `dateKeyOf`(`sentAt.slice(0, 10)`)는 UTC 날짜만
   * 봤기 때문에, KST처럼 UTC보다 앞선 타임존에서는 이 둘이 실제로
   * 같은 UTC 날짜에 속해 하나로 묶여버렸다 — 그러면서 시각 표시
   * (`ChatBubble`의 `formatTime`, 로컬 기준)는 다음 날 새벽으로 보여
   * 날짜 구분선과 시각이 서로 모순됐다. 이 테스트는 두 인스턴트를
   * "로컬" 자정 바로 앞뒤로 직접 겨냥해 만들었기 때문에 실행 환경의
   * 실제 타임존이 무엇이든(오프셋이 0이 아닌 한) 항상 재현된다.
   */
  it('로컬 자정을 넘는 두 메시지는 다른 그룹으로 나뉜다(버그 리포트 사례)', () => {
    const list = [
      msg({ id: 'before-local-midnight', sentAt: localIso(2026, 8, 26, 23, 59, 59) }),
      msg({ id: 'after-local-midnight', sentAt: localIso(2026, 8, 27, 0, 0, 1) }),
    ]
    const groups = groupMessagesByDate(list)

    expect(groups.map((g) => g.dateKey)).toEqual([
      localDateKey(2026, 8, 26),
      localDateKey(2026, 8, 27),
    ])
    expect(groups[0].messages.map((m) => m.id)).toEqual(['before-local-midnight'])
    expect(groups[1].messages.map((m) => m.id)).toEqual(['after-local-midnight'])
    expect(groups[1].label).toBe(localLabel(2026, 8, 27))
  })

  /**
   * 경계 케이스 2(반대 방향): 같은 로컬 날짜 안의 두 메시지는, 그 사이에
   * UTC 자정이 끼어 있어 서로 다른 UTC 날짜에 걸치더라도(KST처럼
   * UTC보다 앞선 타임존이면 로컬 하루가 항상 UTC 날짜 두 개에 걸친다)
   * 한 그룹으로 묶여야 한다.
   */
  it('같은 로컬 날짜의 메시지는 UTC 날짜가 갈리더라도 한 그룹으로 묶인다(반대 방향 경계)', () => {
    const list = [
      msg({ id: 'early-local', sentAt: localIso(2026, 8, 27, 0, 0, 1) }),
      msg({ id: 'late-local', sentAt: localIso(2026, 8, 27, 23, 59, 59) }),
    ]
    const groups = groupMessagesByDate(list)

    expect(groups).toHaveLength(1)
    expect(groups[0].dateKey).toBe(localDateKey(2026, 8, 27))
    expect(groups[0].label).toBe(localLabel(2026, 8, 27))
    expect(groups[0].messages.map((m) => m.id)).toEqual(['early-local', 'late-local'])
  })
})
