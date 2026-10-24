/**
 * 서재·속표지 문구 상수(U3, `58-`).
 *
 * 속표지(D10) 고지 문구는 PM이 정했다(R31-9). 디자인 보드(`N-D10-Front-Matter`)의
 * "수록된 사진과 문장은 두 사람이 남긴 기록이며, 편집 외의 각색은 하지 않았습니다"는 쓰지 않는다 -
 * 호 안에는 온도록이 쓴 문장이 있어 사실과 다르다. 디자인 세션이 다듬은 문장이 오면 이 한 곳만 바꾼다
 * (뜻은 고정: 두 사람의 말·사진은 고치지 않고 실었다 / 온도록이 쓴 문장은 발행 노트에 따로 적었다).
 */
export const FRONT_MATTER_NOTICE =
  '두 사람이 남긴 말과 사진은 고치지 않고 실었어요. 온도록이 쓴 문장은 발행 노트에 따로 적었어요.'

/** D14 첫 호 시작 문구(디자인 `N-S-D2-Magazine`). */
export const FIRST_ISSUE_COPY = {
  kicker: 'FIRST ISSUE',
  title: '첫 호를 만들기 시작했어요',
  shelfHint: '발행한 호가 여기에 꽂혀요',
} as const

/** D16 미연결 문구(디자인 `N-S-D3-Magazine`). */
export const UNCONNECTED_COPY = {
  title: '두 사람의 첫 호가 들어갈 자리',
  body: '연인과 연결하면 첫 호를 만들기 시작해요',
  invite: '연인 초대하기',
} as const

/** D01 다음 호 카드 문구(디자인 `N-T-Tabs`). */
export const NEXT_ISSUE_COPY = {
  kicker: 'NEXT ISSUE',
  status: '만들고 있어요',
  writing: '아직 쓰는 중',
} as const
