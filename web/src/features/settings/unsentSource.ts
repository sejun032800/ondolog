/**
 * 83- 덧붙임(81-b 폰 확인 11번): 로그아웃 확인 창이 세는 "아직 보내지 못한 메시지"의 메모리 쪽 - 앱의 허브 하나(글 · 사진)가 지금 갖고 있는 것.
 * 기기 저장(`unsentCount.ts`)만 세면 방금 보낸 글(첫 시도 진행 중 · 큐에 들어갔지만 저장이 끝나기 전)이 0으로 보인다.
 * 읽기만 한다(보내기 · 저장 · 지우기 0).
 */
import { textQueueHub, type UnsentRef } from '../chat/textQueueHub'
import { photoQueueHub } from '../../photoQueue/photoQueueHub'

export interface UnsentSource {
  /** 글 · 사진 각각 아직 서버가 확정하지 않은 항목. */
  text: () => UnsentRef[]
  photo: () => UnsentRef[]
  /** 바뀌면 부른다. 해제 함수. */
  subscribe: (onChange: () => void) => () => void
}

export const hubUnsentSource: UnsentSource = {
  text: () => textQueueHub.unsent(),
  photo: () => photoQueueHub.unsent(),
  subscribe: (onChange) => {
    const offText = textQueueHub.subscribe({ onTextQueue: onChange, onSending: onChange })
    const offPhoto = photoQueueHub.subscribe({ onPhotoQueue: onChange })
    return () => {
      offText()
      offPhoto()
    }
  },
}
