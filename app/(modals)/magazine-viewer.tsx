/**
 * 매거진 뷰어 시트 - D10 속표지(첫 장) -> D11 뷰어. MASTER 11-3 `(modals)/magazine-viewer.tsx`, R18-2(시트는 ✕로 닫는다).
 *
 * - 호 하나(`issueId`)의 **발행된 호만** 연다(`issues_public`). 인쇄 PDF 경로는 이 화면 어디에도 없다(절대 규칙 3).
 * - 속표지의 [읽기] -> 쪽 이미지 넘김·핀치 줌. 뷰어의 ←는 속표지로 돌아온다. 목차(D12)는 숨겼다(R31-8).
 * - [PDF 내려받기]는 디지털 PDF의 서명 URL을 시스템에 넘긴다(`Linking`). 파일 저장·공유 라이브러리는 쓰지 않는다.
 * - 서명 URL은 필요할 때 받고 만료되면 다시 받는다. URL 값은 기록하지 않는다.
 * - 보던 쪽은 앱을 쓰는 동안만 호별로 기억한다(`viewerStore`, 메모리).
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { FrontMatter } from '../../src/components/magazine/FrontMatter'
import { PageViewer } from '../../src/components/magazine/PageViewer'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { Skeleton } from '../../src/components/nocturne/Skeleton'
import { useIssueViewer } from '../../src/hooks/useIssueViewer'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useViewerStore } from '../../src/store/viewerStore'
import { fontFamily, nocturne, shape } from '../../src/theme/nocturne'
import { issueMonthLabel } from '../../src/utils/magazine'

export default function MagazineViewerModal() {
  const router = useRouter()
  const params = useLocalSearchParams<{ issueId?: string }>()
  const issueId = typeof params.issueId === 'string' ? params.issueId : null
  const { session } = useSession()
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const viewer = useIssueViewer(issueId, { userId: session?.user.id ?? null, partnerId })
  const lastPageOf = useViewerStore((s) => s.lastPageOf)
  const setLastPage = useViewerStore((s) => s.setLastPage)

  const [mode, setMode] = useState<'front' | 'reader'>('front')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfFailed, setPdfFailed] = useState(false)

  const { issue, ensurePages, pageUrls } = viewer

  // 속표지: 1쪽(표지) 이미지의 서명 URL을 받는다.
  useEffect(() => {
    if (issue?.pageCount) void ensurePages(1)
  }, [issue, ensurePages])

  const close = useCallback(() => router.back(), [router])

  const startReading = useCallback(() => {
    if (!issue?.pageCount) return
    void ensurePages(lastPageOf(issue.id, issue.pageCount))
    setMode('reader')
  }, [issue, ensurePages, lastPageOf])

  const onPageChange = useCallback(
    (page: number) => {
      if (!issue) return
      setLastPage(issue.id, page)
      void ensurePages(page)
    },
    [issue, setLastPage, ensurePages],
  )

  const openPdf = useCallback(async () => {
    setPdfBusy(true)
    setPdfFailed(false)
    try {
      const url = await viewer.signPdf()
      if (!url) {
        setPdfFailed(true)
      } else {
        await Linking.openURL(url)
      }
    } catch {
      setPdfFailed(true)
    } finally {
      setPdfBusy(false)
    }
  }, [viewer])

  if (viewer.loading || !issue) {
    return (
      <View style={styles.wait} testID="viewer-wait">
        {viewer.error ? (
          <>
            <Text style={styles.waitText}>호를 열지 못했어요</Text>
            <PressScale onPress={close} accessibilityLabel="닫기" style={styles.close}>
              <Text style={styles.closeMark}>{'✕'}</Text>
            </PressScale>
          </>
        ) : (
          <Skeleton width="50%" height={24} />
        )}
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {mode === 'front' || !issue.pageCount ? (
        <FrontMatter
          issue={issue}
          coverUri={pageUrls[1]}
          nickname={nickname}
          names={viewer.names}
          corners={viewer.corners}
          onClose={close}
          onRead={startReading}
          onPdf={() => void openPdf()}
          pdfBusy={pdfBusy}
          pdfFailed={pdfFailed}
        />
      ) : (
        <PageViewer
          title={issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })}
          pageCount={issue.pageCount}
          initialPage={lastPageOf(issue.id, issue.pageCount)}
          pageUrls={pageUrls}
          onBack={() => setMode('front')}
          onPageChange={onPageChange}
          onImageError={(page) => void viewer.reportImageError(page)}
        />
      )}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wait: { flex: 1, backgroundColor: nocturne.paper, padding: 24, paddingTop: 120, alignItems: 'center', gap: 16 },
  waitText: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.paperMute },
  close: { width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  closeMark: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.paperMute },
})
