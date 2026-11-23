/**
 * 84-e 유성 규칙(MASTER 9-8-4 r80 · 보드 N-R17-Our-Sky-2 17-b · ROADMAP R137-1 · R137-2) - **순수 함수만**(시계 · 기기 저장 · 네트워크 0).
 *
 *  - 후보 = 발행된 호의 다정한 말 **"한 줄 선택"(sub)만**(대화 턴 · 짧은 반응 0). 원문은 지금 살아 있는 메시지 행에서 다시 읽는다(`meteorData.ts`).
 *  - **7일 지난 말**만 · 하루(KST 자정 기준) 최대 한 번 · 놓친 말은 다음 날 다시 후보 · **잡은 말은 다시 0** · 후보 0이면 아무것도 없다.
 *  - 고르는 법: 그날 후보를 보낸 시각 순으로 줄 세우고 (커플 + 사람 + KST 날짜) 해시로 하나 - 같은 날 다시 열어도 같은 말이다(난수 0).
 *  - 떨어지는 때: 하늘이 준비된 뒤 4~10초(같은 해시로 정한 값). 누를 수 있는 시간 3초 · 줄인 모션 제자리 빛 5.2초(보드 17-d).
 */
import { skyClock } from './skyMath'

export interface MeteorCandidate {
  /** 지금 살아 있는 메시지 행의 id. */
  readonly id: string
  readonly senderId: string
  /** 원문 - 화면에만 쓴다(기기 저장 0). */
  readonly body: string
  /** 보낸 시각(ISO). */
  readonly sentAt: string
}

/** 기기에만 두는 유성 기록 - **메시지 id와 날짜만**(원문 0). */
export interface MeteorMemory {
  /** 잡은 말의 메시지 id - 잡은 순서. C03 "{n} / {N}"의 순서다. */
  readonly caught: readonly string[]
  /** 유성이 마지막으로 떨어진 KST 날짜(`YYYY-MM-DD`) - 하루 한 번. */
  readonly lastDay: string | null
}

export const EMPTY_MEMORY: MeteorMemory = { caught: [], lastDay: null }

/** 7일 지난 말(R125-5 · MASTER 9-8-4). */
export const MIN_AGE_MS = 7 * 24 * 3_600_000

/** 보드 17-d 모션 허용표. */
export const METEOR_MS = {
  /** 머리 이동. */
  travel: 2400,
  /** 꼬리 0 -> 끝 길이. */
  tailGrow: 400,
  /** 사라짐(투명도 1 -> 0, 꼬리는 머리 쪽으로). */
  fade: 600,
  /** 누를 수 있는 시간 = 지나감 + 사라짐. */
  pressable: 3000,
  /** 줄인 모션 제자리 빛: 나타남 0.6 · 머묾 4 · 사라짐 0.6 = 5.2초(R137-2). */
  stillIn: 600,
  stillStay: 4000,
  stillOut: 600,
  pressableReduced: 5200,
  /** 하늘이 준비된 뒤 떨어지기까지. */
  delayMin: 4000,
  delayMax: 10000,
} as const

/** KST 날짜(`YYYY-MM-DD`). */
export function kstDay(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** 32비트 FNV-1a - 같은 글자면 같은 수(결정적). */
export function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 오늘 떨어질 수 있는 후보 - 7일 지난 말 · 잡지 않은 말. 보낸 시각 순(같으면 id 순). */
export function eligibleCandidates(candidates: readonly MeteorCandidate[], memory: MeteorMemory, now: Date): MeteorCandidate[] {
  const caught = new Set(memory.caught)
  const limit = now.getTime() - MIN_AGE_MS
  const seen = new Set<string>()
  return candidates
    .filter((c) => {
      const at = Date.parse(c.sentAt)
      if (Number.isNaN(at) || at > limit || caught.has(c.id) || seen.has(c.id) || c.body.trim() === '') return false
      seen.add(c.id)
      return true
    })
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export interface MeteorPlanInput {
  readonly candidates: readonly MeteorCandidate[]
  readonly memory: MeteorMemory
  readonly now: Date
  readonly coupleId: string
  readonly userId: string
  /** OUR SKY "유성 떨어뜨리기"(기기에만). */
  readonly enabled: boolean
}

export interface MeteorPlan {
  readonly candidate: MeteorCandidate
  /** 하늘이 준비된 뒤 떨어지기까지(ms, 4~10초). */
  readonly delayMs: number
  /** 지나가는 각도(도, 25~35). */
  readonly angleDeg: number
  readonly day: string
}

/** 오늘 떨어질 유성 하나 - 없으면 null(꺼짐 · 오늘 이미 떨어짐 · 후보 0). */
export function planMeteor(input: MeteorPlanInput): MeteorPlan | null {
  if (!input.enabled) return null
  const day = kstDay(input.now)
  if (input.memory.lastDay === day) return null
  const pool = eligibleCandidates(input.candidates, input.memory, input.now)
  if (pool.length === 0) return null
  const seed = `${input.coupleId}|${input.userId}|${day}`
  const candidate = pool[hash32(seed) % pool.length]
  const span = METEOR_MS.delayMax - METEOR_MS.delayMin
  return {
    candidate,
    delayMs: METEOR_MS.delayMin + (hash32(`${seed}|delay`) % (span + 1)),
    angleDeg: 25 + (hash32(`${seed}|angle`) % 11),
    day,
  }
}

/** 유성이 떨어졌다(잡든 놓치든 그날은 끝) - 날짜만 적는다. */
export function markDropped(memory: MeteorMemory, day: string): MeteorMemory {
  return { caught: memory.caught, lastDay: day }
}

/** 잡았다 - 메시지 id를 잡은 순서 끝에 더한다(이미 있으면 그대로). */
export function markCaught(memory: MeteorMemory, id: string): MeteorMemory {
  return memory.caught.includes(id) ? memory : { caught: [...memory.caught, id], lastDay: memory.lastDay }
}

/** 누를 수 있는 시간(ms) - 기본 3초 · 줄인 모션 5.2초. */
export function pressableMs(reduced: boolean): number {
  return reduced ? METEOR_MS.pressableReduced : METEOR_MS.pressable
}

/** C03 출처 줄 - "{이름} · {M}월 {D}일 밤 9시 30분"(89- patch10 2-4 - 시각은 `skyClock` · KST). */
export function fallenMeta(name: string, sentAt: string): string {
  const ms = Date.parse(sentAt)
  if (Number.isNaN(ms)) return name
  const k = new Date(ms + 9 * 3_600_000).toISOString()
  const md = `${Number(k.slice(5, 7))}월 ${Number(k.slice(8, 10))}일`
  return [name, `${md} ${skyClock(sentAt)}`].filter(Boolean).join(' · ')
}
