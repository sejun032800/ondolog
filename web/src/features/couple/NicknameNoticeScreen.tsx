/**
 * R101-5 닉네임 변경 안내(스택 `nickname-recheck`) - F1 재표시(A20 `start-date-recheck`)와 같은 모양: 제목 "{상대}님이 커플 닉네임을 바꿨어요"(R99-1 "님이")
 * + 둘째 줄 새 닉네임(값 뒤 조사 0). [확인했어요] -> 메인. 서버에 쓰는 것은 없다(본 표시는 기기에 - `useNicknameNotice`).
 * 지금 연결된 커플에 상대가 바꾼 닉네임이 없으면(그사이 내가 다시 바꿈 등) 바로 메인.
 */
import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '../../auth/client'
import { fetchProfile } from '../../auth/finalize'
import { useAuthStore } from '../../auth/stores'
import { readCache } from '../../cache/deviceCache'
import { fetchMyActiveCouple } from '../../couple/coupleApi'
import { needsNicknameNotice } from '../../couple/useNicknameNotice'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { OnboardingScreen, PrimaryButton } from '../../ui'

export const NICKNAME_NOTICE_COPY = {
  changed: (name: string) => `${name}님이 커플 닉네임을 바꿨어요`,
  confirm: '확인했어요',
} as const

export function NicknameNoticeScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const [nickname, setNickname] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState(() => {
    const pid = useCoupleStore.getState().partnerId
    return (pid ? readCache<{ name: string }>(useAuthStore.getState().userId, 'name', pid)?.name : null) ?? '상대'
  })
  const navRef = useRef(nav)
  navRef.current = nav

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) { navRef.current.reset('main'); return }
    let cancelled = false
    ;(async () => {
      try {
        const row = (await fetchMyActiveCouple(db, userId)) as unknown as { id: string; nickname: string | null; nickname_changed_by?: string | null; user_a_id: string; user_b_id: string | null } | null
        if (cancelled) return
        if (!row || !needsNicknameNotice(row, userId)) { navRef.current.reset('main'); return }
        setNickname(row.nickname)
        const pid = row.user_a_id === userId ? row.user_b_id : row.user_a_id
        if (pid) {
          const p = await fetchProfile(db, pid).catch(() => null)
          if (!cancelled && p?.display_name) setPartnerName(p.display_name)
        }
      } catch {
        if (!cancelled) navRef.current.reset('main')
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  if (!nickname) return <div className="screen solid" />

  const done = async () => {
    if (userId) await useCoupleStore.getState().refresh(userId).catch(() => undefined)
    navRef.current.reset('main')
  }
  return (
    <OnboardingScreen
      animKey="nickname-recheck"
      title={NICKNAME_NOTICE_COPY.changed(partnerName)}
      subtitle={nickname}
      footer={<PrimaryButton label={NICKNAME_NOTICE_COPY.confirm} onClick={() => void done()} />}
    />
  )
}
