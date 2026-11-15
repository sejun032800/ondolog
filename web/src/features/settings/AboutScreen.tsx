/**
 * H19 앱 정보 · 문의(최소판) - 설정 > 앱 정보. 보드 `N-S-H4-Settings` H19. RN `app/settings-about.tsx`의 웹판. 푸시 화면.
 *
 * - 글자표 + "버전 {값}". 값은 웹 앱의 버전(`appInfo.appVersion`). 보드의 "· 최신"은 **뺀다** - 업데이트 확인 기능이 없어 사실이 아니다.
 * - 문의하기: `mailto:`로 메일 앱을 연다(다리 `openMail`, 새 의존성 없음). 받는 사람 = `legal/consent.ts`의 `LEGAL_CONTACT_EMAIL`(처리방침 · 약관의 문의와 같은 상수 - Proteur가 그 한 줄에 넣는다).
 *   제목 · 본문 머리는 루트 `@/utils/supportMail`(앱 버전 · OS · 정정 요청 안내 세 줄). **계정 id · 이메일 · 이름 · 커플 정보는 자동으로 넣지 않는다**(받는 값 자체가 앱 버전과 OS뿐이다).
 *   메일 앱을 열 수 없으면(보드에 없는 상태) 공통 토스트로 주소를 안내한다.
 * - 이용약관 · 개인정보 처리방침: 온보딩 동의(A10 -> A12)가 쓰는 같은 약관 전문 시트(`LegalSheet`)를 연다. 새로 쓰지 않는다.
 * - 오픈소스 라이선스: 숨긴다(M4-9).
 */
import { useState } from 'react'
import { SUPPORT_MAIL_SUBJECT } from '@/constants/support'
import { supportMailBody } from '@/utils/supportMail'
import { LEGAL_CONTACT_EMAIL, type LegalDocumentKey } from '../../legal/consent'
import type { Nav } from '../../navigation'
import type { NativeBridge } from '../../platform/bridge'
import { LegalSheet } from '../../screens'
import { showToast } from '../../stores/toastStore'
import { Wordmark } from '../../ui'
import { appVersion, osFacts } from './appInfo'
import { ListGroup, ListRow, SettingsFrame } from './parts'

export const ABOUT_COPY = {
  title: '앱 정보',
  inquiry: '문의하기',
  terms: '이용약관',
  privacy: '개인정보 처리방침',
  mailFailed: `메일 앱을 열 수 없어요. ${LEGAL_CONTACT_EMAIL}로 보내 주세요`,
} as const

export function AboutScreen({ nav, bridge }: { nav: Nav; bridge: NativeBridge }) {
  const [doc, setDoc] = useState<LegalDocumentKey | null>(null)
  const version = appVersion()

  const openInquiry = async () => {
    const { os, osVersion } = osFacts()
    // 받는 사람 = 동의 상수 파일의 문의 메일(처리방침의 문의와 같은 값). 제목 · 본문 머리는 루트 규칙 그대로.
    const url = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(SUPPORT_MAIL_SUBJECT)}&body=${encodeURIComponent(supportMailBody({ appVersion: version, os, osVersion }))}`
    let result: 'opened' | 'failed' = 'failed'
    try {
      result = await bridge.openMail(url)
    } catch {
      result = 'failed'
    }
    if (result === 'failed') showToast(ABOUT_COPY.mailFailed)
  }

  return (
    <>
      <SettingsFrame title={ABOUT_COPY.title} onBack={nav.back} testId="settings-about">
        <div className="aboutBrand">
          <Wordmark />
          <p className="t-sub c-mute" data-testid="about-version">{`버전 ${version}`}</p>
        </div>
        <ListGroup>
          <ListRow label={ABOUT_COPY.inquiry} onPress={() => void openInquiry()} testId="about-inquiry" />
          <ListRow label={ABOUT_COPY.terms} onPress={() => setDoc('terms')} testId="about-terms" />
          <ListRow label={ABOUT_COPY.privacy} onPress={() => setDoc('privacy')} testId="about-privacy" />
        </ListGroup>
      </SettingsFrame>
      {doc ? <LegalSheet docKey={doc} onClose={() => setDoc(null)} /> : null}
    </>
  )
}
