/**
 * ConsentRow - A10 동의 한 줄. 왼쪽 체크 칸 · 이름 + 필수/선택 표시 · 오른쪽 [보기].
 * 체크 칸 쪽 전체가 행을 누르는 영역이고, [보기]는 따로 눌린다(전문을 보는 길 - MASTER 6-3
 * "링크 없이 체크박스만 두면 동의로 인정되지 않는다").
 * `onToggle`이 없으면 사람이 누르는 칸이 아니라 자동 판정 표시다(① 만 14세 - 생년월일로 확인함).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export function CheckBox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <View
      style={[styles.box, checked ? styles.boxOn : styles.boxOff, disabled && !checked && styles.boxDisabled]}
      testID={checked ? 'checkbox-on' : 'checkbox-off'}
    >
      {checked ? <Text style={styles.tick}>{'✓'}</Text> : null}
    </View>
  )
}

export interface ConsentRowProps {
  label: string
  /** "필수" · "선택" */
  tag?: string
  /** 이름 아래 한 줄 설명(A10 AI 활용 항목). */
  helper?: string
  checked: boolean
  /** 오른쪽 안내 글(① "생년월일로 확인함"). */
  trailingNote?: string
  onToggle?: () => void
  onView?: () => void
  strong?: boolean
  testID?: string
  viewTestID?: string
}

export function ConsentRow({
  label,
  tag,
  helper,
  checked,
  trailingNote,
  onToggle,
  onView,
  strong,
  testID,
  viewTestID,
}: ConsentRowProps) {
  const body = (
    <>
      <CheckBox checked={checked} />
      <View style={styles.texts}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, strong && styles.nameStrong]}>{label}</Text>
          {tag ? <Text style={styles.tag}>{tag}</Text> : null}
        </View>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </View>
    </>
  )

  return (
    <View style={styles.row}>
      {onToggle ? (
        <PressScale
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityLabel={tag ? `${label}, ${tag}` : label}
          accessibilityState={{ checked }}
          testID={testID}
          style={styles.main}
        >
          {body}
        </PressScale>
      ) : (
        <View style={styles.main} testID={testID} accessible accessibilityLabel={`${label}, ${trailingNote ?? ''}`}>
          {body}
        </View>
      )}
      {trailingNote ? <Text style={styles.note}>{trailingNote}</Text> : null}
      {onView ? (
        <Pressable
          onPress={onView}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel={`${label} 전문 보기`}
          testID={viewTestID}
        >
          <Text style={styles.view}>보기</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 48, paddingVertical: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  texts: { flex: 1, gap: 4, paddingTop: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 },
  name: { ...type.body, fontSize: 15.5, color: nocturne.text },
  nameStrong: { fontFamily: fontFamily.semiBold },
  tag: { ...type.caption, color: nocturne.textMute },
  helper: { ...type.sub, fontSize: 13, color: nocturne.textMute },
  note: { ...type.caption, color: nocturne.textMute, paddingTop: 4 },
  view: { ...type.sub, fontFamily: fontFamily.medium, color: nocturne.mist, paddingTop: 2 },
  box: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: nocturne.text },
  boxOff: { backgroundColor: nocturne.inkRaise2, borderWidth: 1, borderColor: nocturne.hairline },
  boxDisabled: { backgroundColor: withAlpha(nocturne.text, 0.06) },
  tick: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 16, color: nocturne.ink },
})
