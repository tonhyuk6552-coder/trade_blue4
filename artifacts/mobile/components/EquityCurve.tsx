import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface DataPoint {
  date: string;
  pnl: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
}

export default function EquityCurve({ data, height = 160 }: Props) {
  const colors = useColors();

  const { path, gradientPath, points } = useMemo(() => {
    if (data.length < 2) return { path: "", gradientPath: "", points: [] };

    const width = 300;
    const padding = 8;
    const chartWidth = width - padding * 2;
    const chartHeight = height - 32;

    const values = data.map((d) => d.pnl);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(0, ...values);
    const range = maxVal - minVal || 1;

    const toX = (i: number) => padding + (i / (data.length - 1)) * chartWidth;
    const toY = (v: number) => padding + chartHeight - ((v - minVal) / range) * chartHeight;

    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.pnl) }));
    const lastPt = pts[pts.length - 1];

    let p = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
      const cp1y = pts[i - 1].y;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
      const cp2y = pts[i].y;
      p += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i].x} ${pts[i].y}`;
    }

    const bottom = toY(minVal) + padding;
    const gp = p + ` L ${lastPt.x} ${bottom} L ${pts[0].x} ${bottom} Z`;

    return { path: p, gradientPath: gp, points: pts };
  }, [data, height]);

  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          거래를 기록하면 수익 곡선이 표시됩니다
        </Text>
      </View>
    );
  }

  const lastValue = data[data.length - 1].pnl;
  const isPositive = lastValue >= 0;
  const lineColor = isPositive ? colors.profit : colors.loss;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 300 ${height}`}>
        <Defs>
          <LinearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {gradientPath ? <Path d={gradientPath} fill="url(#curveGrad)" /> : null}
        {path ? <Path d={path} fill="none" stroke={lineColor} strokeWidth={2.5} /> : null}
        {points.length > 0 ? (
          <Circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill={lineColor}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  empty: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 13, textAlign: "center" },
});
