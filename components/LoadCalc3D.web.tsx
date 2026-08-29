import { useMemo } from 'react';

import { buildLoadCalc3dHtml, Cargo3DItem } from '@/components/loadCalc3dHtml';

export interface LoadCalc3DProps {
  cargoItems: Cargo3DItem[];
  containerSize?: '20ft' | '40ft';
  interactive?: boolean;
  chrome?: boolean;
  style?: unknown;
}

// Web (react-native-web): react-native-webview has no web build, so render the
// same self-contained Three.js scene in a plain <iframe srcDoc>.
export default function LoadCalc3D({
  cargoItems,
  containerSize,
  interactive,
  chrome,
}: LoadCalc3DProps) {
  const html = useMemo(
    () => buildLoadCalc3dHtml({ cargoItems, containerSize, interactive, chrome }),
    [cargoItems, containerSize, interactive, chrome],
  );

  return (
    <iframe
      title="Load Calculator 3D"
      srcDoc={html}
      style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
    />
  );
}
