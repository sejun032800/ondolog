/**
 * 메인 탭(U1) 읽기 - 온도 표시 상태에 필요한 두 사실(활동 유무 · 양측 프로파일 유무). **읽기만 한다.**
 * 온도 값 자체는 `coupleStore.refresh`가 `daily_temperature`에서 읽어 둔 저장값이며, 앱은 계산하지 않는다.
 *
 * "활동"의 정의(내부 결정): 이 커플의 지우지 않은 대화·기록(`data_entries`)·데이트가 하나라도 있다.
 * MASTER 10-7-3의 "하루치 활동 점수"는 아직 미확정이라 점수가 아니라 유무만 본다.
 * 저장소 클라이언트는 인자로 받는다(`Db`) - 앱은 `supabase`를, 원격 실증은 사용자 세션 클라이언트를 넘긴다.
 */
import type { Db } from './dateRecordApi'

async function hasAnyRow(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  what: string,
): Promise<boolean> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message}`)
  return (data ?? []).length > 0
}

/** 대화·기록·데이트 중 하나라도 있으면 true. RLS 범위의 존재 조회(행 1개). */
export async function fetchHasActivity(db: Db, coupleId: string): Promise<boolean> {
  const [messages, entries, dates] = await Promise.all([
    hasAnyRow(
      db.from('messages').select('id').eq('couple_id', coupleId).is('deleted_at', null).limit(1),
      '대화 유무 조회 실패',
    ),
    hasAnyRow(
      db.from('data_entries').select('id').eq('couple_id', coupleId).is('deleted_at', null).limit(1),
      '기록 유무 조회 실패',
    ),
    hasAnyRow(
      db.from('dates').select('id').eq('couple_id', coupleId).is('deleted_at', null).limit(1),
      '데이트 유무 조회 실패',
    ),
  ])
  return messages || entries || dates
}

/** 두 사람의 성격 프로파일이 모두 있으면 true(RLS: 본인 + 상대). */
export async function fetchProfilesComplete(db: Db, userId: string, partnerId: string): Promise<boolean> {
  const { data, error } = await db.from('personality_profiles').select('user_id').in('user_id', [userId, partnerId])
  if (error) throw new Error(`프로파일 유무 조회 실패: ${error.message}`)
  const ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
  return ids.has(userId) && ids.has(partnerId)
}
