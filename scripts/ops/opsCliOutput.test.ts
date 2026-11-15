/// <reference types="jest" />
/**
 * A-27 시험 - 생성 · 발행 명령은 프로젝트 ref를 출력하지 않는다(렌더와 같은 문구). 가짜 ref만 쓴다.
 * 명령 파일은 최상위에서 접속하므로 불러오지 않고 소스 글자를 본다.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { CONNECTED_LINE, printer } from './opsCli.ts'

const FAKE_REF = 'fakedevref000000aaaa'
const CLI_FILES = ['generateIssueCli.ts', 'publishIssueCli.ts']

describe('A-27 생성 · 발행 명령의 첫 줄에 ref 0', () => {
  it('확인 줄은 렌더와 같은 문구이고 ref 모양 글자가 없다', () => {
    expect(CONNECTED_LINE).toBe('접속 대상: 개발 프로젝트 ondolog - 확인됨 (프로젝트 ref는 출력하지 않는다)')
    expect(CONNECTED_LINE).not.toMatch(/\([a-z0-9]{10,32}\)/)
  })

  it.each(CLI_FILES)('%s: 확인 줄을 CONNECTED_LINE으로 내고 projectRef를 글자에 끼우지 않는다', (file) => {
    const src = readFileSync(join(__dirname, file), 'utf8')
    expect(src).toContain('say(CONNECTED_LINE)')
    expect(src).not.toMatch(/\$\{\s*projectRef\s*\}/)
    expect(src).toMatch(/const hidden = \[\.\.\.secrets, projectRef\]/)
    expect(src).toContain('printer(hidden)')
    expect(src).toContain('writeJson(file, report, hidden)')
  })

  it('지울 값 목록에 ref를 넣으면 다른 줄에 섞여도 지워진다', () => {
    const lines: string[] = []
    const spy = jest.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line))
    try {
      const say = printer(['fake-secret-value-123', FAKE_REF])
      say(CONNECTED_LINE)
      say(`오류: https://${FAKE_REF}.supabase.co 응답 없음`)
    } finally {
      spy.mockRestore()
    }
    expect(lines[0]).toBe(CONNECTED_LINE)
    expect(lines.join('\n')).not.toContain(FAKE_REF)
  })
})
