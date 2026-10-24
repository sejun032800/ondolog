/**
 * E03 stop별 타임라인 - 시각 · 점과 선 · 장소 · 사진 · (메모는 데이트 단위라 화면 위쪽 블록에 있다).
 *
 * - 시각은 저장된 도착 시각을 그대로 그린다(KST `HH:MM`). stop 시각은 늘 실제 시각이라 가리는 값이 없다(R30-2) -
 *   실제 00:00이면 00:00으로 보인다.
 * - 내가 올린 사진에만 "지우기"가 보인다(`viewerId`). 상대의 사진에는 없다(R30-1).
 * - 장소 이름이 없으면 이름을 더하라는 글을 보인다(앱이 이름을 지어내지 않는다).
 * - 사진 배치는 호출부가 규칙 4(`assignStop`)로 계산해 넘긴다.
 */
import { Image, StyleSheet, Text, View } from 'react-native'
import type { DetailStop } from '../../hooks/useDateDetail'
import { canDeleteEntry } from '../../services/dateRecordApi'
import { kstTimeOf } from '../../utils/dateRecord'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export interface StopTimelineProps {
  stops: readonly DetailStop[]
  /** 사진 경로 -> 서명 URL */
  urls: Record<string, string>
  onEditStop: (stopId: string) => void
  /** 지금 보는 사람. 이 사람이 올린 사진에만 지우기가 보인다. */
  viewerId: string | null
  onDeletePhoto: (entryId: string) => void
}

function StopPhotos({
  photos,
  urls,
  viewerId,
  onDeletePhoto,
}: {
  photos: DetailStop['photos']
  urls: Record<string, string>
  viewerId: string | null
  onDeletePhoto: (entryId: string) => void
}) {
  if (photos.length === 0) return null
  const single = photos.length === 1
  return (
    <View style={styles.photos}>
      {photos.map((p) => {
        const uri = p.storage_path ? urls[p.storage_path] : undefined
        return (
          <View key={p.id} style={[styles.photoCell, single ? styles.photoSingle : styles.photoPair]}>
            {uri ? (
              <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel="사진" />
            ) : null}
            {canDeleteEntry(p, viewerId) ? (
              <PressScale
                onPress={() => onDeletePhoto(p.id)}
                accessibilityLabel="내 사진 지우기"
                testID={`delete-photo-${p.id}`}
                hitSlop={8}
                style={styles.deleteChip}
              >
                <Text style={styles.deleteLabel}>지우기</Text>
              </PressScale>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

export function StopTimeline({ stops, urls, onEditStop, viewerId, onDeletePhoto }: StopTimelineProps) {
  return (
    <View testID="stop-timeline">
      {stops.map((stop) => {
        const time = kstTimeOf(stop.arrived_at)
        return (
          <View key={stop.id} style={styles.row} testID={`stop-${stop.seq}`}>
            <Text style={styles.time}>{time ?? ''}</Text>
            <View style={styles.rail}>
              <View style={styles.dot} />
              <View style={styles.line} />
            </View>
            <View style={styles.body}>
              <PressScale
                onPress={() => onEditStop(stop.id)}
                accessibilityLabel={stop.place_name ? `${stop.place_name} 장소 고치기` : '장소 이름 더하기'}
                style={styles.nameRow}
              >
                {stop.place_name ? (
                  <Text style={styles.name}>{stop.place_name}</Text>
                ) : (
                  <Text style={styles.nameEmpty}>장소 이름 더하기</Text>
                )}
                <Text style={styles.edit}>{'고치기'}</Text>
              </PressScale>
              <StopPhotos photos={stop.photos} urls={urls} viewerId={viewerId} onDeletePhoto={onDeletePhoto} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16 },
  time: { width: 44, ...type.sub, fontFamily: fontFamily.semiBold, color: nocturne.text, paddingTop: 1 },
  rail: { width: 9, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: nocturne.text, marginTop: 7 },
  line: { flex: 1, width: 1, backgroundColor: withAlpha(nocturne.text, 0.14), marginTop: 6 },
  body: { flex: 1, gap: 12, paddingBottom: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  name: { fontFamily: fontFamily.semiBold, fontSize: 15.5, lineHeight: 22, color: nocturne.text, flexShrink: 1 },
  nameEmpty: { ...type.body, color: nocturne.textMute },
  edit: { ...type.caption, color: nocturne.textMute },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCell: { borderRadius: 16, overflow: 'hidden', backgroundColor: nocturne.inkRaise2 },
  photoPair: { width: '48%', flexGrow: 1, height: 112 },
  photoSingle: { width: '100%', height: 150 },
  deleteChip: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.ink, 0.6),
  },
  deleteLabel: { ...type.caption, color: nocturne.text },
})
