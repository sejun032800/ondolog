/**
 * docs/ONDOLOG_36_descriptions.md 에서 연애유형 36종의 상세 설명문(description_ko)을 읽는 순수 함수 (Deno 와 jest 가 같이 쓴다). 위임 `70-`.
 * 원본은 이 파일이다(PM 결정 2026-10-27, ROADMAP R45-6). 대조할 때 마크다운 강조 기호 `**` 는 빼고 나머지는 글자 단위로 맞춘다.
 * 반환: 코드 -> 설명문. 문단은 빈 줄 하나(`\n\n`)로 구분된 그대로다.
 */
export function parseDescriptions(mdText: string): Map<string, string> {
  const lines = mdText.replace(/\r\n/g, '\n').split('\n')
  const out = new Map<string, string>()
  let cur: string | null = null
  let buf: string[] = []
  const flush = () => {
    if (cur !== null) out.set(cur, buf.join('\n').replace(/^\n+|\n+$/g, '').split('**').join(''))
  }
  for (const l of lines) {
    const h = /^### `(\w{3})` /.exec(l)
    if (h) {
      flush()
      cur = h[1]
      buf = []
      continue
    }
    if (cur !== null && (l.startsWith('## ') || l.trim() === '---')) {
      flush()
      cur = null
      continue
    }
    if (cur !== null) buf.push(l)
  }
  flush()
  return out
}

/** 마이그레이션 SQL 의 `update ... set description_ko = $desc$...$desc$ where code = 'XXX';` 에서 같은 표를 읽는다. */
export function parseSqlDescriptions(sqlText: string): Map<string, string> {
  const sql = sqlText.replace(/\r\n/g, '\n')
  const out = new Map<string, string>()
  for (const m of sql.matchAll(/set description_ko = \$desc\$([\s\S]*?)\$desc\$ where code = '(\w{3})';/g)) out.set(m[2], m[1])
  return out
}
