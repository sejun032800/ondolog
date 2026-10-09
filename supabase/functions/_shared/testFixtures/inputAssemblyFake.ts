/**
 * 입력 조립 시험용 가짜 클라이언트 - 메모리의 테이블 위에서 `eq`·`is`·`in`·`gte`·`lt`·`order`·`range`를 흉내 낸다
 * (docs/ONDOLOG_MASTER.md §17-0-9).
 *
 * 테스트 전용이다. 운영 코드가 이 파일을 import하지 않는다.
 *
 * - 걸린 필터는 `log`에 남는다 - "모든 쿼리가 세 조건을 건다"를 확인하는 근거.
 * - `leakAcrossCouples: true`면 `couple_id`에 거는 `eq` 필터를 무시한다 - 조회 단계가 두 커플의 행을 받았을 때
 *   입력 조립이 스스로 막는지(골격 단언을 거치지 않고) 시험하는 "오염된 클라이언트"다.
 */

import type {
  AssemblyFilterBuilder,
  AssemblyQueryResult,
  AssemblyRow,
  InputAssemblyClient,
} from '../inputAssembly.ts'

export interface LoggedFilter {
  readonly op: 'eq' | 'is' | 'in' | 'gte' | 'lt'
  readonly column: string
  readonly value: unknown
}

export interface LoggedQuery {
  readonly table: string
  readonly columns: string
  readonly filters: LoggedFilter[]
}

export interface FakeClientOptions {
  readonly leakAcrossCouples?: boolean
}

export interface FakeClient extends InputAssemblyClient {
  readonly log: LoggedQuery[]
}

/** 타임스탬프(`T` 포함)는 순간으로, 그 밖(날짜 문자열 등)은 문자열로 비교한다. */
function cmp(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string' && a.includes('T') && b.includes('T')) {
    return Date.parse(a) - Date.parse(b)
  }
  return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0
}

export function fakeClient(
  tables: Readonly<Record<string, readonly AssemblyRow[]>>,
  options: FakeClientOptions = {},
): FakeClient {
  const log: LoggedQuery[] = []

  function builder(entry: LoggedQuery, rows: readonly AssemblyRow[]): AssemblyFilterBuilder {
    const orderBy: { column: string; ascending: boolean }[] = []
    let window: [number, number] | null = null
    const predicates: ((r: AssemblyRow) => boolean)[] = []

    const self: AssemblyFilterBuilder = {
      eq(column, value) {
        entry.filters.push({ op: 'eq', column, value })
        if (!(options.leakAcrossCouples === true && column === 'couple_id')) {
          predicates.push((r) => r[column] === value)
        }
        return self
      },
      is(column, value) {
        entry.filters.push({ op: 'is', column, value })
        predicates.push((r) => (r[column] ?? null) === value)
        return self
      },
      in(column, values) {
        entry.filters.push({ op: 'in', column, value: values })
        predicates.push((r) => values.includes(String(r[column])))
        return self
      },
      gte(column, value) {
        entry.filters.push({ op: 'gte', column, value })
        predicates.push((r) => r[column] != null && cmp(r[column], value) >= 0)
        return self
      },
      lt(column, value) {
        entry.filters.push({ op: 'lt', column, value })
        predicates.push((r) => r[column] != null && cmp(r[column], value) < 0)
        return self
      },
      order(column, o) {
        orderBy.push({ column, ascending: o.ascending })
        return self
      },
      range(from, to) {
        window = [from, to]
        return self
      },
      then(onfulfilled, onrejected) {
        let result = rows.filter((r) => predicates.every((p) => p(r)))
        result = [...result].sort((a, b) => {
          for (const o of orderBy) {
            const c = cmp(a[o.column], b[o.column])
            if (c !== 0) return o.ascending ? c : -c
          }
          return 0
        })
        if (window !== null) result = result.slice(window[0], window[1] + 1)
        const value: AssemblyQueryResult = { data: result, error: null }
        return Promise.resolve(value).then(onfulfilled, onrejected)
      },
    }
    return self
  }

  return {
    log,
    from(table) {
      return {
        select(columns) {
          const entry: LoggedQuery = { table, columns, filters: [] }
          log.push(entry)
          return builder(entry, tables[table] ?? [])
        },
      }
    },
  }
}
