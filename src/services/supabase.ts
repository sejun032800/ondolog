import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

export const supabase = createClient(url, anonKey, {
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