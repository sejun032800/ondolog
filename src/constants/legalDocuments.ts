/**
 * 화면 6(약관 동의) 문서 전문 — ⚠️ 전부 자리표시자(PLACEHOLDER)다.
 *
 * 근거: docs/ONDOLOG_MASTER.md "화면 6 약관 동의 명세" "남은 법무 과제"
 *   "이 명세는 화면 구조를 정의할 뿐, 약관 본문은 아직 없다."
 *   "Phase 3에서는 화면 구조까지만 구현하고, 본문은 자리표시자로 둔다.
 *   단 자리표시자임이 코드 주석과 .claude/state/DECISIONS.md에
 *   명시되어야 하며, 출시 전 반드시 교체한다."
 *
 * CLAUDE.md "법률 문구를 지어내지 마세요" 지시에 따라 실제 조문을
 * 창작하지 않는다. 아래 body는 조문이 아니라 "출시 전 이 자리에 무엇이
 * 채워져야 하는지"를 안내하는 문구다 — 화면에도 [자리표시자]로 노출해
 * 사용자를 오도하지 않는다.
 */

export type LegalDocumentKey = 'terms' | 'privacy' | 'aiUsage' | 'marketing' | 'biometric'

export interface LegalDocument {
  key: LegalDocumentKey
  title: string
  /** 항상 true. 실제 조문이 채워지면 이 필드부터 제거해야 한다. */
  isPlaceholder: true
  /** 문단 배열. 실제 조문이 아니라 "무엇이 들어가야 하는지"에 대한 안내다. */
  body: string[]
}

/**
 * 화면 A(생체정보 동의) "3. 온디바이스 처리 고지" — 화면에 **직접** 노출되는
 * (전문 [보기] 링크 뒤에 숨기지 않는) 4개 요지. MASTER.md "온디바이스 처리
 * 고지 — 반드시 포함할 문구 요지" 원문 그대로다. `BiometricConsentPanel`이
 * 이 배열을 화면에 그대로 렌더링하고, 아래 `LEGAL_DOCUMENTS.biometric`
 * (전문 모달)도 같은 배열을 재사용한다 — 두 곳이 서로 다른 말로 어긋나지
 * 않게 하기 위함이다.
 */
export const BIOMETRIC_ON_DEVICE_NOTICE_POINTS: readonly string[] = [
  '얼굴 특징 정보는 이 기기 안에서만 처리되며 서버로 전송되지 않습니다.',
  '대표사진 원본(사진 파일 자체)은 서버에 저장될 수 있으나, 그로부터 추출한 얼굴 특징 데이터는 저장되지 않습니다.',
  '동의는 언제든 설정 탭에서 철회할 수 있으며, 철회 시 기기에 저장된 얼굴 특징 데이터가 즉시 삭제됩니다.',
  '이 동의를 거부해도 앱의 다른 기능(수동 업로드 포함)은 그대로 이용할 수 있습니다.',
]

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  terms: {
    key: 'terms',
    title: '이용약관',
    isPlaceholder: true,
    body: [
      '[자리표시자] 이용약관 전문이 아직 작성되지 않았습니다.',
      '출시 전 법무 검토를 거쳐 아래 내용을 포함한 정식 약관으로 교체됩니다.',
      '· 발행되는 매거진(잡지)의 공동 저작권·이용 범위에 관한 조항',
      '· 서비스 이용 계약의 성립·해지 조건',
      '· 이용자의 권리와 의무, 서비스 제공자의 책임 범위',
    ],
  },
  privacy: {
    key: 'privacy',
    title: '개인정보 처리방침',
    isPlaceholder: true,
    body: [
      '[자리표시자] 개인정보 처리방침 전문이 아직 작성되지 않았습니다.',
      '출시 전 법무 검토를 거쳐 아래 내용을 포함한 정식 처리방침으로 교체됩니다.',
      '· 수집하는 개인정보 항목(이름, 생년월일, 성별, MBTI·성격 검사 응답,',
      '  채팅·사진 등)',
      '· 수집 목적(매거진 생성, 궁합·연애 온도 산출 등)',
      '· 보관 기간 — 무료 요금제는 촬영일 기준 3개월 보관 정책이 적용됩니다',
      '· 제3자(외부 LLM API 등) 제공 여부와 범위',
      '· 이용자의 열람·정정·삭제 요구권 행사 방법',
    ],
  },
  aiUsage: {
    key: 'aiUsage',
    title: 'AI 콘텐츠 생성을 위한 데이터 활용 동의',
    isPlaceholder: true,
    body: [
      '[자리표시자] AI 데이터 활용 고지 전문이 아직 작성되지 않았습니다.',
      'ONDOLOG는 커플이 남긴 채팅 대화, 사진, 메모를 바탕으로 AI가 매거진',
      '(코너)을 만듭니다. 이 과정에서 위 데이터의 일부가 매거진 생성을',
      '위해 외부 LLM API로 전송됩니다.',
      '출시 전 법무 검토를 거쳐 아래 내용을 포함한 정식 고지문으로',
      '교체됩니다.',
      '· 사용되는 LLM 프로바이더명',
      '· 해당 프로바이더의 데이터 보존·모델 학습 활용 정책',
      '· 전송되는 데이터의 구체적 범위',
    ],
  },
  marketing: {
    key: 'marketing',
    title: '마케팅 정보 수신 동의 (선택)',
    isPlaceholder: true,
    body: [
      '[자리표시자] 이 항목은 선택 동의이며, 체크하지 않아도 서비스',
      '이용에는 제한이 없습니다.',
      '동의 시 이벤트·혜택 등 마케팅 정보를 수신할 수 있습니다.',
      '동의 후에도 설정에서 언제든 철회할 수 있습니다.',
    ],
  },
  biometric: {
    key: 'biometric',
    title: '생체정보(얼굴 인식) 동의',
    isPlaceholder: true,
    body: [
      '[자리표시자] 생체정보(얼굴 인식) 처리방침 전문이 아직 작성되지 않았습니다.',
      '출시 전 법무 검토를 거쳐 아래 내용을 포함한 정식 고지문으로 교체됩니다.',
      ...BIOMETRIC_ON_DEVICE_NOTICE_POINTS.map((point) => `· ${point}`),
    ],
  },
}
