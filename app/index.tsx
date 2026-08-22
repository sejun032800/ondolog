import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../src/services/supabase';

export default function Index() {
  const [status, setStatus] = useState('확인 중...');

  useEffect(() => {
    supabase.auth.getSession()
      .then(() => setStatus('Supabase 연결 성공'))
      .catch((e) => setStatus(`실패: ${e.message}`));
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>ONDOLOG</Text>
      <Text style={{ marginTop: 8, opacity: 0.6 }}>{status}</Text>
    </View>
  );
}