/**
 * 개발 빌드 전용 컴포넌트 확인 화면 진입점 (Nocturne v5 U0, `53-`).
 * Part 11-3 라우트 표에 없는 화면이다 - 출시 빌드에서는 닿지 않는다:
 *  - 확인 화면 본체는 `if (__DEV__)` 안에서만 require한다. 출시 번들은 `__DEV__`를 false로
 *    접어 이 분기를 지우므로 본체가 번들에 들어가지 않는다(분기는 반드시 이 긍정형이어야 한다 -
 *    `if (!__DEV__) return` 뒤에 둔 require는 번들러가 지우지 못한다).
 *  - `__DEV__`가 아니면 루트로 되돌린다.
 *  - 앱 어디에도 이 경로로 가는 링크를 두지 않는다. 개발 중에는 `ondolog://dev-components`로 연다.
 */
import { Redirect } from 'expo-router'

export default function DevComponentsRoute() {
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ComponentGallery = require('../src/components/nocturne/dev/ComponentGallery').default
    return <ComponentGallery />
  }
  return <Redirect href="/" />
}
