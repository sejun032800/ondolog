/**
 * 나가는 길은 한 모양. 푸시 화면은 왼쪽 위 "←", 아래에서 올라온 시트는 손잡이 + "✕".
 * 둘 다 터치 영역 48 이상. 아이콘 없이 문자만 쓴다.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface PushHeaderProps {
  onBack: () => void
  /** "← 매거진"처럼 화살표 옆에 붙는 글자. */
  backLabel?: string
  title?: string
  style?: StyleProp<ViewStyle>
}

export function PushHeader({ onBack, backLabel, title, style }: PushHeaderProps) {
  return (
    <View style={[styles.push, style]}>
      <PressScale
        onPress={onBack}
        accessibilityLabel={backLabel ? `뒤로, ${backLabel}` : '뒤로'}
        style={styles.back}
      >
        <Text style={styles.arrow}>{'←'}</Text>
        {backLabel ? <Text style={styles.backLabel}>{backLabel}</Text> : null}
      </PressScale>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  )
}

export interface SheetHeaderProps {
  onClose: () => void
  title?: string
  style?: StyleProp<ViewStyle>
}

export function SheetHeader({ onClose, title, style }: SheetHeaderProps) {
  return (
    <View style={[styles.sheet, style]}>
      <View style={styles.handle} testID="sheet-handle" />
      <View style={styles.sheetRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? ''}
        </Text>
        <PressScale onPress={onClose} accessibilityLabel="닫기" style={styles.close}>
          <Text style={styles.closeMark}>{'✕'}</Text>
        </PressScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  push: { flexDirection: 'row', alignItems: 'center', minHeight: shape.touch, gap: 8 },
  back: {
    minWidth: shape.touch,
    height: shape.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: { fontFamily: fontFamily.regular, fontSize: 20, color: nocturne.textSub },
  backLabel: { ...type.body, fontSize: 14, color: nocturne.textSub },
  title: { ...type.title, color: nocturne.text, flex: 1 },
  sheet: { alignItems: 'center', paddingTop: 8 },
  handle: {
    width: 34,
    height: 4,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.2),
  },
  sheetRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  close: {
    width: shape.touch,
    height: shape.touch,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeMark: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.textSub },
})
