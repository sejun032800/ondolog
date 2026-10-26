/**
 * H03 프로필 - 설정 > 프로필 · 연결된 계정. 디자인 `N-S-H1-Settings`(H03). 푸시 화면(R18-2).
 *
 * 고칠 수 있는 것은 **이름(1~20자)과 성별**뿐이다(R42-7, 보드에 성별이 있다). 쓰는 칸은 `profiles.display_name` · `profiles.gender` 둘이다.
 * **생년월일은 읽기 전용**이다 - 가입 때 만 14세 확인을 거친 값이라 입력도 쓰기 호출도 없다. 연결된 소셜 계정은 읽기로 보여 준다.
 * [로그아웃]은 메모리 스토어를 비우고 세션을 끝낸다. 기기에 저장된 채팅 큐는 지우지 않는다(R39-5 b, `performLogout`).
 *
 * 보드에서 뺀 것(지시서 범위 밖): 프로필 사진 "사진 바꾸기"(프로필 사진 칸 없음), [회원 탈퇴](`68-`).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { ListGroup, ListRow } from '../src/components/nocturne/ListGroup'
import { PressScale } from '../src/components/nocturne/PressScale'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SettingsScreen } from '../src/components/settings/SettingsScreen'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { performLogout, updateProfileBasics } from '../src/services/settingsApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useProfileStore } from '../src/store/profileStore'
import { fontFamily, nocturne, shape, type } from '../src/theme/nocturne'
import { dotDate, DISPLAY_NAME_MAX, GENDER_OPTIONS, isValidDisplayName, socialProviderLabel } from '../src/utils/settingsRules'
import type { Database } from '../src/types/database'

type Gender = Database['public']['Enums']['gender_type']

const COPY = {
  title: '프로필',
  save: '저장',
  nameLabel: '이름',
  genderLabel: '성별',
  birthLabel: '생년월일',
  socialLabel: '연결된 계정',
  logout: '로그아웃',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  nameInvalid: `이름은 1자 이상 ${DISPLAY_NAME_MAX}자 이하로 써주세요`,
} as const

export default function SettingsProfileScreen() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const resetCouple = useCoupleStore((s) => s.reset)
  const resetProfile = useProfileStore((s) => s.reset)

  const [loaded, setLoaded] = useState<{ name: string; gender: Gender; birthDate: string } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/')
  }, [sessionLoading, session, router])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await fetchProfile(userId)
        if (cancelled) return
        if (!row) {
          setLoadError(true)
          return
        }
        setLoaded({ name: row.display_name, gender: row.gender, birthDate: row.birth_date })
        setName(row.display_name)
        setGender(row.gender)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!session) return <ScreenFrame />

  const provider = socialProviderLabel(session.user.app_metadata?.provider as string | undefined)
  const nameOk = isValidDisplayName(name)
  const changed = loaded !== null && (name.trim() !== loaded.name || gender !== loaded.gender)
  const canSave = loaded !== null && nameOk && changed && !busy

  const save = async () => {
    if (!userId || !canSave) return
    setBusy(true)
    setError(null)
    try {
      await updateProfileBasics(userId, { displayName: name, gender })
      router.back()
    } catch {
      setError(COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    try {
      await performLogout(() => {
        resetCouple()
        resetProfile()
      })
    } finally {
      router.replace('/')
    }
  }

  return (
    <SettingsScreen
      title={COPY.title}
      onBack={() => router.back()}
      action={{ label: COPY.save, onPress: save, disabled: !canSave, testID: 'profile-save' }}
    >
      {loadError ? (
        <Text style={styles.note} accessibilityRole="alert" testID="profile-load-error">
          {COPY.loadFailed}
        </Text>
      ) : null}

      <View style={styles.group}>
        <Text style={styles.label}>{COPY.nameLabel}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={DISPLAY_NAME_MAX}
          editable={loaded !== null}
          selectionColor={nocturne.lilac}
          style={styles.input}
          accessibilityLabel={COPY.nameLabel}
          testID="profile-name-input"
        />
        {loaded !== null && !nameOk ? (
          <Text style={styles.note} testID="profile-name-hint">
            {COPY.nameInvalid}
          </Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{COPY.genderLabel}</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => {
            const selected = gender === opt.key
            return (
              <PressScale
                key={opt.key}
                onPress={() => setGender(opt.key)}
                disabled={loaded === null}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected }}
                testID={`profile-gender-${opt.key}`}
                style={[styles.gender, selected ? styles.genderOn : styles.genderOff]}
              >
                <Text style={[styles.genderLabel, selected ? styles.genderLabelOn : styles.genderLabelOff]}>
                  {opt.label}
                </Text>
              </PressScale>
            )
          })}
        </View>
      </View>

      {/* 읽기 전용 줄 - 누를 수 없고 입력도 없다(R42-7). */}
      <ListGroup>
        <ListRow label={COPY.birthLabel} value={loaded ? dotDate(loaded.birthDate) : ''} testID="profile-birth-row" />
        <ListRow label={COPY.socialLabel} value={provider} testID="profile-social-row" />
      </ListGroup>

      <ListGroup>
        <ListRow label={COPY.logout} onPress={logout} testID="profile-logout" />
      </ListGroup>

      {error ? (
        <Text style={styles.note} accessibilityRole="alert" testID="profile-error">
          {error}
        </Text>
      ) : null}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  label: { ...type.sub, color: nocturne.textMute },
  input: {
    ...type.body,
    fontSize: 17,
    height: 56,
    borderRadius: shape.radius.button,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
    color: nocturne.text,
    paddingHorizontal: 18,
  },
  genderRow: { flexDirection: 'row', gap: 10 },
  gender: { flex: 1, height: 56, borderRadius: shape.radius.button, alignItems: 'center', justifyContent: 'center' },
  genderOn: { backgroundColor: nocturne.text },
  genderOff: { backgroundColor: nocturne.inkRaise, borderWidth: 1, borderColor: nocturne.hairline },
  genderLabel: { fontSize: 16 },
  genderLabelOn: { fontFamily: fontFamily.semiBold, color: nocturne.ink },
  genderLabelOff: { fontFamily: fontFamily.medium, color: nocturne.textSub },
  note: { ...type.sub, color: nocturne.textSub },
})
