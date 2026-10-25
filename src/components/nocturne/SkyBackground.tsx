/**
 * SkyBackground - 하늘 세계. 이미지 1장 + translateY(-viewOffsetPt) + 장막 + 배경 별.
 * 오프셋·장막 값은 src/theme/sky.ts 그대로. 모든 화면이 같은 이미지의 다른 높이를 비춘다.
 *
 * 하늘 이미지 높이 = 화면 높이 x WORLD_HEIGHT_RATIO(2.37). 폭은 화면 폭.
 * 그레인은 여기에 넣지 않는다(루트 1회 - `Grain`).
 *
 * 자식은 하늘 위에 그린다. transform은 쌓임 맥락을 만든다 - 시트에 translateY를 걸면
 * 시트에 zIndex를 명시해야 한다(sky.ts 주석).
 */
import type { ReactNode } from 'react'
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native'
import { mainBottomVeil, nocturne } from '../../theme/nocturne'
import { WORLD_HEIGHT_RATIO, veilOpacity, viewOffsetPt } from '../../theme/sky'
import { BackgroundStars } from './BackgroundStars'

const SKY = require('../../../assets/sky_world.jpg')

export type SkyView = keyof typeof viewOffsetPt

export interface SkyBackgroundProps {
  /** 시점. 기본 main(지평선·산). */
  view?: SkyView
  /** 장막 투명도를 직접 지정할 때. 기본은 sky.ts의 veilOpacity. */
  veil?: number
  /** 배경 별 명멸. 기본 켬(동작 줄이기 시 정지). */
  stars?: boolean
  /** 메인 전용 하단 장막(460pt). 위 별이 보이고 아래 카드 글자가 읽히게 한다. 기본 끔. */
  bottomVeil?: boolean
  children?: ReactNode
}

function veilFor(view: SkyView): number {
  // sky.ts에 past(지난 하늘)의 장막 값이 없다. 하늘이 열린 시점이므로 sky와 같게(0) 둔다.
  // 지난 하늘은 출시 후 하늘 단계에서 확정한다.
  return view === 'past' ? veilOpacity.sky : veilOpacity[view]
}

export function SkyBackground({ view = 'main', veil, stars = true, bottomVeil = false, children }: SkyBackgroundProps) {
  const { width, height } = useWindowDimensions()
  const worldHeight = height * WORLD_HEIGHT_RATIO

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={SKY}
          resizeMode="cover"
          style={{
            width,
            height: worldHeight,
            transform: [{ translateY: -viewOffsetPt[view] }],
          }}
        />
      </View>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: nocturne.ink, opacity: veil ?? veilFor(view) }]}
        pointerEvents="none"
        testID="sky-veil"
      />
      {stars ? <BackgroundStars /> : null}
      {bottomVeil ? (
        <View pointerEvents="none" style={styles.bottomVeil} testID="sky-bottom-veil" />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: nocturne.ink,
  },
  bottomVeil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: mainBottomVeil.height,
    experimental_backgroundImage: mainBottomVeil.gradient,
  },
})
