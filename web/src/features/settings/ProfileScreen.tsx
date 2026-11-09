/**
 * H03 프로필 - 설정 > 프로필 · 연결된 계정. 보드 `N-S-H1-Settings`(H03). RN `app/settings-profile.tsx`의 웹판. 푸시 화면.
 *
 * 고칠 수 있는 것은 **이름(1~20자)과 성별**뿐이다(R42-7). 쓰는 칸은 `profiles.display_name` · `profiles.gender` 둘(`@/services/settingsCore.updateProfileBasics`).
 * **생년월일은 읽기 전용**이다 - 가입 때 만 14세 확인을 거친 값이라 입력도 쓰기 호출도 없다. 연결된 소셜 계정은 읽기로 보여 준다.
 * [로그아웃]은 메모리를 비우고 세션(Preferences)을 지운 뒤 첫 화면으로 간다. 기기에 저장된 채팅 큐는 지우지 않는다(R39-5 b).
 * 보드에서 뺀 것: 프로필 사진 "사진 바꾸기"(프로필 사진 칸이 없다 - 지시서 범위 밖).
 * B14: 불러오는 동안은 I03 뼈대(빈 화면 뒤에 카드가 나타나지 않는다). B9: 이름 칸은 스크롤 본문 안에 있어 키보드 위로 올라온다.
 */
import { useEffect, useState } from 'react'
import { updateProfileBasics } from '@/services/settingsCore'
import { DISPLAY_NAME_MAX, GENDER_OPTIONS, dotDate, isValidDisplayName, socialProviderLabel } from '@/utils/settingsRules'
import type { Database } from '@/types/database'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { useProfileStore } from '../../stores/profileStore'
import { logoutToStart } from './accountActions'
import { ListGroup, ListRow, SettingsFrame, SettingsSkeletonBlock } from './parts'

type Gender = Database['public']['Enums']['gender_type']

export const PROFILE_COPY = {
  title: '프로필',
  save: '저장',
  nameLabel: '이름',
  genderLabel: '성별',
  birthLabel: '생년월일',
  socialLabel: '연결된 계정',
  logout: '로그아웃',
  withdraw: '회원 탈퇴',
  saveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  nameInvalid: `이름은 1자 이상 ${DISPLAY_NAME_MAX}자 이하로 써주세요`,
} as const

export function ProfileScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const [loaded, setLoaded] = useState<{ name: string; gender: Gender; birthDate: string; provider: string | null } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    void (async () => {
      try {
        const [row, session] = await Promise.all([fetchProfile(db, userId), db.auth.getSession().then((r) => r.data.session).catch(() => null)])
        if (cancelled) return
        if (!row) { setLoadError(true); return }
        setLoaded({ name: row.display_name, gender: row.gender, birthDate: row.birth_date, provider: (session?.user.app_metadata?.provider as string | undefined) ?? null })
        setName(row.display_name)
        setGender(row.gender)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const nameOk = isValidDisplayName(name)
  const changed = loaded !== null && (name.trim() !== loaded.name || gender !== loaded.gender)
  const canSave = loaded !== null && nameOk && changed && !busy

  const save = async () => {
    const db = getSupabase()
    if (!userId || !db || !canSave) return
    setBusy(true)
    setError(null)
    try {
      await updateProfileBasics(db, userId, { displayName: name, gender })
      void useProfileStore.getState().refresh(userId)
      nav.back()
    } catch {
      setError(PROFILE_COPY.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsFrame
      title={PROFILE_COPY.title}
      onBack={nav.back}
      action={{ label: PROFILE_COPY.save, onPress: () => void save(), disabled: !canSave, testId: 'profile-save' }}
      testId="settings-profile"
    >
      {loadError ? <p className="t-sub c-sub" role="alert" data-testid="profile-load-error">{PROFILE_COPY.loadFailed}</p> : null}
      {!loaded && !loadError ? <SettingsSkeletonBlock rows={4} /> : null}

      {loaded ? (
        <>
          <div className="fieldGroup">
            <label className="t-sub c-mute" htmlFor="profile-name">{PROFILE_COPY.nameLabel}</label>
            <input
              id="profile-name"
              className="setInput"
              value={name}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              data-testid="profile-name-input"
            />
            {!nameOk ? <p className="t-sub c-mute" data-testid="profile-name-hint">{PROFILE_COPY.nameInvalid}</p> : null}
          </div>

          <div className="fieldGroup">
            <span className="t-sub c-mute">{PROFILE_COPY.genderLabel}</span>
            <div className="seg" role="radiogroup" aria-label={PROFILE_COPY.genderLabel}>
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={gender === opt.key}
                  className={`press ${gender === opt.key ? 'on' : ''}`}
                  onClick={() => setGender(opt.key)}
                  data-testid={`profile-gender-${opt.key}`}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* 읽기 전용 줄 - 누를 수 없고 입력도 없다(R42-7). */}
          <ListGroup>
            <ListRow label={PROFILE_COPY.birthLabel} value={dotDate(loaded.birthDate)} testId="profile-birth-row" />
            <ListRow label={PROFILE_COPY.socialLabel} value={socialProviderLabel(loaded.provider)} testId="profile-social-row" />
          </ListGroup>
        </>
      ) : null}

      {/* 읽기에 실패해도 로그아웃 · 탈퇴 길은 늘 열려 있다. */}
      <ListGroup>
        <ListRow label={PROFILE_COPY.logout} onPress={() => void logoutToStart(nav)} testId="profile-logout" />
        <ListRow label={PROFILE_COPY.withdraw} onPress={() => nav.push('settings-withdraw')} testId="profile-withdraw" />
      </ListGroup>

      {error ? <p className="t-sub c-sub" role="alert" data-testid="profile-error">{error}</p> : null}
    </SettingsFrame>
  )
}
