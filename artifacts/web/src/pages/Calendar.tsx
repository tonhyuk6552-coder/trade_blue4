import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppShell, EmptyState, PageHeading } from "../components/AppShell";
import { useTrades } from "../context/TradesContext";
import { calcTradeResult } from "../domain/trades";
import { formatKRWSign } from "../lib/format";

type DayActivity = { count: number; pnl: number; items: { name:string; direction:string; pnl:number; id:string }[] };
export default function Calendar() {
  const { trades } = useTrades();
  const [month,setMonth] = useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const year=month.getFullYear(), monthIndex=month.getMonth();
  const monthName=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long"}).format(month);
  const activity = useMemo(() => {
    const map=new Map<string,DayActivity>();
    const add=(date:string,item:DayActivity["items"][number])=>{
      const day=map.get(date) ?? {count:0,pnl:0,items:[]};
      day.count+=1;day.pnl+=item.pnl;day.items.push(item);map.set(date,day);
    };
    for(const trade of trades){
      const result=calcTradeResult(trade);
      trade.entries.forEach((entry)=>add(new Date(entry.timestamp).toISOString().slice(0,10),{name:trade.name,direction:"매수",pnl:0,id:trade.id}));
      const pnlByExit=new Map(result.exitResults.map((event)=>[event.exitId,event.realizedPnL]));
      trade.exits.forEach((exit)=>add(exit.date,{name:trade.name,direction:"매도",pnl:pnlByExit.get(exit.id)??0,id:trade.id}));
    }
    return map;
  },[trades]);
  const monthEvents=Array.from(activity.entries()).filter(([date])=>date.startsWith(`${year}-${String(monthIndex+1).padStart(2,"0")}`));
  const monthPnl=monthEvents.reduce((sum,[,day])=>sum+day.pnl,0);
  const monthCount=monthEvents.reduce((sum,[,day])=>sum+day.count,0);
  const firstDay=new Date(year,monthIndex,1).getDay();
  const daysInMonth=new Date(year,monthIndex+1,0).getDate();
  const prevMonthDays=new Date(year,monthIndex,0).getDate();
  const cells=Array.from({length:42},(_,index)=>{
    if(index<firstDay){const day=prevMonthDays-firstDay+index+1;return {day,offset:-1,date:new Date(year,monthIndex-1,day).toISOString().slice(0,10)};}
    if(index>=firstDay+daysInMonth){const day=index-firstDay-daysInMonth+1;return {day,offset:1,date:new Date(year,monthIndex+1,day).toISOString().slice(0,10)};}
    const day=index-firstDay+1;return {day,offset:0,date:`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`};
  });
  const today=new Date().toISOString().slice(0,10);
  return <AppShell current="/calendar"><div className="page-wrap">
    <PageHeading eyebrow="ACTIVITY CALENDAR" title="매매 캘린더" subtitle="거래가 있었던 날과 그날의 실현 결과를 한눈에 살펴봅니다." />
    <section className="panel" style={{overflow:"hidden"}}>
      <div className="calendar-head">
        <div style={{display:"flex",alignItems:"center",gap:13}}><button className="icon-button" onClick={()=>setMonth(new Date(year,monthIndex-1,1))} aria-label="이전 달" data-testid="button-calendar-prev"><ChevronLeft size={18}/></button><div className="calendar-title" data-testid="text-calendar-month">{monthName}</div><button className="icon-button" onClick={()=>setMonth(new Date(year,monthIndex+1,1))} aria-label="다음 달" data-testid="button-calendar-next"><ChevronRight size={18}/></button></div>
        <button className="button quiet small" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))} data-testid="button-calendar-today">오늘</button>
        <div className="calendar-summary"><span>거래 <strong>{monthCount}회</strong></span><span>실현 손익 <strong className={monthPnl>0?"positive":monthPnl<0?"negative":""}>{formatKRWSign(monthPnl)}원</strong></span></div>
      </div>
      <div className="calendar-grid">
        {["일","월","화","수","목","금","토"].map((day)=><div key={day} className="calendar-weekday">{day}</div>)}
        {cells.map((cell,index)=>{
          const data=activity.get(cell.date);
          return <div key={`${cell.date}-${index}`} className={`calendar-day ${cell.offset?"muted-day":""} ${cell.date===today?"today":""}`} data-testid={`calendar-day-${cell.date}`}>
            <div className="calendar-num">{cell.day}</div>
            {data?.items.slice(0,2).map((item,idx)=><Link key={`${item.id}-${idx}`} href={`/trade/${item.id}`} className={`calendar-activity ${item.direction==="매수"?"":"win"}`} title={`${item.name} ${item.direction}`} data-testid={`link-calendar-trade-${cell.date}-${idx}`}>{item.direction} · {item.name}</Link>)}
            {data && data.items.length>2 && <div className="section-caption">+{data.items.length-2}건 더</div>}
            {data?.pnl !== undefined && data?.pnl !== 0 && <div className={`mono ${data.pnl>0?"positive":"negative"}`} style={{fontSize:9,marginTop:4}}>{formatKRWSign(data.pnl)}</div>}
          </div>;
        })}
      </div>
      {trades.length===0 && <EmptyState title="달력에 기록이 아직 없어요" copy="첫 매매를 남기면 거래가 있었던 날짜가 여기에 표시됩니다." action={<Link href="/record" className="button primary" data-testid="link-calendar-record">기록 남기기</Link>} />}
    </section>
  </div></AppShell>;
}