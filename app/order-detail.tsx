import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import QrScanner from '@/components/QrScanner';
import {
  getAssignmentDetails,
  getBoxByQr,
  getOrderInspection,
  InspectionBox,
  loadBoxStatus,
  OrderInspection,
  saveBoxStatus,
} from '@/services/orders';

const CYAN = '#159CDE';
const GREEN = '#22B14C';
const ROYAL = '#2F6BFF';
const TEXT = '#22262A';
const MUTED = '#8A9099';
const BORDER = '#E6E8EB';
const CARD_BG = '#F4F6F8';
const LIGHT_BLUE = '#E9F4FB';
const TILE_YELLOW = '#F7C948';
const TILE_GRAY = '#E4E7EB';

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    orderNo?: string;
    sampleNo?: string;
    product?: string;
    qty?: string;
    inquiryId?: string;
  }>();

  const [images, setImages] = useState<string[]>([]);
  const [inspection, setInspection] = useState<OrderInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(0);
  const [haveProblem, setHaveProblem] = useState(false);
  const [notes, setNotes] = useState('');

  // Per-box QR verification. A box is "Verified" once its Aaziko seal is scanned
  // and the decoded code matches a box registered for THIS order's inspection.
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Per-box data the DRIVER fills after verifying: loaded quantity + captured
  // photos/videos. A box must have a quantity AND a photo before the next box
  // can be scanned.
  const [qtyByBox, setQtyByBox] = useState<Record<string, string>>({});
  const [photosByBox, setPhotosByBox] = useState<Record<string, string[]>>({});
  const [videosByBox, setVideosByBox] = useState<Record<string, string[]>>({});
  // Decided randomly the first time a box is verified: only SOME boxes are asked
  // for the quantity + photo detail, not all of them.
  const [needsDetail, setNeedsDetail] = useState<Record<string, boolean>>({});
  // Final step: after Submit, the driver must take 4 loaded-truck photos before
  // "All Ok Go" completes the order.
  const [submitted, setSubmitted] = useState(false);
  const [truckPhotos, setTruckPhotos] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const TRUCK_PHOTOS_REQUIRED = 4;

  // Product images + the boxes the INSPECTION user registered for this order
  // (inspection-service, by the order's inquiry). Boxes/quantity come from here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // If this order was already completed on this device ("All Ok Go"), skip
      // the add-data page entirely and show the read-only completed page.
      const saved = params.inquiryId ? await loadBoxStatus(params.inquiryId) : null;
      if (cancelled) return;
      if (saved?.completed) {
        router.replace({
          pathname: '/order-completed',
          params: {
            id: params.id,
            orderNo: params.orderNo,
            sampleNo: params.sampleNo,
            product: params.product,
            qty: params.qty,
            inquiryId: params.inquiryId,
            completed: '1',
          },
        });
        return;
      }

      if (params.id) {
        const d = await getAssignmentDetails(params.id);
        if (!cancelled) setImages(d.images);
      }
      const insp = params.inquiryId ? await getOrderInspection(params.inquiryId) : null;
      if (cancelled) return;
      setInspection(insp);
      setQuantity(insp?.totalQuantity || 0);
      const bx = insp?.boxes || [];

      // Restore this order's saved progress (verified/done boxes) if the driver
      // has scanned it before; otherwise start fresh and pick the random subset
      // of boxes that will ask for detail (never all of them).
      if (saved) {
        setVerified(saved.verified || {});
        setNeedsDetail(saved.needsDetail || {});
        setQtyByBox(saved.qtyByBox || {});
        setPhotosByBox(saved.photosByBox || {});
        setVideosByBox(saved.videosByBox || {});
        setSubmitted(!!saved.submitted);
        setTruckPhotos(saved.truckPhotos || []);
      } else {
        const nd: Record<string, boolean> = {};
        bx.forEach((b) => {
          nd[boxKey(b)] = Math.random() < 0.5;
        });
        if (bx.length > 0 && bx.every((b) => nd[boxKey(b)])) {
          nd[boxKey(bx[bx.length - 1])] = false; // guarantee it's not ALL boxes
        }
        setNeedsDetail(nd);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.inquiryId]);

  // Persist the driver's per-box progress whenever it changes, so re-opening the
  // order shows the already-scanned/verified/done boxes.
  useEffect(() => {
    if (loading || !params.inquiryId) return;
    saveBoxStatus(params.inquiryId, {
      verified,
      needsDetail,
      qtyByBox,
      photosByBox,
      videosByBox,
      submitted,
      truckPhotos,
      completed,
    });
  }, [
    loading,
    params.inquiryId,
    verified,
    needsDetail,
    qtyByBox,
    photosByBox,
    videosByBox,
    submitted,
    truckPhotos,
    completed,
  ]);

  const boxes = inspection?.boxes || [];

  // Quantity for a box = whatever the driver typed (starts EMPTY — not taken
  // from the QR/inspection).
  const qtyOf = (b: InspectionBox) => qtyByBox[boxKey(b)] ?? '';

  // A verified box is "complete" if it wasn't asked for detail, or (if it was)
  // the driver entered the CORRECT quantity AND took at least one photo of it.
  const isBoxComplete = (b: InspectionBox) => {
    if (!needsDetail[boxKey(b)]) return true;
    const q = qtyOf(b).trim();
    return q !== '' && Number(q) === b.quantity && (photosByBox[boxKey(b)] || []).length > 0;
  };
  const firstIncompleteVerified = () =>
    boxes.find((b) => verified[boxKey(b)] && !isBoxComplete(b));

  const setQtyFor = (b: InspectionBox, v: string) =>
    setQtyByBox((m) => ({ ...m, [boxKey(b)]: v.replace(/[^0-9]/g, '') }));

  // Capture a photo/video of a box with the device camera.
  const captureFor = async (b: InspectionBox, kind: 'photo' | 'video') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to record this box.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      quality: 0.6,
      videoMaxDuration: 30,
    });
    if (res.canceled || !res.assets?.length) return;
    const uri = res.assets[0].uri;
    const k = boxKey(b);
    if (kind === 'video') setVideosByBox((m) => ({ ...m, [k]: [...(m[k] || []), uri] }));
    else setPhotosByBox((m) => ({ ...m, [k]: [...(m[k] || []), uri] }));
  };

  const openScanner = () => {
    // Block scanning the next box until the current verified box is finished
    // (CORRECT quantity + photo). A wrong quantity gets its own message.
    const inc = firstIncompleteVerified();
    if (inc) {
      const q = qtyOf(inc).trim();
      const wrongQty = q !== '' && Number(q) !== inc.quantity;
      Alert.alert(
        wrongQty ? 'Wrong quantity' : 'Finish this box first',
        wrongQty
          ? `The quantity you entered for Box ${inc.boxNumber} is not correct.`
          : `Add the quantity and take a photo for Box ${inc.boxNumber} before scanning the next box.`,
      );
      return;
    }
    setScanError(null);
    setScanPaused(false);
    setScannerOpen(true);
  };

  // Submit → require every box scanned & complete, then reveal the loaded-truck
  // photo step.
  const onSubmit = () => {
    const notDone = boxes.find((b) => !verified[boxKey(b)] || !isBoxComplete(b));
    if (notDone) {
      Alert.alert(
        'Finish all boxes',
        `Scan and complete Box ${notDone.boxNumber} before submitting.`,
      );
      return;
    }
    setSubmitted(true);
  };

  const captureTruckPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to photograph the loaded truck.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled || !res.assets?.length) return;
    setTruckPhotos((p) => [...p, res.assets[0].uri]);
  };

  // All Ok Go → needs the 4 truck photos, then the order is completed. Mark it
  // completed on the device so re-opening shows the read-only completed page.
  const onAllOk = () => {
    if (truckPhotos.length < TRUCK_PHOTOS_REQUIRED) {
      Alert.alert(
        `${TRUCK_PHOTOS_REQUIRED} photos required`,
        `Take ${TRUCK_PHOTOS_REQUIRED} photos of the loaded truck from different angles before finishing.`,
      );
      return;
    }
    setCompleted(true);
    if (params.inquiryId) {
      saveBoxStatus(params.inquiryId, {
        verified,
        needsDetail,
        qtyByBox,
        photosByBox,
        videosByBox,
        submitted,
        truckPhotos,
        completed: true,
      });
    }
    Alert.alert('Order completed', 'This order has been completed successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  // Scan one box at a time: the scanned QR is matched against this order's boxes.
  // On a match the scanner CLOSES (on OK) so the box shows its details (height +
  // quantity); the driver then taps another box's scan button to scan the next
  // one. A QR that isn't from this order pops "Not verified" and stays open.
  const handleScanned = async (raw: string) => {
    const code = (raw || '').trim().toUpperCase();
    if (!code) return;
    setScanPaused(true); // hold the camera while the result popup is up

    const match = boxes.find((b) => (b.qrCode || '').trim().toUpperCase() === code);
    if (match) {
      // Already verified → show only the box number, keep scanning the others.
      if (verified[boxKey(match)]) {
        Alert.alert('Already verified', `Box ${match.boxNumber} is already scanned and verified.`, [
          { text: 'OK', onPress: () => setScanPaused(false) },
        ]);
        return;
      }
      setVerified((v) => ({ ...v, [boxKey(match)]: true }));
      setScanError(null);
      const h = match.dimensions?.height;
      const unit = match.dimensions?.unit || 'cm';
      const heightStr = h != null && h !== 0 ? `${h} ${unit}` : '—';
      // The box detail is shown ONLY here, in the popup — just the height (no
      // quantity) — the box row itself only shows the green Verified badge.
      Alert.alert(
        `Box ${match.boxNumber} verified`,
        `Height: ${heightStr}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScannerOpen(false);
              setScanPaused(false);
            },
          },
        ],
      );
    } else {
      // Not one of THIS order's boxes. Ask the backend whether this seal is a
      // real box from ANOTHER order (→ "Failed to scan") or just invalid.
      const info = await getBoxByQr(code);
      if (info.found) {
        setScanError('This box is from another order.');
        Alert.alert(
          'Failed to scan',
          info.orderNumber
            ? `This box belongs to another order (${info.orderNumber}), not this one.`
            : 'This box belongs to another order, not this one.',
          [{ text: 'OK', onPress: () => setScanPaused(false) }],
        );
        return;
      }
      setScanError('This QR code is not from this order.');
      Alert.alert(
        'Not verified',
        'This QR code is not a valid box seal for this order. Tap OK and scan a box’s Aaziko seal.',
        [{ text: 'OK', onPress: () => setScanPaused(false) }],
      );
    }
  };

  const tiles: (string | null)[] = images.length
    ? Array.from({ length: 6 }, (_, i) => images[i] ?? null)
    : [];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>

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
            <View style={styles.orderInfo}>
              <Text style={styles.orderNo} numberOfLines={1}>
                Order No. {params.orderNo || '—'}
              </Text>
              <Text style={styles.orderMeta}>Sample No.: {params.sampleNo || '—'}</Text>
              <Text style={styles.orderProduct} numberOfLines={2}>
                {params.product || 'Order'}
              </Text>
            </View>
          </View>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyText}>Qty.: {params.qty || '—'}</Text>
            <Ionicons name="cube-outline" size={16} color={ROYAL} style={{ marginLeft: 6 }} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.headsetBtn}>
              <Ionicons name="headset-outline" size={16} color={CYAN} />
            </TouchableOpacity>
          </View>

          <View style={styles.tileRow}>
            {(tiles.length ? tiles : DECOR_TILES).map((t, i) => {
              const isImg = typeof t === 'string';
              const decor = !isImg ? (DECOR_TILES[i] as 'yellow' | 'gray') : null;
              return (
                <View
                  key={i}
                  style={[
                    styles.tile,
                    { backgroundColor: decor === 'yellow' ? TILE_YELLOW : TILE_GRAY },
                  ]}>
                  {isImg ? (
                    <Image source={{ uri: t as string }} style={styles.tileImg} contentFit="cover" />
                  ) : (
                    <Ionicons
                      name={decor === 'yellow' ? 'headset' : 'construct'}
                      size={16}
                      color={decor === 'yellow' ? '#3A2E00' : '#8A9099'}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Quantity slider — max = the inspection's total quantity */}
        <Text style={styles.sectionLabel}>Quantity:</Text>
        <QuantitySlider
          value={quantity}
          onChange={setQuantity}
          max={Math.max(1, inspection?.totalQuantity || 1)}
        />

        {/* Total boxes the inspector registered (shown once complete) */}
        {!loading && inspection?.done && boxes.length > 0 ? (
          <Text style={styles.totalBoxes}>Total Boxes: {boxes.length}</Text>
        ) : null}

        {/* Box checklist — only once the inspection is complete */}
        <View style={{ marginTop: 8 }}>
          {loading ? (
            <View style={styles.boxLoading}>
              <ActivityIndicator color={CYAN} />
            </View>
          ) : !inspection?.done ? (
            <Text style={styles.boxEmpty}>Inspection is not done yet.</Text>
          ) : boxes.length === 0 ? (
            <Text style={styles.boxEmpty}>No boxes registered for this order.</Text>
          ) : (
            boxes.map((b) => (
              <BoxRow
                key={boxKey(b)}
                box={b}
                verified={!!verified[boxKey(b)]}
                needsDetail={!!needsDetail[boxKey(b)]}
                onScan={openScanner}
                qty={qtyOf(b)}
                onQtyChange={(v) => setQtyFor(b, v)}
                photos={photosByBox[boxKey(b)] || []}
                videoCount={(videosByBox[boxKey(b)] || []).length}
                onTakePhoto={() => captureFor(b, 'photo')}
                onStartVideo={() => captureFor(b, 'video')}
              />
            ))
          )}
        </View>

        {/* One Scan-QR button (bottom-right) — always available to scan the next
            box or re-check a done one; a done box scan pops "Already verified". */}
        {!loading && inspection?.done && boxes.length > 0 && !submitted ? (
          <View style={styles.scanQrRow}>
            <TouchableOpacity style={styles.scanQrBtn} onPress={openScanner} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={16} color="#fff" />
              <Text style={styles.scanQrText}>Scan QR</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Have Problem */}
        <TouchableOpacity
          style={styles.problemRow}
          onPress={() => setHaveProblem((v) => !v)}
          activeOpacity={0.8}>
          <Ionicons
            name={haveProblem ? 'checkbox' : 'square-outline'}
            size={22}
            color={haveProblem ? CYAN : MUTED}
          />
          <Text style={styles.problemText}>Have Problem?</Text>
        </TouchableOpacity>

        <Text style={styles.notesLabel}>Notes:</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notes}
          placeholder=""
        />

        {!submitted ? (
          /* Submit → reveals the loaded-truck photo step */
          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.9} onPress={onSubmit}>
            <Text style={styles.submitText}>Submit for Confirmation</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              Loaded Truck Photos ({truckPhotos.length}/{TRUCK_PHOTOS_REQUIRED})
            </Text>
            <View style={styles.loadedRow}>
              <TouchableOpacity style={styles.loadedBtn} onPress={captureTruckPhoto} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={16} color={CYAN} />
                <Text style={styles.loadedText}>Loaded Truck — Take Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headsetBtn}>
                <Ionicons name="headset-outline" size={16} color={CYAN} />
              </TouchableOpacity>
            </View>

            {truckPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {truckPhotos.map((u, i) => (
                  <Image key={i} source={{ uri: u }} style={styles.boxPhoto} contentFit="cover" />
                ))}
              </ScrollView>
            ) : null}

            {truckPhotos.length < TRUCK_PHOTOS_REQUIRED ? (
              <Text style={styles.boxHint}>
                Take {TRUCK_PHOTOS_REQUIRED} photos of the loaded truck from different angles.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.allOkBtn,
                truckPhotos.length >= TRUCK_PHOTOS_REQUIRED && styles.allOkBtnActive,
              ]}
              onPress={onAllOk}
              disabled={truckPhotos.length < TRUCK_PHOTOS_REQUIRED}
              activeOpacity={0.9}>
              <Text style={styles.allOkText}>All Ok Go</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <QrScanner
        visible={scannerOpen}
        paused={scanPaused}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
        hint={`${boxes.filter((b) => verified[boxKey(b)]).length} of ${boxes.length} boxes verified — scan a box QR seal`}
        errorText={scanError}
      />
    </View>
  );
}

// Stable key for a box (its inspection id, else the box number).
const boxKey = (b: InspectionBox) => b.id || String(b.boxNumber);

const DECOR_TILES: ('yellow' | 'gray')[] = ['yellow', 'gray', 'yellow', 'gray', 'yellow', 'gray'];

/* ------------------------------------------------------------------ */
/* Box row                                                             */
/* ------------------------------------------------------------------ */

function BoxRow({
  box,
  verified,
  needsDetail,
  onScan,
  qty,
  onQtyChange,
  photos,
  videoCount,
  onTakePhoto,
  onStartVideo,
}: {
  box: InspectionBox;
  verified: boolean;
  needsDetail: boolean;
  onScan: () => void;
  qty: string;
  onQtyChange: (v: string) => void;
  photos: string[];
  videoCount: number;
  onTakePhoto: () => void;
  onStartVideo: () => void;
}) {
  // Boxes not asked for detail are Done as soon as they verify.
  const qtyWrong = qty.trim() !== '' && Number(qty) !== box.quantity;
  const complete = !needsDetail || (Number(qty) === box.quantity && photos.length > 0);
  return (
    <View style={styles.boxRow}>
      <View style={styles.boxHeader}>
        <Text style={styles.boxLabel}>Box {box.boxNumber}</Text>
        {verified ? (
          <View style={[styles.verifiedBadge, complete && styles.doneBadge]}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={styles.verifiedText}>{complete ? 'Done' : 'Verified'}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={onScan}
            accessibilityLabel={`Scan Box ${box.boxNumber} QR seal`}>
            <Ionicons name="qr-code-outline" size={20} color={CYAN} />
          </TouchableOpacity>
        )}
      </View>

      {/* Only boxes chosen for detail ask for quantity + a photo. */}
      {verified && needsDetail && (
        <View style={styles.boxBody}>
          <View style={styles.mediaBtns}>
            <PillBtn icon="videocam-outline" label="Start Video" onPress={onStartVideo} />
            <PillBtn icon="camera-outline" label="Take Photos" onPress={onTakePhoto} />
          </View>

          {photos.length > 0 || videoCount > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {photos.map((u, i) => (
                <Image key={`p${i}`} source={{ uri: u }} style={styles.boxPhoto} contentFit="cover" />
              ))}
              {Array.from({ length: videoCount }).map((_, i) => (
                <View key={`v${i}`} style={[styles.boxPhoto, styles.videoTile]}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.addQtyLabel}>Add Quantity</Text>
          <TextInput
            value={qty}
            onChangeText={onQtyChange}
            keyboardType="number-pad"
            style={[styles.addQtyInput, qtyWrong && styles.addQtyInputError]}
            placeholder="Enter quantity"
            placeholderTextColor={MUTED}
            onEndEditing={() => {
              if (qtyWrong) {
                Alert.alert(
                  'Wrong quantity',
                  `The quantity you entered for Box ${box.boxNumber} is not correct.`,
                );
              }
            }}
          />
          {qtyWrong ? (
            <Text style={styles.boxError}>This quantity is not correct.</Text>
          ) : !complete ? (
            <Text style={styles.boxHint}>
              Add the quantity and take a photo of this box before scanning the next one.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function PillBtn({ icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} disabled={!onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={14} color={CYAN} />
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* Custom quantity slider with a value bubble on the thumb             */
/* ------------------------------------------------------------------ */

function QuantitySlider({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  const [w, setW] = useState(1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const wRef = useRef(1);
  wRef.current = w;

  const respond = (x: number) => {
    const width = wRef.current;
    if (width <= 0) return;
    const r = Math.max(0, Math.min(1, x / width));
    onChangeRef.current(Math.round(r * max));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => respond(e.nativeEvent.locationX),
      onPanResponderMove: (e) => respond(e.nativeEvent.locationX),
    }),
  ).current;

  const pct = Math.max(0, Math.min(1, value / max));
  const BUBBLE_W = 34;
  const bubbleLeft = Math.max(0, Math.min(w - BUBBLE_W, pct * w - BUBBLE_W / 2));

  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}>
      <View style={styles.sliderTrack} />
      <View style={[styles.sliderFill, { width: pct * w }]} />
      <View style={[styles.sliderBubble, { left: bubbleLeft }]}>
        <Text style={styles.sliderBubbleText}>{value}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 16 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },

  // order card
  orderCard: { backgroundColor: CARD_BG, borderRadius: 12, padding: 12 },
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
  orderInfo: { flex: 1, marginLeft: 12 },
  orderNo: { color: TEXT, fontSize: 13, fontWeight: '600' },
  orderMeta: { color: '#5B616A', fontSize: 12, marginTop: 2 },
  orderProduct: { color: '#5B616A', fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  qtyText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  headsetBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tileRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },

  // slider
  sectionLabel: { color: TEXT, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 6 },
  totalBoxes: { color: TEXT, fontSize: 15, fontWeight: '700', marginTop: 18 },
  sliderHit: { height: 44, justifyContent: 'center', marginBottom: 4 },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: '#E4E7EB' },
  sliderFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: CYAN },
  sliderBubble: {
    position: 'absolute',
    top: 4,
    width: 34,
    height: 22,
    borderRadius: 6,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBubbleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // box rows
  boxLoading: { paddingVertical: 40, alignItems: 'center' },
  boxEmpty: { paddingVertical: 30, textAlign: 'center', color: MUTED, fontSize: 13 },
  boxRow: { borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 18 },
  boxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxLabel: { color: TEXT, fontSize: 16, fontWeight: '700' },
  scanBtn: {
    width: 44,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F7EE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  verifiedText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  doneBadge: { backgroundColor: '#DFF5E6' },
  boxBody: { marginTop: 12 },
  photoStrip: { marginTop: 12 },
  boxPhoto: { width: 64, height: 64, borderRadius: 8, marginRight: 8, backgroundColor: CARD_BG },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A3F45' },
  boxHint: { color: '#C77700', fontSize: 12, marginTop: 10 },
  scanQrRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CYAN,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  scanQrText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boxError: { color: '#D64545', fontSize: 12, fontWeight: '600', marginTop: 8 },
  addQtyInputError: { borderColor: '#D64545' },
  mediaBtns: { flexDirection: 'row', gap: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT_BLUE,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: CYAN, fontSize: 13, fontWeight: '600' },
  addQtyLabel: { color: MUTED, fontSize: 13, marginTop: 12 },
  addQtyInput: {
    marginTop: 6,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
    backgroundColor: '#fff',
  },

  // have problem
  problemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  problemText: { color: TEXT, fontSize: 16, fontWeight: '600' },
  notesLabel: { color: MUTED, fontSize: 13, marginTop: 14 },
  notes: {
    marginTop: 6,
    minHeight: 70,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: TEXT,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  // footer buttons
  submitBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 8,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  loadedBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: CYAN,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadedText: { color: CYAN, fontSize: 13, fontWeight: '600' },
  allOkBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#C4C4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allOkBtnActive: { backgroundColor: GREEN },
  allOkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
