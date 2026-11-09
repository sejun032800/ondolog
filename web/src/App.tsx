import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { SkyLayer, viewOffsetPt, type SkyState } from './ui'
import {
  AuthScreen, BasicInfoScreen, CallbackScreen, ConsentScreen, EndScreen, IntroScreen, InviteScreen, LoveQuizScreen, MbtiScreen,
  ResultBriefScreen, ResultDetailScreen, ShareCardScreen, UnderageScreen, type Nav, type ScreenName,
} from './screens'
import { useAppNav } from './navigation'
import { handleHardwareBack } from './platform/backStack'
import { callbackInbox, hasExchanged, isCallbackUrl, parseCallback } from './auth/callback'
import { useBootSession } from './auth/useBootSession'
import { useNoticeStore } from './auth/stores'
import { defaultBridge, type NativeBridge } from './platform/bridge'
import { CHAT_TRIAL_PATH, isChatTrialOpen } from './dev/chatTrialGate'
import { ChatTrialScreen } from './dev/ChatTrial'

/** 화면별 하늘(앱 SkyBackground의 view/veil 값). 하늘은 화면을 넘어 하나로 이어진다. */
function skyFor(screen: ScreenName | null, introPhase: 'splash' | 'start', panned: boolean, prev: SkyState): SkyState {
  switch (screen) {
    case 'intro':
      // A01 → A02: 지평선(main)에서 고개를 들어 밤하늘 쪽으로 천천히 올려다본다.
      return { visible: true, offset: panned ? viewOffsetPt.pullStart : viewOffsetPt.main, veil: introPhase === 'start' ? 0.42 : 0.3, bottomVeil: introPhase === 'start', moveMs: 6200 }
    case 'brief':
      return { visible: true, offset: viewOffsetPt.sky, veil: 0.7, bottomVeil: false, moveMs: 1800 }
    case 'share':
      return { visible: true, offset: viewOffsetPt.deep, veil: 0.1, bottomVeil: false, moveMs: 16000, ease: 'cubic-bezier(.25,.1,.25,1)', meteors: true }
    case 'auth':
    case 'callback':
      return { visible: true, offset: viewOffsetPt.sky, veil: 0, bottomVeil: true, moveMs: 1600 }
    case 'end':
      return { visible: true, offset: viewOffsetPt.sky, veil: 0.55, bottomVeil: true, moveMs: 2000, meteors: true }
    default:
      return { ...prev, visible: false, meteors: false }
  }
}

const SCREEN_NAMES: readonly ScreenName[] = [
  'intro', 'basic', 'mbti', 'quiz', 'brief', 'share', 'consent', 'underage', 'auth', 'callback', 'detail', 'invite', 'end',
]

function screenOf(pathname: string): ScreenName | null {
  const name = pathname.replace(/^\//, '')
  return (SCREEN_NAMES as readonly string[]).includes(name) ? (name as ScreenName) : null
}

/** 개발용 문: 시험 빌드(build:trial)·개발 서버에서만 첫 화면에 작게 보이는 "채팅 시험" 버튼. 운영 빌드에서는 그려지지 않는다. */
function ChatTrialButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      data-testid="chat-trial-button"
      className="trialBtn"
      onClick={() => navigate(CHAT_TRIAL_PATH)}
    >
      채팅 시험
    </button>
  )
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
  const screen = screenOf(location.pathname)
  const bootDone = useBootSession(nav)
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
  const trialOpen = isChatTrialOpen()

  return (
    <div className={`stage ${mobile ? 'mobile' : ''}`}>
      <div className="phone" style={{ transform: mobile ? undefined : `scale(${scale})` }}>
        <div style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}>
          <SkyLayer sky={sky} />
        </div>
        <div key={location.key} style={{ position: 'absolute', inset: 0 }} data-screen={screen ?? 'dev'}>
          <ScreenRoutes nav={nav} bridge={bridge} ready={ready && bootDone} onPhase={onPhase} trialOpen={trialOpen} />
        </div>
        {trialOpen && screen === 'intro' ? <ChatTrialButton /> : null}
        <NoticeBanner />
        <div className="grain" />
      </div>
    </div>
  )
}

function ScreenRoutes({ nav, bridge, ready, onPhase, trialOpen }: {
  nav: Nav; bridge: NativeBridge; ready: boolean; onPhase: (p: 'splash' | 'start') => void; trialOpen: boolean
}) {
  return (
    <Routes>
      <Route path="/intro" element={ready ? <IntroScreen nav={nav} onPhase={onPhase} /> : null} />
      <Route path="/basic" element={<BasicInfoScreen nav={nav} />} />
      <Route path="/mbti" element={<MbtiScreen nav={nav} />} />
      <Route path="/quiz" element={<LoveQuizScreen nav={nav} />} />
      <Route path="/brief" element={<ResultBriefScreen nav={nav} bridge={bridge} />} />
      <Route path="/share" element={<ShareCardScreen nav={nav} />} />
      <Route path="/consent" element={<ConsentScreen nav={nav} />} />
      <Route path="/underage" element={<UnderageScreen nav={nav} />} />
      <Route path="/auth" element={<AuthScreen nav={nav} bridge={bridge} />} />
      <Route path="/callback" element={<CallbackScreen nav={nav} bridge={bridge} />} />
      <Route path="/detail" element={<ResultDetailScreen nav={nav} />} />
      <Route path="/invite" element={<InviteScreen nav={nav} />} />
      <Route path="/end" element={<EndScreen nav={nav} />} />
      {trialOpen ? <Route path={CHAT_TRIAL_PATH} element={<ChatTrialScreen onBack={nav.back} />} /> : null}
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
