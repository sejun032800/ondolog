/**
 * 메인 탭(B03 · B05 · B06 · B04 · B01) - 하늘 위에 커플의 상태에 맞는 화면 하나(74-3). 그리는 일은 `features/main/MainView`.
 * 이 파일은 저장소(커플 · 프로필 · 로그인) + 읽기 훅 결과를 `MainView`에 넘기고, 버튼이 가는 곳만 정한다.
 *  - [채팅에서 첫 대화 남기기 →] -> 채팅 탭(`replace`: 탭끼리는 쌓이지 않는다)
 *  - [연인 초대하기](B05) -> 초대(`openInvite('intro')` - 74-2 `couple-invite`). I01 시트를 한 번 더 거치지 않고 바로 간다(B12)
 *  - [읽기] · 지난 호 다시 읽기 -> 뷰어(`openIssueViewer` - 뷰어는 74-6이 꽂는다)
 * 하늘(별 · 장막 .42 · 하단 장막)은 Shell의 `SkyLayer`가 메인 경로에서 켠다(`App.tsx` `skyFor`). 이 화면의 바탕은 투명이다.
 * 하늘(C) 화면으로 가는 당김 · 버튼은 없다(범위 밖).
 */
import { useEffect, useState } from 'react'
import { openInvite } from '../app/inviteEntry'
import { openIssueViewer } from '../app/viewerEntry'
import { useAuthStore } from '../auth/stores'
import { MainView } from '../features/main/MainView'
import { useLibrary, useLoveTypeSummary, useMainFacts, usePartnerName } from '../features/main/useMainData'
import type { Nav } from '../navigation'
import { useCoupleStore } from '../stores/coupleStore'
import { useProfileStore } from '../stores/profileStore'

/** 화면이 그려져 있는 동안 날짜 라벨 · D+N이 자정을 넘으면 바뀌도록 1분마다 시각을 새로 잡는다. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

export function MainTab({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const storedTemperature = useCoupleStore((s) => s.temperature)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const selfName = useProfileStore((s) => s.profile?.displayName ?? null)

  const connected = status === 'connected'
  const now = useNow()
  const partnerName = usePartnerName(connected ? partnerId : null)
  const summary = useLoveTypeSummary(userId, status === 'disconnected')
  const library = useLibrary(connected ? coupleId : null)
  const facts = useMainFacts({
    userId,
    partnerId: connected ? partnerId : null,
    coupleId: connected ? coupleId : null,
    storedTemperature: connected ? storedTemperature : null,
    issueIds: library.issues.map((i) => i.id),
  })

  return (
    <div className="screen tabScreen mainTab" data-testid="tab-screen-main">
      <div className="mainScroll">
        <MainView
          now={now}
          status={status}
          nickname={nickname}
          storedTemperature={connected ? storedTemperature : null}
          startDate={startDate}
          selfName={selfName}
          partnerName={partnerName}
          facts={facts}
          library={library}
          summary={summary}
          onInvite={() => openInvite('intro')}
          onChat={() => nav.replace('chat')}
          onOpenIssue={(issue) => openIssueViewer(issue.id)}
        />
      </div>
    </div>
  )
}
