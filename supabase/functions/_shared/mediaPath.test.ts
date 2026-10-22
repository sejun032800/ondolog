/// <reference types="jest" />
/**
 * 발행 미디어 목적지 경로 (MASTER §17-0-10-D) - 경로 함수는 `mediaPath.ts` 하나다.
 * 입력 조립이 싣는 `PhotoRef.path`와 미디어 복제의 목적지가 같은 함수에서 나온다는 것을 시험한다.
 */

import { assembleCornerInput } from './inputAssembly.ts'
import { MAGAZINE_BUCKET, magazineMediaPath, parseMagazineMediaPath } from './mediaPath.ts'
import { COUPLE_A, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'
import { fakeClient } from './testFixtures/inputAssemblyFake.ts'

describe('magazineMediaPath', () => {
  it('{couple_id}/{issue_id}/{entry_id}.{ext} - 확장자는 원본의 것이다', () => {
    expect(magazineMediaPath({ coupleId: 'c1', issueId: 'i1', entryId: 'e1', sourcePath: 'c1/e1.jpg' })).toBe('c1/i1/e1.jpg')
    expect(magazineMediaPath({ coupleId: 'c1', issueId: 'i1', entryId: 'e1', sourcePath: 'c1/e1.PNG' })).toBe('c1/i1/e1.png')
  })

  it('같은 입력이면 같은 경로다', () => {
    const parts = { coupleId: 'c', issueId: 'i', entryId: 'e', sourcePath: 'x/y.webp' }
    expect(magazineMediaPath(parts)).toBe(magazineMediaPath({ ...parts }))
  })

  it('확장자가 없는 원본, 경로 한 칸이 될 수 없는 ID는 지어내지 않고 던진다', () => {
    expect(() => magazineMediaPath({ coupleId: 'c', issueId: 'i', entryId: 'e', sourcePath: 'c/e' })).toThrow(/확장자/)
    expect(() => magazineMediaPath({ coupleId: 'c', issueId: 'i', entryId: 'e', sourcePath: 'c/e.' })).toThrow(/확장자/)
    expect(() => magazineMediaPath({ coupleId: 'c/..', issueId: 'i', entryId: 'e', sourcePath: 'c/e.jpg' })).toThrow(/coupleId/)
    expect(() => magazineMediaPath({ coupleId: 'c', issueId: '', entryId: 'e', sourcePath: 'c/e.jpg' })).toThrow(/issueId/)
  })

  it('parse는 만든 경로를 되돌리고, 이 모양이 아니면 null이다', () => {
    const path = magazineMediaPath({ coupleId: 'c1', issueId: 'i1', entryId: 'e1', sourcePath: 'a/b.jpg' })
    expect(parseMagazineMediaPath(path)).toEqual({ coupleId: 'c1', issueId: 'i1', entryId: 'e1', ext: 'jpg' })
    expect(parseMagazineMediaPath('c1/e1.jpg')).toBeNull()
    expect(parseMagazineMediaPath('c1/i1/e1')).toBeNull()
    expect(parseMagazineMediaPath('c1/i1/a/e1.jpg')).toBeNull()
    expect(MAGAZINE_BUCKET).toBe('magazine')
  })
})

describe('입력 조립이 싣는 사진 경로 = 같은 함수의 목적지 경로 (§17-0-10-D)', () => {
  const entry = (id: string, over: Record<string, unknown>) => ({
    id,
    couple_id: COUPLE_A,
    author_id: 'u1',
    date_id: null,
    date_stop_id: null,
    entry_type: 'photo',
    storage_path: `${COUPLE_A}/${id}.jpg`,
    thumb_path: null,
    width: 100,
    height: 80,
    text_content: null,
    drawing_path: null,
    captured_at: '2026-08-10T10:00:00+09:00',
    created_at: '2026-08-10T10:00:00+09:00',
    deleted_at: null,
    access_locked: false,
    ...over,
  })

  it('원본 경로가 아니라 목적지 경로가 레코드·데이트 사진에 실린다', async () => {
    const r = await assembleCornerInput(
      fakeClient({
        couples: [{ id: COUPLE_A, subscription_tier: 'free' }],
        profiles: [{ id: 'u1', display_name: '세준' }],
        messages: [],
        dates: [{ id: 'd1', couple_id: COUPLE_A, date_on: '2026-08-19', region: null, photo_count: 1, last_featured_at: null, deleted_at: null }],
        date_stops: [{ id: 's1', couple_id: COUPLE_A, date_id: 'd1', seq: 1, arrived_at: '2026-08-19T14:00:00+09:00', place_name: null, lat: null, lng: null }],
        data_entries: [entry('solo', {}), entry('stopped', { date_id: 'd1', date_stop_id: 's1', captured_at: '2026-08-19T14:10:00+09:00' })],
      }),
      MONTHLY_CONTEXT,
      'issue-x',
    )
    const expected = (entryId: string) =>
      magazineMediaPath({ coupleId: COUPLE_A, issueId: 'issue-x', entryId, sourcePath: `${COUPLE_A}/${entryId}.jpg` })
    expect(r.photos.map((p) => p.source.path).sort()).toEqual([expected('solo'), expected('stopped')].sort())
    expect(r.dates[0].source.stops[0].photos.map((p) => p.path)).toEqual([expected('stopped')])
    // 어디에도 원본 경로가 남지 않는다.
    expect(JSON.stringify(r)).not.toContain(`${COUPLE_A}/solo.jpg`)
  })
})
