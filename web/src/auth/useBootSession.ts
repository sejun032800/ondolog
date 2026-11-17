/**
 * 앱을 켤 때: 저장된 로그인(Preferences)이 있으면 서버 진행 단계(`profiles.onboarding_step`)로 바로 들어간다(앱을 다시 켜도 로그인 유지).
 * 로그인이 **정말 없으면** 조용히 첫 화면으로 간다. 환경 변수가 없으면 원격으로 가지 않는다.
 * 돌려주는 값은 "확인이 끝났는가" - 끝나기 전에는 첫 화면을 그리지 않는다(첫 화면이 잠깐 보였다 바뀌는 일 방지).
 *
 * 81-b(보충 2 · R79 "빈 화면 0" 상태표): **"네트워크 실패"와 "계정 없음"은 같은 흐름으로 보내지 않는다.**
 *  - 저장된 로그인 있음 + 서버를 못 읽음(오프라인 · 갱신 실패) -> 서버가 마지막으로 정해 준 계정 화면(없으면 메인)으로 들어가 저장값 · 자리 표시 + 끊김 띠.
 *    온보딩 · 로그인으로 보내지 않는다. 연결이 돌아오면 서버로 다시 확인해 다른 화면이어야 할 때만 옮긴다.
 *  - 시작 화면 · 로그인은 저장된 로그인이 정말 없을 때만(저장분 없음, 또는 연결된 상태에서 서버가 세션 없음이라 함).
 *  - [다시 시도]는 다시 시도만 한다 - 안내 화면을 먼저 걷지 않는다(걷으면 그 아래 첫 화면이 보여 온보딩으로 들어가게 된다).
 */
import { useEffect, useRef, useState } from 'react'
import type { Nav } from '../screens'
import type { ScreenName } from '../app/routes'
import { getSupabase } from './client'
import { fetchProfile, resolveWebRoute } from './finalize'
import { withJwtRetry } from './retry'
import { useAuthStore } from './stores'
import { readStoredSessionUserId } from './storedSession'
import { IS_TRIAL_BUILD } from '../config/env'
import { safeKind, useTrialDiag } from '../platform/trialDiag'
import { useAccountProblemStore } from '../stores/accountProblemStore'
import { isTabRoute } from '../app/routes'
import { readBootRoute, readLastTab, saveBootRoute } from '../cache/deviceCache'
import { deviceSaysOffline, useConnectionStore } from '../connection/connectionMonitor'

/** 네트워크가 막혀 확인이 길어져도 첫 화면은 이 시간 안에 보인다. */
export const BOOT_TIMEOUT_MS = 4000

/** 지금 실패가 연결 때문인가(기기가 오프라인이라 함 · 마지막 요청이 거부됨). */
function networkDown(): boolean {
  return deviceSaysOffline() || useConnectionStore.getState().offline
}

/** 서버가 정한 화면으로 옮겨야 하는가(이미 들어간 화면이 같은 뜻이면 그대로 - 사용자가 보던 탭을 빼앗지 않는다). */
function needsMove(entered: string, resolved: string): boolean {
  if (entered === resolved) return false
  if (resolved === 'main' && isTabRoute(entered)) return false
  return true
}

export function useBootSession(nav: Nav): boolean {
  const [done, setDone] = useState(() => getSupabase() === null)
  const navRef = useRef(nav)
  navRef.current = nav

  useEffect(() => {
    const db = getSupabase()
    if (!db) return
    let cancelled = false
    /** 계정 화면에 들어갔으면 그 화면 이름(오프라인으로 들어간 경우 포함). */
    let entered: string | null = null
    /** 저장된 로그인의 사용자(확인 전이어도). */
    let knownId: string | null = null
    let running = false
    /** 첫 확인이 끝났는가(끝난 뒤의 시간 제한은 아무것도 하지 않는다). */
    let firstDone = false
    let again = false

    const finish = () => {
      if (!cancelled) setDone(true)
    }
    const enter = (route: string) => {
      if (cancelled) return
      entered = route
      navRef.current.enterAccount(route as ScreenName)
    }

    /** 저장된 로그인으로 서버 없이 들어간다(81-b). 끊김이면 띠를 켠다. */
    const enterOffline = (id: string, down: boolean) => {
      if (cancelled) return
      useAuthStore.getState().setUserId(id)
      useAccountProblemStore.getState().clear()
      if (down) useConnectionStore.getState().report(false)
      if (!entered) {
        const base = readBootRoute(id) ?? 'main'
        const last = base === 'main' ? readLastTab(id, isTabRoute) : null
        enter(last ?? base)
      }
      finish()
    }

    /** 저장된 로그인이 정말 없다 - 이미 계정 화면이면 첫 화면으로. */
    const noSession = () => {
      if (cancelled) return
      knownId = null
      if (entered) {
        entered = null
        useAuthStore.getState().setUserId(null)
        navRef.current.reset('intro')
      }
    }

    // 저장된 로그인 id를 한 번 미리 읽어 둔다(네트워크 0) - 시간 제한이 기다리지 않고 바로 판단하게.
    let storedId: string | null | undefined
    void readStoredSessionUserId(db).then((v) => { storedId = v }, () => { storedId = null })

    const timer = window.setTimeout(() => {
      if (cancelled || entered || firstDone) return finish()
      // 확인이 늦다(느린 연결 · 막힌 요청). 저장된 로그인이 있으면 첫 화면 대신 계정 화면(저장값)으로 - 뒤늦은 서버 답은 아래 `attempt`가 이어 받는다.
      const id = knownId ?? storedId ?? null
      if (id) enterOffline(id, networkDown())
      else finish()
    }, BOOT_TIMEOUT_MS)

    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      // 81-b: 세션이 없다는 알림은 로그아웃(SIGNED_OUT)일 때만 받아들인다. 시작 때 오프라인 갱신 실패로 오는 "세션 없음"(INITIAL_SESSION)이 저장된 로그인을 지우지 않게.
      if (session) useAuthStore.getState().setUserId(session.user.id)
      else if (event === 'SIGNED_OUT') useAuthStore.getState().setUserId(null)
    })

    // 세션 확인 -> 서버 진행 단계 -> 화면.
    const attempt = async (): Promise<void> => {
      if (running) {
        again = true
        return
      }
      running = true
      let id: string | null = null
      try {
        const { data, error } = await db.auth.getSession()
        id = data.session?.user.id ?? null
        if (!id) {
          // 갱신이 연결 때문에 실패했어도 저장된 로그인은 남아 있다 -> 계정 없음이 아니다.
          // (오류도 없고 연결도 된 "세션 없음"은 정말 없음 - 저장소를 더 읽지 않고 바로 첫 화면.)
          const stored = error || networkDown() ? await readStoredSessionUserId(db) : null
          if (stored) {
            knownId = stored
            enterOffline(stored, true)
            return
          }
          noSession()
          return
        }
        knownId = id
        useAuthStore.getState().setUserId(id)
        const profile = await withJwtRetry(() => fetchProfile(db, id as string))
        if (cancelled) return
        if (!profile) {
          // 프로필이 아직 없는 계정(가입 저장 전)은 첫 화면에서 다시 시작한다 - 답 · 동의를 받은 뒤 로그인하면 `finalizeAfterLogin`이 저장한다.
          if (entered) navRef.current.reset('intro')
          entered = null
          return
        }
        const route = await resolveWebRoute(db, id, profile.onboarding_step, profile.deleted_at)
        if (cancelled) return
        saveBootRoute(id, route)
        useAccountProblemStore.getState().clear()
        if (!entered) {
          // 76-0-2: 카메라 · 앨범을 다녀오다 Android가 앱(웹뷰)을 죽였다 다시 켜진 것이면 방금 있던 탭으로 돌아간다(메인 계정 · 10분 안).
          const last = route === 'main' ? readLastTab(id, isTabRoute) : null
          enter((last as ScreenName | null) ?? route)
        } else if (needsMove(entered, route)) {
          enter(route)
        }
      } catch (e) {
        if (!id || cancelled) return
        if (networkDown()) {
          enterOffline(id, true)
          return
        }
        if (entered) return // 이미 계정 화면(저장값) - 그대로 두고 다음 연결에 다시 확인
        if (IS_TRIAL_BUILD) useTrialDiag.getState().record('state', safeKind(e))
        useAccountProblemStore.getState().show({ retry: () => void attempt() })
      } finally {
        running = false
        firstDone = true
        finish()
        if (again && !cancelled) {
          again = false
          void attempt()
        }
      }
    }

    // 연결이 돌아오면(끊김 -> 풀림) 서버로 다시 확인한다 - 저장값으로 들어간 경우에만 의미가 있다.
    const offConn = useConnectionStore.subscribe((s, prev) => {
      if (prev.offline && !s.offline && entered && !cancelled) void attempt()
    })

    void attempt()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      sub.subscription.unsubscribe()
      offConn()
    }
  }, [])

  return done
}
