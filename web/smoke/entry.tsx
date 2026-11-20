/**
 * 스모크 진입점(79- 안 A ①). 앱 진입점(`src/main.tsx`)과 같은 일(80- 오류 기록 설치 포함)을 같은 순서로 하고, 다른 것은 **데이터 연결부(가짜 클라이언트)** 하나다.
 * 화면 · 라우트 · 스타일은 앱 것을 그대로 import한다(복사본 0). `?world=onboarding`이면 로그인 전(`&path=/consent` 등으로 첫 경로), 아니면 커플 한 쌍이 연결된 계정.
 */
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import '../src/styles.css'
import { installWebFeel } from '../src/platform/webFeel'
import { installKeyboardFocus } from '../src/platform/keyboardFocus'
import { installErrorCapture } from '../src/errorLog/errorLog'
import { setSupabaseForTest } from '../src/auth/client'
import { makeFakeClient, SMOKE_MARK } from './fakeClient'
import { issueProgressRows, makeSeed } from './seed'

const params = new URLSearchParams(location.search)
const world = params.get('world') === 'onboarding' ? 'onboarding' : 'account'
// 앱의 `App`이 원래 받는 `initialPath`(시험이 쓰는 것과 같은 입구)만 넘긴다 - 로그인 전 세계에서 동의 화면으로 바로 갈 때.
const initialPath = params.get('path') ?? undefined
const seed = makeSeed(world === 'account', { meteor: params.get('meteor') === '1' })   // 84-e 유성 스모크만
// 80-: 시험이 RPC 호출(특히 오류 기록 `log_app_error`)을 읽는 곳 - 스모크 빌드에만 있다.
const rpcLog: { fn: string; args: unknown }[] = []
;(window as unknown as Record<string, unknown>).__ONDOLOG_SMOKE_RPC__ = rpcLog
setSupabaseForTest(makeFakeClient({
  ...seed,
  // 서명 주소 = 스모크 서버 안의 자리 그림(만든 그림, 네트워크 0).
  mediaUrl: (_bucket, path) => `./smoke-media/${path.endsWith('.pdf') ? 'sample.pdf' : `ph-${path.length % 3}.svg`}`,
  onRpc: (fn, args) => { rpcLog.push({ fn, args }) },
  rpc: { fn_issue_progress: () => (world === 'account' ? issueProgressRows() : []), fn_delete_my_day: () => true, fn_delete_own_entry: () => true },
}))
;(window as unknown as Record<string, unknown>)[SMOKE_MARK] = world

installWebFeel(document)
installKeyboardFocus(document)
installErrorCapture(window)
createRoot(document.getElementById('root')!).render(<App initialPath={initialPath} />)
