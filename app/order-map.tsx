import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OrderMap from '@/components/OrderMap';
import { OrderMapData } from '@/components/orderMapHtml';
import { Factory, getAssignmentDetails } from '@/services/orders';

const CYAN = '#159CDE';
const TEXT = '#22262A';
const MUTED = '#8A9099';
const BORDER = '#E6E8EB';

export default function OrderMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    orderNo?: string;
    sampleNo?: string;
    product?: string;
    qty?: string;
  }>();

  const [factory, setFactory] = useState<Factory | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recenter, setRecenter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!params.id) {
      setLoading(false);
      return;
    }
    getAssignmentDetails(params.id).then((d) => {
      if (cancelled) return;
      setFactory(d.factory);
      setImages(d.images);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const mapData: OrderMapData = useMemo(
    () => ({
      address: factory?.address,
      lat: factory?.lat ?? null,
      lng: factory?.lng ?? null,
      label: factory?.name || 'Factory',
      city: factory?.city,
      region: factory?.region,
      country: factory?.country,
      pincode: factory?.pincode,
    }),
    [factory],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {loading ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={CYAN} size="large" />
        </View>
      ) : (
        <OrderMap data={mapData} recenterNonce={recenter} style={styles.map} />
      )}

      {/* Top overlay controls */}
      <View style={[styles.controls, { top: insets.top + 12 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => router.back()} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={CYAN} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => setRecenter((n) => n + 1)}
          accessibilityLabel="Recenter">
          <Ionicons name="locate" size={22} color={CYAN} />
        </TouchableOpacity>
      </View>

      {/* Detected factory / pickup address banner */}
      <View style={[styles.factoryBanner, { top: insets.top + 12 }]} pointerEvents="none">
        <View style={styles.factoryPinDot}>
          <Ionicons name="location" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.factoryTitle} numberOfLines={1}>
            {loading ? 'Detecting factory…' : factory ? factory.name : 'Factory address not found'}
          </Text>
          {factory?.address ? (
            <Text style={styles.factoryAddr} numberOfLines={2}>
              {factory.address}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bottom order card */}
      <View style={[styles.card, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.cardTop}>
          <View style={styles.thumb}>
            {images[0] ? (
              <Image source={{ uri: images[0] }} style={styles.thumbImg} contentFit="cover" />
            ) : (
              <Ionicons name="cube-outline" size={22} color={MUTED} />
            )}
          </View>
          <View style={styles.info}>
            <Text style={styles.orderNo} numberOfLines={1}>
              Order No. {params.orderNo || '—'}
            </Text>
            <Text style={styles.meta}>Sample No.: {params.sampleNo || '—'}</Text>
            <Text style={styles.product} numberOfLines={2}>
              {params.product || 'Order'}
            </Text>
          </View>
        </View>

        <View style={styles.qtyRow}>
          <Text style={styles.qtyText}>Qty.: {params.qty || '—'}</Text>
          <Ionicons name="cube-outline" size={16} color="#2F6BFF" style={{ marginLeft: 6 }} />
        </View>

        <Text style={styles.line}>Lab Test:</Text>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.line}>Order Date: YY-MM-DD</Text>
            <Text style={styles.line}>Complition Date: YY-MM-DD</Text>
          </View>
          <TouchableOpacity style={styles.contractBtn}>
            <Text style={styles.contractText}>Order Contract</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e9edf2' },
  map: { flex: 1 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  factoryBanner: {
    position: 'absolute',
    left: 12,
    right: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  factoryPinDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factoryTitle: { color: TEXT, fontSize: 13, fontWeight: '700' },
  factoryAddr: { color: MUTED, fontSize: 11, marginTop: 1 },

  controls: { position: 'absolute', right: 12, gap: 12 },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#F4F6F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1, marginLeft: 12 },
  orderNo: { color: TEXT, fontSize: 13, fontWeight: '600' },
  meta: { color: '#5B616A', fontSize: 13, marginTop: 2 },
  product: { color: '#5B616A', fontSize: 13, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  qtyText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  line: { color: '#5B616A', fontSize: 13, marginTop: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  contractBtn: {
    backgroundColor: CYAN,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginLeft: 12,
  },
  contractText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
