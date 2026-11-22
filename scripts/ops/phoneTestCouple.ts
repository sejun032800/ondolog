/**
 * 51- ③ 두 폰 커플 실제 모드 길 - 두 겹 잠금(ROADMAP r143 R143-4 · R141-3 · R140-5). 위임: .claude/state/prompts/phase-7/51-3-dispatch-phone-couple-live.md
 *
 * 84-f 잠금(`opsGuards.ts` `assertLiveTarget` - 로컬 시드 목록 + 별명 "test")은 **그대로**다. 이 파일은 그 옆에 길을 하나 더 둔다.
 * 시드 목록 밖 커플을 `--mode live`로 돌리려면 **둘 다** 필요하다:
 *   (가) 그 커플의 **두 계정이 모두** 75- 0-6의 저장소 밖 시험 계정 허용 목록(`resetAllowlist.ts` - 초기화 스크립트와 **같은 파일 · 같은 해석**)에 있다
 *   (나) 운영자가 명시 플래그 `--allow-phone-test-couple`를 준다
 * 플래그가 없으면 이 길은 열리지 않는다(84-f 길만). 플래그가 있으면 대상은 **허용 목록 계정들로 이루어진 커플 하나**를 찾아서 정한다 -
 * 운영자는 커플 id를 치지도 보지도 않는다(`--couple-id`와 함께 주면 멈춤). 0개 · 2개 이상이면 개수만 알리고 멈춘다.
 *
 * 판정 순서: 플래그 조합(네트워크 0) -> 허용 목록 파일 · project= 줄 · 접속 URL ref(네트워크 0, 75- 0-6과 같은 함수) ->
 *   접속 -> 허용 목록 이메일의 계정 id(읽기) -> 두 구성원이 모두 그 계정인 커플(읽기) -> 정확히 하나. **DB 쓰기 · LLM 호출 전에** 멈춘다.
 * 그 뒤 `generateIssue`의 별명 "test" · active · AI 동의 · 모델 확인은 그대로 돈다.
 *
 * 멈춤 문구 · 출력에 커플 id · 계정 id · 이메일 · 허용 목록 경로 · 줄 내용 0(개수 · 줄 번호만).
 */

import { OpsStopError, assertLiveTarget } from './opsGuards.ts'
import { makeResetGate, parseAllowlist } from './resetAllowlist.ts'

/** 명시 플래그(값 없는 인수). */
export const PHONE_TEST_COUPLE_FLAG = '--allow-phone-test-couple'
/** 미리 보기(쓰기 0 · LLM 0) 플래그(값 없는 인수). */
export const DRY_RUN_FLAG = '--dry-run'

/** 값 없는 플래그를 떼어 낸다(나머지는 기존 `parseFlags`의 `--이름 값` 쌍). 같은 플래그를 두 번 주면 멈춘다. */
export function splitSwitches(argv: readonly string[], switches: readonly string[]): { readonly rest: string[]; readonly on: ReadonlySet<string> } {
  const rest: string[] = []
  const on = new Set<string>()
  for (const a of argv) {
    if (switches.includes(a)) {
      if (on.has(a)) throw new OpsStopError(`같은 인수를 두 번 줬다: ${a}`)
      on.add(a)
    } else {
      rest.push(a)
    }
  }
  return { rest, on }
}

export type PhoneRunKind = 'seed' | 'phone_live' | 'phone_dry_run'

/**
 * 플래그 조합 판정(접속 전 · 네트워크 0).
 * - 플래그 없음: 84-f 길(`seed`) - `--dry-run`은 이 길에 없다(멈춤).
 * - 플래그 있음: `--couple-id`를 주면 멈춤(대상은 허용 목록에서 찾는다). `--dry-run`이면 `--mode` 없이만. 아니면 `--mode live`여야 한다
 *   (샘플 출력을 폰 커플에 쓰지 않는다).
 */
export function phoneRunKind(input: {
  readonly allowPhone: boolean
  readonly dryRun: boolean
  readonly mode: string | undefined
  readonly hasCoupleId: boolean
}): PhoneRunKind {
  if (!input.allowPhone) {
    if (input.dryRun) throw new OpsStopError(`${DRY_RUN_FLAG}는 ${PHONE_TEST_COUPLE_FLAG}와 함께만 쓴다`)
    return 'seed'
  }
  if (input.hasCoupleId) throw new OpsStopError(`${PHONE_TEST_COUPLE_FLAG}와 --couple-id를 함께 주지 않는다 - 대상은 허용 목록 계정의 커플에서 찾는다`)
  if (input.dryRun) {
    if (input.mode !== undefined) throw new OpsStopError(`${DRY_RUN_FLAG}는 --mode 없이 쓴다(쓰기 0 · LLM 0)`)
    return 'phone_dry_run'
  }
  if (input.mode !== 'live') throw new OpsStopError(`${PHONE_TEST_COUPLE_FLAG}는 --mode live 또는 ${DRY_RUN_FLAG}와 함께만 쓴다`)
  return 'phone_live'
}

/**
 * (가)의 앞 절반 - 허용 목록 파일 · 개발 프로젝트 표시(75- 0-6 `makeResetGate`와 같은 판정). 접속 전에 부른다.
 * 통과하면 목록의 이메일(소문자)을 돌려준다. 없거나 · 못 읽거나 · 형식 오류 · project= 없음 · URL ref 불일치 · 이메일 0이면 멈춘다.
 */
export function phoneAllowlistEmails(allowlistText: string | null, url: string | undefined): readonly string[] {
  if (allowlistText === null) throw new OpsStopError('허용 목록 파일이 없거나 읽을 수 없다(저장소 밖 75- 목록이 필요하다)')
  const list = parseAllowlist(allowlistText) // 형식 오류면 줄 번호만 담아 던진다
  const emails = [...list.emails].sort()
  if (emails.length === 0) throw new OpsStopError('허용 목록에 계정 이메일이 없다')
  const blocked = makeResetGate({ allowlistText, url })(emails)
  if (blocked !== null) throw new OpsStopError(`허용 목록 확인: ${blocked}`)
  return emails
}

/** 대상 찾기에 필요한 읽기(Supabase 어댑터 · 시험은 가짜). 쓰기 0. */
export interface PhoneCouplePort {
  /** 그 이메일의 인증 계정 id들(없으면 빈 배열). */
  findUserIds(email: string): Promise<readonly string[]>
  /** 구성원(`user_a_id` · `user_b_id`) 중 하나라도 이 id들 안인 커플. */
  couplesWithAnyMember(userIds: readonly string[]): Promise<readonly PhoneCoupleRow[]>
}

export interface PhoneCoupleRow {
  readonly id: string
  readonly status: string
  readonly user_a_id: string | null
  readonly user_b_id: string | null
}

/**
 * (가)의 뒤 절반 - 두 구성원이 **모두** 허용 목록 계정인 커플을 찾는다(해제가 끝난 `dissolved`는 세지 않는다).
 * 정확히 하나면 그 id, 0개 · 2개 이상이면 개수만 담아 멈춘다. 한 계정만 목록에 있는 커플은 후보가 아니다.
 */
export async function resolvePhoneTestCouple(port: PhoneCouplePort, emails: readonly string[]): Promise<string> {
  const allowed = new Set<string>()
  for (const email of emails) for (const id of await port.findUserIds(email)) allowed.add(id)
  if (allowed.size === 0) throw new OpsStopError('허용 목록 이메일 중 계정이 있는 것이 0개다 - 대상 커플 0개')
  const rows = await port.couplesWithAnyMember([...allowed].sort())
  const seen = new Set<string>()
  const candidates = rows.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return c.status !== 'dissolved' && c.user_a_id !== null && c.user_b_id !== null && allowed.has(c.user_a_id) && allowed.has(c.user_b_id)
  })
  if (candidates.length !== 1) {
    throw new OpsStopError(`두 계정이 모두 허용 목록에 있는 커플이 ${candidates.length}개다 - 정확히 1개일 때만 진행한다`)
  }
  return candidates[0].id
}

/**
 * 실제 모드 대상 잠금(84-f + 51- ③). `phoneTestCouple`가 있으면(두 겹 잠금을 지나 CLI가 넘긴 값) 그 커플만, 없으면 84-f 시드 목록만.
 * 둘을 섞지 않는다 - 플래그 실행에서 시드 커플 · 시드 실행에서 폰 커플은 멈춘다. 문구에 id 0.
 */
export function assertLiveTargetAllowed(coupleId: string, seedCoupleIds: ReadonlySet<string>, phoneTestCouple: string | null | undefined): void {
  if (phoneTestCouple !== null && phoneTestCouple !== undefined) {
    if (coupleId !== phoneTestCouple) throw new OpsStopError('두 폰 커플 길: 대상이 허용 목록으로 찾은 커플이 아니다(R141-3)')
    return
  }
  assertLiveTarget(coupleId, seedCoupleIds) // 84-f 그대로
}
