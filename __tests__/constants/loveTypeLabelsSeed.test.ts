import * as fs from 'fs'
import * as path from 'path'
import { LOVE_TYPE_LABELS } from '../../src/constants/loveTypeLabels'
import { parseMasterLabels, parseSqlLabels, type LabelRow } from '../../scripts/ops/labelsMaster'

/**
 * 연애유형 라벨 36행의 원본 대조 (위임 `69-`, 마이그레이션 028).
 * 원격 love_type_labels 가 0행이던 원인은 "적용된 마이그레이션 016 을 나중에 고친 것"이었다.
 * 같은 일이 다시 생기지 않도록 MASTER 10-5-2 · 016 · 028 · 코드 상수(loveTypeLabels.ts)가 같은 36행인지 본다.
 */

const root = path.join(__dirname, '../..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')

type Row = LabelRow

const masterRows = (): Row[] => parseMasterLabels(read('docs/ONDOLOG_MASTER.md'))
const sqlRows = (file: string): Row[] => parseSqlLabels(read(file))

describe('연애유형 라벨 36행 - MASTER 10-5-2 · 016 · 028 · 코드 상수가 같다', () => {
  const master = masterRows()

  it('MASTER 10-5-2 에서 36행을 읽는다 (코드 · (코어, 애착) 모두 고유)', () => {
    expect(master).toHaveLength(36)
    expect(new Set(master.map((r) => r[0])).size).toBe(36)
    expect(new Set(master.map((r) => `${r[1]}-${r[2]}`)).size).toBe(36)
  })

  it('엘리전 규칙: MUSEMBER · LOREMBER (MUSEEMBER · LOREEMBER 아님)', () => {
    const en = master.map((r) => r[5])
    expect(en).toContain('MUSEMBER')
    expect(en).toContain('LOREMBER')
    expect(en.join(' ')).not.toMatch(/MUSEEMBER|LOREEMBER/)
    for (const r of master) {
      const expected = r[3].endsWith('E') && r[4] === 'EMBER' ? r[3] + r[4].slice(1) : r[3] + r[4]
      expect(r[5]).toBe(expected)
    }
  })

  it('028 의 36행이 MASTER 와 글자 단위로 같다', () => {
    expect(sqlRows('supabase/migrations/028_love_type_labels_seed_and_retest_row_guard.sql')).toEqual(master)
  })

  it('016 의 36행이 MASTER 와 글자 단위로 같다 (028 과 같은 데이터)', () => {
    expect(sqlRows('supabase/migrations/016_seed_love_type_labels.sql')).toEqual(master)
  })

  it('코드 상수 LOVE_TYPE_LABELS 가 MASTER 와 같다', () => {
    const fromConst: Row[] = LOVE_TYPE_LABELS.map((l) => [l.code, l.enneagramCore, l.attachment, l.coreEn, l.suffixEn, l.labelEn, l.labelKo, l.copyKo])
    expect(fromConst).toEqual(master)
  })

  it('028 은 description_ko 를 건드리지 않고, 정책에 seq = 1 을 더하며, 얼굴 임베딩류 칸을 만들지 않는다', () => {
    const sql = read('supabase/migrations/028_love_type_labels_seed_and_retest_row_guard.sql')
    const code = sql.replace(/^--.*$/gm, '')
    expect(code).not.toMatch(/description_ko/)
    expect(code).toMatch(/alter policy assessments_insert on public\.personality_assessments\s+with check \(user_id = auth\.uid\(\) and seq = 1\)/)
    expect(code).not.toMatch(/embedding|face_vector|descriptor|landmark/i)
    expect(code).not.toMatch(/create table/i)
  })
})
