import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '@/constants/api';
import { session } from '@/services/auth';

// A driver's Domestic-Transportation jobs are service-provider **work
// assignments** — the same endpoint the transportation app's TripManagement
// screen uses (getMyWorkAssignments, serviceType "Domestic Transportation").
// Handover is proven with the pickup/delivery OTP on each assignment.

export interface Assignment {
  _id: string;
  assignmentId?: string;
  title?: string;
  description?: string;
  status?: string;
  serviceType?: string;
  dueDate?: string;
  priority?: string;
  referenceImages?: { url: string; caption?: string }[];
  shipping?: {
    legRole?: string;
    pickupOtp?: string;
    deliveryOtp?: string;
    pickupVerifiedAt?: string;
    deliveryVerifiedAt?: string;
  };
  location?: { address?: string; city?: string; state?: string; country?: string };
  compensation?: { currency?: string; amount?: number };
  requesterInfo?: { orderId?: string; orderNumber?: string; inquiryId?: string; source?: string };
  [k: string]: unknown;
}

export interface ParsedOrder {
  id: string;
  orderNo: string;
  sampleNo?: string;
  product: string;
  quantity: string;
  quantityNum: number;
  status: string;
  images: string[]; // product photos from the assignment's referenceImages
  inquiryId?: string;
  leg: 'pickup' | 'delivery';
  verified: boolean;
}

// A box the inspection user registered while inspecting this order.
export interface InspectionBox {
  boxNumber: number;
  quantity: number;
  dimensions?: { length?: number; width?: number; height?: number; unit?: string };
  weight?: { value?: number; unit?: string };
  qrCode?: string | null;
  photos: string[];
  id?: string;
}
export interface OrderInspection {
  done: boolean; // is the order's inspection complete (report submitted)?
  boxes: InspectionBox[];
  totalQuantity: number;
  sampleNumber?: string;
  labTest?: string;
  orderDate?: string;
}

// MinIO internal hosts aren't reachable from a device — rewrite to the public host.
export function normalizeMediaUrl(u?: string): string | undefined {
  if (!u) return undefined;
  return u.replace(/^https?:\/\/(localhost|minio|127\.0\.0\.1):9000/i, 'https://api.aaziko.com');
}

function spId(): string | null {
  const u = (session.user || {}) as Record<string, unknown>;
  return (u.serviceProviderId as string) || (u.id as string) || (u._id as string) || null;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (session.accessToken) h.Authorization = `Bearer ${session.accessToken}`;
  return h;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: number };

export async function getMyAssignments(): Promise<Result<Assignment[]>> {
  const id = spId();
  if (!id) return { ok: false, error: 'You are not signed in.', code: 401 };
  try {
    const url =
      `${API_BASE_URL}/service-provider/work/service-providers/${id}/assignments` +
      `?serviceType=${encodeURIComponent('Domestic Transportation')}`;
    const res = await fetch(url, { headers: authHeaders() });
    const body: any = await res.json().catch(() => null);
    if (res.ok) {
      const list: Assignment[] = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : [];
      return { ok: true, data: list };
    }
    if (res.status === 401) return { ok: false, error: 'Session expired — please log in again.', code: 401 };
    return { ok: false, error: body?.message || `Couldn't load orders (HTTP ${res.status}).`, code: res.status };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.' };
  }
}

// Assignment descriptions carry the order details as "Label: value" lines
// (Order / Product / Quantity / …). Pull a field out of that block.
function fromDescription(desc: string, label: string): string | undefined {
  const lines = (desc || '').split('\n');
  for (const line of lines) {
    const m = line.match(new RegExp('^\\s*' + label + '\\s*:\\s*(.+)$', 'i'));
    if (m) return m[1].trim();
  }
  return undefined;
}

export function parseAssignment(a: Assignment): ParsedOrder {
  const desc = a.description || '';
  const orderNo = fromDescription(desc, 'Order') || a.assignmentId || a._id;
  const product = fromDescription(desc, 'Product') || a.title || 'Order';
  const sampleNo = fromDescription(desc, 'Sample') || fromDescription(desc, 'Sample No');
  const qtyStr = fromDescription(desc, 'Quantity') || '';
  const quantityNum = parseInt((qtyStr.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, ''), 10) || 0;
  const leg: 'pickup' | 'delivery' =
    a.shipping?.legRole === 'destination_transport' ? 'delivery' : 'pickup';
  const verified =
    leg === 'delivery' ? !!a.shipping?.deliveryVerifiedAt : !!a.shipping?.pickupVerifiedAt;
  // Product photos are the assignment's referenceImages — the channel the
  // provider app is designed to read (workAssignmentController fills it from
  // the requester's product photo). NB: shipping-broadcast transportation jobs
  // currently ship these EMPTY, so there is no product image to show until the
  // broadcast attaches one; the inquiry/order that holds the real photo is
  // gated to buyer/vendor/admin (a service provider gets 403).
  const images = (Array.isArray(a.referenceImages) ? a.referenceImages : [])
    .map((r) => normalizeMediaUrl(r?.url))
    .filter((u): u is string => !!u);
  const inquiryId =
    a.requesterInfo?.inquiryId || (desc.match(/Inquiry:.*?\(id\s+([a-f0-9]{24})\)/i) || [])[1];
  return {
    id: a._id,
    orderNo,
    sampleNo,
    product,
    quantity: qtyStr || '-',
    quantityNum,
    status: a.status || '-',
    images,
    inquiryId,
    leg,
    verified,
  };
}

// Is this order's INSPECTION complete? The inspector's boxes exist even while
// the inspection is still in progress, so we only trust them once the Inspection
// work assignment has reached a "report submitted / done" status.
const INSPECTION_DONE_STATUSES = new Set([
  'pending_review',
  'submitted',
  'reviewed',
  'completed',
  'approved',
]);
const INSPECTION_PENDING_STATUSES = new Set([
  'pending',
  'assigned',
  'in_progress',
  'acknowledged',
  'overdue',
]);
// Complete = the order has at least one submitted/completed inspection AND none
// of its inspections are still pending/in-progress. An order with a second
// inspection still open counts as NOT complete (so its boxes stay hidden).
async function isInspectionDone(inquiryId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/service-provider/work/assignments/by-inquiry/${inquiryId}`,
      { headers: authHeaders() },
    );
    const body: any = await res.json().catch(() => null);
    const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const inspections = list.filter((a) => a?.serviceType === 'Inspection');
    if (inspections.length === 0) return false;
    const anyDone = inspections.some((a) => INSPECTION_DONE_STATUSES.has(a?.status));
    const anyPending = inspections.some((a) => INSPECTION_PENDING_STATUSES.has(a?.status));
    return anyDone && !anyPending;
  } catch {
    return false;
  }
}

// Fetch the inspector's boxes for an inquiry (NO completion gate). Used by the
// read-only Completed page (the order is already done, so show its boxes).
// GET /inspection-service/order-inspections/by-inquiry/:inquiryId → data[0].inspectionData.boxes
export async function fetchInspectionBoxes(
  inquiryId: string,
): Promise<Omit<OrderInspection, 'done'>> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/inspection-service/order-inspections/by-inquiry/${inquiryId}`,
      { headers: authHeaders() },
    );
    const body: any = await res.json().catch(() => null);
    const rec = Array.isArray(body?.data) ? body.data[0] : body?.data || null;
    if (!rec) return { boxes: [], totalQuantity: 0 };
    const raw = Array.isArray(rec?.inspectionData?.boxes) ? rec.inspectionData.boxes : [];
    const boxes: InspectionBox[] = raw.map((b: any, i: number) => ({
      boxNumber: Number(b?.boxNumber) || i + 1,
      quantity: Number(b?.quantity) || 0,
      dimensions: b?.dimensions,
      weight: b?.weight,
      qrCode: b?.qrCode?.code || null,
      photos: Array.isArray(b?.media?.photos)
        ? b.media.photos.map((p: any) => normalizeMediaUrl(p?.url)).filter((u: any): u is string => !!u)
        : [],
      id: b?._id,
    }));
    return {
      boxes,
      totalQuantity: boxes.reduce((s, b) => s + b.quantity, 0),
      sampleNumber: rec.sampleNumber,
      labTest: rec.labTest,
      orderDate: rec.orderDate,
    };
  } catch {
    return { boxes: [], totalQuantity: 0 };
  }
}

// The driver's per-box progress for one order, persisted on the device so that
// re-opening the order restores which boxes are already scanned/verified/done.
export interface BoxStatus {
  verified: Record<string, boolean>;
  needsDetail: Record<string, boolean>;
  qtyByBox: Record<string, string>;
  photosByBox: Record<string, string[]>;
  videosByBox: Record<string, string[]>;
  submitted: boolean;
  truckPhotos: string[];
  completed?: boolean; // "All Ok Go" pressed → order finished on this device
}

const boxStatusKey = (inquiryId: string) => `driver-boxstatus-${inquiryId}`;

export async function loadBoxStatus(inquiryId: string): Promise<BoxStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(boxStatusKey(inquiryId));
    return raw ? (JSON.parse(raw) as BoxStatus) : null;
  } catch {
    return null;
  }
}

export async function saveBoxStatus(inquiryId: string, status: BoxStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(boxStatusKey(inquiryId), JSON.stringify(status));
  } catch {
    // storage full/unavailable — progress just won't persist
  }
}

// Look up a box by its scanned QR seal across ALL orders. Used to tell whether a
// scan that doesn't match THIS order is a real box from a DIFFERENT order (→
// "Failed to scan") versus an invalid/unknown seal (→ "Not verified").
// GET /inspection-service/order-inspections/boxes/by-qr/:code → data.{box,order}
export async function getBoxByQr(
  code: string,
): Promise<{ found: boolean; orderNumber?: string; inquiryId?: string }> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/inspection-service/order-inspections/boxes/by-qr/${encodeURIComponent(code)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return { found: false };
    const body: any = await res.json().catch(() => null);
    const order = body?.data?.order || {};
    return { found: !!body?.data?.box, orderNumber: order?.orderNumber, inquiryId: order?.inquiryId };
  } catch {
    return { found: false };
  }
}

// Boxes the inspection user registered — only once the inspection is complete.
export async function getOrderInspection(inquiryId: string): Promise<OrderInspection> {
  const done = await isInspectionDone(inquiryId);
  if (!done) return { done: false, boxes: [], totalQuantity: 0 };
  const data = await fetchInspectionBoxes(inquiryId);
  return { done: true, ...data };
}

// Is the DRIVER's own transportation assignment finished (submitted/completed)?
// Those orders open the read-only Completed page instead of the loading page.
export function isOrderDone(status?: string): boolean {
  return INSPECTION_DONE_STATUSES.has(String(status || '').toLowerCase());
}

export interface Factory {
  name: string;
  address: string;
  city?: string;
  region?: string;
  country?: string;
  pincode?: string;
  lat?: number | null;
  lng?: number | null;
}

// Real product photos + factory/pickup address for an assigned order, resolved
// server-side (the driver's role can't read the order/inquiry directly).
// GET /service-provider/work/assignments/:id/product-image.
export async function getAssignmentDetails(
  assignmentId: string,
): Promise<{ images: string[]; factory: Factory | null }> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/service-provider/work/assignments/${assignmentId}/product-image`,
      { headers: authHeaders() },
    );
    const body: any = await res.json().catch(() => null);
    const images = Array.isArray(body?.data?.images)
      ? body.data.images.filter((u: any) => typeof u === 'string' && u)
      : [];
    const factory: Factory | null = body?.data?.factory || null;
    return { images, factory };
  } catch {
    return { images: [], factory: null };
  }
}

export async function getAssignmentImages(assignmentId: string): Promise<string[]> {
  return (await getAssignmentDetails(assignmentId)).images;
}

export async function verifyOtp(
  id: string,
  otp: string,
  leg: 'pickup' | 'delivery',
): Promise<Result<true>> {
  try {
    const path = leg === 'delivery' ? 'verify-delivery' : 'verify-pickup';
    const res = await fetch(`${API_BASE_URL}/service-provider/work/assignments/${id}/${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ otp }),
    });
    const body: any = await res.json().catch(() => null);
    if (res.ok && body?.success !== false) return { ok: true, data: true };
    return { ok: false, error: body?.message || `Verification failed (HTTP ${res.status}).`, code: res.status };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}
