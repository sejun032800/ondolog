/**
 * 운영자 명령(Deno)의 공통 도구 - 인수 읽기, 비밀값을 지운 출력·파일 쓰기. 위임: 54-corner-pipeline-operator-path.md
 *
 * 출력과 파일은 모두 `redactSecrets`를 거친다(service_role 키 값이 어디에도 남지 않게 하는 마지막 방어선).
 */

import { OpsStopError, redactSecrets } from './opsGuards.ts'

/** `--이름 값` 쌍만 받는다. 모르는 인수는 멈춘다(실제 호출 경로를 부르는 인수 같은 것은 정의되어 있지 않다). */
export function parseFlags(argv: readonly string[], allowed: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if (!key.startsWith('--') || value === undefined) throw new OpsStopError(`인수 형식 오류: ${key}`)
    if (!allowed.includes(key.slice(2))) throw new OpsStopError(`알 수 없는 인수: ${key}`)
    flags.set(key.slice(2), value)
  }
  return flags
}

export function requireFlag(flags: Map<string, string>, name: string): string {
  const value = flags.get(name)
  if (value === undefined || value.length === 0) throw new OpsStopError(`--${name} 이(가) 필요하다`)
  return value
}

export function printer(secrets: readonly string[]): (line: string) => void {
  return (line) => console.log(redactSecrets(line, secrets))
}

export async function writeJson(path: string, value: unknown, secrets: readonly string[]): Promise<void> {
  const slash = path.lastIndexOf('/')
  if (slash > 0) await Deno.mkdir(path.slice(0, slash), { recursive: true })
  await Deno.writeTextFile(path, redactSecrets(JSON.stringify(value, null, 2), secrets) + '\n')
}
