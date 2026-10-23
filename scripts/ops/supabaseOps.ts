/**
 * 운영자 경로의 실제 저장소 - service_role로 개발 프로젝트에 접속한다 (Deno 전용).
 * 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * ── service_role 키 (CLAUDE.md 절대 규칙 7) ────────────────────────────────
 * - **`scripts/ops`에서만, 환경변수로만** 읽는다. 이름: `ONDOLOG_SUPABASE_URL` · `ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`.
 * - `src/`·`app/`은 이 파일을 import하지 않는다(경로가 `scripts/ops`라 앱 번들에 들어가지 않는다).
 * - **값은 화면·파일·로그·보고 어디에도 쓰지 않는다.** 이 파일은 키를 변수에 담아 클라이언트를 만들 뿐이고, 출력 직전
 *   마지막 방어선으로 `secrets` 목록(`redactSecrets`용)을 호출부에 돌려준다.
 * - **접속 대상이 개발 프로젝트가 아니면 클라이언트를 만들기 전에 멈춘다**(`assertDevelopmentProject`).
 *
 * 실행 권한(네트워크 허용 범위)은 CLI가 Deno 플래그로 좁힌다: `--allow-net=<프로젝트 ref>.supabase.co` 한 호스트.
 * LLM 공급자 호스트는 허용하지 않으므로 실제 API 호출은 권한 수준에서도 불가능하다.
 */

// 해석 버전은 package-lock.json과 같다(MASTER §17-0-10-H, r58). deno.json 변경 없이 이 파일에서만 쓴다.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { InputAssemblyClient } from '../../supabase/functions/_shared/inputAssembly.ts'
import type { CornersTableClient } from '../../supabase/functions/_shared/saveCornerResult.ts'
import { assertDevelopmentProject, parseLinkedProject, type LinkedProject } from './opsGuards.ts'
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

const LINKED_PROJECT_FILE = 'supabase/.temp/linked-project.json'
const IN_CHUNK = 100

// supabase-js의 질의 빌더는 구조적 타입으로만 쓴다(deno.json에 import map이 없으므로 `any`로 받는다).
// deno-lint-ignore no-explicit-any
type Db = any

export interface OpsConnection {
  readonly client: Db
  readonly store: OpsStore
  readonly media: MediaStore
  /** 출력 직전 `redactSecrets`에 넘길 비밀값 목록. 이 파일 밖에서 출력하지 않는다. */
  readonly secrets: readonly string[]
  readonly projectRef: string
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? '알 수 없는 오류'}`)
}

async function readLinkedProject(): Promise<LinkedProject | null> {
  try {
    return parseLinkedProject(await Deno.readTextFile(LINKED_PROJECT_FILE))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null
    throw error
  }
}

/** 환경변수를 읽고, 개발 프로젝트임을 확인한 뒤에만 service_role 클라이언트를 만든다. */
export async function connectOps(): Promise<OpsConnection> {
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL')
  const key = Deno.env.get('ONDOLOG_SUPABASE_SERVICE_ROLE_KEY')
  if (url === undefined || url.length === 0) throw new Error('환경변수 ONDOLOG_SUPABASE_URL이 없다')
  if (key === undefined || key.length === 0) throw new Error('환경변수 ONDOLOG_SUPABASE_SERVICE_ROLE_KEY가 없다')

  const projectRef = assertDevelopmentProject(url, await readLinkedProject())
  const client: Db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const store: OpsStore = {
    assemblyClient: client as unknown as InputAssemblyClient,
    cornersTable: client as unknown as CornersTableClient,

    async getCouple(coupleId): Promise<CoupleInfo | null> {
      const { data, error } = await client
        .from('couples')
        .select('id, status, nickname, user_a_id, user_b_id')
        .eq('id', coupleId)
        .maybeSingle()
      if (error) fail('couples 조회 실패', error)
      if (data === null) return null
      const ids = [data.user_a_id, data.user_b_id].filter((v: unknown): v is string => typeof v === 'string')
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, ai_usage_agreed_at')
        .in('id', ids)
      if (profileError) fail('profiles 조회 실패', profileError)
      return {
        id: data.id,
        status: data.status,
        nickname: data.nickname,
        members: (profiles ?? []).map((p: { id: string; ai_usage_agreed_at: string | null }) => ({
          id: p.id,
          ai_usage_agreed_at: p.ai_usage_agreed_at,
        })),
      }
    },

    async getIssue(issueId): Promise<IssueRow | null> {
      const { data, error } = await client.from('issues').select('*').eq('id', issueId).maybeSingle()
      if (error) fail('issues 조회 실패', error)
      return data
    },

    async findIssue(q): Promise<IssueRow | null> {
      const { data, error } = await client
        .from('issues')
        .select('*')
        .eq('couple_id', q.coupleId)
        .eq('issue_type', q.issueType)
        .eq('period_start', q.periodStart)
        .maybeSingle()
      if (error) fail('issues 조회 실패', error)
      return data
    },

    async insertIssue(row: NewIssue): Promise<IssueRow> {
      const { data, error } = await client.from('issues').insert(row).select('*').single()
      if (error) fail('issues 삽입 실패', error)
      return data
    },

    async listCorners(issueId): Promise<readonly CornerRow[]> {
      const { data, error } = await client.from('corners').select('*').eq('issue_id', issueId).order('seq', { ascending: true })
      if (error) fail('corners 조회 실패', error)
      return data ?? []
    },

    async insertCorner(row: NewCorner): Promise<CornerRow> {
      const { data, error } = await client.from('corners').insert({ ...row, status: 'pending' }).select('*').single()
      if (error) fail('corners 삽입 실패', error)
      return data
    },

    async openAlerts(issueId): Promise<readonly AlertRow[]> {
      const { data, error } = await client.from('ops_alerts').select('*').eq('issue_id', issueId).is('resolved_at', null)
      if (error) fail('ops_alerts 조회 실패', error)
      return data ?? []
    },

    async insertAlert(row: NewAlert): Promise<AlertRow> {
      const { data, error } = await client.from('ops_alerts').insert(row).select('*').single()
      if (error) fail('ops_alerts 삽입 실패', error)
      return data
    },

    async setCornerSourceDates(cornerId, dateIds) {
      const { error } = await client.from('corners').update({ source_date_ids: [...dateIds] }).eq('id', cornerId)
      if (error) fail('corners.source_date_ids 갱신 실패', error)
    },

    async clearRender(issueId) {
      const { error } = await client
        .from('issues')
        .update({ pdf_digital_path: null, page_count: null, cover_path: null })
        .eq('id', issueId)
        .is('published_at', null)
      if (error) fail('issues 렌더 필드 비우기 실패', error)
    },

    async resetCornerPending(cornerId, lastError) {
      const { error } = await client.from('corners').update({ status: 'pending', last_error: lastError }).eq('id', cornerId)
      if (error) fail('corners 되돌리기 실패', error)
    },

    async entrySourcePaths(coupleId, entryIds) {
      const map = new Map<string, string>()
      for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
        const { data, error } = await client
          .from('data_entries')
          .select('id, storage_path')
          .eq('couple_id', coupleId)
          .is('deleted_at', null)
          .in('id', entryIds.slice(i, i + IN_CHUNK))
        if (error) fail('data_entries 조회 실패', error)
        for (const row of data ?? []) if (typeof row.storage_path === 'string') map.set(row.id, row.storage_path)
      }
      return map
    },

    async callPublish(issueId) {
      const { error } = await client.rpc('fn_publish_issue', { p_issue_id: issueId })
      if (error) fail('fn_publish_issue', error)
    },
  }

  const media: MediaStore = {
    async exists(bucket, path) {
      // `exists()`는 없는 객체에 400을 오류로 돌려주는 경우가 있어(실측) 폴더 목록 조회로 확인한다.
      const slash = path.lastIndexOf('/')
      const folder = slash < 0 ? '' : path.slice(0, slash)
      const name = path.slice(slash + 1)
      const { data, error } = await client.storage.from(bucket).list(folder, { search: name, limit: 100 })
      if (error) fail(`storage 목록 조회 실패 (${bucket})`, error)
      return (data ?? []).some((f: { name: string }) => f.name === name)
    },
    async copy(fromBucket, fromPath, toBucket, toPath) {
      const { error } = await client.storage.from(fromBucket).copy(fromPath, toPath, { destinationBucket: toBucket })
      if (error) fail(`storage copy 실패 (${fromBucket} -> ${toBucket})`, error)
    },
  }

  return { client, store, media, secrets: [key], projectRef }
}
