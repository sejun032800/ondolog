/**
 * E03 데이트 상세 - 푸시 화면(왼쪽 위 ←, R18-2). docs/design/nocturne `N-E03-Date-Detail`.
 *
 * - 머리: 날짜 말로 · 지역(있을 때) · 제목 · "14:20-20:05 · 사진 N · 메모 N".
 *   `dates.title`은 생성 단계가 쓰는 값이라 앱이 지어내지 않는다 - 비어 있으면 날짜와 지역으로 머리를 만든다.
 * - stop별 타임라인: 시각(유저가 말한 시각일 때만) · 장소 · 사진. 사진 배치는 규칙 4로 다시 계산한다.
 * - 메모는 데이트 단위다(규칙 5). E15에 장소별 메모 칸이 없어 stop에 붙이지 않고, 머리 아래 한 블록에 둔다.
 * - 사진 더하기 -> E10(`/upload?dateId=`). 장소 고치기 -> E15.
 * - 본인 기록 삭제(R30-1): **내가 올린** 사진·메모에만 "지우기"가 보인다(상대의 것에는 없다). 누르면 되돌릴 수 없는 확인(I05)을 거쳐
 *   `fn_delete_own_entry` RPC만 부른다. 이미 발행된 호는 지워지지 않는다. 답변 후 다시 읽어 화면에서 사라진다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StopTimeline } from '../../../src/components/date/StopTimeline'
import { ConfirmDialog } from '../../../src/components/nocturne/ConfirmDialog'
import { GhostButton } from '../../../src/components/nocturne/Buttons'
import { PressScale } from '../../../src/components/nocturne/PressScale'
import { QuoteText } from '../../../src/components/nocturne/QuoteText'
import { ScreenFrame } from '../../../src/components/nocturne/ScreenFrame'
import { Skeleton } from '../../../src/components/nocturne/Skeleton'
import { useDateDetail } from '../../../src/hooks/useDateDetail'
import { useSession } from '../../../src/hooks/useSession'
import { canDeleteEntry, deleteOwnEntry } from '../../../src/services/dateRecordApi'
import { supabase } from '../../../src/services/supabase'
import { buildDateHead } from '../../../src/utils/dateRecord'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../../src/theme/nocturne'

const HERO_HEIGHT = 420

export default function DateDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id: string }>()
  const dateId = Array.isArray(params.id) ? params.id[0] : params.id
  const { session } = useSession()
  const viewerId = session?.user.id ?? null
  const detail = useDateDetail(dateId, viewerId)
  const [pending, setPending] = useState<{ id: string; kind: 'photo' | 'memo' } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!pending || deleting) return
    setDeleting(true)
    try {
      await deleteOwnEntry(supabase, pending.id)
      setPending(null)
      await detail.reload()
    } catch (e) {
      setPending(null)
      Alert.alert('지우지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요')
    } finally {
      setDeleting(false)
    }
  }

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
                  <View key={m.id} style={{ gap: 6 }}>
                    <QuoteText mark="rule" attribution={detail.names[m.author_id]}>
                      {m.text_content ?? ''}
                    </QuoteText>
                    {canDeleteEntry(m, viewerId) ? (
                      <PressScale
                        onPress={() => setPending({ id: m.id, kind: 'memo' })}
                        accessibilityLabel="내 메모 지우기"
                        testID={`delete-memo-${m.id}`}
                        hitSlop={12}
                        style={styles.deleteMemo}
                      >
                        <Text style={styles.deleteMemoLabel}>지우기</Text>
                      </PressScale>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <StopTimeline
              stops={detail.stops}
              urls={detail.urls}
              onEditStop={(stopId) => router.push(`/date/${date.id}/stop/${stopId}`)}
              viewerId={viewerId}
              onDeletePhoto={(id) => setPending({ id, kind: 'photo' })}
            />

            <GhostButton
              label="사진 더하기"
              onPress={() => router.push({ pathname: '/upload', params: { dateId: date.id } })}
              testID="detail-add-photos"
            />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={pending !== null}
        title={pending?.kind === 'memo' ? '이 메모를 지울까요?' : '이 사진을 지울까요?'}
        message={`지운 ${pending?.kind === 'memo' ? '메모는' : '사진은'} 되돌릴 수 없어요. 이미 발행된 호에서는 지워지지 않아요.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
        testID="delete-confirm"
      />

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
  deleteMemo: { alignSelf: 'flex-start', paddingLeft: 15 },
  deleteMemoLabel: { ...type.caption, color: nocturne.textMute },
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
