/**
 * test-68-purge 커플의 7일 유예 해제가 pg_cron 배치로 실행됐는지 본다 (`68-` 1부 산출) - 원격 **개발** DB, **읽기 전용** (Deno 전용).
 * **작성만 했고 실행하지 않았다.** `verifyDissolution68.ts run`이 남긴 scripts/ops/out/68-purge-target.json 의 날짜 이후에 사람이 실행한다.
 *
 * 아무것도 쓰지 않는다(SELECT 만). 파괴적 배치 함수는 부르지 않는다 - 배치(execute-dissolutions, 0 5 * * *)가 이미 돌았는지 결과만 본다(R34-3).
 * 읽기는 service_role 이다(시험 계정이 사용자 세션으로는 실행 뒤 상대의 행을 볼 수 없는 경우가 있어서 - 읽기 전용이라 R40-5 의 대상이 아니다).
 *
 * 기준: SCHEMA 11-3 execute_dissolution 본문.
 *   - 해제 행: executed_at 이 있다 · cancelled_at 은 null
 *   - couples.status = 'dissolved' · dissolved_at 이 있다 (상대가 탈퇴 상태가 아니므로 couples 행은 지워지지 않는다)
 *   - 개시자(p) 파생 행 삭제: messages(sender_id) · data_entries(author_id) · stories(author_id) · stat_snapshots(user_id) 0건
 *   - 개시자 profiles: reference_photo_path null · biometric_consent_revoked_at 이 찍힘
 *   - 상대(q) 행 유지: q 의 messages 가 1건 이상 · q 의 프로필이 그대로
 * 배치가 아직 안 돌았으면(유예 끝 전 · 유예는 끝났지만 executed_at 이 없음) "아직"을 출력하고 끝낸다(실패 아님, 종료 코드 0).
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
 *
 * 사용 (저장소 루트에서, PowerShell 한 줄 - ref 는 supabase/.temp/project-ref 에서 읽는다):
 *   $ref = (Get-Content supabase/.temp/project-ref).Trim(); deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net="$ref.supabase.co" --allow-read=supabase/.temp/linked-project.json,src,scripts/ops/out --allow-write=scripts/ops/out scripts/ops/verifyPurge68.ts run
 *
 * 출력 원문: scripts/ops/out/68-purge-check.txt (추적 안 함)
 */
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

async function main(): Promise<void> {
  const target = JSON.parse(await Deno.readTextFile('scripts/ops/out/68-purge-target.json')) as {
    coupleId: string
    dissolutionId: string
    initiatedBy: string
    partner: string
    purgeScheduledAt: string
    nextRunUtc: string
    nextRunKst: string
  }
  const ops = await connectOps()
  const db: Db = ops.client
  const say = printer([...ops.secrets])
  const out: string[] = []
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  let failures = 0
  const check = (cond: boolean, msg: string) => {
    line(`${cond ? 'OK  ' : 'FAIL'} ${msg}`)
    if (!cond) failures += 1
  }
  async function save(): Promise<void> {
    let text = out.join('\n') + '\n'
    for (const s of ops.secrets) if (s) text = text.split(s).join('<비밀값>')
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    await Deno.writeTextFile('scripts/ops/out/68-purge-check.txt', text)
  }

  line(`대상: 해제 ${target.dissolutionId.slice(0, 8)} · 커플 ${target.coupleId.slice(0, 8)} · purge_scheduled_at ${target.purgeScheduledAt} · 돌릴 날짜 ${target.nextRunUtc} (${target.nextRunKst})`)
  const d = await db.from('couple_dissolutions').select('*').eq('id', target.dissolutionId).maybeSingle()
  if (d.error) throw new Error(`해제 조회 실패: ${d.error.message}`)
  if (d.data === null) {
    line('해제 행이 없다 - 커플 행이 지워졌거나(양쪽 이탈) 다른 이유로 사라졌다. 이 시험 구성에서는 일어나지 않아야 한다.')
    line('결과: 확인 불가(FAIL)')
    await save()
    Deno.exit(1)
  }
  const now = Date.now()
  if (d.data.cancelled_at !== null) {
    line(`해제가 취소되어 있다(cancelled_at ${d.data.cancelled_at}) - 이 시험이 기대한 상태가 아니다.`)
    await save()
    Deno.exit(1)
  }
  if (d.data.executed_at === null) {
    const due = new Date(d.data.purge_scheduled_at).getTime()
    line(now < due
      ? `아직 - 유예가 끝나지 않았다(purge_scheduled_at ${d.data.purge_scheduled_at}). ${target.nextRunUtc} 이후에 다시 실행한다.`
      : `아직 - 유예는 끝났지만 배치가 아직 안 돌았다(executed_at 없음). 다음 실행 ${target.nextRunUtc} (${target.nextRunKst}) 이후에 다시 실행한다.`)
    await save()
    return
  }

  line(`해제 실행됨: executed_at ${d.data.executed_at}`)
  check(d.data.executed_at !== null && d.data.cancelled_at === null, '해제 행: executed_at 있음 · cancelled_at null')
  const c = await db.from('couples').select('status, dissolved_at').eq('id', target.coupleId).maybeSingle()
  check(!c.error && c.data !== null && c.data.status === 'dissolved' && c.data.dissolved_at !== null, `couples.status = ${c.data?.status} · dissolved_at ${c.data?.dissolved_at}`)

  const count = async (table: string, col: string, id: string) => {
    const r = await db.from(table).select('id', { count: 'exact', head: true }).eq(col, id)
    if (r.error) throw new Error(`${table} 조회 실패: ${r.error.message}`)
    return r.count as number
  }
  const p = {
    messages: await count('messages', 'sender_id', target.initiatedBy),
    entries: await count('data_entries', 'author_id', target.initiatedBy),
    stories: await count('stories', 'author_id', target.initiatedBy),
    stats: await count('stat_snapshots', 'user_id', target.initiatedBy),
  }
  check(p.messages === 0 && p.entries === 0 && p.stories === 0 && p.stats === 0, `개시자 파생 행 0건: messages ${p.messages} · data_entries ${p.entries} · stories ${p.stories} · stat_snapshots ${p.stats}`)
  const pp = await db.from('profiles').select('reference_photo_path, biometric_consent_revoked_at').eq('id', target.initiatedBy).maybeSingle()
  check(!pp.error && pp.data !== null && pp.data.reference_photo_path === null && pp.data.biometric_consent_revoked_at !== null,
    `개시자 profiles: reference_photo_path ${pp.data?.reference_photo_path} · biometric_consent_revoked_at ${pp.data?.biometric_consent_revoked_at}`)
  const qm = await count('messages', 'sender_id', target.partner)
  check(qm >= 1, `상대 messages 유지: ${qm}건`)
  const qp = await db.from('profiles').select('id, deleted_at').eq('id', target.partner).maybeSingle()
  check(!qp.error && qp.data !== null && qp.data.deleted_at === null, '상대 프로필 그대로(deleted_at null)')

  line(`\n실패 ${failures}건`)
  await save()
  if (failures > 0) Deno.exit(1)
}

if (import.meta.main) {
  if (Deno.args[0] === 'run') await main()
  else console.log('사용: verifyPurge68.ts run')
}
