/**
 * H11 개인정보 & 약관 - 설정 > 개인정보 & 약관. 디자인 `N-S-H2-Settings`(H11). 푸시 화면(R18-2).
 *
 * 개인정보 처리방침 · 이용약관 · AI 활용 안내를 **A12 약관 전문 시트(`legal-document`)로 연다** - 문장은 저장소의 `legalDocuments.ts` 그대로다
 * (지금은 자리표시자, 실제 문장은 M3-7). 이 화면은 약관 문장을 쓰지 않고, 서버도 부르지 않는다.
 *
 * 보드에서 뺀 줄(지시서): 생체정보(얼굴 인식) 동의(H12) · 데이터 내려받기 · 삭제(H17) - 갈 곳이 없다. 보드의 마케팅 정보 수신 토글도 뺐다 -
 * 동의 시각 칸을 써야 해서 `67-`의 쓰는 칸 밖이다. 보드의 안내 글("무료에서는 촬영일 기준 3개월이 지난 사진을…")은 구독(H08)이 없는 지금 사실이 아니라 넣지 않았다.
 */
import { useRouter } from 'expo-router'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { PRIVACY_DOCUMENT_ROWS } from '../src/utils/settingsRules'

export default function SettingsPrivacyScreen() {
  const router = useRouter()
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
      </ListGroup>
    </SettingsScreen>
  )
}
