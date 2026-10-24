/**
 * E15 장소 고치기 - 푸시 화면(왼쪽 위 ←, R18-2). docs/design/nocturne `N-S-E3-Feed` E15.
 *
 * 장소 이름(직접 입력)과 도착 시각만 고친다. 장소 검색·지도·"사진에 남은 위치" 제안은 없다(카카오맵은 출시 후) -
 * `place_provider_id` · `lat` · `lng`는 건드리지 않는다.
 * 디자인의 E15에는 장소별 메모 칸이 없다 - 그래서 stop에 붙는 메모도 만들지 않았다(메모는 데이트 단위, 규칙 5).
 * 도착 시각을 고치면 stop 순서와 내 사진의 배치가 규칙 4로 다시 맞춰진다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PrimaryButton } from '../../../../../src/components/nocturne/Buttons'
import { PushHeader } from '../../../../../src/components/nocturne/ExitHeader'
import { ScreenFrame } from '../../../../../src/components/nocturne/ScreenFrame'
import { useSession } from '../../../../../src/hooks/useSession'
import { fetchDate, fetchStopsOfDate, updateStop } from '../../../../../src/services/dateRecordApi'
import { supabase } from '../../../../../src/services/supabase'
import { formatClockInput, isValidClock, stopTimeLabel } from '../../../../../src/utils/dateRecord'
import { nocturne, shape, type, withAlpha } from '../../../../../src/theme/nocturne'

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export default function StopEditScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id: string; stopId: string }>()
  const dateId = first(params.id)
  const stopId = first(params.stopId)
  const { session } = useSession()

  const [dateOn, setDateOn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [clock, setClock] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [date, stops] = await Promise.all([fetchDate(supabase, dateId), fetchStopsOfDate(supabase, dateId)])
        const stop = stops.find((s) => s.id === stopId)
        if (!alive || !date || !stop) return
        setDateOn(date.date_on)
        setName(stop.place_name ?? '')
        setClock(stopTimeLabel(stop.arrived_at, date.date_on) ?? '')
        setLoaded(true)
      } catch {
        // 불러오지 못하면 저장 버튼이 꺼진 채로 남는다.
      }
    })()
    return () => {
      alive = false
    }
  }, [dateId, stopId])

  const clockOk = clock.length === 0 || isValidClock(clock)
  const canSave = loaded && clockOk && !saving && session !== null

  const save = async () => {
    if (!canSave || !dateOn || !session) return
    setSaving(true)
    try {
      await updateStop(supabase, {
        stopId,
        dateId,
        dateOn,
        userId: session.user.id,
        placeName: name,
        arrivalClock: clock.length > 0 ? clock : null,
      })
      router.back()
    } catch (e) {
      Alert.alert('장소를 고치지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenFrame>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12 }}>
          <PushHeader onBack={() => router.back()} title="장소" />
        </View>

        <View style={styles.content}>
          <View style={{ gap: 8 }}>
            <Text style={styles.kicker}>PLACE</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="장소 이름"
              placeholderTextColor={nocturne.textMute}
              accessibilityLabel="장소 이름"
              style={styles.input}
              returnKeyType="done"
              testID="stop-name-input"
            />
            <Text style={styles.caption}>찾는 곳이 없어도 이름을 직접 쓸 수 있어요</Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.kicker}>ARRIVED</Text>
            <TextInput
              value={clock}
              onChangeText={(v) => setClock(formatClockInput(v))}
              placeholder="도착 시각 (예 14:20)"
              placeholderTextColor={nocturne.textMute}
              accessibilityLabel="도착 시각"
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
              testID="stop-clock-input"
            />
            <Text style={styles.caption}>
              {clockOk
                ? '비워 두면 시각을 보이지 않아요. 시각을 바꾸면 사진이 촬영 시각에 맞춰 다시 자리를 찾아요'
                : '시각은 00:00부터 23:59 사이로 써 주세요'}
            </Text>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <PrimaryButton label={saving ? '고치는 중이에요' : '저장'} onPress={save} disabled={!canSave} testID="stop-save" />
        </View>
      </KeyboardAvoidingView>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 28 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  input: {
    height: 50,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: nocturne.hairline,
    paddingHorizontal: 18,
    color: nocturne.text,
    fontFamily: type.body.fontFamily,
    fontSize: 15,
  },
  caption: { ...type.caption, fontFamily: type.sub.fontFamily, color: nocturne.textMute },
  footer: { paddingHorizontal: 20 },
})
