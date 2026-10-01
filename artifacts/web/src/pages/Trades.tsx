import { Search, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppShell, EmptyState, PageHeading } from "../components/AppShell";
import { useTrades } from "../context/TradesContext";
import { calcTradeResult } from "../domain/trades";
import { formatKRW, formatKRWSign, tickerColor } from "../lib/format";

export default function Trades() {
  const { trades, accounts, loading } = useTrades();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [account, setAccount] = useState("all");
  const filtered = useMemo(() => trades.filter((trade) => {
    const result = calcTradeResult(trade);
    const search = `${trade.name} ${trade.ticker}`.toLowerCase().includes(query.trim().toLowerCase());
    return search && (state === "all" || (state === "open" ? result.isOpen : !result.isOpen))
      && (account === "all" || trade.accountId === account);
  }).sort((a,b) => b.createdAt - a.createdAt), [trades, query, state, account]);
  return <AppShell current="/trades"><div className="page-wrap">
    <PageHeading eyebrow="TRADE JOURNAL" title="매매 기록" subtitle="종목과 계좌를 찾아보고, 각 포지션의 흐름을 살펴보세요." />
    <section className="panel table-panel">
      <div className="table-tools">
        <label className="search-field"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명 또는 종목코드 검색" aria-label="종목명 또는 종목코드 검색" data-testid="input-trade-search"/></label>
        <div className="filters"><span style={{color:"#737988"}}><SlidersHorizontal size={14}/></span>
          <select className="filter-select" value={state} onChange={(event) => setState(event.target.value)} aria-label="포지션 상태 필터" data-testid="select-trade-state">
            <option value="all">전체 상태</option><option value="open">보유 중</option><option value="closed">종료</option>
          </select>
          <select className="filter-select" value={account} onChange={(event) => setAccount(event.target.value)} aria-label="계좌 필터" data-testid="select-trade-account">
            <option value="all">모든 계좌</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>
      {loading ? <div style={{padding:18,display:"grid",gap:8}}>{[1,2,3,4].map((i)=><div className="skeleton" key={i} style={{height:53}}/>)}</div>
      : filtered.length ? <div className="table-scroll"><table>
        <thead><tr><th>종목 / 포지션</th><th>기록 시작</th><th>계좌</th><th>매수 / 매도</th><th>보유 수량</th><th>실현 손익</th><th>상태</th><th></th></tr></thead>
        <tbody>{filtered.map((trade) => {
          const result = calcTradeResult(trade);
          const accountName = accounts.find((item) => item.id === trade.accountId)?.name ?? "계좌 미지정";
          return <tr key={trade.id} data-testid={`row-trade-${trade.id}`}>
            <td><Link href={`/trade/${trade.id}`} className="stock-cell"><div className="ticker-mark" style={{color:tickerColor(trade.ticker)}}>{trade.ticker.slice(0,4)}</div><div><div className="stock-name">{trade.name}</div><div className="stock-ticker">{trade.ticker}</div></div></Link></td>
            <td className="mono">{trade.date}</td><td>{accountName}</td><td>{trade.entries.length} / {trade.exits.length}</td>
            <td className="mono">{result.remainingQty ? `${result.remainingQty.toLocaleString("ko-KR")}주` : "—"}</td>
            <td className={`mono ${result.realizedPnL > 0 ? "positive" : result.realizedPnL < 0 ? "negative" : ""}`}>{result.totalSold ? `${formatKRWSign(result.realizedPnL)}원` : "—"}</td>
            <td><span className={`status-tag ${result.isOpen ? "" : "closed"}`}>{result.isOpen ? "보유 중" : "종료"}</span></td>
            <td><Link className="icon-button" href={`/trade/${trade.id}`} aria-label={`${trade.name} 상세 보기`} data-testid={`link-trade-${trade.id}`}><ArrowUpRight size={15}/></Link></td>
          </tr>;
        })}</tbody>
      </table></div>
      : <EmptyState title={trades.length ? "조건에 맞는 기록이 없어요" : "아직 매매 기록이 없습니다"} copy={trades.length ? "검색어를 바꾸거나 필터를 초기화해보세요." : "매수와 매도 내역을 차근차근 기록해보세요."} action={trades.length ? <button className="button" onClick={() => {setQuery("");setState("all");setAccount("all");}} data-testid="button-reset-filters">필터 초기화</button> : <Link href="/record" className="button primary" data-testid="link-start-journal">매매 기록하기</Link>} />}
    </section>
    <div className="section-caption" style={{marginTop:12,textAlign:"right"}}>{filtered.length} / {trades.length} 포지션 · 금액은 원화 기준</div>
  </div></AppShell>;
}