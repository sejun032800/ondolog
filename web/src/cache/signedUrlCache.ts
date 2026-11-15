/**
 * 이미 받은 서명 URL을 이 실행의 메모리에만 둔다(76-B3 · B5) - 화면을 다시 그릴 때 같은 사진을 다시 서명받지 않고 바로 그린다.
 * 기기에 저장하지 않는다(서명은 만료된다). 만료 전에 쓰도록 짧은 유효 시간을 둔다. 로그아웃 · 탈퇴 때 비운다(`resetAccountMemory`).
 */
/** 서명(1시간)이 끝나기 전에 쓰도록 이보다 짧게. */
export const SIGNED_URL_TTL_MS = 45 * 60 * 1000

const urls = new Map<string, { url: string; at: number }>()
const k = (bucket: string, path: string) => `${bucket}/${path}`

export function getSignedUrl(bucket: string, path: string, now = Date.now()): string | undefined {
  const hit = urls.get(k(bucket, path))
  if (!hit) return undefined
  if (now - hit.at > SIGNED_URL_TTL_MS) {
    urls.delete(k(bucket, path))
    return undefined
  }
  return hit.url
}

export function putSignedUrls(bucket: string, signed: Record<string, string>, now = Date.now()): void {
  for (const [path, url] of Object.entries(signed)) urls.set(k(bucket, path), { url, at: now })
}

export function clearSignedUrlCache(): void {
  urls.clear()
}
