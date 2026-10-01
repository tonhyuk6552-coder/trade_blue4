import { ArrowRight, Plus } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import { AppShell, EmptyState, PageHeading } from "../components/AppShell";
import { useTrades } from "../context/TradesContext";
import { calcTradeResult } from "../domain/trades";
import { formatKRW, formatKRWSign, formatPct, tickerColor } from "../lib/format";

export default function Dashboard() {
  const { trades, accounts, loading } = useTrades();
  const results = useMemo(() => trades.map((trade) => ({ trade, result: calcTradeResult(trade) })), [trades]);
  const realized = results.reduce((sum, item) => sum + item.result.realizedPnL, 0);
  const closed = results.filter((item) => !item.result.isOpen && item.result.totalSold > 0);
  const wins = closed.filter((item) => item.result.realizedPnL > 0).length;
  const winRate = closed.length ? wins / closed.length * 100 : 0;
  const openCount = results.filter((item) => item.result.isOpen).length;
  const recent = [...trades].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const curve = useMemo(() => {
    const exits = trades.flatMap((trade) => {
      const result = calcTradeResult(trade);
      const lookup = new Map(result.exitResults.map((event) => [event.exitId, event.realizedPnL]));
      return trade.exits.map((exit) => ({ date: exit.date, value: lookup.get(exit.id) ?? 0 }));
    }).sort((a, b) => a.date.localeCompare(b.date));
    let total = 0;
    return exits.map((event) => { total += event.value; return total; });
  }, [trades]);
  const line = curve.length > 1 ? curve : curve.length === 1 ? [0, curve[0]] : [];
  const low = Math.min(0, ...line);
  const high = Math.max(0, ...line);
  const span = high - low || 1;
  const chartPoints = line.map((value, index) => `${(index / (line.length - 1)) * 100},${88 - ((value - low) / span) * 76}`).join(" ");
  return <AppShell current="/">
    <div className="page-wrap">
      <PageHeading eyebrow="PORTFOLIO OVERVIEW" title="나의 매매 기록" subtitle="결정의 순간을 남기고, 결과에서 다음 힌트를 찾습니다." action={<Link href="/record" className="button primary" data-testid="link-create-trade"><Plus size={15} /> 새 기록</Link>} />
      {loading ? <div className="stat-grid">{[0,1,2,3].map((i) => <div key={i} className="panel stat-card skeleton loading-block" />)}</div> : <>
        <div className="stat-grid">
          <article className="panel stat-card"><div className="stat-label">누적 실현 손익</div><div className={`stat-value ${realized >= 0 ? "positive" : "negative"}`} data-testid="text-dashboard-realized">{formatKRWSign(realized)}<span style={{fontSize:13,marginLeft:4}}>원</span></div><div className="stat-foot">매도 완료 및 일부 매도 기준</div></article>
          <article className="panel stat-card"><div className="stat-label">기록한 포지션</div><div className="stat-value">{trades.length}<span style={{fontSize:13,marginLeft:6,color:"var(--muted)"}}>건</span></div><div className="stat-foot">계좌 {accounts.length}개에 기록</div></article>
          <article className="panel stat-card"><div className="stat-label">보유 중</div><div className="stat-value">{openCount}<span style={{fontSize:13,marginLeft:6,color:"var(--muted)"}}>종목</span></div><div className="stat-foot">남은 수량이 있는 포지션</div></article>
          <article className="panel stat-card"><div className="stat-label">승률</div><div className="stat-value">{closed.length ? `${winRate.toFixed(1)}%` : "—"}</div><div className="stat-foot">종료 포지션 중 수익 기록</div></article>
        </div>
        <div className="dashboard-grid">
          <section className="panel panel-pad">
            <div className="section-title"><div><h2>실현 손익 흐름</h2><div className="section-caption">매도 기록을 기준으로 누적 계산</div></div><span className={`performance-total ${realized >= 0 ? "positive" : "negative"}`}>{formatKRWSign(realized)} 원</span></div>
            <div className="chart-wrap">
              {line.length ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="누적 실현 손익 흐름">
                <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6699ff" stopOpacity=".2" /><stop offset="1" stopColor="#6699ff" stopOpacity="0" /></linearGradient></defs>
                {[15,38,61,84].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid" />)}
                <polygon points={`0,90 ${chartPoints} 100,90`} className="chart-area" /><polyline points={chartPoints} className="chart-line" />
              </svg> : <div className="chart-empty">매도 기록이 생기면 손익의 흐름을 볼 수 있어요.</div>}
            </div>
            <div className="chart-labels"><span>{trades.length ? "첫 매도" : "기록 전"}</span><span>누적 실현 기준</span><span>최근</span></div>
          </section>
          <section className="panel panel-pad">
            <div className="section-title"><div><h2>최근 기록</h2><div className="section-caption">최근에 돌아본 포지션</div></div><Link href="/trades" className="button quiet small" data-testid="link-all-trades">전체 보기 <ArrowRight size={13}/></Link></div>
            {recent.length ? <div className="activity-list">{recent.map((trade) => {
              const result = calcTradeResult(trade);
              return <Link href={`/trade/${trade.id}`} className="activity-row" key={trade.id} data-testid={`row-recent-trade-${trade.id}`}>
                <div className="ticker-mark" style={{color:tickerColor(trade.ticker)}}>{trade.ticker.slice(0,4)}</div>
                <div><div className="activity-name">{trade.name}</div><div className="activity-meta">{trade.date} · {result.isOpen ? "보유 중" : "종료"}</div></div>
                <div className={`activity-value ${result.realizedPnL >= 0 ? "positive" : "negative"}`}>{result.totalSold ? formatKRWSign(result.realizedPnL) : "—"}<small>실현 손익</small></div>
              </Link>;
            })}</div> : <EmptyState title="첫 매매를 기록해보세요" copy="매수와 매도의 이유를 남기면, 나만의 투자 패턴이 보이기 시작합니다." action={<Link href="/record" className="button primary" data-testid="link-empty-record">첫 기록 남기기</Link>} />}
          </section>
        </div>
        <section className="panel panel-pad" style={{marginTop:14}}>
          <div className="section-title"><div><h2>보유 포지션</h2><div className="section-caption">실시간 시세를 제공하지 않는 포지션은 손익을 추정하지 않습니다.</div></div><Link href="/trades" className="button quiet small" data-testid="link-position-list">기록 전체 보기 <ArrowRight size={13}/></Link></div>
          {openCount ? <div className="activity-list">{results.filter((item) => item.result.isOpen).slice(0,5).map(({trade,result}) => <Link key={trade.id} href={`/trade/${trade.id}`} className="activity-row" data-testid={`row-open-trade-${trade.id}`}>
            <div className="ticker-mark" style={{color:tickerColor(trade.ticker)}}>{trade.ticker.slice(0,4)}</div><div><div className="activity-name">{trade.name}</div><div className="activity-meta">{result.remainingQty.toLocaleString("ko-KR")}주 보유 · 평단 {formatKRW(result.avgBuy)}원</div></div><div className="activity-value">{trade.entries.length}회 매수<small>{trade.exits.length}회 매도</small></div>
          </Link>)}</div> : <div className="section-caption" style={{padding:"12px 0"}}>현재 보유 중인 포지션이 없습니다.</div>}
        </section>
      </>}
    </div>
  </AppShell>;
}