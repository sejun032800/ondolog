/**
 * 대표사진 등록 화면(화면 C)의 임시 "사진 선택" 소스.
 *
 * 근거: 2026-08-27 코디네이터 결정 — "플레이스홀더 선택 + 실제 업로드
 * 로직". 실제 갤러리 접근(`expo-image-picker`)은 네이티브 모듈 추가가
 * 필요해 Phase 6 일괄 Dev Build 재빌드로 미뤘다(`.claude/state/
 * DECISIONS.md` 참조) — 그 전까지는 이미 번들에 있는 정적 이미지 중
 * 하나를 "고른 사진"으로 취급해, 저장·미리보기·Storage 업로드는 전부
 * 실제로 동작하게 한다. 실제 갤러리 연동 시 이 배열과
 * `resolvePlaceholderUri` 호출부만 `expo-image-picker`의 결과로
 * 바꾸면 되고, `ReferencePhotoSlot`의 저장/미리보기 로직은 그대로
 * 재사용된다.
 */
import { Image, type ImageSourcePropType } from 'react-native'

export interface ReferencePhotoPlaceholder {
  key: string
  label: string
  source: ImageSourcePropType
}

export const REFERENCE_PHOTO_PLACEHOLDERS: ReferencePhotoPlaceholder[] = [
  { key: 'sample-1', label: '샘플 1', source: require('../../assets/icon.png') },
  { key: 'sample-2', label: '샘플 2', source: require('../../assets/splash-icon.png') },
  { key: 'sample-3', label: '샘플 3', source: require('../../assets/android-icon-foreground.png') },
]

/** 번들 자산(require 결과)을 `Image`/`fetch`가 다룰 수 있는 URI 문자열로 바꾼다. */
export function resolvePlaceholderUri(source: ImageSourcePropType): string {
  return Image.resolveAssetSource(source).uri
}
