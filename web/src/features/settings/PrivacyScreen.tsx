/**
 * H11 개인정보 & 약관 - 설정 > 개인정보 & 약관. 보드 `N-S-H2-Settings`(H11). RN `app/settings-privacy.tsx`의 웹판. 푸시 화면.
 *
 * 개인정보 처리방침 · 이용약관 · AI 활용 안내를 **A12 약관 전문 시트(`LegalSheet`, 74-1의 공용 `Sheet` 부품)로 연다** - 문장은 저장소의 `legalDocuments.ts` 그대로다(지금은 자리표시자, 실제 문장은 M3-7).
 *
 * **마케팅 정보 수신 토글**: 켜기 = `profiles.marketing_agreed_at = 지금`, 끄기 = `null`(`updateMarketingConsent`, 이 칸 하나만 쓴다).
 * 누르면 바로 바뀐 모습을 보이고, 저장이 실패하면 원래 값으로 되돌리고 안내를 보인다. 현재 값은 `profiles.marketing_agreed_at`에서 읽는다(읽는 동안은 토글이 눌리지 않는다). 기본 꺼짐(B18).
 * 보드에서 뺀 줄: 생체정보(얼굴 인식) 동의(H12) · 데이터 내려받기 · 삭제(H17) - 갈 곳이 없다. 보드의 "3개월" 안내는 구독(H08)이 없는 지금 사실이 아니라 넣지 않았다.
 */
import { useEffect, useState } from 'react'
import type { LegalDocumentKey } from '@/constants/legalDocuments'
import { updateMarketingConsent } from '@/services/settingsCore'
import { PRIVACY_DOCUMENT_ROWS } from '@/utils/settingsRules'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { LegalSheet } from '../../screens'
import { ListGroup, ListRow, SettingsFrame, Toggle } from './parts'

export const PRIVACY_COPY = {
  title: '개인정보 & 약관',
  marketing: '마케팅 정보 수신',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
} as const

export function PrivacyScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  /** null = 아직 읽는 중(토글 비활성). */
  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<LegalDocumentKey | null>(null)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    fetchProfile(db, userId)
      .then((p) => { if (!cancelled && p) setMarketing(p.marketing_agreed_at != null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  const toggleMarketing = async (next: boolean) => {
    const db = getSupabase()
    if (!userId || !db || marketing === null || busy) return
    const previous = marketing
    setMarketing(next)
    setBusy(true)
    setError(null)
    try {
      await updateMarketingConsent(db, userId, next)
    } catch {
      setMarketing(previous)
      setError(PRIVACY_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsFrame title={PRIVACY_COPY.title} onBack={nav.back} testId="settings-privacy">
        <ListGroup>
          {PRIVACY_DOCUMENT_ROWS.map((row) => (
            <ListRow key={row.key} label={row.label} onPress={() => setDoc(row.key)} testId={`privacy-row-${row.key}`} />
          ))}
          <ListRow
            label={PRIVACY_COPY.marketing}
            control={<Toggle value={marketing === true} onChange={(v) => void toggleMarketing(v)} disabled={marketing === null || busy} label={PRIVACY_COPY.marketing} testId="privacy-marketing-toggle" />}
          />
        </ListGroup>
        {error ? <p className="t-sub c-sub" role="alert" data-testid="privacy-error">{error}</p> : null}
      </SettingsFrame>
      {doc ? <LegalSheet docKey={doc} onClose={() => setDoc(null)} /> : null}
    </>
  )
}
