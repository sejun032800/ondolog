/**
 * A-2-5 시작 온도 - 연결됐고 두 사람의 성격 프로필이 모두 있으면, 저장된 온도(`daily_temperature`)가 아직 없을 때 **시작 온도**(기저 36.5 / 39 / 42)를 바로 보인다.
 *
 * - 계산은 루트 엔진 `computeBaselineTemperature`(= `resolveTypeAffinity`의 범주 -> 값, 결정론 · 순수)를 **그대로** 부른다. 웹이 식을 다시 쓰지 않는다.
 *   배치(`computeDailyTemperature`)의 `activityDelta = 0`인 날과 같은 값이다(시험이 두 길을 맞대 본다).
 * - **표시 전용**: 서버에 쓰지 않고 마이그레이션도 없다. 저장값이 있으면 저장값이 이긴다(호출한 화면이 저장값 우선으로 고른다).
 * - 세 값은 MASTER Part 10-7-2의 문서 기본값이다. 배치는 이 값을 `app_config`에서 주입받도록 설계돼 있으나 그 키가 아직 DB에 없어,
 *   화면은 같은 문서 기본값을 이름 붙인 상수 한 곳에 둔다(키가 생기면 이 상수만 읽기로 바꾼다).
 */
import { useEffect, useState } from 'react'
import { computeBaselineTemperature, type BaselineTemperatureCoefficients } from '@/engine/temperature'
import type { EnneagramCore } from '@/constants/enneagram'
import { getSupabase } from '../../auth/client'

export const START_TEMPERATURE_COEFFICIENTS: BaselineTemperatureCoefficients = { contrast: 36.5, neutral: 39, best: 42 }

export const START_TEMPERATURE_COPY = '시작 온도예요. 기록이 쌓이면 다음 날부터 움직여요.'

/** 두 사람의 코어로 시작 온도. 코어가 빠지면 null(지어내지 않는다). */
export function startTemperatureOf(coreA: EnneagramCore | null | undefined, coreB: EnneagramCore | null | undefined): number | null {
  if (coreA == null || coreB == null) return null
  return computeBaselineTemperature(coreA, coreB, START_TEMPERATURE_COEFFICIENTS) ?? null
}

type ProfileCores = { user_id: string; enneagram_inferred: number | null; enneagram_effective: number | null }

/** 두 사람의 프로필을 읽어 시작 온도를 돌려준다. 못 읽었거나 한쪽이 없으면 null. 읽기만 한다. */
export function useStartTemperature(userId: string | null, partnerId: string | null, enabled: boolean): number | null {
  const [value, setValue] = useState<number | null>(null)
  useEffect(() => {
    const db = getSupabase()
    if (!enabled || !userId || !partnerId || !db) { setValue(null); return }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await db.from('personality_profiles').select('user_id, enneagram_inferred, enneagram_effective').in('user_id', [userId, partnerId])
        if (error || cancelled) return
        const rows = (data ?? []) as ProfileCores[]
        const core = (id: string): EnneagramCore | null => {
          const r = rows.find((x) => x.user_id === id)
          const c = r ? (r.enneagram_effective ?? r.enneagram_inferred) : null
          return (c as EnneagramCore | null) ?? null
        }
        if (!cancelled) setValue(startTemperatureOf(core(userId), core(partnerId)))
      } catch {
        if (!cancelled) setValue(null)
      }
    })()
    return () => { cancelled = true }
  }, [userId, partnerId, enabled])
  return value
}
