import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '@/constants/api';

const SESSION_KEY = 'aaziko-driver-session';

export interface DriverUser {
  id: string;
  username: string;
  email: string;
  role: string;
  allowedServices?: string[];
  mustChangePassword?: boolean;
  [key: string]: unknown;
}

export interface LoginData {
  user: DriverUser;
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
}

// Session for the current app run, also persisted to AsyncStorage (localStorage
// on web) so it survives page reloads / app restarts. `loadSession()` restores
// it at app start (see app/_layout.tsx) BEFORE any screen fetches, so the token
// is available and the driver stays logged in.
export const session: {
  user: DriverUser | null;
  accessToken: string | null;
  refreshToken: string | null;
} = { user: null, accessToken: null, refreshToken: null };

let sessionLoaded = false;

function persistSession() {
  const snapshot = JSON.stringify({
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
  // fire-and-forget; storage failures must not block login
  AsyncStorage.setItem(SESSION_KEY, snapshot).catch(() => {});
}

// Restore the persisted session into memory. Idempotent; safe to await at start.
export async function loadSession(): Promise<void> {
  if (sessionLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      session.user = s?.user ?? null;
      session.accessToken = s?.accessToken ?? null;
      session.refreshToken = s?.refreshToken ?? null;
    }
  } catch {
    // corrupt/unavailable storage — start signed out
  } finally {
    sessionLoaded = true;
  }
}

export function isSignedIn(): boolean {
  return !!session.accessToken;
}

export function clearSession() {
  session.user = null;
  session.accessToken = null;
  session.refreshToken = null;
  AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}

// Host portion of the API base ("api.aaziko.com", or "localhost:3030" for a
// local build) — surfaced in connection errors so a driver can tell, on the
// device, whether the app is pointed at the right server.
function apiHost(): string {
  const m = API_BASE_URL.match(/^https?:\/\/([^/]+)/i);
  return m ? m[1] : API_BASE_URL;
}

type LoginResult =
  | { success: true; data: LoginData }
  | { success: false; error: string };

/**
 * Service-provider (transporter) login — the same endpoint the transportation
 * web app uses: POST /service-provider/users/login with { email, password }.
 *
 * The backend resolves the account with `findByEmailOrUsername`, so the login
 * screen's "Username" field is passed straight through as `email` and matches
 * either a username or an email address.
 */
export async function loginServiceProvider(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  // Abort a stuck request instead of spinning forever — on a device with no
  // internet the connection can otherwise hang until the OS gives up.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${API_BASE_URL}/service-provider/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Tell the backend this is the mobile app → it issues a non-expiring
        // token so the driver's session never expires on the device.
        'X-Client-Type': 'mobile-app',
      },
      body: JSON.stringify({ email: identifier.trim(), password }),
      signal: controller.signal,
    });

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON response (e.g. an nginx/gateway error page) — fall through.
    }

    if (res.ok && body?.success && body?.data) {
      session.user = body.data.user ?? null;
      session.accessToken = body.data.accessToken ?? null;
      session.refreshToken = body.data.refreshToken ?? null;
      sessionLoaded = true;
      persistSession();
      return { success: true, data: body.data as LoginData };
    }

    if (res.status === 401) {
      return { success: false, error: body?.message || 'Invalid username or password.' };
    }
    if (res.status === 403) {
      return { success: false, error: body?.message || 'Access denied for this account.' };
    }
    return {
      success: false,
      error: body?.message || `Login failed (HTTP ${res.status}). Please try again.`,
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return {
        success: false,
        error: `The server (${apiHost()}) took too long to respond. Check your internet connection and try again.`,
      };
    }
    return {
      success: false,
      error: `Couldn't reach the server (${apiHost()}). Make sure this device has internet, then try again.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
