/**
 * 사진 입구 시트 - [앨범] · [카메라]. 채팅 첨부(F04) · 피드 기록 시트의 사진 + · 데이트 상세 [사진 더하기]가 같은 부품을 쓴다(74-h4 B1).
 * 보드의 "최근 사진" 격자는 넣지 않았다(사진 라이브러리를 훑지 않는다 - R13-2, 결정 기록 [74-5]).
 * 탭 화면 · 시트 안에서 열어도 탭 바 · 앞 시트 위에 오도록 `PhoneLayer`로 그린다. 뒤로 가기는 `Sheet`의 규칙(가장 나중에 연 것이 먼저 닫힘)을 따른다.
 */
import { PhoneLayer } from './PhoneLayer'
import { Sheet, useSheetClose } from './Sheet'

export const PHOTO_SOURCE_COPY = { album: '앨범', camera: '카메라' } as const
/** [카메라]: 웹 입력 `capture`로 연다. 기기에서 안 열리면 이 값만 false로(버튼이 사라진다). 결정 기록 [74-5] 카메라. */
export const PHOTO_CAMERA_ENABLED = true

function PhotoSourceBody({ onAlbum, onCamera }: { onAlbum: () => void; onCamera: () => void }) {
  const close = useSheetClose()
  return (
    <div className="attachBody" data-testid="chat-attach-sheet-body">
      <button type="button" className="attachOption press" data-testid="chat-attach-album" onClick={() => { close(); onAlbum() }}>{PHOTO_SOURCE_COPY.album}</button>
      {PHOTO_CAMERA_ENABLED ? (
        <button type="button" className="attachOption press" data-testid="chat-attach-camera" onClick={() => { close(); onCamera() }}>{PHOTO_SOURCE_COPY.camera}</button>
      ) : null}
    </div>
  )
}

export function PhotoSourceSheet({ testId, onAlbum, onCamera, onClosed }: { testId: string; onAlbum: () => void; onCamera: () => void; onClosed: () => void }) {
  return (
    <PhoneLayer>
      <Sheet variant="auto" testId={testId} onClosed={onClosed}>
        <PhotoSourceBody onAlbum={onAlbum} onCamera={onCamera} />
      </Sheet>
    </PhoneLayer>
  )
}
