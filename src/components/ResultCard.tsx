/**
 * 화면 5(간략 결과, 공유용) 카드.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 5 —
 *   "UI: 결과 카드 1장 — 연애유형 라벨, 한 줄 요약, `MBTI · 애니어그램 코어`,
 *   희귀 조합 배지, 앱 로고"
 *   "개인정보: 유저 이름 미노출 — 공유 부담 최소화"
 *
 * ⚠️ 이 컴포넌트에는 이름·생년월일 등 어떤 개인 식별 정보도 props로
 * 받지 않는다(타입 자체에 그런 필드가 없다) — 실수로라도 넣을 수 없게
 * 인터페이스를 좁혀뒀다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { LOVE_TYPE_LABEL_BY_CODE } from '../constants/loveTypeLabels'
import { COLORS } from '../constants/theme'
import type { EnneagramCore } from '../constants/enneagram'
import type { MbtiType } from '../constants/quizTypes'

export interface ResultCardProps {
  mbti: MbtiType
  enneagramCore: EnneagramCore
  loveTypeCode: string
  /** 희귀 조합 배지 — Part 10-2-6 사전분포 기준(채점과 무관, 표시 전용). */
  isRare: boolean
}

export function ResultCard({ mbti, enneagramCore, loveTypeCode, isRare }: ResultCardProps) {
  const label = LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]

  return (
    <View style={styles.card}>
      {isRare && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>희귀 조합</Text>
        </View>
      )}

      <Text style={styles.labelKo}>{label?.labelKo ?? loveTypeCode}</Text>
      {label?.copyKo && <Text style={styles.copyKo}>{label.copyKo}</Text>}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {mbti} · 애니어그램 {enneagramCore}유형
        </Text>
      </View>

      <Text style={styles.logo}>ONDOLOG</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  labelKo: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  copyKo: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22 },
  metaRow: { marginTop: 4 },
  metaText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  logo: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
  },
})
