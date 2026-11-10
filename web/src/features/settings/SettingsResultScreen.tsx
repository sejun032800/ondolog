/**
 * A14 · A15 상세 결과 + A16 결과와 달라요 - **설정 모드**(설정 > 성격 프로필 H05가 다시 연다). RN `result-detail?source=settings`의 웹판. 경로 `settings-result`(`?view=override`면 A16부터).
 *
 * 온보딩의 `ResultDetailScreen`(메모리 결과)과 같은 본문 부품(`DetailBody` · `CoreOverrideView`)을 쓰되 값은 서버에 저장된 결과 그대로다(결정론) - 화면은 계산하지 않는다.
 * 읽기만 하고(프로필 행을 만들지 않는다), 지금 쓰고 있는 검사(`active_assessment_id`, 재검사 뒤에는 새 행)를 보인다. "다음"(초대로 가는 버튼)은 없고 ← 로 H05에 돌아온다.
 * 오버라이드 저장은 온보딩과 같은 함수(`overrideEnneagramCore`): `enneagram_override` · `override_count` · `override_updated_at` · `love_type_code`만 쓴다. 횟수 제한 없음.
 */
import { useEffect, useState } from 'react'
import { personalityMetaLine } from '../../attachmentNames'
import type { EnneagramCore } from '@/constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '@/constants/loveTypeLabels'
import { computeLoveTypeCode } from '@/engine/loveTypeInference'
import { overrideEnneagramCore } from '@/services/personalityCore'
import { getEnneagramCandidates } from '@/utils/enneagramCandidates'
import { buildDescription } from '../../description'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useRouteParams, type Nav } from '../../navigation'
import { CoreOverrideView, DetailBody } from '../../screens'
import { SettingsFrame, SettingsSkeletonBlock } from './parts'
import { fetchAssessmentById, fetchPersonalityProfile, type AssessmentRow, type PersonalityProfileRow } from './settingsData'

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; assessment: AssessmentRow; profile: PersonalityProfileRow }

export function SettingsResultScreen({ nav }: { nav: Nav }) {
  const param = useRouteParams()
  const startsInOverride = param('view') === 'override'
  const userId = useAuthStore((s) => s.userId)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [view, setView] = useState<'detail' | 'override'>(startsInOverride ? 'override' : 'detail')
  const [saving, setSaving] = useState(false)
  const [overrideError, setOverrideError] = useState(false)
  const [round, setRound] = useState(0)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const profile = await fetchPersonalityProfile(db, userId)
        if (cancelled) return
        const assessment = profile ? await fetchAssessmentById(db, profile.active_assessment_id) : null
        if (cancelled) return
        setState(profile && assessment ? { status: 'ready', assessment, profile } : { status: 'missing' })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [userId, nonce])

  if (state.status !== 'ready') {
    return (
      <SettingsFrame title="성격 프로필" onBack={nav.back} testId="settings-result">
        {state.status === 'loading' ? <SettingsSkeletonBlock rows={5} /> : null}
        {state.status === 'missing' ? <p className="t-sub c-sub" data-testid="result-missing">아직 저장된 결과가 없어요.</p> : null}
        {state.status === 'error' ? (
          <>
            <p className="t-sub c-sub" role="alert" data-testid="result-load-error">결과를 불러오지 못했어요. 잠시 뒤에 다시 시도해주세요.</p>
            <button type="button" className="btn press ghost" onClick={() => setNonce((n) => n + 1)}>다시 시도</button>
          </>
        ) : null}
      </SettingsFrame>
    )
  }

  const { assessment, profile } = state
  const inferred = profile.enneagram_inferred as EnneagramCore
  const effectiveCore = (profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore
  const loveTypeCode = computeLoveTypeCode(effectiveCore, profile.attachment) // 실효 코어 기준(R40-4)
  const label = LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]
  const big5 = { bigE: assessment.big_e, bigO: assessment.big_o, bigA: assessment.big_a, bigC: assessment.big_c, bigN: assessment.big_n }
  const sternberg = { intimacy: assessment.stern_intimacy, passion: assessment.stern_passion, commitment: assessment.stern_commitment }

  if (view === 'override') {
    const leave = () => {
      setOverrideError(false)
      if (startsInOverride) nav.back() // 설정에서 곧바로 연 길 - H05로 돌아간다.
      else setView('detail')
    }
    const confirm = async (selected: EnneagramCore) => {
      const db = getSupabase()
      if (selected === effectiveCore) { leave(); return }
      if (!userId || !db) return
      setSaving(true)
      setOverrideError(false)
      try {
        const next = await overrideEnneagramCore(db, userId, selected)
        setState({ status: 'ready', assessment, profile: next })
        setRound((r) => r + 1)
        leave()
      } catch {
        setOverrideError(true)
      } finally {
        setSaving(false)
      }
    }
    return <CoreOverrideView effectiveCore={effectiveCore} onBack={leave} onConfirm={(c) => void confirm(c)} saving={saving} error={overrideError ? '저장하지 못했어요. 다시 시도해주세요.' : null} />
  }

  return (
    <DetailBody
      key={round}
      labelEn={label?.labelEn ?? loveTypeCode}
      labelKo={label?.labelKo ?? loveTypeCode}
      meta={personalityMetaLine({ mbti: assessment.mbti, core: effectiveCore, attachment: profile.attachment })}
      description={buildDescription({ core: effectiveCore, attachment: profile.attachment, big5, sternberg })}
      big5={big5}
      sternberg={sternberg}
      core={effectiveCore}
      candidates={profile.enneagram_override ? [] : getEnneagramCandidates(assessment.q1, inferred)}
      onMismatch={() => setView('override')}
      onBack={nav.back}
    />
  )
}
