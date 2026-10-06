import { CORNER_TITLES, PAGE_TITLE_PATTERN } from '../../../src/types/corners/cornerTitles'
import { codePointLength, cornerEnvelopeSchema } from '../../../src/types/corners/storedContent'
import { z } from 'zod'

/**
 * 코너 이름·지면 제목 상수 (docs/ONDOLOG_MASTER.md §17-0-7 r41·r45).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 범위 3.
 *
 * 지면 제목은 `^[가-힣 ]{1,7}$`에 맞아야 한다(한글과 공백만, 7자 이내) - 온돌 테마 세로쓰기에서 라틴 문자는 눕고
 * 숫자는 쌓여 제목이 길어진다. 코너 이름은 앱 화면·목차용이라 길이 제한이 없다. 둘을 하나로 두지 않는다.
 */

describe('코너 이름·지면 제목 상수 - §17-0-7 값 그대로', () => {
  it('세 코너의 값이 문서와 같다', () => {
    expect(CORNER_TITLES).toEqual({
      date_archive: { cornerName: '데이트 아카이브', pageTitle: '함께한 하루' },
      sweet_words: { cornerName: '다정한 말들', pageTitle: '다정한 말들' },
      this_month: { cornerName: '이달의 우리', pageTitle: '이달의 우리' },
    })
  })

  it('17-4의 코너 이름은 "다정한 말들"이다 - "이달의 다정한 말들"은 월간판의 지면 헤드 문구이지 코너 이름이 아니다(r45)', () => {
    expect(CORNER_TITLES.sweet_words.cornerName).toBe('다정한 말들')
    expect(CORNER_TITLES.sweet_words.cornerName).not.toContain('이달의')
  })
})

describe('지면 제목 상수가 ^[가-힣 ]{1,7}$ 에 맞는다 (r41)', () => {
  it('규칙 자체가 문서의 정규식이다', () => {
    expect(PAGE_TITLE_PATTERN.source).toBe('^[가-힣 ]{1,7}$')
  })

  it.each(Object.entries(CORNER_TITLES))('%s의 지면 제목은 규칙에 맞는다', (_id, titles) => {
    expect(titles.pageTitle).toMatch(PAGE_TITLE_PATTERN)
    // 코드포인트로도 7자 이내(§9-7-2, 17-0-7 공통 결정).
    expect(codePointLength(titles.pageTitle)).toBeLessThanOrEqual(7)
  })

  it('규칙이 실제로 걸러 낸다 - 라틴 문자·숫자·8자 이상·빈 문자열은 맞지 않는다', () => {
    for (const bad of ['DNA', '연애 DNA', '이달의 우리 2', '하나둘셋넷다섯여섯일곱', '', '이달의다정한말들입니다']) {
      expect(bad).not.toMatch(PAGE_TITLE_PATTERN)
    }
    // 이달의 다정한 말들(10자)은 코너 이름도 지면 제목도 될 수 없다 - 지면 제목 상한은 7자.
    expect('이달의 다정한 말들').not.toMatch(PAGE_TITLE_PATTERN)
  })

  it('코너 이름과 지면 제목을 하나로 두지 않는다 - 데이트 아카이브는 둘이 다르다', () => {
    expect(CORNER_TITLES.date_archive.cornerName).not.toBe(CORNER_TITLES.date_archive.pageTitle)
  })
})

describe('저장 봉투가 지면 제목 7자를 스키마에 건다 (§9-7-2)', () => {
  const Envelope = cornerEnvelopeSchema(z.object({}))
  const envelope = (title: string) => ({
    schemaVersion: '1.0',
    header: { cornerName: '코너', title, periodLabel: '2026년 8월' },
    payload: {},
  })

  it('7자는 통과, 8자는 실패', () => {
    expect(Envelope.safeParse(envelope('가'.repeat(7))).success).toBe(true)
    expect(Envelope.safeParse(envelope('가'.repeat(8))).success).toBe(false)
  })

  it('세 코너의 지면 제목은 모두 통과한다', () => {
    for (const { pageTitle } of Object.values(CORNER_TITLES)) {
      expect(Envelope.safeParse(envelope(pageTitle)).success).toBe(true)
    }
  })

  it('코너 이름은 길이 제한이 없다', () => {
    expect(
      Envelope.safeParse({ ...envelope('함께한 하루'), header: { cornerName: '아주 아주 긴 코너 이름'.repeat(5), title: '함께한 하루', periodLabel: 'x' } })
        .success,
    ).toBe(true)
  })
})
