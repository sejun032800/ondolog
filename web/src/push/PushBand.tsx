/**
 * I07 앱 안 알림 띠(보드 `N-S-I-States` I07) - 앱이 앞에 있을 때 온 알림은 OS 알림 대신 위쪽 띠로 보인다.
 * 보드 카드 모양: 빛나는 점 아이콘 · "온도록" · 본문 · "지금". 누르면 그 화면(메시지 = 채팅 탭, 변경 안내 = 메인). 약 4초 뒤 닫힌다.
 * 지금 그 채팅을 보고 있으면 띠 자체가 오지 않는다(`usePushSetup`). 띠가 떠 있는 동안 채팅으로 옮기면 메시지 띠는 닫힌다.
 */
import { useEffect } from 'react'
import type { ScreenName } from '../app/routes'
import type { Nav } from '../navigation'
import { usePushStore } from './pushCore'

export const PUSH_BAND_MS = 4000
export const PUSH_BAND_COPY = { app: '온도록', now: '지금' } as const

export function PushBand({ nav, screen }: { nav: Nav; screen: ScreenName | null }) {
  const band = usePushStore((s) => s.band)
  useEffect(() => {
    if (!band) return
    const t = window.setTimeout(() => usePushStore.getState().clearBand(), PUSH_BAND_MS)
    return () => window.clearTimeout(t)
  }, [band])
  useEffect(() => {
    if (band && band.kind === 'message' && screen === 'chat') usePushStore.getState().clearBand()
  }, [band, screen])
  if (!band) return null
  const open = () => {
    usePushStore.getState().clearBand()
    if (band.route !== screen) nav.reset(band.route)
  }
  return (
    <button type="button" className="pushBand press" role="status" onClick={open} data-testid="push-band">
      <span className="pushBandIcon" aria-hidden="true"><i /></span>
      <span className="pushBandText">
        <span className="pushBandHead"><span>{PUSH_BAND_COPY.app}</span><span>{PUSH_BAND_COPY.now}</span></span>
        <span className="pushBandBody" data-testid="push-band-body">{band.body}</span>
      </span>
    </button>
  )
}
