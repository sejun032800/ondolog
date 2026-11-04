// PGlite 를 jest 밖(일반 Node 프로세스)에서 돌리는 작은 서버 (71b-).
// 이유: PGlite 는 내부에서 동적 import() 를 쓰는데, jest 의 vm 안에서는 Node 의 --experimental-vm-modules 없이는 실패한다.
// jest 설정 · 실행 옵션을 바꾸지 않기 위해 PGlite 는 자식 프로세스에서 돌리고, 시험은 표준 입출력으로 문장을 보낸다.
// 프로토콜: 입력 한 줄 = JSON {id, op: 'exec'|'query', sql, params}. 출력 한 줄 = '@@' + JSON {id, ok, rows|error}.
// 이 파일은 SQL 을 갖고 있지 않다. 받은 문장을 그대로 실행할 뿐이다. 네트워크 접속 0.
import readline from 'node:readline'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const db = new PGlite({ extensions: { pg_trgm, btree_gist, pgcrypto } })
await db.waitReady

const send = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n')
send({ id: 0, ok: true, ready: true })

// 문장은 도착한 순서대로 하나씩 실행한다.
let chain = Promise.resolve()
const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  chain = chain.then(async () => {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    try {
      if (msg.op === 'exec') {
        await db.exec(msg.sql)
        send({ id: msg.id, ok: true })
      } else {
        const r = await db.query(msg.sql, msg.params ?? [])
        send({ id: msg.id, ok: true, rows: r.rows })
      }
    } catch (e) {
      send({ id: msg.id, ok: false, error: String(e && e.message ? e.message : e) })
    }
  })
})
rl.on('close', async () => {
  await chain
  await db.close()
  process.exit(0)
})
