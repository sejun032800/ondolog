/**
 * 80- 앱 오류 기록(R114-3 ② · R115-4) - 우리 서버(80-m1 `log_app_error`)에만, 누가 무엇을 했는지 알 수 없는 건수로. 외부 서비스 0.
 *
 * - `reportAppError(kind)`: 지금 화면 이름 + 종류로 한 건을 센다(기기 저장). 메시지 · 스택 · 오류 객체는 받지도 않는다.
 * - 보내기(`flushAppErrors`): 규칙(`errorLogRules`)대로 묶음당 1시간에 한 번 · 기기 전체 1시간 30번. 오프라인 · 연결 값 없음 · 실패면 그대로 모아 둔다.
 * - 기록 자체가 실패해도 앱 동작에 영향 0(모두 삼킴) · 기록 실패를 다시 기록하지 않는다(보내는 중 생긴 오류는 세지 않음 · 저장 실패도 세지 않음).
 * - 기기 저장 키 `ondolog.err1`(사용자에 묶이지 않음 - 로그인 전 오류도 센다). 건수뿐이지만 규칙을 맞춰 로그아웃 · 탈퇴 요청 · 계정 전환 때 지운다
 *   (`cache/deviceCache.ts`의 `clearAllDeviceCache` · `purgeOtherUsers`가 부른다). 저장이 막히면 메모리에만 둔다.
 */
import { Capacitor } from '@capacitor/core'
import { getSupabase } from '../auth/client'
import { appVersion } from '../features/settings/appInfo'
import {
  addError, EMPTY_STATE, markSent, planSends, platformForLog, prune, sanitizeState, versionForLog,
  type ErrorKind, type ErrorLogState,
} from './errorLogRules'

export const ERROR_LOG_KEY = 'ondolog.err1'
/** 센 뒤 이만큼 모아서 보낸다(같은 순간의 여러 건을 한 번에). */
const FLUSH_DELAY_MS = 2000

let memory: ErrorLogState | null = null
let currentScreen: string | null = null
let flushing = false
let timer: ReturnType<typeof setTimeout> | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function load(): ErrorLogState {
  if (memory) return memory
  try {
    const raw = storage()?.getItem(ERROR_LOG_KEY)
    if (!raw) {
      memory = { ...EMPTY_STATE, buckets: {}, sends: [] }
      return memory
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    memory = sanitizeState(parsed)
    // 81-: 버전이 다르거나 깨진 저장분 -> 빈 값으로 다시 시작하고 `cache_fail` 1건(이 실행에서 1번 - 이후 읽기는 메모리).
    if ((parsed as { v?: unknown } | null)?.v !== 1) memory = addError(memory, currentScreen, 'cache_fail')
  } catch {
    memory = { ...EMPTY_STATE, buckets: {}, sends: [] }
  }
  return memory
}

function save(state: ErrorLogState): void {
  memory = state
  try {
    storage()?.setItem(ERROR_LOG_KEY, JSON.stringify(state))
  } catch {
    // 가득 참 · 막힘 - 메모리에만 둔다(이 실패는 세지 않는다: 반복 0).
  }
}

/** 지금 화면(라우트 이름). App 이 화면이 바뀔 때마다 알린다. */
export function setErrorScreen(name: string | null): void {
  currentScreen = name
}

/** 지금 화면 이름(81-: RenderGuard [다시 시도]가 그 화면의 기기 저장 범주를 비울 때). */
export function getErrorScreen(): string | null {
  return currentScreen
}

/** 오류 한 건. 어떤 경우에도 던지지 않는다. */
export function reportAppError(kind: ErrorKind): void {
  // 반복 0: 이 파일의 보내기 · 저장 실패는 모두 안에서 삼켜 여기로 다시 오지 않는다(처리 안 된 거부도 만들지 않는다).
  try {
    save(addError(load(), currentScreen, kind))
    schedule()
  } catch {
    // 기록이 앱을 멈추지 않는다.
  }
}

function schedule(): void {
  if (timer !== null) return
  try {
    timer = setTimeout(() => {
      timer = null
      void flushAppErrors()
    }, FLUSH_DELAY_MS)
  } catch {
    timer = null
  }
}

function online(): boolean {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  } catch {
    return true
  }
}

/** 모아 둔 건수를 보낸다. 오프라인 · 연결 값 없음이면 아무것도 하지 않는다. 실패하면 남은 것은 다음 번에. */
export async function flushAppErrors(now: number = Date.now()): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    if (!online()) return
    const db = getSupabase()
    if (!db) return
    let state = prune(load(), now)
    const plan = planSends(state, now)
    const version = versionForLog(appVersion())
    const platform = platformForLog(Capacitor.getPlatform())
    for (const p of plan) {
      let ok = false
      try {
        const { error } = await db.rpc('log_app_error' as never, { p_screen: p.screen, p_kind: p.kind, p_version: version, p_platform: platform, p_count: p.count } as never)
        ok = !error
      } catch {
        ok = false
      }
      if (!ok) break // 끊김 · 서버 오류 - 남은 것은 다음 번에(이 실패는 세지 않는다)
      state = markSent(state, p.key, p.count, now)
    }
    save(state)
  } catch {
    // 삼킨다.
  } finally {
    flushing = false
  }
}

/** 로그아웃 · 탈퇴 요청 · 계정 전환: 이 기기에 모아 둔 건수를 지운다. */
export function clearAppErrorCounts(): void {
  memory = { ...EMPTY_STATE, buckets: {}, sends: [] }
  try {
    storage()?.removeItem(ERROR_LOG_KEY)
  } catch {
    // 같은 이유
  }
}

/** 브라우저 자체 경고성 오류(앱 고장이 아님) - 세지 않는다. 글자는 거르는 데만 읽고 어디에도 남기지 않는다. */
function benign(e: ErrorEvent): boolean {
  const m = typeof e.message === 'string' ? e.message : ''
  return m.includes('ResizeObserver loop')
}

/** 처리 안 된 예외 · Promise 거부를 센다 + 다시 온라인이 되면 보낸다 + 시작 조금 뒤 남은 것을 보낸다. 떼어 내는 함수를 돌려준다. */
export function installErrorCapture(win: Window): () => void {
  const onError = (e: ErrorEvent) => { if (!benign(e)) reportAppError('uncaught') }
  const onRejection = () => reportAppError('unhandled_rejection')
  const onOnline = () => { void flushAppErrors() }
  win.addEventListener('error', onError)
  win.addEventListener('unhandledrejection', onRejection)
  win.addEventListener('online', onOnline)
  const start = setTimeout(() => { void flushAppErrors() }, 5000)
  return () => {
    win.removeEventListener('error', onError)
    win.removeEventListener('unhandledrejection', onRejection)
    win.removeEventListener('online', onOnline)
    clearTimeout(start)
  }
}

/** 시험용: 메모리 · 타이머 · 화면을 처음으로. */
export function resetErrorLogForTest(): void {
  memory = null
  currentScreen = null
  flushing = false
  if (timer !== null) clearTimeout(timer)
  timer = null
}
