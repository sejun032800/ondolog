/**
 * 사진 고르기(E11·E10) - `expo-image-picker`의 시스템 선택 화면을 쓴다. 라이브러리 스캔·얼굴 인식 없음(R13-2).
 *
 * - 여러 장을 고르고, EXIF(촬영 시각·GPS)와 가로세로를 함께 받는다(`exif: true`).
 * - **원본 비율·크기를 줄이지 않는다** - `quality: 1`, 편집·크기 옵션 없음(표지 규칙이 원본 짧은 변 1170px을 본다, MASTER 9-5).
 * - 고른 결과를 `PickedPhoto`로 바꾸는 규칙은 `src/utils/dateRecord.ts` `photoFromPickerAsset`(순수)이다.
 */
import * as ImagePicker from 'expo-image-picker'
import { photoFromPickerAsset, type PickedPhoto } from '../utils/dateRecord'

/** 한 번에 고를 수 있는 최대 장수(시스템 선택 화면의 제한). 0이면 시스템 최대. */
export const PICK_LIMIT = 30

export async function pickPhotos(limit: number = PICK_LIMIT): Promise<PickedPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit !== 1,
    selectionLimit: limit,
    orderedSelection: true,
    exif: true,
    quality: 1,
  })
  if (result.canceled) return []
  return result.assets.map((asset) => photoFromPickerAsset(asset))
}

/** 앱의 파일 읽기 - 로컬 URI의 바이트(원본 그대로). */
export async function readLocalBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri)
  return response.arrayBuffer()
}
