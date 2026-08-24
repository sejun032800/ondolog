/**
 * 연애 유형 36종 라벨 코드 매핑.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-5 (연애 유형 36종 라벨 — 확정)
 *
 * 애니어그램 코어(9) × 애착 유형(4) = 36종, 3자 코드 체계.
 *   코드 = [코어 2자 약어] + [애착 1자 약어]   예) MUSE + FLARE → 'MSF'
 *
 * 룩업 테이블이며 DB에서 조회하지 않는다 — 코드 상수로 고정해 결정론을
 * 보호한다(CLAUDE.md 절대 규칙 2). 다만 `supabase/migrations/016_*.sql`이
 * 시드하는 `love_type_labels` 테이블과 code/label_en/label_ko/copy_ko 값이
 * 반드시 일치해야 한다 — 시드 시 이 파일을 참조해 INSERT할 것.
 *
 * description_ko(결과 랜딩 화면용 장문 설명)는 Part 16 열린 과제(§16, 콘텐츠팀
 * 확정 대기)로 마스터 문서 어디에도 원문이 없다. 지어내지 않고 전부 null로 둔다.
 */

import type { AttachmentType } from './attachment'
import type { EnneagramCore } from './enneagram'

/** 코어 2자 약어 (자음 골격 기반, Part 10-5-1). */
export const ENNEAGRAM_CORE_ABBR: Record<EnneagramCore, string> = {
  1: 'KL',
  2: 'BL',
  3: 'AX',
  4: 'MS',
  5: 'LR',
  6: 'OT',
  7: 'RH',
  8: 'IN',
  9: 'LL',
}

/** 코어 영문 조어. */
export const ENNEAGRAM_CORE_EN: Record<EnneagramCore, string> = {
  1: 'KEEL',
  2: 'BALM',
  3: 'APEX',
  4: 'MUSE',
  5: 'LORE',
  6: 'OATH',
  7: 'RUSH',
  8: 'IRON',
  9: 'LULL',
}

/** 코어 한글 명칭. */
export const ENNEAGRAM_CORE_KO: Record<EnneagramCore, string> = {
  1: '원칙주의자',
  2: '조력자',
  3: '승부사',
  4: '낭만주의자',
  5: '관찰자',
  6: '의리파',
  7: '모험가',
  8: '수호자',
  9: '평화주의자',
}

/** 애착 1자 약어. FROST는 FLARE와의 F 충돌을 피해 S를 쓴다(Part 10-5-1). */
export const ATTACHMENT_ABBR: Record<AttachmentType, string> = {
  secure: 'E',
  anxious: 'F',
  avoidant: 'S',
  fearful: 'T',
}

/** 애착 접미사 영문 조어. */
export const ATTACHMENT_SUFFIX_EN: Record<AttachmentType, string> = {
  secure: 'EMBER',
  anxious: 'FLARE',
  avoidant: 'FROST',
  fearful: 'TIDE',
}

export interface LoveTypeLabel {
  code: string
  enneagramCore: EnneagramCore
  attachment: AttachmentType
  coreEn: string
  suffixEn: string
  labelEn: string
  labelKo: string
  copyKo: string
  /** Part 16 열린 과제 — 콘텐츠 미확정. 지어내지 않고 null로 둔다. */
  descriptionKo: string | null
}

/**
 * 36종 전체 (Part 10-5-2 원문 그대로).
 * 엘리전 규칙: E로 끝나는 코어(MUSE, LORE)는 -EMBER와 만날 때 E를 하나
 * 흡수한다 → MUSEMBER, LOREMBER (MUSEEMBER 아님).
 */
export const LOVE_TYPE_LABELS: readonly LoveTypeLabel[] = [
  // 1. KEEL — 원칙주의자
  {
    code: 'KLE',
    enneagramCore: 1,
    attachment: 'secure',
    coreEn: 'KEEL',
    suffixEn: 'EMBER',
    labelEn: 'KEELEMBER',
    labelKo: '온돌 같은 원칙주의자',
    copyKo: '늘 같은 온도로 곁에 있는 사람',
    descriptionKo: null,
  },
  {
    code: 'KLF',
    enneagramCore: 1,
    attachment: 'anxious',
    coreEn: 'KEEL',
    suffixEn: 'FLARE',
    labelEn: 'KEELFLARE',
    labelKo: '달아오르는 원칙주의자',
    copyKo: '잘하고 싶어서 혼자 뜨거워지는 사람',
    descriptionKo: null,
  },
  {
    code: 'KLS',
    enneagramCore: 1,
    attachment: 'avoidant',
    coreEn: 'KEEL',
    suffixEn: 'FROST',
    labelEn: 'KEELFROST',
    labelKo: '새벽 같은 원칙주의자',
    copyKo: '아무도 없는 시간에 기준을 지키는 사람',
    descriptionKo: null,
  },
  {
    code: 'KLT',
    enneagramCore: 1,
    attachment: 'fearful',
    coreEn: 'KEEL',
    suffixEn: 'TIDE',
    labelEn: 'KEELTIDE',
    labelKo: '일교차 큰 원칙주의자',
    copyKo: '원칙과 마음의 온도가 다른 사람',
    descriptionKo: null,
  },

  // 2. BALM — 조력자
  {
    code: 'BLE',
    enneagramCore: 2,
    attachment: 'secure',
    coreEn: 'BALM',
    suffixEn: 'EMBER',
    labelEn: 'BALMEMBER',
    labelKo: '봄볕 같은 조력자',
    copyKo: '부담 없이 스며드는 사람',
    descriptionKo: null,
  },
  {
    code: 'BLF',
    enneagramCore: 2,
    attachment: 'anxious',
    coreEn: 'BALM',
    suffixEn: 'FLARE',
    labelEn: 'BALMFLARE',
    labelKo: '활활 타는 조력자',
    copyKo: '다 주고도 더 줄 게 없나 찾는 사람',
    descriptionKo: null,
  },
  {
    code: 'BLS',
    enneagramCore: 2,
    attachment: 'avoidant',
    coreEn: 'BALM',
    suffixEn: 'FROST',
    labelEn: 'BALMFROST',
    labelKo: '달빛 같은 조력자',
    copyKo: '티 내지 않고 비춰주는 사람',
    descriptionKo: null,
  },
  {
    code: 'BLT',
    enneagramCore: 2,
    attachment: 'fearful',
    coreEn: 'BALM',
    suffixEn: 'TIDE',
    labelEn: 'BALMTIDE',
    labelKo: '여우비 같은 조력자',
    copyKo: '웃으면서 서운해하는 사람',
    descriptionKo: null,
  },

  // 3. APEX — 승부사
  {
    code: 'AXE',
    enneagramCore: 3,
    attachment: 'secure',
    coreEn: 'APEX',
    suffixEn: 'EMBER',
    labelEn: 'APEXEMBER',
    labelKo: '화롯불 같은 승부사',
    copyKo: '나란히 타오를 줄 아는 사람',
    descriptionKo: null,
  },
  {
    code: 'AXF',
    enneagramCore: 3,
    attachment: 'anxious',
    coreEn: 'APEX',
    suffixEn: 'FLARE',
    labelEn: 'APEXFLARE',
    labelKo: '이글거리는 승부사',
    copyKo: '인정받고 싶어 더 달리는 사람',
    descriptionKo: null,
  },
  {
    code: 'AXS',
    enneagramCore: 3,
    attachment: 'avoidant',
    coreEn: 'APEX',
    suffixEn: 'FROST',
    labelEn: 'APEXFROST',
    labelKo: '별빛 같은 승부사',
    copyKo: '멀리서 혼자 빛나는 사람',
    descriptionKo: null,
  },
  {
    code: 'AXT',
    enneagramCore: 3,
    attachment: 'fearful',
    coreEn: 'APEX',
    suffixEn: 'TIDE',
    labelEn: 'APEXTIDE',
    labelKo: '번개 같은 승부사',
    copyKo: '번쩍하고 사라지는 사람',
    descriptionKo: null,
  },

  // 4. MUSE — 낭만주의자
  {
    code: 'MSE',
    enneagramCore: 4,
    attachment: 'secure',
    coreEn: 'MUSE',
    suffixEn: 'EMBER',
    labelEn: 'MUSEMBER',
    labelKo: '모닥불 같은 낭만주의자',
    copyKo: '깊고 오래 타는 사람',
    descriptionKo: null,
  },
  {
    code: 'MSF',
    enneagramCore: 4,
    attachment: 'anxious',
    coreEn: 'MUSE',
    suffixEn: 'FLARE',
    labelEn: 'MUSEFLARE',
    labelKo: '열대야 같은 낭만주의자',
    copyKo: '사랑 때문에 잠 못 드는 사람',
    descriptionKo: null,
  },
  {
    code: 'MSS',
    enneagramCore: 4,
    attachment: 'avoidant',
    coreEn: 'MUSE',
    suffixEn: 'FROST',
    labelEn: 'MUSEFROST',
    labelKo: '안개 같은 낭만주의자',
    copyKo: '가까이 가면 흩어지는 사람',
    descriptionKo: null,
  },
  {
    code: 'MST',
    enneagramCore: 4,
    attachment: 'fearful',
    coreEn: 'MUSE',
    suffixEn: 'TIDE',
    labelEn: 'MUSETIDE',
    labelKo: '파도 같은 낭만주의자',
    copyKo: '밀려왔다 밀려가는 사람',
    descriptionKo: null,
  },

  // 5. LORE — 관찰자
  {
    code: 'LRE',
    enneagramCore: 5,
    attachment: 'secure',
    coreEn: 'LORE',
    suffixEn: 'EMBER',
    labelEn: 'LOREMBER',
    labelKo: '체온 같은 관찰자',
    copyKo: '조용하지만 늘 곁에 있는 사람',
    descriptionKo: null,
  },
  {
    code: 'LRF',
    enneagramCore: 5,
    attachment: 'anxious',
    coreEn: 'LORE',
    suffixEn: 'FLARE',
    labelEn: 'LOREFLARE',
    labelKo: '끓어오르는 관찰자',
    copyKo: '속으로만 뜨거워지는 사람',
    descriptionKo: null,
  },
  {
    code: 'LRS',
    enneagramCore: 5,
    attachment: 'avoidant',
    coreEn: 'LORE',
    suffixEn: 'FROST',
    labelEn: 'LOREFROST',
    labelKo: '서늘한 관찰자',
    copyKo: '딱 그만큼의 거리를 지키는 사람',
    descriptionKo: null,
  },
  {
    code: 'LRT',
    enneagramCore: 5,
    attachment: 'fearful',
    coreEn: 'LORE',
    suffixEn: 'TIDE',
    labelEn: 'LORETIDE',
    labelKo: '환절기의 관찰자',
    copyKo: '다가섰다 물러나길 반복하는 사람',
    descriptionKo: null,
  },

  // 6. OATH — 의리파
  {
    code: 'OTE',
    enneagramCore: 6,
    attachment: 'secure',
    coreEn: 'OATH',
    suffixEn: 'EMBER',
    labelEn: 'OATHEMBER',
    labelKo: '햇살 같은 의리파',
    copyKo: '어떤 날에도 뜨는 사람',
    descriptionKo: null,
  },
  {
    code: 'OTF',
    enneagramCore: 6,
    attachment: 'anxious',
    coreEn: 'OATH',
    suffixEn: 'FLARE',
    labelEn: 'OATHFLARE',
    labelKo: '한여름의 의리파',
    copyKo: '확인받아야 잠드는 사람',
    descriptionKo: null,
  },
  {
    code: 'OTS',
    enneagramCore: 6,
    attachment: 'avoidant',
    coreEn: 'OATH',
    suffixEn: 'FROST',
    labelEn: 'OATHFROST',
    labelKo: '겨울밤 같은 의리파',
    copyKo: '믿기까지 오래 걸리는 사람',
    descriptionKo: null,
  },
  {
    code: 'OTT',
    enneagramCore: 6,
    attachment: 'fearful',
    coreEn: 'OATH',
    suffixEn: 'TIDE',
    labelEn: 'OATHTIDE',
    labelKo: '소나기 같은 의리파',
    copyKo: '믿고 싶은데 자꾸 흔들리는 사람',
    descriptionKo: null,
  },

  // 7. RUSH — 모험가
  {
    code: 'RHE',
    enneagramCore: 7,
    attachment: 'secure',
    coreEn: 'RUSH',
    suffixEn: 'EMBER',
    labelEn: 'RUSHEMBER',
    labelKo: '한낮 같은 모험가',
    copyKo: '신나는데 든든하기까지 한 사람',
    descriptionKo: null,
  },
  {
    code: 'RHF',
    enneagramCore: 7,
    attachment: 'anxious',
    coreEn: 'RUSH',
    suffixEn: 'FLARE',
    labelEn: 'RUSHFLARE',
    labelKo: '활화산 같은 모험가',
    copyKo: '함께일 때 가장 뜨거운 사람',
    descriptionKo: null,
  },
  {
    code: 'RHS',
    enneagramCore: 7,
    attachment: 'avoidant',
    coreEn: 'RUSH',
    suffixEn: 'FROST',
    labelEn: 'RUSHFROST',
    labelKo: '바람 같은 모험가',
    copyKo: '잡으려 하면 빠져나가는 사람',
    descriptionKo: null,
  },
  {
    code: 'RHT',
    enneagramCore: 7,
    attachment: 'fearful',
    coreEn: 'RUSH',
    suffixEn: 'TIDE',
    labelEn: 'RUSHTIDE',
    labelKo: '돌풍 같은 모험가',
    copyKo: '신나다 갑자기 사라지는 사람',
    descriptionKo: null,
  },

  // 8. IRON — 수호자
  {
    code: 'INE',
    enneagramCore: 8,
    attachment: 'secure',
    coreEn: 'IRON',
    suffixEn: 'EMBER',
    labelEn: 'IRONEMBER',
    labelKo: '난롯가의 수호자',
    copyKo: '곁에 있으면 안심되는 사람',
    descriptionKo: null,
  },
  {
    code: 'INF',
    enneagramCore: 8,
    attachment: 'anxious',
    coreEn: 'IRON',
    suffixEn: 'FLARE',
    labelEn: 'IRONFLARE',
    labelKo: '백도의 수호자',
    copyKo: '마음을 숨길 줄 모르는 사람',
    descriptionKo: null,
  },
  {
    code: 'INS',
    enneagramCore: 8,
    attachment: 'avoidant',
    coreEn: 'IRON',
    suffixEn: 'FROST',
    labelEn: 'IRONFROST',
    labelKo: '겨울바다 같은 수호자',
    copyKo: '기대지 않고 지켜주는 사람',
    descriptionKo: null,
  },
  {
    code: 'INT',
    enneagramCore: 8,
    attachment: 'fearful',
    coreEn: 'IRON',
    suffixEn: 'TIDE',
    labelEn: 'IRONTIDE',
    labelKo: '천둥 같은 수호자',
    copyKo: '세게 다가왔다 멀어지는 사람',
    descriptionKo: null,
  },

  // 9. LULL — 평화주의자
  {
    code: 'LLE',
    enneagramCore: 9,
    attachment: 'secure',
    coreEn: 'LULL',
    suffixEn: 'EMBER',
    labelEn: 'LULLEMBER',
    labelKo: '아랫목 같은 평화주의자',
    copyKo: '함께 있으면 마음이 놓이는 사람',
    descriptionKo: null,
  },
  {
    code: 'LLF',
    enneagramCore: 9,
    attachment: 'anxious',
    coreEn: 'LULL',
    suffixEn: 'FLARE',
    labelEn: 'LULLFLARE',
    labelKo: '뭉근히 끓는 평화주의자',
    copyKo: '부딪히기보다 혼자 삭이는 사람',
    descriptionKo: null,
  },
  {
    code: 'LLS',
    enneagramCore: 9,
    attachment: 'avoidant',
    coreEn: 'LULL',
    suffixEn: 'FROST',
    labelEn: 'LULLFROST',
    labelKo: '어스름한 평화주의자',
    copyKo: '갈등 앞에서 조용히 비켜서는 사람',
    descriptionKo: null,
  },
  {
    code: 'LLT',
    enneagramCore: 9,
    attachment: 'fearful',
    coreEn: 'LULL',
    suffixEn: 'TIDE',
    labelEn: 'LULLTIDE',
    labelKo: '여울 같은 평화주의자',
    copyKo: '겉은 잔잔한데 속은 급한 사람',
    descriptionKo: null,
  },
] as const

/** code(3자) → 라벨 상세, O(1) 조회용. */
export const LOVE_TYPE_LABEL_BY_CODE: Readonly<Record<string, LoveTypeLabel>> =
  Object.fromEntries(LOVE_TYPE_LABELS.map((l) => [l.code, l]))
