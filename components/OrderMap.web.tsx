import { useEffect, useMemo, useRef } from 'react';

import { buildOrderMapHtml, OrderMapData } from '@/components/orderMapHtml';

export interface OrderMapProps {
  data: OrderMapData;
  recenterNonce?: number;
  style?: unknown;
}

// Web (react-native-web): render the same Leaflet map in a plain <iframe>.
export default function OrderMap({ data, recenterNonce }: OrderMapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildOrderMapHtml(data), [data]);

  useEffect(() => {
    if (recenterNonce) ref.current?.contentWindow?.postMessage('recenter', '*');
  }, [recenterNonce]);

  return (
    <iframe
      ref={ref}
      title="Factory map"
      srcDoc={html}
      style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
    />
  );
}
