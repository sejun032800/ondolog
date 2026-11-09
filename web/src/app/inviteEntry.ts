/**
 * 초대 · 코드 입력으로 들어가는 문 한 곳(I01 커플 게이트의 두 버튼 · 이후 커플 전용 기능이 부른다).
 * 실제 이동은 Shell이 `setInviteEntry`로 꽂는다(74-2): 탭 위에 `couple-invite` 화면을 쌓고, 그 화면이 `consumeInviteStep`으로 어느 단계로 열지 읽는다.
 * 꽂기 전에는 짧은 안내 토스트만 보인다(아무 일도 없는 버튼은 두지 않는다).
 */
import { showToast } from '../stores/toastStore'

export type InviteStep = 'intro' | 'enter'
type Entry = (step: InviteStep) => void

const PLACEHOLDER: Entry = () => showToast('초대 화면은 곧 열려요')
let entry: Entry = PLACEHOLDER
let pendingStep: InviteStep = 'intro'

export function setInviteEntry(next: Entry | null): void {
  entry = next ?? PLACEHOLDER
}

export function openInvite(step: InviteStep): void {
  entry(step)
}

/** Shell의 입구가 이동 직전에 어느 단계로 열지 적어 둔다. */
export function setPendingInviteStep(step: InviteStep): void {
  pendingStep = step
}

/** 초대 화면이 열릴 때 한 번 읽는다(읽으면 기본값 `intro`로 돌아간다). */
export function consumeInviteStep(): InviteStep {
  const step = pendingStep
  pendingStep = 'intro'
  return step
}
