/**
 * 79- 화면 스모크(R114-3 목록). 화면마다 공통 단언:
 *  콘솔 오류 0 · 처리 안 된 Promise 거부 0 · 원격 요청 0 · 가로 스크롤 0 · 아래 탭 · 고정 버튼이 화면 안 · 주요 요소 1초 안 · 주요 제목이 넘치지 않음.
 * 스크린샷은 화면별 1장(저장소 밖). 끌기 · 밀기는 앱이 듣는 이벤트(B02 = touch, 하루 지우기 = pointer)를 그대로 보낸다.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { METEOR_TEXT } from './seed'

const ROOT = process.env.ONDOLOG_SMOKE_ROOT ?? path.join(os.tmpdir(), 'ondolog-smoke')
const SHOTS = path.join(ROOT, 'shots')
/** 80- (79-덧붙임 1): 이 회차의 실패 기록 폴더(회차마다 새 폴더 - 덮어쓰기 0). */
const RUN_DIR = path.join(ROOT, 'runs', process.env.ONDOLOG_SMOKE_RUN ?? 'manual')
const FIRST_FRAME_MS = 1000

interface Watch { errors: string[]; external: string[] }

async function open(page: Page, query: string): Promise<Watch> {
  const w: Watch = { errors: [], external: [] }
  page.on('console', (m) => { if (m.type() === 'error') w.errors.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`))
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => { console.error(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`) })
  })
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue()
    w.external.push(u.protocol)
    return route.abort()
  })
  await page.goto(`./?${query}`)
  return w
}

/** 화면 공통 단언 + 스크린샷. */
async function check(page: Page, w: Watch, name: string, titles: Locator[] = []): Promise<void> {
  // 열리는 연출(시트 380ms · 화면 260ms 등 유한한 애니메이션)이 끝난 모습을 잰다. 반짝임 같은 무한 반복은 기다리지 않는다.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
    .map((a) => a.finished.catch(() => undefined))))
  await page.waitForTimeout(100)
  const geo = await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const doc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    const screen = document.querySelector('[data-screen]') as HTMLElement | null
    const fixed = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="tab-bar"], .footer button, [data-testid="feed-add-fab"], [data-testid="chat-composer"]'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => { const r = el.getBoundingClientRect(); return { id: el.dataset.testid ?? el.textContent?.trim().slice(0, 12) ?? '?', l: r.left, r: r.right, t: r.top, b: r.bottom } })
      .filter((r) => r.l < -1 || r.r > vw + 1 || r.t < -1 || r.b > vh + 1)
    return { vw, doc, screenOverflow: screen ? screen.scrollWidth - screen.clientWidth : 0, outside: fixed }
  })
  expect.soft(geo.doc, '가로 스크롤 0(문서 폭 ≤ 뷰포트)').toBeLessThanOrEqual(geo.vw)
  expect.soft(geo.screenOverflow, '화면 틀 가로 넘침 0').toBeLessThanOrEqual(0)
  expect.soft(geo.outside, '아래 탭 · 고정 버튼이 화면 안').toEqual([])
  for (const t of titles) {
    const over = await t.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: el.scrollWidth - el.clientWidth, right: r.right - window.innerWidth, left: r.left }
    })
    expect.soft(over.x, `제목 넘침 0 (${name})`).toBeLessThanOrEqual(1)
    expect.soft(over.right, `제목이 오른쪽 밖 0 (${name})`).toBeLessThanOrEqual(1)
    expect.soft(over.left, `제목이 왼쪽 밖 0 (${name})`).toBeGreaterThanOrEqual(-1)
  }
  await page.screenshot({ path: path.join(SHOTS, test.info().project.name, `${name}.png`) })
  expect(w.errors, '콘솔 오류 · 처리 안 된 거부 0').toEqual([])
  expect(w.external, '원격 요청 0').toEqual([])
}

const seen = (l: Locator) => expect(l).toBeVisible({ timeout: FIRST_FRAME_MS })

/** 앱은 이동 직후 `NAV_COOLDOWN_MS`(350ms, `src/navigation.tsx` - 연타 방지) 동안 다음 이동을 일부러 받지 않는다. 사람 손보다 빠른 시험만 걸리므로 그만큼 쉰다. */
const settle = (page: Page) => page.waitForTimeout(400)

/** 계정 세계로 열고 메인이 뜰 때까지. */
async function openAccount(page: Page): Promise<Watch> {
  const w = await open(page, 'world=account')
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 })
  await settle(page)
  return w
}

async function tab(page: Page, name: 'main' | 'chat' | 'feed' | 'magazine' | 'settings'): Promise<void> {
  await page.getByTestId(`tab-${name}`).click()
  await settle(page)
}

/** 앱이 듣는 touch 이벤트를 그대로 보낸다(TouchEvent 생성자 유무와 상관없이 - touches만 읽는다). */
async function touchDrag(target: Locator, fromY: number, toY: number, steps = 8): Promise<void> {
  await target.evaluate((el, { fromY, toY, steps }) => {
    const fire = (type: string, y: number | null) => {
      const ev = new Event(type, { bubbles: true, cancelable: true })
      const touches = y === null ? [] : [{ clientX: 180, clientY: y, identifier: 1, target: el }]
      Object.defineProperty(ev, 'touches', { value: touches })
      Object.defineProperty(ev, 'changedTouches', { value: touches })
      el.dispatchEvent(ev)
    }
    fire('touchstart', fromY)
    for (let i = 1; i <= steps; i++) fire('touchmove', fromY + ((toY - fromY) * i) / steps)
    fire('touchend', null)
  }, { fromY, toY, steps })
}

/** 온보딩 첫 화면 -> 이름 · 성별 · 생년월일 -> MBTI(알아요 ENFP) -> 성격 검사 첫 문항이 보일 때까지. */
async function toQuiz(page: Page, w: Watch, shots: boolean): Promise<void> {
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible({ timeout: 6000 })
  if (shots) await check(page, w, 'onboarding-intro')
  await page.getByRole('button', { name: '시작하기' }).click()
  const name = page.getByPlaceholder('이름')
  await seen(name)
  await name.fill('가온')
  await page.getByRole('button', { name: '여', exact: true }).click()
  const birth = page.getByPlaceholder('YYYY.MM.DD')
  await birth.fill('19970314')
  await expect(birth).toHaveValue('1997.03.14')
  if (shots) await check(page, w, 'onboarding-basic')
  await page.getByRole('button', { name: '다음' }).click()
  await seen(page.getByText('알아요', { exact: true }))
  await page.getByText('알아요', { exact: true }).click()
  await page.getByRole('button', { name: '다음' }).click()
  for (const l of ['E', 'N', 'F', 'P']) await page.locator('.letterBtn', { hasText: new RegExp(`^${l} `) }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await seen(page.locator('button.choice').first())
}

/** 실패하면 회차 파일(failures.md)에 한 줄: 엔진 · 시험 · 화면 이름 · 걸린 요소(오류 첫 줄) · 스크린샷 경로. */
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return
  try {
    fs.mkdirSync(RUN_DIR, { recursive: true })
    const slug = `${info.project.name}-${info.title.replace(/[^A-Za-z0-9가-힣]+/g, '-').slice(0, 60)}`
    const shot = path.join(RUN_DIR, `${slug}.png`)
    const screenName = await page.locator('[data-screen]').first().getAttribute('data-screen', { timeout: 1000 }).catch(() => null)
    await page.screenshot({ path: shot }).catch(() => undefined)
    // eslint-disable-next-line no-control-regex
    const plain = (info.errors[0]?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '')
    const first = plain.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
    const element = plain.match(/(getByTestId|locator|getByRole|getByText|getByPlaceholder)\([^\n]*\)/)?.[0] ?? '-'
    fs.appendFileSync(path.join(RUN_DIR, 'failures.md'),
      `| ${new Date().toISOString()} | ${info.project.name} | ${info.title} | ${screenName ?? '-'} | ${element} | ${first.slice(0, 160)} | ${shot} |\n`)
  } catch {
    // 기록 실패가 시험 결과를 바꾸지 않는다.
  }
})

test.describe('79- 화면 스모크', () => {
  test('온보딩: 첫 화면 · 이름 · 생년월일 · 성별 · 성격 검사 한 문항', async ({ page }) => {
    const w = await open(page, 'world=onboarding')
    await toQuiz(page, w, true)
    await check(page, w, 'onboarding-quiz')
    const before = await page.locator('button.choice').first().innerText()
    await page.locator('button.choice').first().click()
    await expect(page.locator('button.choice').first()).not.toHaveText(before, { timeout: 3000 })
  })

  test('동의: 5개 항목 · [보기] 처리방침 전문 스크롤', async ({ page }) => {
    const w = await open(page, 'world=onboarding')
    await toQuiz(page, w, false)
    const more = page.getByRole('button', { name: /더 자세히 보기/ })
    for (let i = 0; i < 8 && !(await more.isVisible()); i++) {
      await page.locator('button.choice').first().click()
      await page.waitForTimeout(700)
    }
    await more.click()
    await expect(page.getByText('이용약관', { exact: true })).toBeVisible({ timeout: 3000 })
    for (const label of [/세 이상입니다/, /^이용약관$/, /^개인정보 처리방침$/, /^AI 콘텐츠 생성을 위한 데이터 활용$/, /^마케팅 정보 수신$/]) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
    await check(page, w, 'consent')
    // [보기]는 이용약관 · 개인정보 처리방침 · AI · 마케팅 순서 - 두 번째가 처리방침.
    await page.getByRole('button', { name: '보기', exact: true }).nth(1).click()
    const body = page.getByTestId('legal-body')
    await seen(body)
    await expect(body.getByRole('heading', { level: 1 })).toContainText('개인정보 처리방침')
    await page.waitForTimeout(450) // 시트 올라오는 연출(380ms)
    const scrolled = await body.evaluate(async (el) => {
      el.scrollTop = el.scrollHeight
      await new Promise((r) => setTimeout(r, 150))
      return { scrollable: el.scrollHeight > el.clientHeight, end: el.scrollTop + el.clientHeight >= el.scrollHeight - 2, text: (el as HTMLElement).innerText }
    })
    expect(scrolled.scrollable, '처리방침 전문이 시트 안에서 스크롤된다').toBe(true)
    expect(scrolled.end, '처리방침 전문 끝까지 스크롤').toBe(true)
    // v1.2(78-)에서 더한 알림 토큰 줄이 실려 있다.
    expect(scrolled.text).toContain('알림')
    await check(page, w, 'consent-privacy-sheet')
  })

  test('메인: 온도 · 문구 한 줄 · D+ · 매거진 % · 아래 탭', async ({ page }) => {
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    await expect(page.locator('[data-testid^="main-hero-"]').first()).toBeVisible()
    await expect(page.getByTestId('main-temperature-caption')).toBeVisible()
    await expect(page.getByTestId('main-issue-percent')).toBeVisible()
    for (const t of ['main', 'chat', 'feed', 'magazine', 'settings']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
    // KST 계산(엔진의 Date · Intl): 사귄 날 = 오늘(KST)에서 210일 전(seed) -> D+211, 세로 날짜 = 오늘(KST) "11월 17일 화요일" 꼴.
    await expect(page.getByTestId('main-days')).toHaveText('D+211')
    const kst = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
    expect((await page.getByTestId('main-vertical-date').textContent())?.replace(/\s/g, '')).toBe(kst.replace(/\s/g, ''))
    await expect(page.getByTestId('main-issue-percent')).toHaveText(/^\d{1,3}%$/)
    await check(page, w, 'main', [page.getByTestId('main-days'), page.getByTestId('main-temperature-caption')])
  })

  test('하늘: B02 끌어내리기 · C01 · 별 누르기 · C02 위로 · 줄인 모션', async ({ page }) => {
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    const scroller = page.locator('.mainScroll')
    await touchDrag(scroller, 120, 320)
    const sky = page.getByTestId('sky-screen')
    await seen(sky)
    const thisMonth = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7)
    await expect(page.getByTestId(`sky-month-${thisMonth}`)).toBeVisible()
    await check(page, w, 'sky-c01')
    await page.locator('[data-testid^="sky-star-"]').first().click()
    await seen(page.getByTestId('sky-sheet-day'))
    await check(page, w, 'sky-star-sheet')
    await page.keyboard.press('Escape')
    await page.mouse.click(10, 10)
    // C02: 위로 끌면(스크롤을 위로) 지난달이 보인다.
    const prev = (() => { const d = new Date(`${thisMonth}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) })()
    await page.getByTestId('sky-scroll').evaluate((el) => { el.scrollTop = 0 })
    await expect(page.getByTestId(`sky-month-${prev}`)).toBeInViewport()
    await check(page, w, 'sky-c02')
  })

  test('하늘: 줄인 모션에서도 열림', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    await touchDrag(page.locator('.mainScroll'), 120, 320)
    await seen(page.getByTestId('sky-screen'))
    await check(page, w, 'sky-reduced-motion')
  })

  test('85- 하늘 2단계: [둘러보기] 칩 두 폭(390 글자 · 360 원) · C08-alt 끌기 · C01로 돌아옴', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    await touchDrag(page.locator('.mainScroll'), 120, 320)
    await seen(page.getByTestId('sky-screen'))
    const chip = page.getByTestId('sky-tour-open')
    await expect(chip).toHaveAttribute('aria-label', '하늘 둘러보기')
    await expect(page.getByTestId('sky-tour-open-text')).toBeVisible() // 390pt: 글자 칩
    const wide = await chip.boundingBox()
    const close = await page.getByTestId('sky-close').boundingBox()
    expect(wide && wide.width > 60).toBe(true)
    expect(wide && close && Math.abs((wide.y + wide.height / 2) - (close.y + close.height / 2)) < 1).toBe(true) // ✕와 세로 중심 같음
    expect(wide && close && wide.x + wide.width <= close.x).toBe(true) // ✕ 왼쪽
    await check(page, w, 'sky-c01-chip-390', [page.getByTestId('sky-title')])
    await page.setViewportSize({ width: 360, height: 780 })
    await expect(page.getByTestId('sky-tour-open-text')).toBeHidden() // 360pt: 40pt 원 아이콘
    const narrow = await chip.boundingBox()
    expect(narrow && Math.round(narrow.width) === 40 && Math.round(narrow.height) === 40).toBe(true)
    await check(page, w, 'sky-c01-chip-360', [page.getByTestId('sky-title')])

    // C08-alt: Playwright에는 센서 값이 없다 -> 센서 기다림 뒤 끌기(또는 처음부터 끌기)
    await chip.click()
    const tour = page.getByTestId('sky-tour')
    await seen(tour)
    await expect(tour).toHaveAttribute('data-mode', 'drag', { timeout: 3000 })
    await page.getByTestId('sky-guide-ok').click() // C10 처음 한 번
    await expect(page.getByTestId('sky-drag-hint')).toBeVisible()
    await check(page, w, 'sky-c08-alt')
    const yaw0 = await tour.getAttribute('data-yaw')
    const box = await tour.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 6 })
      await page.mouse.up()
    }
    await expect(page.getByTestId('sky-drag-hint')).toBeHidden()
    expect(await tour.getAttribute('data-yaw')).not.toBe(yaw0)
    await page.getByTestId('sky-close').click()
    await expect(tour).toBeHidden()
    await expect(page.getByTestId('sky-screen')).toBeVisible() // 메인이 아니라 C01
    await expect(chip).toBeVisible()
  })

  test('85- 설정 H01: OUR SKY "별 반짝임" 줄', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'settings')
    const row = page.getByTestId('settings-row-sky-twinkle')
    await seen(row)
    await expect(row).toContainText('별 반짝임')
    await expect(row).toContainText('하늘의 별이 천천히 숨 쉬어요')
    await expect(page.getByTestId('settings-sky-twinkle')).toHaveAttribute('aria-checked', 'true')
    await check(page, w, 'settings-oursky')
  })

  test('84-e 유성: C01 제자리 빛(줄인 모션) -> C03 떨어진 말 · 390 / 360 폭', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }) // 제자리 빛 - 움직이지 않아 누르기가 안정적이다(움직이는 유성은 아래 시험)
    await page.setViewportSize({ width: 390, height: 844 })
    const w = await open(page, 'world=account&meteor=1')
    await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 })
    await settle(page)
    await seen(page.getByTestId('main-days'))
    await touchDrag(page.locator('.mainScroll'), 120, 320)
    await seen(page.getByTestId('sky-screen'))
    const meteor = page.getByTestId('sky-meteor')
    await expect(meteor).toBeVisible({ timeout: 12_000 }) // 하늘이 준비된 뒤 4~10초
    await expect(meteor).toHaveAttribute('data-mode', 'still')
    await meteor.click()
    const fallen = page.getByTestId('sky-fallen')
    await seen(fallen)
    await expect(page.getByTestId('sky-fallen-text')).toHaveText(METEOR_TEXT)
    await expect(page.getByTestId('sky-fallen-count')).toHaveText('1 / 1')
    await expect(page.getByTestId('sky-fallen-next')).toBeDisabled()
    await check(page, w, 'sky-c03-390')
    await page.setViewportSize({ width: 360, height: 780 })
    await check(page, w, 'sky-c03-360')
    await page.getByTestId('sky-fallen-close').click()
    await expect(fallen).toBeHidden()
    await expect(page.getByTestId('sky-screen')).toBeVisible()
  })

  test('84-e 유성: 움직이는 유성(기본 모션) -> 누르면 C03', async ({ page }) => {
    const w = await open(page, 'world=account&meteor=1')
    await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 })
    await settle(page)
    await seen(page.getByTestId('main-days'))
    await touchDrag(page.locator('.mainScroll'), 120, 320)
    await seen(page.getByTestId('sky-screen'))
    const meteor = page.getByTestId('sky-meteor')
    await expect(meteor).toBeVisible({ timeout: 12_000 })
    await expect(meteor).toHaveAttribute('data-mode', 'fall')
    await meteor.dispatchEvent('click') // 움직이는 중이라 위치 고정을 기다리지 않고 누른다
    await seen(page.getByTestId('sky-fallen'))
    expect(w.errors).toEqual([])
  })

  test('84-e 설정 H01: OUR SKY "유성 떨어뜨리기" 줄(첫 줄 · 기본 켬)', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'settings')
    const row = page.getByTestId('settings-row-sky-meteor')
    await seen(row)
    await expect(row).toContainText('유성 떨어뜨리기')
    await expect(row).toContainText('다정한 말이 유성으로 떨어져요')
    await expect(page.getByTestId('settings-sky-meteor')).toHaveAttribute('aria-checked', 'true')
    await check(page, w, 'settings-oursky-meteor')
  })

  test('채팅: 목록 · 입력창 · 사진 칸 비율 · 맨 아래 붙기', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'chat')
    const list = page.getByTestId('chat-list')
    await seen(list)
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('chat-message').first()).toBeVisible()
    const box = page.getByTestId('chat-photo-box').first()
    await expect(box).toBeVisible()
    await page.waitForTimeout(400)
    const ratio = await box.evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height } })
    expect(ratio.w).toBeGreaterThan(40)
    expect(ratio.h).toBeGreaterThan(40)
    expect(ratio.w / ratio.h).toBeGreaterThan(0.4)
    expect(ratio.w / ratio.h).toBeLessThan(2.5)
    // 서버 시각 모양(소수 6자리 · +00:00)을 엔진이 읽어 시간 표시가 깨지지 않는다(Invalid Date · NaN 0).
    const times = await page.getByTestId('chat-time').allTextContents()
    expect(times.length).toBeGreaterThan(0)
    for (const t of times) expect(t).not.toMatch(/NaN|Invalid/)
    const bottom = await list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)
    expect(bottom, '맨 아래 붙기').toBeLessThanOrEqual(2)
    await page.getByTestId('chat-input').click()
    await check(page, w, 'chat', [page.getByTestId('chat-header')])
  })

  test('피드 기록: 날짜 카드 · 하루 지우기 밀기 · 장소 · 사진 · 메모 입력', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'feed')
    const front = page.getByTestId('swipe-front').first()
    await seen(front)
    await check(page, w, 'feed')
    const b = (await front.boundingBox())!
    await page.mouse.move(b.x + b.width - 30, b.y + b.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width - 30 - i * 20, b.y + b.height / 2)
    await page.mouse.up()
    await expect(page.getByTestId('day-delete-action').first()).toBeEnabled()
    await check(page, w, 'feed-swipe')
    await page.mouse.click(5, b.y + b.height / 2)
    await page.getByTestId('feed-add-fab').click()
    const sheet = page.getByTestId('record-sheet')
    await seen(sheet)
    const memo = page.getByTestId('memo-input')
    if (await memo.count() > 0) await memo.fill('만든 메모')
    const picker = page.getByTestId('pick-photos')
    if (await picker.count() > 0) {
      await picker.click()
      await seen(page.getByTestId('chat-attach-album'))
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 3000 }), page.getByTestId('chat-attach-album').click()])
      expect(chooser.isMultiple()).toBe(true)
      expect(await chooser.element().getAttribute('accept')).toBe('image/*')
      await chooser.setFiles([])
    }
    await check(page, w, 'feed-record-sheet')
  })

  test('서재 · 뷰어: 목록 · 호 열기', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'magazine')
    await seen(page.getByTestId('library-shelf'))
    await check(page, w, 'library')
    await page.locator('[data-testid^="shelf-issue-"]').first().click()
    await seen(page.getByTestId('front-matter'))
    await check(page, w, 'viewer-front')
    await page.getByTestId('front-matter-read').click()
    await seen(page.getByTestId('page-viewer'))
    await check(page, w, 'viewer-pages')
  })

  test('설정: 알림 · 개인정보 & 약관 · 해제 · 탈퇴 화면 진입', async ({ page }) => {
    const w = await openAccount(page)
    const go = async (row: string) => {
      await expect(page.getByTestId('tab-bar')).toBeVisible()
      await tab(page, 'settings')
      await expect(page.getByTestId(`settings-row-${row}`)).toBeVisible()
      await page.getByTestId(`settings-row-${row}`).click()
      await settle(page)
    }
    await tab(page, 'settings')
    await seen(page.getByTestId('settings-row-notify'))
    await check(page, w, 'settings')
    const back = async () => { await page.getByRole('button', { name: '뒤로' }).first().click(); await settle(page) }
    await go('notify')
    await seen(page.getByTestId('settings-notify'))
    await check(page, w, 'settings-notify')
    await back()
    await go('privacy')
    await seen(page.getByTestId('settings-privacy'))
    await check(page, w, 'settings-privacy')
    await back()
    await go('partner')
    await seen(page.getByTestId('couple-unlink'))
    await settle(page)
    await page.getByTestId('couple-unlink').click()
    await seen(page.getByTestId('unlink-phrase-input'))
    await check(page, w, 'settings-unlink')
    await back()
    await back()
    await go('profile')
    await seen(page.getByTestId('profile-withdraw'))
    await settle(page)
    await page.getByTestId('profile-withdraw').click()
    await seen(page.getByTestId('withdraw-phrase-input'))
    await check(page, w, 'settings-withdraw')
  })

  test('저장소가 막혀도(사생활 보호 모드 · 할당량) 앱이 멈추지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      const boom = () => { throw new DOMException('blocked', 'QuotaExceededError') }
      Storage.prototype.setItem = boom
      Storage.prototype.getItem = boom
      Storage.prototype.removeItem = boom
      Object.defineProperty(window, 'indexedDB', { get: boom })
    })
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    await tab(page, 'chat')
    await seen(page.getByTestId('chat-list'))
    await tab(page, 'feed')
    await seen(page.getByTestId('swipe-front').first())
    await check(page, w, 'storage-blocked')
  })

  test('깨진 기기 저장값(81-): 메인 · 피드 - 대체 화면 없이 바로 정상 · cache_fail만 기록 · 내용 0', async ({ page }) => {
    // 앱에 시험 모드를 넣지 않는다: 첫 그림에 쓰는 기기 저장분을 깨진 모양으로 둔다.
    //  - 피드: 80- 오류 경계 시험이 쓴 모양 그대로(날짜 목록이 배열 대신 글자) - 80-에서는 대체 화면 + [다시 시도]도 다시 깨짐이었다.
    //  - 메인: 요약의 온도 칸이 숫자 대신 글자 · 서재 목록이 배열 대신 숫자.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ondolog.dc1:smoke-user-a:feed', JSON.stringify({ chapters: [{ key: '2026-11', dates: 'broken' }], names: {} }))
        localStorage.setItem('ondolog.dc1:smoke-user-a:main', JSON.stringify({ coupleId: 'smoke-couple', partnerId: 'smoke-user-b', temperature: 'broken' }))
        localStorage.setItem('ondolog.dc1:smoke-user-a:main:library', JSON.stringify({ __v: 1, d: { coupleId: 'smoke-couple', issues: 3, next: null } }))
      } catch { /* 없음 */ }
    })
    const w = await openAccount(page)
    await seen(page.getByTestId('main-days'))
    await expect(page.getByTestId('account-problem')).toHaveCount(0)
    await tab(page, 'feed')
    await seen(page.getByTestId('swipe-front').first())
    await expect(page.getByTestId('account-problem')).toHaveCount(0)
    const logs = async () => page.evaluate(() =>
      ((window as unknown as { __ONDOLOG_SMOKE_RPC__: { fn: string; args: Record<string, unknown> }[] }).__ONDOLOG_SMOKE_RPC__ ?? []).filter((c) => c.fn === 'log_app_error'))
    await expect.poll(async () => (await logs()).reduce((n, c) => n + Number(c.args.p_count), 0), { timeout: 8000 }).toBe(3)
    await page.waitForTimeout(500)
    const sent = await logs()
    expect(sent.every((c) => c.args.p_kind === 'cache_fail')).toBe(true)
    expect(sent.reduce((n, c) => n + Number(c.args.p_count), 0)).toBe(3) // 깨진 키 셋 - 키마다 1번(반복 0)
    for (const c of sent) expect(Object.keys(c.args).sort()).toEqual(['p_count', 'p_kind', 'p_platform', 'p_screen', 'p_version'])
    const text = JSON.stringify(sent.map((c) => c.args))
    for (const bad of ['broken', 'object', 'Objects', 'react', 'smoke-user', 'smoke-couple', '가온', '나래', 'Error']) expect(text).not.toContain(bad)
    // 새 모양(버전 감싸기)으로 다시 채워졌다(서버 읽기).
    const feedSaved = await page.evaluate(() => localStorage.getItem('ondolog.dc1:smoke-user-a:feed'))
    expect(JSON.parse(feedSaved ?? '{}').__v).toBe(1)
    await check(page, w, 'cache-broken')
  })

  test('로그아웃 확인(81-b · 82-): 보내지 못한 메시지가 있으면 수와 줄 더(R119-2 · 계정 전환 줄) · [취소]하면 그대로', async ({ page }) => {
    // 대기열(기기 Preferences) - 자동 재시도가 멈춘(failed) 글 2 · 사진 1. 앱 시작 이어 보내기가 바로 보내지 않는 상태(사람이 [다시 보내기]를 눌러야 감).
    await page.addInitScript(() => {
      const t = (id: string) => ({ clientMsgId: id, coupleId: 'smoke-couple', senderId: 'smoke-user-a', body: '글', sentAt: '2026-11-17T00:00:00Z', retryCount: 5, status: 'failed' })
      const p = { clientId: 'q-photo', kind: 'message', coupleId: 'smoke-couple', userId: 'smoke-user-a', localUri: 'chat-photo-queue/q-photo.jpg', ext: 'jpg', contentType: 'image/jpeg', sentAt: '2026-11-17T00:00:00Z', retryCount: 5, status: 'failed' }
      try {
        localStorage.setItem('CapacitorStorage.chat_queue:smoke-couple', JSON.stringify({ __v: 1, items: [t('q-1'), t('q-2')] }))
        localStorage.setItem('CapacitorStorage.chat_photo_queue:smoke-couple:smoke-user-a', JSON.stringify({ __v: 1, items: [p] }))
      } catch { /* 없음 */ }
    })
    const w = await openAccount(page)
    await tab(page, 'settings')
    await page.getByTestId('settings-row-profile').click()
    await settle(page)
    await page.getByTestId('profile-logout').click()
    await seen(page.getByTestId('logout-confirm'))
    // 82-(R120-4 ③): 대기열 줄 바로 뒤에 계정 전환 줄(R119-2 순서)
    await expect(page.getByTestId('confirm-note')).toHaveText(['아직 보내지 못한 메시지 3개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요.', '다른 계정으로 로그인하면 이 폰에서 사라져요.'])
    await expect(page.getByText('다시 로그인하면 기록은 그대로 볼 수 있어요.')).toBeVisible()
    await check(page, w, 'logout-unsent')
    await page.getByTestId('confirm-no').click()
    await expect(page.getByTestId('logout-confirm')).toBeHidden()
    const kept = await page.evaluate(() => localStorage.getItem('CapacitorStorage.chat_queue:smoke-couple'))
    expect(JSON.parse(kept ?? '{}').items).toHaveLength(2)
  })

  test('오프라인 첫 실행(81-b): 저장된 로그인 + 기기 저장값 비움 -> 시작 화면 0 · 메인 자리 표시 + 끊김 띠', async ({ page }) => {
    // 기기가 오프라인이라 함(navigator.onLine = false - 스모크 서버 자체는 열려 있어야 해서 연결은 끊지 않고 기기 신호만) + 가짜 클라이언트가 모든 요청을 연결 오류로,
    // 세션 갱신도 실패(세션 null + 오류). 저장된 로그인은 Preferences에 있다(81- 덮어 설치 직후 비행기 모드와 같은 모양). 기기 저장값(ondolog.dc1:)은 0.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
      try { localStorage.setItem('CapacitorStorage.sb-smoke-auth-token', JSON.stringify({ access_token: 'smoke', refresh_token: 'smoke', expires_at: 1, user: { id: 'smoke-user-a' } })) } catch { /* 없음 */ }
    })
    const w = await open(page, 'world=account')
    await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 8000 })
    await settle(page)
    await expect(page.locator('[data-screen="main"]')).toBeVisible()
    await expect(page.getByTestId('connection-banner')).toBeVisible()
    await expect(page.getByTestId('account-problem')).toHaveCount(0)
    for (const s of ['intro', 'basic', 'auth', 'callback', 'consent']) await expect(page.locator(`[data-screen="${s}"]`)).toHaveCount(0)
    await check(page, w, 'offline-first-run')
  })

  test('법무: 세 문서 전문 · 자리표시자 0', async ({ page }) => {
    const w = await openAccount(page)
    await tab(page, 'settings')
    await page.getByTestId('settings-row-privacy').click()
    await settle(page)
    for (const key of ['terms', 'privacy', 'aiUsage']) {
      await page.getByTestId(`privacy-row-${key}`).click()
      const body = page.getByTestId('legal-body')
      await seen(body)
      const text = await body.innerText()
      expect(text.length).toBeGreaterThan(200)
      expect(text).not.toMatch(/[{}]|\[자리표시자\]|TODO/)
      await check(page, w, `legal-${key}`)
      await page.getByRole('button', { name: '닫기' }).first().click()
      await expect(body).toBeHidden()
    }
  })
})
