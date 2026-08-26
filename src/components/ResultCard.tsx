/**
 * 화면 5(간략 결과, 공유용) 카드.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 5 —
 *   "UI: 결과 카드 1장 — 연애유형 라벨, 한 줄 요약, `MBTI · 애니어그램 코어`,
 *   희귀 조합 배지, 앱 로고"
 *   "개인정보: 유저 이름 미노출 — 공유 부담 최소화"
 * docs/ONDOLOG_DESIGN.md §13-7 화면 5 — "§5-4 라벨 카드 + 공유/저장 버튼".
 * §5-4 유형 라벨 컴포넌트(`TypeLabel`)를 그대로 쓴다. 카드 자체(테두리+
 * paper-alt 배경)는 "공유 이미지"라는 예외적 성격상 §3-4의 무카드 원칙
 * 대신 §1-1 paper-alt(인용 지면) 토큰으로 감싼다 — 그림자·둥근 모서리는
 * 여전히 없다.
 *
 * ⚠️ 이 컴포넌트에는 이름·생년월일 등 어떤 개인 식별 정보도 props로
 * 받지 않는다(타입 자체에 그런 필드가 없다) — 실수로라도 넣을 수 없게
 * 인터페이스를 좁혀뒀다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { TypeLabel } from './TypeLabel'
import { LOVE_TYPE_LABEL_BY_CODE } from '../constants/loveTypeLabels'
import { useTheme } from '../theme'
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
  const { colors, typography, spacing, attachmentClimate } = useTheme()
  const label = LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]
  const climate = label ? attachmentClimate[label.attachment] : 'ember'

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.paperAlt, borderColor: colors.rule, gap: spacing.s4, padding: spacing.s5 },
      ]}
    >
      {isRare && (
        <Text style={[typography.caption, { color: colors.inkMute }]}>희귀 조합</Text>
      )}

      <TypeLabel
        labelEn={label?.labelEn ?? loveTypeCode}
        labelKo={label?.labelKo ?? loveTypeCode}
        copyKo={label?.copyKo}
        climate={climate}
      />

      <Text style={[typography.caption, { color: colors.inkMute }]}>
        {mbti} · 애니어그램 {enneagramCore}유형
      </Text>

      <Text style={[typography.labelEn, { color: colors.inkFaint }]}>ONDOLOG</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    borderWidth: 1,
  },
})
