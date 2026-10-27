-- 연애유형 라벨 36행 시드 + 재검사 행 구멍 막기 (028).
-- 근거: SCHEMA 9-G(028 줄), 4-3, MASTER 10-5-1 · 10-5-2, ROADMAP R44-1~3 · R44-3. 위임 `69-` 1부.
-- 001~027은 이미 적용된 것이라 고치지 않는다.
--
-- 발견 (조사 `69-` 0-a):
--   1) 원격 love_type_labels 가 0행이다(description_ko 도 0건). 016 은 처음 적용될 때 INSERT 없이 보류된 파일이었고(2026-08-24),
--      36행 INSERT 는 그 뒤(2026-08-31) 같은 파일 016 에 채워졌다. 마이그레이션은 한 번 적용되면 다시 돌지 않아서 원격에는 한 번도 안 들어갔다.
--      supabase/seed.sql 은 없다 - 원인은 "적용된 마이그레이션 파일을 고친 것"이다. 020(description_ko UPDATE)도 같은 이유로 0건 갱신됐다.
--   2) 027 의 재검사 복구 경로(fn_complete_retest)는 love_type_labels 에서 love_type_code 를 읽는다. 표가 비면 P0002 로 끝난다.
--   3) personality_assessments INSERT 정책이 user_id = auth.uid() 만 본다. 앱이 seq = 2 행을 직접 넣을 수 있고,
--      그러면 복구 경로가 앱이 넣은 값으로 재검사를 끝낸다(채점 결과는 재검사 함수 인자로만 들어가야 한다).
--
-- 이 파일이 하는 일 (027 함수 · 다른 정책 · 칸 단위 권한 · 배치 함수 · pg_cron 은 바꾸지 않는다):
--   1) love_type_labels 36행 - 원본은 MASTER 10-5-2(코드 · 영문 · 한글 · 카피) 와 10-5-1(코어 영문 · 접미사 · 코어 번호 · 애착 · 엘리전).
--      칸 대응: code=코드, enneagram_core=코어 번호(10-5-2 소제목), attachment=애착(안정 secure · 불안 anxious · 회피 avoidant · 혼란 fearful),
--      core_en=코어(10-5-1), suffix_en=접미사(10-5-1), label_en=영문, label_ko=한글, copy_ko=카피.
--      엘리전 규칙(10-5-1): E 로 끝나는 코어 MUSE · LORE 는 -EMBER 와 만날 때 E 하나를 흡수한다 -> MUSEMBER · LOREMBER (아래 MSE · LRE 행).
--      description_ko 는 MASTER 10-5-2 에 없는 칸이라 이 파일이 건드리지 않는다(on conflict 의 set 에도 없다) - 020 의 영역이다.
--      on conflict (code) do update 로 멱등: 016 이 이미 채워진 환경(신규 로컬 등)에서도 안전하고, 이미 있는 description_ko 는 보존된다.
--      016 과 같은 36행이다 - __tests__/constants/loveTypeLabelsSeed.test.ts 가 016 · 028 · MASTER 10-5-2 를 대조한다.
--   2) personality_assessments INSERT 정책 assessments_insert 의 with check 에 seq = 1 을 더한다.
--      재검사 행(seq = 2)은 fn_complete_retest(security definer, 테이블 소유자)만 만든다 - 소유자는 RLS 를 거치지 않는다.
--      가입 경로(personalityCore: seq 1 INSERT)는 그대로 통과한다. SELECT 정책(assessments_select)은 그대로, UPDATE · DELETE 정책은 처음부터 없다(불변 로그).
--
-- RLS: 새 테이블이 없다. love_type_labels 는 004 에서 enable row level security, 012 의 labels_select(전체 공개 읽기)가 그대로이고
--      INSERT · UPDATE · DELETE 정책이 없어 클라이언트는 쓰지 못한다(이 INSERT 는 마이그레이션 실행 역할이 한다).
--      personality_assessments 도 RLS 는 012 에서 켜져 있고 이 파일은 정책 본문만 바꾼다.

insert into public.love_type_labels
  (code, enneagram_core, attachment, core_en, suffix_en, label_en, label_ko, copy_ko)
values
  ('KLE', 1, 'secure', 'KEEL', 'EMBER', 'KEELEMBER', '온돌 같은 원칙주의자', '늘 같은 온도로 곁에 있는 사람'),
  ('KLF', 1, 'anxious', 'KEEL', 'FLARE', 'KEELFLARE', '달아오르는 원칙주의자', '잘하고 싶어서 혼자 뜨거워지는 사람'),
  ('KLS', 1, 'avoidant', 'KEEL', 'FROST', 'KEELFROST', '새벽 같은 원칙주의자', '아무도 없는 시간에 기준을 지키는 사람'),
  ('KLT', 1, 'fearful', 'KEEL', 'TIDE', 'KEELTIDE', '일교차 큰 원칙주의자', '원칙과 마음의 온도가 다른 사람'),
  ('BLE', 2, 'secure', 'BALM', 'EMBER', 'BALMEMBER', '봄볕 같은 조력자', '부담 없이 스며드는 사람'),
  ('BLF', 2, 'anxious', 'BALM', 'FLARE', 'BALMFLARE', '활활 타는 조력자', '다 주고도 더 줄 게 없나 찾는 사람'),
  ('BLS', 2, 'avoidant', 'BALM', 'FROST', 'BALMFROST', '달빛 같은 조력자', '티 내지 않고 비춰주는 사람'),
  ('BLT', 2, 'fearful', 'BALM', 'TIDE', 'BALMTIDE', '여우비 같은 조력자', '웃으면서 서운해하는 사람'),
  ('AXE', 3, 'secure', 'APEX', 'EMBER', 'APEXEMBER', '화롯불 같은 승부사', '나란히 타오를 줄 아는 사람'),
  ('AXF', 3, 'anxious', 'APEX', 'FLARE', 'APEXFLARE', '이글거리는 승부사', '인정받고 싶어 더 달리는 사람'),
  ('AXS', 3, 'avoidant', 'APEX', 'FROST', 'APEXFROST', '별빛 같은 승부사', '멀리서 혼자 빛나는 사람'),
  ('AXT', 3, 'fearful', 'APEX', 'TIDE', 'APEXTIDE', '번개 같은 승부사', '번쩍하고 사라지는 사람'),
  ('MSE', 4, 'secure', 'MUSE', 'EMBER', 'MUSEMBER', '모닥불 같은 낭만주의자', '깊고 오래 타는 사람'),
  ('MSF', 4, 'anxious', 'MUSE', 'FLARE', 'MUSEFLARE', '열대야 같은 낭만주의자', '사랑 때문에 잠 못 드는 사람'),
  ('MSS', 4, 'avoidant', 'MUSE', 'FROST', 'MUSEFROST', '안개 같은 낭만주의자', '가까이 가면 흩어지는 사람'),
  ('MST', 4, 'fearful', 'MUSE', 'TIDE', 'MUSETIDE', '파도 같은 낭만주의자', '밀려왔다 밀려가는 사람'),
  ('LRE', 5, 'secure', 'LORE', 'EMBER', 'LOREMBER', '체온 같은 관찰자', '조용하지만 늘 곁에 있는 사람'),
  ('LRF', 5, 'anxious', 'LORE', 'FLARE', 'LOREFLARE', '끓어오르는 관찰자', '속으로만 뜨거워지는 사람'),
  ('LRS', 5, 'avoidant', 'LORE', 'FROST', 'LOREFROST', '서늘한 관찰자', '딱 그만큼의 거리를 지키는 사람'),
  ('LRT', 5, 'fearful', 'LORE', 'TIDE', 'LORETIDE', '환절기의 관찰자', '다가섰다 물러나길 반복하는 사람'),
  ('OTE', 6, 'secure', 'OATH', 'EMBER', 'OATHEMBER', '햇살 같은 의리파', '어떤 날에도 뜨는 사람'),
  ('OTF', 6, 'anxious', 'OATH', 'FLARE', 'OATHFLARE', '한여름의 의리파', '확인받아야 잠드는 사람'),
  ('OTS', 6, 'avoidant', 'OATH', 'FROST', 'OATHFROST', '겨울밤 같은 의리파', '믿기까지 오래 걸리는 사람'),
  ('OTT', 6, 'fearful', 'OATH', 'TIDE', 'OATHTIDE', '소나기 같은 의리파', '믿고 싶은데 자꾸 흔들리는 사람'),
  ('RHE', 7, 'secure', 'RUSH', 'EMBER', 'RUSHEMBER', '한낮 같은 모험가', '신나는데 든든하기까지 한 사람'),
  ('RHF', 7, 'anxious', 'RUSH', 'FLARE', 'RUSHFLARE', '활화산 같은 모험가', '함께일 때 가장 뜨거운 사람'),
  ('RHS', 7, 'avoidant', 'RUSH', 'FROST', 'RUSHFROST', '바람 같은 모험가', '잡으려 하면 빠져나가는 사람'),
  ('RHT', 7, 'fearful', 'RUSH', 'TIDE', 'RUSHTIDE', '돌풍 같은 모험가', '신나다 갑자기 사라지는 사람'),
  ('INE', 8, 'secure', 'IRON', 'EMBER', 'IRONEMBER', '난롯가의 수호자', '곁에 있으면 안심되는 사람'),
  ('INF', 8, 'anxious', 'IRON', 'FLARE', 'IRONFLARE', '백도의 수호자', '마음을 숨길 줄 모르는 사람'),
  ('INS', 8, 'avoidant', 'IRON', 'FROST', 'IRONFROST', '겨울바다 같은 수호자', '기대지 않고 지켜주는 사람'),
  ('INT', 8, 'fearful', 'IRON', 'TIDE', 'IRONTIDE', '천둥 같은 수호자', '세게 다가왔다 멀어지는 사람'),
  ('LLE', 9, 'secure', 'LULL', 'EMBER', 'LULLEMBER', '아랫목 같은 평화주의자', '함께 있으면 마음이 놓이는 사람'),
  ('LLF', 9, 'anxious', 'LULL', 'FLARE', 'LULLFLARE', '뭉근히 끓는 평화주의자', '부딪히기보다 혼자 삭이는 사람'),
  ('LLS', 9, 'avoidant', 'LULL', 'FROST', 'LULLFROST', '어스름한 평화주의자', '갈등 앞에서 조용히 비켜서는 사람'),
  ('LLT', 9, 'fearful', 'LULL', 'TIDE', 'LULLTIDE', '여울 같은 평화주의자', '겉은 잔잔한데 속은 급한 사람')
on conflict (code) do update set
  enneagram_core = excluded.enneagram_core,
  attachment     = excluded.attachment,
  core_en        = excluded.core_en,
  suffix_en      = excluded.suffix_en,
  label_en       = excluded.label_en,
  label_ko       = excluded.label_ko,
  copy_ko        = excluded.copy_ko;

alter policy assessments_insert on public.personality_assessments
  with check (user_id = auth.uid() and seq = 1);
