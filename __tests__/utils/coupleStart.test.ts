/**
 * A19 사귄 날짜 + 커플 닉네임 순수 규칙 (`65-`).
 *
 * 닉네임: 0자 · 21자 거부, 1자 · 20자 허용. 사귄 날짜: 미래 불가(KST 오늘까지, 경계 포함). 조사 붙이기.
 */
import {
  formatStartDateInput,
  isStartDateSelectable,
  isValidNickname,
  nicknameLength,
  normalizeNickname,
  parseStartDateInput,
  withGwa,
  withIga,
} from '../../src/utils/coupleStart'

describe('커플 닉네임 1~20자', () => {
  it('0자 거부 · 공백뿐이어도 0자', () => {
    expect(isValidNickname('')).toBe(false)
    expect(isValidNickname('   ')).toBe(false)
  })

  it('1자 허용 · 20자 허용', () => {
    expect(isValidNickname('가')).toBe(true)
    expect(isValidNickname('가'.repeat(20))).toBe(true)
  })

  it('21자 거부', () => {
    expect(isValidNickname('가'.repeat(21))).toBe(false)
  })

  it('앞뒤 공백은 세지 않고, 저장할 때 지운다', () => {
    expect(nicknameLength('  늘봄  ')).toBe(2)
    expect(normalizeNickname('  늘봄  ')).toBe('늘봄')
    expect(isValidNickname(` ${'가'.repeat(20)} `)).toBe(true)
  })

  it('글자 수는 코드 포인트로 센다(서버 char_length와 같다) - 이모지 한 글자는 1자', () => {
    expect(nicknameLength('🌙')).toBe(1)
    expect(isValidNickname('🌙'.repeat(20))).toBe(true)
    expect(isValidNickname('🌙'.repeat(21))).toBe(false)
  })
})

describe('사귄 날짜 - 미래 불가(KST 오늘까지)', () => {
  // KST 2026-10-25 00:30 = UTC 2026-10-24 15:30
  const justAfterKstMidnight = new Date('2026-10-24T15:30:00Z')
  // KST 2026-10-24 23:59 = UTC 2026-10-24 14:59
  const justBeforeKstMidnight = new Date('2026-10-24T14:59:00Z')

  it('오늘(KST)은 고를 수 있다', () => {
    expect(isStartDateSelectable('2026-10-25', justAfterKstMidnight)).toBe(true)
    expect(isStartDateSelectable('2026-10-24', justBeforeKstMidnight)).toBe(true)
  })

  it('내일(KST)부터는 고를 수 없다 - KST 자정 경계', () => {
    expect(isStartDateSelectable('2026-10-26', justAfterKstMidnight)).toBe(false)
    // UTC로는 아직 24일이지만 KST로는 23:59이므로 25일은 아직 미래다.
    expect(isStartDateSelectable('2026-10-25', justBeforeKstMidnight)).toBe(false)
  })

  it('지난 날짜는 고를 수 있다', () => {
    expect(isStartDateSelectable('2020-02-29', justAfterKstMidnight)).toBe(true)
  })

  it('없는 날짜 · 형식이 틀린 날짜 · 1930년 이전은 고를 수 없다', () => {
    expect(isStartDateSelectable('2025-02-29', justAfterKstMidnight)).toBe(false)
    expect(isStartDateSelectable('2025-13-01', justAfterKstMidnight)).toBe(false)
    expect(isStartDateSelectable('25-01-01', justAfterKstMidnight)).toBe(false)
    expect(isStartDateSelectable('1929-12-31', justAfterKstMidnight)).toBe(false)
  })

  it('입력 글자("YYYY.MM.DD")를 같은 규칙으로 ISO로 바꾼다', () => {
    expect(parseStartDateInput('2025.12.27', justAfterKstMidnight)).toBe('2025-12-27')
    expect(parseStartDateInput('2026.10.25', justAfterKstMidnight)).toBe('2026-10-25')
    expect(parseStartDateInput('2026.10.26', justAfterKstMidnight)).toBeNull()
    expect(parseStartDateInput('2025.1.1', justAfterKstMidnight)).toBeNull()
  })

  it('숫자만 받아 점을 넣는다', () => {
    expect(formatStartDateInput('20251227')).toBe('2025.12.27')
    expect(formatStartDateInput('2025a12')).toBe('2025.12')
  })
})

describe('조사', () => {
  it('받침이 있으면 과 · 이, 없으면 와 · 가', () => {
    expect(withGwa('서영')).toBe('서영과')
    expect(withGwa('세준')).toBe('세준과')
    expect(withGwa('지수')).toBe('지수와')
    expect(withIga('서영')).toBe('서영이')
    expect(withIga('지수')).toBe('지수가')
  })

  it('한글이 아니면 와 · 가', () => {
    expect(withGwa('Amy')).toBe('Amy와')
    expect(withIga('Amy')).toBe('Amy가')
  })
})
