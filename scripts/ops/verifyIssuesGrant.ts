/**
 * 024 발행물 읽기 열 권한 실증 (`59-` A) - 원격 **개발** DB·스토리지, anon 키 + 시험 계정 로그인 (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 024를 원격에 적용한 뒤 메인 세션이 실행한다.
 *
 *   (1) issues_public 사용자 조회 - 발행 호만, 14칸
 *   (2) issues 직접 조회로 pdf_print_path 고르기 - 거부 (열 권한 없음)
 *   (3) issues 직접 조회, 허용 칸만 - 발행 호만 (RLS), 초안 0건
 *   (4) 다른 커플 계정 - 그 커플의 호 0건
 *   (5) 비로그인 - 0건 또는 거부
 *   (6) 표지·쪽 이미지·디지털 PDF 서명 URL -> 받기 200
 *   (7) 다른 커플 계정으로 같은 경로 서명 URL - 거부
 *   (8) app/(tabs)/main.tsx "최근 발행물"과 같은 조회 - 동작
 *
 * - service_role은 **계정 찾기와 "초안이 실제로 있다"는 대조**에만 쓴다. 나머지는 모두 각자의 세션(anon 키 + 로그인)이다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다 (verifyU3Library.ts와 같은 방식).
 * - **서명 URL 값은 출력·파일 어디에도 쓰지 않는다** - HTTP 상태와 바이트 수만 남긴다. 키 값도 쓰지 않는다.
 * - 시험 계정: 커플 "photo"(발행된 호 ①) = photoA·photoB, 다른 커플 "type"(초안만) = typeA.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyIssuesGrant.ts run
 *
 * 출력 원문: scripts/ops/out/59-issues-grant.txt (추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { signDigitalPdf, signMagazinePaths } from '../../src/services/magazineApi.ts'
import { pageImagePaths } from '../../src/utils/magazine.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const VIEW_COLUMNS = [
  'id', 'couple_id', 'issue_type', 'issue_number', 'title', 'cover_path', 'period_start', 'period_end',
  'pdf_digital_path', 'page_count', 'is_trial', 'published_at', 'created_at', 'theme',
]
const PRINT_COL = ['pdf', 'print', 'path'].join('_')

async function main(): Promise<void> {
  const ops = await connectOps()
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anonKey = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anonKey) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const secrets = [...ops.secrets, anonKey]
  const say = printer(secrets)
  const out: string[] = []
  let failures = 0
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  const check = (label: string, ok: boolean, detail: string) => {
    if (!ok) failures += 1
    line(`${ok ? 'OK  ' : 'FAIL'} ${label} - ${detail}`)
  }

  const emails = {
    photoA: 'test-55-2-photo-a@example.com',
    photoB: 'test-55-2-photo-b@example.com',
    typeA: 'test-55-2-type-a@example.com',
  }
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  for (const [role, email] of Object.entries(emails)) {
    const found = listed.data?.users?.find((u: { email?: string }) => u.email === email)
    if (!found) throw new Error(`시험 계정이 없다: ${role}`)
  }

  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
    return client
  }
  const dbA: Db = await userClient(emails.photoA)
  const dbB: Db = await userClient(emails.photoB)
  const dbOther: Db = await userClient(emails.typeA)
  const dbAnon: Db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  /** 서명 URL을 받아 GET -> 상태만 돌려준다 (URL 값은 쓰지 않는다). */
  async function httpStatus(signed: string | undefined): Promise<number> {
    if (!signed) return -1
    try {
      const res = await fetch(signed)
      await res.arrayBuffer()
      return res.status
    } catch {
      return 0
    }
  }

  // 관리자 시점 대조: 발행된 호 / 초안 호 (커플별)
  const { data: allIssues, error: allErr } = await admin.from('issues').select('id, couple_id, published_at, pdf_digital_path, cover_path, page_count')
  if (allErr) throw new Error(`관리자 issues 조회 실패: ${allErr.message}`)
  const { data: whoA } = await dbA.auth.getUser()
  const { data: coupleA } = await admin.from('couples').select('id').or(`user_a_id.eq.${whoA.user.id},user_b_id.eq.${whoA.user.id}`).limit(1).maybeSingle()
  const { data: whoO } = await dbOther.auth.getUser()
  const { data: coupleO } = await admin.from('couples').select('id').or(`user_a_id.eq.${whoO.user.id},user_b_id.eq.${whoO.user.id}`).limit(1).maybeSingle()
  if (!coupleA || !coupleO) throw new Error('시험 커플을 찾지 못했다')
  const publishedA = (allIssues as Array<{ id: string; couple_id: string; published_at: string | null }>).filter((r) => r.couple_id === coupleA.id && r.published_at !== null)
  const draftsA = (allIssues as Array<{ id: string; couple_id: string; published_at: string | null }>).filter((r) => r.couple_id === coupleA.id && r.published_at === null)
  const issuesO = (allIssues as Array<{ couple_id: string }>).filter((r) => r.couple_id === coupleO.id)
  line(`[대조 - 관리자 시점] 커플 photo: 발행 ${publishedA.length}권 · 초안 ${draftsA.length}권 / 커플 type: issues ${issuesO.length}행`)
  if (publishedA.length === 0) throw new Error('발행된 시험 호가 없다')

  // (1) issues_public - 발행 호만, 14칸
  const v1 = await dbA.from('issues_public').select('*')
  check('(1) A: issues_public 조회 성공', !v1.error, v1.error ? `오류 ${v1.error.code} ${v1.error.message}` : `${v1.data.length}행`)
  if (!v1.error) {
    const ids = v1.data.map((r: { id: string }) => r.id).sort()
    check('(1) 발행 호만 (관리자 시점 발행 호와 같은 id 집합)', JSON.stringify(ids) === JSON.stringify(publishedA.map((r) => r.id).sort()), `${ids.length}권`)
    const cols = v1.data.length > 0 ? Object.keys(v1.data[0]).sort() : []
    check('(1) 14칸', JSON.stringify(cols) === JSON.stringify([...VIEW_COLUMNS].sort()), `${cols.length}칸: ${cols.join(',')}`)
    check('(1) 초안 id 없음', v1.data.every((r: { id: string; published_at: string | null }) => r.published_at !== null && !draftsA.some((d) => d.id === r.id)), '모든 행 published_at 있음')
  }
  const vB = await dbB.from('issues_public').select('id')
  check('(1) 상대 계정 B도 같은 호', !vB.error && vB.data.length === publishedA.length, vB.error ? `오류 ${vB.error.code}` : `${vB.data.length}권`)

  // (2) issues 직접 - 인쇄 칸 거부
  const v2 = await dbA.from('issues').select(PRINT_COL).limit(1)
  check('(2) A: issues에서 인쇄용 칸 고르기 -> 거부', !!v2.error, v2.error ? `오류 ${v2.error.code} ${v2.error.message}` : `조회됨(!) ${v2.data.length}행`)
  const v2b = await dbA.from('issues').select('*').limit(1)
  check('(2) A: issues select * -> 거부 (열 권한)', !!v2b.error, v2b.error ? `오류 ${v2b.error.code}` : '조회됨(!)')
  const v2c = await dbA.from('issues').select('id').not(PRINT_COL, 'is', null).limit(1)
  check('(2) A: 인쇄용 칸으로 필터만 걸기 -> 거부', !!v2c.error, v2c.error ? `오류 ${v2c.error.code}` : '조회됨(!)')

  // (3) issues 직접 - 허용 칸만, 발행 호만 (RLS)
  const v3 = await dbA.from('issues').select(VIEW_COLUMNS.join(', '))
  check('(3) A: issues 직접 조회(허용 칸) 성공', !v3.error, v3.error ? `오류 ${v3.error.code} ${v3.error.message}` : `${v3.data.length}행`)
  if (!v3.error) {
    check('(3) 발행 호만 - 초안 0건', v3.data.length === publishedA.length && v3.data.every((r: { published_at: string | null }) => r.published_at !== null), `${v3.data.length}행 (초안 ${draftsA.length}권은 안 보임)`)
  }

  // (4) 다른 커플 계정
  const v4 = await dbOther.from('issues_public').select('id').eq('couple_id', coupleA.id)
  check('(4) 다른 커플: photo 커플의 호 0건', !v4.error && v4.data.length === 0, v4.error ? `오류 ${v4.error.code}` : `${v4.data.length}행`)
  const v4b = await dbOther.from('issues').select('id').eq('couple_id', coupleA.id)
  check('(4) 다른 커플: issues 직접도 0건', !v4b.error && v4b.data.length === 0, v4b.error ? `오류 ${v4b.error.code}` : `${v4b.data.length}행`)

  // (5) 비로그인
  const v5 = await dbAnon.from('issues_public').select('id')
  check('(5) 비로그인: issues_public 0건 또는 거부', !!v5.error || v5.data.length === 0, v5.error ? `거부 ${v5.error.code}` : `${v5.data.length}행`)
  const v5b = await dbAnon.from('issues').select('id')
  check('(5) 비로그인: issues 0건 또는 거부', !!v5b.error || v5b.data.length === 0, v5b.error ? `거부 ${v5b.error.code}` : `${v5b.data.length}행`)

  // (6) 서명 URL -> 200 (A가 자기 커플의 발행 호로)
  const issue = (v3.data ?? [])[0] ?? null
  if (!issue) throw new Error('A가 읽은 발행 호가 없어 (6)(7)을 못 한다')
  const pages = pageImagePaths(issue.couple_id, issue.id, issue.page_count)
  const signedPages = await signMagazinePaths(dbA, pages)
  const statuses: number[] = []
  for (const p of pages) statuses.push(await httpStatus(signedPages[p]))
  check('(6) A: 쪽 이미지 서명 -> 200', pages.length > 0 && statuses.every((s) => s === 200), `${statuses.filter((s) => s === 200).length}/${pages.length}장 200 (상태 모음 ${[...new Set(statuses)].join(',')})`)
  const signedCover = issue.cover_path ? await signMagazinePaths(dbA, [issue.cover_path]) : {}
  const coverStatus = issue.cover_path ? await httpStatus(signedCover[issue.cover_path]) : -2
  check('(6) A: 표지(cover_path) 서명 -> 200', coverStatus === 200, `HTTP ${coverStatus}`)
  const pdfSigned = await signDigitalPdf(dbA, { pdfDigitalPath: issue.pdf_digital_path })
  const pdfStatus = await httpStatus(pdfSigned ?? undefined)
  check('(6) A: 디지털 PDF 서명 -> 200', pdfStatus === 200, `HTTP ${pdfStatus}`)

  // (7) 다른 커플 계정으로 같은 경로
  const otherPaths = [...pages, ...(issue.cover_path ? [issue.cover_path] : []), ...(issue.pdf_digital_path ? [issue.pdf_digital_path] : [])]
  const signedOther = await signMagazinePaths(dbOther, otherPaths)
  const gotOther = Object.keys(signedOther).length
  const otherStatuses: number[] = []
  for (const p of Object.keys(signedOther)) otherStatuses.push(await httpStatus(signedOther[p]))
  check('(7) 다른 커플: 같은 경로 서명 URL 거부', gotOther === 0 || otherStatuses.every((s) => s !== 200), `서명 ${gotOther}/${otherPaths.length}, 200 = ${otherStatuses.filter((s) => s === 200).length}`)

  // (8) main.tsx "최근 발행물"과 같은 조회 (app/(tabs)/main.tsx 168~173행)
  const v8 = await dbA
    .from('issues_public')
    .select('title, issue_number')
    .eq('couple_id', coupleA.id)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  check('(8) main.tsx 최근 발행물 조회', !v8.error && v8.data !== null && typeof v8.data.issue_number === 'number', v8.error ? `오류 ${v8.error.code} ${v8.error.message}` : `VOL.${v8.data?.issue_number}`)

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/59-issues-grant.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyIssuesGrant.ts run')
