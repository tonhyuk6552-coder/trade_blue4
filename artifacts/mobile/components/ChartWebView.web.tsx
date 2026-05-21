import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

interface Props {
  html: string;
  style?: StyleProp<ViewStyle>;
}

export default function ChartWebView({ html, style }: Props) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {React.createElement("iframe", {
        srcDoc: html,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "#111113",
          display: "block",
        },
        sandbox: "allow-scripts allow-same-origin",
      })}
    </View>
  );
}
