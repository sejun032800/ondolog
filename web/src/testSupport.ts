/** 시험 보조(시험 파일이 아니다): 가짜 DB · 가짜 Supabase 클라이언트 · 가짜 다리. 실제 주소 · 키는 어디에도 없다. */
import { vi } from 'vitest'
import { useSessionStore } from '@/store/sessionStore'
import type { MbtiType, QuizChoice } from '@/constants/quizTypes'
import type { WebSupabase } from './auth/client'
import { webBridge, type NativeBridge } from './platform/bridge'
import type { Nav } from './screens'

export interface DbCall {
  table: string
  op: 'read' | 'insert'
  payload?: unknown
}

export interface FakeDbOptions {
  profile?: Record<string, unknown> | null
  assessment?: Record<string, unknown> | null
  /** profiles 조회가 차례로 돌려줄 오류(없으면 정상). */
  readErrors?: Array<{ code: string } | undefined>
}

export function makeFakeDb(opts: FakeDbOptions = {}) {
  const calls: DbCall[] = []
  const readErrors = [...(opts.readErrors ?? [])]
  const from = (table: string) => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = chain
    b.eq = chain
    b.order = chain
    b.limit = chain
    b.maybeSingle = async () => {
      calls.push({ table, op: 'read' })
      if (table === 'profiles') {
        const err = readErrors.shift()
        if (err) return { data: null, error: err }
      }
      return { data: table === 'profiles' ? (opts.profile ?? null) : (opts.assessment ?? null), error: null }
    }
    b.insert = (payload: unknown) => {
      calls.push({ table, op: 'insert', payload })
      const done: Promise<{ data: null; error: null }> & { select?: () => unknown } = Promise.resolve({ data: null, error: null })
      done.select = () => ({ single: async () => ({ data: { id: 'assessment-1' }, error: null }) })
      return done
    }
    return b
  }
  return { db: { from } as unknown as WebSupabase, calls }
}

export interface FakeClientOptions extends FakeDbOptions {
  exchange?: () => Promise<{ data: { session: { user: { id: string } } | null }; error: { message: string } | null }>
  session?: { user: { id: string } } | null
  oauthUrl?: string
}

/** 로그인 · 조회를 흉내 내는 가짜 클라이언트. 호출 기록을 `spies`로 돌려준다. */
export function makeFakeClient(opts: FakeClientOptions = {}) {
  const { db, calls } = makeFakeDb(opts)
  const exchange = vi.fn(
    opts.exchange ?? (async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
  )
  const signInWithOAuth = vi.fn(async () => ({ data: { url: opts.oauthUrl ?? 'https://auth.invalid/authorize' }, error: null }))
  const client = {
    from: (db as unknown as { from: unknown }).from,
    auth: {
      exchangeCodeForSession: exchange,
      signInWithOAuth,
      getSession: async () => ({ data: { session: opts.session ?? null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as WebSupabase
  return { client, calls, spies: { exchange, signInWithOAuth } }
}

export function makeFakeNav() {
  const nav: Nav = {
    push: vi.fn(),
    back: vi.fn(),
    reset: vi.fn(),
    replace: vi.fn(),
    enterAccount: vi.fn(),
  }
  return nav
}

export interface FakeBridge extends NativeBridge {
  emitUrl: (url: string) => void
  emitBack: () => void
  emitBrowserFinished: () => void
}

export function makeFakeBridge(overrides: Partial<NativeBridge> = {}): FakeBridge {
  let urlCb: ((url: string) => void) | undefined
  let backCb: (() => void) | undefined
  let finishedCb: (() => void) | undefined
  const bridge: FakeBridge = {
    ...webBridge,
    onBackButton: (cb) => {
      backCb = cb
      return () => { backCb = undefined }
    },
    onAppUrlOpen: (cb) => {
      urlCb = cb
      return () => { urlCb = undefined }
    },
    onBrowserFinished: (cb) => {
      finishedCb = cb
      return () => { finishedCb = undefined }
    },
    exitApp: vi.fn(),
    hideSplash: vi.fn(),
    openBrowser: vi.fn(async () => {}),
    closeBrowser: vi.fn(),
    shareImage: vi.fn(async () => 'shared' as const),
    saveImage: vi.fn(async () => 'saved' as const),
    ...overrides,
    emitUrl: (url) => urlCb?.(url),
    emitBack: () => backCb?.(),
    emitBrowserFinished: () => finishedCb?.(),
  }
  return bridge
}

/** 메모리 답 · 동의를 모두 채운다(가입 저장이 가능한 상태). */
export function fillOnboardingAnswers(opts: { marketing?: boolean } = {}) {
  const s = useSessionStore.getState()
  s.resetSession()
  s.setName('시험')
  s.setGender('female')
  s.setBirthDate('1995-05-05')
  s.setMbtiSelfReported('ENFP' as MbtiType)
  const picks: QuizChoice[] = ['A', 'B', 'A', 'B', 'A']
  picks.forEach((c, i) => useSessionStore.getState().setQuizAnswer((i + 1) as 1 | 2 | 3 | 4 | 5, c))
  useSessionStore.getState().computeResult()
  useSessionStore.getState().setConsent({ terms: true, privacy: true, aiUsage: true, marketing: opts.marketing ?? false })
}
