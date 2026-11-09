/**
 * E15 장소 고치기 - 스택 화면(왼쪽 위 ←). 보드 `N-S-E3-Feed` E15. RN `app/date/[id]/stop/[stopId]/index.tsx`의 웹판. 경로 `stop-edit?id=&stop=`.
 *
 * 장소 이름(직접 입력)과 도착 시각만 고친다. 장소 검색 · 지도 · "사진에 남은 위치" 제안은 없다(지도는 범위 밖) - `place_provider_id` · `lat` · `lng`는 건드리지 않는다.
 * 도착 시각은 늘 실제 시각이다(R30-2): 첫 장소는 비우면 그 데이트 사진의 가장 이른 촬영 시각, 둘째부터는 필수, 정할 수 없으면 저장할 수 없다(이유를 글로 적는다).
 * 도착 시각을 고치면 stop 순서와 내 사진의 배치가 규칙 4로 다시 맞춰진다(`updateStop`).
 */
import { useEffect, useState } from 'react'
import {
  fetchDate, fetchEntriesOfDates, fetchStopsOfDate, updateStop, type Db,
} from '@/services/dateRecordApi'
import { formatClockInput, kstTimeOf, resolveStopArrival, stopTimeErrorMessage } from '@/utils/dateRecord'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useRouteParams, type Nav } from '../../navigation'
import { showToast } from '../../stores/toastStore'
import { PrimaryButton } from '../../ui'
import { useFeedSignal } from './feedData'

export function StopEditScreen({ nav }: { nav: Nav }) {
  const param = useRouteParams()
  const dateId = param('id')
  const stopId = param('stop')
  const userId = useAuthStore((s) => s.userId)
  const bump = useFeedSignal((s) => s.bump)

  const [dateOn, setDateOn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [clock, setClock] = useState('')
  const [isFirst, setIsFirst] = useState(false)
  const [photoTimes, setPhotoTimes] = useState<(string | null)[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const db = getSupabase() as unknown as Db | null
    if (!db) return
    let alive = true
    void (async () => {
      try {
        const [date, stops, entries] = await Promise.all([fetchDate(db, dateId), fetchStopsOfDate(db, dateId), fetchEntriesOfDates(db, [dateId])])
        const stop = stops.find((s) => s.id === stopId)
        if (!alive || !date || !stop) return
        setDateOn(date.date_on)
        setName(stop.place_name ?? '')
        setClock(kstTimeOf(stop.arrived_at) ?? '')
        setIsFirst(stop.seq === 0)
        setPhotoTimes(entries.filter((e) => e.entry_type === 'photo').map((e) => e.captured_at))
        setLoaded(true)
      } catch {
        // 불러오지 못하면 저장 버튼이 꺼진 채로 남는다.
      }
    })()
    return () => { alive = false }
  }, [dateId, stopId])

  const timeCheck = dateOn ? resolveStopArrival({ dateOn, clock, isFirst, photoCapturedAts: photoTimes }) : null
  const timeError = timeCheck !== null && !timeCheck.ok ? stopTimeErrorMessage(timeCheck.error) : null
  const canSave = loaded && timeError === null && !saving && userId !== null

  const save = async () => {
    const db = getSupabase() as unknown as Db | null
    if (!canSave || !dateOn || !userId || !db) return
    setSaving(true)
    try {
      await updateStop(db, { stopId, dateId, dateOn, userId, placeName: name, arrivalClock: clock.length > 0 ? clock : null })
      bump()
      nav.back()
    } catch {
      showToast('장소를 고치지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen solid" data-testid="stop-edit">
      <div className="pushHeader">
        <button type="button" className="back press" aria-label="뒤로" onClick={nav.back}>←</button>
        <h1 className="t-title c-text">장소</h1>
        <span className="pushHeaderSpacer" aria-hidden="true" />
      </div>

      <div className="stopEditBody">
        <div className="fieldGroup">
          <span className="t-kicker c-mute">PLACE</span>
          <input
            className="pillInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="장소 이름"
            aria-label="장소 이름"
            enterKeyHint="done"
            data-testid="stop-name-input"
          />
          <p className="t-caption c-mute">찾는 곳이 없어도 이름을 직접 쓸 수 있어요</p>
        </div>

        <div className="fieldGroup">
          <span className="t-kicker c-mute">ARRIVED</span>
          <input
            className="pillInput"
            value={clock}
            onChange={(e) => setClock(formatClockInput(e.target.value))}
            placeholder="도착 시각 (예 14:20)"
            aria-label="도착 시각"
            inputMode="numeric"
            maxLength={5}
            data-testid="stop-clock-input"
          />
          <p className="t-caption c-mute" data-testid="stop-clock-note">
            {timeError ??
              (isFirst
                ? '비워 두면 사진의 가장 이른 촬영 시각이 돼요. 시각을 바꾸면 사진이 촬영 시각에 맞춰 다시 자리를 찾아요'
                : '시각을 바꾸면 사진이 촬영 시각에 맞춰 다시 자리를 찾아요')}
          </p>
        </div>
      </div>

      <div className="footer">
        <PrimaryButton label={saving ? '고치는 중이에요' : '저장'} onClick={() => void save()} disabled={!canSave} />
      </div>
    </div>
  )
}
