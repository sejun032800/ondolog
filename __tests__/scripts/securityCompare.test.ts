import { compareAdvisors, findingKey, type AdvisorDoc } from '../../scripts/ops/securityCompare'

const doc = (lints: Record<string, { name: string; detail: string; schema?: string; type?: string }[]>): AdvisorDoc => ({
  result: {
    lints: Object.entries(lints).map(([name, fs]) => ({
      name,
      findings: fs.map((f) => ({ detail: f.detail, metadata: { name: f.name, schema: f.schema ?? 'public', type: f.type ?? 'function' } })),
    })),
  },
})

describe('보안 점검 비교 - 경고 이름 + 대상 이름 기준', () => {
  it('문장(detail)이 달라도 같은 대상이면 같은 경고다', () => {
    const before = doc({ x: [{ name: 'fn_a', detail: 'Function `public.fn_a(uuid)` can be executed' }] })
    const after = doc({ x: [{ name: 'fn_a', detail: 'Function `public.fn_a(p uuid)` can be executed at 2026-01-01' }] })
    const r = compareAdvisors(before, after)
    expect(r.bad).toBe(0)
  })

  it('변화 0 이면 어긋남 0, 새 대상이 생기면 1', () => {
    const before = doc({ x: [{ name: 'fn_a', detail: 'a' }] })
    const same = compareAdvisors(before, before)
    expect(same.bad).toBe(0)
    const grown = doc({ x: [{ name: 'fn_a', detail: 'a' }, { name: 'fn_b', detail: 'b' }] })
    expect(compareAdvisors(before, grown).bad).toBe(1)
  })

  it('사라진 경고도 어긋남이다', () => {
    const before = doc({ x: [{ name: 'fn_a', detail: 'a' }, { name: 'fn_b', detail: 'b' }] })
    const after = doc({ x: [{ name: 'fn_a', detail: 'a' }] })
    expect(compareAdvisors(before, after).bad).toBe(1)
  })

  it('기대한 추가분만 있으면 통과, 다르면 어긋남', () => {
    const before = doc({ x: [{ name: 'fn_a', detail: 'a' }] })
    const after = doc({ x: [{ name: 'fn_a', detail: 'a' }, { name: 'fn_b', detail: 'b' }, { name: 'fn_c', detail: 'c' }] })
    expect(compareAdvisors(before, after, [{ lint: 'x', names: ['fn_c', 'fn_b'] }]).bad).toBe(0)
    expect(compareAdvisors(before, after, [{ lint: 'x', names: ['fn_b'] }]).bad).toBe(1)
  })

  it('새 경고 종류가 통째로 생겨도 어긋남', () => {
    const before = doc({ x: [{ name: 'fn_a', detail: 'a' }] })
    const after = doc({ x: [{ name: 'fn_a', detail: 'a' }], y: [{ name: 't', detail: 't', type: 'table' }] })
    expect(compareAdvisors(before, after).bad).toBe(1)
  })

  it('열쇠는 이름 · 스키마 · 종류 · 대상이다', () => {
    expect(findingKey('lint', { metadata: { name: 'fn_a', schema: 'public', type: 'function' } })).toBe('lint|public|function|fn_a')
  })
})
