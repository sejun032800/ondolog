/**
 * 피드 사진 저장 연결부(74-h4) - 루트 `recordDate`(업로드 -> dates -> stops -> data_entries -> 메모 -> 파생 칸)를 그대로 부른다. 고치지 않는다.
 * 웹 쪽이 하는 일: 업로드 바이트 출처를 앱 소유 복사본으로(`readStagedBytes`), 시험 빌드에서만 실패 단계를 기록(`readBytes` 감싸기 · `storage.upload` 감싸기 · 행 실패).
 * 영속 큐는 없다(RN 피드에도 없다).
 */
import { recordDate, type Db, type RecordDateInput, type RecordDateResult } from '@/services/dateRecordApi'
import { generateUuidV4 } from '@/utils/uuid'
import { IS_TRIAL_BUILD } from '../../config/env'
import { safeKind, useTrialDiag } from '../../platform/trialDiag'
import { reportAppError } from '../../errorLog/errorLog'
import { readStagedBytes, type StagedPhoto } from './feedPhotoStage'

/**
 * `storage.from(...).upload`가 오류를 돌려주거나 던지면 80- 오류 건수(`upload_fail`)를 하나 센다(결과는 그대로 돌려준다).
 * 시험 빌드에서는 `upload` 단계 진단도 남긴다(그 글자는 운영 번들에서 빠진다).
 */
export function withUploadDiag(db: Db): Db {
  const storage = {
    ...db.storage,
    from: (bucket: string) => {
      const real = db.storage.from(bucket)
      return {
        ...real,
        upload: async (...args: Parameters<typeof real.upload>) => {
          try {
            const r = await real.upload(...args)
            if (r.error) {
              reportAppError('upload_fail')
              if (IS_TRIAL_BUILD) useTrialDiag.getState().recordPhoto('upload', safeKind(r.error))
            }
            return r
          } catch (e) {
            reportAppError('upload_fail')
            if (IS_TRIAL_BUILD) useTrialDiag.getState().recordPhoto('upload', safeKind(e))
            throw e
          }
        },
      }
    },
  }
  return { from: db.from.bind(db), rpc: db.rpc.bind(db), storage } as unknown as Db
}

/** 읽기에 실패한 사진(자리표시)은 저장 대상이 아니다. */
export function savablePhotos(photos: readonly StagedPhoto[]): StagedPhoto[] {
  return photos.filter((p) => !p.failed)
}

export async function saveFeedRecord(db: Db, input: RecordDateInput): Promise<RecordDateResult> {
  if (IS_TRIAL_BUILD) useTrialDiag.getState().clearPhoto()
  const target = withUploadDiag(db)
  const readBytes = IS_TRIAL_BUILD
    ? async (uri: string) => {
        try {
          return await readStagedBytes(uri)
        } catch (e) {
          useTrialDiag.getState().recordPhoto('read', safeKind(e))
          throw e
        }
      }
    : (uri: string) => readStagedBytes(uri)
  try {
    return await recordDate(target, { readBytes, newId: generateUuidV4 }, input)
  } catch (e) {
    // 앞 단계(읽기 · 업로드)가 이미 기록했으면 그대로 둔다. 아니면 행 저장 단계다(`recordPhoto`는 처음 것만 남긴다).
    if (IS_TRIAL_BUILD && !(e instanceof Error && e.name === 'StopTimeInputError')) useTrialDiag.getState().recordPhoto('rows', safeKind(e))
    throw e
  }
}
