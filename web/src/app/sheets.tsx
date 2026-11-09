/**
 * 앱 시트(`stores/sheetStore`의 `SheetId`)와 그리는 법. 새 시트를 더할 때: `SheetId`에 이름 -> 여기 `SHEET_BODIES`에 본문.
 * `SheetHost`는 Shell에 하나만 둔다 - 한 번에 하나만 그려진다(B4 · B12).
 */
import type { ReactNode } from 'react'
import { CoupleGateSheetBody } from '../components/CoupleGate'
import { RecordSheetBody } from '../features/feed/RecordSheet'
import { Sheet } from '../components/Sheet'
import { useSheetStore, type SheetId } from '../stores/sheetStore'

const SHEET_BODIES: Record<SheetId, { variant: 'auto' | 'full'; body: () => ReactNode }> = {
  'couple-gate': { variant: 'auto', body: () => <CoupleGateSheetBody /> },
  // E11 데이트 기록 쓰기(74-4): 피드 탭의 + 버튼이 연다. E10은 없앴다.
  record: { variant: 'full', body: () => <RecordSheetBody /> },
}

export function SheetHost() {
  const current = useSheetStore((s) => s.current)
  if (!current) return null
  const def = SHEET_BODIES[current]
  return (
    <Sheet key={current} variant={def.variant} testId={`sheet-${current}`} onClosed={() => useSheetStore.getState().close(current)}>
      {def.body()}
    </Sheet>
  )
}
