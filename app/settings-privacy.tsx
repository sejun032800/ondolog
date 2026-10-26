/**
 * H11 개인정보 & 약관 - 설정 > 개인정보 & 약관. 디자인 `N-S-H2-Settings`(H11). 푸시 화면(R18-2).
 *
 * 개인정보 처리방침 · 이용약관 · AI 활용 안내를 **A12 약관 전문 시트(`legal-document`)로 연다** - 문장은 저장소의 `legalDocuments.ts` 그대로다
 * (지금은 자리표시자, 실제 문장은 M3-7).
 *
 * **마케팅 정보 수신 토글(`68-`)**: 켜기 = `profiles.marketing_agreed_at = 지금`, 끄기 = `null`(`updateMarketingConsent`, 이 칸 하나만 쓴다).
 * 누르면 바로 바뀐 모습을 보이고, 저장이 실패하면 원래 값으로 되돌리고 안내를 보인다. 현재 값은 `profiles.marketing_agreed_at`에서 읽는다(읽는 동안은 토글이 눌리지 않는다).
 *
 * 보드에서 뺀 줄(지시서): 생체정보(얼굴 인식) 동의(H12) · 데이터 내려받기 · 삭제(H17) - 갈 곳이 없다. 보드의 안내 글("무료에서는 촬영일 기준 3개월이 지난 사진을…")은
 * 구독(H08)이 없는 지금 사실이 아니라 넣지 않았다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { Toggle } from '../src/components/nocturne/Toggle'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { updateMarketingConsent } from '../src/services/settingsApi'
import { nocturne, type } from '../src/theme/nocturne'
import { PRIVACY_DOCUMENT_ROWS } from '../src/utils/settingsRules'

const COPY = {
  marketing: '마케팅 정보 수신',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
} as const

export default function SettingsPrivacyScreen() {
  const router = useRouter()
  const { session } = useSession()
  const userId = session?.user.id ?? null
  /** null = 아직 읽는 중(토글 비활성). */
  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId)
      .then((p) => {
        if (!cancelled && p) setMarketing(p.marketing_agreed_at != null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggleMarketing = async (next: boolean) => {
    if (!userId || marketing === null || busy) return
    const previous = marketing
    setMarketing(next)
    setBusy(true)
    setError(null)
    try {
      await updateMarketingConsent(userId, next)
    } catch {
      setMarketing(previous)
      setError(COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsScreen title="개인정보 & 약관" onBack={() => router.back()}>
      <ListGroup>
        {PRIVACY_DOCUMENT_ROWS.map((row) => (
          <ListRow
            key={row.key}
            label={row.label}
            onPress={() => router.push({ pathname: '/legal-document', params: { key: row.key } })}
            testID={`privacy-row-${row.key}`}
          />
        ))}
        <ListRow
          label={COPY.marketing}
          control={
            <Toggle
              value={marketing === true}
              onValueChange={toggleMarketing}
              disabled={marketing === null || busy}
              accessibilityLabel={COPY.marketing}
              testID="privacy-marketing-toggle"
            />
          }
        />
      </ListGroup>
      {error ? (
        <Text style={styles.note} accessibilityRole="alert" testID="privacy-error">
          {error}
        </Text>
      ) : null}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  note: { ...type.sub, color: nocturne.textSub, paddingHorizontal: 4 },
})
