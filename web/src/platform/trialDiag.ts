/**
 * 시험 빌드 전용 진단 기록(74-h2 ①-c). 실패한 **단계 이름**과 짧은 분류, 몇 번째 처리인지만 남긴다 - 코드 · 주소 · 토큰 · 이메일 · 오류 원문은 0.
 * 부르는 쪽은 반드시 `if (IS_TRIAL_BUILD) trialDiag.record(...)`로 감싼다 - 운영 빌드에서는 그 호출(과 단계 이름 글자)이 번들에서 빠진다.
 * 화면에 그리는 부분(한글 단계 이름)은 `components/TrialDiag.tsx`에만 있다.
 */
import { create } from 'zustand'

export type DiagStep = 'link' | 'exchange' | 'finalize' | 'state' | 'detail'

export interface DiagEntry {
  step: DiagStep
  /** 짧은 분류(영문 소문자 · 숫자 · 밑줄 · 대문자 코드). 오류 원문이 아니다. */
  kind: string
  /** 앱 링크 접수 순번(이 실행에서 몇 번째 접수인가). */
  seq: number
}

interface DiagState {
  last: DiagEntry | null
  linkSeq: number
  /** 앱 링크 접수 한 번을 센다(중복 걸러진 것 포함). */
  bumpLink: () => number
  record: (step: DiagStep, kind: string) => void
  clear: () => void
}

export const useTrialDiag = create<DiagState>((set, get) => ({
  last: null,
  linkSeq: 0,
  bumpLink: () => {
    const n = get().linkSeq + 1
    set({ linkSeq: n })
    return n
  },
  record: (step, kind) => set({ last: { step, kind, seq: get().linkSeq } }),
  clear: () => set({ last: null }),
}))

/** 오류 객체에서 짧은 분류만 뽑는다: `code`(문자열) 또는 `name`이 안전한 글자뿐일 때만, 아니면 `unknown`. 메시지는 읽지 않는다. */
export function safeKind(err: unknown): string {
  const e = err as { code?: unknown; name?: unknown } | null | undefined
  for (const v of [e?.code, e?.name]) {
    if (typeof v === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(v)) return v
    if (typeof v === 'number') return String(v)
  }
  return 'unknown'
}

/** 앱 링크 리스너가 지금 몇 개 등록돼 있는가(시험이 "늘 1"을 확인한다). 시험 빌드 · 시험에서만 센다. */
export const useListenerCount = create<{ n: number; inc: () => void; dec: () => void }>((set) => ({
  n: 0,
  inc: () => set((s) => ({ n: s.n + 1 })),
  dec: () => set((s) => ({ n: s.n - 1 })),
}))
