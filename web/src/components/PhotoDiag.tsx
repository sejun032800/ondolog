/**
 * 시험 빌드 전용 사진 실패 진단 줄(74-h4): 실패 단계 이름 + 짧은 분류만. 주소 · 키 · 파일 이름 · 경로 · 개인정보 없음.
 * 부르는 쪽은 `{IS_TRIAL_BUILD ? <PhotoDiag /> : null}`로만 쓴다 - 운영 빌드에서는 이 파일 전체가 번들에서 빠진다.
 */
import { useTrialDiag, type PhotoStep } from '../platform/trialDiag'

const PHOTO_STEP_LABEL: Record<PhotoStep, string> = {
  pick: '사진 고르기',
  read: '사진 읽기',
  compress: '사진 압축',
  upload: '사진 올리기',
  rows: '행 저장',
}

export function PhotoDiag({ testId = 'photo-diag' }: { testId?: string }) {
  const photo = useTrialDiag((s) => s.photo)
  if (!photo) return null
  return (
    <p className="trialDiag" data-testid={testId}>
      {`진단 · ${PHOTO_STEP_LABEL[photo.step]} · ${photo.kind}`}
    </p>
  )
}
