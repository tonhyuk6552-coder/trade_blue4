import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChartWebView from "@/components/ChartWebView";

import { calcTradeResult, useTrades } from "@/context/TradesContext";
import { useColors } from "@/hooks/useColors";

const ACCOUNT_COLORS = ["#00D26A", "#6699FF", "#FF9500", "#AF52DE"];

const PERIODS = [
  { label: "1일", interval: "5m", range: "1d", intraday: true },
  { label: "1주", interval: "1h", range: "5d", intraday: true },
  { label: "1월", interval: "1d", range: "1mo", intraday: false },
  { label: "3월", interval: "1d", range: "3mo", intraday: false },
  { label: "1년", interval: "1wk", range: "1y", intraday: false },
];

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

function normalizeYahooTicker(ticker: string): string {
  if (/^\d{6}$/.test(ticker)) return `${ticker}.KS`;
  if (/^\d{6}\.(KQ|KS)$/.test(ticker)) return ticker;
  return ticker;
}

interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartData {
  candles: Candle[];
  currency: string;
}

async function fetchChartData(ticker: string, interval: string, range: string): Promise<ChartData> {
  if (Platform.OS === "web") {
    const res = await fetch(
      `${getApiBase()}/api/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
    );
    if (!res.ok) throw new Error("Failed to fetch chart data");
    return res.json() as Promise<ChartData>;
  }

  const normalized = normalizeYahooTicker(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Failed");
  const data = (await res.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; meta?: { currency?: string }; indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }> } }> };
  };
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No data");
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) throw new Error("No quote");
  const isDailyOrWeekly = ["1d", "1wk", "1mo"].includes(interval);
  const candles: Candle[] = timestamps
    .map((ts, i) => {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      if (open == null || close == null || high == null || low == null) return null;
      const time = isDailyOrWeekly ? new Date(ts * 1000).toISOString().slice(0, 10) : ts;
      return { time, open, high, low, close };
    })
    .filter((c): c is Candle => c !== null);
  return { candles, currency: result.meta?.currency ?? "KRW" };
}

function buildChartHtml(candles: Candle[], markers: object[], avgPrice: number, currency: string, intraday: boolean): string {
  const isKRW = currency === "KRW";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#111113;overflow:hidden;}
#chart{width:100%;height:100%;}
#tip{position:fixed;top:10px;left:10px;z-index:999;background:rgba(30,30,35,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;color:#EBEBF5;font-size:12px;font-family:-apple-system,sans-serif;display:none;pointer-events:none;min-width:180px;max-width:240px;backdrop-filter:blur(8px);}
.r{display:flex;justify-content:space-between;gap:12px;margin:2px 0;}
.l{color:#8E8E93;}
.sep{margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.1);font-weight:700;}
</style>
</head>
<body>
<div id="chart"></div>
<div id="tip"></div>
<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
<script>
var CANDLES=${JSON.stringify(candles)};
var MARKERS=${JSON.stringify(markers)};
var AVG=${avgPrice};
var IS_KRW=${isKRW};
var INTRADAY=${intraday};

function fp(p){
  if(p==null)return'—';
  if(IS_KRW)return p.toLocaleString('ko-KR')+'원';
  return '$'+p.toFixed(2);
}
function ft(t){
  if(typeof t==='string')return t;
  var d=new Date(t*1000);
  if(INTRADAY){
    return d.toLocaleDateString('ko-KR')+' '+d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }
  return d.toLocaleDateString('ko-KR');
}

var chart=LightweightCharts.createChart(document.getElementById('chart'),{
  layout:{background:{color:'#111113'},textColor:'#8E8E93'},
  grid:{vertLines:{color:'#1E1E22'},horzLines:{color:'#1E1E22'}},
  crosshair:{mode:LightweightCharts.CrosshairMode.Normal,vertLine:{color:'#3A3A3C',labelBackgroundColor:'#2C2C2E'},horzLine:{color:'#3A3A3C',labelBackgroundColor:'#2C2C2E'}},
  rightPriceScale:{borderColor:'#2C2C2E',textColor:'#8E8E93'},
  timeScale:{borderColor:'#2C2C2E',timeVisible:INTRADAY,secondsVisible:false},
  handleScroll:true,
  handleScale:true,
  width:window.innerWidth,
  height:window.innerHeight,
});

var cs=chart.addCandlestickSeries({
  upColor:'#00D26A',downColor:'#FF3B30',
  borderUpColor:'#00D26A',borderDownColor:'#FF3B30',
  wickUpColor:'#00D26A',wickDownColor:'#FF3B30',
});

if(CANDLES.length>0)cs.setData(CANDLES);

if(MARKERS.length>0)cs.setMarkers(MARKERS);

if(AVG>0){
  cs.createPriceLine({
    price:AVG,color:'#6699FF',lineWidth:1,
    lineStyle:LightweightCharts.LineStyle.Dashed,
    axisLabelVisible:true,title:'평균단가',
  });
}

window.addEventListener('resize',function(){
  chart.applyOptions({width:window.innerWidth,height:window.innerHeight});
});

var tip=document.getElementById('tip');
var mmap={};
MARKERS.forEach(function(m){mmap[m.time]=m;});

chart.subscribeCrosshairMove(function(param){
  if(!param||!param.time||!param.point){tip.style.display='none';return;}
  var d=param.seriesData.get(cs);
  if(!d){tip.style.display='none';return;}
  var mk=mmap[param.time];
  var html='<div class="r"><span class="l">시간</span><span>'+ft(param.time)+'</span></div>';
  html+='<div class="r"><span class="l">시가</span><span>'+fp(d.open)+'</span></div>';
  html+='<div class="r"><span class="l">고가</span><span style="color:#00D26A">'+fp(d.high)+'</span></div>';
  html+='<div class="r"><span class="l">저가</span><span style="color:#FF3B30">'+fp(d.low)+'</span></div>';
  html+='<div class="r"><span class="l">종가</span><span>'+fp(d.close)+'</span></div>';
  if(AVG>0){
    var diff=d.close-AVG;
    var pct=(AVG>0?(diff/AVG*100):0).toFixed(2);
    var col=diff>=0?'#00D26A':'#FF3B30';
    html+='<div class="r sep"><span class="l">평균단가 대비</span><span style="color:'+col+'">'+(diff>=0?'+':'')+fp(diff)+' ('+pct+'%)</span></div>';
  }
  if(mk){
    html+='<div class="sep" style="color:'+mk.color+'">'+mk.text+'</div>';
  }
  tip.innerHTML=html;
  tip.style.display='block';
});
</script>
</body>
</html>`;
}

export default function ChartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { trades, accounts } = useTrades();

  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [periodIdx, setPeriodIdx] = useState(2);

  const period = PERIODS[periodIdx];
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const tickers = useMemo(() => {
    const filtered = accountFilter ? trades.filter((t) => t.accountId === accountFilter) : trades;
    const map = new Map<string, string>();
    for (const t of filtered) {
      if (!map.has(t.ticker)) map.set(t.ticker, t.name);
    }
    return Array.from(map.entries()).map(([ticker, name]) => ({ ticker, name }));
  }, [trades, accountFilter]);

  const effectiveTicker = selectedTicker ?? (tickers[0]?.ticker ?? null);

  const { data: chartData, isLoading, isError, refetch } = useQuery({
    queryKey: ["chart", effectiveTicker, period.interval, period.range],
    queryFn: () => fetchChartData(effectiveTicker!, period.interval, period.range),
    enabled: !!effectiveTicker,
    staleTime: 60_000,
    refetchOnMount: "always",
    retry: 2,
  });

  const { markers, avgPrice } = useMemo(() => {
    if (!effectiveTicker) return { markers: [], avgPrice: 0 };

    const relevant = (accountFilter ? trades.filter((t) => t.accountId === accountFilter) : trades).filter(
      (t) => t.ticker === effectiveTicker
    );

    const markers: object[] = [];
    let totalCost = 0;
    let totalQty = 0;

    for (const t of relevant) {
      const r = calcTradeResult(t);
      totalCost += r.avgBuy * t.entries.reduce((s, e) => s + e.quantity, 0);
      totalQty += t.entries.reduce((s, e) => s + e.quantity, 0);

      for (const entry of t.entries) {
        const time = period.intraday
          ? Math.floor(entry.timestamp / 1000)
          : new Date(entry.timestamp).toISOString().slice(0, 10);
        markers.push({
          time,
          position: "belowBar",
          color: "#00D26A",
          shape: "arrowUp",
          text: `매수 ${entry.quantity}주 @${Math.round(entry.price).toLocaleString()}`,
        });
      }

      for (const exit of t.exits) {
        const time = period.intraday
          ? Math.floor(exit.timestamp / 1000)
          : (exit.date ?? new Date(exit.timestamp).toISOString().slice(0, 10));
        markers.push({
          time,
          position: "aboveBar",
          color: "#FF3B30",
          shape: "arrowDown",
          text: `매도 ${exit.quantity}주 @${Math.round(exit.price).toLocaleString()}`,
        });
      }
    }

    markers.sort((a: any, b: any) => {
      if (typeof a.time === "number") return a.time - b.time;
      return String(a.time).localeCompare(String(b.time));
    });

    const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
    return { markers, avgPrice };
  }, [effectiveTicker, trades, accountFilter, period.intraday]);

  const chartHtml = useMemo(() => {
    if (!chartData) return null;
    return buildChartHtml(chartData.candles, markers, avgPrice, chartData.currency, period.intraday);
  }, [chartData, markers, avgPrice, period.intraday]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>차트</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => { setAccountFilter(null); setSelectedTicker(null); }}
            style={[styles.chip, { backgroundColor: accountFilter === null ? colors.primary : colors.card, borderColor: accountFilter === null ? colors.primary : colors.border }]}
          >
            <Text style={[styles.chipText, { color: accountFilter === null ? colors.primaryForeground : colors.mutedForeground }]}>전체</Text>
          </Pressable>
          {accounts.map((acc, idx) => {
            const acColor = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
            const isActive = accountFilter === acc.id;
            return (
              <Pressable
                key={acc.id}
                onPress={() => { setAccountFilter(isActive ? null : acc.id); setSelectedTicker(null); }}
                style={[styles.chip, { backgroundColor: isActive ? acColor + "22" : colors.card, borderColor: isActive ? acColor : colors.border }]}
              >
                <View style={[styles.chipDot, { backgroundColor: acColor }]} />
                <Text style={[styles.chipText, { color: isActive ? acColor : colors.mutedForeground }]}>{acc.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tickers.length > 0 && (
          <View style={styles.tickerWrap}>
            {tickers.map(({ ticker, name }) => {
              const isActive = effectiveTicker === ticker;
              return (
                <Pressable
                  key={ticker}
                  onPress={() => setSelectedTicker(ticker)}
                  style={[styles.chip, { backgroundColor: isActive ? colors.primary + "22" : colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.tickerText, { color: isActive ? colors.primary : colors.text }]}>{ticker}</Text>
                  {name ? <Text style={[styles.tickerName, { color: colors.mutedForeground }]}>{name}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.periodRow}>
          {PERIODS.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setPeriodIdx(i)}
              style={[styles.periodBtn, { backgroundColor: i === periodIdx ? colors.primary : colors.card, borderColor: i === periodIdx ? colors.primary : colors.border }]}
            >
              <Text style={[styles.periodText, { color: i === periodIdx ? colors.primaryForeground : colors.mutedForeground }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.chartArea}>
        {!effectiveTicker ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>거래한 종목이 없습니다</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 12 }]}>차트 불러오는 중...</Text>
          </View>
        ) : isError || !chartHtml ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>차트 데이터를 불러올 수 없습니다</Text>
            <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>Yahoo Finance에서 데이터를 가져옵니다</Text>
            <Pressable
              onPress={() => refetch()}
              style={[styles.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <ChartWebView html={chartHtml} style={styles.webview} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, gap: 10, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: "600" as const },
  tickerText: { fontSize: 12, fontWeight: "700" as const },
  tickerName: { fontSize: 10 },
  periodRow: { flexDirection: "row", gap: 6 },
  periodBtn: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  periodText: { fontSize: 12, fontWeight: "600" as const },
  chartArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#111113" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  tickerWrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  retryBtn: { marginTop: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 9 },
  retryText: { fontSize: 14, fontWeight: "600" as const },
  emptyText: { fontSize: 14 },
  emptySubText: { fontSize: 12 },
});
