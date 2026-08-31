-- ─────────────────────────────────────────────
-- 16. love_type_labels 시드
-- ─────────────────────────────────────────────
-- 이 파일은 원래 "36종 라벨/카피 미확정"으로 INSERT 없이 보류돼 있었다
-- (근거는 아래 이력 참조). 이후 code/core_en/suffix_en/label_en/label_ko/
-- copy_ko/enneagram_core/attachment 8개 필드가 src/constants/loveTypeLabels.ts
-- (docs/ONDOLOG_MASTER.md Part 10-5-2 원문 그대로)로 확정돼 이번에 채운다.
--
-- 원본은 loveTypeLabels.ts다 — 값을 임의로 바꾸지 않고 그 파일의
-- LOVE_TYPE_LABELS 배열을 그대로 옮겼다(스크립트로 파싱해 36행 전체를
-- 기계적으로 생성, 수동 재입력에 의한 오탈자를 배제했다). description_ko
-- (상세 설명문)는 이 파일이 다루는 범위가 아니다 — loveTypeLabels.ts에서도
-- 여전히 null이고, 020_seed_love_type_descriptions.sql이 이 파일(016) 이후
-- 순서로 별도 시드한다. 이 파일이 먼저 라벨 행을 만들어야 020의 update가
-- 실제로 매칭될 행을 갖는다 — 번호 순서(016 < 020)가 이미 그 의존성을
-- 보장한다.
--
-- 재실행 가능하도록 on conflict (code) do update로 작성했다 — 이후 라벨
-- 문구가 loveTypeLabels.ts 쪽에서 갱신되면 이 파일도 함께 갱신하고 재적용
-- 하면 된다(description_ko는 이 upsert가 건드리지 않으므로 020으로 채운
-- 값이 보존된다).
--
-- 이전 이력(보류 사유, 참고용): SCHEMA.md는 테이블 구조만 정의했고(§4-3)
-- 당시엔 36종 실제 데이터가 문서 어디에도 없었다. 결정 기록:
-- .claude/state/DECISIONS.md 2026-08-24 항목.

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
