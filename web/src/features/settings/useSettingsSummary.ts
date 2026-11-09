/**
 * H01 · H02 설정 목록 오른쪽 값에 쓰는 읽기 모음(RN `useSettingsSummary`의 웹판) - 내 이름 · 로그인 방식 · 성격 영문 라벨 · 연인 이름. 읽기만 한다.
 * 실패한 값은 null로 두고 줄은 그대로 둔다(빈 값으로 보일 뿐 갈 곳은 있다).
 *
 * B14: 값이 다 읽히기 전(`loaded` = false)에는 오른쪽 값 자리에 뼈대를 둔다 - 값이 늦게 채워지지 않게. 하위 화면에서 고치고 돌아오면(탭이 다시 그려짐)
 * 직전 값을 먼저 보이고 조용히 다시 읽는다(뼈대로 되돌리지 않는다). 직전 값은 같은 사용자일 때만 쓴다.
 */
import { useEffect, useState } from 'react'
import type { EnneagramCore } from '@/constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '@/constants/loveTypeLabels'
import { computeLoveTypeCode } from '@/engine/loveTypeInference'
import { fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { fetchPersonalityProfile } from './settingsData'

export interface SettingsSummary {
  loaded: boolean
  displayName: string | null
  /** 로그인 방식(`kakao` 등 원문). 글자는 `socialProviderLabel`이 만든다. */
  provider: string | null
  /** 성격 프로필의 영문 라벨(예: KEELEMBER). 아직 없으면 null. */
  loveTypeLabelEn: string | null
  partnerName: string | null
}

const EMPTY: SettingsSummary = { loaded: false, displayName: null, provider: null, loveTypeLabelEn: null, partnerName: null }

let lastSummary: { userId: string; partnerId: string | null; value: SettingsSummary } | null = null

/** 시험이 직전 값을 비운다. */
export function resetSettingsSummaryCache(): void {
  lastSummary = null
}

export function useSettingsSummary(userId: string | null, partnerId: string | null): SettingsSummary {
  const cached = lastSummary && lastSummary.userId === userId ? lastSummary.value : null
  const [summary, setSummary] = useState<SettingsSummary>(cached ?? EMPTY)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    void (async () => {
      const [me, personality, partner, session] = await Promise.all([
        fetchProfile(db, userId).catch(() => null),
        fetchPersonalityProfile(db, userId).catch(() => null),
        partnerId ? fetchProfile(db, partnerId).catch(() => null) : Promise.resolve(null),
        db.auth.getSession().then((r) => r.data.session).catch(() => null),
      ])
      if (cancelled) return
      // 실효 코어 기준으로 다시 계산한다(R40-4) - 옛 행에 저장된 코드가 어긋나 있어도 화면은 결과와 같다.
      const code = personality
        ? computeLoveTypeCode((personality.enneagram_effective ?? personality.enneagram_inferred) as EnneagramCore, personality.attachment)
        : null
      const label = code ? LOVE_TYPE_LABEL_BY_CODE[code] : undefined
      const value: SettingsSummary = {
        loaded: true,
        displayName: me?.display_name ?? null,
        provider: (session?.user.app_metadata?.provider as string | undefined) ?? null,
        loveTypeLabelEn: label?.labelEn ?? null,
        partnerName: partner?.display_name ?? null,
      }
      lastSummary = { userId, partnerId, value }
      setSummary(value)
    })()
    return () => { cancelled = true }
  }, [userId, partnerId])

  return summary
}
