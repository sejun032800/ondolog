/**
 * I04 빈 상태 - 디자인 `N-S-I-States` I04. 점선 네모 셋 + 굵은 한 줄 + 보조 문장(두 줄까지) + (선택) 주 버튼 하나.
 * 비어 있는 것은 고장이 아니라 아직 시작 전이라는 말투(해요체). 화면에 이미 자기 보드가 있는 빈 상태(B03 · D14 · C06 등)는 그 화면의 문장이 이기고,
 * 이 컴포넌트는 보드가 따로 없는 목록의 빈 상태(피드 등)가 쓴다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'
import { PrimaryButton } from './Buttons'

export interface EmptyStateProps {
  title: string
  /** 보조 문장. 줄바꿈은 `\n`. */
  body?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  testID?: string
}

export function EmptyState({ title, body, actionLabel, onAction, actionDisabled, testID }: EmptyStateProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.squares} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.square} />
        <View style={styles.square} />
        <View style={styles.square} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton label={actionLabel} onPress={onAction} disabled={actionDisabled} testID={testID ? `${testID}-action` : undefined} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingTop: 96, paddingBottom: 24 },
  squares: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  square: {
    width: 44,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.2),
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: 19, lineHeight: 26, color: nocturne.text, textAlign: 'center' },
  body: { ...type.sub, color: nocturne.textSub, textAlign: 'center' },
  action: { marginTop: 36, alignSelf: 'stretch' },
})
