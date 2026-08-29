import { useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildOrderMapHtml, OrderMapData } from '@/components/orderMapHtml';

export interface OrderMapProps {
  data: OrderMapData;
  recenterNonce?: number;
  style?: StyleProp<ViewStyle>;
}

// Native (iOS/Android): render the Leaflet map inside a WebView.
export default function OrderMap({ data, recenterNonce, style }: OrderMapProps) {
  const ref = useRef<WebView>(null);
  const html = useMemo(() => buildOrderMapHtml(data), [data]);

  useEffect(() => {
    if (recenterNonce) ref.current?.injectJavaScript('window.__recenter && window.__recenter(); true;');
  }, [recenterNonce]);

  return (
    <WebView
      ref={ref}
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
}
