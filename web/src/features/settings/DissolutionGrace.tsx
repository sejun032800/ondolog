/**
 * H14 연결 해제 - 7일 유예 중 화면 본문. 보드 `N-S-H3-Settings`(H14) + patch7 ⓔ. RN `components/settings/DissolutionGrace`의 웹판.
 * 개시자와 상대가 같은 본문을 보고, [해제 취소하기]는 화면(`CoupleScreen`)이 개시자에게만 아래에 붙인다(`canCancelDissolution`).
 *
 * 남은 날짜는 서버의 `purge_scheduled_at`에서 센다(`graceDaysLeft`, KST) - 앱이 7일을 더하지 않는다. 숫자는 바로 보이고 세는 모션이 없다.
 * 보드의 "밤 12시"는 서버 값(요청 시각 + 7일)과 맞지 않아 쓰지 않고 날짜만 보인다.
 * 상대 쪽: 버튼만 빼지 않고 주어가 바뀐다("내 기록" -> "상대 기록", patch7 ⓔ). 빈 버튼 자리에는 왜 없는지를 적는다(`cancelOnlyRequester`).
 */
import { graceDateLabel, graceDaysLeft, nameWithSubject, type DissolutionState } from '@/utils/dissolution'
import { ListGroup, ListRow } from './parts'

export const GRACE_COPY = {
  kicker: 'DISCONNECTING',
  noNewIssue: '해제 예정 기간에는 새 호를 만들지 않아요',
  keepIssues: '발행된 잡지는 한쪽이 남아 있으면 보존돼요',
  pdf: '발행된 호 PDF로 받아두기',
  cancel: '해제 취소하기',
  /** 취소 버튼이 없는 쪽(상대)의 빈 버튼 자리 - 빈자리는 고장으로 읽혀서 이유를 적는다(patch7 ⓔ). */
  cancelOnlyRequester: '취소는 요청한 사람만 할 수 있어요.',
} as const

export function graceBullets(state: DissolutionState, partnerName: string | null): string[] {
  const name = partnerName ?? '상대'
  if (state.initiatedByMe) {
    return [
      `${name}에게 해제 요청을 알렸어요`,
      GRACE_COPY.noNewIssue,
      `해제되면 내가 남긴 사진·글·대화가 지워지고, ${name}의 기록은 남아요`,
      GRACE_COPY.keepIssues,
    ]
  }
  return [
    state.reason === 'withdrawal' ? `${nameWithSubject(name)} 탈퇴를 요청했어요` : `${nameWithSubject(name)} 연결 해제를 요청했어요`,
    GRACE_COPY.noNewIssue,
    `해제되면 ${nameWithSubject(name)} 남긴 사진·글·대화가 지워지고, 내 기록은 남아요`,
    GRACE_COPY.keepIssues,
  ]
}

export function DissolutionGraceBody({ state, partnerName, onOpenPdf, now }: {
  state: DissolutionState
  partnerName: string | null
  onOpenPdf: () => void
  now?: Date
}) {
  const days = graceDaysLeft(state.purgeScheduledAt, now)
  return (
    <>
      <div className="graceCard" data-testid="grace-card">
        <p className="t-kicker c-mute">{GRACE_COPY.kicker}</p>
        <p className="graceDays" data-testid="grace-days">{days > 0 ? `${days}일` : '오늘'}</p>
        <p className="t-body c-sub" data-testid="grace-date">{`${graceDateLabel(state.purgeScheduledAt)}에 연결이 해제돼요`}</p>
      </div>
      <BulletCard lines={graceBullets(state, partnerName)} testId="grace-bullets" />
      <ListGroup>
        <ListRow label={GRACE_COPY.pdf} onPress={onOpenPdf} testId="grace-pdf-row" />
      </ListGroup>
    </>
  )
}

/** 점 + 글 줄 카드(유예 안내 · 탈퇴 취소 안내). */
export function BulletCard({ lines, testId }: { lines: readonly string[]; testId?: string }) {
  return (
    <ul className="graceBullets" data-testid={testId}>
      {lines.map((line) => (
        <li key={line}><span className="graceDot" aria-hidden="true">•</span><span className="t-body c-sub">{line}</span></li>
      ))}
    </ul>
  )
}
