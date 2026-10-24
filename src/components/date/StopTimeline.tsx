/**
 * E03 stop별 타임라인 - 시각 · 점과 선 · 장소 · 사진 · (메모는 데이트 단위라 화면 위쪽 블록에 있다).
 *
 * - 시각은 유저가 말한 도착 시각일 때만 그린다. "모름" 표지 값(그 날짜 00:00)이면 그리지 않는다 -
 *   실제와 다른 시각이 보이지 않는다(`stopTimeLabel`).
 * - 장소 이름이 없으면 이름을 더하라는 글을 보인다(앱이 이름을 지어내지 않는다).
 * - 사진 배치는 호출부가 규칙 4(`assignStop`)로 계산해 넘긴다.
 */
import { Image, StyleSheet, Text, View } from 'react-native'
import type { DetailStop } from '../../hooks/useDateDetail'
import { stopTimeLabel } from '../../utils/dateRecord'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export interface StopTimelineProps {
  dateOn: string
  stops: readonly DetailStop[]
  /** 사진 경로 -> 서명 URL */
  urls: Record<string, string>
  onEditStop: (stopId: string) => void
}

function StopPhotos({ photos, urls }: { photos: DetailStop['photos']; urls: Record<string, string> }) {
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
          </View>
        )
      })}
    </View>
  )
}

export function StopTimeline({ dateOn, stops, urls, onEditStop }: StopTimelineProps) {
  return (
    <View testID="stop-timeline">
      {stops.map((stop) => {
        const time = stopTimeLabel(stop.arrived_at, dateOn)
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
              <StopPhotos photos={stop.photos} urls={urls} />
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
})
