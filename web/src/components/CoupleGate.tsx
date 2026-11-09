/**
 * 커플 전용 기능 공통 래퍼(MASTER Part 9-1 "미연결 유저 처리 원칙" · 11-2). 진입 차단이 아니라 기능 단위 게이팅 -
 * 미연결 유저도 모든 탭에 들어온다. 이 컴포넌트는 연결 여부만 읽는다(`useCoupleStore`) - 연결 판정은 서버 조회 결과를 그대로 반영한다.
 *
 * I01(B4 · B12 재발 막기)
 *  - **탭 화면은 화면 안 안내**(`CoupleNeeded` 카드)다. 화면이 열릴 때 시트가 저절로 뜨지 않는다.
 *  - **시트(`couple-gate`)는 사용자가 커플 기능을 누를 때 한 번**(`useCoupleAction`)만 열린다. 시트 자리는 하나라 겹쳐 쌓이지 않고, 경로가 바뀌면 닫힌다.
 *  - 카드에는 시트 손잡이가 없고, 버튼은 바로 초대로 간다(같은 문구 시트를 한 번 더 열지 않는다).
 * 서버 조회 전(`unknown` · `loading`)에는 아무것도 확정하지 않는다(안내가 번쩍이지 않게 비운다).
 */
import type { ReactNode } from 'react'
import { openInvite } from '../app/inviteEntry'
import { useCoupleStore } from '../stores/coupleStore'
import { useSheetStore } from '../stores/sheetStore'
import { PrimaryButton } from '../ui'
import { useSheetClose } from './Sheet'

/** I01 문구 - 보드 I01(`N-S-H4-Settings`). */
export const GATE_COPY = {
  title: '여기까지 왔어요. 상대만 있으면 돼요',
  body: '두 사람의 기록을 한 타임라인으로 보려면 연인과 연결해요.',
  invite: '초대 코드 보내기',
  enter: '받은 코드 입력하기',
} as const

/** I01 본문(두 원 + 제목 + 설명 + 버튼 둘). 시트와 화면 안 카드가 같이 쓴다. */
export function CoupleNeededBody({ onInvite, onEnter, copy }: {
  onInvite: () => void
  onEnter: () => void
  /** 화면별 문구(채팅 F02 등). 없으면 I01 기본 문구. 버튼 문구는 늘 같다. */
  copy?: { title: string; body: string }
}) {
  return (
    <div className="gateBody" data-testid="couple-gate">
      <div className="gateCircles" aria-hidden="true"><i className="self" /><i className="other" /></div>
      <h2 className="gateTitle">{copy?.title ?? GATE_COPY.title}</h2>
      <p className="gateText">{copy?.body ?? GATE_COPY.body}</p>
      <div className="gateButton"><PrimaryButton label={GATE_COPY.invite} onClick={onInvite} /></div>
      <button type="button" className="gateLink press" onClick={onEnter}>{GATE_COPY.enter}</button>
    </div>
  )
}

/** 탭 화면 안의 안내 카드(손잡이 없음). 누르면 바로 초대로 간다. */
export function CoupleNeeded({ copy }: { copy?: { title: string; body: string } }) {
  return (
    <div className="gateCard" data-testid="couple-needed">
      <CoupleNeededBody copy={copy} onInvite={() => openInvite('intro')} onEnter={() => openInvite('enter')} />
    </div>
  )
}

/** 시트 안(`app/sheets.tsx`) - 버튼을 누르면 시트를 닫고 초대로 간다. */
export function CoupleGateSheetBody() {
  const close = useSheetClose()
  return (
    <CoupleNeededBody
      onInvite={() => { close(); openInvite('intro') }}
      onEnter={() => { close(); openInvite('enter') }}
    />
  )
}

export function CoupleGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const status = useCoupleStore((s) => s.status)
  if (status === 'connected') return <>{children}</>
  if (status !== 'disconnected') return null
  return <>{fallback ?? <CoupleNeeded />}</>
}

/**
 * 커플 전용 기능 버튼용: 연결돼 있으면 `action`을 하고, 아니면(조회가 끝난 미연결일 때만) I01 시트를 **한 번** 연다.
 * 조회 전에는 아무것도 하지 않는다. 시트가 이미 열려 있으면 다시 열지 않는다.
 */
export function useCoupleAction(): (action: () => void) => void {
  const status = useCoupleStore((s) => s.status)
  return (action) => {
    if (status === 'connected') action()
    else if (status === 'disconnected') useSheetStore.getState().open('couple-gate')
  }
}
