/**
 * 피드 탭 (E01 피드 · E13 혼자 기록) - docs/design/nocturne `N-T-Tabs` E01, `N-S-E2-Feed` E13.
 *
 * - 월 챕터(최근 달 먼저): 머리 "기록 N · 사진 N · 데이트 N" + 대표 카드 + 원문 한 줄 + 2열 카드. "✦ 별 N"은 쓰지 않는다(MVP 조정표).
 * - 피드형/지도형 토글은 숨긴다(피드형만, MVP 조정표 - 지도는 출시 후).
 * - 미연결 유저도 이 화면에 들어온다(혼자 기록). 합쳐진 보기(커플 전용)는 `<CoupleGate>` fallback에 E13 배너를 둔다.
 * - 업로드 버튼(FAB) -> E11. 기록할 커플 행이 없으면(규칙 6) 비활성이다.
 * - 얼굴 인식 안내 카드(사진 자동 정리)는 이 화면에 없다 - 자동 정리는 MVP 밖이다(R13-2).
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoupleGate } from '../../src/components/CoupleGate'
import { AddFab } from '../../src/components/feed/AddFab'
import { FeedChapterView } from '../../src/components/feed/FeedChapterView'
import { SoloBanner } from '../../src/components/feed/SoloBanner'
import { GhostButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { Skeleton } from '../../src/components/nocturne/Skeleton'
import { useFeed } from '../../src/hooks/useFeed'
import { useRecordingCouple } from '../../src/hooks/useRecordingCouple'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'
import { fontFamily, nocturne, shape, type } from '../../src/theme/nocturne'

export default function FeedTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const userId = session?.user.id ?? null
  const refreshCouple = useCoupleStore((s) => s.refresh)
  const recording = useRecordingCouple(userId)
  const feed = useFeed(userId !== null)

  const scrollRef = useRef<ScrollView>(null)
  const chapterY = useRef<Record<string, number>>({})

  useEffect(() => {
    if (userId) void refreshCouple(userId)
  }, [userId, refreshCouple])

  // 초대 모달에서 코드를 만들고 돌아오면 기록할 수 있게 된다.
  useFocusEffect(
    useCallback(() => {
      void recording.reload()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]),
  )

  const canRecord = recording.couple !== null
  const showIndex = feed.chapters.length > 1
  const fabBottom = insets.bottom + shape.tabBarGap + shape.tabBarHeight + 16

  return (
    <ScreenFrame>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingLeft: shape.space.screen - 4,
          paddingRight: showIndex ? 34 : shape.space.screen - 4,
          paddingBottom: fabBottom + 96,
          gap: 28,
        }}
      >
        <Text style={styles.title}>피드</Text>

        <CoupleGate fallback={<SoloBanner canRecord={canRecord} onInvite={() => router.push('/couple-gate')} />}>
          {null}
        </CoupleGate>

        {feed.loading ? (
          <View style={styles.skeleton} testID="feed-skeleton">
            <Skeleton width="30%" height={48} />
            <Skeleton height={190} style={{ borderRadius: 24 }} />
          </View>
        ) : feed.error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>기록을 불러오지 못했어요</Text>
            <GhostButton label="다시 불러오기" onPress={() => void feed.reload()} />
          </View>
        ) : feed.chapters.length === 0 ? (
          <View style={styles.empty} testID="feed-empty">
            <Text style={styles.emptyText}>아직 기록이 없어요</Text>
            <Text style={styles.emptySub}>사진을 골라 첫 데이트를 남겨 보세요</Text>
          </View>
        ) : (
          feed.chapters.map((chapter) => (
            <View
              key={chapter.key}
              onLayout={(e) => {
                chapterY.current[chapter.key] = e.nativeEvent.layout.y
              }}
            >
              <FeedChapterView
                chapter={chapter}
                urls={feed.urls}
                names={feed.names}
                onOpenDate={(id) => router.push(`/date/${id}`)}
              />
            </View>
          ))
        )}
      </ScrollView>

      {showIndex ? (
        <View style={[styles.index, { top: insets.top + 128 }]}>
          {feed.chapters.map((chapter, i) => (
            <PressScale
              key={chapter.key}
              accessibilityLabel={`${chapter.month}월로 가기`}
              hitSlop={8}
              onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, (chapterY.current[chapter.key] ?? 0) - 8), animated: true })}
            >
              <Text style={[styles.indexItem, i === 0 ? styles.indexOn : styles.indexOff]}>
                {String(chapter.month).padStart(2, '0')}
              </Text>
            </PressScale>
          ))}
        </View>
      ) : null}

      <View style={[styles.fab, { bottom: fabBottom }]} pointerEvents="box-none">
        <AddFab disabled={!canRecord} onPress={() => router.push('/upload')} />
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  title: { ...type.display, fontSize: 26, color: nocturne.text, paddingLeft: 4 },
  skeleton: { gap: 16 },
  empty: { gap: 10, paddingVertical: 48, alignItems: 'center' },
  emptyText: { ...type.title, color: nocturne.text },
  emptySub: { ...type.sub, color: nocturne.textMute },
  index: { position: 'absolute', right: 8, alignItems: 'center', gap: 12 },
  indexItem: { fontFamily: fontFamily.semiBold, fontSize: 10.5, lineHeight: 14 },
  indexOn: { color: nocturne.text },
  indexOff: { color: nocturne.textMute },
  fab: { position: 'absolute', right: 24 },
})
