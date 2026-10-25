/**
 * A08 간략 결과 카드 - 연애유형 한 장. **개인 식별 정보를 받지 않는다**(이름·생년월일 같은 props 자체가 없다).
 * MASTER 9-1 화면 5: 연애유형 라벨 · 한 줄 요약 · `MBTI · 애니어그램 코어` · 희귀 조합 배지 · 앱 로고.
 */
import { StyleSheet, Text, View } from 'react-native'
import { GlassCard } from '../nocturne/GlassCard'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export interface LoveTypeCardProps {
  labelEn: string
  labelKo: string
  copyKo?: string | null
  mbti: string
  enneagramCore: number
  /** 희귀 조합 배지(표시 전용, 채점과 무관). */
  isRare?: boolean
}

export function LoveTypeCard({ labelEn, labelKo, copyKo, mbti, enneagramCore, isRare }: LoveTypeCardProps) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.kicker}>MY LOVE TYPE</Text>
      <Text style={styles.labelEn} testID="love-type-label-en">{labelEn}</Text>
      <Text style={styles.labelKo} testID="love-type-label-ko">{labelKo}</Text>
      {copyKo ? <Text style={styles.copy}>{copyKo}</Text> : null}
      <View style={styles.rule} />
      <Text style={styles.meta} testID="love-type-meta">
        {mbti} {'·'} 애니어그램 {enneagramCore}
      </Text>
      {isRare ? <Text style={styles.rare}>희귀 조합</Text> : null}
      <Text style={styles.logo}>ONDOLOG</Text>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 24, gap: 10 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  labelEn: { ...type.kicker, fontSize: 14, lineHeight: 20, letterSpacing: 3.4, color: nocturne.orchid, marginTop: 6 },
  labelKo: { ...type.display, color: nocturne.text, textAlign: 'center', marginTop: 4 },
  copy: { ...type.body, color: nocturne.textSub, textAlign: 'center', marginTop: 6 },
  rule: { width: 40, height: 1, backgroundColor: withAlpha(nocturne.text, 0.2), marginTop: 12 },
  meta: { ...type.body, color: nocturne.textSub, marginTop: 6 },
  rare: { ...type.caption, color: nocturne.textSub },
  logo: { ...type.kicker, fontFamily: fontFamily.medium, color: nocturne.textMute, marginTop: 16 },
})
