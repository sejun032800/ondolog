/**
 * 대표사진(reference photo) 업로드 — 개인/커플 공용.
 *
 * 근거: docs/ONDOLOG_MASTER.md "연인 인식용 대표사진"
 *   "등록: 개인 1장 + 커플 1장, 프로필처럼 관리" / "수정: 설정 탭에서 언제든 교체".
 * 경로 규칙·정책은 `supabase/migrations/019_avatars_storage_policies.sql` 참조.
 *
 * ⚠️ 이 파일이 저장하는 것은 **사진 원본 파일**뿐이다. 얼굴 인식 SDK가
 * 아직 연동되지 않았고(다음 단계, 메인 세션), 이 파일은 얼굴 임베딩을
 * 계산·저장하는 코드를 전혀 포함하지 않는다 — CLAUDE.md 절대 규칙 1
 * ("얼굴 인식 특징 벡터를 서버로 전송·저장하는 코드를 절대 작성하지
 * 않는다")을 위반할 여지 자체가 없도록 이 계층에서 원천 차단한다.
 *
 * 경로는 확장자 없이 고정 파일명 `{ownerId}/reference`를 쓴다 — 매번
 * 같은 키로 upsert하므로 "교체"해도 확장자가 다른 과거 파일이 고아로
 * 남지 않는다. content-type은 업로드하는 Blob이 이미 들고 있는 값을
 * 그대로 쓴다(플레이스홀더 자산이든 실제 갤러리 사진이든 `fetch(uri)`가
 * 반환하는 Blob에는 원본 MIME 타입이 들어있다).
 */
import { supabase } from './supabase'

export type ReferencePhotoTarget = 'personal' | 'couple'

export interface UploadReferencePhotoInput {
  target: ReferencePhotoTarget
  /** target: 'personal'이면 userId, 'couple'이면 coupleId. Storage 경로 1번째 세그먼트로도 쓰인다. */
  ownerId: string
  /** RN `Image`가 그대로 렌더링할 수 있는 로컬 URI(플레이스홀더 자산 `Image.resolveAssetSource(...).uri` 포함). */
  localUri: string
}

const BUCKET = 'avatars'
/** 미리보기용 서명 URL 유효 시간 — 화면에 떠 있는 동안만 필요하므로 짧게 잡는다. */
const SIGNED_URL_TTL_SECONDS = 5 * 60

function storagePathFor(ownerId: string): string {
  return `${ownerId}/reference`
}

/**
 * `avatars` 버킷은 비공개다(015_storage_policies.sql) — 이미 저장된
 * 대표사진을 화면에 미리보기로 띄우려면 매번 서명 URL을 새로 발급해야
 * 한다. 실패하면(권한 문제, 파일 없음 등) 조용히 null을 반환한다 —
 * 호출부는 "미등록"과 동일하게 처리하면 된다.
 */
export async function getReferencePhotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) return null
  return data.signedUrl
}

/**
 * 로컬 URI를 avatars 버킷에 업로드하고, 해당 테이블(profiles 또는
 * couples)의 `reference_photo_path`를 함께 갱신한다. 두 단계 중
 * 하나라도 실패하면 던진다 — 호출부(스토어)가 그대로 전파해 사용자에게
 * 실패를 보여준다.
 */
export async function uploadReferencePhoto(input: UploadReferencePhotoInput): Promise<string> {
  const path = storagePathFor(input.ownerId)

  const response = await fetch(input.localUri)
  const blob = await response.blob()

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { error: dbError } =
    input.target === 'personal'
      ? await supabase.from('profiles').update({ reference_photo_path: path }).eq('id', input.ownerId)
      : await supabase.from('couples').update({ reference_photo_path: path }).eq('id', input.ownerId)
  if (dbError) throw dbError

  return path
}
