/**
 * 76-B4(R99-2 P2): 상세 사진 칸은 사진이 오기 전에 크기가 정해진다. 큰 사진(한 장짜리 칸)은 `data_entries.width/height`가 있으면 그 비율로, 없으면 지금 고정 높이(CSS 150px)로 둔다.
 * 비율이 너무 길거나 납작하면 화면을 독차지하거나 가는 띠가 되므로 `[PHOTO_BOX_RATIO_MIN, PHOTO_BOX_RATIO_MAX]`로 자른다(칸은 object-fit: cover로 채운다).
 */
export const PHOTO_BOX_RATIO_MIN = 0.75
export const PHOTO_BOX_RATIO_MAX = 1.78

/** 가로 / 세로 비율(자른 값). 크기를 모르거나 0 이하면 null. */
export function photoBoxRatio(width: number | null | undefined, height: number | null | undefined): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null
  return Math.min(PHOTO_BOX_RATIO_MAX, Math.max(PHOTO_BOX_RATIO_MIN, width / height))
}
