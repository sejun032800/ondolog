/**
 * 화면 7(결과 랜딩 상세)의 궁합 섹션 — "온도가 잘 맞는 유형 / 온도차가
 * 있는 유형".
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-6-6 "화면 7 표시 규격".
 *   - 기준: `enneagram_effective`(오버라이드 반영값). 이 컴포넌트는
 *     호출부가 넘겨준 core를 그대로 쓸 뿐, 오버라이드 여부는 모른다 —
 *     호출부(화면 7)가 effective core를 계산해 넘긴다.
 *   - 표시: 잘 맞는 유형 3개 + 온도차 유형 2개.
 *   - 항목 구성: 3자 코드 아님 — 애니어그램 코어 번호 + 코어명(KEEL 등)
 *     + 한 줄 설명.
 *   - 온도차 항목: 이유 + 실행 팁 반드시 동반.
 *   - 필수 문구: Part 10-6-0의 프레이밍 문구를 온도차 섹션 상단에
 *     **항상** 노출한다(옵션 아님).
 *   - 금지: "최악", "안 맞음", "피하세요" 류 표현.
 *   - 애니어그램 코어 기준이다. 36종 라벨(애착 조합 포함) 기준이 아니다
 *     (화면 7은 매칭 전, 1인 상태라 상대 애착 유형을 알 수 없다).
 */

import { StyleSheet, Text, View } from 'react-native'
import {
  COMPATIBILITY,
  COMPATIBILITY_FRAMING_TEXT,
} from '../constants/compatibility'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO } from '../constants/loveTypeLabels'
import { useTheme } from '../theme'
import type { EnneagramCore } from '../constants/enneagram'

interface CompatibilitySectionProps {
  /** enneagram_effective — 오버라이드 반영값. */
  enneagramCore: EnneagramCore
}

export function CompatibilitySection({ enneagramCore }: CompatibilitySectionProps) {
  const entry = COMPATIBILITY[enneagramCore]
  const { colors, typography, spacing, lines } = useTheme()

  return (
    <View style={{ gap: spacing.s5 }}>
      <Text style={[typography.headline, { color: colors.inkFull }]}>궁합</Text>

      <View style={{ gap: spacing.s3 }}>
        <Text style={[typography.title, { color: colors.inkFull }]}>온도가 잘 맞는 유형</Text>
        {entry.best.map((item) => (
          <View
            key={item.core}
            style={[styles.row, { borderTopColor: colors.rule, borderTopWidth: lines.hairline, paddingTop: spacing.s2, gap: 2 }]}
          >
            <Text style={[typography.body, { color: colors.inkFull }]}>
              {item.core} {ENNEAGRAM_CORE_EN[item.core]} {ENNEAGRAM_CORE_KO[item.core]}
            </Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>{item.reason}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.s3 }}>
        <Text style={[typography.title, { color: colors.inkFull }]}>온도차가 있는 유형</Text>

        {/* Part 10-6-0/10-6-6: 이 문구는 조건 없이 항상 렌더링한다. */}
        <Text
          testID="compatibility-framing-text"
          style={[
            typography.caption,
            {
              backgroundColor: colors.paperAlt,
              borderColor: colors.rule,
              borderWidth: lines.hairline,
              color: colors.inkMute,
              padding: spacing.s3,
            },
          ]}
        >
          {COMPATIBILITY_FRAMING_TEXT}
        </Text>

        {entry.contrast.map((item) => (
          <View
            key={item.core}
            style={[styles.row, { borderTopColor: colors.rule, borderTopWidth: lines.hairline, paddingTop: spacing.s2, gap: 2 }]}
          >
            <Text style={[typography.body, { color: colors.inkFull }]}>
              {item.core} {ENNEAGRAM_CORE_EN[item.core]} {ENNEAGRAM_CORE_KO[item.core]}
            </Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>{item.reason}</Text>
            <Text style={[typography.caption, { color: colors.inkFull }]}>실행 팁 · {item.tip}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {},
})
