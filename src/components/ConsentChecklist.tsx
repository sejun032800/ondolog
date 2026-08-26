/**
 * 화면 6 동의 항목 체크리스트.
 *
 * 근거: docs/ONDOLOG_MASTER.md "화면 6 약관 동의 명세" 6-2~6-3.
 *
 *   | # | 항목                              | 필수 | DB 컬럼            |
 *   |---|-----------------------------------|------|---------------------|
 *   | 1 | 만 14세 이상입니다                | 필수 | (검증만, 컬럼 없음) |
 *   | 2 | 이용약관 동의                     | 필수 | terms_agreed_at     |
 *   | 3 | 개인정보 처리방침 동의            | 필수 | privacy_agreed_at   |
 *   | 4 | AI 콘텐츠 생성을 위한 데이터 활용 | 필수 | ai_usage_agreed_at  |
 *   | 5 | 마케팅 정보 수신 동의 (선택)      | 선택 | marketing_agreed_at |
 *
 * ① 항목은 사용자가 직접 체크하는 항목이 아니다 — "화면 2에서 수집한
 * birth_date로 자동 검증한다"(6-3 ①)고 명시돼 있어, 체크박스가 아니라
 * 상태 표시(충족/미충족)로 렌더링한다. 미충족이면 안내 문구를 노출한다
 * ("만 14세 미만은 서비스를 이용할 수 없습니다"). 문서 자체가 없어
 * [보기] 링크도 두지 않는다 — 2026-08-25 코디네이터 확인 완료, MASTER.md
 * 6-3 "공통" 절 문구도 이에 맞춰 수정됨(`.claude/state/DECISIONS.md`
 * 2026-08-25 항목 참조).
 *
 * ②~⑤는 사용자가 직접 체크하고, 전문을 보여주는 [보기] 링크를 각각
 * 갖는다(6-3 "공통" 요구사항) — 전문은 `LegalDocumentModal`이 연다.
 */
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Checkbox } from './Checkbox'
import { LegalDocumentModal } from './LegalDocumentModal'
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '../constants/legalDocuments'
import { useTheme } from '../theme'

export interface ConsentValue {
  terms: boolean
  privacy: boolean
  aiUsage: boolean
  marketing: boolean
}

export const INITIAL_CONSENT_VALUE: ConsentValue = {
  terms: false,
  privacy: false,
  aiUsage: false,
  marketing: false,
}

interface ConsentChecklistProps {
  value: ConsentValue
  onChange: (value: ConsentValue) => void
  /** 화면 2 birth_date 기준 만 14세 이상 여부. */
  ageEligible: boolean
}

const TOGGLE_KEYS: (keyof ConsentValue)[] = ['terms', 'privacy', 'aiUsage', 'marketing']

const ITEMS: Array<{
  key: keyof ConsentValue
  label: string
  docKey: LegalDocumentKey
  testID: string
}> = [
  { key: 'terms', label: '[필수] 이용약관 동의', docKey: 'terms', testID: 'consent-terms' },
  {
    key: 'privacy',
    label: '[필수] 개인정보 처리방침 동의',
    docKey: 'privacy',
    testID: 'consent-privacy',
  },
  {
    key: 'aiUsage',
    label: '[필수] AI 콘텐츠 생성을 위한 데이터 활용 동의',
    docKey: 'aiUsage',
    testID: 'consent-ai-usage',
  },
  {
    key: 'marketing',
    label: '[선택] 마케팅 정보 수신 동의',
    docKey: 'marketing',
    testID: 'consent-marketing',
  },
]

export function ConsentChecklist({ value, onChange, ageEligible }: ConsentChecklistProps) {
  const [openDocKey, setOpenDocKey] = useState<LegalDocumentKey | null>(null)
  const { colors, typography, spacing, lines } = useTheme()

  const allChecked = TOGGLE_KEYS.every((k) => value[k])

  const toggleAll = () => {
    const next = !allChecked
    onChange({ terms: next, privacy: next, aiUsage: next, marketing: next })
  }

  const toggleOne = (key: keyof ConsentValue) => {
    onChange({ ...value, [key]: !value[key] })
  }

  return (
    <View style={{ gap: spacing.s2 }} testID="consent-checklist">
      <Checkbox checked={allChecked} onPress={toggleAll} label="전체 동의" testID="consent-all" bold />
      <View style={{ backgroundColor: colors.rule, height: lines.hairline, marginVertical: 2 }} />

      <View style={{ gap: 4 }} testID="consent-age">
        <Text
          style={[
            ageEligible ? typography.body : typography.title,
            { color: colors.inkFull },
          ]}
        >
          {ageEligible ? '✓' : '✕'} [필수] 만 14세 이상입니다
        </Text>
        {!ageEligible && (
          <Text style={[typography.caption, { color: colors.inkFull }]} testID="consent-age-error">
            만 14세 미만은 서비스를 이용할 수 없습니다
          </Text>
        )}
      </View>

      {ITEMS.map((item) => (
        <Checkbox
          key={item.key}
          checked={value[item.key]}
          onPress={() => toggleOne(item.key)}
          label={item.label}
          linkLabel="보기"
          onPressLink={() => setOpenDocKey(item.docKey)}
          testID={item.testID}
        />
      ))}

      <LegalDocumentModal
        document={openDocKey ? LEGAL_DOCUMENTS[openDocKey] : null}
        onClose={() => setOpenDocKey(null)}
      />
    </View>
  )
}
