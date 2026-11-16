/**
 * H10 알림 설정 - 설정 > 알림(보드 `N-S-H2-Settings` H10). 78- · R42-5(보낼 알림이 있는 토글만).
 *
 * 줄: 채팅(메시지 알림) · 변경 안내(사귄 날짜 · 커플 닉네임). 값 = 서버 `notification_settings`(본인만, 행이 없으면 둘 다 켬 - 78-m1).
 * 누르면 바로 바뀐 모습, 저장 실패면 되돌리고 안내(H11 마케팅 토글과 같은 방식). 읽는 동안은 토글이 눌리지 않는다.
 * 폰 권한이 꺼져 있으면 위에 안내 + [폰 설정에서 켜기]: 권한 창을 다시 띄워 보고(Android가 다시 물을 수 있을 때), 그래도 꺼져 있으면 폰 설정 경로를 글로 안내한다.
 *   (앱의 알림 설정 화면으로 바로 여는 것은 네이티브 코드가 필요해 이번 허가 밖 - 보고에 적음.)
 * 보드에서 뺀 줄: 발행 · 기념일 · CORNERS(인터뷰 · 셋로그) · 셋로그 알림 시각 - 보낼 알림이 아직 없다(매거진 발행 알림은 다음).
 */
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { getPushPort, type PushPermission } from '../../push/pushPort'
import { DEFAULT_NOTIFY, readNotifySettings, saveNotifySettings, usePushStore, type NotifySettings } from '../../push/pushCore'
import { enablePushHere } from '../../push/usePushSetup'
import { ListGroup, ListRow, SettingsFrame, Toggle } from './parts'

export const NOTIFY_COPY = {
  title: '알림',
  messages: '채팅',
  messagesDesc: '상대가 메시지를 보내면',
  changes: '변경 안내',
  changesDesc: '사귄 날짜 · 커플 닉네임',
  osOff: '폰에서 온도록 알림이 꺼져 있어요',
  osOn: '폰 설정에서 켜기',
  osPath: '폰 설정 > 애플리케이션 > 온도록 > 알림에서 켜 주세요',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
} as const

export function NotifySettingsScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  /** null = 읽는 중. */
  const [value, setValue] = useState<NotifySettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<PushPermission | null>(null)
  const [showPath, setShowPath] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    readNotifySettings(userId)
      .then((v) => { if (!cancelled) setValue(v) })
      .catch(() => { if (!cancelled) { setValue(DEFAULT_NOTIFY); setError(NOTIFY_COPY.loadFailed) } })
    getPushPort().checkPermission().then((p) => { if (!cancelled) setPermission(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  const toggle = async (key: keyof NotifySettings, next: boolean) => {
    if (!userId || !value || busy) return
    const previous = value
    const updated = { ...value, [key]: next }
    setValue(updated)
    setBusy(true)
    setError(null)
    try {
      await saveNotifySettings(userId, updated)
    } catch {
      setValue(previous)
      setError(NOTIFY_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const turnOnOs = async () => {
    try {
      const p = await getPushPort().requestPermission()
      setPermission(p)
      usePushStore.getState().setPermission(p)
      if (p === 'granted') {
        setShowPath(false)
        await enablePushHere()
      } else {
        setShowPath(true)
      }
    } catch {
      setShowPath(true)
    }
  }

  const osOff = permission === 'denied' || permission === 'prompt'
  return (
    <SettingsFrame title={NOTIFY_COPY.title} onBack={nav.back} testId="settings-notify">
      {osOff ? (
        <ListGroup testId="notify-os-off">
          <ListRow label={NOTIFY_COPY.osOff} description={showPath ? NOTIFY_COPY.osPath : undefined} />
          <ListRow label={NOTIFY_COPY.osOn} onPress={() => void turnOnOs()} testId="notify-os-on" />
        </ListGroup>
      ) : null}
      <ListGroup>
        <ListRow
          label={NOTIFY_COPY.messages}
          description={NOTIFY_COPY.messagesDesc}
          control={<Toggle value={value?.messages ?? true} onChange={(v) => void toggle('messages', v)} disabled={value === null || busy} label={NOTIFY_COPY.messages} testId="notify-messages" />}
        />
        <ListRow
          label={NOTIFY_COPY.changes}
          description={NOTIFY_COPY.changesDesc}
          control={<Toggle value={value?.changes ?? true} onChange={(v) => void toggle('changes', v)} disabled={value === null || busy} label={NOTIFY_COPY.changes} testId="notify-changes" />}
        />
      </ListGroup>
      {error ? <p className="t-sub c-sub" role="alert" data-testid="notify-error">{error}</p> : null}
    </SettingsFrame>
  )
}
