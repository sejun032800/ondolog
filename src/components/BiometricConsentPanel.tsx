/**
 * 화면 A. 생체정보(얼굴 인식) 동의 — 근거: docs/ONDOLOG_MASTER.md
 * "MASTER 보강 — 생체정보(얼굴 인식) 별도 동의" "화면 A. 생체정보 동의".
 *
 * 구성(문서 원문 순서 그대로): 1) 헤드라인 2) 동작 설명(3단계) 3) 온디바이스
 * 처리 고지(스킵 불가, 화면에 직접 노출) 4) 전문 [보기] 링크 5) 동의
 * 체크박스(단일 항목) 6) [동의하고 계속]/[나중에].
 *
 * "단일 항목, 단일 목적. Part 9-1 화면 6처럼 여러 항목을 묶지 않는다"
 * (문서 원문) — 그래서 `ConsentChecklist`를 재사용하지 않고 `Checkbox`
 * 하나만 직접 쓴다.
 *
 * 이 컴포넌트는 화면 규격(§13 패턴을 따르되 §13에 명시 안 된 화면이라
 * 기존 온보딩 동의 화면 6-2~6-3의 구조 — ScreenContainer + Checkbox +
 * LegalDocumentModal + 하단 버튼 — 를 그대로 따른다)을 그리는 순수
 * 프레젠테이션 컴포넌트다. Supabase 호출·라우팅은 전혀 모른다 — 전부
 * 콜백으로 위임받는다(`app/(modals)/biometric-consent.tsx`가 연결한다).
 *
 * `mode`:
 *   - 'consent': 최초 동의 흐름. 체크박스 + [동의하고 계속]/[나중에].
 *   - 'manage': 설정 탭에서 재진입(이미 동의한 상태). 같은 안내 내용을
 *     다시 보여주고, 체크박스 대신 [동의 철회] 버튼만 둔다(문서 원문
 *     "탭하면 화면 A와 동일한 내용을 다시 보여주고, 하단에 [동의 철회]
 *     버튼을 둔다"). 철회는 되돌릴 수 없는 동작(재동의 시 대표사진
 *     재등록 필요)이므로 확인 다이얼로그를 거친다 — 이 컴포넌트 안에서
 *     `Alert.alert`로 처리해 "확인 없이 철회되는" 경로 자체를 원천
 *     차단한다.
 */
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { LegalDocumentModal } from './LegalDocumentModal'
import { BIOMETRIC_ON_DEVICE_NOTICE_POINTS, LEGAL_DOCUMENTS } from '../constants/legalDocuments'
import { useTheme } from '../theme'

const ACTION_STEPS = [
  '두 사람의 얼굴을 기준 사진으로 등록합니다',
  '사진 라이브러리에서 두 사람이 함께 있는 사진만 찾습니다',
  '찾은 사진은 자동으로 피드에 정리됩니다',
] as const

const CONSENT_LABEL =
  '위 내용에 동의하며, 얼굴 인식 기반 사진 자동 정리 기능을 사용합니다'

export type BiometricConsentPanelMode = 'consent' | 'manage'

interface BiometricConsentPanelProps {
  mode: BiometricConsentPanelMode
  /** mode: 'consent'일 때만 쓴다. */
  checked?: boolean
  onChangeChecked?: (checked: boolean) => void
  /** mode: 'consent' — [동의하고 계속]. checked가 아니면 버튼 자체가 비활성화된다. */
  onAgree?: () => void
  /** mode: 'consent' — [나중에]. */
  onLater?: () => void
  /** mode: 'manage' — 확인 다이얼로그에서 철회를 최종 확정한 뒤 호출된다. */
  onRevoke?: () => void
  /** Supabase 호출 진행 중 — 버튼을 비활성화하고 로딩 표시로 바꾼다. */
  submitting?: boolean
}

export function BiometricConsentPanel({
  mode,
  checked = false,
  onChangeChecked,
  onAgree,
  onLater,
  onRevoke,
  submitting = false,
}: BiometricConsentPanelProps) {
  const [showFullDocument, setShowFullDocument] = useState(false)
  const { colors, typography, spacing, lines } = useTheme()

  const canAgree = checked && !submitting

  const handleRevokePress = () => {
    // "철회는 별도 확인 다이얼로그를 거친다"(문서 원문) — 되돌릴 수
    // 없는 동작(재동의 시 대표사진 재등록 필요)이므로 확인 없이 바로
    // onRevoke를 호출하는 경로를 두지 않는다.
    Alert.alert(
      '생체정보 동의를 철회할까요?',
      '철회하면 기기에 저장된 얼굴 특징 데이터가 즉시 삭제되고, 다시 켜려면 대표사진을 재등록해야 합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '철회', style: 'destructive', onPress: () => onRevoke?.() },
      ],
    )
  }

  return (
    <View style={{ gap: spacing.s6 }} testID="biometric-consent-panel">
      <View style={{ gap: spacing.s2 }}>
        <Text style={[typography.display, { color: colors.inkFull }]}>
          우리 둘이 함께 있는 사진만 찾아드릴게요
        </Text>
      </View>

      <View style={{ gap: spacing.s2 }} testID="biometric-consent-steps">
        {ACTION_STEPS.map((step, i) => (
          <Text key={i} style={[typography.body, { color: colors.inkMute }]}>
            {i + 1}. {step}
          </Text>
        ))}
      </View>

      <View
        style={{
          borderColor: colors.rule,
          borderWidth: lines.hairline,
          gap: spacing.s2,
          padding: spacing.s4,
        }}
        testID="biometric-consent-notice"
      >
        <Text style={[typography.title, { color: colors.inkFull }]}>온디바이스 처리 고지</Text>
        {BIOMETRIC_ON_DEVICE_NOTICE_POINTS.map((point, i) => (
          <Text key={i} style={[typography.body, { color: colors.inkFull }]}>
            · {point}
          </Text>
        ))}
      </View>

      <Button
        variant="text"
        label="전문 보기"
        onPress={() => setShowFullDocument(true)}
        testID="biometric-consent-full-document-link"
      />
      <LegalDocumentModal
        document={showFullDocument ? LEGAL_DOCUMENTS.biometric : null}
        onClose={() => setShowFullDocument(false)}
      />

      {mode === 'consent' ? (
        <View style={{ gap: spacing.s5 }}>
          <Checkbox
            checked={checked}
            onPress={() => onChangeChecked?.(!checked)}
            label={CONSENT_LABEL}
            testID="biometric-consent-checkbox"
          />
          <View style={{ gap: spacing.s3 }}>
            <Button
              label="동의하고 계속"
              onPress={() => onAgree?.()}
              disabled={!canAgree}
              loading={submitting}
              testID="biometric-consent-agree"
            />
            <Button
              variant="text"
              label="나중에"
              onPress={() => onLater?.()}
              disabled={submitting}
              testID="biometric-consent-later"
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.s2 }}>
          <Text style={[typography.caption, { color: colors.inkMute }]}>동의함</Text>
          <Button
            variant="secondary"
            label="동의 철회"
            onPress={handleRevokePress}
            disabled={submitting}
            loading={submitting}
            testID="biometric-consent-revoke"
          />
        </View>
      )}
    </View>
  )
}
