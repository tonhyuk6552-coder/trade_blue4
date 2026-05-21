import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import WebView from "react-native-webview";

interface Props {
  html: string;
  style?: StyleProp<ViewStyle>;
}

export default function ChartWebView({ html, style }: Props) {
  return (
    <WebView
      source={{ html }}
      style={[{ flex: 1, backgroundColor: "#111113" }, style]}
      scrollEnabled={false}
      bounces={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      originWhitelist={["*"]}
      javaScriptEnabled
      allowsInlineMediaPlayback
    />
  );
}
