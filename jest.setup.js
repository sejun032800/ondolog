/**
 * Jest 전역 설정.
 *
 * `src/theme/index.ts`(테마 수동 선택 저장)가 `@react-native-async-storage/
 * async-storage`를 쓰는데, 이 네이티브 모듈은 테스트 환경(Node, 실제
 * 기기 아님)에 존재하지 않는다 — 패키지가 공식 제공하는 목(mock)으로
 * 대체한다. (https://react-native-async-storage.github.io/async-storage/docs/advanced/jest)
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
