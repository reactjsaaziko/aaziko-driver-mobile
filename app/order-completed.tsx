import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchInspectionBoxes, getAssignmentDetails, InspectionBox, OrderInspection } from '@/services/orders';

const CYAN = '#159CDE';
const GREEN = '#22B14C';
const ROYAL = '#2F6BFF';
const TEXT = '#22262A';
const MUTED = '#8A9099';
const BORDER = '#E6E8EB';
const CARD_BG = '#F4F6F8';

function banner(status?: string): { title: string; sub: string; color: string; icon: any } {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'reviewed':
    case 'approved':
      return {
        title: 'Order Completed',
        sub: 'This order has been completed. No further action needed.',
        color: GREEN,
        icon: 'checkmark-circle',
      };
    case 'cancelled':
      return { title: 'Order Cancelled', sub: 'This order was cancelled.', color: '#9aa4ad', icon: 'close-circle' };
    default:
      return {
        title: 'Submitted for Confirmation',
        sub: 'This order was submitted and is awaiting confirmation.',
        color: CYAN,
        icon: 'time',
      };
  }
}

export default function OrderCompletedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    orderNo?: string;
    sampleNo?: string;
    product?: string;
    qty?: string;
    inquiryId?: string;
    status?: string;
    completed?: string;
  }>();

  const [images, setImages] = useState<string[]>([]);
  const [data, setData] = useState<Omit<OrderInspection, 'done'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (params.id) {
        const d = await getAssignmentDetails(params.id);
        if (!cancelled) setImages(d.images);
      }
      const boxes = params.inquiryId ? await fetchInspectionBoxes(params.inquiryId) : null;
      if (!cancelled) {
        setData(boxes);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.inquiryId]);

  // Arriving from "All Ok Go" (completed=1) → always the green completed banner.
  const b =
    params.completed === '1'
      ? {
          title: 'Order Completed',
          sub: 'This order has been completed. No further action needed.',
          color: GREEN,
          icon: 'checkmark-circle' as const,
        }
      : banner(params.status);
  const boxes = data?.boxes || [];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        {/* Order summary */}
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={styles.thumb}>
              {images[0] ? (
                <Image source={{ uri: images[0] }} style={styles.thumbImg} contentFit="cover" />
              ) : (
                <Ionicons name="cube-outline" size={20} color={MUTED} />
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
            <Ionicons name="cube-outline" size={16} color={ROYAL} style={{ marginLeft: 6 }} />
          </View>
        </View>

        {/* Status banner */}
        <View style={[styles.banner, { borderColor: b.color }]}>
          <Ionicons name={b.icon} size={24} color={b.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: b.color }]}>{b.title}</Text>
            <Text style={styles.bannerSub}>{b.sub}</Text>
          </View>
        </View>

        {/* Read-only boxes */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={CYAN} />
          </View>
        ) : boxes.length === 0 ? (
          <Text style={styles.empty}>No boxes registered.</Text>
        ) : (
          <>
            <Text style={styles.totalBoxes}>Total Boxes: {boxes.length}</Text>
            {boxes.map((box) => (
              <ReadOnlyBox key={box.id || box.boxNumber} box={box} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ReadOnlyBox({ box }: { box: InspectionBox }) {
  return (
    <View style={styles.boxRow}>
      <View style={styles.boxHeader}>
        <Text style={styles.boxLabel}>Box {box.boxNumber}</Text>
        <View style={styles.qtyPill}>
          <Text style={styles.qtyPillText}>Qty: {box.quantity}</Text>
        </View>
      </View>
      {box.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
          {box.photos.map((u, i) => (
            <Image key={i} source={{ uri: u }} style={styles.boxPhoto} contentFit="cover" />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  scroll: { paddingHorizontal: 16 },

  orderCard: { backgroundColor: CARD_BG, borderRadius: 12, padding: 12, marginTop: 4 },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1, marginLeft: 12 },
  orderNo: { color: TEXT, fontSize: 13, fontWeight: '600' },
  meta: { color: '#5B616A', fontSize: 12, marginTop: 2 },
  product: { color: '#5B616A', fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  qtyText: { color: TEXT, fontSize: 13, fontWeight: '600' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerSub: { color: MUTED, fontSize: 12, marginTop: 2 },

  center: { paddingVertical: 40, alignItems: 'center' },
  empty: { paddingVertical: 30, textAlign: 'center', color: MUTED, fontSize: 13 },
  totalBoxes: { color: TEXT, fontSize: 15, fontWeight: '700', marginTop: 20 },

  boxRow: { borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 16 },
  boxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxLabel: { color: TEXT, fontSize: 16, fontWeight: '700' },
  qtyPill: { backgroundColor: '#E8F3FB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  qtyPillText: { color: CYAN, fontSize: 12, fontWeight: '600' },
  photoStrip: { marginTop: 10 },
  boxPhoto: { width: 64, height: 64, borderRadius: 8, marginRight: 8, backgroundColor: CARD_BG },
});
