/**
 * 애착 축의 사용자 노출용 재프레이밍 문구.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-5-3 "톤 설계 원칙" 원문 그대로.
 *   "애착 유형명(불안형·회피형·혼란형)을 그대로 쓰면 유저가 상처받고
 *   공유 카드로도 나가지 않는다. 축의 성질만 살리고 이름은 전부
 *   재프레이밍했다."
 *
 *   | 애착 | 원래 어감 | 재프레이밍 방향 |
 *   | 불안 | 매달림, 집착 | 애틋함, 온 마음 |
 *   | 회피 | 냉담함, 무심함 | 조용함, 자기 세계 |
 *   | 혼란 | 변덕, 불안정 | 파도, 밀물썰물 |
 *
 * `src/constants/attachment.ts`의 `ATTACHMENT_LABEL_KO`는 "내부 로직·
 * 로그용"이라고 명시돼 있어(사용자 노출 금지) 화면 7 "⑤ 애착 유형
 * 설명"에는 이 파일의 재프레이밍 문구를 쓴다. 안정형(secure)에는 이
 * 표에 재프레이밍 대상 자체가 없다(원래 어감부터 긍정적이라 재프레이밍
 * 필요가 없었던 것으로 보인다) — 지어내지 않고 null로 둔다.
 */
import type { AttachmentType } from './attachment'

export const ATTACHMENT_REFRAME_KO: Readonly<Record<AttachmentType, string | null>> = {
  secure: null,
  anxious: '애틋함, 온 마음',
  avoidant: '조용함, 자기 세계',
  fearful: '파도, 밀물썰물',
}
