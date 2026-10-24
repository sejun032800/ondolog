/**
 * E03 데이트 상세 - 푸시 화면(왼쪽 위 ←, R18-2). docs/design/nocturne `N-E03-Date-Detail`.
 *
 * - 머리: 날짜 말로 · 지역(있을 때) · 제목 · "14:20-20:05 · 사진 N · 메모 N".
 *   `dates.title`은 생성 단계가 쓰는 값이라 앱이 지어내지 않는다 - 비어 있으면 날짜와 지역으로 머리를 만든다.
 * - stop별 타임라인: 시각(유저가 말한 시각일 때만) · 장소 · 사진. 사진 배치는 규칙 4로 다시 계산한다.
 * - 메모는 데이트 단위다(규칙 5). E15에 장소별 메모 칸이 없어 stop에 붙이지 않고, 머리 아래 한 블록에 둔다.
 * - 사진 더하기 -> E10(`/upload?dateId=`). 장소 고치기 -> E15.
 * - 본인 기록 삭제는 아직 없다: 클라이언트가 지울 수 있는 경로가 DB에 없다(HANDOFF `56-` 막힌 항목).
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StopTimeline } from '../../../src/components/date/StopTimeline'
import { GhostButton } from '../../../src/components/nocturne/Buttons'
import { PressScale } from '../../../src/components/nocturne/PressScale'
import { QuoteText } from '../../../src/components/nocturne/QuoteText'
import { ScreenFrame } from '../../../src/components/nocturne/ScreenFrame'
import { Skeleton } from '../../../src/components/nocturne/Skeleton'
import { useDateDetail } from '../../../src/hooks/useDateDetail'
import { useSession } from '../../../src/hooks/useSession'
import { buildDateHead } from '../../../src/utils/dateRecord'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../../src/theme/nocturne'

const HERO_HEIGHT = 420

export default function DateDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id: string }>()
  const dateId = Array.isArray(params.id) ? params.id[0] : params.id
  const { session } = useSession()
  const detail = useDateDetail(dateId, session?.user.id ?? null)

  const date = detail.date
  const cover = detail.stops.flatMap((s) => s.photos).find((p) => p.storage_path && detail.urls[p.storage_path])
  const coverUri = cover?.storage_path ? detail.urls[cover.storage_path] : undefined
  const head = date ? buildDateHead(date, detail.photoCapturedAts, detail.photoTotal, detail.memos.length) : null

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        <View style={styles.hero}>
          {coverUri ? <Image source={{ uri: coverUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
          <View style={styles.heroFade} pointerEvents="none" />
        </View>

        <View style={styles.headWrap}>
          {detail.loading ? (
            <View style={{ gap: 10 }} testID="detail-skeleton">
              <Skeleton width="40%" height={12} />
              <Skeleton width="70%" height={28} />
            </View>
          ) : detail.notFound ? (
            <Text style={styles.message}>이 데이트를 찾을 수 없어요</Text>
          ) : detail.error ? (
            <Text style={styles.message}>데이트를 불러오지 못했어요</Text>
          ) : head && date ? (
            <View style={{ gap: 6 }}>
              {head.kicker ? <Text style={styles.kicker}>{head.kicker}</Text> : null}
              <Text style={styles.title} testID="detail-title">{head.title}</Text>
              <Text style={styles.meta}>{head.meta}</Text>
            </View>
          ) : null}
        </View>

        {date && !detail.loading ? (
          <View style={styles.bodyWrap}>
            {detail.memos.length > 0 ? (
              <View style={{ gap: 14 }} testID="detail-memos">
                <Text style={styles.sectionKicker}>MEMO</Text>
                {detail.memos.map((m) => (
                  <QuoteText key={m.id} mark="rule" attribution={detail.names[m.author_id]}>
                    {m.text_content ?? ''}
                  </QuoteText>
                ))}
              </View>
            ) : null}

            <StopTimeline
              dateOn={date.date_on}
              stops={detail.stops}
              urls={detail.urls}
              onEditStop={(stopId) => router.push(`/date/${date.id}/stop/${stopId}`)}
            />

            <GhostButton
              label="사진 더하기"
              onPress={() => router.push({ pathname: '/upload', params: { dateId: date.id } })}
              testID="detail-add-photos"
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.back, { top: insets.top + 8 }]}>
        <PressScale onPress={() => router.back()} accessibilityLabel="뒤로" style={styles.backCircle}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </PressScale>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  hero: { height: HERO_HEIGHT, backgroundColor: nocturne.inkRaise2 },
  // 사진이 ink로 가라앉는 장막(디자인: 180 -> 420, 투명 -> .75 -> ink)
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(nocturne.ink, 0)} 0%, ${withAlpha(nocturne.ink, 0.75)} 60%, ${nocturne.ink} 100%)`,
  },
  headWrap: { marginTop: -120, paddingHorizontal: shape.space.screen, minHeight: 120 },
  kicker: { ...type.caption, color: nocturne.textSub },
  title: { ...type.display, color: nocturne.text },
  meta: { ...type.sub, color: nocturne.textMute },
  message: { ...type.body, color: nocturne.textSub },
  bodyWrap: { paddingHorizontal: shape.space.screen, paddingTop: 28, gap: 28 },
  sectionKicker: { ...type.kicker, color: nocturne.textMute },
  back: { position: 'absolute', left: 18 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.ink, 0.45),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.14),
  },
  backArrow: { fontFamily: fontFamily.regular, fontSize: 17, color: nocturne.text },
})
