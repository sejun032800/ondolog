import * as fs from 'fs'
import * as path from 'path'
import { parseMasterLabels } from '../../scripts/ops/labelsMaster'
import { parseDescriptions, parseSqlDescriptions } from '../../scripts/ops/descriptionsMaster'

/**
 * 연애유형 description_ko 36행의 원본 대조 (위임 `70-`, 마이그레이션 029).
 * 원본은 docs/ONDOLOG_36_descriptions.md (PM 결정 2026-10-27). 마크다운 ** 는 빼고 글자 단위로 맞춘다.
 * 020 은 원격에 라벨 행이 없던 때 적용돼 0건 갱신됐다. 029 가 같은 문구를 다시 채운다 - 둘이 같은 문구인지도 본다.
 */

const root = path.join(__dirname, '../..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')

describe('description_ko 36행 - 36_descriptions.md · 029 · 020 이 같다', () => {
  const md = parseDescriptions(read('docs/ONDOLOG_36_descriptions.md'))
  const s029 = parseSqlDescriptions(read('supabase/migrations/029_love_type_descriptions_backfill.sql'))
  const s020 = parseSqlDescriptions(read('supabase/migrations/020_seed_love_type_descriptions.sql'))
  const codes = parseMasterLabels(read('docs/ONDOLOG_MASTER.md')).map((r) => r[0])

  it('원본에서 36개를 읽고 코드가 MASTER 10-5-2 의 36개와 같다', () => {
    expect(md.size).toBe(36)
    expect([...md.keys()].sort()).toEqual([...codes].sort())
  })

  it('모든 설명문은 2문단(빈 줄 하나)이고 별표가 없다', () => {
    for (const [code, text] of md) {
      expect(text.split('\n\n')).toHaveLength(2)
      expect(text).not.toContain('**')
      expect(text.length).toBeGreaterThan(100)
      expect(code).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('029 의 36개가 원본과 글자 단위로 같다 (** 제외)', () => {
    expect(s029.size).toBe(36)
    for (const [code, text] of md) expect(s029.get(code)).toBe(text)
  })

  it('020 의 36개도 같은 문구다 (029 는 020 을 다시 하는 것)', () => {
    expect(s020.size).toBe(36)
    for (const [code, text] of md) expect(s020.get(code)).toBe(text)
  })

  it('029 는 update 만 한다 - 테이블 · 정책 · 권한 · 함수를 만들거나 바꾸지 않는다', () => {
    const body = read('supabase/migrations/029_love_type_descriptions_backfill.sql')
      .split('\n')
      .filter((l) => !l.startsWith('--'))
      .join('\n')
      .replace(/\$desc\$[\s\S]*?\$desc\$/g, "''")
    expect(body).not.toMatch(/\b(create|alter|drop|grant|revoke|insert|delete)\b/i)
    expect(body.match(/\bupdate\b/gi)).toHaveLength(36)
  })
})
