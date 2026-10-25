/**
 * 채팅 입력창(F01) · 연결 끊김 안내(F05) · 첨부 시트(F04).
 *
 * - 입력창: 알약 안에 [+] 첨부 · 입력 · [↑] 보내기(rose 원). 보낼 수 없는 본문(공백뿐)이면 보내기가 비활성이다 -
 *   막는 규칙은 API·훅과 같은 `canSendBody` 하나다(R21-5). placeholder는 비활성 컨트롤이 아니라 `textMute`다.
 * - 첨부 시트(F04): 시스템 사진 선택기로 간다(R30-5). 보드의 [카메라]와 "최근 사진" 격자는 넣지 않았다 -
 *   카메라는 `app.json` 권한 설정이, 최근 사진 격자는 미디어 라이브러리 의존성이 새로 필요하다(보고).
 * - 시트의 나가는 길은 보드대로 손잡이 + 바깥(어둡게 한 면)을 누르기다.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'
import { canSendBody } from '../../utils/chatMessages'
import { PressScale } from '../nocturne/PressScale'
import { MESSAGE_COPY } from './Messages'

export const COMPOSER_COPY = {
  placeholder: '메시지 보내기',
  album: '앨범',
  attach: '첨부',
  send: '보내기',
  closeSheet: '닫기',
} as const

export interface ComposerProps {
  onSend: (body: string) => void
  onAttach: () => void
  /** 입력창 아래 여백(탭 바 위로 띄우는 값). */
  bottomOffset: number
}

export function Composer({ onSend, onAttach, bottomOffset }: ComposerProps) {
  const [text, setText] = useState('')
  const sendable = canSendBody(text)
  const send = () => {
    if (!canSendBody(text)) return
    const body = text
    setText('')
    onSend(body)
  }
  return (
    <View style={[styles.wrap, { paddingBottom: bottomOffset }]} testID="chat-composer">
      <View style={styles.pill}>
        <PressScale onPress={onAttach} accessibilityLabel={COMPOSER_COPY.attach} style={styles.plus} testID="chat-attach">
          <Text style={styles.plusMark}>+</Text>
        </PressScale>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={COMPOSER_COPY.placeholder}
          placeholderTextColor={nocturne.textMute}
          multiline
          style={styles.input}
          testID="chat-input"
        />
        <PressScale
          onPress={send}
          disabled={!sendable}
          accessibilityLabel={COMPOSER_COPY.send}
          style={[styles.send, sendable ? styles.sendOn : styles.sendOff]}
          testID="chat-send"
        >
          <Text style={[styles.sendMark, sendable ? styles.sendMarkOn : styles.sendMarkOff]}>{'↑'}</Text>
        </PressScale>
      </View>
    </View>
  )
}

/** F05: 연결이 끊겨 자동으로 다시 보내는 중인 메시지가 있을 때 머리 아래에 한 줄. 정지 점 - 스피너 없음. */
export function OfflineBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert" testID="chat-offline-banner">
      <View style={styles.dot} />
      <Text style={styles.bannerText}>{MESSAGE_COPY.offline}</Text>
    </View>
  )
}

export interface AttachSheetProps {
  onAlbum: () => void
  onClose: () => void
}

export function AttachSheet({ onAlbum, onClose }: AttachSheetProps) {
  return (
    <View style={styles.sheetRoot} testID="chat-attach-sheet">
      <Pressable
        style={styles.dim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={COMPOSER_COPY.closeSheet}
        testID="chat-attach-dim"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <PressScale onPress={onAlbum} accessibilityLabel={COMPOSER_COPY.album} style={styles.albumButton} testID="chat-attach-album">
          <Text style={styles.albumLabel}>{COMPOSER_COPY.album}</Text>
        </PressScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  pill: {
    minHeight: 48,
    maxHeight: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 6,
    borderRadius: 24,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.1),
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusMark: { fontFamily: fontFamily.regular, fontSize: 20, lineHeight: 24, color: nocturne.textSub },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fontFamily.regular,
    fontSize: 14.5,
    lineHeight: 20,
    color: nocturne.text,
  },
  send: { width: 36, height: 36, borderRadius: shape.radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: nocturne.rose },
  sendOff: { backgroundColor: withAlpha(nocturne.text, 0.06) },
  sendMark: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 20 },
  sendMarkOn: { color: nocturne.ink },
  sendMarkOff: { color: nocturne.textFaint },

  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 40,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.08),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: shape.radius.pill, backgroundColor: nocturne.textMute },
  bannerText: { fontFamily: fontFamily.regular, fontSize: 12.5, lineHeight: 18, color: nocturne.textSub },

  sheetRoot: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(nocturne.ink, 0.5) },
  sheet: {
    borderTopLeftRadius: shape.radius.sheet,
    borderTopRightRadius: shape.radius.sheet,
    backgroundColor: nocturne.inkRaise,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: nocturne.hairline,
    paddingTop: 12,
    paddingHorizontal: shape.space.screen,
    paddingBottom: 40,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.text, 0.2),
  },
  albumButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumLabel: { fontFamily: fontFamily.medium, fontSize: 14.5, color: nocturne.text },
})
