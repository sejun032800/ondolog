/**
 * 78- 푸시 연결(Shell이 한 번 부른다) - R100-4 · R109-1.
 *
 *  1) 리스너(앱 생애에 한 번): 토큰이 오면 서버에 저장 · 갱신 / 앞에 있을 때 온 알림 -> I07 띠(**지금 그 채팅을 보고 있으면 0**) / 누른 알림 -> 갈 곳을 적어 둔다.
 *  2) 받을 수 있는 때(로그인 + 연결됨 + 해제 유예 아님)에만, 앱 시작 · 복귀마다 권한을 본다:
 *       허용 -> 채널 만들고 등록(토큰이 같아도 다시 와서 마지막 확인 시각이 갱신된다).
 *       아직 안 물음 -> **연결 뒤 처음 메인에 왔을 때 한 번** I08 권한 안내(`push-permission`). Android 10(V40)은 권한이 처음부터 허용이라 안내 없이 바로 등록.
 *       거절 -> 아무것도(설정 > 알림에서 안내).
 *  3) 누른 알림의 갈 곳: 로그인 · 시작이 끝나 탭에 들어온 뒤 **한 번만** 그 탭으로(메시지 = 채팅, 변경 안내 = 메인 - 메인에서는 F1 · 닉네임 안내가 이어 뜬다).
 *  4) 76-i (R111-3): 앞에 있을 때 **변경 안내(날짜 · 닉네임)** 알림이 오면 커플 정보를 한 번 새로 읽는다(76- `coupleStore.refresh` - 화면 값 + 기기 저장값 갱신)
 *     -> 메인 D+ · 커플 이름 · 하늘 기념일이 바로 바뀐다. 메시지 알림에는 0(채팅은 실시간 구독). 연달아 오면 묶는다(읽는 중에 온 것은 끝난 뒤 한 번 더 - 최대 2회).
 */
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../auth/stores'
import { readCache, writeCache } from '../cache/deviceCache'
import { isTabRoute, type ScreenName } from '../app/routes'
import type { Nav } from '../navigation'
import { onAppResume } from '../platform/appResume'
import { useCoupleStore } from '../stores/coupleStore'
import { getPushPort } from './pushPort'
import { registerToken, usePushStore } from './pushCore'

/** I08을 보였음(사람 기준 · 기기 저장 `push` 범주 - 로그아웃 때 지워진다). */
export const PUSH_ASKED_SCOPE = 'asked'

export function pushAsked(userId: string | null): boolean {
  return readCache<{ asked: boolean }>(userId, 'push', PUSH_ASKED_SCOPE)?.asked === true
}
export function markPushAsked(userId: string | null): void {
  writeCache(userId, 'push', { asked: true }, PUSH_ASKED_SCOPE)
}

/** 변경 안내 알림의 종류(서버 `PushKind` 중 메시지가 아닌 것). */
export const CHANGE_KINDS: readonly string[] = ['date', 'nickname']

let refreshing: Promise<void> | null = null
let refreshAgain = false
/** 76-i: 변경 안내를 받은 뒤 커플 정보 새로 읽기 - 읽는 중에 또 오면 끝난 뒤 한 번만 더(최대 2회). 실패는 조용히(다음 시작 · 탭 진입이 다시 읽는다). */
export function refreshCoupleAfterChange(userId: string): Promise<void> {
  if (refreshing) {
    refreshAgain = true
    return refreshing
  }
  const read = async () => {
    try {
      await useCoupleStore.getState().refresh(userId)
    } catch {
      // 조용히
    }
  }
  refreshing = (async () => {
    await read()
    if (refreshAgain) {
      refreshAgain = false
      await read()
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/** 허용이면 채널 · 등록. 부르는 곳: 권한 확인 · I08 [알림 받기]. */
export async function enablePushHere(): Promise<void> {
  const port = getPushPort()
  try {
    await port.createChannels()
    await port.register()
  } catch {
    // 다음 시작 · 복귀 때 다시
  }
}

export function usePushSetup(nav: Nav, screen: ScreenName | null, bootDone: boolean): void {
  const userId = useAuthStore((s) => s.userId)
  const status = useCoupleStore((s) => s.status)
  const grace = useCoupleStore((s) => s.grace)
  const eligible = !!userId && status === 'connected' && !grace
  const pendingRoute = usePushStore((s) => s.pendingRoute)

  const screenRef = useRef(screen)
  screenRef.current = screen
  const eligibleRef = useRef(eligible)
  eligibleRef.current = eligible
  const navRef = useRef(nav)
  navRef.current = nav
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // 1) 리스너 - 앱 생애에 한 번.
  useEffect(() => {
    const port = getPushPort()
    const offReg = port.onRegistration((token) => {
      if (!eligibleRef.current || !port.platform) return
      void registerToken(token, port.platform)
    })
    const offRecv = port.onReceived((n) => {
      // 76-i: 변경 안내면 커플 정보를 새로 읽는다(띠와 별개 - 보고 있는 화면과 상관없이).
      if (CHANGE_KINDS.includes(n.kind) && userIdRef.current) void refreshCoupleAfterChange(userIdRef.current)
      if (n.kind === 'message' && screenRef.current === 'chat') return
      usePushStore.getState().showBand(n)
    })
    const offAct = port.onAction((route) => usePushStore.getState().setPending(route))
    return () => {
      offReg()
      offRecv()
      offAct()
    }
  }, [])

  // 2) 권한 확인 · 등록 - 받을 수 있는 동안, 시작 · 복귀마다.
  useEffect(() => {
    if (!eligible) return
    let cancelled = false
    const check = async () => {
      const port = getPushPort()
      let p
      try {
        p = await port.checkPermission()
      } catch {
        return
      }
      if (cancelled) return
      usePushStore.getState().setPermission(p)
      if (p === 'granted') await enablePushHere()
    }
    void check()
    const off = onAppResume(() => { void check() })
    return () => {
      cancelled = true
      off()
    }
  }, [eligible, userId])

  // I08 - 연결 뒤 처음 메인에 왔을 때 한 번(아직 묻지 않은 권한일 때만).
  const permission = usePushStore((s) => s.permission)
  useEffect(() => {
    if (!eligible || screen !== 'main' || permission !== 'prompt' || !userId) return
    if (pushAsked(userId)) return
    markPushAsked(userId)
    navRef.current.push('push-permission', { urgent: true })
  }, [eligible, screen, permission, userId])

  // 3) 누른 알림의 갈 곳 - 탭에 들어온 뒤 한 번.
  useEffect(() => {
    if (!bootDone || !userId || !pendingRoute || !isTabRoute(screen)) return
    const route = usePushStore.getState().takePending()
    if (route && route !== screen) navRef.current.reset(route)
  }, [bootDone, userId, pendingRoute, screen])
}
