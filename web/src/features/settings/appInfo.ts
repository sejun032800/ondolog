/**
 * H19 앱 정보 값. 버전은 웹 앱 `web/package.json`의 `version`이다(RN은 Expo 설정 값을 보였다). 안드로이드 `versionName`(네이티브 파일)은
 * 웹 화면에서 읽을 수 없고 손으로 고치지 않는다 - 둘이 다르면 이 값이 화면에 보이는 값이다(결정 기록 [74-7]).
 */
import pkg from '../../../package.json'

export function appVersion(): string {
  return pkg.version
}

/**
 * 문의 메일에 넣는 OS 값 - 웹뷰의 userAgent에서 읽는다. 루트 `osLabel`은 모르는 OS 이름을 그대로 쓰므로 "Android 14" 같은 글자를 `os`에 담고 버전은 비운다
 * (안드로이드 userAgent의 숫자는 API 레벨이 아니라 릴리스 번호라 "API"를 붙이지 않는다). 읽지 못하면 "web".
 */
export function osFacts(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): { os: string; osVersion: null } {
  const android = /Android\s+([\d.]+)/i.exec(ua)
  if (android) return { os: `Android ${android[1]}`, osVersion: null }
  const ios = /OS\s+([\d_]+)\s+like Mac OS X/i.exec(ua)
  if (ios) return { os: `iOS ${ios[1].replace(/_/g, '.')}`, osVersion: null }
  return { os: 'web', osVersion: null }
}
