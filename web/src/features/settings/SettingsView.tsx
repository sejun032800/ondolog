/**
 * H01 · H02 설정 목록 - 설정 탭. 보드 `N-H01-Settings` · `N-S-H1-Settings`(H02). RN `app/(tabs)/settings.tsx`의 웹판.
 *
 * 목록 표는 루트 `@/utils/settingsRules`의 `SETTINGS_GROUPS`다 - **이번에 갈 곳이 있는 항목만** 있다(프로필 · 연결된 계정 · 연인 · 커플 닉네임 · 성격 프로필 · 개인정보 & 약관 · 앱 정보 · 문의).
 * 보드에 있지만 갈 곳이 없는 항목(구독 · 사진 & 데이터 · 데이터 내려받기 · 빠진 지면 기본값 · 생체정보 · OUR SKY · 발행물 테마)과 [연결 해제] · [회원 탈퇴](하위 화면 안에 있다)는 그리지 않는다.
 * 78-: NOTIFICATIONS > 알림(H10)은 보드 H02 자리(PERSONALITY 다음 · PRIVACY 앞)에 이 파일이 더한다 - 루트 `SETTINGS_GROUPS`(RN 동결 앱과 공용)는 바꾸지 않는다.
 * 미연결이어도 이 탭은 전부 열린다 - "연인" 줄은 "연결 전", 눌러서 열리는 커플 화면이 잠긴 문(I01)을 보인다.
 * 값은 읽기뿐이다. 쓰는 것은 하위 화면이 한다. B14: 값이 다 읽히기 전에는 오른쪽 값 자리가 뼈대다(값이 늦게 채워지지 않는다).
 */
import { Fragment } from 'react'
import { SETTINGS_GROUPS, socialProviderLabel, type SettingsItemKey } from '@/utils/settingsRules'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import type { ScreenName } from '../../app/routes'
import { appVersion } from './appInfo'
import { ListGroup, ListRow } from './parts'
import { useSettingsSummary } from './useSettingsSummary'

/** 보드 H02 NOTIFICATIONS 묶음(78-). */
export const NOTIFY_GROUP = { kicker: 'NOTIFICATIONS', label: '알림' } as const

export function SettingsView({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const coupleStatus = useCoupleStore((s) => s.status)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const grace = useCoupleStore((s) => s.grace)
  const dissolution = useDissolutionStore((s) => s.dissolution)
  const summary = useSettingsSummary(userId, partnerId)

  const connected = coupleStatus === 'connected'
  const coupleKnown = coupleStatus === 'connected' || coupleStatus === 'disconnected'
  const days = connected && startDate ? computeDaysTogetherKst(startDate) : null
  const partnerValue = dissolution
    ? '해제 예정'
    : connected
      ? [summary.partnerName, days !== null ? `D+${days}` : null].filter(Boolean).join(' · ')
      : coupleStatus === 'disconnected'
        ? '연결 전'
        : ''

  const values: Record<SettingsItemKey, string> = {
    profile: summary.displayName ?? '',
    social: socialProviderLabel(summary.provider),
    partner: partnerValue,
    nickname: connected || grace ? (nickname ?? '') : '', // 해제 유예 중에도 닉네임은 그대로 보인다(W3)
    personality: summary.loveTypeLabelEn ?? '',
    privacy: '',
    about: appVersion(),
  }
  // 값이 아직 안 온 줄(B14). 앱 정보 · 개인정보는 읽을 값이 없어 바로 보인다.
  const loading: Record<SettingsItemKey, boolean> = {
    profile: !summary.loaded,
    social: !summary.loaded,
    partner: !coupleKnown || (connected && !summary.loaded),
    nickname: !coupleKnown,
    personality: !summary.loaded,
    privacy: false,
    about: false,
  }

  return (
    <>
      {SETTINGS_GROUPS.map((group) => (
        <Fragment key={group.kicker}>
        {group.kicker === 'PRIVACY' ? (
          <section className="setSection">
            <p className="t-kicker c-mute setKicker">{NOTIFY_GROUP.kicker}</p>
            <ListGroup>
              <ListRow label={NOTIFY_GROUP.label} onPress={() => nav.push('settings-notify')} testId="settings-row-notify" />
            </ListGroup>
          </section>
        ) : null}
        <section className="setSection">
          <p className="t-kicker c-mute setKicker">{group.kicker}</p>
          <ListGroup>
            {group.items.map((item) => (
              <ListRow
                key={item.key}
                label={item.label}
                value={values[item.key]}
                loading={loading[item.key]}
                onPress={() => nav.push(item.href.replace(/^\//, '') as ScreenName)}
                testId={`settings-row-${item.key}`}
              />
            ))}
          </ListGroup>
        </section>
        </Fragment>
      ))}
    </>
  )
}
