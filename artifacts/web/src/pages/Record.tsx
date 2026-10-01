import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField } from "../components/ui/form";
import { AppShell, PageHeading } from "../components/AppShell";
import { useTrades } from "../context/TradesContext";
import { calcTradeResult, parseTradeDate } from "../domain/trades";
import { searchStocks } from "../data/stocks";
import { todayString } from "../lib/format";
import { useToast } from "../components/Toast";

type RecordFields = { ticker: string; name: string; tradeId: string; price: string; quantity: string; date: string; accountId: string };

export default function Record() {
  const { trades, accounts, addTrade, addEntry, addExit } = useTrades();
  const toast = useToast();
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [search, setSearch] = useState("");
  const matches = useMemo(() => searchStocks(search), [search]);
  const openTrades = trades.filter((trade) => calcTradeResult(trade).isOpen);
  const form = useForm<RecordFields>({ defaultValues: { ticker:"", name:"", tradeId:"", price:"", quantity:"", date:todayString(), accountId:accounts[0]?.id ?? "" } });
  const { control, handleSubmit, setValue, watch, reset, formState:{errors,isSubmitting} } = form;
  const selectedTradeId = watch("tradeId");
  const selectedTrade = trades.find((trade) => trade.id === selectedTradeId);
  useEffect(() => {
    if (direction === "sell" && openTrades.length === 1 && selectedTradeId !== openTrades[0].id) {
      setValue("tradeId", openTrades[0].id, { shouldValidate: true });
    }
  }, [direction, openTrades.length, openTrades[0]?.id, selectedTradeId, setValue]);
  const onSubmit = handleSubmit((values) => {
    const price = Number(values.price);
    const quantity = Number(values.quantity);
    const date = parseTradeDate(values.date);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      toast("가격과 수량은 0보다 큰 숫자로 입력해주세요."); return;
    }
    if (!date) {
      toast("날짜를 YYYY-MM-DD, M-D 또는 MMDD 형식으로 입력해주세요."); return;
    }
    if (direction === "buy") {
      if (values.tradeId) addEntry(values.tradeId, price, quantity, date);
      else {
        const ticker = values.ticker.trim().toUpperCase();
        if (!ticker) { toast("종목을 검색해 선택하거나 종목 코드를 입력해주세요."); return; }
        const trade = addTrade(ticker, values.name.trim() || ticker, date, values.accountId);
        addEntry(trade.id, price, quantity, date);
      }
      toast("매수 기록을 저장했습니다.");
    } else {
      if (!values.tradeId) { toast("매도할 보유 포지션을 선택해주세요."); return; }
      const result = calcTradeResult(selectedTrade!);
      if (quantity > result.remainingQty) { toast(`현재 보유 수량 ${result.remainingQty.toLocaleString("ko-KR")}주를 초과할 수 없습니다.`); return; }
      addExit(values.tradeId, price, quantity, date);
      toast("매도 기록을 저장했습니다.");
    }
    reset({ ticker:"",name:"",tradeId:"",price:"",quantity:"",date:todayString(),accountId:values.accountId });
    setSearch("");
  });
  const pickStock = (stock: {ticker:string;name:string}) => {
    setValue("ticker", stock.ticker, {shouldValidate:true}); setValue("name", stock.name); setSearch(`${stock.name} · ${stock.ticker}`);
  };
  return <AppShell current="/record"><div className="page-wrap">
    <PageHeading eyebrow="NEW ENTRY" title="매매를 기록하다" subtitle="생각이 선명할 때 적어두면, 다음 선택이 조금 쉬워집니다." />
    <div className="record-layout">
      <section className="panel record-form">
        <div className="section-title"><div><h2>거래 정보</h2><div className="section-caption">기록은 이 브라우저에 자동 저장됩니다.</div></div></div>
        <div className="segmented" style={{marginBottom:22}}>
          <button type="button" className={`segment buy ${direction === "buy" ? "active" : ""}`} onClick={() => {setDirection("buy");setValue("tradeId","");}} data-testid="button-direction-buy">매수 기록</button>
          <button type="button" className={`segment sell ${direction === "sell" ? "active" : ""}`} onClick={() => {setDirection("sell");setValue("tradeId","");}} data-testid="button-direction-sell">매도 기록</button>
        </div>
        <Form {...form}><form onSubmit={onSubmit} className="form-grid">
          {direction === "buy" ? <>
            <div className="field full"><label htmlFor="stock-search">종목 찾기</label>
              <input id="stock-search" className="input" value={search} onChange={(event)=>{setSearch(event.target.value);setValue("ticker",event.target.value.toUpperCase());setValue("name","");}} placeholder="종목명 또는 티커 입력" autoComplete="off" data-testid="input-record-stock"/>
              {search.length > 0 && matches.length > 0 && <div className="suggestions">{matches.map((stock)=><button type="button" key={stock.ticker} className="suggestion" onClick={()=>pickStock(stock)} data-testid={`button-stock-${stock.ticker}`}>{stock.name} <span style={{color:"#758095"}}>{stock.ticker}</span></button>)}</div>}
              <div className="hint">목록에 없는 종목은 코드나 이름을 직접 입력해도 됩니다.</div>
            </div>
            <FormField control={control} name="tradeId" render={({field})=><div className="field full"><label htmlFor="buy-existing">기존 포지션에 추가 <span style={{color:"#747a88"}}>(선택)</span></label><select id="buy-existing" className="select" value={field.value} onChange={field.onChange} data-testid="select-existing-position"><option value="">새 포지션으로 기록</option>{openTrades.map((trade)=><option value={trade.id} key={trade.id}>{trade.name} · {trade.ticker}</option>)}</select></div>}/>
            {!watch("tradeId") && <FormField control={control} name="accountId" render={({field})=><div className="field"><label htmlFor="record-account">계좌</label><select id="record-account" className="select" {...field} data-testid="select-record-account">{accounts.map((account)=><option value={account.id} key={account.id}>{account.name}</option>)}</select></div>}/>}
          </> : <FormField control={control} name="tradeId" rules={{required:"포지션을 선택해주세요."}} render={({field})=><div className="field full"><label htmlFor="sell-position">매도할 포지션</label><select id="sell-position" className="select" {...field} data-testid="select-sell-position"><option value="">보유 중인 포지션 선택</option>{openTrades.map((trade)=><option value={trade.id} key={trade.id}>{trade.name} · {trade.ticker} · {calcTradeResult(trade).remainingQty.toLocaleString("ko-KR")}주 보유</option>)}</select>{errors.tradeId && <span className="form-error">{errors.tradeId.message}</span>}</div>}/>}
          <FormField control={control} name="price" rules={{required:"가격을 입력해주세요.",validate:(value)=>Number(value)>0 || "0보다 큰 가격을 입력해주세요."}} render={({field})=><div className="field"><label htmlFor="trade-price">가격</label><input id="trade-price" className="input" inputMode="decimal" type="number" min="0.01" step="any" placeholder="예: 72,500" {...field} data-testid="input-trade-price"/>{errors.price && <span className="form-error">{errors.price.message}</span>}</div>}/>
          <FormField control={control} name="quantity" rules={{required:"수량을 입력해주세요.",validate:(value)=>Number(value)>0 || "0보다 큰 수량을 입력해주세요."}} render={({field})=><div className="field"><label htmlFor="trade-quantity">수량</label><input id="trade-quantity" className="input" inputMode="decimal" type="number" min="0.0001" step="any" placeholder="예: 10" {...field} data-testid="input-trade-quantity"/>{errors.quantity && <span className="form-error">{errors.quantity.message}</span>}{direction==="sell" && selectedTrade && <span className="hint">매도 가능 {calcTradeResult(selectedTrade).remainingQty.toLocaleString("ko-KR")}주</span>}</div>}/>
          <FormField control={control} name="date" rules={{required:"날짜를 입력해주세요."}} render={({field})=><div className="field"><label htmlFor="trade-date">{direction === "buy" ? "매수 날짜" : "매도 날짜"}</label><input id="trade-date" className="input" type="text" inputMode="numeric" placeholder="YYYY-MM-DD, 10-1 또는 1001" {...field} data-testid="input-trade-date"/><span className="hint">연도 생략 시 올해 날짜로 기록합니다.</span></div>}/>
          <div className="field"><label>예상 원금</label><div className="input mono" style={{color:"#9ca4b3"}}>{watch("price") && watch("quantity") ? `${Math.round(Number(watch("price"))*Number(watch("quantity"))).toLocaleString("ko-KR")} 원` : "가격과 수량 입력 후 계산"}</div></div>
          <div className="field full" style={{marginTop:5}}><button className="button primary" type="submit" disabled={isSubmitting} data-testid="button-save-trade">{isSubmitting ? "저장 중…" : direction === "buy" ? "매수 기록 저장" : "매도 기록 저장"}</button></div>
        </form></Form>
      </section>
      <aside className="panel record-aside">
        <div className="eyebrow">A SMALL REMINDER</div><h2 style={{fontSize:19,lineHeight:1.45,marginTop:12}}>기록은 맞고 틀림보다<br/>왜 그랬는지를 남깁니다.</h2>
        <p className="setting-description" style={{marginTop:11}}>가격과 수량을 빠짐없이 남기고, 자세한 매매 이유와 전략 태그는 포지션 상세에서 더해보세요.</p>
        <div className="rule"/>
        <div className="section-caption">지금 보유 중인 포지션</div>
        <div style={{font:"22px var(--mono)",marginTop:6}}>{openTrades.length}<span style={{fontSize:12,color:"#878d9b",marginLeft:6}}>건</span></div>
        <div className="section-caption" style={{marginTop:7}}>모든 기록은 사용 중인 브라우저에 저장됩니다.</div>
      </aside>
    </div>
  </div></AppShell>;
}