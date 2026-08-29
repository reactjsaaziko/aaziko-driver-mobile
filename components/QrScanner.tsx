import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CYAN = '#159CDE';

export interface QrScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  paused?: boolean;
  hint?: string;
  errorText?: string | null;
}

// Full-screen camera QR scanner (native). Reads a QR code and hands the decoded
// text to onScanned — the caller decides which box it matches and shows a result
// popup. While that popup is up the caller sets `paused` so the same sticker
// isn't read again; the scanner re-arms when it opens or when paused clears
// (popup dismissed), enabling a continuous scan-one-box-after-another flow.
export default function QrScanner({
  visible,
  onClose,
  onScanned,
  paused = false,
  hint,
  errorText,
}: QrScannerProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (!paused) lock.current = false; // (re)arm on open and after each popup
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, paused, permission, requestPermission]);

  const handleBarcode = ({ data }: { data?: string }) => {
    if (lock.current || paused) return;
    lock.current = true;
    onScanned(String(data || ''));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcode}
          />
        ) : (
          <View style={styles.perm}>
            <Ionicons name="camera-outline" size={46} color="#fff" />
            <Text style={styles.permText}>
              {permission && !permission.canAskAgain
                ? 'Camera access is blocked. Enable it in Settings to scan box QR seals.'
                : 'Camera permission is needed to scan the box QR seal.'}
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chrome overlay: close, framing square, hint / error */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close scanner">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Scan QR seal</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.frameWrap} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>{hint || 'Point the camera at the box QR sticker'}</Text>
            {errorText ? <Text style={styles.err}>{errorText}</Text> : null}
          </View>

          <View style={{ height: insets.bottom + 16 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  perm: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permText: { color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  permBtn: { backgroundColor: CYAN, borderRadius: 8, paddingHorizontal: 22, paddingVertical: 11 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  err: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 24,
    backgroundColor: '#D64545',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
});
