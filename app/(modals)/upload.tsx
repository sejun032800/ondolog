/**
 * E11 데이트 기록 쓰기 · E10 사진 직접 추가 - 시트(손잡이 + ✕, R18-2). docs/design/nocturne `N-E11-Date-Write`, `N-S-E2-Feed` E10.
 *
 * - `?dateId=`가 없으면 E11: 사진(여러 장) · 날짜 · 시간 · 장소 · 메모 -> "기록 남기기".
 * - `?dateId=`가 있으면 E10: 그 데이트에 사진만 더한다(날짜 고정, 장소·메모 없음).
 * - 사진은 시스템 선택 화면(`expo-image-picker`)에서 고른다. 라이브러리 스캔·얼굴 인식은 없다(R13-2).
 * - 날짜 기본값은 사진 중 가장 이른 촬영 시각의 날짜(KST), 없으면 오늘. 유저가 바꾸면 더는 덮어쓰지 않는다(규칙 2).
 * - 시간 칸은 사진 촬영 시각의 폭을 보여 줄 뿐이다. 장소별 도착 시각은 장소 칸에서(또는 E15에서) 넣는다.
 * - stop 도착 시각은 늘 실제 시각이다(R30-2): 첫 장소는 비우면 가장 이른 촬영 시각, 둘째부터는 필수, 사진도 시각도 없으면 필수.
 *   정할 수 없으면 이유를 글로 적고 기록 버튼을 비활성으로 둔다(`planStops`).
 * - 메모는 데이트 단위다. 기록할 커플 행이 없으면(규칙 6) 기록 버튼은 비활성이고 이유를 글로 적는다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GhostButton, PrimaryButton } from '../../src/components/nocturne/Buttons'
import { SheetHeader } from '../../src/components/nocturne/ExitHeader'
import { ListGroup, ListRow } from '../../src/components/nocturne/ListGroup'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { useRecordingCouple } from '../../src/hooks/useRecordingCouple'
import { useSession } from '../../src/hooks/useSession'
import { fetchDate, recordDate, type DateRow } from '../../src/services/dateRecordApi'
import { pickPhotos, readLocalBytes } from '../../src/services/photoPicker'
import { supabase } from '../../src/services/supabase'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../src/theme/nocturne'
import { generateUuidV4 } from '../../src/utils/uuid'
import {
  defaultDateOn,
  formatClockInput,
  formatDateDotted,
  formatDateInput,
  earliestCaptureOn,
  isValidDateOn,
  kstTimeOf,
  planStops,
  stopTimeErrorMessage,
  timeRangeLabel,
  todayKst,
  type PickedPhoto,
  type PlaceInput,
} from '../../src/utils/dateRecord'

function first(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value
  return v && v.length > 0 ? v : null
}

function placesLabel(places: readonly PlaceInput[]): string {
  const names = places.map((p) => p.name.trim()).filter((n) => n.length > 0)
  if (names.length === 0) return '정하지 않았어요'
  return names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}곳`
}

type Panel = null | 'date' | 'places'

export default function UploadSheet() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ dateId?: string }>()
  const addToDateId = first(params.dateId)
  const addMode = addToDateId !== null

  const { session } = useSession()
  const userId = session?.user.id ?? null
  const recording = useRecordingCouple(userId)

  const [existing, setExisting] = useState<DateRow | null>(null)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [dateOn, setDateOn] = useState<string>(() => todayKst(new Date()))
  const [dateTouched, setDateTouched] = useState(false)
  const [places, setPlaces] = useState<PlaceInput[]>([])
  const [memo, setMemo] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [dateText, setDateText] = useState('')
  const [saving, setSaving] = useState(false)

  // E10 - 이미 있는 데이트를 읽어 날짜와 커플을 고정한다.
  useEffect(() => {
    if (!addToDateId) return
    let alive = true
    fetchDate(supabase, addToDateId)
      .then((row) => {
        if (alive && row) {
          setExisting(row)
          setDateOn(row.date_on)
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [addToDateId])

  // 규칙 2 - 날짜 기본값은 사진 중 가장 이른 촬영 시각의 날짜. 유저가 바꾸기 전까지만 따라간다.
  const exifDate = useMemo(() => defaultDateOn(photos.map((p) => p.capturedAt), new Date()), [photos])
  useEffect(() => {
    if (!addMode && !dateTouched) setDateOn(exifDate)
  }, [addMode, dateTouched, exifDate])

  const hasExif = photos.some((p) => p.capturedAt !== null)
  const coupleId = existing?.couple_id ?? recording.couple?.id ?? null
  const timeValue = timeRangeLabel(
    photos.map((p) => p.capturedAt),
    dateOn,
  )

  const tile = Math.floor((width - 48 - 24) / 4)

  const addPhotos = async () => {
    try {
      const picked = await pickPhotos()
      if (picked.length === 0) return
      setPhotos((prev) => {
        const known = new Set(prev.map((p) => p.uri))
        return [...prev, ...picked.filter((p) => !known.has(p.uri))]
      })
    } catch (e) {
      Alert.alert('사진을 고르지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요')
    }
  }

  const updatePlace = (index: number, patch: Partial<PlaceInput>) =>
    setPlaces((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const capturedAts = useMemo(() => photos.map((p) => p.capturedAt), [photos])
  const stopPlan = useMemo(() => (addMode ? null : planStops(places, dateOn, capturedAts)), [addMode, places, dateOn, capturedAts])
  const stopError = stopPlan !== null && !stopPlan.ok ? stopTimeErrorMessage(stopPlan.error) : null
  const earliestClock = (() => {
    const iso = earliestCaptureOn(capturedAts, dateOn)
    return iso ? kstTimeOf(iso) : null
  })()
  const hasContent = photos.length > 0 || (!addMode && memo.trim().length > 0)
  const canSave = hasContent && coupleId !== null && userId !== null && isValidDateOn(dateOn) && stopError === null && !saving

  const save = async () => {
    if (!canSave || !coupleId || !userId) return
    setSaving(true)
    try {
      const result = await recordDate(
        supabase,
        { readBytes: readLocalBytes, newId: generateUuidV4 },
        {
          coupleId,
          userId,
          dateOn,
          places: addMode ? [] : places,
          photos,
          memo: addMode ? '' : memo,
        },
      )
      if (result.failedPhotos > 0) {
        Alert.alert('일부 사진은 올리지 못했어요', `${result.failedPhotos}장은 올라가지 않았어요. 다시 올려 주세요`)
      }
      router.back()
    } catch (e) {
      Alert.alert('기록하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const confirmDate = () => {
    if (!isValidDateOn(dateText)) return
    setDateOn(dateText)
    setDateTouched(true)
    setPanel(null)
  }

  const noCouple = !recording.loading && !addMode && recording.couple === null

  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 12 }}>
          <SheetHeader title={addMode ? '사진 더하기' : '데이트 기록'} onClose={() => router.back()} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={{ gap: 12 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.kicker}>PHOTOS</Text>
              <Text style={styles.count} testID="photo-count">
                {photos.length > 0 ? `${photos.length}장 골랐어요` : '사진을 골라 주세요'}
              </Text>
            </View>
            <View style={styles.grid}>
              {photos.map((p) => (
                <PressScale
                  key={p.uri}
                  onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}
                  accessibilityLabel="이 사진 빼기"
                  style={[styles.thumb, { width: tile, height: tile }]}
                >
                  <Image source={{ uri: p.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
                  <View style={styles.thumbX}>
                    <Text style={styles.thumbXMark}>{'✕'}</Text>
                  </View>
                </PressScale>
              ))}
              <PressScale
                onPress={addPhotos}
                accessibilityLabel="사진 더 고르기"
                testID="pick-photos"
                style={[styles.thumb, styles.addTile, { width: tile, height: tile }]}
              >
                <Text style={styles.plus}>+</Text>
              </PressScale>
            </View>
            {!addMode && photos.length > 0 ? (
              <Text style={styles.caption}>
                {hasExif && !dateTouched ? '사진의 촬영 시각으로 날짜를 먼저 채웠어요' : hasExif ? '' : '촬영 시각이 없어 오늘 날짜로 채웠어요'}
              </Text>
            ) : null}
          </View>

          <ListGroup>
            <ListRow
              label="날짜"
              value={formatDateDotted(dateOn)}
              onPress={
                addMode
                  ? undefined
                  : () => {
                      setDateText(dateOn)
                      setPanel(panel === 'date' ? null : 'date')
                    }
              }
              testID="row-date"
            />
            <ListRow label="시간" value={timeValue ?? (photos.length > 0 ? '사진에 시각이 없어요' : '사진을 고르면 채워져요')} />
            {addMode ? null : (
              <ListRow
                label="장소"
                value={placesLabel(places)}
                onPress={() => {
                  if (places.length === 0) setPlaces([{ name: '', arrivalClock: '' }])
                  setPanel(panel === 'places' ? null : 'places')
                }}
                testID="row-places"
              />
            )}
          </ListGroup>

          {panel === 'date' && !addMode ? (
            <View style={styles.panel}>
              <TextInput
                value={dateText}
                onChangeText={(v) => setDateText(formatDateInput(v))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={nocturne.textMute}
                keyboardType="number-pad"
                maxLength={10}
                accessibilityLabel="날짜"
                style={styles.input}
                testID="date-input"
              />
              <GhostButton label="날짜 정하기" onPress={confirmDate} disabled={!isValidDateOn(dateText)} />
            </View>
          ) : null}

          {panel === 'places' && !addMode ? (
            <View style={styles.panel} testID="places-panel">
              {places.map((p, i) => (
                <View key={i} style={styles.placeRow}>
                  <TextInput
                    value={p.name}
                    onChangeText={(v) => updatePlace(i, { name: v })}
                    placeholder="장소 이름"
                    placeholderTextColor={nocturne.textMute}
                    accessibilityLabel={`장소 ${i + 1} 이름`}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    value={p.arrivalClock ?? ''}
                    onChangeText={(v) => updatePlace(i, { arrivalClock: formatClockInput(v) })}
                    placeholder={i === 0 ? (earliestClock ?? '14:20') : '14:20'}
                    placeholderTextColor={nocturne.textMute}
                    keyboardType="number-pad"
                    maxLength={5}
                    accessibilityLabel={`장소 ${i + 1} 도착 시각`}
                    style={[styles.input, styles.clockInput]}
                  />
                  <PressScale
                    onPress={() => setPlaces((prev) => prev.filter((_, k) => k !== i))}
                    accessibilityLabel={`장소 ${i + 1} 빼기`}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeMark}>{'✕'}</Text>
                  </PressScale>
                </View>
              ))}
              <Text style={styles.caption}>
                첫 장소는 도착 시각을 비우면 사진의 가장 이른 촬영 시각이 돼요. 둘째 장소부터는 도착 시각이 필요해요. 사진은 촬영 시각에 가장 가까운 앞선 장소에 붙어요
              </Text>
              <GhostButton label="장소 더하기" onPress={() => setPlaces((prev) => [...prev, { name: '', arrivalClock: '' }])} />
            </View>
          ) : null}

          {addMode ? null : (
            <View style={{ gap: 12 }}>
              <Text style={styles.kicker}>MEMO</Text>
              <TextInput
                value={memo}
                onChangeText={setMemo}
                placeholder="그날 남기고 싶은 말"
                placeholderTextColor={nocturne.textMute}
                multiline
                textAlignVertical="top"
                accessibilityLabel="메모"
                style={styles.memo}
                testID="memo-input"
              />
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          {noCouple ? <Text style={styles.caption} testID="no-couple-note">초대 코드를 만들면 기록할 수 있어요</Text> : null}
          {hasContent && stopError !== null ? (
            <Text style={styles.caption} testID="stop-time-error">{stopError}</Text>
          ) : null}
          <PrimaryButton
            label={saving ? '남기는 중이에요' : addMode ? '사진 더하기' : '기록 남기기'}
            onPress={save}
            disabled={!canSave}
            testID="record-save"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 24 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  kicker: { ...type.kicker, color: nocturne.textMute },
  count: { ...type.caption, color: nocturne.textMute },
  caption: { ...type.caption, fontFamily: fontFamily.regular, color: nocturne.textMute },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { borderRadius: 14, overflow: 'hidden', backgroundColor: nocturne.inkRaise2 },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.text, 0.05),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(nocturne.text, 0.22),
  },
  plus: { fontFamily: fontFamily.regular, fontSize: 22, color: nocturne.textSub },
  thumbX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.ink, 0.6),
  },
  thumbXMark: { fontFamily: fontFamily.regular, fontSize: 10, color: nocturne.text },
  panel: { gap: 12 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 50,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: nocturne.hairline,
    paddingHorizontal: 18,
    color: nocturne.text,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  clockInput: { width: 84, paddingHorizontal: 12, textAlign: 'center' },
  removeBtn: { width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  removeMark: { fontFamily: fontFamily.regular, fontSize: 14, color: nocturne.textSub },
  // 두 사람의 원문 입력: MaruBuri + textSub
  memo: {
    minHeight: 132,
    borderRadius: 22,
    backgroundColor: nocturne.inkRaise,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.08),
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: nocturne.textSub,
    fontFamily: fontFamily.serif,
    fontSize: 16.5,
    lineHeight: 29,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
})
