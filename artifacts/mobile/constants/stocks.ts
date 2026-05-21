export interface Stock {
  name: string;
  ticker: string;
  market: "KR" | "US";
}

export const STOCKS: Stock[] = [
  { name: "삼성전자", ticker: "005930.KS", market: "KR" },
  { name: "SK하이닉스", ticker: "000660.KS", market: "KR" },
  { name: "LG에너지솔루션", ticker: "373220.KS", market: "KR" },
  { name: "삼성바이오로직스", ticker: "207940.KS", market: "KR" },
  { name: "현대차", ticker: "005380.KS", market: "KR" },
  { name: "기아", ticker: "000270.KS", market: "KR" },
  { name: "POSCO홀딩스", ticker: "005490.KS", market: "KR" },
  { name: "셀트리온", ticker: "068270.KS", market: "KR" },
  { name: "NAVER", ticker: "035420.KS", market: "KR" },
  { name: "카카오", ticker: "035720.KS", market: "KR" },
  { name: "삼성SDI", ticker: "006400.KS", market: "KR" },
  { name: "LG화학", ticker: "051910.KS", market: "KR" },
  { name: "현대모비스", ticker: "012330.KS", market: "KR" },
  { name: "KB금융", ticker: "105560.KS", market: "KR" },
  { name: "신한지주", ticker: "055550.KS", market: "KR" },
  { name: "하나금융지주", ticker: "086790.KS", market: "KR" },
  { name: "우리금융지주", ticker: "316140.KS", market: "KR" },
  { name: "카카오뱅크", ticker: "323410.KS", market: "KR" },
  { name: "카카오페이", ticker: "377300.KS", market: "KR" },
  { name: "삼성물산", ticker: "028260.KS", market: "KR" },
  { name: "LG전자", ticker: "066570.KS", market: "KR" },
  { name: "삼성전기", ticker: "009150.KS", market: "KR" },
  { name: "두산에너빌리티", ticker: "034020.KS", market: "KR" },
  { name: "한국전력", ticker: "015760.KS", market: "KR" },
  { name: "KT&G", ticker: "033780.KS", market: "KR" },
  { name: "에코프로비엠", ticker: "247540.KQ", market: "KR" },
  { name: "에코프로", ticker: "086520.KQ", market: "KR" },
  { name: "HPSP", ticker: "403870.KQ", market: "KR" },
  { name: "HLB", ticker: "028300.KQ", market: "KR" },
  { name: "알테오젠", ticker: "196170.KQ", market: "KR" },
  { name: "리가켐바이오", ticker: "141080.KQ", market: "KR" },
  { name: "레인보우로보틱스", ticker: "277810.KQ", market: "KR" },
  { name: "이오테크닉스", ticker: "039030.KQ", market: "KR" },
  { name: "솔브레인", ticker: "357780.KQ", market: "KR" },
  { name: "엔씨소프트", ticker: "036570.KS", market: "KR" },
  { name: "크래프톤", ticker: "259960.KS", market: "KR" },
  { name: "넷마블", ticker: "251270.KS", market: "KR" },
  { name: "HD현대중공업", ticker: "329180.KS", market: "KR" },
  { name: "한화에어로스페이스", ticker: "012450.KS", market: "KR" },
  { name: "LIG넥스원", ticker: "079550.KS", market: "KR" },
  { name: "엔비디아", ticker: "NVDA", market: "US" },
  { name: "테슬라", ticker: "TSLA", market: "US" },
  { name: "애플", ticker: "AAPL", market: "US" },
  { name: "마이크로소프트", ticker: "MSFT", market: "US" },
  { name: "아마존", ticker: "AMZN", market: "US" },
  { name: "구글", ticker: "GOOGL", market: "US" },
  { name: "메타", ticker: "META", market: "US" },
  { name: "넷플릭스", ticker: "NFLX", market: "US" },
  { name: "AMD", ticker: "AMD", market: "US" },
  { name: "팔란티어", ticker: "PLTR", market: "US" },
  { name: "코인베이스", ticker: "COIN", market: "US" },
  { name: "브로드컴", ticker: "AVGO", market: "US" },
  { name: "TSMC", ticker: "TSM", market: "US" },
  { name: "마이크론", ticker: "MU", market: "US" },
  { name: "어플라이드 머티어리얼즈", ticker: "AMAT", market: "US" },
  { name: "슈퍼마이크로", ticker: "SMCI", market: "US" },
  { name: "아스트라제네카", ticker: "AZN", market: "US" },
  { name: "일라이 릴리", ticker: "LLY", market: "US" },
  { name: "모더나", ticker: "MRNA", market: "US" },
  { name: "리비안", ticker: "RIVN", market: "US" },
  { name: "루시드", ticker: "LCID", market: "US" },
  { name: "SOXL", ticker: "SOXL", market: "US" },
  { name: "TQQQ", ticker: "TQQQ", market: "US" },
  { name: "SQQQ", ticker: "SQQQ", market: "US" },
  { name: "QQQ", ticker: "QQQ", market: "US" },
  { name: "SPY", ticker: "SPY", market: "US" },
];

export function searchStocks(query: string): Stock[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().replace(/\s/g, "");
  return STOCKS.filter(
    (s) =>
      s.name.toLowerCase().replace(/\s/g, "").includes(q) ||
      s.ticker.toLowerCase().replace(".", "").includes(q)
  ).slice(0, 8);
}

export function findStockByTicker(ticker: string): Stock | undefined {
  return STOCKS.find((s) => s.ticker === ticker);
}
