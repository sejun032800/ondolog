import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { registerConnectionProbe, trackConnection } from './connectionMonitor';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

// I02 띠 풀기 확인: 감싸기 전 원래 `fetch`로 보낸다(감싸기를 지나지 않음). 헤더 없음(토큰 · 키 0) - 401이어도 응답이 오면 연결이다.
registerConnectionProbe((signal) => fetch(`${url}/auth/v1/health`, { method: 'GET', signal }));

export const supabase = createClient(url, anonKey, {
  // I02 연결 끊김 판정: 요청 결과만 읽는다(새 요청 없음, `connectionMonitor.ts`).
  global: { fetch: trackConnection((...args) => fetch(...args)) },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE: signInWithOAuth가 code_challenge를 생성하고, 콜백에서 받은
    // `code`를 exchangeCodeForSession으로 교환한다(액세스 토큰이 리다이렉트
    // URL에 노출되는 implicit 플로우 대신). React Native 수동 OAuth 플로우의
    // 3단계(socialAuth.ts)가 이 설정을 전제로 한다.
    flowType: 'pkce',
  },
});