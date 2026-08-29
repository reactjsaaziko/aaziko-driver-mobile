import { API_BASE_URL } from '@/constants/api';
import { Cargo3DItem } from '@/components/loadCalc3dHtml';

// Aaziko Load Calculator (transport-service). We call the real endpoint the
// transportation app uses; the public `test/` variant needs no auth and runs
// the same optimisation. Orders carry product + quantity but not cargo
// dimensions, so we size each unit with the system's own cargo-type default
// dimensions (GET /load-calculator/api/cargo-types) and a default unit weight.

const LC_BASE = `${API_BASE_URL}/transport-service/load-calculator`;

export interface ProductInput {
  name: string;
  cargoType: string;
  length: number; // mm
  width: number; // mm
  height: number; // mm
  weight: number; // kg per unit
  quantity: number;
}

export interface LoadResult {
  containerName: string;
  containerVolumeM3: number;
  volumeUtilizationPct: number;
  weightUtilizationPct: number;
  totalPackages: number;
  totalVolumeM3: number;
  totalWeightKg: number;
  cargo: Cargo3DItem[]; // ready to feed the 3D model + donut
  containerSizeKey: '20ft' | '40ft';
  containersCount: number;
}

const PALETTE = ['#2F6BFF', '#2FB24C', '#F5A623', '#8E44AD', '#16A085', '#E0457B'];

// Default per-unit dimensions/weight when the order doesn't specify them.
const DEFAULT_DIMS = { length: 500, width: 400, height: 400 };
const DEFAULT_WEIGHT = 10;

let cargoTypeDefaults: Record<string, { length: number; width: number; height: number }> | null = null;

export async function loadCargoTypeDefaults(): Promise<void> {
  if (cargoTypeDefaults) return;
  try {
    const res = await fetch(`${LC_BASE}/api/cargo-types`, { headers: { Accept: 'application/json' } });
    const body: any = await res.json().catch(() => null);
    const data = body?.data;
    if (data && typeof data === 'object') {
      const map: Record<string, { length: number; width: number; height: number }> = {};
      for (const key of Object.keys(data)) {
        const d = data[key]?.defaultDimensions;
        if (d && d.length && d.width && d.height) {
          map[key] = { length: d.length, width: d.width, height: d.height };
        }
      }
      cargoTypeDefaults = map;
    }
  } catch {
    // keep null → hardcoded fallback below
  }
}

export function defaultDimsFor(cargoType: string) {
  return cargoTypeDefaults?.[cargoType] || DEFAULT_DIMS;
}

/**
 * Build a single product line for the load calculator from an order's
 * product name + quantity, using the system's default cargo dimensions.
 */
export function productFromOrder(
  name: string,
  quantity: number,
  cargoType = 'box',
): ProductInput {
  const d = defaultDimsFor(cargoType);
  return {
    name: name || 'Product',
    cargoType,
    length: d.length,
    width: d.width,
    height: d.height,
    weight: DEFAULT_WEIGHT,
    quantity: Math.max(1, quantity || 1),
  };
}

export type LoadResponse = { ok: true; data: LoadResult } | { ok: false; error: string };

export async function calculateLoad(products: ProductInput[]): Promise<LoadResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${LC_BASE}/test/calculate-multiple-containers?format=full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ products }),
      signal: controller.signal,
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.message || `Load calculator error (HTTP ${res.status}).` };
    const allContainers = body?.data?.optimalSolution?.containers;
    const container = Array.isArray(allContainers) ? allContainers[0] : null;
    if (!body?.success || !container)
      return { ok: false, error: body?.message || 'Load calculator returned no container.' };

    const spec = container.containerSpec || {};
    const util = container.utilization || {};
    const loaded: any[] = Array.isArray(container.loadedProducts) ? container.loadedProducts : [];

    let totalVol = 0;
    let totalWt = 0;
    let totalPkg = 0;
    const cargo: Cargo3DItem[] = loaded.map((p, i) => {
      const qty = p.quantity || p.originalQuantity || 0;
      const volM3 = ((p.length || 0) * (p.width || 0) * (p.height || 0)) / 1e9 * qty;
      const wt = (p.weight || 0) * qty;
      totalVol += volM3;
      totalWt += wt;
      totalPkg += qty;
      return {
        name: p.name || `Item ${i + 1}`,
        packages: qty,
        volume: volM3,
        weight: wt,
        color: PALETTE[i % PALETTE.length],
        cargoType: p.cargoType || 'box',
      };
    });

    const key: '20ft' | '40ft' = String(spec.containerType || spec.name || '').includes('40')
      ? '40ft'
      : '20ft';

    return {
      ok: true,
      data: {
        containerName: spec.name || 'Container',
        containerVolumeM3: spec.volume || 0,
        volumeUtilizationPct: Math.round(util.volumeUtilization || 0),
        weightUtilizationPct: Math.round(util.weightUtilization || 0),
        totalPackages: totalPkg,
        totalVolumeM3: totalVol,
        totalWeightKg: totalWt,
        cargo,
        containerSizeKey: key,
        containersCount: Array.isArray(allContainers) ? allContainers.length : 1,
      },
    };
  } catch (e: any) {
    return {
      ok: false,
      error:
        e?.name === 'AbortError'
          ? 'Load calculator timed out.'
          : 'Could not reach the load calculator.',
    };
  } finally {
    clearTimeout(timer);
  }
}
