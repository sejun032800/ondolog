/**
 * 화면 A. 생체정보(얼굴 인식) 동의 — Phase 6 첫 단계.
 *
 * 근거: docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보(얼굴 인식) 별도
 * 동의". "화면 순서 — 피드 탭 최초 진입 시": 피드 탭 안내 카드
 * [연동하기] → 이 화면 → (동의 시) 화면 B(사진 라이브러리 권한 요청).
 *
 * **이번 작업 범위는 동의 흐름까지다.** 화면 B/C(권한 요청·대표사진
 * 등록)와 실제 얼굴 인식 SDK 연동은 메인 세션이 Phase 6 본작업에서
 * 진행한다 — 그래서 [동의하고 계속]을 눌러도 권한 요청으로 이어지지
 * 않고 피드 탭으로 돌아간다(문서 "동의 없이는 화면 B로 진행되지
 * 않는다"는 완료 기준을 "화면 B 자체가 아직 없다"로도 만족하지만,
 * 별도로 이 화면이 권한 API를 전혀 import/호출하지 않는다는 점으로
 * 코드 레벨에서도 보장한다).
 *
 * 두 진입점을 하나의 화면이 겸한다(문서 "탭하면 화면 A와 동일한 내용을
 * 다시 보여주고" 원문):
 *   - 피드 탭 안내 카드 → [연동하기] (아직 미동의 — mode: 'consent')
 *   - 설정 탭 "생체정보(얼굴 인식) 동의" 행 (이미 동의 — mode: 'manage')
 * 어느 모드인지는 `profileStore`에 저장된 서버 값(`isBiometricConsentActive`)
 * 으로 판정한다 — 진입 경로가 아니라 실제 동의 상태가 기준이다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { BiometricConsentPanel } from '../../src/components/BiometricConsentPanel'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useSession } from '../../src/hooks/useSession'
import { useProfileStore } from '../../src/store/profileStore'
import { useTheme } from '../../src/theme'
import { isBiometricConsentActive } from '../../src/utils/biometricConsent'

export default function BiometricConsentModal() {
  const router = useRouter()
  const { session } = useSession()
  const status = useProfileStore((s) => s.status)
  const biometricConsentAt = useProfileStore((s) => s.biometricConsentAt)
  const biometricConsentRevokedAt = useProfileStore((s) => s.biometricConsentRevokedAt)
  const refresh = useProfileStore((s) => s.refresh)
  const agreeBiometricConsent = useProfileStore((s) => s.agreeBiometricConsent)
  const revokeBiometricConsent = useProfileStore((s) => s.revokeBiometricConsent)

  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { colors } = useTheme()

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  if (!session || status === 'unknown' || status === 'loading') {
    return <View style={{ backgroundColor: colors.paper, flex: 1 }} />
  }

  const userId = session.user.id
  const isActive = isBiometricConsentActive(biometricConsentAt, biometricConsentRevokedAt)

  const handleAgree = async () => {
    setSubmitting(true)
    try {
      await agreeBiometricConsent(userId)
      router.back()
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async () => {
    setSubmitting(true)
    try {
      await revokeBiometricConsent(userId)
      router.back()
    } catch (e) {
      Alert.alert('철회에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer>
      <BiometricConsentPanel
        mode={isActive ? 'manage' : 'consent'}
        checked={checked}
        onChangeChecked={setChecked}
        onAgree={handleAgree}
        onLater={() => router.back()}
        onRevoke={handleRevoke}
        submitting={submitting}
      />
    </ScreenContainer>
  )
}
