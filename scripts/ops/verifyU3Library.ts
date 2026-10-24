/**
 * U3 서재·뷰어 실증 (`58-`) - 원격 **개발** DB·스토리지에서 시험 커플의 두 계정으로 확인한다 (Deno 전용).
 *
 *   서재 목록 = 발행된 호만 · 표지·쪽 이미지·PDF 서명 URL 200 · 초안 호는 서재에 없음 · 상대 계정도 같은 서재.
 *
 * - 읽기는 **앱과 같은 함수**(`src/services/magazineApi.ts`)를 지난다. 클라이언트만 사용자 세션으로 바꿔 넘긴다.
 * - service_role은 **계정·커플 찾기와 "초안이 실제로 있다"는 대조**에만 쓴다. 서재 조회는 각자의 세션(anon 키 + 로그인)이다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다.
 * - **서명 URL 값은 출력·파일 어디에도 쓰지 않는다** - HTTP 상태와 바이트 수만 남긴다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU3Library.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { fetchDisplayNames } from '../../src/services/dateRecordApi.ts'
import {
  countMaterials,
  fetchFrontMatterCorners,
  fetchIssueProgressRows,
  fetchPublishedIssues,
  signDigitalPdf,
  signMagazinePaths,
} from '../../src/services/magazineApi.ts'
import { issueMonthLabel, kstToday, pageImagePaths, periodElapsedPercent, pickDraftIssue } from '../../src/utils/magazine.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

async function main(): Promise<void> {
  const ops = await connectOps()
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anon = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anon) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const secrets = [...ops.secrets, anon]
  const say = printer(secrets)
  const out: string[] = []
  const line = (s: string) => {
    out.push(s)
    say(s)
  }

  const emails = {
    photoA: 'test-55-2-photo-a@example.com',
    photoB: 'test-55-2-photo-b@example.com',
    typeA: 'test-55-2-type-a@example.com',
    typeB: 'test-55-2-type-b@example.com',
  }
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const ids: Record<string, string> = {}
  for (const [role, email] of Object.entries(emails)) {
    const id = listed.data?.users?.find((u: { email?: string }) => u.email === email)?.id as string | undefined
    if (!id) throw new Error(`시험 계정이 없다: ${role}`)
    ids[role] = id
  }

  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
    return client
  }
  const dbPhotoA = await userClient(emails.photoA)
  const dbPhotoB = await userClient(emails.photoB)
  const dbTypeA = await userClient(emails.typeA)

  /** 서명 URL을 받아 GET -> 상태·바이트만 남긴다(URL 값은 쓰지 않는다). */
  async function status(label: string, signed: string | undefined): Promise<string> {
    if (!signed) return `${label}: 서명 URL 없음`
    try {
      const res = await fetch(signed)
      const bytes = (await res.arrayBuffer()).byteLength
      return `${label}: HTTP ${res.status}, ${bytes} bytes, content-type=${res.headers.get('content-type')}`
    } catch (e) {
      return `${label}: 요청 실패 (${(e as Error).name})`
    }
  }

  // ── 시험 커플(발행된 호 ①): A의 서재, B의 서재 ───────────────────────────
  const libA = await fetchPublishedIssues(dbPhotoA)
  const libB = await fetchPublishedIssues(dbPhotoB)
  line(`[서재 A] 발행된 호 ${libA.length}권: ${libA.map((i) => `VOL.${i.issueNumber} ${issueMonthLabel({ periodStart: i.periodStart, issueType: i.issueType, title: i.title })} (호 ${i.id}, 쪽 ${i.pageCount})`).join(' | ')}`)
  line(`[서재 B] 발행된 호 ${libB.length}권: ${libB.map((i) => `VOL.${i.issueNumber} (호 ${i.id}, 쪽 ${i.pageCount})`).join(' | ')}`)
  line(`[상대 계정도 같은 서재] ${JSON.stringify(libA.map((i) => i.id)) === JSON.stringify(libB.map((i) => i.id)) ? '일치' : '불일치'}`)

  const issue = libA[0]
  if (!issue) throw new Error('발행된 시험 호가 없다')

  // 서명 URL: 표지 + 모든 쪽 + PDF (각자 사용자 권한)
  for (const [who, db] of [['A', dbPhotoA], ['B', dbPhotoB]] as const) {
    const cover = issue.coverPath ? (await signMagazinePaths(db, [issue.coverPath]))[issue.coverPath] : undefined
    line(`[${who}] ${await status('표지(cover_path)', cover)}`)
    const paths = pageImagePaths(issue.coupleId, issue.id, issue.pageCount)
    const signed = await signMagazinePaths(db, paths)
    const results: number[] = []
    for (const p of paths) {
      try {
        const res = await fetch(signed[p])
        await res.arrayBuffer()
        results.push(res.status)
      } catch {
        results.push(0)
      }
    }
    const ok = results.filter((s) => s === 200).length
    line(`[${who}] 쪽 이미지 ${paths.length}장 서명 ${Object.keys(signed).length}/${paths.length}, HTTP 200 = ${ok}/${paths.length} (상태 모음: ${[...new Set(results)].join(',')})`)
    line(`[${who}] 표지 경로 = 1쪽 경로: ${issue.coverPath === paths[0] ? '같음' : '다름'}`)
    line(`[${who}] ${await status('PDF(pdf_digital_path)', (await signDigitalPdf(db, issue)) ?? undefined)}`)
  }

  // 속표지 코너·이름
  const corners = await fetchFrontMatterCorners(dbPhotoB, issue.id)
  line(`[속표지 B] 실린 코너 ${corners.length}개: ${corners.map((c) => `${c.pageTitle}(${c.cornerName})`).join(' · ')}`)
  const names = await fetchDisplayNames(dbPhotoA, [ids.photoA, ids.photoB])
  line(`[속표지 A] 이름 ${Object.values(names).join(' · ')}`)

  // ── 초안 호는 서재에 나오지 않는다 (시험 커플 "type": 렌더된 초안만 있고 발행은 안 됨) ──
  const { data: typeCouple } = await admin.from('couples').select('id').eq('nickname', 'test-봄볕').maybeSingle()
  const { data: draftRows } = await admin.from('issues').select('id, published_at, issue_number, page_count').eq('couple_id', typeCouple.id)
  line(`[초안 대조 - 관리자 시점] 커플 type의 issues ${draftRows.length}행: ${draftRows.map((r: { id: string; published_at: string | null; page_count: number | null }) => `${r.id} published_at=${r.published_at === null ? 'null' : '있음'} page_count=${r.page_count}`).join(' | ')}`)
  const libType = await fetchPublishedIssues(dbTypeA)
  line(`[초안 대조 - 사용자 시점] 커플 type의 서재 = ${libType.length}권 (issues_public)`)
  const { data: viewRows, error: viewErr } = await dbTypeA.from('issues_public').select('id, published_at').eq('couple_id', typeCouple.id)
  line(`[초안 대조] 필터 없이 issues_public 직접 조회: ${viewErr ? `오류 ${viewErr.message}` : `${viewRows.length}행`} -> 뷰가 초안을 거른다(security_invoker + issues_select 정책)`)
  const { data: tableRows } = await dbTypeA.from('issues').select('id').eq('couple_id', typeCouple.id)
  line(`[초안 대조] issues 테이블 직접 조회(사용자): ${tableRows?.length ?? 0}행 (RLS)`)

  // ── 인쇄용 칸은 뷰에 없다 ────────────────────────────────────────────
  const printCol = ['pdf', 'print', 'path'].join('_')
  const { error: printErr } = await dbPhotoA.from('issues_public').select(printCol).limit(1)
  line(`[절대 규칙 3] issues_public에서 인쇄용 칸 조회 -> ${printErr ? `오류(칸 없음): ${printErr.code}` : '조회됨(!)'}`)
  const { error: printTableErr } = await dbPhotoA.from('issues').select(printCol).limit(1)
  line(`[절대 규칙 3] issues 테이블에서 인쇄용 칸을 사용자 권한으로 조회 -> ${printTableErr ? `오류: ${printTableErr.code}` : '조회됨(RLS 범위 행만)'}`)

  // ── 다음 호 카드: 시험 커플의 실제 값 ─────────────────────────────────
  for (const [label, db, coupleId] of [['photo', dbPhotoA, issue.coupleId], ['type', dbTypeA, typeCouple.id]] as const) {
    const rows = await fetchIssueProgressRows(db)
    const draft = pickDraftIssue(rows)
    if (!draft) {
      line(`[다음 호 카드 ${label}] fn_issue_progress 행 ${rows.length}개 -> 빈 결과(초안·코너 행 없음): 카드 대신 D14 문구`)
      continue
    }
    const today = kstToday(new Date())
    const percent = periodElapsedPercent(draft.periodStart, draft.periodEnd, today)
    const counts = await countMaterials(db, coupleId, { periodStart: draft.periodStart, periodEnd: draft.periodEnd })
    line(
      `[다음 호 카드 ${label}] 초안 ${draft.issueId} 기간 ${draft.periodStart}~${draft.periodEnd} · 오늘(KST) ${today} · 경과율 ${percent}% · 재료 대화 ${counts.messages} / 사진 ${counts.photos} / 데이트 ${counts.dates} · 카드 "${issueMonthLabel({ periodStart: draft.periodStart, issueType: draft.issueType, title: null })}"`,
    )
  }

  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/58-u3-library.txt', text)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU3Library.ts run')
