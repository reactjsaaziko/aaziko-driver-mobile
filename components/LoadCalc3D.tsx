import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildLoadCalc3dHtml, Cargo3DItem } from '@/components/loadCalc3dHtml';

export interface LoadCalc3DProps {
  cargoItems: Cargo3DItem[];
  containerSize?: '20ft' | '40ft';
  interactive?: boolean;
  chrome?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Native (iOS/Android): render the Three.js scene inside a WebView.
export default function LoadCalc3D({
  cargoItems,
  containerSize,
  interactive,
  chrome,
  style,
}: LoadCalc3DProps) {
  const html = useMemo(
    () => buildLoadCalc3dHtml({ cargoItems, containerSize, interactive, chrome }),
    [cargoItems, containerSize, interactive, chrome],
  );

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      androidLayerType="hardware"
    />
  );
}
