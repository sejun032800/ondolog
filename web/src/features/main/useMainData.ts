/**
 * 메인 탭(B03 · B04 · B05 · B06) 데이터 훅 - RN `hooks/useMainData.ts` · `useLibrary.ts`의 웹판. **읽기만 한다.**
 * 같은 조회(`@/services/mainApi` · `@/services/magazineApi` - 클라이언트를 인자로 받는 순수 파일)를 웹 클라이언트로 부른다.
 * 온도는 여기서 읽지도 계산하지도 않는다: `stores/coupleStore`가 `daily_temperature` 저장값을 읽어 둔다.
 *
 * RN `useFocusEffect`(화면이 다시 보일 때 다시 읽기)의 웹 대응: 탭 화면은 탭을 옮길 때마다 새로 그려지므로 마운트 때 읽고,
 * 앱이 다시 보일 때(`visibilitychange`)도 한 번 더 읽는다. 다시 읽는 동안 이미 받은 값은 지우지 않는다(깜빡임 0).
 */
import { useCallback, useEffect, useState } from 'react'
import { computeLoveTypeCode } from '@/engine/loveTypeInference'
import type { EnneagramCore } from '@/constants/enneagram'
import type { MbtiType } from '@/constants/quizTypes'
import { fetchHasActivity, fetchProfilesComplete } from '@/services/mainApi'
import {
  countMaterials,
  fetchIssueProgressRows,
  fetchPublishedIssues,
  signMagazinePaths,
  type MaterialCounts,
  type PublishedIssue,
} from '@/services/magazineApi'
import type { Db } from '@/services/dateRecordApi'
import { issueMonthLabel, kstToday, periodElapsedPercent, pickDraftIssue } from '@/utils/magazine'
import { fetchLatestAssessment, fetchProfile } from '../../auth/finalize'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { loadOpenedIssueIds, useIssueOpenedSignal } from './issueSeen'

/** 앱이 다시 보일 때마다 `reload`를 부른다. */
function useReloadOnVisible(reload: () => void): void {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])
}

const asDb = (db: unknown) => db as Db

// ---------------------------------------------------------------------------
// 상대 이름 · 내 연애유형(B05)
// ---------------------------------------------------------------------------

/**
 * 상대 표시 이름. 못 읽으면 null. 기기에 저장한 이름이 있으면 서버 읽기 전에 그것을 먼저 돌려준다(76-A1 - 머리 "상대" 기본 글자가 0.1초도 비치지 않게). 서버 값이 오면 바꾼다.
 */
export function usePartnerName(partnerId: string | null): string | null {
  const savedName = (id: string | null): string | null =>
    id ? (readCache<{ name: string }>(useAuthStore.getState().userId, 'name', id)?.name ?? null) : null
  const [name, setName] = useState<string | null>(() => savedName(partnerId))
  useEffect(() => {
    const db = getSupabase()
    if (!partnerId || !db) { setName(savedName(partnerId)); return }
    let cancelled = false
    setName(savedName(partnerId))
    fetchProfile(db, partnerId)
      .then((p) => {
        if (cancelled) return
        const fresh = p?.display_name ?? null
        if (fresh) writeCache(useAuthStore.getState().userId, 'name', { name: fresh }, partnerId)
        setName(fresh ?? savedName(partnerId))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])
  return name
}

export interface LoveTypeSummary {
  mbti: MbtiType
  enneagramCore: EnneagramCore
  loveTypeCode: string
}

/** 미연결 B05의 "내 연애유형"(온보딩 결과 요약) - 기존 데이터를 읽기만 한다. 코어는 실효 코어 기준(R40-4). */
export function useLoveTypeSummary(userId: string | null, enabled: boolean): LoveTypeSummary | null {
  const [summary, setSummary] = useState<LoveTypeSummary | null>(null)
  useEffect(() => {
    const db = getSupabase()
    if (!enabled || !userId || !db) { setSummary(null); return }
    let cancelled = false
    void (async () => {
      try {
        const assessment = await fetchLatestAssessment(db, userId)
        if (!assessment || cancelled) return
        const { data: profile, error } = await db.from('personality_profiles').select('*').eq('user_id', userId).maybeSingle()
        if (error || !profile || cancelled) return
        const enneagramCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
        setSummary({
          mbti: assessment.mbti as MbtiType,
          enneagramCore,
          loveTypeCode: computeLoveTypeCode(enneagramCore, profile.attachment),
        })
      } catch {
        if (!cancelled) setSummary(null)
      }
    })()
    return () => { cancelled = true }
  }, [userId, enabled])
  return summary
}

// ---------------------------------------------------------------------------
// 발행된 호 · 다음 호 카드 (RN `useLibrary`)
// ---------------------------------------------------------------------------

export interface NextIssueData {
  /** "10월호" */
  monthLabel: string
  /** 기간 경과율 0~100 정수. */
  percent: number
  /** 기간 안 기록 수. 못 셌으면 null(카드는 수를 그리지 않는다). */
  counts: MaterialCounts | null
}

export interface LibraryState {
  loading: boolean
  error: boolean
  issues: PublishedIssue[]
  /** 표지 경로 -> 서명 URL(URL 값은 화면 밖으로 내지 않는다). */
  coverUrls: Record<string, string>
  next: NextIssueData | null
}

export const EMPTY_LIBRARY: LibraryState = { loading: true, error: false, issues: [], coverUrls: {}, next: null }

/** 76-B5: 메인을 다시 그릴 때(탭 복귀) 마지막으로 읽은 서재 요약을 먼저 보인다 - 회색 자리 표시는 첫 로드만. 이 실행의 메모리(로그아웃 · 탈퇴 때 비운다). */
let libraryMemory: { coupleId: string; state: LibraryState } | null = null
export function forgetMainMemory(): void {
  libraryMemory = null
}

export function useLibrary(coupleId: string | null): LibraryState {
  const [state, setState] = useState<LibraryState>(() => (libraryMemory && libraryMemory.coupleId === coupleId ? libraryMemory.state : EMPTY_LIBRARY))

  const reload = useCallback(async () => {
    const db = getSupabase()
    if (!coupleId || !db) return
    try {
      const [issues, progressRows] = await Promise.all([fetchPublishedIssues(asDb(db)), fetchIssueProgressRows(asDb(db))])
      const coverPaths = issues.flatMap((i) => (i.coverPath ? [i.coverPath] : []))
      const draft = pickDraftIssue(progressRows)
      const [coverUrls, counts] = await Promise.all([
        signMagazinePaths(asDb(db), coverPaths),
        draft
          ? countMaterials(asDb(db), coupleId, { periodStart: draft.periodStart, periodEnd: draft.periodEnd }).catch(() => null)
          : Promise.resolve(null),
      ])
      const next: NextIssueData | null = draft
        ? {
            monthLabel: issueMonthLabel({ periodStart: draft.periodStart, issueType: draft.issueType, title: null }),
            percent: periodElapsedPercent(draft.periodStart, draft.periodEnd, kstToday(new Date())),
            counts,
          }
        : null
      const fresh: LibraryState = { loading: false, error: false, issues, coverUrls, next }
      libraryMemory = { coupleId, state: fresh }
      setState(fresh)
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }, [coupleId])

  useEffect(() => { void reload() }, [reload])
  useReloadOnVisible(() => { void reload() })
  return state
}

// ---------------------------------------------------------------------------
// 온도 표시 상태 · B06 판단에 필요한 사실 (RN `useMainFacts`)
// ---------------------------------------------------------------------------

export interface MainFacts {
  /** 아직 못 읽었으면 null. 읽기에 실패하면 `storedTemperature !== null`로 대신한다(저장값은 활동이 있어야 생긴다). */
  hasActivity: boolean | null
  /** 아직 못 읽었으면 null. 읽기에 실패하면 true(저장값이 있으면 프로파일이 있었다는 뜻이라 36.5로 덮지 않는다). */
  profilesComplete: boolean | null
  openedIssueIds: ReadonlySet<string>
  /** `openedIssueIds`가 읽힌 호 목록(id를 쉼표로 이은 키). 호 목록이 바뀌었는데 이 값이 다르면 "열어 봄"이 아직 낡은 것이라 화면은 기다린다(새 호 카드가 떴다 사라지는 깜빡임 0). */
  openedFor: string | null
}

export const EMPTY_FACTS: MainFacts = { hasActivity: null, profilesComplete: null, openedIssueIds: new Set(), openedFor: null }

export function useMainFacts(input: {
  userId: string | null
  partnerId: string | null
  coupleId: string | null
  storedTemperature: number | null
  issueIds: readonly string[]
}): MainFacts {
  const { userId, partnerId, coupleId, storedTemperature, issueIds } = input
  const [facts, setFacts] = useState<MainFacts>(EMPTY_FACTS)
  const issueKey = issueIds.join(',')
  // 뷰어(74-6)가 호를 열어 봤다고 남기면 다시 읽는다(메인은 덮개 아래에 그대로 떠 있다). 읽는 동안 값은 비우지 않는다.
  const openedSignal = useIssueOpenedSignal((s) => s.version)

  const reload = useCallback(async () => {
    const db = getSupabase()
    if (!userId || !partnerId || !coupleId || !db) return
    const [activity, profiles, opened] = await Promise.all([
      fetchHasActivity(asDb(db), coupleId).catch(() => storedTemperature !== null),
      fetchProfilesComplete(asDb(db), userId, partnerId).catch(() => true),
      loadOpenedIssueIds(userId, issueKey ? issueKey.split(',') : []),
    ])
    setFacts({ hasActivity: activity, profilesComplete: profiles, openedIssueIds: opened, openedFor: issueKey })
  }, [userId, partnerId, coupleId, storedTemperature, issueKey, openedSignal])

  useEffect(() => { void reload() }, [reload])
  useReloadOnVisible(() => { void reload() })
  return facts
}
