# PE 조사 메모 — iOS 두 길 비교 (R109-5 · R113-3) — 조사만 · 위임 0

> 작성: 프롬프트 엔지니어 세션 / 2026-11-16
> 전제: 실제 커플 = iPhone 14 Pro · 15 Pro. 그중 한 대는 Proteur 본인 폰 → **실기기 확인은 Proteur 폰으로 바로 가능** · Mac 없음
> 지금 앱: `web/` Vite + React + Capacitor(Android) · 로그인 = Supabase OAuth(카카오) → 인앱 브라우저 → 앱 링크 `ondolog://auth/callback`(R69-4) · 푸시 = FCM V1(78-) · 기기 저장(76-) · 사진 전송 큐(파일 저장)
> ⚠️ "일수"는 PE 추정(공식 수치 아님). 공식 수치는 출처 표기

---

## 1. 한 장 요약

| | (가) 원격 Mac 빌드 + TestFlight | (나) iPhone 홈 화면 웹 앱 |
|---|---|---|
| 한 줄 | 지금 Capacitor 앱에 iOS를 더해 클라우드 Mac에서 빌드 → TestFlight로 두 폰에 설치 | 웹 앱을 HTTPS 주소에 올리고 Safari에서 "홈 화면에 추가" |
| 돈 | Apple Developer **연 99 USD**¹ + 클라우드 빌드 **월 500분 무료**(Codemagic 개인, macOS M2 · 넘으면 분당 0.095 USD)² | 0원(정적 호스팅 무료 등급 · 도메인은 선택) |
| Apple 계정 | **필요**(가입 승인 대기 있음) | 불필요 — iOS 웹 푸시도 Apple Developer 가입 없이 됨³ |
| 첫 설치까지(추정) | 가입 승인 1~3일 ‖ 개발 3~5일 → TestFlight 당일(내부 테스터) | 개발 4~7일(+ 아래 위험 검증) |
| 실제 커플 설치 | TestFlight 앱 → 초대 수락 · 내부 테스터 최대 100명(App Store Connect 사용자) · 외부 최대 10,000명(첫 빌드 베타 심사) · **빌드 90일 만료**⁴ | Safari로 주소 열기 → 공유 → 홈 화면에 추가 |
| 카카오 로그인 | 지금 방식 그대로(인앱 브라우저 → `ondolog://` 복귀). iOS는 URL 스킴 등록 · 실기기 검증 필요 | **가장 큰 위험**: 홈 화면 앱(standalone)에서 외부 로그인 → 복귀 때 Safari와 저장소가 갈려 세션이 앱으로 안 돌아오는 문제가 여러 해 보고됨⁵ → 실기기로 먼저 확인해야 함 |
| 푸시 | 78- 서버 그대로(FCM이 APNs로 전달). 추가: APNs 인증 키(.p8)를 Firebase에 · iOS 앱 Firebase 등록 · Push 기능 · AppDelegate 2메서드(78- 보고) | iOS 16.4+ **홈 화면 앱에서만** 웹 푸시 · 사용자 버튼 누름으로 권한 요청 · manifest `display: standalone`³ · FCM JS SDK + VAPID 키로 가능⁶ → 서버는 토큰 종류 `web` 추가 · 서비스 워커 · 앱 쪽 새 경로 |
| 사진 | 지금 Capacitor 경로 + iOS 권한 문구(Info.plist) | 파일 선택: 사진 보관함에서 고르면 **HEIC → JPEG 변환 · GPS 제거 · 촬영 시각 등 EXIF 유지**(iOS 16.4+ 보고) · 단 업로드 중 카메라로 바로 찍은 사진은 메타데이터 손실 보고⁷ |
| 기기 저장(오프라인) | 앱 저장소 — 지금 76- 장치 그대로 | 브라우저 저장소. 홈 화면 앱은 브라우저와 같은 할당량, 저장 압박 · 오래 미사용 때 지워질 수 있음, "지속 모드" 요청 가능⁸ → 76- 저장 장치는 대체로 동작하나 **사진 전송 큐(파일)**는 다시 짜야 함 |
| 스크롤 · 키보드 · 안전 영역 | WKWebView — Android와 다름. 51- 핵심 한 바퀴 필요 | 같은 WebKit + standalone 고유 문제(주소창 없음 · 키보드 뷰포트). 51- 핵심 한 바퀴 필요 |
| 심사 | TestFlight 내부 테스터: 심사 없음 · 외부: 첫 빌드 베타 심사⁴ | 없음 |
| 스토어 출시로 이어지나 | **예** — 같은 앱을 그대로 제출 | **아니오** — 출시하려면 결국 (가)를 다시 해야 함 |
| 다시 열 Android 작업 | 거의 없음(같은 코드 · 플랫폼 분기) | Capacitor 플러그인마다 웹 대체 경로(푸시 · 사진 · 앱 링크 · 큐) — 코드 갈래가 둘로 늘어남 |
| 공개 노출 | 없음(TestFlight 초대) | **공개 HTTPS 주소에 앱을 다시 올림** — 웹 시험판을 내린 결정(R8x)과 부딪힘 · Supabase 리디렉션 허용 목록 · 카카오 사이트 도메인 추가 |

## 2. 두 길 모두에 걸리는 사실 (중요)

1. **App Store 4.8(로그인 서비스)** — 카카오 같은 외부 로그인으로 기본 계정을 만들게 하면, **"이메일 비공개 · 이름과 이메일만 · 광고 추적 없음" 조건을 갖춘 다른 로그인(예: Sign in with Apple)을 같은 수준으로 함께 제공**해야 함⁹. 
   - TestFlight 내부 시험에는 영향이 없음. 외부 베타 심사 · **스토어 출시 때는 걸림**
   - Sign in with Apple을 넣으면 처리방침에 Apple을 받는 곳으로 추가해야 하고, 계정 연결 규칙도 정해야 함 → **M4 출시 전 PM 결정 항목**
2. **4.2(최소 기능)** — "포장만 한 웹사이트" 이상이어야 함⁹. 온도록은 푸시 · 사진 · 오프라인 · 매거진이 있어 일반적으로 해당 없음으로 보지만, 출시 심사 때 설명 준비
3. 카카오: 지금 로그인은 카카오 SDK가 아니라 **Supabase OAuth(웹)** 경로라, 카카오 콘솔의 iOS 번들 ID 등록이 필수인지는 구현에 달림. 리디렉트 URI는 Supabase 콜백 그대로일 가능성이 큼(카카오 콘솔은 리디렉트 URI 미등록 시 KOE006)¹⁰ → (가)(나) 모두 실기기 확인 1순위
4. 처리방침: (가)는 변화 없음(Apple은 수탁자가 아님 — TestFlight 배포만). (나)는 호스팅 업체가 새 수탁자가 될 수 있음

## 3. PE 권장

- **(가)를 본길로.** 이유:
  1. 실제 커플 다음 단계가 스토어 출시라, (나)는 나중에 (가)를 한 번 더 하게 됨
  2. 지금 코드(Capacitor · 78- 푸시 서버 · 76- 저장 · 앱 링크 로그인)를 거의 그대로 씀
  3. (나)의 최대 위험(standalone 카카오 로그인 복귀)은 우리가 고칠 수 없는 브라우저 동작이라 일정 예측이 안 됨
  4. Proteur 폰이 iPhone이라 TestFlight 내부 테스터로 바로 확인 가능 — 두 사람 모두 내부 테스터면 **베타 심사 없이** 설치
- **(나)는 대비책으로만**: Apple 가입 승인이 길어질 때. 그 경우에도 먼저 "standalone에서 카카오 로그인 복귀" 한 가지만 30분 실기기 시험으로 확인한 뒤 결정
- **지금 할 일(사람)**: Apple Developer 개인 가입 신청(Mac 없이 웹 · 연 99 USD) — 승인 대기를 Android 확인 기간과 겹치게. PM 권고(R109-6)와 같음

## 4. (가)로 갈 때 위임 윤곽 (참고 · 위임 0)

| 묶음 | 내용 | 사람 |
|---|---|---|
| i1 | `cap add ios` · Info.plist(URL 스킴 `ondolog` · 사진 · 카메라 · 알림 권한 문구) · 앱 링크 로그인 iOS 분기 · 안전 영역 CSS | — |
| i2 | 푸시 iOS: 플러그인 iOS 설정 · AppDelegate 2메서드 · `GoogleService-Info.plist`(커밋 0) | APNs .p8 키 만들기 · Firebase에 등록 |
| i3 | 클라우드 빌드 설정(Codemagic 등 — 새 외부 서비스 · PM 허가) · 자동 서명 · TestFlight 업로드 | App Store Connect 앱 등록 · API 키(보안 입력) |
| i4 | 51- 핵심 iOS 한 바퀴(로그인 · 채팅 스크롤 · 키보드 · 사진 HEIC/GPS · 오프라인 · 푸시 · 하늘 성능) | Proteur 폰 녹화 |

## 출처

1. [Apple Developer — Membership Details](https://developer-mdn.apple.com/programs/whats-included/) (99 USD per membership year)
2. [Codemagic Docs — Pricing](https://docs.codemagic.io/billing/pricing/) (개인 500분/월 macOS M2 무료 · 초과 분당 0.095 USD)
3. [WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/?p=13878) (iOS/iPadOS 16.4 · 홈 화면 앱만 · 사용자 상호작용 · Apple Developer 가입 불필요 · manifest standalone)
4. [App Store Connect Help — Overview of TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-testflight/) (내부 100 · 외부 10,000 · 첫 빌드 심사 · 90일)
5. [Apple Developer Forums — iOS 11.3 breaks OAuth flow in PWA](https://developer.apple.com/forums/thread/100407) · [PWA Freezing after OpenID authorizes user](https://developer.apple.com/forums/thread/649699) · [Netguru — Sharing state between standalone PWA and Safari on iOS](https://www.netguru.com/blog/how-to-share-session-cookie-or-state-between-pwa-in-standalone-mode-and-safari-on-ios) (오래된 보고 포함 — 최신 iOS에서 실기기 재확인 필요)
6. [Firebase Blog — FCM for Safari](https://firebase.blog/posts/2023/08/fcm-for-safari) (홈 화면 추가 필수 · 사용자 제스처 · VAPID 키)
7. [WebKit Bug 207088 — Uploading photos from iOS photo library strips EXIF](https://bugs.webkit.org/show_bug.cgi?id=207088) (iOS 16.4+ EXIF 유지 · GPS 제거 · HEIC→JPEG · iOS 17 위치 포함 선택지)
8. [WebKit — Updates to Storage Policy](https://webkit.org/?p=14403) (홈 화면 앱 할당량 · 퇴거 규칙 · 지속 모드)
9. [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (4.8 Login Services · 4.2 Minimum Functionality)
10. [Kakao Developers — 카카오 로그인 사전 설정](https://developers.kakao.com/docs/latest/ko/kakaologin/prerequisite) (리디렉트 URI 필수 · KOE006)
