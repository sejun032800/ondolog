/**
 * 매거진 탭 - 서재(D01) · 첫 호 시작(D14) · 미연결(D16). docs/design/nocturne `N-T-Tabs` D01, `N-S-D2-Magazine` D14,
 * `N-S-D3-Magazine` D16. 라우트: MASTER 11-3 `(tabs)/magazine.tsx`.
 *
 * - 서재에는 **발행된 호만** 꽂힌다(`issues_public`, 인쇄 PDF 경로는 이 화면 어디에도 없다 - 절대 규칙 3).
 * - 커플 전용 기능이라 `<CoupleGate>`로 감싼다. 미연결 유저에게도 탭은 보이고, 들어오면 D16(잠긴 문)이 보인다.
 * - 표지를 누르면 `(modals)/magazine-viewer`(D10 속표지 -> D11 뷰어)가 시트로 올라온다.
 * - 다음 호 카드의 "제작 현황 →"은 숨긴다(D02는 U5). 정렬·검색(D13)도 이번 범위 밖이다.
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoupleGate } from '../../src/components/CoupleGate'
import { Unconnected } from '../../src/components/magazine/EmptyShelves'
import { LibraryContent } from '../../src/components/magazine/LibraryContent'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { useLibrary } from '../../src/hooks/useLibrary'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'
import { nocturne, shape, type } from '../../src/theme/nocturne'
import { libraryMode } from '../../src/utils/magazine'

export default function MagazineTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const userId = session?.user.id ?? null
  const refreshCouple = useCoupleStore((s) => s.refresh)
  const connection = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const library = useLibrary(connection === 'connected' ? coupleId : null)

  useEffect(() => {
    if (userId) void refreshCouple(userId)
  }, [userId, refreshCouple])

  const mode = libraryMode({
    connection,
    loading: library.loading,
    error: library.error,
    publishedCount: library.issues.length,
  })
  const bottom = insets.bottom + shape.tabBarGap + shape.tabBarHeight + 24
  const top = insets.top + 14

  return (
    <ScreenFrame>
      <View style={[styles.header, { paddingTop: top }]}>
        <Text style={styles.title}>매거진</Text>
      </View>
      <CoupleGate
        fallback={
          <View style={[styles.gate, { paddingBottom: bottom }]}>
            <Unconnected onInvite={() => router.push('/couple-gate')} />
          </View>
        }
      >
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}>
          <LibraryContent
            mode={mode}
            library={library}
            onOpen={(issue) => router.push({ pathname: '/magazine-viewer', params: { issueId: issue.id } })}
            onRetry={() => void library.reload()}
          />
        </ScrollView>
      </CoupleGate>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: shape.space.screen },
  title: { ...type.display, fontSize: 26, color: nocturne.text },
  scroll: { paddingHorizontal: shape.space.screen, paddingTop: 28, gap: 28 },
  gate: { flex: 1, paddingHorizontal: 20, paddingTop: 72 },
})
