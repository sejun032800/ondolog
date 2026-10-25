/**
 * A14 · A15 상세 결과(MASTER 9-1 화면 7)의 묶음들. 디자인 `N-S-A3-Onboarding`.
 *
 * 값은 모두 엔진·저장소의 결과 그대로다(결정론) - 이 파일은 계산하지 않고 보여 주기만 한다. 차트(빅5 막대 · 스턴버그 삼각형)는
 * 채워지는 애니메이션 없이 정지 상태로 그린다. 색은 `nocturne` 토큰만 쓴다.
 *
 * 보드와 다른 점:
 *  - 보드의 "· 안정형" 같은 애착 유형 이름은 쓰지 않는다 - 애착 이름의 노출은 MASTER 10-5-3이 막는다(재프레이밍 문구만 쓴다).
 *  - 보드에 없는 ⑤ 애착 묶음을 둔다(MASTER 화면 7 노출 항목) - 두 축 값과 재프레이밍 문구(있을 때만).
 */
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Polygon } from 'react-native-svg'
import { COMPATIBILITY, COMPATIBILITY_FRAMING_TEXT } from '../../constants/compatibility'
import type { EnneagramCore } from '../../constants/enneagram'
import { ATTACHMENT_REFRAME_KO } from '../../constants/attachmentDisplay'
import type { AttachmentType } from '../../constants/attachment'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO } from '../../constants/loveTypeLabels'
import { fontFamily, ink, nocturne, type, withAlpha } from '../../theme/nocturne'
import { sternbergGeometry } from '../../utils/sternbergGeometry'
import { PressScale } from '../nocturne/PressScale'
import { SoftCard } from '../nocturne/GlassCard'

/** 막대 한 줄 - 라벨 · 트랙 · 값. */
function BarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <View style={styles.barRow} testID={`bar-${label}`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={[styles.barValue, ink('metric')]}>{value}</Text>
    </View>
  )
}

export interface Big5Values {
  bigE: number
  bigO: number
  bigA: number
  bigC: number
  bigN: number
}

/** 보드 순서(개방 · 성실 · 외향 · 우호 · 신경). 축 이름은 심리학 표준 용어다. */
const BIG5_ORDER: Array<{ key: keyof Big5Values; label: string }> = [
  { key: 'bigO', label: '개방성' },
  { key: 'bigC', label: '성실성' },
  { key: 'bigE', label: '외향성' },
  { key: 'bigA', label: '우호성' },
  { key: 'bigN', label: '신경성' },
]

export function Big5Card({ big5 }: { big5: Big5Values }) {
  return (
    <SoftCard style={styles.card} >
      <Text style={styles.kicker}>BIG FIVE</Text>
      <View style={styles.barList}>
        {BIG5_ORDER.map((axis) => (
          <BarRow key={axis.key} label={axis.label} value={big5[axis.key]} />
        ))}
      </View>
    </SoftCard>
  )
}

export interface SternbergValues {
  intimacy: number
  passion: number
  commitment: number
}

const TRI_W = 300
const TRI_H = 170

export function SternbergCard({ sternberg }: { sternberg: SternbergValues }) {
  const geo = sternbergGeometry(sternberg, TRI_W, TRI_H)
  const pts = (list: ReadonlyArray<{ x: number; y: number }>) => list.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <SoftCard style={styles.card}>
      <Text style={styles.kicker}>STERNBERG</Text>
      <View style={styles.triWrap}>
        <Text style={[styles.vertexText, styles.vTop]} testID="sternberg-intimacy">
          친밀 <Text style={ink('metric')}>{sternberg.intimacy}</Text>
        </Text>
        <Svg width={TRI_W} height={TRI_H} viewBox={`0 0 ${TRI_W} ${TRI_H}`} accessibilityLabel="스턴버그 삼각형">
          <Polygon points={pts(geo.outer)} fill={nocturne.inkRaise2} />
          <Polygon points={pts(geo.inner)} fill={withAlpha(nocturne.rose, 0.4)} />
        </Svg>
        <View style={styles.vBottom}>
          <Text style={styles.vertexText} testID="sternberg-passion">
            열정 <Text style={ink('metric')}>{sternberg.passion}</Text>
          </Text>
          <Text style={styles.vertexText} testID="sternberg-commitment">
            헌신 <Text style={ink('metric')}>{sternberg.commitment}</Text>
          </Text>
        </View>
      </View>
    </SoftCard>
  )
}

export function AttachmentCard({
  attachment,
  anxiety,
  avoidance,
}: {
  attachment: AttachmentType
  anxiety: number
  avoidance: number
}) {
  const reframe = ATTACHMENT_REFRAME_KO[attachment]
  return (
    <SoftCard style={styles.card}>
      <Text style={styles.kicker}>ATTACHMENT</Text>
      {reframe ? (
        <Text style={styles.attachText} testID="attachment-reframe">
          {reframe}
        </Text>
      ) : null}
      <View style={styles.barList}>
        <BarRow label="불안 축" value={anxiety} />
        <BarRow label="회피 축" value={avoidance} />
      </View>
    </SoftCard>
  )
}

export interface EnneagramCardProps {
  core: EnneagramCore
  candidates: readonly EnneagramCore[]
  onMismatch: () => void
}

export function EnneagramCard({ core, candidates, onMismatch }: EnneagramCardProps) {
  return (
    <SoftCard style={styles.card}>
      <Text style={styles.kicker}>ENNEAGRAM</Text>
      <Text style={styles.coreTitle} testID="enneagram-core">
        {core} {'·'} {ENNEAGRAM_CORE_EN[core]} {ENNEAGRAM_CORE_KO[core]}
      </Text>
      {candidates.length > 0 ? (
        <View style={styles.chips}>
          {candidates.map((c) => (
            <View key={c} style={styles.chip} testID={`candidate-${c}`}>
              <Text style={styles.chipText}>{c}번일 수도 있어요</Text>
            </View>
          ))}
        </View>
      ) : null}
      <PressScale onPress={onMismatch} accessibilityLabel="결과와 달라요" style={styles.mismatch} testID="override-open">
        <Text style={styles.mismatchText}>{'결과와 달라요 →'}</Text>
      </PressScale>
    </SoftCard>
  )
}

/** ⑥ best / contrast 궁합. 애니어그램 코어 기준(오버라이드 반영값)이다. */
export function CompatibilityCards({ core }: { core: EnneagramCore }) {
  const entry = COMPATIBILITY[core]
  return (
    <>
      <SoftCard style={styles.card}>
        <Text style={styles.groupTitle}>온도가 잘 맞는 유형</Text>
        {entry.best.map((item, i) => (
          <View key={item.core} style={[styles.compatRow, i > 0 && styles.compatRowRule]}>
            <Text style={styles.compatCore}>
              {item.core} {ENNEAGRAM_CORE_EN[item.core]}
            </Text>
            <Text style={styles.compatReason}>{item.reason}</Text>
          </View>
        ))}
      </SoftCard>
      <SoftCard style={styles.card}>
        <Text style={styles.groupTitle}>온도차가 있는 유형</Text>
        {/* MASTER 10-6-0: 이 문구는 조건 없이 항상 함께 보인다. */}
        <Text style={styles.framing} testID="compatibility-framing-text">
          {COMPATIBILITY_FRAMING_TEXT}
        </Text>
        {entry.contrast.map((item, i) => (
          <View key={item.core} style={[styles.compatRow, i > 0 && styles.compatRowRule]}>
            <Text style={styles.compatCore}>
              {item.core} {ENNEAGRAM_CORE_EN[item.core]}
            </Text>
            <View style={styles.compatBody}>
              <Text style={styles.compatReason}>{item.reason}</Text>
              <Text style={styles.compatTip}>{item.tip}</Text>
            </View>
          </View>
        ))}
      </SoftCard>
    </>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: 14, paddingVertical: 22, paddingHorizontal: 22 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  barList: { marginTop: 14, gap: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  barLabel: { ...type.sub, width: 56, color: nocturne.textSub },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: withAlpha(nocturne.text, 0.1), overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: nocturne.rose },
  barValue: { ...type.sub, width: 30, textAlign: 'right', fontFamily: fontFamily.medium },
  triWrap: { alignItems: 'center', marginTop: 14 },
  vertexText: { ...type.sub, color: nocturne.textSub },
  vTop: { marginBottom: 6 },
  vBottom: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', marginTop: -22 },
  attachText: { ...type.body, color: nocturne.textSub, marginTop: 12 },
  coreTitle: { ...type.title, color: nocturne.text, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipText: { ...type.sub, color: nocturne.textSub },
  mismatch: { minHeight: 48, justifyContent: 'center', marginTop: 4 },
  mismatchText: { ...type.body, fontSize: 15.5, color: nocturne.mist },
  groupTitle: { ...type.sub, color: nocturne.textMute, letterSpacing: 1.5 },
  framing: { ...type.sub, color: nocturne.textSub, marginTop: 12 },
  compatRow: { flexDirection: 'row', gap: 16, paddingVertical: 16 },
  compatRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: nocturne.hairline },
  compatCore: { ...type.body, width: 74, fontFamily: fontFamily.semiBold, color: nocturne.text },
  compatBody: { flex: 1, gap: 4 },
  compatReason: { ...type.body, flex: 1, color: nocturne.text },
  compatTip: { ...type.sub, color: nocturne.textMute },
})
