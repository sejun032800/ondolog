/**
 * 채팅 시험 화면(G4용)의 개발용 문. 정식 채팅이 아니다(75-에서 지운다).
 * 열리는 때: 개발 서버(`npm run dev`) 또는 시험용 빌드(`npm run build:trial`, mode = trial).
 * 운영 빌드(`npm run build`)에서는 닫힌다 - 경로도 진입점도 없다.
 */
export const CHAT_TRIAL_PATH = '/dev/chat'

export function isChatTrialOpen(env: { DEV: boolean; MODE: string } = import.meta.env): boolean {
  return env.DEV === true || env.MODE === 'trial'
}
