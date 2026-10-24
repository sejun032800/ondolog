/**
 * D11 뷰어 - 쪽 이미지 가로 넘김 + 핀치 줌(디자인 `N-D11-Viewer`).
 *
 * 머리: ← (속표지로) · "N월호" · "8 / 19". **목차(D12) 버튼은 없다** - 매니페스트가 오기 전까지 숨긴다(R31-8).
 * 쪽은 `FlatList` 가로 페이징이고, 확대 중에는 넘김을 잠근다. 서명 URL은 지금 쪽 가까이만 필요하다
 * (`onNeedPages`) - 만료·실패 처리는 바깥(`useIssueViewer`)이 한다.
 */
import { useCallback, useRef, useState } from 'react'
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fontFamily, nocturne, shape } from '../../theme/nocturne'
import { pageCounterLabel } from '../../utils/magazine'
import { PushHeader } from '../nocturne/ExitHeader'
import { ZoomablePage } from './ZoomablePage'

/** 쪽 이미지 가로세로 비율(렌더 폭 1170 x 높이 1655, `55-1`). */
export const PAGE_ASPECT = 1170 / 1655
const SIDE_MARGIN = 28

export interface PageViewerProps {
  title: string
  pageCount: number
  /** 처음에 보일 쪽(1부터). */
  initialPage: number
  /** 쪽 번호(1부터) -> 서명 URL. */
  pageUrls: Record<number, string>
  onBack: () => void
  /** 지금 쪽이 바뀌었다(1부터) - 그 쪽 가까이의 URL을 받고 보던 쪽을 기억할 때 쓴다. */
  onPageChange: (page: number) => void
  onImageError: (page: number) => void
}

/** 스크롤 위치(x) -> 쪽 번호(1부터). 범위를 벗어나지 않는다. */
export function pageFromOffset(offsetX: number, pageWidth: number, pageCount: number): number {
  if (pageWidth <= 0) return 1
  return Math.min(pageCount, Math.max(1, Math.round(offsetX / pageWidth) + 1))
}

export function PageViewer({ title, pageCount, initialPage, pageUrls, onBack, onPageChange, onImageError }: PageViewerProps) {
  const insets = useSafeAreaInsets()
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [current, setCurrent] = useState(initialPage)
  const [zoomed, setZoomed] = useState(false)
  const list = useRef<FlatList<number>>(null)
  const pages = useRef(Array.from({ length: pageCount }, (_, i) => i + 1)).current

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setBox({ width, height })
  }

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = pageFromOffset(e.nativeEvent.contentOffset.x, box.width, pageCount)
      setCurrent(page)
      onPageChange(page)
    },
    [box.width, pageCount, onPageChange],
  )

  const pageWidth = Math.max(0, box.width - SIDE_MARGIN * 2)

  return (
    <View style={styles.screen} testID="page-viewer">
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
        <PushHeader onBack={onBack} style={[styles.back, { top: insets.top + 4 }]} />
        <View style={styles.titles} pointerEvents="none">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.counter} testID="page-counter">
            {pageCounterLabel(current, pageCount)}
          </Text>
        </View>
      </View>
      <View style={styles.pager} onLayout={onLayout} testID="page-pager">
        {box.width > 0 ? (
          <FlatList
            ref={list}
            data={pages}
            keyExtractor={(p) => String(p)}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(Math.max(initialPage, 1), pageCount) - 1}
            getItemLayout={(_d, index) => ({ length: box.width, offset: box.width * index, index })}
            onMomentumScrollEnd={onMomentumEnd}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item }) => (
              <View style={{ width: box.width, height: box.height, paddingHorizontal: SIDE_MARGIN }}>
                <ZoomablePage
                  width={pageWidth}
                  height={box.height}
                  uri={pageUrls[item]}
                  label={`${item}쪽`}
                  onZoomChange={setZoomed}
                  onError={() => onImageError(item)}
                />
              </View>
            )}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: nocturne.ink },
  header: { paddingHorizontal: 12, justifyContent: 'center' },
  back: { position: 'absolute', left: 12 },
  titles: { alignItems: 'center', gap: 1 },
  title: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: nocturne.text },
  counter: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 16, color: nocturne.textMute },
  pager: { flex: 1, marginBottom: shape.space.section },
})
