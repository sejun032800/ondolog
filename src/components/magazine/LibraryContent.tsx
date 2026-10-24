/**
 * 서재의 연결된 유저 쪽 본문 - 상태(`LibraryMode`)에 따라 로딩 / 오류 / D14 첫 호 시작 / D01 서재를 그린다.
 * 미연결(D16)은 이 컴포넌트가 아니라 `<CoupleGate>`의 fallback이 그린다.
 *
 * 다음 호 카드는 **서재에 발행된 호가 있을 때만** 그린다. 초안·코너 행이 없으면(빈 결과) 카드를 그리지 않는다 -
 * 발행된 호가 0권이면 D14가 그 자리를 맡는다("첫 호를 만들기 시작했어요", 초안이 있으면 그 진행률).
 */
import { StyleSheet, Text, View } from 'react-native'
import type { LibraryState } from '../../hooks/useLibrary'
import type { PublishedIssue } from '../../services/magazineApi'
import type { LibraryMode } from '../../utils/magazine'
import { nocturne, type, withAlpha } from '../../theme/nocturne'
import { GhostButton } from '../nocturne/Buttons'
import { Skeleton } from '../nocturne/Skeleton'
import { FirstIssue, ShelfHint } from './EmptyShelves'
import { LibraryShelf } from './LibraryShelf'
import { NextIssueCard } from './NextIssueCard'

export interface LibraryContentProps {
  mode: LibraryMode
  library: Pick<LibraryState, 'issues' | 'coverUrls' | 'next'>
  onOpen: (issue: PublishedIssue) => void
  onRetry: () => void
}

export function LibraryContent({ mode, library, onOpen, onRetry }: LibraryContentProps) {
  if (mode === 'loading') {
    return (
      <View style={styles.skeleton} testID="library-skeleton">
        <Skeleton width="40%" height={32} />
        <Skeleton height={226} style={{ borderRadius: 4 }} />
        <Skeleton width="30%" height={20} />
      </View>
    )
  }
  if (mode === 'error') {
    return (
      <View style={styles.error} testID="library-error">
        <Text style={styles.errorText}>서재를 불러오지 못했어요</Text>
        <GhostButton label="다시 불러오기" onPress={onRetry} />
      </View>
    )
  }
  if (mode === 'first') {
    return (
      <View style={styles.first}>
        <FirstIssue percent={library.next?.percent ?? 0} />
        <ShelfHint />
      </View>
    )
  }
  if (mode === 'shelf') {
    return (
      <View style={styles.shelf}>
        {library.next ? <NextIssueCard data={library.next} /> : null}
        {library.next ? <View style={styles.rule} /> : null}
        <LibraryShelf issues={library.issues} coverUrls={library.coverUrls} onOpen={onOpen} />
      </View>
    )
  }
  return null
}

const styles = StyleSheet.create({
  skeleton: { gap: 20 },
  error: { gap: 12, paddingVertical: 48, alignItems: 'center' },
  errorText: { ...type.title, color: nocturne.text },
  first: { gap: 56, paddingTop: 36 },
  shelf: { gap: 22 },
  rule: { height: 1, backgroundColor: withAlpha(nocturne.text, 0.14) },
})
