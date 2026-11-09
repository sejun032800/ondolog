/**
 * 되돌릴 수 없는 확인(I05)의 **문구 직접 입력** 쪽 - 보드 `N-R43-App-States` ⓖ · `N-S-H3-Settings` H16. RN `components/nocturne/PhraseConfirm`의 웹판.
 * 짝 `components/ConfirmDialog`(지우기 · 취소 두 버튼)와 함께 I05를 이룬다: 가벼운 되돌릴 수 없음(기록 삭제)은 대화 상자, 무거운 것(연결 해제 · 탈퇴)은 이 화면이다.
 *
 * 이 틀은 화면과 문구만 모은다 - **무엇을 지우는지 · 어떤 함수를 부르는지 · 순서**는 부르는 화면(`UnlinkScreen` · `WithdrawScreen`)이 갖는다.
 * 확인어는 화면마다 **달라야 한다**(H14 `해제합니다` · H16 `탈퇴합니다`, 루트 `@/utils/dissolution`) - 한 번 쳐 본 손이 다른 화면에서 그대로 움직이면 안전장치가 타자 연습이 된다.
 * 확인어가 정확히 일치할 때만 [요청하기]가 켜진다. 입력 칸은 스크롤 본문 안에 있어 키보드가 올라오면 위로 올라온다(B9, `platform/keyboardFocus`).
 */
import { useState, type ReactNode } from 'react'
import { isPhraseMatch } from '@/utils/dissolution'
import { ListGroup, ListRow, SettingsFrame } from './parts'

export function PhraseConfirm({
  title, onBack, heading, children, pdfLabel, onOpenPdf, phrase, phraseLabel, hint, submitLabel, onSubmit, busy, error, testIdPrefix,
}: {
  title: string
  onBack: () => void
  heading: string
  /** 무엇이 지워지고 무엇이 남는지(카드). */
  children: ReactNode
  /** 발행물 PDF 저장 안내 줄(MASTER 9-6). */
  pdfLabel: string
  onOpenPdf: () => void
  /** 직접 입력해야 하는 확인어. */
  phrase: string
  phraseLabel: string
  /** 입력 아래 한 줄(없으면 그리지 않는다). */
  hint?: string
  submitLabel: string
  onSubmit: () => void
  busy: boolean
  error: string | null
  /** `unlink` -> `unlink-submit` 같은 시험용 이름 앞부분. */
  testIdPrefix: string
}) {
  const [typed, setTyped] = useState('')
  const matched = isPhraseMatch(typed, phrase)
  return (
    <SettingsFrame
      title={title}
      onBack={onBack}
      testId={`${testIdPrefix}-screen`}
      footer={<button type="button" className="btn press primary" disabled={!matched || busy} onClick={onSubmit} data-testid={`${testIdPrefix}-submit`}>{submitLabel}</button>}
    >
      <h2 className="t-display c-text pre">{heading}</h2>
      {children}
      <ListGroup>
        <ListRow label={pdfLabel} onPress={onOpenPdf} testId={`${testIdPrefix}-pdf-row`} />
      </ListGroup>

      <div className="fieldGroup">
        <label className="t-sub c-mute" htmlFor={`${testIdPrefix}-phrase`}>{phraseLabel}</label>
        <input
          id={`${testIdPrefix}-phrase`}
          className="setInput"
          value={typed}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setTyped(e.target.value)}
          data-testid={`${testIdPrefix}-phrase-input`}
        />
        {hint ? <p className="t-sub c-mute">{hint}</p> : null}
        {error ? <p className="t-sub c-sub" role="alert" data-testid={`${testIdPrefix}-error`}>{error}</p> : null}
      </div>
    </SettingsFrame>
  )
}

/** 확인 카드 안의 한 줄(점 + 글). 카드 소제목은 `PhraseConfirmCardTitle`. */
export function PhraseConfirmCard({ children }: { children: ReactNode }) {
  return <div className="phraseCard">{children}</div>
}
export function PhraseConfirmLine({ children }: { children: string }) {
  return <p className="t-body c-sub">{`• ${children}`}</p>
}
export function PhraseConfirmCardTitle({ children }: { children: string }) {
  return <p className="t-title c-text phraseCardTitle">{children}</p>
}
