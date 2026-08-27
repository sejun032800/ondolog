/**
 * 대표사진 슬롯 하나(개인 또는 커플) — docs/ONDOLOG_MASTER.md "연인 인식용
 * 대표사진" "등록: 개인 1장 + 커플 1장, 프로필처럼 관리" / "수정: 설정
 * 탭에서 언제든 교체".
 *
 * 실제 OS 갤러리 피커는 아직 붙지 않았다(2026-08-27 코디네이터 결정 —
 * `src/constants/referencePhotoPlaceholders.ts` docblock 참조). 대신
 * 번들 자산 중 하나를 탭해 "고른 사진"으로 삼는다 — 그 뒤 미리보기·
 * [저장](Supabase Storage 업로드 + DB 반영)은 전부 실제로 동작한다.
 * 실제 갤러리 연동 시 이 컴포넌트는 그대로 두고 placeholder 소스만
 * 교체하면 된다.
 *
 * 이 컴포넌트는 Supabase를 전혀 모른다 — 현재 등록된 사진의 미리보기
 * URL(`currentPhotoUrl`, 이미 서명된 상태)과 저장 콜백(`onSave`)만
 * 주입받는다(`ConsentChecklist`/`BiometricConsentPanel`과 같은 결).
 */
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { Button } from './Button'
import {
  REFERENCE_PHOTO_PLACEHOLDERS,
  resolvePlaceholderUri,
} from '../constants/referencePhotoPlaceholders'
import { useTheme } from '../theme'

interface ReferencePhotoSlotProps {
  title: string
  description: string
  /** 이미 저장된 사진의 미리보기 URL(호출부가 서명 완료한 상태). 없으면 null. */
  currentPhotoUrl: string | null
  /** true면 선택/저장 UI를 숨기고 안내만 보여준다(예: 커플 미연결). */
  locked?: boolean
  lockedMessage?: string
  onSave: (localUri: string) => Promise<void>
  testIDPrefix: string
}

export function ReferencePhotoSlot({
  title,
  description,
  currentPhotoUrl,
  locked = false,
  lockedMessage,
  onSave,
  testIDPrefix,
}: ReferencePhotoSlotProps) {
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { colors, typography, spacing, lines, radius } = useTheme()

  const previewUri = selectedUri ?? currentPhotoUrl

  const handleSave = async () => {
    if (!selectedUri) return
    setSaving(true)
    try {
      await onSave(selectedUri)
      setSelectedUri(null)
    } catch {
      // 실패 시 선택을 유지해 재시도할 수 있게 한다 — 사용자에게 실패를
      // 알리는 것(Alert 등)은 `onSave` 구현부(화면)의 책임이다. 이
      // 컴포넌트는 표시 전용이라 여기서 또 알림을 띄우지 않는다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ gap: spacing.s3 }} testID={`${testIDPrefix}-slot`}>
      <Text style={[typography.title, { color: colors.inkFull }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.inkMute }]}>{description}</Text>

      {locked ? (
        <Text
          style={[typography.caption, { color: colors.inkMute }]}
          testID={`${testIDPrefix}-locked`}
        >
          {lockedMessage}
        </Text>
      ) : (
        <>
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={{
                aspectRatio: 1,
                backgroundColor: colors.paperAlt,
                borderRadius: radius.touch,
                width: 120,
              }}
              testID={`${testIDPrefix}-preview`}
            />
          ) : (
            <View
              style={{
                alignItems: 'center',
                aspectRatio: 1,
                backgroundColor: colors.paperAlt,
                borderColor: colors.rule,
                borderRadius: radius.touch,
                borderWidth: lines.hairline,
                justifyContent: 'center',
                width: 120,
              }}
              testID={`${testIDPrefix}-preview-empty`}
            >
              <Text style={[typography.caption, { color: colors.inkFaint }]}>미등록</Text>
            </View>
          )}

          <Text style={[typography.caption, { color: colors.inkFaint }]}>
            실제 갤러리 연동 전 임시 선택입니다(개발용).
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            {REFERENCE_PHOTO_PLACEHOLDERS.map((placeholder) => {
              const uri = resolvePlaceholderUri(placeholder.source)
              const isSelected = selectedUri === uri
              return (
                <Pressable
                  key={placeholder.key}
                  onPress={() => setSelectedUri(uri)}
                  testID={`${testIDPrefix}-placeholder-${placeholder.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Image
                    source={placeholder.source}
                    style={{
                      borderColor: isSelected ? colors.inkFull : colors.rule,
                      borderRadius: radius.touch,
                      borderWidth: isSelected ? 2 : 1,
                      height: 56,
                      width: 56,
                    }}
                  />
                </Pressable>
              )
            })}
          </View>

          <Button
            label="저장"
            onPress={handleSave}
            disabled={!selectedUri || saving}
            loading={saving}
            testID={`${testIDPrefix}-save`}
          />
        </>
      )}
    </View>
  )
}
