# 매매일지

한국 주식/해외 주식 매매 기록 및 분석 앱 (Expo React Native + Express API)

## Run & Operate

- `Start application` 워크플로우 — Expo 웹 앱 (port 5000, 미리보기)
- `API Server` 워크플로우 — Express API 서버 (port 8000)
- `pnpm --filter @workspace/api-server run dev` — API 서버 수동 실행
- `pnpm run typecheck` — 전체 타입 체크
- `pnpm --filter @workspace/db run push` — DB 스키마 변경 적용 (dev)
- Required env: `DATABASE_URL` — PostgreSQL 연결 문자열 (자동 설정됨)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Mobile/Web: Expo SDK 54 + React Native 0.81 + Expo Router 6
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- 차트: lightweight-charts (Yahoo Finance 데이터)
- 빌드: esbuild (API), Metro (모바일)

## Where things live

- `artifacts/mobile/` — Expo 앱 (React Native/Web)
  - `app/(tabs)/` — 탭 화면들 (대시보드, 거래내역, 캘린더, 차트, 기록, 설정)
  - `app/trade/[id].tsx` — 거래 상세 화면
  - `context/TradesContext.tsx` — 전역 상태 (거래, 계좌, 동기화)
  - `constants/stocks.ts` — 국내/해외 종목 검색 데이터
- `artifacts/api-server/` — Express API 서버
  - `src/routes/sync.ts` — 기기 간 동기화 API
  - `src/routes/price.ts` — 실시간 주가 API (Google/Yahoo Finance)
  - `src/routes/chart.ts` — 차트 데이터 API (Yahoo Finance)
- `lib/db/` — Drizzle ORM 스키마 + 설정
  - `src/schema/index.ts` — sync_data 테이블

## Architecture decisions

- 데이터는 AsyncStorage에 로컬 저장, 선택적 클라우드 동기화
- 동기화는 8자리 코드 기반 (XXXX-XXXX 형식)
- 주가 조회: Google Finance → Yahoo Finance 폴백 순서
- 차트는 lightweight-charts를 WebView에 임베드 (네이티브/웹 공통)
- Expo web에서 window.location.origin을 API base URL로 자동 감지

## Product

- 매수/매도 거래 기록 및 손익 자동 계산
- 계좌별 포지션 관리 및 P&L 집계
- 실시간 현재가 조회 및 미실현 손익 표시
- 캘린더 기반 거래 일지 뷰
- 캔들스틱 차트 (매수/매도 마커 오버레이)
- 기기 간 데이터 동기화 (코드 기반)
- JSON 백업/복원, Excel 가져오기/내보내기

## User preferences

- 한국어 UI
- 다크 테마 (배경 #0C0D10)

## Gotchas

- API 서버 포트: 8000 (console workflow), 앱 포트: 5000 (webview)
- EXPO_PUBLIC_DOMAIN은 앱 dev 스크립트에서 $REPLIT_DEV_DOMAIN으로 자동 설정
- API 서버 변경 시 `pnpm run build` 필요 (esbuild 번들링)
- pnpm v9 필요 (v10은 Node 20과 sqlite 호환성 문제)

## Pointers

- 종목 데이터: `artifacts/mobile/constants/stocks.ts`
- 색상 테마: `artifacts/mobile/constants/colors.ts`
- 손익 계산 로직: `artifacts/mobile/context/TradesContext.tsx` (calcTradeResult)
