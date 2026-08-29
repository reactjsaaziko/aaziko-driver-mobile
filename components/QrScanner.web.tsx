import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CYAN = '#159CDE';
const TEXT = '#22262A';
const MUTED = '#8A9099';
const BORDER = '#E6E8EB';

export interface QrScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  hint?: string;
  errorText?: string | null;
}

// Web fallback: the phone uses the live camera (QrScanner.tsx); on web there's
// no reliable camera QR scan, so the seal code is entered/pasted by hand and
// verified the same way. Keeps the web bundle free of native camera code.
export default function QrScanner({ visible, onClose, onScanned, hint, errorText }: QrScannerProps) {
  const [code, setCode] = useState('');
  useEffect(() => {
    if (visible) setCode('');
  }, [visible]);

  // Submit the typed code and clear it, so the next box can be entered right
  // away (the parent shows a result popup) — mirrors the phone's continuous scan.
  const submit = () => {
    const c = code.trim();
    if (!c) return;
    onScanned(c);
    setCode('');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Scan QR seal</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={TEXT} />
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            {hint ? hint + '. ' : ''}Camera scanning runs on the phone. On the web, paste or type the seal
            code from the QR to verify.
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="SEAL-…"
            placeholderTextColor={MUTED}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            onSubmitEditing={submit}
          />
          {errorText ? <Text style={styles.err}>{errorText}</Text> : null}
          <TouchableOpacity
            style={[styles.verify, !code.trim() && { opacity: 0.5 }]}
            disabled={!code.trim()}
            onPress={submit}>
            <Text style={styles.verifyText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: TEXT, fontSize: 17, fontWeight: '700' },
  note: { color: MUTED, fontSize: 13, marginTop: 10, lineHeight: 19 },
  input: {
    marginTop: 14,
    height: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: TEXT,
  },
  err: { color: '#D64545', fontSize: 13, fontWeight: '500', marginTop: 10 },
  verify: {
    marginTop: 16,
    height: 48,
    borderRadius: 8,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
