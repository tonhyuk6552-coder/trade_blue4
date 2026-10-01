# 매매일지

한국 주식과 해외 주식의 매매 기록, 손익, 계좌를 관리하는 반응형 웹 서비스.

## 실행 및 관리

- `Start application` 워크플로우 — React/Vite 웹 앱 (port 5000, 미리보기)
- `API Server` 워크플로우 — Express API 서버 (port 8000)
- `pnpm --filter @workspace/web run dev` — 웹 앱 수동 실행
- `pnpm --filter @workspace/api-server run dev` — API 서버 수동 실행
- `pnpm run typecheck` — 전체 타입 체크
- `pnpm --filter @workspace/db run push` — 개발 DB 스키마 적용

## 기술 구성

- pnpm workspaces, Node.js 20, TypeScript 5.9
- 웹: React 19, Vite, Wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- 빌드: Vite (웹), esbuild (API)

## 주요 경로

- `artifacts/web/` — 데스크톱·모바일 브라우저용 웹 앱
  - `src/pages/` — 대시보드, 거래, 기록, 캘린더, 설정 화면
  - `src/context/TradesContext.tsx` — 거래·계좌 상태, 저장, 클라우드 동기화
  - `src/domain/trades.ts` — 거래 자료형과 손익 계산
  - `src/data/stocks.ts` — 국내·해외 종목 검색 데이터
- `artifacts/api-server/` — Express API 서버
  - `src/routes/sync.ts` — 코드 기반 클라우드 동기화
  - `src/routes/price.ts` — Google Finance/Yahoo Finance 현재가 조회
- `lib/db/` — Drizzle ORM 스키마와 설정

## 데이터 및 API

- 거래와 계좌는 AsyncStorage 웹 구현과 호환되는 동일한 localStorage 키에 저장되어 기존 브라우저 기록을 유지한다.
- 코드 기반 동기화는 8자리 코드(XXXX-XXXX)를 사용한다.
- 개발 중 Vite의 `/api` 프록시가 8000번 API 서버로 요청을 전달한다.
- 가격 조회는 기존 API 서버의 Google Finance → Yahoo Finance 순서를 사용한다.

## 제품 기능

- 매수·매도 입력, 수정, 삭제와 손익 자동 계산
- 계좌별 거래 관리 및 계좌별 손익 집계
- 현재가와 미실현 손익 표시
- 월별 거래 캘린더와 거래 상세의 손익 흐름
- 코드 기반 브라우저 간 동기화
- JSON 백업·복원, Excel 양식 다운로드·가져오기

## 사용자 선호

- 한국어 UI
- 다크 테마 (배경 #0C0D10)

## 실행 정보

- API 서버 포트: 8000 (console workflow), 웹 앱 포트: 5000 (webview)
- API 서버 변경 시 빌드와 타입 검사를 다시 실행한다.

## 코드 위치

- 손익 계산: `artifacts/web/src/domain/trades.ts` (`calcTradeResult`)
- 저장·동기화·기록: `artifacts/web/src/context/TradesContext.tsx`
- 파일 백업 및 Excel 처리: `artifacts/web/src/lib/file-transfer.ts`
