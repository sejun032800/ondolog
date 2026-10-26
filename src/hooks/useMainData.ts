/**
 * 메인 탭(U1) 데이터 훅 - 이름·온보딩 결과 요약·활동 유무·프로파일 유무·열어 본 호. **읽기만 한다.**
 * 발행된 호·다음 호 진행은 서재와 같은 `useLibrary`를 쓴다(같은 조회, 같은 `issues_public`).
 * 화면이 다시 보일 때마다 다시 읽는다 - 뷰어에서 돌아오면 "꽂혔어요" 카드가 사라진다.
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import type { EnneagramCore } from '../constants/enneagram'
import { computeLoveTypeCode } from '../engine/loveTypeInference'
import type { MbtiType } from '../constants/quizTypes'
import { fetchHasActivity, fetchProfilesComplete } from '../services/mainApi'
import { loadOpenedIssueIds } from '../services/issueSeen'
import { fetchLatestAssessment, fetchPersonalityProfile, fetchProfile } from '../services/personalityApi'
import { supabase } from '../services/supabase'

export interface LoveTypeSummary {
  mbti: MbtiType
  enneagramCore: EnneagramCore
  loveTypeCode: string
}

export interface MainFacts {
  /** 아직 못 읽었으면 null. 읽기에 실패하면 `storedTemperature !== null`로 대신한다(저장값은 활동이 있어야 생긴다). */
  hasActivity: boolean | null
  /** 아직 못 읽었으면 null. 읽기에 실패하면 true(저장값이 있으면 프로파일이 있었다는 뜻이라 36.5로 덮지 않는다). */
  profilesComplete: boolean | null
  openedIssueIds: ReadonlySet<string>
}

/** 본인·상대 표시 이름. 못 읽으면 null. */
export function useDisplayNames(userId: string | null, partnerId: string | null) {
  const [selfName, setSelfName] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId)
      .then((p) => {
        if (!cancelled) setSelfName(p?.display_name ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!partnerId) {
      setPartnerName(null)
      return
    }
    let cancelled = false
    fetchProfile(partnerId)
      .then((p) => {
        if (!cancelled) setPartnerName(p?.display_name ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [partnerId])

  return { selfName, partnerName }
}

/** 미연결 B05의 "내 연애유형"(온보딩 결과 요약) - 기존 데이터를 읽기만 한다. */
export function useLoveTypeSummary(userId: string | null, enabled: boolean): LoveTypeSummary | null {
  const [summary, setSummary] = useState<LoveTypeSummary | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      setSummary(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const assessment = await fetchLatestAssessment(userId)
        if (!assessment || cancelled) return
        const profile = await fetchPersonalityProfile(userId)
        if (!profile || cancelled) return
        const enneagramCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
        setSummary({
          mbti: assessment.mbti as MbtiType,
          enneagramCore,
          loveTypeCode: computeLoveTypeCode(enneagramCore, profile.attachment), // 실효 코어 기준(R40-4)
        })
      } catch {
        if (!cancelled) setSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, enabled])

  return summary
}

/** 연결된 커플의 온도 표시 상태·B06 판단에 필요한 사실들. */
export function useMainFacts(input: {
  userId: string | null
  partnerId: string | null
  coupleId: string | null
  storedTemperature: number | null
  issueIds: readonly string[]
}): MainFacts {
  const { userId, partnerId, coupleId, storedTemperature, issueIds } = input
  const [facts, setFacts] = useState<MainFacts>({
    hasActivity: null,
    profilesComplete: null,
    openedIssueIds: new Set(),
  })
  const issueKey = issueIds.join(',')

  useFocusEffect(
    useCallback(() => {
      if (!userId || !partnerId || !coupleId) return
      let cancelled = false
      ;(async () => {
        const [activity, profiles, opened] = await Promise.all([
          fetchHasActivity(supabase, coupleId).catch(() => storedTemperature !== null),
          fetchProfilesComplete(supabase, userId, partnerId).catch(() => true),
          loadOpenedIssueIds(userId, issueKey ? issueKey.split(',') : []),
        ])
        if (!cancelled) setFacts({ hasActivity: activity, profilesComplete: profiles, openedIssueIds: opened })
      })()
      return () => {
        cancelled = true
      }
    }, [userId, partnerId, coupleId, storedTemperature, issueKey]),
  )

  return facts
}
