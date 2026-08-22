# ONDOLOG 프로젝트 복구 스크립트 v2
# 프로젝트 루트(package.json이 있는 폴더)에서 실행:  .\repair.ps1

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "=== ONDOLOG 복구 시작 ===" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────
# 0. 위치 확인
# ─────────────────────────────────────────────
if (-not (Test-Path "app\index.tsx")) {
    Write-Host "app\index.tsx가 없습니다. 프로젝트 루트에서 실행하세요." -ForegroundColor Red
    exit 1
}
Write-Host ("위치 확인 OK: " + (Get-Location)) -ForegroundColor Green

# ─────────────────────────────────────────────
# 1. 깨진 파일 정리
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[1/8] 깨진 파일 정리" -ForegroundColor Yellow

if (Test-Path "supabase\.gitignore") {
    $c = Get-Content "supabase\.gitignore" -Raw
    if ($c -match "Set-Content") {
        Remove-Item "supabase\.gitignore" -Force
        Write-Host "  삭제: supabase\.gitignore (PowerShell 명령어 오염)" -ForegroundColor DarkGray
    }
}

Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  삭제: package-lock.json, node_modules" -ForegroundColor DarkGray

# app 폴더 안에 잘못 들어간 스크립트 정리
Remove-Item "app\repair.ps1" -Force -ErrorAction SilentlyContinue

# ─────────────────────────────────────────────
# 2. .gitignore
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[2/8] .gitignore 재작성" -ForegroundColor Yellow

$gitignore = @'
# dependencies
node_modules/

# expo
.expo/
dist/
web-build/
expo-env.d.ts

# native
ios/
android/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# env - never commit
.env
.env.*
!.env.example

# metro
.metro-health-check*

# debug
npm-debug.*
yarn-debug.*
yarn-error.*

# os
.DS_Store
Thumbs.db

# supabase local state
supabase/.temp/
supabase/.branches/

# local scratch
.claude/state/SCRATCH.md
'@
Set-Content -Path ".gitignore" -Value $gitignore -Encoding utf8
Write-Host "  OK" -ForegroundColor Green

# ─────────────────────────────────────────────
# 3. package.json
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[3/8] package.json 재구성" -ForegroundColor Yellow

$pkg = @'
{
  "name": "ondolog",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest --watchAll"
  },
  "jest": {
    "preset": "jest-expo"
  },
  "dependencies": {},
  "devDependencies": {}
}
'@
Set-Content -Path "package.json" -Value $pkg -Encoding utf8

try {
    Get-Content "package.json" -Raw | ConvertFrom-Json | Out-Null
    Write-Host "  OK (JSON 유효성 통과)" -ForegroundColor Green
} catch {
    Write-Host "  JSON 파싱 실패" -ForegroundColor Red
    exit 1
}

# ─────────────────────────────────────────────
# 4. app.json
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[4/8] app.json 재작성" -ForegroundColor Yellow

$appjson = @'
{
  "expo": {
    "name": "ondolog",
    "slug": "ondolog",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "ondolog",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.ondolog.app"
    },
    "android": {
      "package": "com.ondolog.app",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
'@
Set-Content -Path "app.json" -Value $appjson -Encoding utf8

try {
    Get-Content "app.json" -Raw | ConvertFrom-Json | Out-Null
    Write-Host "  OK (JSON 유효성 통과)" -ForegroundColor Green
} catch {
    Write-Host "  JSON 파싱 실패" -ForegroundColor Red
    exit 1
}

# ─────────────────────────────────────────────
# 5. tsconfig.json
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[5/8] tsconfig.json 재작성" -ForegroundColor Yellow

$tsconfig = @'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
'@
Set-Content -Path "tsconfig.json" -Value $tsconfig -Encoding utf8

try {
    Get-Content "tsconfig.json" -Raw | ConvertFrom-Json | Out-Null
    Write-Host "  OK" -ForegroundColor Green
} catch {
    Write-Host "  JSON 파싱 실패" -ForegroundColor Red
    exit 1
}

# ─────────────────────────────────────────────
# 6. app/_layout.tsx
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[6/8] app/_layout.tsx 생성" -ForegroundColor Yellow

$layout = @'
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
'@
Set-Content -Path "app\_layout.tsx" -Value $layout -Encoding utf8
Write-Host "  OK" -ForegroundColor Green

# ─────────────────────────────────────────────
# 7. 디렉토리 구조
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[7/8] 디렉토리 구조" -ForegroundColor Yellow

$dirs = @(
    "src\engine", "src\engine\corners", "src\types", "src\types\corners",
    "src\data", "src\services", "src\services\llm", "src\services\map",
    "src\hooks", "src\utils", "src\constants", "src\lib", "src\store",
    "supabase\migrations", "supabase\functions",
    "__tests__\engine", "docs"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
    $existing = Get-ChildItem $d -Force -File -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-Item -ItemType File -Path (Join-Path $d ".gitkeep") -Force | Out-Null
    }
}
Write-Host ("  OK (" + $dirs.Count + "개)") -ForegroundColor Green

# ─────────────────────────────────────────────
# 8. .env 확인
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "[8/8] .env 확인" -ForegroundColor Yellow

if (Test-Path ".env") {
    $envc = Get-Content ".env" -Raw
    $hasUrl = $envc -match "EXPO_PUBLIC_SUPABASE_URL"
    $hasKey = $envc -match "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    if ($hasUrl -and $hasKey) {
        Write-Host "  OK (URL + ANON_KEY 존재)" -ForegroundColor Green
    } else {
        Write-Host "  경고: .env에 필요한 키가 없습니다" -ForegroundColor Yellow
    }
    if ($envc -match "service_role") {
        Write-Host "  !!! .env에 service_role이 있습니다. 즉시 제거하세요 !!!" -ForegroundColor Red
    }
} else {
    Write-Host "  .env 없음 - 아래 형식으로 생성 필요:" -ForegroundColor Yellow
    Write-Host "    EXPO_PUBLIC_SUPABASE_URL=https://REF.supabase.co" -ForegroundColor DarkGray
    Write-Host "    EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ..." -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────
Write-Host ""
Write-Host "=== 파일 복구 완료 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 명령을 순서대로 실행하세요:" -ForegroundColor White
Write-Host ""
Write-Host "  npm install expo@57 --legacy-peer-deps" -ForegroundColor Cyan
Write-Host "  npx expo install expo-router react react-dom react-native react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar" -ForegroundColor Cyan
Write-Host "  npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill" -ForegroundColor Cyan
Write-Host "  npm install zustand zod --legacy-peer-deps" -ForegroundColor Cyan
Write-Host "  npx expo install react-native-reanimated react-native-gesture-handler" -ForegroundColor Cyan
Write-Host "  npm install -D supabase jest jest-expo @types/jest @testing-library/react-native --legacy-peer-deps" -ForegroundColor Cyan
Write-Host "  npx expo install --check" -ForegroundColor Cyan
Write-Host "  npx expo start --clear" -ForegroundColor Cyan
Write-Host ""
