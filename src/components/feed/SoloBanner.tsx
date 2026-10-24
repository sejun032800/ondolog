/**
 * E13 혼자 기록 - 미연결 유저의 피드 머리 카드. 연결하면 두 사람의 기록이 하나로 합쳐진다.
 * `<CoupleGate>`의 fallback으로 쓴다(커플 전용 기능 = 합쳐진 보기).
 * 기록할 커플 행이 아직 없으면(규칙 6) 그 사실을 글로 적는다 - 기록 버튼이 왜 꺼져 있는지 보이게.
 */
import { StyleSheet, Text, View } from 'react-native'
import { PressScale } from '../nocturne/PressScale'
import { nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface SoloBannerProps {
  /** 기록할 수 있는 커플 행(pending 이상)이 있는가. */
  canRecord: boolean
  onInvite: () => void
}

export function SoloBanner({ canRecord, onInvite }: SoloBannerProps) {
  return (
    <View style={styles.card} testID="solo-banner">
      <View style={styles.avatars}>
        <View style={styles.me} />
        <View style={styles.empty} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{canRecord ? '혼자서도 기록할 수 있어요' : '초대 코드를 만들면 기록할 수 있어요'}</Text>
        <Text style={styles.body}>연결하면 두 사람 기록이 하나로 합쳐져요</Text>
      </View>
      <PressScale onPress={onInvite} accessibilityLabel="초대" hitSlop={10} style={styles.invite}>
        <Text style={styles.inviteLabel}>{'초대 →'}</Text>
      </PressScale>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: shape.radius.card,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.lilac, 0.28),
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  avatars: { flexDirection: 'row', width: 56, height: 36 },
  me: { width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(nocturne.mist, 0.55) },
  empty: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.3),
    backgroundColor: nocturne.ink,
  },
  text: { flex: 1, gap: 3 },
  title: { ...type.title, fontSize: 15.5, lineHeight: 22, color: nocturne.text },
  body: { ...type.caption, color: nocturne.textMute },
  invite: { minHeight: 32, justifyContent: 'center' },
  inviteLabel: { ...type.sub, fontFamily: type.caption.fontFamily, color: nocturne.mist },
})
