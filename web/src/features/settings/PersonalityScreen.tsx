/**
 * H05 성격 프로필 · H06 재검사 확인 - 설정 > 성격 프로필. 보드 `N-S-H1-Settings`(H05 · H06) + patch7(H05 애착 슬롯). RN `app/settings-personality.tsx` · `RetestConfirm`의 웹판. 푸시 화면, 확인은 시트.
 *
 * 위에 지금 결과 카드(영문 라벨 · 한글 라벨 · MBTI · 애니어그램 코어 · 애착), 아래 세 줄:
 *   - 결과 다시 보기 -> A14 · A15(`settings-result`, 설정 모드 - "다음" 없이 ← 로 돌아온다)
 *   - 애니어그램 코어 고치기 -> A16(`settings-result?view=override`). 무제한, `love_type_code`는 R40-4대로 같은 UPDATE에서 다시 계산한다(`overrideEnneagramCore`)
 *   - 5문항 다시 하기 -> H06 확인 시트 -> A04~A07(`retest`) -> `fn_complete_retest` 함수 호출 하나(`retestPersonality`). **계정당 1회** -
 *     `retest_used`가 true면 줄이 비활성(글자 textFaint)이고 누를 수 없다(`canRetest`).
 * 이 화면은 읽기만 한다 - 쓰기는 재검사 저장(`RetestScreen`)과 오버라이드(`SettingsResultScreen`)가 한다. 읽는 동안은 I03 뼈대(B14).
 */
import { useEffect, useState } from 'react'
import { ATTACHMENT_LABEL_KO } from '@/constants/attachment'
import type { EnneagramCore } from '@/constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '@/constants/loveTypeLabels'
import { computeLoveTypeCode } from '@/engine/loveTypeInference'
import { useSessionStore } from '@/store/sessionStore'
import { canRetest, retestRowDescription } from '@/utils/settingsRules'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { Sheet, useSheetClose } from '../../components/Sheet'
import type { Nav } from '../../navigation'
import { PrimaryButton } from '../../ui'
import { ListGroup, ListRow, SettingsFrame, SettingsSkeletonBlock } from './parts'
import { fetchAssessmentById, fetchPersonalityProfile, type AssessmentRow, type PersonalityProfileRow } from './settingsData'

export const PERSONALITY_COPY = {
  title: '성격 프로필',
  view: '결과 다시 보기',
  override: '애니어그램 코어 고치기',
  overrideDescription: '몇 번이든 바꿀 수 있어요',
  retest: '5문항 다시 하기',
  loadFailed: '불러오지 못했어요. 다시 시도해주세요.',
  missing: '아직 결과가 없어요.',
} as const

/** H06 확인 시트 문장 - 보드 그대로. */
export const RETEST_CONFIRM_COPY = {
  title: '다시 하기는 한 번뿐이에요',
  message: '5문항을 다시 풀면 연애 유형이 바뀔 수 있어요. 이미 발행된 호는 그대로 남아요. 한 번 쓰면 이 버튼은 다시 열리지 않아요.',
  confirm: '다시 하기',
  cancel: '취소',
} as const

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'missing' }
  | { kind: 'ready'; profile: PersonalityProfileRow; assessment: AssessmentRow | null }

export function PersonalityScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) return
    let cancelled = false
    void (async () => {
      try {
        const profile = await fetchPersonalityProfile(db, userId)
        if (cancelled) return
        if (!profile) { setLoad({ kind: 'missing' }); return }
        const assessment = await fetchAssessmentById(db, profile.active_assessment_id).catch(() => null)
        if (!cancelled) setLoad({ kind: 'ready', profile, assessment })
      } catch {
        if (!cancelled) setLoad({ kind: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const ready = load.kind === 'ready' ? load : null
  const profile = ready?.profile ?? null
  const effectiveCore = profile ? ((profile.enneagram_effective ?? profile.enneagram_inferred) as EnneagramCore) : null
  const code = profile && effectiveCore ? computeLoveTypeCode(effectiveCore, profile.attachment) : null // 실효 코어 기준(R40-4)
  const label = code ? LOVE_TYPE_LABEL_BY_CODE[code] : undefined

  const startRetest = () => {
    setConfirmOpen(false)
    // 새 검사는 메모리(sessionStore)에서 처음부터 푼다 - 이전 답이 남아 있으면 지운다.
    useSessionStore.getState().resetSession()
    nav.push('retest')
  }

  return (
    <>
    <SettingsFrame title={PERSONALITY_COPY.title} onBack={nav.back} testId="settings-personality">
      {load.kind === 'loading' ? <SettingsSkeletonBlock rows={4} /> : null}
      {load.kind === 'error' ? <p className="t-sub c-sub" role="alert" data-testid="personality-load-error">{PERSONALITY_COPY.loadFailed}</p> : null}
      {load.kind === 'missing' ? <p className="t-sub c-sub" data-testid="personality-missing">{PERSONALITY_COPY.missing}</p> : null}

      {profile && effectiveCore ? (
        <div className="personalityCard" data-testid="personality-card">
          <p className="t-kicker c-orchid personalityEn" data-testid="personality-label-en">{label?.labelEn ?? code}</p>
          <p className="t-display c-text" data-testid="personality-label-ko">{label?.labelKo ?? code}</p>
          <p className="t-sub c-sub" data-testid="personality-meta">
            {ready?.assessment ? `${ready.assessment.mbti} · ` : ''}
            {`애니어그램 ${effectiveCore} · ${ATTACHMENT_LABEL_KO[profile.attachment]}`}
          </p>
        </div>
      ) : null}

      {profile ? (
        <ListGroup>
          <ListRow label={PERSONALITY_COPY.view} onPress={() => nav.push('settings-result')} testId="personality-row-view" />
          <ListRow
            label={PERSONALITY_COPY.override}
            description={PERSONALITY_COPY.overrideDescription}
            onPress={() => nav.push('settings-result', { params: { view: 'override' } })}
            testId="personality-row-override"
          />
          <ListRow
            label={PERSONALITY_COPY.retest}
            description={retestRowDescription(profile)}
            onPress={() => setConfirmOpen(true)}
            disabled={!canRetest(profile)}
            testId="personality-row-retest"
          />
        </ListGroup>
      ) : null}

    </SettingsFrame>
    {confirmOpen ? (
      <Sheet variant="auto" testId="retest-confirm" onClosed={() => setConfirmOpen(false)}>
        <RetestConfirmBody onConfirm={startRetest} />
      </Sheet>
    ) : null}
    </>
  )
}

/** H06 확인 시트 본문 - 제목 · 문장 · [다시 하기](주) · [취소]. */
function RetestConfirmBody({ onConfirm }: { onConfirm: () => void }) {
  const close = useSheetClose()
  return (
    <div className="retestSheet">
      <h2 className="dialogTitle">{RETEST_CONFIRM_COPY.title}</h2>
      <p className="dialogMsg">{RETEST_CONFIRM_COPY.message}</p>
      <div className="dialogBtns">
        <button type="button" className="btn press primary" onClick={onConfirm} data-testid="retest-confirm-yes">{RETEST_CONFIRM_COPY.confirm}</button>
        <PrimaryButton label={RETEST_CONFIRM_COPY.cancel} variant="ghost" onClick={close} />
      </div>
    </div>
  )
}
