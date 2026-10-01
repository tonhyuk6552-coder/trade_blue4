import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Pencil, Save, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { AppShell, EmptyState, Modal, PageHeading } from "../components/AppShell";
import { TradeChart } from "../components/TradeChart";
import { useTrades } from "../context/TradesContext";
import { STRATEGY_TAGS, calcTradeResult, parseTradeDate } from "../domain/trades";
import type { StrategyTag } from "../domain/trades";
import { formatKRW, formatKRWSign, formatPct, tickerColor } from "../lib/format";
import { useStockPrice } from "../hooks/useStockPrice";
import { useToast } from "../components/Toast";

type EditState = { kind:"buy"|"sell"; id:string; price:string; quantity:string; date:string } | null;
export default function TradeDetail() {
  const params=useParams<{id:string}>();
  const id=params.id;
  const [,setLocation]=useLocation();
  const {trades,accounts,updateEntry,updateExit,deleteTrade,deleteEntry,deleteExit,updateNotes,updateTags}=useTrades();
  const trade=trades.find((item)=>item.id===id);
  const result=trade?calcTradeResult(trade):null;
  const priceQuery=useStockPrice(trade?.ticker);
  const toast=useToast();
  const [notes,setNotes]=useState(trade?.notes??"");
  const [edit,setEdit]=useState<EditState>(null);
  const [confirm,setConfirm]=useState<"trade"|"entry"|"exit"|null>(null);
  const [selectedId,setSelectedId]=useState("");
  useEffect(()=>{setNotes(trade?.notes??"");},[trade?.id,trade?.notes]);
  const accountName=accounts.find((item)=>item.id===trade?.accountId)?.name??"계좌 미지정";
  const currentPrice=priceQuery.data?.price;
  const unrealized=currentPrice!==undefined&&result?(currentPrice-result.avgBuy)*result.remainingQty:null;
  const histories=useMemo(()=>trade?[
    ...trade.entries.map((entry)=>({kind:"buy" as const,id:entry.id,date:new Date(entry.timestamp).toISOString().slice(0,10),timestamp:entry.timestamp,price:entry.price,quantity:entry.quantity})),
    ...trade.exits.map((exit)=>({kind:"sell" as const,id:exit.id,date:exit.date,timestamp:exit.timestamp,price:exit.price,quantity:exit.quantity})),
  ].sort((a,b)=>a.date.localeCompare(b.date)||a.timestamp-b.timestamp):[],[trade]);
  const realizedByExit=new Map((result?.exitResults??[]).map((event)=>[event.exitId,event.realizedPnL]));
  if(!trade||!result)return <AppShell current="/trades"><div className="page-wrap"><PageHeading eyebrow="POSITION" title="기록을 찾을 수 없습니다" subtitle="이미 삭제되었거나 주소가 올바르지 않은 것 같아요."/><EmptyState title="이 포지션은 존재하지 않습니다" copy="매매 기록 목록에서 다른 포지션을 선택해보세요." action={<Link href="/trades" className="button" data-testid="link-back-trades"><ArrowLeft size={14}/>기록 목록으로</Link>}/></div></AppShell>;
  const openEdit=(item:typeof histories[number])=>setEdit({kind:item.kind,id:item.id,price:String(item.price),quantity:String(item.quantity),date:item.date});
  const saveEdit=()=>{
    if(!edit)return;
    const price=Number(edit.price),quantity=Number(edit.quantity);
    if(!(price>0)||!(quantity>0)){toast("가격과 수량은 0보다 커야 합니다.");return;}
    const date=parseTradeDate(edit.date);
    if(!date){toast("날짜를 YYYY-MM-DD, M-D 또는 MMDD 형식으로 입력해주세요.");return;}
    if(edit.kind==="buy")updateEntry(trade.id,edit.id,price,quantity,Date.parse(`${date}T00:00:00.000Z`));
    else updateExit(trade.id,edit.id,price,quantity,date);
    setEdit(null);toast("거래 내역을 수정했습니다.");
  };
  const deleteSelected=()=>{
    if(confirm==="trade"){deleteTrade(trade.id);setLocation("/trades");toast("포지션을 삭제했습니다.");}
    else if(confirm==="entry"){deleteEntry(trade.id,selectedId);toast("매수 내역을 삭제했습니다.");}
    else if(confirm==="exit"){deleteExit(trade.id,selectedId);toast("매도 내역을 삭제했습니다.");}
    setConfirm(null);
  };
  const toggleTag=(tag:StrategyTag)=>updateTags(trade.id,trade.tags.includes(tag)?trade.tags.filter((item)=>item!==tag):[...trade.tags,tag]);
  const quoteCurrency=priceQuery.data?.currency||"KRW";
  const priceDisplay=(value:number)=>`${value.toLocaleString("ko-KR",{maximumFractionDigits:2})} ${quoteCurrency==="KRW"?"원":quoteCurrency}`;
  return <AppShell current="/trades"><div className="page-wrap">
    <div style={{marginBottom:20}}><Link href="/trades" className="button quiet small" data-testid="link-detail-back"><ArrowLeft size={14}/>모든 기록</Link></div>
    <div className="detail-top">
      <div className="detail-title"><div className="ticker-mark" style={{color:tickerColor(trade.ticker)}}>{trade.ticker.slice(0,4)}</div><div><div className="detail-name" data-testid="text-trade-name">{trade.name}</div><div className="detail-symbol">{trade.ticker} · {accountName} · 시작 {trade.date}</div></div></div>
      <div className="detail-actions"><Link href="/record" className="button small" data-testid="link-add-trade-entry">거래 추가</Link><button className="button danger small" onClick={()=>setConfirm("trade")} data-testid="button-delete-trade"><Trash2 size={13}/>포지션 삭제</button></div>
    </div>
    <div className="detail-stat-grid">
      <div className="panel detail-stat"><div className="stat-label">실현 손익</div><div className={`stat-value ${result.realizedPnL>0?"positive":result.realizedPnL<0?"negative":""}`} data-testid="text-trade-realized">{formatKRWSign(result.realizedPnL)}<span style={{fontSize:11}}>원</span></div></div>
      <div className="panel detail-stat"><div className="stat-label">실현 수익률</div><div className={`stat-value ${result.roi>0?"positive":result.roi<0?"negative":""}`}>{formatPct(result.roi)}</div></div>
      <div className="panel detail-stat"><div className="stat-label">남은 보유 수량</div><div className="stat-value">{result.remainingQty.toLocaleString("ko-KR")}<span style={{fontSize:11,color:"#848a98"}}>주</span></div></div>
      <div className="panel detail-stat"><div className="stat-label">평균 매입가</div><div className="stat-value">{formatKRW(result.avgBuy)}<span style={{fontSize:11,color:"#848a98"}}>원</span></div></div>
    </div>
    <div className="detail-columns">
      <div style={{display:"grid",gap:14}}>
        <section className="panel panel-pad">
          <div className="section-title"><div><h2>실현 손익 흐름</h2><div className="section-caption">매도 시점까지 누적된 실제 손익</div></div>{priceQuery.isFetching&&<span className="section-caption">시세 갱신 중</span>}</div>
          <TradeChart trade={trade}/>
          <div className="chart-labels"><span>첫 매도</span><span>누적 손익</span><span>최근</span></div>
          <div className="rule"/>
          <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap"}}>
            <span className="price-inline"><span className="legend-dot" style={{background:"#6699ff"}}/>평균 매입 <strong>{formatKRW(result.avgBuy)}원</strong></span>
            <span className="price-inline">평균 매도 <strong>{formatKRW(result.avgSell)}원</strong></span>
            {currentPrice!==undefined&&<span className="price-inline">현재 시세 <strong>{priceDisplay(currentPrice)}</strong></span>}
          </div>
          {unrealized!==null&&result.remainingQty>0&&<div className={`section-caption ${unrealized>=0?"positive":"negative"}`} style={{marginTop:9}} data-testid="text-unrealized-pnl">미실현 손익 추정 {formatKRWSign(unrealized)} {quoteCurrency==="KRW"?"원":quoteCurrency} · 실시간 시세 기반</div>}
          {priceQuery.isError&&<div className="section-caption" style={{marginTop:9}}>현재 시세를 불러오지 못했습니다. 거래 손익 계산에는 영향을 주지 않습니다.</div>}
        </section>
        <section className="panel panel-pad">
          <div className="section-title"><div><h2>매수 · 매도 내역</h2><div className="section-caption">{trade.entries.length}회 매수 · {trade.exits.length}회 매도</div></div></div>
          {histories.length?<div>{histories.map((item)=><div className="history-row" key={`${item.kind}-${item.id}`} data-testid={`row-history-${item.id}`}>
            <div className={`history-type ${item.kind==="sell"?"sell":""}`}>{item.kind==="buy"?"매수":"매도"}</div>
            <div><div className="mono">{item.date}</div><div className="section-caption">{item.quantity.toLocaleString("ko-KR")}주</div></div>
            <div><div className="mono">{item.price.toLocaleString("ko-KR")}원</div>{item.kind==="sell"&&<div className={`section-caption ${(realizedByExit.get(item.id)??0)>=0?"positive":"negative"}`}>실현 {formatKRWSign(realizedByExit.get(item.id)??0)}</div>}</div>
            <div className="row-action" style={{display:"flex",gap:2}}><button className="icon-button" aria-label="거래 내역 수정" onClick={()=>openEdit(item)} data-testid={`button-edit-history-${item.id}`}><Pencil size={13}/></button><button className="icon-button danger" aria-label="거래 내역 삭제" onClick={()=>{setSelectedId(item.id);setConfirm(item.kind==="buy"?"entry":"exit");}} data-testid={`button-delete-history-${item.id}`}><Trash2 size={13}/></button></div>
          </div>)}</div>:<EmptyState title="거래 내역이 비어 있습니다" copy="거래 추가 버튼을 눌러 매수 기록을 남겨주세요."/>}
        </section>
      </div>
      <div style={{display:"grid",alignContent:"start",gap:14}}>
        <section className="panel panel-pad">
          <div className="section-title"><div><h2>전략 태그</h2><div className="section-caption">이 포지션을 설명하는 키워드</div></div></div>
          <div className="tag-picker">{STRATEGY_TAGS.map((tag)=><button key={tag} type="button" className={`tag-option ${trade.tags.includes(tag)?"selected":""}`} onClick={()=>toggleTag(tag)} aria-pressed={trade.tags.includes(tag)} data-testid={`button-strategy-${tag}`}>{tag}</button>)}</div>
        </section>
        <section className="panel panel-pad">
          <div className="section-title"><div><h2>매매 노트</h2><div className="section-caption">진입 근거와 결과를 돌아보세요.</div></div></div>
          <textarea className="input" value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="왜 매수했나요? 계획은 어떻게 흘러갔나요?" aria-label="매매 노트" data-testid="input-trade-notes"/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><span className="hint">개인 기록으로만 저장됩니다.</span><button className="button small primary" onClick={()=>{updateNotes(trade.id,notes);toast("노트를 저장했습니다.");}} data-testid="button-save-notes"><Save size={13}/>노트 저장</button></div>
        </section>
        <section className="panel panel-pad">
          <div className="section-title"><div><h2>포지션 현황</h2><div className="section-caption">{result.isOpen?"보유 중":"모든 수량 매도 완료"}</div></div><span className={`status-tag ${result.isOpen?"":"closed"}`}>{result.isOpen?"보유 중":"종료"}</span></div>
          <div className="activity-list">
            <div className="activity-row"><span className="section-caption">총 매수 수량</span><span className="mono">{result.totalBought.toLocaleString("ko-KR")}주</span></div>
            <div className="activity-row"><span className="section-caption">총 매도 수량</span><span className="mono">{result.totalSold.toLocaleString("ko-KR")}주</span></div>
            <div className="activity-row"><span className="section-caption">평균 매도 가격</span><span className="mono">{result.avgSell?`${formatKRW(result.avgSell)}원`:"—"}</span></div>
          </div>
        </section>
      </div>
    </div>
    {edit&&<Modal title={`${edit.kind==="buy"?"매수":"매도"} 내역 수정`} onClose={()=>setEdit(null)} actions={<><button className="button quiet" onClick={()=>setEdit(null)} data-testid="button-cancel-edit-history">취소</button><button className="button primary" onClick={saveEdit} data-testid="button-save-edit-history">변경 저장</button></>}>
      <div className="form-grid"><div className="field"><label htmlFor="edit-date">날짜</label><input id="edit-date" type="text" inputMode="numeric" placeholder="YYYY-MM-DD, 10-1 또는 1001" className="input" value={edit.date} onChange={(event)=>setEdit({...edit,date:event.target.value})} data-testid="input-edit-history-date"/><span className="hint">연도 생략 시 올해 날짜로 기록합니다.</span></div>
        <div className="field"><label htmlFor="edit-price">가격</label><input id="edit-price" type="number" min="0.01" step="any" className="input" value={edit.price} onChange={(event)=>setEdit({...edit,price:event.target.value})} data-testid="input-edit-history-price"/></div>
        <div className="field"><label htmlFor="edit-quantity">수량</label><input id="edit-quantity" type="number" min="0.0001" step="any" className="input" value={edit.quantity} onChange={(event)=>setEdit({...edit,quantity:event.target.value})} data-testid="input-edit-history-quantity"/></div>
      </div>
    </Modal>}
    {confirm&&<Modal title={confirm==="trade"?"포지션을 삭제할까요?":"거래 내역을 삭제할까요?"} onClose={()=>setConfirm(null)} actions={<><button className="button quiet" onClick={()=>setConfirm(null)} data-testid="button-cancel-delete">취소</button><button className="button danger" onClick={deleteSelected} data-testid="button-confirm-delete">삭제</button></>}>
      <p className="modal-copy">{confirm==="trade"?"이 포지션과 모든 매수·매도 내역이 삭제됩니다. 되돌릴 수 없습니다.":"내역을 삭제하면 포지션의 계산 결과도 다시 반영됩니다."}</p>
    </Modal>}
  </div></AppShell>;
}