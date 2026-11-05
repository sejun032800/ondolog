/**
 * H19 앱 정보 · 문의(최소판) - 설정 > 앱 정보. 디자인 `N-S-H4-Settings` H19. 푸시 화면(R18-2).
 *
 * - 글자표 + "버전 {값}". 값은 앱 설정의 버전(`expo-constants` `expoConfig.version`, 이미 저장소에 있는 의존성)을 그대로 보인다.
 *   보드의 "· 최신"은 **뺀다** - 업데이트 확인 기능이 없어 사실이 아니다.
 * - 문의하기: `mailto:`로 메일 앱을 연다(새 의존성 없음). 주소 = `SUPPORT_EMAIL`(자리표시자, 운영 주소는 Proteur). 제목 · 본문 머리는 `supportMail.ts`.
 *   계정 id · 이메일 · 이름 · 커플 정보는 **자동으로 넣지 않는다**. 메일 앱을 열 수 없으면(보드에 없는 상태) 공통 토스트로 주소를 안내한다.
 * - 이용약관 · 개인정보 처리방침: 온보딩 동의(A10 -> A12)가 쓰는 같은 약관 전문 시트(`legal-document`)를 연다. 새로 쓰지 않는다.
 * - 오픈소스 라이선스: 숨긴다(M4-9).
 */
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Linking, Platform, StyleSheet, Text, View } from 'react-native'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { Wordmark } from '../src/components/onboarding/Wordmark'
import { SUPPORT_EMAIL } from '../src/constants/support'
import { showToast } from '../src/store/toastStore'
import { nocturne, type } from '../src/theme/nocturne'
import { buildSupportMailto } from '../src/utils/supportMail'

export const ABOUT_COPY = {
  title: '앱 정보',
  inquiry: '문의하기',
  terms: '이용약관',
  privacy: '개인정보 처리방침',
  mailFailed: `메일 앱을 열 수 없어요. ${SUPPORT_EMAIL}로 보내 주세요`,
} as const

export default function SettingsAboutScreen() {
  const router = useRouter()
  const appVersion = Constants.expoConfig?.version ?? null

  const openInquiry = async () => {
    const url = buildSupportMailto({ appVersion, os: Platform.OS, osVersion: Platform.Version })
    try {
      await Linking.openURL(url)
    } catch {
      showToast(ABOUT_COPY.mailFailed)
    }
  }

  return (
    <SettingsScreen title={ABOUT_COPY.title} onBack={() => router.back()}>
      <View style={styles.brand}>
        <Wordmark />
        {appVersion ? (
          <Text style={styles.version} testID="about-version">{`버전 ${appVersion}`}</Text>
        ) : null}
      </View>
      <ListGroup>
        <ListRow label={ABOUT_COPY.inquiry} onPress={openInquiry} testID="about-inquiry" />
        <ListRow
          label={ABOUT_COPY.terms}
          onPress={() => router.push({ pathname: '/legal-document', params: { key: 'terms' } })}
          testID="about-terms"
        />
        <ListRow
          label={ABOUT_COPY.privacy}
          onPress={() => router.push({ pathname: '/legal-document', params: { key: 'privacy' } })}
          testID="about-privacy"
        />
      </ListGroup>
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 12 },
  version: { ...type.sub, color: nocturne.textMute },
})
