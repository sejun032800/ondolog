import { stripComments } from '../../scripts/lib/stripComments'

/**
 * 공용 `stripComments` 합성 입력 테스트. 합성 소스는 전부 이 파일 안의
 * 문자열 상수다(실제 파일을 만들지 않는다).
 */

describe('stripComments — URL 미탐 수정', () => {
  it('실행 코드의 URL 뒤에 오는 식별자가 남는다', () => {
    const src = "const u = 'https://example.com'; Math.random()\n"
    const out = stripComments(src)
    expect(out).toContain('https://example.com')
    expect(out).toContain('Math.random')
  })

  it('URL이 있는 줄의 진짜 줄 주석만 지워진다', () => {
    const src = "const u = 'https://a.b' // trailing note\nnext()\n"
    const out = stripComments(src)
    expect(out).toContain('https://a.b')
    expect(out).not.toContain('trailing note')
    expect(out).toContain('next()')
  })

  it('주석 안에만 있는 식별자는 지워진다', () => {
    const src = '// Math.random()\n/* Date.now() */\nconst x = 1\n'
    const out = stripComments(src)
    expect(out).not.toContain('Math.random')
    expect(out).not.toContain('Date.now')
    expect(out).toContain('const x = 1')
  })
})

describe('stripComments — 줄번호 보존 옵션', () => {
  const src = 'a\n/* one\ntwo\nthree */\nb\n'

  it('옵션 켬: 블록 주석이 있어도 줄 수가 원본과 같다', () => {
    const out = stripComments(src, { preserveLines: true })
    expect(out.split('\n').length).toBe(src.split('\n').length)
    expect(out.split('\n')[4]).toBe('b')
  })

  it('옵션 끔(기본): 블록 주석이 통째로 지워진다', () => {
    const expected = 'a\n\nb\n'
    expect(stripComments(src)).toBe(expected)
    expect(stripComments(src, { preserveLines: false })).toBe(expected)
  })
})

describe('stripComments — 결정론', () => {
  it('동일 입력 100회 반복 → 100회 동일 결과', () => {
    const src = "x('https://a.b') // c\n/* d\ne */\nf()\n"
    const results = Array.from({ length: 100 }, () => stripComments(src))
    expect(new Set(results).size).toBe(1)
  })
})
