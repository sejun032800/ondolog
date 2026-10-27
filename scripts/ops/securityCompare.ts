/**
 * 보안 점검(get_advisors security) 원문 JSON 두 개의 비교 - 순수 함수 (Deno 와 jest 가 같이 쓴다). 위임 `69-`.
 *
 * 비교 기준은 **경고 이름 + 대상(스키마 · 종류 · 함수/테이블/확장 이름)** 이다. 문장 전체(`detail`)를 비교하지 않는다:
 * 함수 인자 목록 · 관측 시각 · 따옴표 표기가 달라져도 같은 경고로 본다(68- 에서 문장 비교가 같은 경고를 "추가 + 사라짐"으로 오판했다).
 */

export interface AdvisorFinding {
  detail?: string
  metadata?: { name?: string; schema?: string; type?: string; entity?: string }
}
export interface AdvisorLint {
  name: string
  findings: AdvisorFinding[]
}
export interface AdvisorDoc {
  result: { lints: AdvisorLint[] }
}

/** 한 경고 항목의 열쇠: `경고이름|스키마|종류|대상이름`. 인자 목록 · 문장 · 시각은 쓰지 않는다. */
export function findingKey(lintName: string, f: AdvisorFinding): string {
  const m = f.metadata ?? {}
  return [lintName, m.schema ?? '', m.type ?? '', m.name ?? m.entity ?? ''].join('|')
}

export function keysByLint(doc: AdvisorDoc): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const l of doc.result.lints) {
    const set = out.get(l.name) ?? new Set<string>()
    for (const f of l.findings) set.add(findingKey(l.name, f))
    out.set(l.name, set)
  }
  return out
}

export interface ExpectedAdded {
  /** 경고 이름 (예: authenticated_security_definer_function_executable) */
  lint: string
  /** 새로 생겨도 되는 대상 이름들. 이 목록과 추가분이 정확히 같아야 한다. */
  names: readonly string[]
}

export interface Comparison {
  lines: string[]
  /** 어긋난 경고 이름 수 */
  bad: number
}

/** 기대(`expected`)가 없는 경고는 변화 0 이어야 한다. 기대가 있으면 추가분이 그 이름들과 정확히 같고 사라진 것이 없어야 한다. */
export function compareAdvisors(before: AdvisorDoc, after: AdvisorDoc, expected: readonly ExpectedAdded[] = []): Comparison {
  const b = keysByLint(before)
  const a = keysByLint(after)
  const lines: string[] = []
  let bad = 0
  const lintNames = [...new Set([...b.keys(), ...a.keys()])].sort()
  for (const name of lintNames) {
    const bs = b.get(name) ?? new Set<string>()
    const as = a.get(name) ?? new Set<string>()
    const added = [...as].filter((x) => !bs.has(x)).sort()
    const removed = [...bs].filter((x) => !as.has(x)).sort()
    lines.push(`${name}: 전 ${bs.size} -> 후 ${as.size}, 추가 ${added.length}, 사라짐 ${removed.length}`)
    for (const x of added) lines.push(`  + ${x}`)
    for (const x of removed) lines.push(`  - ${x}`)
    const exp = expected.find((e) => e.lint === name)
    if (exp) {
      const addedNames = added.map((k) => k.split('|')[3]).sort()
      const wantNames = [...exp.names].sort()
      const ok = JSON.stringify(addedNames) === JSON.stringify(wantNames) && removed.length === 0
      if (!ok) bad += 1
      lines.push(`  기대: ${wantNames.join(', ')} 만 추가 -> ${ok ? 'ok' : 'FAIL'}`)
    } else {
      const ok = added.length === 0 && removed.length === 0
      if (!ok) bad += 1
      lines.push(`  기대: 변화 없음 -> ${ok ? 'ok' : 'FAIL'}`)
    }
  }
  lines.push('', `어긋남 ${bad}건`)
  return { lines, bad }
}
