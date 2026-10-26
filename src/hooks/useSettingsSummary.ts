/**
 * H01 · H02 설정 목록 오른쪽 값에 쓰는 읽기 모음 - 내 이름 · 성격 프로필 라벨 · 연인 이름. 읽기만 한다.
 * 화면이 다시 보일 때마다(하위 화면에서 고치고 돌아온 뒤) 다시 읽는다. 실패한 값은 null로 두고 행은 그대로 둔다(빈 값으로 보일 뿐 갈 곳은 있다).
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import type { EnneagramCore } from '../constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '../constants/loveTypeLabels'
import { computeLoveTypeCode } from '../engine/loveTypeInference'
import { fetchPersonalityProfile, fetchProfile } from '../services/personalityApi'

export interface SettingsSummary {
  displayName: string | null
  /** 성격 프로필의 영문 라벨(예: KEELEMBER). 아직 없으면 null. */
  loveTypeLabelEn: string | null
  partnerName: string | null
}

const EMPTY: SettingsSummary = { displayName: null, loveTypeLabelEn: null, partnerName: null }

export function useSettingsSummary(userId: string | null, partnerId: string | null): SettingsSummary {
  const [summary, setSummary] = useState<SettingsSummary>(EMPTY)

  useFocusEffect(
    useCallback(() => {
      if (!userId) return
      let cancelled = false
      void (async () => {
        const [me, personality, partner] = await Promise.all([
          fetchProfile(userId).catch(() => null),
          fetchPersonalityProfile(userId).catch(() => null),
          partnerId ? fetchProfile(partnerId).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return
        // 실효 코어 기준으로 다시 계산한다(R40-4) - 옛 행에 저장된 코드가 어긋나 있어도 화면은 결과와 같다.
        const code = personality
          ? computeLoveTypeCode((personality.enneagram_effective ?? personality.enneagram_inferred) as EnneagramCore, personality.attachment)
          : null
        const label = code ? LOVE_TYPE_LABEL_BY_CODE[code] : undefined
        setSummary({
          displayName: me?.display_name ?? null,
          loveTypeLabelEn: label?.labelEn ?? null,
          partnerName: partner?.display_name ?? null,
        })
      })()
      return () => {
        cancelled = true
      }
    }, [userId, partnerId]),
  )

  return summary
}
