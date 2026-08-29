// Base URL for the Aaziko common API gateway.
// The service-provider (transporter/driver) endpoints live under
// `/service-provider/*` — e.g. POST /service-provider/users/login.
//
// Default is the public prod gateway (works on a real device / emulator).
// Override at build time with EXPO_PUBLIC_API_URL when pointing at a local
// backend, e.g.:
//   Android emulator -> http://10.0.2.2:3030
//   iOS simulator    -> http://localhost:3030
//   real device      -> http://<your-LAN-IP>:3030
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.aaziko.com/common-api';
