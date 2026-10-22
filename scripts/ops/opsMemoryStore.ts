/**
 * 운영자 경로 시험용 메모리 저장소 - **테스트 전용**이다. 운영 코드가 이 파일을 import하지 않는다.
 *
 * 입력 조립이 읽는 테이블은 기존 가짜 클라이언트(`fakeClient`)에 맡기고, 호·코너·경보·미디어는 메모리에 둔다.
 * `callPublish`는 부른 횟수만 센다(`publishCalls`) - 거부가 "함수를 부르기 전"에 일어났는지 보이기 위해서다.
 */

import { fakeClient } from '../../supabase/functions/_shared/testFixtures/inputAssemblyFake.ts'
import type { AssemblyRow } from '../../supabase/functions/_shared/inputAssembly.ts'
import type {
  AlertRow,
  CornerRow,
  CoupleInfo,
  IssueRow,
  MediaStore,
  NewAlert,
  NewCorner,
  NewIssue,
  OpsStore,
} from './opsStore.ts'

export interface MemoryStore extends OpsStore {
  readonly issues: IssueRow[]
  readonly corners: CornerRow[]
  readonly alerts: AlertRow[]
  publishCalls: number
}

export interface MemoryMedia extends MediaStore {
  readonly objects: Set<string>
  readonly copies: string[]
}

export function memoryMedia(initial: readonly string[] = []): MemoryMedia {
  const objects = new Set(initial)
  const copies: string[] = []
  return {
    objects,
    copies,
    async exists(bucket, path) {
      return objects.has(`${bucket}/${path}`)
    },
    async copy(fromBucket, fromPath, toBucket, toPath) {
      if (!objects.has(`${fromBucket}/${fromPath}`)) throw new Error('원본 객체가 없다')
      objects.add(`${toBucket}/${toPath}`)
      copies.push(`${toBucket}/${toPath}`)
    },
  }
}

export function memoryStore(options: {
  readonly tables: Readonly<Record<string, readonly AssemblyRow[]>>
  readonly couple: CoupleInfo | null
}): MemoryStore {
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`
  const issues: IssueRow[] = []
  const corners: CornerRow[] = []
  const alerts: AlertRow[] = []
  const entries = options.tables.data_entries ?? []

  const store: MemoryStore = {
    issues,
    corners,
    alerts,
    publishCalls: 0,
    assemblyClient: fakeClient(options.tables),
    cornersTable: {
      from() {
        return {
          update(patch) {
            return {
              async eq(_column, value) {
                const index = corners.findIndex((c) => c.id === value)
                if (index < 0) return { error: { message: '코너 없음' } }
                corners[index] = { ...corners[index], ...patch } as CornerRow
                return { error: null }
              },
            }
          },
        }
      },
    },
    async getCouple() {
      return options.couple
    },
    async getIssue(issueId) {
      return issues.find((i) => i.id === issueId) ?? null
    },
    async findIssue(q) {
      return issues.find((i) => i.couple_id === q.coupleId && i.issue_type === q.issueType && i.period_start === q.periodStart) ?? null
    },
    async insertIssue(row: NewIssue) {
      const issue: IssueRow = {
        id: nextId('issue'),
        ...row,
        issue_number: null,
        is_trial: false,
        published_at: null,
        theme: null,
      }
      issues.push(issue)
      return issue
    },
    async listCorners(issueId) {
      return corners.filter((c) => c.issue_id === issueId)
    },
    async insertCorner(row: NewCorner) {
      const corner: CornerRow = {
        id: nextId('corner'),
        couple_id: row.couple_id,
        issue_id: row.issue_id,
        corner_type: row.corner_type,
        seq: row.seq,
        status: 'pending',
        skip_reason: null,
        last_error: null,
        generation_attempts: 0,
        engine_version: null,
        content: {},
        source_date_ids: [],
      }
      corners.push(corner)
      return corner
    },
    async openAlerts(issueId) {
      return alerts.filter((a) => a.issue_id === issueId && a.resolved_at === null)
    },
    async insertAlert(row: NewAlert) {
      const alert: AlertRow = { id: nextId('alert'), resolved_at: null, ...row }
      alerts.push(alert)
      return alert
    },
    async setCornerSourceDates(cornerId, dateIds) {
      const i = corners.findIndex((c) => c.id === cornerId)
      corners[i] = { ...corners[i], source_date_ids: [...dateIds] }
    },
    async resetCornerPending(cornerId, lastError) {
      const i = corners.findIndex((c) => c.id === cornerId)
      corners[i] = { ...corners[i], status: 'pending', last_error: lastError }
    },
    async entrySourcePaths(coupleId, entryIds) {
      const wanted = new Set(entryIds)
      const map = new Map<string, string>()
      for (const e of entries) {
        if (e.couple_id === coupleId && wanted.has(String(e.id)) && (e.deleted_at ?? null) === null && typeof e.storage_path === 'string') {
          map.set(String(e.id), e.storage_path)
        }
      }
      return map
    },
    async callPublish() {
      store.publishCalls += 1
    },
  }
  return store
}
