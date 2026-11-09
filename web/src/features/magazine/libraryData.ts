/**
 * 서재(D01) 데이터 훅 - RN `hooks/useLibrary.ts`의 웹판. 발행된 호(`issues_public`만) · 표지 서명 URL · 다음 호 카드의 값. **읽기만 한다.**
 * 같은 조회(`@/services/magazineApi`, 클라이언트를 인자로 받는 순수 파일)를 웹 클라이언트로 부른다. 새 RPC · 테이블 0. 인쇄용 경로는 어디에도 없다.
 *
 * B13(매거진 빈 상태 깜빡임) 막기 - 로드 상태 판정이 오가지 않게 한다.
 *  - 값을 한 번이라도 읽으면 이후의 다시 읽기(마운트 · 앱이 다시 보일 때)는 **받은 값을 비우지 않고** 뒤에서 바꾼다.
 *    다시 읽기가 실패해도 받아 둔 값을 오류 화면으로 바꾸지 않는다(오류는 값이 한 번도 없을 때만).
 *  - 탭을 옮겼다 돌아와도 직전 값을 먼저 보여 준다(모듈 안 짧은 기억, 표지 서명 주소 유효 시간 안에서만). 그래서 두 번째 방문에는 뼈대 -> 서재로 바뀌지 않는다.
 *  - 단계는 `idle`(조회 전) -> `loaded` | `failed` 한 방향이고, 다시 읽기는 `loaded`를 건드리지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Db } from '@/services/dateRecordApi'
import {
  countMaterials, fetchIssueProgressRows, fetchPublishedIssues, signMagazinePaths,
  type MaterialCounts, type PublishedIssue,
} from '@/services/magazineApi'
import { MAGAZINE_IMAGE_URL_TTL_SECONDS, URL_REFRESH_MARGIN_MS, issueMonthLabel, kstToday, periodElapsedPercent, pickDraftIssue } from '@/utils/magazine'
import { getSupabase } from '../../auth/client'

export interface NextIssueData {
  /** "10월호" */
  monthLabel: string
  /** 기간 경과율 0~100 정수. */
  percent: number
  /** 기간 안 기록 수. 못 셌으면 null(카드는 수를 그리지 않는다). */
  counts: MaterialCounts | null
}

export interface ShelfData {
  issues: PublishedIssue[]
  /** 표지 경로 -> 서명 URL(URL 값은 화면 밖으로 내지 않는다). */
  coverUrls: Record<string, string>
  next: NextIssueData | null
}

export interface LibraryState extends ShelfData {
  /** 아직 한 번도 못 읽었고 실패도 아니다 -> 뼈대. */
  loading: boolean
  /** 한 번도 못 읽었는데 실패했다. 값이 있으면 다시 읽기가 실패해도 false다. */
  error: boolean
  reload: () => Promise<void>
}

const EMPTY: ShelfData = { issues: [], coverUrls: {}, next: null }

// 탭을 옮겼다 돌아올 때 직전 값을 먼저 보여 주는 짧은 기억(커플 단위). 표지 서명 주소가 살아 있는 동안만 쓴다.
const REMEMBER_MS = MAGAZINE_IMAGE_URL_TTL_SECONDS * 1000 - URL_REFRESH_MARGIN_MS
const remembered = new Map<string, { at: number; data: ShelfData }>()

/** 시험 · 로그아웃용: 기억을 비운다. */
export function forgetLibrary(): void {
  remembered.clear()
}

function recall(coupleId: string | null): ShelfData | null {
  if (!coupleId) return null
  const hit = remembered.get(coupleId)
  if (!hit) return null
  if (Date.now() - hit.at >= REMEMBER_MS) {
    remembered.delete(coupleId)
    return null
  }
  return hit.data
}

/** 앱이 다시 보일 때마다 `reload`를 부른다. */
function useReloadOnVisible(reload: () => void): void {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])
}

const asDb = (db: unknown) => db as Db

type Phase = { kind: 'idle' } | { kind: 'loaded'; data: ShelfData } | { kind: 'failed' }

export function useLibrary(coupleId: string | null): LibraryState {
  const [phase, setPhase] = useState<Phase>(() => {
    const hit = recall(coupleId)
    return hit ? { kind: 'loaded', data: hit } : { kind: 'idle' }
  })
  // 이 커플로 읽은 값만 그린다(커플이 바뀌면 낡은 값을 그리지 않는다).
  const phaseFor = useRef<string | null>(coupleId)
  const latest = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const reload = useCallback(async () => {
    const db = getSupabase()
    if (!coupleId || !db) return
    const ticket = ++latest.current
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
      const data: ShelfData = { issues, coverUrls, next }
      remembered.set(coupleId, { at: Date.now(), data })
      if (!alive.current || ticket !== latest.current) return
      phaseFor.current = coupleId
      setPhase({ kind: 'loaded', data })
    } catch {
      if (!alive.current || ticket !== latest.current) return
      // 받아 둔 값이 있으면 그대로 둔다(오류 화면으로 바꾸지 않는다).
      setPhase((p) => (p.kind === 'loaded' && phaseFor.current === coupleId ? p : { kind: 'failed' }))
    }
  }, [coupleId])

  // 커플이 바뀌면(드문 경우: 다른 계정으로 로그인) 그 커플의 기억으로 맞춘다.
  useEffect(() => {
    if (phaseFor.current === coupleId) return
    phaseFor.current = coupleId
    const hit = recall(coupleId)
    setPhase(hit ? { kind: 'loaded', data: hit } : { kind: 'idle' })
  }, [coupleId])

  useEffect(() => { void reload() }, [reload])
  useReloadOnVisible(() => { void reload() })

  // 다시 불러오기(오류의 버튼): 오류를 걷고 뼈대로 돌아가 읽는다.
  const retry = useCallback(async () => {
    setPhase((p) => (p.kind === 'failed' ? { kind: 'idle' } : p))
    await reload()
  }, [reload])

  const data = phase.kind === 'loaded' ? phase.data : EMPTY
  return { ...data, loading: phase.kind === 'idle', error: phase.kind === 'failed', reload: retry }
}
