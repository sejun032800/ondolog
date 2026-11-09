/**
 * 라우터가 그리는 화면 표. 키 = 화면 이름(`routes.ts`) - 모든 경로가 키이므로 여기에 없는 경로는 라우터에도 없다.
 * `App.tsx`는 이 표로만 `<Route>`를 만든다. 뒤로 가기 규칙표(`backRules.ts`)와 키가 같아야 하고, `backRules.vitest.ts`가 둘을 맞춰 본다.
 *
 * 새 화면을 더할 때: `routes.ts`에 이름 -> 여기에 그리는 법 -> `backRules.ts`에 규칙 -> HANDOFF 화면 대응표.
 * 탭 화면은 `tabs/`, 스택 화면은 `features/<영역>/`에 파일을 둔다.
 */
import { useState, type ReactElement } from 'react'
import {
  AuthScreen, BasicInfoScreen, CallbackScreen, ConsentScreen, IntroScreen, LoveQuizScreen, MbtiScreen,
  ResultBriefScreen, ResultDetailScreen, UnderageScreen,
} from '../screens'
import { consumeInviteStep } from './inviteEntry'
import { InviteScreen } from '../features/couple/InviteScreen'
import { StartDateScreen } from '../features/couple/StartDateScreen'
import { DateDetailScreen } from '../features/feed/DateDetailScreen'
import { StopEditScreen } from '../features/feed/StopEditScreen'
import { AboutScreen } from '../features/settings/AboutScreen'
import { CoupleScreen } from '../features/settings/CoupleScreen'
import { PersonalityScreen } from '../features/settings/PersonalityScreen'
import { PrivacyScreen } from '../features/settings/PrivacyScreen'
import { ProfileScreen } from '../features/settings/ProfileScreen'
import { RetestScreen } from '../features/settings/RetestScreen'
import { SettingsResultScreen } from '../features/settings/SettingsResultScreen'
import { UnlinkScreen } from '../features/settings/UnlinkScreen'
import { WithdrawCancelScreen } from '../features/settings/WithdrawCancelScreen'
import { WithdrawScreen } from '../features/settings/WithdrawScreen'
import type { Nav } from '../navigation'
import type { NativeBridge } from '../platform/bridge'
import { ChatTab } from '../tabs/ChatTab'
import { FeedTab } from '../tabs/FeedTab'
import { MagazineTab } from '../tabs/MagazineTab'
import { MainTab } from '../tabs/MainTab'
import { SettingsTab } from '../tabs/SettingsTab'
import type { ScreenName } from './routes'

export interface RouteCtx {
  nav: Nav
  bridge: NativeBridge
  /** 하늘 이미지 · 글꼴 · 로그인 확인이 끝났는가(첫 화면 시작 조건). */
  ready: boolean
  onPhase: (p: 'splash' | 'start') => void
}

/** I01에서 연 초대 화면. 어느 단계로 열지는 화면이 **그려질 때 한 번** 읽는다(표의 함수는 매 렌더 불리므로 여기서 읽지 않는다). */
function CoupleInviteRoute({ nav, bridge }: { nav: Nav; bridge: NativeBridge }) {
  const [step] = useState(consumeInviteStep)
  return <InviteScreen nav={nav} bridge={bridge} mode="gate" initialStep={step} />
}

export const ROUTE_ELEMENTS: Record<ScreenName, (c: RouteCtx) => ReactElement | null> = {
  intro: (c) => (c.ready ? <IntroScreen nav={c.nav} onPhase={c.onPhase} /> : null),
  basic: (c) => <BasicInfoScreen nav={c.nav} />,
  mbti: (c) => <MbtiScreen nav={c.nav} />,
  quiz: (c) => <LoveQuizScreen nav={c.nav} />,
  brief: (c) => <ResultBriefScreen nav={c.nav} bridge={c.bridge} />,
  consent: (c) => <ConsentScreen nav={c.nav} />,
  underage: (c) => <UnderageScreen nav={c.nav} />,
  auth: (c) => <AuthScreen nav={c.nav} bridge={c.bridge} />,
  callback: (c) => <CallbackScreen nav={c.nav} bridge={c.bridge} />,
  detail: (c) => <ResultDetailScreen nav={c.nav} />,
  invite: (c) => <InviteScreen nav={c.nav} bridge={c.bridge} />,
  'start-date': (c) => <StartDateScreen nav={c.nav} />,
  'couple-invite': (c) => <CoupleInviteRoute nav={c.nav} bridge={c.bridge} />,
  'start-date-recheck': (c) => <StartDateScreen nav={c.nav} mode="recheck" />,
  'date-detail': (c) => <DateDetailScreen nav={c.nav} />,
  'stop-edit': (c) => <StopEditScreen nav={c.nav} />,
  'settings-profile': (c) => <ProfileScreen nav={c.nav} />,
  'settings-couple': (c) => <CoupleScreen nav={c.nav} />,
  'settings-unlink': (c) => <UnlinkScreen nav={c.nav} />,
  'settings-personality': (c) => <PersonalityScreen nav={c.nav} />,
  'settings-result': (c) => <SettingsResultScreen nav={c.nav} />,
  retest: (c) => <RetestScreen nav={c.nav} />,
  'settings-privacy': (c) => <PrivacyScreen nav={c.nav} />,
  'settings-about': (c) => <AboutScreen nav={c.nav} bridge={c.bridge} />,
  'settings-withdraw': (c) => <WithdrawScreen nav={c.nav} />,
  'withdraw-cancel': (c) => <WithdrawCancelScreen nav={c.nav} />,
  main: (c) => <MainTab nav={c.nav} />,
  chat: (c) => <ChatTab bridge={c.bridge} />,
  feed: (c) => <FeedTab nav={c.nav} />,
  magazine: () => <MagazineTab />,
  settings: (c) => <SettingsTab nav={c.nav} />,
}
