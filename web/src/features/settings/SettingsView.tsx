/**
 * H01 · H02 설정 목록 - 설정 탭. 보드 `N-H01-Settings` · `N-S-H1-Settings`(H02). RN `app/(tabs)/settings.tsx`의 웹판.
 *
 * 목록 표는 루트 `@/utils/settingsRules`의 `SETTINGS_GROUPS`다 - **이번에 갈 곳이 있는 항목만** 있다(프로필 · 연결된 계정 · 연인 · 커플 닉네임 · 성격 프로필 · 개인정보 & 약관 · 앱 정보 · 문의).
 * 보드에 있지만 갈 곳이 없는 항목(구독 · 사진 & 데이터 · 데이터 내려받기 · 빠진 지면 기본값 · 생체정보 · OUR SKY · 발행물 테마)과 [연결 해제] · [회원 탈퇴](하위 화면 안에 있다)는 그리지 않는다.
 * 78-: NOTIFICATIONS > 알림(H10)은 보드 H02 자리(PERSONALITY 다음 · PRIVACY 앞)에 이 파일이 더한다 - 루트 `SETTINGS_GROUPS`(RN 동결 앱과 공용)는 바꾸지 않는다.
 * 85-(MASTER 9-8-4 · 보드 patch9b H01_oursky · H01_reduced): OUR SKY 묶음을 COUPLE 다음에 이 파일이 더한다 - "별 반짝임" 한 줄(값은 기기에만).
 * 84-e: 유성이 연결되어 "유성 떨어뜨리기" 줄을 그 위에 더한다(현재 H01 보드 - 두 줄 · 값은 기기에만).
 * 84-h(R145-2): 시험판(`IS_TRIAL_BUILD`)에서만 OUR SKY 묶음 맨 아래에 "유성 미리 보기" 줄 - 누르면 하늘(C01)로 가서 견본 유성 하나가 곧 떨어진다.
 *   출시 빌드에서는 분기가 상수로 잘려 줄 · 견본이 번들에 남지 않는다(`sky/meteorPreview.tsx`).
 *   기기 움직임 줄이기가 켜져 있으면 줄 비활성 + 묶음 아래 문구(사용자가 켜 둔 값은 지우지 않는다). "유성 떨어뜨리기" 줄은 유성이 열릴 때부터.
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
import { ListGroup, ListRow, Toggle } from './parts'
import { useReducedMotionLive, useSkyPrefStore, useSkyPrefs } from '../sky/skyPrefs'
import { useSettingsSummary } from './useSettingsSummary'
import { IS_TRIAL_BUILD } from '../../config/env'
import { PREVIEW_COPY, requestMeteorPreview } from '../sky/meteorPreview'

/** 보드 H02 NOTIFICATIONS 묶음(78-). */
export const NOTIFY_GROUP = { kicker: 'NOTIFICATIONS', label: '알림' } as const

/** 85- OUR SKY 묶음(보드 H01 · R127-2 문구 정정). */
export const SKY_GROUP = {
  kicker: 'OUR SKY',
  // 84-e: 유성 줄(현재 H01 보드 문구 · 기본 켬). 줄인 모션에서도 켜 둘 수 있다 - 유성이 제자리 빛으로 바뀌어 떨어진다(MASTER 9-8-4 r80 · 보드 17-b)
  meteor: '유성 떨어뜨리기',
  meteorDesc: '다정한 말이 유성으로 떨어져요',
  twinkle: '별 반짝임',
  twinkleDesc: '하늘의 별이 천천히 숨 쉬어요',
  reducedNote: '기기에서 움직임을 줄여 두어 하늘이 멈춰 있어요',
} as const

export function SettingsView({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const coupleStatus = useCoupleStore((s) => s.status)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const grace = useCoupleStore((s) => s.grace)
  const dissolution = useDissolutionStore((s) => s.dissolution)
  const summary = useSettingsSummary(userId, partnerId)
  const skyPrefs = useSkyPrefs(userId)
  const reducedMotion = useReducedMotionLive()

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
        {group.kicker === 'COUPLE' ? (
          <section className="setSection" data-testid="settings-oursky">
            <p className="t-kicker c-mute setKicker">{SKY_GROUP.kicker}</p>
            <ListGroup>
              <ListRow
                label={SKY_GROUP.meteor}
                description={SKY_GROUP.meteorDesc}
                control={
                  <Toggle
                    value={skyPrefs.meteor}
                    onChange={(on) => useSkyPrefStore.getState().setMeteor(on)}
                    label={SKY_GROUP.meteor}
                    testId="settings-sky-meteor"
                  />
                }
                testId="settings-row-sky-meteor"
              />
              <div className={`setSkyRow ${reducedMotion ? 'off' : ''}`}>
                <ListRow
                  label={SKY_GROUP.twinkle}
                  description={SKY_GROUP.twinkleDesc}
                  control={
                    <Toggle
                      value={reducedMotion ? false : skyPrefs.twinkle}
                      disabled={reducedMotion}
                      onChange={(on) => useSkyPrefStore.getState().setTwinkle(on)}
                      label={SKY_GROUP.twinkle}
                      testId="settings-sky-twinkle"
                    />
                  }
                  testId="settings-row-sky-twinkle"
                />
              </div>
              {IS_TRIAL_BUILD ? (
                <ListRow
                  label={PREVIEW_COPY.row}
                  description={PREVIEW_COPY.rowDesc}
                  onPress={() => { requestMeteorPreview(); nav.push('sky') }}
                  testId="settings-row-sky-meteor-preview"
                />
              ) : null}
            </ListGroup>
            {reducedMotion ? <p className="t-sub c-mute setNote" data-testid="settings-sky-reduced">{SKY_GROUP.reducedNote}</p> : null}
          </section>
        ) : null}
        </Fragment>
      ))}
    </>
  )
}
