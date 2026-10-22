/**
 * Nocturne 컴포넌트 확인 화면 - 개발 빌드 전용.
 * 진입 경로는 `app/dev-components.tsx`(`__DEV__`일 때만 이 파일을 require한다).
 * 출시 빌드에서는 그 require가 제거되어 이 파일이 번들에 들어가지 않는다.
 *
 * 샘플 문구는 보드(Components.dc.html)의 것을 옮겼다. 실제 데이터가 아니다.
 */
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { fontFamily, nocturne, shape, type } from '../../../theme/nocturne'
import { GhostButton, PrimaryButton } from '../Buttons'
import { LockBadge, MilestoneChip, StatusChip, VolBadge } from '../Chips'
import { DateCard } from '../DateCard'
import { PushHeader, SheetHeader } from '../ExitHeader'
import { GlassCard } from '../GlassCard'
import { GlowNumeral } from '../GlowNumeral'
import { Grain } from '../Grain'
import { ListGroup, ListRow } from '../ListGroup'
import { ProgressRule } from '../ProgressRule'
import { QuoteText } from '../QuoteText'
import { RiseIn } from '../RiseIn'
import { Segmented } from '../Segmented'
import { Skeleton } from '../Skeleton'
import { SkyBackground } from '../SkyBackground'
import { TabBarView, type TabBarItem } from '../TabBar'
import { Toggle } from '../Toggle'

const TABS: readonly TabBarItem[] = [
  { key: 'main', name: 'main', label: '메인' },
  { key: 'chat', name: 'chat', label: '채팅' },
  { key: 'feed', name: 'feed', label: '피드' },
  { key: 'magazine', name: 'magazine', label: '매거진' },
  { key: 'settings', name: 'settings', label: '설정' },
]

function Section({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>{kicker}</Text>
      {children}
    </View>
  )
}

export default function ComponentGallery() {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const reduced = useReducedMotion()
  const [view, setView] = useState<'feed' | 'map'>('feed')
  const [toggle, setToggle] = useState(true)
  const [tab, setTab] = useState(0)
  const [sky, setSky] = useState<'main' | 'sky'>('main')

  return (
    <View style={styles.root}>
      <SkyBackground view={sky}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: shape.space.screen,
            paddingTop: insets.top + 16,
            paddingBottom: shape.tabBarHeight + insets.bottom + shape.tabBarGap + 40,
            gap: shape.space.section,
            minHeight: height,
          }}
        >
          <RiseIn>
            <Text style={styles.display}>Nocturne v5</Text>
            <Text style={styles.sub}>
              {`컴포넌트 확인 화면 (개발 빌드 전용) - 동작 줄이기: ${reduced ? '켜짐 (별 명멸·진입 모션 정지)' : '꺼짐'}`}
            </Text>
          </RiseIn>

          <Section kicker="SKY">
            <Segmented
              options={[
                { key: 'main', label: '메인 시점' },
                { key: 'sky', label: '하늘 시점' },
              ]}
              value={sky}
              onChange={setSky}
            />
          </Section>

          <Section kicker="GLOW NUMERAL">
            <GlowNumeral value={38.2} />
            <GlowNumeral value={36.5} size={56} connected={false} />
          </Section>

          <Section kicker="BUTTON">
            <PrimaryButton label="발행 확인으로" />
            <GhostButton label="사진 모두 보기" />
            <GhostButton label="재료가 더 필요해요" disabled />
          </Section>

          <Section kicker="CHIP / BADGE">
            <View style={styles.wrap}>
              <StatusChip label="준비됨" />
              <StatusChip label="모으는 중" tone="gathering" />
              <StatusChip label="대기 중 →" tone="waiting" onPress={() => {}} />
              <StatusChip label="답함" tone="answered" />
              <MilestoneChip label="300일 · 2일 남았어요" />
              <VolBadge volume={2} />
              <LockBadge />
            </View>
          </Section>

          <Section kicker="SEGMENTED / TOGGLE">
            <Segmented
              options={[
                { key: 'feed', label: '피드형' },
                { key: 'map', label: '지도형' },
              ]}
              value={view}
              onChange={setView}
            />
            <ListGroup>
              <ListRow
                label="유성 떨어뜨리기"
                control={<Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="유성 떨어뜨리기" />}
              />
            </ListGroup>
          </Section>

          <Section kicker="GLASS CARD / PROGRESS RULE">
            <GlassCard style={styles.cardGap}>
              <Text style={styles.cardKicker}>ISSUE · 10월호</Text>
              <Text style={styles.cardTitle}>10월호를 만들고 있어요</Text>
              <ProgressRule progress={0.41} />
              <Text style={styles.cardMeta}>대화 412 · 사진 18 · 데이트 3</Text>
            </GlassCard>
          </Section>

          <Section kicker="LIST ROW">
            <ListGroup>
              <ListRow label="발행물 테마" value="기본" onPress={() => {}} />
              <ListRow label="연인" value="서영 · D+298" onPress={() => {}} />
              <ListRow label="재검사" value="사용함" disabled />
              <ListRow label="5문항 다시 하기" description="계정당 한 번 · 아직 쓰지 않았어요" />
            </ListGroup>
          </Section>

          <Section kicker="DATE CARD (사진 아래 장막 140)">
            <DateCard dateLabel="2026.10.03 · 연남동" title="스파이더맨과 케이크 사이" meta="사진 11 · 메모 2" />
          </Section>

          <Section kicker="QUOTE">
            <QuoteText mark="rule" attribution="세준의 메모">
              스파이더맨 봤다. 서영이는 중간에 졸았음
            </QuoteText>
            <QuoteText>오늘 비 온대. 우산 챙겼어?</QuoteText>
            <QuoteText variant="large">기다릴게</QuoteText>
          </Section>

          <Section kicker="EXIT HEADER">
            <PushHeader onBack={() => {}} backLabel="매거진" />
            <GlassCard>
              <SheetHeader onClose={() => {}} title="시트" />
            </GlassCard>
          </Section>

          <Section kicker="SKELETON">
            <GlassCard style={styles.cardGap}>
              <Skeleton width="40%" height={10} />
              <Skeleton width="75%" height={16} />
              <Skeleton width="100%" height={2} />
              <Skeleton width="55%" height={10} />
            </GlassCard>
          </Section>
        </ScrollView>

        <TabBarView items={TABS} activeIndex={tab} onPressItem={setTab} bottomInset={insets.bottom} />
      </SkyBackground>
      <Grain />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: nocturne.ink },
  section: { gap: 14 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  display: { ...type.display, color: nocturne.text },
  sub: { ...type.sub, color: nocturne.textSub, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardGap: { gap: 14 },
  cardKicker: { ...type.kicker, color: nocturne.textMute },
  cardTitle: { ...type.title, fontFamily: fontFamily.semiBold, color: nocturne.text },
  cardMeta: { ...type.sub, color: nocturne.textMute },
})
