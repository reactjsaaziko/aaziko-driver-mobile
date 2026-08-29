import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadCalc3D from '@/components/LoadCalc3D';
import { clearSession } from '@/services/auth';
import {
  calculateLoad,
  loadCargoTypeDefaults,
  LoadResult,
  productFromOrder,
} from '@/services/loadCalc';
import {
  getAssignmentImages,
  getMyAssignments,
  isOrderDone,
  parseAssignment,
  ParsedOrder,
  verifyOtp,
} from '@/services/orders';

const HEADER_BLUE = '#159CDE';
const CYAN = '#159CDE';
const ROYAL = '#2F6BFF';
const GREEN = '#2FB24C';
const TEXT = '#22262A';
const MUTED = '#8A9099';
const BORDER = '#E6E8EB';
const CARD_BG = '#F4F6F8';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSignedIn, setNotSignedIn] = useState(false);

  const [load, setLoad] = useState<LoadResult | null>(null);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRetry, setLoadRetry] = useState(0);

  const fetchOrders = useCallback(async () => {
    setError(null);
    setNotSignedIn(false);
    const r = await getMyAssignments();
    if (r.ok) {
      setOrders(r.data.map(parseAssignment));
    } else {
      setOrders([]);
      if (r.code === 401) setNotSignedIn(true);
      setError(r.error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCargoTypeDefaults();
      await fetchOrders();
      setLoading(false);
    })();
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  // Load summary = the driver's orders combined, via the real Load Calculator.
  // If the combined request fails, fall back to just the first order so the
  // card still shows real data instead of an endless spinner.
  useEffect(() => {
    if (orders.length === 0) {
      setLoad(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadLoading(true);
      setLoadError(null);
      const products = orders.map((o) => productFromOrder(o.product, o.quantityNum));
      let r = await calculateLoad(products);
      if (!r.ok && orders.length > 1) {
        // retry with a single order — smaller, safer request
        r = await calculateLoad([productFromOrder(orders[0].product, orders[0].quantityNum)]);
      }
      if (cancelled) return;
      if (r.ok) {
        setLoad(r.data);
        setLoadError(null);
      } else {
        setLoad(null);
        setLoadError(r.error);
      }
      setLoadLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orders, loadRetry]);

  const retryLoad = useCallback(() => setLoadRetry((n) => n + 1), []);

  // Clear the persisted session and return to login. Confirm first so a stray
  // tap on the header doesn't sign the driver out mid-run.
  const doLogout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const onLogout = useCallback(() => {
    if (Platform.OS === 'web') {
      const ok = typeof window === 'undefined' || window.confirm('Log out of your account?');
      if (ok) doLogout();
      return;
    }
    Alert.alert('Log out', 'Log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: doLogout },
    ]);
  }, [doLogout]);

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <View style={[styles.headerBar, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          hitSlop={10}
          accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={17} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={CYAN} size="large" />
          <Text style={styles.centerText}>Loading your orders…</Text>
        </View>
      ) : notSignedIn ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={MUTED} />
          <Text style={styles.centerText}>{error || 'Please log in to see your orders.'}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.primaryBtnText}>Go to login</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={MUTED} />
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onRefresh}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Ionicons name="cube-outline" size={40} color={MUTED} />
          <Text style={styles.centerText}>No transportation orders yet.</Text>
          <Text style={styles.centerSub}>Pull down to refresh.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <LoadSummaryCard load={load} loading={loadLoading} error={loadError} onRetry={retryLoad} />
          <BreakdownCard load={load} loading={loadLoading} error={loadError} />
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onVerified={fetchOrders} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Load summary card                                                   */
/* ------------------------------------------------------------------ */

function LoadSummaryCard({
  load,
  loading,
  error,
  onRetry,
}: {
  load: LoadResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [show3d, setShow3d] = useState(false);
  const title = load ? load.containerName : 'Container load';

  return (
    <View style={styles.card}>
      <View style={styles.summaryHead}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <View style={styles.summaryHeadRight}>
          <Text style={styles.unitsText}>{load ? `${load.containersCount} units` : '—'}</Text>
          <TouchableOpacity style={styles.viewBtn} onPress={() => setShow3d(true)} disabled={!load}>
            <Text style={styles.viewBtnText}>3 view</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryBody}>
        <View style={styles.containerBox}>
          {load ? (
            <LoadCalc3D
              cargoItems={load.cargo}
              containerSize={load.containerSizeKey}
              chrome={false}
              style={styles.viewer}
            />
          ) : error && !loading ? (
            <TouchableOpacity style={styles.viewerLoading} onPress={onRetry}>
              <Ionicons name="refresh" size={22} color={CYAN} />
              <Text style={styles.viewerRetry}>Retry</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.viewerLoading}>
              <ActivityIndicator color={CYAN} />
            </View>
          )}
        </View>

        <View style={styles.summaryStats}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{load ? `${load.totalPackages} packages` : loading ? '…' : '—'}</Text>

          <Text style={[styles.statLabel, styles.statSpacer]}>Cargo Volume</Text>
          <Text style={styles.statValue}>
            {load ? (
              <>
                {load.totalVolumeM3.toFixed(2)} m3{' '}
                <Text style={styles.statMuted}>({load.volumeUtilizationPct}% of volume)</Text>
              </>
            ) : (
              '—'
            )}
          </Text>

          <Text style={[styles.statLabel, styles.statSpacer]}>Cargo Weight</Text>
          <Text style={styles.statValue}>
            {load ? (
              <>
                {load.totalWeightKg.toFixed(2)} kg{' '}
                <Text style={styles.statMuted}>({load.weightUtilizationPct}% of max weight)</Text>
              </>
            ) : (
              '—'
            )}
          </Text>

          {!load && error && !loading ? (
            <Text style={styles.loadErrorText} numberOfLines={2}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>

      {load && (
        <Modal visible={show3d} animationType="slide" onRequestClose={() => setShow3d(false)}>
          <Container3DModal title={title} load={load} onClose={() => setShow3d(false)} />
        </Modal>
      )}
    </View>
  );
}

function Container3DModal({
  title,
  load,
  onClose,
}: {
  title: string;
  load: LoadResult;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.modalRoot}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close 3D view">
          <Ionicons name="close" size={26} color={TEXT} />
        </TouchableOpacity>
      </View>
      <LoadCalc3D cargoItems={load.cargo} containerSize={load.containerSizeKey} style={styles.modalViewer} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Donut breakdown card                                                */
/* ------------------------------------------------------------------ */

function BreakdownCard({
  load,
  loading,
  error,
}: {
  load: LoadResult | null;
  loading: boolean;
  error: string | null;
}) {
  const segments = useMemo(
    () => (load ? load.cargo.map((c) => ({ value: c.volume, color: c.color })) : []),
    [load],
  );

  if (!load) {
    return (
      <View style={styles.card}>
        <View style={styles.breakdownEmpty}>
          {loading ? (
            <ActivityIndicator color={CYAN} />
          ) : (
            <Text style={styles.centerSub}>{error || 'No breakdown.'}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.breakdownBody}>
        <View style={styles.donutBox}>
          <Donut segments={segments} />
        </View>

        <View style={styles.legend}>
          <View style={styles.legendHeadRow}>
            <Text style={styles.legendHead}>Name</Text>
            <Text style={styles.legendHead}>Volume</Text>
          </View>
          {load.cargo.map((c) => (
            <View key={`v-${c.name}`} style={styles.legendRow}>
              <View style={styles.legendNameCol}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.legendName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
              <Text style={styles.legendValue}>{c.volume.toFixed(2)} M3</Text>
            </View>
          ))}

          <View style={[styles.legendHeadRow, styles.legendHeadSpacer]}>
            <Text style={styles.legendHead}>Packages</Text>
            <Text style={styles.legendHead}>Weight</Text>
          </View>
          {load.cargo.map((c) => (
            <View key={`p-${c.name}`} style={styles.legendRow}>
              <View style={styles.legendNameCol}>
                <Ionicons
                  name={c.cargoType === 'box' ? 'cube-outline' : 'bag-outline'}
                  size={18}
                  color={MUTED}
                />
                <Text style={styles.legendName}>{c.packages}</Text>
              </View>
              <Text style={styles.legendValue}>{(c.weight ?? 0).toFixed(2)} Kg</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Pure-View donut: base disc (first/largest segment) + the remaining segments
// as one wedge, then a white hole. Exact for 1–2 segments (the common case:
// one product per order); an approximation for 3+.
const DN_D = 108;
const DN_HOLE = 60;

function RightSemi({ color, rotate = 0 }: { color: string; rotate?: number }) {
  return (
    <View style={[styles.dnLayer, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={styles.dnClip}>
        <View style={[styles.dnHalfDisc, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Donut({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const base = segments[0]?.color || ROYAL;
  const rest = segments.slice(1);
  const restValue = rest.reduce((s, x) => s + x.value, 0);
  const wedgeColor = rest[0]?.color || GREEN;
  const wedgeAngle = Math.min(359.9, (restValue / total) * 360);
  const startAngle = 108;

  return (
    <View style={styles.dnRoot}>
      <View style={[styles.dnDisc, { backgroundColor: base }]} />
      {wedgeAngle > 0.5 && (
        <View style={[styles.dnLayer, { transform: [{ rotate: `${startAngle}deg` }] }]}>
          <RightSemi color={wedgeColor} />
          <RightSemi color={base} rotate={wedgeAngle} />
        </View>
      )}
      <View style={styles.dnHole} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Order card with real OTP verify                                     */
/* ------------------------------------------------------------------ */

const THUMBS: ('yellow' | 'gray')[] = ['yellow', 'gray', 'yellow', 'gray', 'yellow', 'gray'];

function OrderCard({ order, onVerified }: { order: ParsedOrder; onVerified: () => void }) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [verified, setVerified] = useState(order.verified);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);

  const orderParams = {
    id: order.id,
    orderNo: order.orderNo,
    sampleNo: order.sampleNo || '',
    product: order.product,
    qty: order.quantity,
    inquiryId: order.inquiryId || '',
    status: order.status,
  };
  const openDirections = () => router.push({ pathname: '/order-map', params: orderParams });
  // Already-completed orders open the read-only Completed page; active ones the
  // loading/inspection page.
  const openDetail = () =>
    isOrderDone(order.status)
      ? router.push({ pathname: '/order-completed', params: orderParams })
      : router.push({ pathname: '/order-detail', params: orderParams });

  useEffect(() => {
    let cancelled = false;
    getAssignmentImages(order.id).then((imgs) => {
      if (!cancelled) setFetchedImages(imgs);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const images = fetchedImages.length ? fetchedImages : order.images;
  const mainImage = images[0];

  const onVerify = async () => {
    if (submitting || verified) return;
    if (!otp.trim()) {
      setError('Enter the OTP.');
      return;
    }
    setSubmitting(true);
    setError('');
    const r = await verifyOtp(order.id, otp.trim(), order.leg);
    setSubmitting(false);
    if (r.ok) {
      setVerified(true);
      setOtp('');
      onVerified();
    } else {
      setError(r.error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.orderCard}
      activeOpacity={0.92}
      onPress={openDetail}
      accessibilityLabel="Open order details">
      <View style={styles.orderTop}>
        <View style={styles.orderThumb}>
          {mainImage ? (
            <Image source={{ uri: mainImage }} style={styles.orderThumbImg} contentFit="cover" />
          ) : (
            <Ionicons name="construct-outline" size={22} color={MUTED} />
          )}
        </View>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNo} numberOfLines={1}>
            Order No. {order.orderNo}
          </Text>
          <Text style={styles.orderMeta}>Sample No.: {order.sampleNo || '—'}</Text>
          <Text style={styles.orderProduct} numberOfLines={2}>
            {order.product}
          </Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={openDirections} accessibilityLabel="Directions">
          <Ionicons name="navigate" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyText}>Qty.: {order.quantity}</Text>
        <Ionicons name="cube-outline" size={16} color={ROYAL} style={{ marginLeft: 6 }} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.callBtn}>
          <Ionicons name="call-outline" size={15} color={CYAN} />
          <Text style={styles.callText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Support">
          <Ionicons name="headset-outline" size={16} color={CYAN} />
        </TouchableOpacity>
      </View>

      <View style={styles.thumbRow}>
        {images.length > 0
          ? Array.from({ length: 6 }, (_, i) => images[i]).map((url, i) => (
              <View key={i} style={[styles.smallThumb, { backgroundColor: '#E4E7EB' }]}>
                {url ? (
                  <Image source={{ uri: url }} style={styles.smallThumbImg} contentFit="cover" />
                ) : null}
              </View>
            ))
          : THUMBS.map((t, i) => (
              <View
                key={i}
                style={[styles.smallThumb, { backgroundColor: t === 'yellow' ? '#F7C948' : '#E4E7EB' }]}>
                <Ionicons
                  name={t === 'yellow' ? 'headset' : 'construct'}
                  size={18}
                  color={t === 'yellow' ? '#3A2E00' : '#8A9099'}
                />
              </View>
            ))}
      </View>

      <TouchableOpacity onPress={openDetail}>
        <Text style={styles.moreDetails}>More Details</Text>
      </TouchableOpacity>

      {!verified && (
        <View style={styles.otpRow}>
          <TextInput
            value={otp}
            onChangeText={(t) => {
              setOtp(t);
              setError('');
            }}
            placeholder="Enter otp"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            editable={!submitting}
            style={styles.otpInput}
          />
          <TouchableOpacity
            style={[styles.otpSend, submitting && { opacity: 0.6 }]}
            onPress={onVerify}
            disabled={submitting}
            accessibilityLabel="Submit OTP">
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.otpFootRow}>
        {verified ? (
          <Text style={styles.verifiedText}>OTP submitted ✓</Text>
        ) : error ? (
          <Text style={styles.otpError}>{error}</Text>
        ) : (
          <TouchableOpacity>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity accessibilityLabel="Documents">
          <Ionicons name="document-text-outline" size={18} color={MUTED} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBar: {
    backgroundColor: HEADER_BLUE,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 32 },

  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerText: { color: TEXT, fontSize: 15, textAlign: 'center' },
  centerSub: { color: MUTED, fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: CYAN,
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },

  // summary
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: TEXT, flex: 1, paddingRight: 8 },
  summaryHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitsText: { color: CYAN, fontSize: 14, fontWeight: '600' },
  viewBtn: { borderWidth: 1, borderColor: CYAN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  viewBtnText: { color: CYAN, fontSize: 13, fontWeight: '600' },
  summaryBody: { flexDirection: 'row', marginTop: 18, gap: 16 },
  containerBox: {
    width: 158,
    height: 132,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f6f8',
  },
  viewer: { flex: 1, backgroundColor: 'transparent' },
  viewerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  viewerRetry: { color: CYAN, fontSize: 12, fontWeight: '600' },
  loadErrorText: { color: '#D64545', fontSize: 12, marginTop: 12 },
  summaryStats: { flex: 1, justifyContent: 'center' },
  statLabel: { color: TEXT, fontSize: 14, fontWeight: '700' },
  statValue: { color: MUTED, fontSize: 14, marginTop: 2 },
  statMuted: { color: MUTED, fontSize: 13 },
  statSpacer: { marginTop: 14 },

  // breakdown
  breakdownBody: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  breakdownEmpty: { height: 120, alignItems: 'center', justifyContent: 'center' },
  donutBox: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },

  // fullscreen 3D modal
  modalRoot: { flex: 1, backgroundColor: '#f5f6f8' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  modalViewer: { flex: 1, backgroundColor: '#f5f6f8' },

  // donut (pure views)
  dnRoot: { width: DN_D, height: DN_D },
  dnDisc: { position: 'absolute', width: DN_D, height: DN_D, borderRadius: DN_D / 2 },
  dnLayer: { position: 'absolute', width: DN_D, height: DN_D },
  dnClip: { position: 'absolute', left: DN_D / 2, width: DN_D / 2, height: DN_D, overflow: 'hidden' },
  dnHalfDisc: {
    position: 'absolute',
    left: -DN_D / 2,
    top: 0,
    width: DN_D,
    height: DN_D,
    borderRadius: DN_D / 2,
  },
  dnHole: {
    position: 'absolute',
    top: (DN_D - DN_HOLE) / 2,
    left: (DN_D - DN_HOLE) / 2,
    width: DN_HOLE,
    height: DN_HOLE,
    borderRadius: DN_HOLE / 2,
    backgroundColor: '#fff',
  },
  legend: { flex: 1 },
  legendHeadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendHeadSpacer: { marginTop: 16 },
  legendHead: { color: MUTED, fontSize: 13 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  legendNameCol: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendName: { color: TEXT, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  legendValue: { color: TEXT, fontSize: 14 },

  // order card
  orderCard: { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 16 },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start' },
  orderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderThumbImg: { width: '100%', height: '100%' },
  orderInfo: { flex: 1, marginLeft: 12, paddingRight: 8 },
  orderNo: { color: TEXT, fontSize: 13, fontWeight: '600' },
  orderMeta: { color: '#5B616A', fontSize: 13, marginTop: 2 },
  orderProduct: { color: '#5B616A', fontSize: 13, marginTop: 2 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  qtyText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CYAN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  callText: { color: CYAN, fontSize: 13, fontWeight: '600' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: '#fff',
  },
  thumbRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallThumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  smallThumbImg: { width: '100%', height: '100%' },
  moreDetails: {
    color: CYAN,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 12,
  },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  otpInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
    backgroundColor: '#fff',
  },
  otpSend: { width: 44, height: 44, borderRadius: 8, backgroundColor: ROYAL, alignItems: 'center', justifyContent: 'center' },
  otpFootRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  resendText: { color: CYAN, fontSize: 13, fontWeight: '600' },
  otpError: { color: '#D64545', fontSize: 13, fontWeight: '500', flex: 1 },
  verifiedText: { color: GREEN, fontSize: 13, fontWeight: '600' },
});
