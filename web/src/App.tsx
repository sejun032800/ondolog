import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SkyLayer, viewOffsetPt, type SkyState } from './ui'
import { useAppNav, type Nav } from './navigation'
import { handleHardwareBack } from './platform/backStack'
import { callbackInbox, hasExchanged, isCallbackUrl, parseCallback } from './auth/callback'
import { useBootSession } from './auth/useBootSession'
import { useNoticeStore } from './auth/stores'
import { defaultBridge, type NativeBridge } from './platform/bridge'
import { ALL_ROUTES, isTabRoute, routeOfPathname, type ScreenName } from './app/routes'
import { ROUTE_ELEMENTS } from './app/routeTable'
import { setInviteEntry, setPendingInviteStep } from './app/inviteEntry'
import { SheetHost } from './app/sheets'
import { useAccountData } from './app/useAccountData'
import { usePhotoQueueResume } from './photoQueue/usePhotoQueueResume'
import { useChatQueueResume } from './features/chat/useChatQueueResume'
import { ViewerHost } from './features/magazine/ViewerHost'
import { useKeyboardOpen } from './platform/useKeyboardOpen'
import { useStartDateRecheck } from './couple/useStartDateRecheck'
import { useDissolutionNotice } from './features/settings/useDissolutionNotice'
import { ConnectionBanner } from './components/ConnectionBanner'
import { ToastHost } from './components/ToastHost'
import { useSheetStore } from './stores/sheetStore'
import { TabBar } from './tabs/TabBar'

/** 화면별 하늘(앱 SkyBackground의 view/veil 값). 하늘은 화면을 넘어 하나로 이어진다. */
function skyFor(screen: ScreenName | null, introPhase: 'splash' | 'start', panned: boolean, prev: SkyState): SkyState {
  switch (screen) {
    case 'intro':
      // A01 → A02: 지평선(main)에서 고개를 들어 밤하늘 쪽으로 천천히 올려다본다.
      return { visible: true, offset: panned ? viewOffsetPt.pullStart : viewOffsetPt.main, veil: introPhase === 'start' ? 0.42 : 0.3, bottomVeil: introPhase === 'start', moveMs: 6200 }
    case 'brief':
      return { visible: true, offset: viewOffsetPt.sky, veil: 0.7, bottomVeil: false, moveMs: 1800 }
    case 'auth':
    case 'callback':
      return { visible: true, offset: viewOffsetPt.sky, veil: 0, bottomVeil: true, moveMs: 1600 }
    case 'main':
      // 메인 탭: 지평선 시점(main), 장막 .42 + 하단 장막(보드 B01~B06 · R22-1). 끌어내리기 · 하늘(C) · 유성은 이번 범위에 없다.
      return { visible: true, offset: viewOffsetPt.main, veil: 0.42, bottomVeil: true, moveMs: 1200, meteors: false }
    default:
      return { ...prev, visible: false, meteors: false }
  }
}

/** 한 번 보이고 사라지는 알림(기존 계정 안내 등). 눌러도 닫힌다. */
const NOTICE_MS = 6000
function NoticeBanner() {
  const message = useNoticeStore((s) => s.message)
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => useNoticeStore.getState().clear(), NOTICE_MS)
    return () => window.clearTimeout(t)
  }, [message])
  if (!message) return null
  return (
    <div className="notice" role="status" onClick={() => useNoticeStore.getState().clear()}>{message}</div>
  )
}

function Shell({ bridge }: { bridge: NativeBridge }) {
  const location = useLocation()
  const { nav, canGoBack } = useAppNav()
  const screen = routeOfPathname(location.pathname)
  const onTab = isTabRoute(screen)
  const bootDone = useBootSession(nav)
  useAccountData(screen)
  // 사진 영속 큐(채팅 사진 · 스토리): 앱을 켜면(로그인 + 커플 확인) 남은 사진을 이어서 보내고, 앱이 다시 보이면 바로 이어 보낸다.
  usePhotoQueueResume()
  // 글 큐도 같은 방식(앱 시작 · 복귀에 이어 보냄)이고, 글 · 사진 큐의 대기 유무를 I02 띠에 알린다(채팅 화면에서 띠가 자리를 내준다).
  useChatQueueResume()
  // 채팅에서 키보드가 열리면 탭 바를 비킨다(입력줄이 키보드 바로 위에 붙게).
  const keyboardOpen = useKeyboardOpen()
  // 상대가 고친 사귄 날짜는 탭 화면에서 다음에 들어올 때(시작 · 복귀) 확인 화면(A20)으로 다시 보인다.
  useStartDateRecheck(nav, onTab)
  // 상대가 해제(또는 탈퇴)를 요청했으면 내가 앱에 들어올 때 처음 한 번 커플 화면(H14 유예 화면)을 보인다(앱 안 표시뿐, 푸시 없음).
  useDissolutionNotice(nav, onTab)
  // I01 커플 게이트의 두 버튼(+ 이후 커플 전용 기능)이 초대 · 코드 입력 화면으로 가는 입구. 이미 그 화면이면 다시 쌓지 않는다.
  const inviteScreenRef = useRef(screen)
  inviteScreenRef.current = screen
  useEffect(() => {
    setInviteEntry((step) => {
      if (inviteScreenRef.current === 'couple-invite') return
      setPendingInviteStep(step)
      nav.push('couple-invite', { urgent: true })
    })
    return () => setInviteEntry(null)
  }, [nav])
  // 경로가 바뀌면(탭을 떠남 포함) 열려 있던 시트도 닫는다 - 다른 화면으로 따라오지 않는다(B4).
  useEffect(() => { useSheetStore.getState().closeAll() }, [location.pathname])
  const [introPhase, setIntroPhase] = useState<'splash' | 'start'>('splash')
  const [panned, setPanned] = useState(false)
  const skyRef = useRef<SkyState>({ visible: true, offset: viewOffsetPt.main, veil: 0.3, bottomVeil: false, moveMs: 0 })
  const sky = skyFor(screen, introPhase, panned, skyRef.current)
  skyRef.current = sky

  // 하늘 이미지·글꼴이 다 준비된 뒤에 인트로를 시작한다(모바일 첫 접속에서 이미지가 늦게 떠 산을 못 보는 문제).
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const go = () => { if (!done) { done = true; setReady(true) } }
    const img = new Image()
    const imgP = new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r() })
    img.src = './img/sky_world.jpg'
    const imgDecoded = imgP.then(() => (img.decode ? img.decode().catch(() => {}) : undefined))
    Promise.all([imgDecoded, document.fonts?.ready ?? Promise.resolve()]).then(go)
    const fallback = setTimeout(go, 6000)
    return () => clearTimeout(fallback)
  }, [])
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setPanned(true), 250)
    return () => clearTimeout(t)
  }, [ready])

  // 첫 화면(바탕색 = 스플래시와 같은 색)이 그려진 다음 스플래시를 걷는다. 못 걷는 경우를 대비해 3초 뒤에도 한 번 더.
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => bridge.hideSplash()))
    const fallback = window.setTimeout(() => bridge.hideSplash(), 3000)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fallback) }
  }, [bridge])

  // 하드웨어 뒤로 가기 = 앱 안 뒤로 가기. 첫 화면에서만 앱 종료.
  useEffect(() => bridge.onBackButton(() => handleHardwareBack({
    canGoBack,
    goBack: nav.back,
    exitApp: bridge.exitApp,
  })), [bridge, canGoBack, nav])

  // 앱 링크(ondolog://auth/callback)로 돌아오면: 코드는 메모리 한 칸에만 넣고, 브라우저를 닫고, 콜백 화면으로 간다.
  // 이미 콜백 화면이면(다시 시도) 그 자리를 바꾼다. 코드 · 주소는 라우터 경로 · 화면 · 로그에 남지 않는다.
  const screenRef = useRef(screen)
  screenRef.current = screen
  useEffect(() => bridge.onAppUrlOpen((url) => {
    if (!isCallbackUrl(url)) return
    const params = parseCallback(url)
    bridge.closeBrowser()
    // 같은 코드의 앱 링크가 두 번 들어와도 한 번만 처리한다.
    if (params.code && hasExchanged(params.code)) return
    callbackInbox.put(params)
    if (screenRef.current === 'callback') nav.replace('callback')
    else nav.push('callback', { urgent: true })
  }), [bridge, nav])

  // 폰 프레임 크기(PC) / 전체 화면(모바일)
  const [mobile, setMobile] = useState(false)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight
      const m = w <= 560 || (w < h && w <= 820 && 'ontouchstart' in window)
      setMobile(m)
      setScale(m ? 1 : Math.min(1, (h - 40) / 844, (w - 32) / 390))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const onPhase = useCallback((p: 'splash' | 'start') => setIntroPhase(p), [])

  return (
    <div className={`stage ${mobile ? 'mobile' : ''}`}>
      <div className="phone" style={{ transform: mobile ? undefined : `scale(${scale})` }}>
        <div style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}>
          <SkyLayer sky={sky} />
        </div>
        <div key={location.key} style={{ position: 'absolute', inset: 0 }} data-screen={screen ?? 'unknown'}>
          <ScreenRoutes nav={nav} bridge={bridge} ready={ready && bootDone} onPhase={onPhase} />
        </div>
        {onTab && !(screen === 'chat' && keyboardOpen) ? <TabBar active={screen} onSelect={(tab) => { if (tab !== screen) nav.replace(tab) }} /> : null}
        <SheetHost />
        <ViewerHost bridge={bridge} />
        <ConnectionBanner inChat={screen === 'chat'} />
        <ToastHost aboveTabBar={onTab} />
        <NoticeBanner />
        <div className="grain" />
      </div>
    </div>
  )
}

function ScreenRoutes({ nav, bridge, ready, onPhase }: {
  nav: Nav; bridge: NativeBridge; ready: boolean; onPhase: (p: 'splash' | 'start') => void
}) {
  // 라우터는 `app/routeTable.tsx` 표로만 만든다(경로 = 화면 이름 = 뒤로 가기 규칙표의 키).
  return (
    <Routes>
      {ALL_ROUTES.map((name: ScreenName) => (
        <Route key={name} path={`/${name}`} element={ROUTE_ELEMENTS[name]({ nav, bridge, ready, onPhase })} />
      ))}
      <Route path="*" element={<Navigate to="/intro" replace />} />
    </Routes>
  )
}

export default function App({ bridge = defaultBridge(), initialPath = '/intro' }: { bridge?: NativeBridge; initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Shell bridge={bridge} />
    </MemoryRouter>
  )
}
