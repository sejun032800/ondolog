/**
 * 운영자 경로의 안전 확인 - 순수 함수 (위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md).
 *
 * 둘이다.
 * 1. **개발 프로젝트 확인** - service_role 키로 접속하는 대상이 개발 프로젝트(`ondolog`, ROADMAP R13-7)가 아니면 멈춘다.
 *    방법: 접속 URL의 프로젝트 ref를 `supabase/.temp/linked-project.json`(CLI가 `supabase link`로 남기는 연결 정보)의
 *    `ref`·`name`과 대조한다. 파일이 없거나 이름이 `ondolog`가 아니거나 ref가 다르면 멈춘다(fail closed).
 * 2. **시험 커플 확인** - 샘플 출력 모드는 시험 커플에만 돈다(R13-7: 이름에 `test`). 판정 열은 `couples.nickname`이다.
 * 3. **실제 모드 대상 잠금**(84-f · R141-2 · R140-4) - `--mode live`는 2에 더해 **로컬 시드 목록 파일(`scripts/ops/out/seed-m2b*.json`)에 있는
 *    커플 id**일 때만 돈다. 별명 "test"만 보면 51- 두 폰 커플(시험 이름)도 통과하므로, 합성 시드 커플만 실제 모드에 들어가게 장치로 막는다.
 *    폰 커플 실제 모드의 길(R141-3)은 이 파일 밖이다.
 *
 * 멈춤 문구에 커플 id를 넣지 않는다(84-f - 출력 0).
 *
 * 비밀값은 이 파일을 거쳐 어디에도 쓰지 않는다. `redactSecrets`는 출력 직전의 마지막 방어선이다.
 */

/** 개발 프로젝트 이름(ROADMAP R13-7). 운영 프로젝트는 M4에 새 이름으로 만든다. */
export const DEVELOPMENT_PROJECT_NAME = 'ondolog'

/** 시험 표시(R13-7) - 이름에 들어가는 낱말. */
export const TEST_MARK = 'test'

/** 멈춤 - 안전 확인에 걸렸다. 고치지 않고 이 지점에서 운영자에게 알린다. */
export class OpsStopError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'OpsStopError'
  }
}

export interface LinkedProject {
  readonly ref: string
  readonly name: string
}

/** `https://<ref>.supabase.co` -> `<ref>`. 이 모양이 아니면 멈춘다. */
export function projectRefFromUrl(url: string): string {
  const match = /^https:\/\/([a-z0-9]{10,32})\.supabase\.co\/?$/.exec(url.trim())
  if (match === null) throw new OpsStopError('접속 URL이 https://<프로젝트 ref>.supabase.co 모양이 아니다')
  return match[1]
}

/** `linked-project.json` 본문 -> 연결 정보. 모양이 틀리면 멈춘다. */
export function parseLinkedProject(json: string): LinkedProject {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new OpsStopError('supabase/.temp/linked-project.json을 읽을 수 없다')
  }
  const v = value as { ref?: unknown; name?: unknown } | null
  if (v === null || typeof v !== 'object' || typeof v.ref !== 'string' || typeof v.name !== 'string') {
    throw new OpsStopError('supabase/.temp/linked-project.json에 ref·name이 없다')
  }
  return { ref: v.ref, name: v.name }
}

/** 접속 대상이 개발 프로젝트인가. 아니면 던진다. 돌려주는 값은 확인된 ref(비밀이 아니다). */
export function assertDevelopmentProject(url: string, linked: LinkedProject | null): string {
  const ref = projectRefFromUrl(url)
  if (linked === null) {
    throw new OpsStopError('supabase/.temp/linked-project.json이 없어 접속 대상이 개발 프로젝트인지 확인할 수 없다')
  }
  if (linked.name !== DEVELOPMENT_PROJECT_NAME) {
    throw new OpsStopError(`연결된 프로젝트 이름이 ${DEVELOPMENT_PROJECT_NAME}이 아니다 (${linked.name})`)
  }
  if (linked.ref !== ref) {
    throw new OpsStopError('접속 URL의 프로젝트가 연결된 개발 프로젝트와 다르다')
  }
  return ref
}

/** 이름에 시험 표시가 있는가(대소문자 무시). */
export function hasTestMark(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.toLowerCase().includes(TEST_MARK)
}

export interface CoupleForGuard {
  readonly id: string
  readonly nickname: string | null
}

/** 시험 커플인가. 아니면 던진다(R13-7). */
export function assertTestCouple(couple: CoupleForGuard): void {
  if (!hasTestMark(couple.nickname)) {
    throw new OpsStopError(`샘플 출력 모드는 시험 커플에만 돈다 - couples.nickname에 '${TEST_MARK}'가 없다`)
  }
}

/** 시드 목록 파일 이름(84-f) - `seed-m2b.json`(10-22 A/B/C/F) · `seed-m2b-2025.json`(G). 실패 기록(`.failed.json`)은 목록이 아니다. */
export function isSeedListFile(name: string): boolean {
  return /^seed-m2b[\w.-]*\.json$/.test(name) && !name.endsWith('.failed.json')
}

/**
 * 로컬 시드 목록 파일들에서 커플 id를 모은다(84-f). 목록의 커플 중 별명에 시험 표시가 있는 것만. 깨진 파일 · 모양이 아닌 항목은 건너뛴다(그 id는 통과하지 못한다 - fail-closed).
 */
export function seedListCoupleIds(files: readonly { readonly name: string; readonly text: string }[]): Set<string> {
  const out = new Set<string>()
  for (const f of files) {
    if (!isSeedListFile(f.name)) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(f.text)
    } catch {
      continue
    }
    const couples = typeof parsed === 'object' && parsed !== null ? (parsed as { couples?: unknown }).couples : undefined
    if (!Array.isArray(couples)) continue
    for (const c of couples) {
      if (typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'string' && hasTestMark((c as { nickname?: unknown }).nickname as string)) {
        out.add((c as { id: string }).id)
      }
    }
  }
  return out
}

/** 실제 모드 대상 잠금(84-f) - 시드 목록에 있는 커플 id가 아니면 던진다. 문구에 id 0. */
export function assertLiveTarget(coupleId: string, seedCoupleIds: ReadonlySet<string>): void {
  if (!seedCoupleIds.has(coupleId)) {
    throw new OpsStopError('실제 모드는 로컬 시드 목록(scripts/ops/out/seed-m2b*.json)에 있는 시험 커플에만 돈다 - 이 커플은 목록에 없다(R140-4 · R141-2)')
  }
}

/** 출력 직전의 마지막 방어선 - 비밀값이 문자열 어디에 섞여도 지운다. */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  let out = text
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join('[REDACTED]')
  }
  return out
}
