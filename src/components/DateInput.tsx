/**
 * 네이티브 날짜 피커 라이브러리 없이 쓰는 최소 날짜 입력.
 *
 * 화면 2(생년월일)·화면 +(사귄 날짜)가 공유한다. `@react-native-community/
 * datetimepicker` 등은 현재 package.json에 없고(Phase 3 산출물 범위 밖의
 * 신규 네이티브 의존성 추가), 값 형식(ISO 'YYYY-MM-DD')만 문서 요구사항
 * (Part 9-1 화면 2 "날짜 피커")을 충족하면 되므로 연/월/일 3칸 텍스트
 * 입력으로 구현한다.
 */
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from '../theme'

interface DateInputProps {
  value: string | null
  onChange: (isoDate: string | null) => void
  minYear?: number
  maxYear?: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

export function DateInput({
  value,
  onChange,
  minYear = 1930,
  maxYear = new Date().getFullYear(),
}: DateInputProps) {
  const [year, setYear] = useState(value?.slice(0, 4) ?? '')
  const [month, setMonth] = useState(value?.slice(5, 7) ?? '')
  const [day, setDay] = useState(value?.slice(8, 10) ?? '')

  const emit = (y: string, m: string, d: string) => {
    const yn = Number(y)
    const mn = Number(m)
    const dn = Number(d)
    if (
      y.length === 4 &&
      m.length > 0 &&
      d.length > 0 &&
      yn >= minYear &&
      yn <= maxYear &&
      isValidDate(yn, mn, dn)
    ) {
      onChange(`${y}-${pad2(mn)}-${pad2(dn)}`)
    } else {
      onChange(null)
    }
  }

  const { colors, typography, spacing, radius } = useTheme()
  const inputStyle = [
    typography.body,
    styles.input,
    { backgroundColor: colors.paperAlt, borderColor: colors.rule, borderRadius: radius.touch, color: colors.inkFull },
  ]

  return (
    <View style={[styles.row, { gap: spacing.s3 }]}>
      <View style={[styles.field, { gap: spacing.s2 }]}>
        <TextInput
          value={year}
          onChangeText={(t) => {
            const v = t.replace(/[^0-9]/g, '').slice(0, 4)
            setYear(v)
            emit(v, month, day)
          }}
          placeholder="YYYY"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          maxLength={4}
          style={inputStyle}
        />
        <Text style={[typography.caption, { color: colors.inkMute }]}>년</Text>
      </View>
      <View style={[styles.field, { gap: spacing.s2 }]}>
        <TextInput
          value={month}
          onChangeText={(t) => {
            const v = t.replace(/[^0-9]/g, '').slice(0, 2)
            setMonth(v)
            emit(year, v, day)
          }}
          placeholder="MM"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          maxLength={2}
          style={inputStyle}
        />
        <Text style={[typography.caption, { color: colors.inkMute }]}>월</Text>
      </View>
      <View style={[styles.field, { gap: spacing.s2 }]}>
        <TextInput
          value={day}
          onChangeText={(t) => {
            const v = t.replace(/[^0-9]/g, '').slice(0, 2)
            setDay(v)
            emit(year, month, v)
          }}
          placeholder="DD"
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          maxLength={2}
          style={inputStyle}
        />
        <Text style={[typography.caption, { color: colors.inkMute }]}>일</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  field: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  input: {
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
})
