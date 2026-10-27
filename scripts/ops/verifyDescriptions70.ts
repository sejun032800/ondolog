/**
 * 029 description_ko 36행 실증 (`70-` 산출) - 원격 **개발** DB (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 029를 원격에 적용하고 `scripts/db/verify_029_privileges.sql`이 전부 ok 인 것을 본 뒤 사람이 실행한다.
 * 적용 전에 돌리면 ONDOLOG_029_APPLIED=1 이 없어 멈춘다.
 *
 * 세션 규칙 (R40-5 · R44-3): service_role 은 시험 계정을 **만들기**(계정 생성 · 로그인 링크 발급)에만 쓴다. 읽기는 전부 그 계정의 **사용자 세션**이다.
 * 이 스크립트는 원격에 쓰지 않는다(계정 생성 외). 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 SKIP 으로 적는다.
 * 파괴적 배치 함수(execute_dissolution · apply_retention_policy)는 어떤 경로로도 부르지 않는다(R34-3).
 *
 * 경우:
 *   ① description_ko 36행 - 사용자 세션으로 love_type_labels 를 읽어 docs/ONDOLOG_36_descriptions.md(** 제외)와 글자 단위 대조, 불일치 0 · null 0
 *   ② 0 의 어긋남이 029 뒤 일치:
 *      - 016 어긋남(라벨 INSERT 추가분) -> 라벨 8칸이 MASTER 10-5-1 · 10-5-2 와 글자 단위로 같다(36행, 028 로 해소된 상태가 유지됨)
 *      - 020 어긋남(description_ko 0건 갱신) -> ① 과 같다
 *   ③ 새 시험 계정 test-70-* (보안 점검은 compareSecurity.ts 가 따로 한다 - 69- 뒤 기준선 대비 변화 0)
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_029_APPLIED=1
 *
 * 사용: scripts/ops/out/70-run.ps1 (저장소 루트, PowerShell - ref 는 supabase/.temp/project-ref 에서 읽는다)
 *
 * 출력 원문: scripts/ops/out/70-descriptions.txt (키 · 토큰 · URL · 프로젝트 ref 없음, 추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'
import { parseMasterLabels, type LabelRow } from './labelsMaster.ts'
import { parseDescriptions } from './descriptionsMaster.ts'

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type Err = { code?: string; message?: string } | null

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_029_APPLIED') !== '1') {
    throw new Error('029 적용 전에는 실행하지 않는다. 적용 · verify_029_privileges.sql 확인 뒤 ONDOLOG_029_APPLIED=1 로 실행')
  }
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
  const done = new Set<string>()
  const failed = new Set<string>()
  async function step(id: string, label: string, needs: string[], fn: () => Promise<string>): Promise<void> {
    const blocked = needs.filter((n) => !done.has(n))
    if (blocked.length > 0) {
      failed.add(id)
      line(`SKIP ${id} ${label} - 앞 단계(${blocked.join(',')})가 통과하지 못해 실행하지 않음`)
      return
    }
    try {
      const detail = await fn()
      done.add(id)
      line(`OK   ${id} ${label} - ${detail}`)
    } catch (e) {
      failures += 1
      failed.add(id)
      line(`FAIL ${id} ${label} - ${(e as Error).message}`)
    }
  }
  const must = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg)
  }
  const errText = (e: Err) => (e ? `${e.code ?? '?'} ${e.message ?? ''}` : '오류 없음(!)')

  // 대조 원본은 저장소의 파일 (읽기 실패하면 아래 단계가 전부 SKIP)
  let desc = new Map<string, string>()
  let master: LabelRow[] = []
  await step('①0', '36_descriptions.md 에서 36개 · MASTER 10-5-2 에서 36행 읽기', [], async () => {
    desc = parseDescriptions(await Deno.readTextFile('docs/ONDOLOG_36_descriptions.md'))
    master = parseMasterLabels(await Deno.readTextFile('docs/ONDOLOG_MASTER.md'))
    must(desc.size === 36, `설명문 ${desc.size}개를 읽음`)
    must(master.length === 36 && new Set(master.map((r) => r[0])).size === 36, `MASTER 에서 ${master.length}행을 읽음`)
    for (const r of master) must(desc.has(r[0]), `${r[0]} 의 설명문이 원본에 없음`)
    return '설명문 36개 · 라벨 36행 (코드 일치)'
  })

  // ③ 새 시험 계정 test-70-*
  const run = Date.now().toString(36)
  let db: Db = null
  await step('준비', '시험 계정 하나 생성 · 로그인 (service_role 은 만들기만, 이후는 사용자 세션)', ['①0'], async () => {
    const email = `test-70-${run}-u@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패: ${created.error.message}`)
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const c: Db = createClient(url, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (v.error) throw new Error(`로그인 실패: ${v.error.message}`)
    secrets.push(v.data.session?.access_token ?? '', v.data.session?.refresh_token ?? '')
    db = c
    return `이메일 접두 test-70-${run}-`
  })

  // ① description_ko 36행
  await step('①', 'description_ko 36행 - 사용자 세션으로 읽어 36_descriptions.md(** 제외)와 글자 단위 대조, 불일치 0 · null 0', ['①0', '준비'], async () => {
    const r = await db.from('love_type_labels').select('code, description_ko').order('code')
    must(!r.error, `읽기 실패 ${errText(r.error)}`)
    must(r.data.length === 36, `원격 ${r.data.length}행 (36이어야 함)`)
    const nulls = r.data.filter((x: { description_ko: string | null }) => x.description_ko === null || x.description_ko === '').map((x: { code: string }) => x.code)
    must(nulls.length === 0, `description_ko 가 비어 있음 ${nulls.length}건: ${nulls.slice(0, 5).join(',')}`)
    const diffs: string[] = []
    for (const x of r.data as { code: string; description_ko: string }[]) {
      const want = desc.get(x.code)
      if (want === undefined) diffs.push(`${x.code}: 원본에 없음`)
      else if (want !== x.description_ko) {
        let i = 0
        while (i < want.length && want[i] === x.description_ko[i]) i++
        diffs.push(`${x.code}: ${i}번째 글자부터 다름 (원격 길이 ${x.description_ko.length} / 원본 ${want.length})`)
      }
    }
    must(diffs.length === 0, `불일치 ${diffs.length}건: ${diffs.slice(0, 3).join(' ; ')}`)
    const stars = r.data.filter((x: { description_ko: string }) => x.description_ko.includes('**')).length
    must(stars === 0, `별표가 남은 행 ${stars}`)
    return '36행 · 불일치 0 · null 0 · 별표 0'
  })

  // ② 0 의 어긋남이 029 뒤 일치
  await step('②', '0 의 어긋남 해소 - 016(라벨 8칸 = MASTER 와 같음) · 020(description_ko = ① 과 같음)', ['①0', '준비', '①'], async () => {
    const r = await db.from('love_type_labels')
      .select('code, enneagram_core, attachment, core_en, suffix_en, label_en, label_ko, copy_ko').order('code')
    must(!r.error, `읽기 실패 ${errText(r.error)}`)
    const rows: LabelRow[] = r.data.map((x: Record<string, unknown>) => [
      x.code, x.enneagram_core, x.attachment, x.core_en, x.suffix_en, x.label_en, x.label_ko, x.copy_ko,
    ] as LabelRow)
    must(rows.length === 36, `원격 ${rows.length}행`)
    const byCode = new Map(rows.map((x) => [x[0], x]))
    const diffs: string[] = []
    for (const m of master) {
      const x = byCode.get(m[0])
      if (!x) diffs.push(`${m[0]}: 원격에 없음`)
      else if (JSON.stringify(x) !== JSON.stringify(m)) diffs.push(`${m[0]}: 원격 ${JSON.stringify(x)} / MASTER ${JSON.stringify(m)}`)
    }
    must(diffs.length === 0, `016 라벨 불일치 ${diffs.length}건: ${diffs.slice(0, 3).join(' ; ')}`)
    return '016: 라벨 36행 8칸 MASTER 일치 (028 로 해소, 029 뒤에도 유지) · 020: description_ko 36행 일치(①)'
  })

  await Deno.mkdir('scripts/ops/out', { recursive: true })
  line(`\n실패 ${failures}건 · 통과하지 못한 단계 [${[...failed].join(',')}]`)
  line('보안 점검은 compareSecurity.ts (69- 뒤 기준선 대비 변화 0)로 따로 한다. 시험 계정(test-70-*)은 삭제하지 않는다(개발 프로젝트).')
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/70-descriptions.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (import.meta.main) await main()
