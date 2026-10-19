---
title: "Change Documentation — aaziko-driver"
---

# Change Documentation — aaziko-driver

> Auto-generated on every push, to any branch. Newest entry first. Old entries are never removed.

<!-- AAZIKO-CHANGELOG:INSERT-AFTER -->

<!-- AAZIKO-CHANGELOG:HISTORY-START -->

> History of the main branch, one entry per day, newest first.

## 19 October 2026 — main branch (history)

### Summary

On 19 October 2026, the main branch received changes to 2 files: 2 added, 0 changed and 0 removed, with 463 lines added and 0 lines removed in total. Most of the work was in the main project folder and the workflows area.

### What was added

- 2 automatic change documentation files were added in the workflows area.

### Impact

- These changes are self-contained; no other part of the project depends on them.

---

## 26 September 2026 — main branch (history)

### Summary

On 26 September 2026, the main branch received changes to 1 file: 1 added, 0 changed and 0 removed, with 94 lines added and 0 lines removed in total. Most of the work was in the workflows area.

### What was added

- 1 build and deployment setting file was added in the workflows area.

### Impact

- Build or deployment settings changed, so the build and the deployment should be checked.

---

## 29 August 2026 — main branch (history)

### Summary

On 29 August 2026, the main branch received changes to 42 files: 29 added, 12 changed and 1 removed, with 4195 lines added and 110 lines removed in total. Most of the work was in the main project folder, the images area, the default expo backup area, the tabs area and the constants area.

### What was added

- A new order detail screen was added; it provides order detail screen, quantity of, the check for box complete, first incomplete verified, setting quantity for, capture for, opening scanner, reaction to submit, capture truck photo, reaction to all ok, handling of scanned, box key, box row, pill button, quantity slider and respond.
- A new orders screen was added; it provides orders screen, loading summary card, container3 d modal, breakdown card, right semi, donut, order card, opening directions, opening detail and reaction to verify.
- A new orders service logic was added; it provides assignment, parsed order, inspection box, order inspection, cleaning up media link, sp ID, auth headers, result, getting my assignments, from description, reading assignment, the check for inspection done, loading inspection boxes, box status, box status key, loading box status, saving box status, getting box by qr, getting order inspection, the check for order done, factory, getting assignment details, getting assignment images and verification of OTP.
- A new loading calc3d HTML component was added; it provides cargo3 d item, loading calc3 d data, building load calc3d HTML, getting shape type, building cargo boxes, finding optimal layout, capacity at scale, finding scale, fit camera, make geo, resize and animate.
- A new order map screen was added; it provides order map screen.
- A new login screen was added; it provides login screen and reaction to login.
- A new order completed screen was added; it provides banner, order completed screen and reading only box.
- A new loading calc service logic was added; it provides product input, loading result, loading cargo type defaults, default dims for, product from order, loading response and calculation of load.
- A new auth service logic was added; it provides driver user, login data, persist session, loading session, the check for signed in, clear session, API host, login result and login service provider.
- A new qr scanner component was added; it provides qr scanner props, qr scanner and handling of barcode.
- A new order map HTML component was added; it provides order map data, building order map HTML, place at, geocode and boot.
- A new qr scanner web component was added; it provides qr scanner props, qr scanner and submit.
- A new home screen in the tabs area was added; it takes over home screen from other parts of the code.
- A new loading calc3 d component was added; it provides loading calc3 d props and loading calc3 d.
- A new loading calc3 d web component was added; it provides loading calc3 d props and loading calc3 d.
- A new order map component was added; it provides order map props and order map.
- A new order map web component was added; it provides order map props and order map.
- A new API logic in the constants area was added; it uses the expo public API link setting.
- A new app screen was added; it provides index.
- 1 settings and data file was added.
- 1 build and deployment setting file was added.
- 8 image files were added in the default expo backup area and the images area.

### What was changed

- The layout screen was changed: the logic for root layout was updated; it now also relies on the react library and the auth part of the code.
- The external library @react-native-async-storage/async-storage was added (version 2.2.0).
- The external library expo-camera was added (version ~17.0.10).
- The external library expo-image-picker was added (version ~17.0.11).
- The external library react-native-webview was added (version 13.15.0).
- The layout screen in the tabs area was changed: the logic for tab layout was updated.
- The modal screen was changed: the logic for modal screen was updated.
- 1 dependency lock file was updated.
- 1 settings and data file was updated.
- 1 written documentation file was updated.
- 5 image files were updated in the images area.

### What was removed

- The tabs screen was removed.

### Impact

- Before deploying, the expo public API link setting must be configured on the server.
- External libraries changed, so they must be installed again and the application rebuilt before deploying.
- Build or deployment settings changed, so the build and the deployment should be checked.

---

## 25 August 2026 — main branch (history)

### Summary

On 25 August 2026, the main branch received changes to 41 files: 41 added, 0 changed and 0 removed, with 14162 lines added and 0 lines removed in total. Most of the work was in the main project folder, the images area, the tabs area, the screen area and the constants area.

### What was added

- A new explore screen in the tabs area was added; it provides tab two screen.
- A new resetting project logic in the scripts area was added; it provides index, root layout and move directories.
- A new tabs screen was added; it provides home screen.
- A new parallax scroll view component was added; it provides props and parallax scroll view.
- A new themed text component was added; it provides themed text props and themed text.
- A new theme logic in the constants area was added.
- The external library @expo/vector-icons was added (version ^15.0.3).
- The external library @react-navigation/bottom-tabs was added (version ^7.4.0).
- The external library @react-navigation/elements was added (version ^2.6.3).
- The external library @react-navigation/native was added (version ^7.1.8).
- The external library expo was added (version ~54.0.36).
- The external library expo-constants was added (version ~18.0.13).
- The external library expo-font was added (version ~14.0.12).
- The external library expo-haptics was added (version ~15.0.8).
- The external library expo-image was added (version ~3.0.11).
- The external library expo-linking was added (version ~8.0.12).
- The external library expo-router was added (version ~6.0.24).
- The external library expo-splash-screen was added (version ~31.0.13).
- The external library expo-status-bar was added (version ~3.0.9).
- The external library expo-symbols was added (version ~1.0.8).
- The external library expo-system-ui was added (version ~6.0.9).
- The external library expo-web-browser was added (version ~15.0.11).
- The external library react was added (version 19.1.0).
- The external library react-dom was added (version 19.1.0).
- The external library react-native was added (version 0.81.5).
- The external library react-native-gesture-handler was added (version ~2.28.0).
- The external library react-native-worklets was added (version 0.5.1).
- The external library react-native-reanimated was added (version ~4.1.1).
- The external library react-native-safe-area-context was added (version ~5.6.0).
- The external library react-native-screens was added (version ~4.16.0).
- The external library react-native-web was added (version ~0.21.0).
- The development tool @types/react was added (version ~19.1.0).
- The development tool typescript was added (version ~5.9.2).
- The development tool eslint was added (version ^9.25.0).
- The development tool eslint-config-expo was added (version ~10.0.0).
- The start command of the project was added.
- The reset project command of the project was added.
- The android command of the project was added.
- The ios command of the project was added.
- The web command of the project was added.
- The lint command of the project was added.
- A new collapsible component in the screen area was added; it provides collapsible.
- A new icon symbol component in the screen area was added; it provides icon mapping, icon symbol name and icon symbol.
- A new layout screen in the tabs area was added; it provides tab layout.
- A new icon symbol ios component in the screen area was added; it provides icon symbol.
- A new modal screen was added; it provides modal screen.
- A new external link component was added; it provides props and external link; it uses the expo os setting.
- A new layout screen was added; it provides root layout.
- A new shared logic for color scheme web was added; it provides shared logic for color scheme.
- A new shared logic for theme color was added; it provides shared logic for theme color.
- A new hello wave component was added; it provides hello wave.
- A new haptic tab component was added; it provides haptic tab; it uses the expo os setting.
- A new themed view component was added; it provides themed view props and themed view.
- A new eslint configuration was added.
- A new shared logic for color scheme was added.
- 1 dependency lock file was added.
- 3 written documentation files were added.
- 5 settings and data files were added.
- 1 other file was added.
- 10 image files were added in the images area.

### Impact

- Before deploying, the expo os setting must be configured on the server.
- External libraries changed, so they must be installed again and the application rebuilt before deploying.
- Build or deployment settings changed, so the build and the deployment should be checked.

---
