/**
 * 애착 표시 이름 - 웹 화면이 애착을 보여 주는 모든 곳(결과 상세 · 성격 프로필 · 결과 다시 보기)이 이 한 곳만 쓴다(D3 · R76-5).
 *
 * 근거: MASTER 10-5-3 "톤 설계 원칙" - 애착 유형명(불안형 · 회피형 · 혼란형)은 그대로 쓰지 않고 재프레이밍한 이름만 보인다.
 *   불안 -> 애틋함, 온 마음 / 회피 -> 조용함, 자기 세계 / 혼란 -> 파도, 밀물썰물 (표는 정본 `@/constants/attachmentDisplay` 한 벌 - 복사하지 않는다).
 * 안정은 MASTER 표에 재프레이밍 항목이 없다(원래 이름 "안정형"도 보이면 안 된다). 지어내지 않고 **이름을 보이지 않는다**(null) - 줄에서 그 칸을 뺀다.
 * 엔진 원본의 `ATTACHMENT_LABEL_KO`(내부 로직 · 로그용)는 화면에 쓰지 않는다.
 */
import type { AttachmentType } from '@/constants/attachment'
import { ATTACHMENT_REFRAME_KO } from '@/constants/attachmentDisplay'

/** 화면에 보일 애착 이름. 없으면 null(안정). */
export function attachmentDisplayName(attachment: AttachmentType): string | null {
  return ATTACHMENT_REFRAME_KO[attachment]
}

/** 결과 머리의 한 줄: "INFJ · 애니어그램 4 · 애틋함, 온 마음". 이름이 없으면 그 칸만 뺀다. */
export function personalityMetaLine(parts: { mbti?: string | null; core: number; attachment: AttachmentType }): string {
  return [parts.mbti || null, `애니어그램 ${parts.core}`, attachmentDisplayName(parts.attachment)].filter((p): p is string => !!p).join(' · ')
}
