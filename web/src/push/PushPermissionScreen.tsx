/**
 * I08 알림 권한 안내(보드 `N-S-I-States` I08) - OS 권한 창 **전에** 왜 알림이 필요한지 먼저 보인다. 연결 뒤 처음 메인에 왔을 때 한 번(`usePushSetup`).
 * [알림 받기] -> OS 권한 창(Android 13 이상, S21) -> 허용이면 채널 · 등록. 거부여도 앱은 그대로(설정 > 알림에서 다시).
 * [나중에] -> 닫기. 설정 > 알림에서 다시 켤 수 있다.
 * 보드와 다른 점(대조표): 보드 문구는 발행 · 답변 · 기념일 알림을 약속하지만 지금 보내는 알림은 메시지 · 변경 안내뿐이라(R42-5 "거짓 화면" 0) 본문을 그 둘로 바꿨다.
 *   미리보기 카드 두 장도 지금 실제로 오는 문장(R100-4)으로.
 */
import { useState } from 'react'
import { readCache } from '../cache/deviceCache'
import { useAuthStore } from '../auth/stores'
import type { Nav } from '../navigation'
import { useCoupleStore } from '../stores/coupleStore'
import { OnboardingScreen, PrimaryButton } from '../ui'
import { getPushPort } from './pushPort'
import { usePushStore } from './pushCore'
import { enablePushHere } from './usePushSetup'

export const PUSH_PERMISSION_COPY = {
  title: '중요한 순간만\n알려드릴게요',
  body: '상대가 메시지를 보내면 알려 드려요. 사귄 날짜나 커플 닉네임이 바뀔 때도요. 알림마다 설정에서 따로 끌 수 있어요.',
  allow: '알림 받기',
  later: '나중에',
  previewMessage: (name: string) => `${name}님이 메시지를 보냈어요`,
  previewChange: (name: string) => `${name}님이 커플 닉네임을 바꿨어요`,
  app: '온도록',
  now: '지금',
} as const

export function PushPermissionScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const name = (partnerId ? readCache<{ name: string }>(userId, 'name', partnerId)?.name : null) ?? '상대'
  const [busy, setBusy] = useState(false)

  const allow = async () => {
    if (busy) return
    setBusy(true)
    try {
      const p = await getPushPort().requestPermission()
      usePushStore.getState().setPermission(p)
      if (p === 'granted') await enablePushHere()
    } catch {
      // 거부와 같게 - 설정에서 다시
    } finally {
      setBusy(false)
      nav.back()
    }
  }

  return (
    <OnboardingScreen
      animKey="push-permission"
      footer={
        <>
          <PrimaryButton label={PUSH_PERMISSION_COPY.allow} onClick={() => void allow()} disabled={busy} />
          <PrimaryButton label={PUSH_PERMISSION_COPY.later} variant="ghost" onClick={nav.back} disabled={busy} />
        </>
      }
    >
      <div className="pushPreview" aria-hidden="true" data-testid="push-permission">
        <div className="pushCard">
          <span className="pushBandIcon"><i /></span>
          <span className="pushBandText">
            <span className="pushBandHead"><span>{PUSH_PERMISSION_COPY.app}</span><span>{PUSH_PERMISSION_COPY.now}</span></span>
            <span className="pushBandBody">{PUSH_PERMISSION_COPY.previewMessage(name)}</span>
          </span>
        </div>
        <div className="pushCard dim">
          <span className="pushBandIcon"><i /></span>
          <span className="pushBandText">
            <span className="pushBandHead"><span>{PUSH_PERMISSION_COPY.app}</span></span>
            <span className="pushBandBody">{PUSH_PERMISSION_COPY.previewChange(name)}</span>
          </span>
        </div>
      </div>
      <h1 className="t-display c-text pre" style={{ marginTop: 40 }}>{PUSH_PERMISSION_COPY.title}</h1>
      <p className="t-sub c-sub" style={{ marginTop: 16 }}>{PUSH_PERMISSION_COPY.body}</p>
    </OnboardingScreen>
  )
}
