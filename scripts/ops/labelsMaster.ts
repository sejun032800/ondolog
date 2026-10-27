/**
 * MASTER 10-5-1 · 10-5-2 에서 연애유형 라벨 36행을 읽는 순수 함수 (Deno 와 jest 가 같이 쓴다). 위임 `69-`.
 * 칸 순서: [코드, 코어 번호, 애착, 코어 영문, 접미사, 영문, 한글, 카피] - love_type_labels 의 8칸과 같다.
 */
export type LabelRow = [string, number, string, string, string, string, string, string]

const ATTACH_KO: Record<string, string> = { 안정: 'secure', 불안: 'anxious', 회피: 'avoidant', 혼란: 'fearful' }

export function parseMasterLabels(masterText: string): LabelRow[] {
  const master = masterText.replace(/\r\n/g, '\n')
  const s1 = master.indexOf('#### 10-5-1.')
  const s2 = master.indexOf('#### 10-5-2.')
  const s3 = master.indexOf('#### 10-5-3.')
  if (s1 < 0 || s2 < s1 || s3 < s2) throw new Error('MASTER 10-5-1 / 10-5-2 / 10-5-3 제목을 찾지 못했다')
  const sec1 = master.slice(s1, s2)
  const sec2 = master.slice(s2, s3)
  const coreAbbr: Record<number, [string, string]> = {}
  for (const m of sec1.matchAll(/^\| (\d) [^|]*\| \*\*(\w+)\*\* \| (\w\w) \|/gm)) coreAbbr[Number(m[1])] = [m[2], m[3]]
  const suffix: Record<string, [string, string]> = {}
  for (const m of sec1.matchAll(/^\| \S+ \((\w+)\) \| \*\*-(\w+)\*\* \| \*\*(\w)\*\* \|/gm)) suffix[m[1]] = [m[2], m[3]]
  const rows: LabelRow[] = []
  let n = 0
  for (const line of sec2.split('\n')) {
    const h = /^\*\*(\d)\. (\w+) — /.exec(line)
    if (h) {
      n = Number(h[1])
      continue
    }
    const m = /^\| (안정|불안|회피|혼란) \| `(\w{3})` \| (\w+) \| (.+?) \| (.+?) \|$/.exec(line)
    if (m) {
      const att = ATTACH_KO[m[1]]
      rows.push([m[2], n, att, coreAbbr[n][0], suffix[att][0], m[3], m[4], m[5]])
    }
  }
  return rows
}

/** 마이그레이션 SQL 의 values 줄(`  ('KLE', 1, 'secure', ...),`)에서 같은 8칸을 읽는다. */
export function parseSqlLabels(sqlText: string): LabelRow[] {
  const sql = sqlText.replace(/\r\n/g, '\n')
  const rows: LabelRow[] = []
  for (const m of sql.matchAll(/^ {2}\('(\w{3})', (\d), '(\w+)', '(\w+)', '(\w+)', '(\w+)', '([^']+)', '([^']+)'\),?$/gm)) {
    rows.push([m[1], Number(m[2]), m[3], m[4], m[5], m[6], m[7], m[8]])
  }
  return rows
}
