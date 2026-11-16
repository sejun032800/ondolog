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
import { useFeedSignal } from '../feed/feedData'

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

// ---------------------------------------------------------------------------
// 76-r F3 · F4(R102-4): 메인 요약을 기기에 남긴다 - R98-1 저장 장치(`cache/deviceCache`)의 `main` 범주 하나에 scope만 나눠 둔다.
//  - `main`(scope 없음): 커플 이름 · 온도 · 사귄 날짜(D+) - `coupleStore`가 이미 쓴다.
//  - `main:library`: 발행된 호 목록 · 다음 호(매거진 %) - 표지 서명 URL은 남기지 않는다(만료 · 76-A1 규칙).
//  - `main:facts`: 활동 유무 · 프로필 완성 · 열어 본 호.
//  - `main:start`: 시작 온도(표시 값 · 활동분 유무).
//  새 범주가 아니라 `main`의 scope라 로그아웃 · 탈퇴 요청 · 해제 요청(유예 시작) · 해제 완료 · 계정 전환 삭제 규칙에 그대로 든다(시험 단언).
//  값 안에 커플 id를 두고, 지금 커플과 다르면 쓰지 않는다.
// ---------------------------------------------------------------------------

const me = (): string | null => useAuthStore.getState().userId

interface SavedLibrary { coupleId: string; issues: PublishedIssue[]; next: NextIssueData | null }
interface SavedFacts { coupleId: string; hasActivity: boolean; profilesComplete: boolean; openedIssueIds: string[]; openedFor: string }
export interface SavedStart { coupleId: string; value: number; hasActivity: boolean }

function savedLibrary(coupleId: string | null): LibraryState | null {
  if (!coupleId) return null
  const v = readCache<SavedLibrary>(me(), 'main', 'library')
  if (!v || v.coupleId !== coupleId || !Array.isArray(v.issues)) return null
  return { loading: false, error: false, issues: v.issues, coverUrls: {}, next: v.next ?? null }
}

function savedFacts(coupleId: string | null): MainFacts | null {
  if (!coupleId) return null
  const v = readCache<SavedFacts>(me(), 'main', 'facts')
  if (!v || v.coupleId !== coupleId || typeof v.openedFor !== 'string') return null
  return { hasActivity: v.hasActivity, profilesComplete: v.profilesComplete, openedIssueIds: new Set(v.openedIssueIds ?? []), openedFor: v.openedFor }
}

export function readSavedStart(coupleId: string | null): SavedStart | null {
  if (!coupleId) return null
  const v = readCache<SavedStart>(me(), 'main', 'start')
  return v && v.coupleId === coupleId && typeof v.value === 'number' ? v : null
}
export function writeSavedStart(value: SavedStart): void {
  writeCache(me(), 'main', value, 'start')
}

function firstLibrary(coupleId: string | null): LibraryState {
  if (libraryMemory && libraryMemory.coupleId === coupleId) return libraryMemory.state
  return savedLibrary(coupleId) ?? EMPTY_LIBRARY
}

export function useLibrary(coupleId: string | null): LibraryState {
  const [state, setState] = useState<LibraryState>(() => firstLibrary(coupleId))
  // 커플 id가 늦게 정해지면(앱 시작 - 저장 요약이 채워지기 전 첫 그림) 그때 저장값을 먼저 채운다. 이미 값이 있으면 그대로.
  useEffect(() => {
    if (!coupleId) return
    setState((s) => (s.loading ? firstLibrary(coupleId) : s))
  }, [coupleId])

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
      writeCache(me(), 'main', { coupleId, issues, next } satisfies SavedLibrary, 'library')
    } catch {
      // 76-r F3: 이미 보이는 값(이번 실행 · 기기 저장)이 있으면 오프라인에서도 그대로 둔다(매거진 % 유지). 보일 값이 없을 때만 오류.
      setState((s) => (s.loading ? { ...s, loading: false, error: true } : s))
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
  // 76-r F3 · F4: 기기에 남긴 마지막 사실이 있으면 먼저 그린다(오프라인 · 탭 재진입에 회색 자리 표시 0). 뒤에서 새로 읽어 바꾼다.
  const [facts, setFacts] = useState<MainFacts>(() => savedFacts(coupleId) ?? EMPTY_FACTS)
  useEffect(() => {
    if (!coupleId) return
    setFacts((f) => (f.openedFor === null ? (savedFacts(coupleId) ?? f) : f))
  }, [coupleId])
  const issueKey = issueIds.join(',')
  // 뷰어(74-6)가 호를 열어 봤다고 남기면 다시 읽는다(메인은 덮개 아래에 그대로 떠 있다). 읽는 동안 값은 비우지 않는다.
  const openedSignal = useIssueOpenedSignal((s) => s.version)
  const recordsSignal = useFeedSignal((s) => s.version) // 76-d: 하루 지우기 뒤 활동 유무를 다시 본다

  const reload = useCallback(async () => {
    const db = getSupabase()
    if (!userId || !partnerId || !coupleId || !db) return
    let readOk = true
    const saved = savedFacts(coupleId)
    const [activity, profiles, opened] = await Promise.all([
      // 읽기 실패(오프라인): 기기에 남긴 값이 있으면 그것, 없으면 지금까지의 대체값.
      fetchHasActivity(asDb(db), coupleId).catch(() => { readOk = false; return saved?.hasActivity ?? storedTemperature !== null }),
      fetchProfilesComplete(asDb(db), userId, partnerId).catch(() => { readOk = false; return saved?.profilesComplete ?? true }),
      loadOpenedIssueIds(userId, issueKey ? issueKey.split(',') : []),
    ])
    setFacts({ hasActivity: activity, profilesComplete: profiles, openedIssueIds: opened, openedFor: issueKey })
    if (readOk) writeCache(me(), 'main', { coupleId, hasActivity: activity, profilesComplete: profiles, openedIssueIds: [...opened], openedFor: issueKey } satisfies SavedFacts, 'facts')
  }, [userId, partnerId, coupleId, storedTemperature, issueKey, openedSignal, recordsSignal])

  useEffect(() => { void reload() }, [reload])
  useReloadOnVisible(() => { void reload() })
  return facts
}
