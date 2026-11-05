/**
 * 되돌릴 수 없는 확인(I05)의 **문구 직접 입력** 쪽 - 디자인 `N-R43-App-States` ⓖ · `N-S-H3-Settings` H16.
 * 짝 컴포넌트 `ConfirmDialog`(지우기 · 취소 두 버튼)와 함께 I05를 이룬다: 가벼운 되돌릴 수 없음(기록 삭제)은 대화 상자, 무거운 것(연결 해제 · 탈퇴)은 이 화면이다.
 *
 * 이 틀은 화면과 문구만 모은다 - **무엇을 지우는지 · 어떤 함수를 부르는지 · 순서**는 부르는 화면(`settings-unlink` · `settings-withdraw`)이 그대로 갖는다.
 * 확인어는 화면마다 **달라야 한다**(H14 `해제합니다` · H16 `탈퇴합니다`, `src/utils/dissolution.ts`) - 한 번 쳐 본 손이 다른 화면에서 그대로 움직이면
 * 안전장치가 타자 연습이 된다. 확인어가 정확히 일치할 때만 [요청하기]가 켜진다.
 */
import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput } from 'react-native'
import { SettingsScreen } from '../settings/SettingsScreen'
import { nocturne, shape, type } from '../../theme/nocturne'
import { isPhraseMatch } from '../../utils/dissolution'
import { PrimaryButton } from './Buttons'
import { ListGroup, ListRow } from './ListGroup'

export interface PhraseConfirmProps {
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
  testIDPrefix: string
}

export function PhraseConfirm({
  title,
  onBack,
  heading,
  children,
  pdfLabel,
  onOpenPdf,
  phrase,
  phraseLabel,
  hint,
  submitLabel,
  onSubmit,
  busy,
  error,
  testIDPrefix,
}: PhraseConfirmProps) {
  const [typed, setTyped] = useState('')
  const matched = isPhraseMatch(typed, phrase)
  return (
    <SettingsScreen
      title={title}
      onBack={onBack}
      footer={<PrimaryButton label={submitLabel} onPress={onSubmit} disabled={!matched || busy} testID={`${testIDPrefix}-submit`} />}
    >
      <Text style={styles.heading}>{heading}</Text>
      {children}
      <ListGroup>
        <ListRow label={pdfLabel} onPress={onOpenPdf} testID={`${testIDPrefix}-pdf-row`} />
      </ListGroup>

      <Text style={styles.label}>{phraseLabel}</Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={nocturne.lilac}
        style={styles.input}
        accessibilityLabel={phraseLabel}
        testID={`${testIDPrefix}-phrase-input`}
      />
      {hint ? <Text style={styles.label}>{hint}</Text> : null}
      {error ? (
        <Text style={styles.label} accessibilityRole="alert" testID={`${testIDPrefix}-error`}>
          {error}
        </Text>
      ) : null}
    </SettingsScreen>
  )
}

/** 확인 카드 안의 한 줄(점 + 글). 카드 소제목은 `PhraseConfirmCardTitle`. */
export function PhraseConfirmLine({ children }: { children: string }) {
  return <Text style={styles.line}>{`• ${children}`}</Text>
}

export function PhraseConfirmCardTitle({ children }: { children: string }) {
  return <Text style={styles.cardTitle}>{children}</Text>
}

const styles = StyleSheet.create({
  heading: { ...type.display, color: nocturne.text },
  cardTitle: { ...type.title, fontSize: 16, color: nocturne.text, marginTop: 4 },
  line: { ...type.body, color: nocturne.textSub },
  label: { ...type.sub, color: nocturne.textMute },
  input: {
    ...type.body,
    fontSize: 17,
    height: 56,
    borderRadius: shape.radius.button,
    borderWidth: 1,
    borderColor: nocturne.hairline,
    backgroundColor: nocturne.inkRaise,
    color: nocturne.text,
    paddingHorizontal: 18,
  },
})
