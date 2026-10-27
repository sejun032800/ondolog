/**
 * 보안 점검(get_advisors security) 원문 JSON 두 개를 **경고 이름 + 대상 이름** 기준으로 비교한다 (Deno, 파일 읽기 전용 + 결과 파일 쓰기). 위임 `69-`.
 * 문장 전체 비교를 쓰지 않는다(securityCompare.ts). 원격에 접속하지 않는다.
 *
 * 사용 (저장소 루트, PowerShell 한 줄):
 *   deno run --no-check --no-lock --allow-read=scripts/ops/out --allow-write=scripts/ops/out scripts/ops/compareSecurity.ts scripts/ops/out/68-security-after.json scripts/ops/out/69-security-after.json scripts/ops/out/69-security-compare.txt
 * 기대하는 추가분이 있으면 끝에 `경고이름=대상1,대상2` 를 붙인다. 없으면 변화 0 이어야 한다. 어긋남이 있으면 종료 코드 1.
 */
import { compareAdvisors, type AdvisorDoc, type ExpectedAdded } from './securityCompare.ts'

const [beforePath, afterPath, outPath, ...expects] = Deno.args
if (!beforePath || !afterPath || !outPath) {
  console.log('사용: compareSecurity.ts <전.json> <후.json> <결과.txt> [경고이름=대상1,대상2 ...]')
  Deno.exit(2)
}
const read = async (p: string): Promise<AdvisorDoc> => JSON.parse(await Deno.readTextFile(p))
const expected: ExpectedAdded[] = expects.map((e) => {
  const [lint, names] = e.split('=')
  return { lint, names: (names ?? '').split(',').filter(Boolean) }
})
let after: AdvisorDoc
try {
  after = await read(afterPath)
} catch {
  console.log(`${afterPath} 이 없다 - 적용 뒤 get_advisors(security) 원문 JSON 을 그 이름으로 저장한 다음 다시 실행한다.`)
  Deno.exit(2)
}
const { lines, bad } = compareAdvisors(await read(beforePath), after, expected)
const text = lines.join('\n') + '\n'
console.log(text)
await Deno.writeTextFile(outPath, text)
if (bad > 0) Deno.exit(1)
