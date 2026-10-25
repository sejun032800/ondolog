/**
 * 메인 머리 - 두 사람 아바타 · 커플 닉네임 · 이름(디자인 `N-B-Main`). 상단 "끌어내리면 우리의 하늘" 힌트와
 * 끌어내리기는 MVP에 없다(MVP 조정표) - 힌트 자리는 비운다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export interface MainHeaderProps {
  /** 연결 여부. false면 오른쪽 아바타는 빈 점선 슬롯이고 부제는 "아직 혼자예요". */
  connected: boolean
  selfName: string | null
  partnerName: string | null
  nickname: string | null
}

/** 제목·부제 문구. 닉네임이 있으면 닉네임이 제목이고 두 이름이 부제다. */
export function headerLines(input: MainHeaderProps): { title: string; subtitle: string } {
  if (!input.connected) return { title: input.selfName ?? '나', subtitle: '아직 혼자예요' }
  const names = [input.selfName, input.partnerName].filter((n): n is string => !!n).join(' · ')
  if (input.nickname) return { title: input.nickname, subtitle: names }
  return { title: names || '두 사람', subtitle: '' }
}

export function MainHeader(props: MainHeaderProps) {
  const { title, subtitle } = headerLines(props)
  return (
    <View style={styles.row} testID="main-header">
      <View style={styles.avatars}>
        <View style={styles.me} />
        {props.connected ? <View style={styles.partner} /> : <View style={styles.empty} testID="main-empty-slot" />}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

const SIZE = 34

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatars: { flexDirection: 'row' },
  me: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: nocturne.ink,
    backgroundColor: withAlpha(nocturne.mist, 0.7),
  },
  partner: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: nocturne.ink,
    backgroundColor: withAlpha(nocturne.orchid, 0.7),
  },
  empty: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    marginLeft: -10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.3),
    backgroundColor: nocturne.ink,
  },
  text: { gap: 1 },
  title: { fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 21, color: nocturne.text },
  subtitle: { ...type.caption, color: nocturne.textMute },
})
