// Self-contained Leaflet map that auto-pins a factory/pickup address.
// Rendered inside a WebView (native) or <iframe> (web). Uses OpenStreetMap
// tiles + Nominatim geocoding (no API key). If the address can't be geocoded
// it falls back to city/region/country, then the pincode, then India.

export interface OrderMapData {
  address?: string;
  lat?: number | null;
  lng?: number | null;
  label?: string;
  city?: string;
  region?: string;
  country?: string;
  pincode?: string;
}

export function buildOrderMapHtml(data: OrderMapData): string {
  const payload = JSON.stringify({
    address: data.address || '',
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    label: data.label || 'Factory',
    city: data.city || '',
    region: data.region || '',
    country: data.country || '',
    pincode: data.pincode || '',
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;background:#e9edf2;}
  #map{position:absolute;inset:0;}
  .pin{filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));}
  .leaflet-control-attribution{font-size:9px;}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var DATA = ${payload};
(function(){
  if (typeof L === 'undefined') { document.body.innerHTML = '<div style="padding:24px;font:14px system-ui;color:#6b7280">Map needs an internet connection.</div>'; return; }

  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var pinSvg =
    '<svg class="pin" width="42" height="52" viewBox="0 0 42 52" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M21 1C10.5 1 2 9.4 2 19.9 2 34 21 51 21 51s19-17 19-31.1C40 9.4 31.5 1 21 1z" fill="#159CDE"/>' +
    '<circle cx="21" cy="20" r="7.5" fill="#ffffff"/></svg>';
  var icon = L.divIcon({ html: pinSvg, className: '', iconSize: [42,52], iconAnchor: [21,51], popupAnchor: [0,-46] });
  var marker = null;
  var target = null;

  function placeAt(lat, lng, zoom){
    target = [lat, lng];
    if (marker) marker.setLatLng(target); else marker = L.marker(target, { icon: icon }).addTo(map);
    if (DATA.label) {
      marker.bindPopup('<b>' + DATA.label + '</b>' + (DATA.address ? '<br>' + DATA.address : ''));
      marker.openPopup();
    }
    map.setView(target, zoom || 15);
  }

  function geocode(q){
    return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'Accept':'application/json' } })
      .then(function(r){ return r.json(); })
      .then(function(a){ return (a && a[0]) ? { lat: parseFloat(a[0].lat), lng: parseFloat(a[0].lon) } : null; })
      .catch(function(){ return null; });
  }

  function boot(){
    if (DATA.lat != null && DATA.lng != null) { placeAt(DATA.lat, DATA.lng, 15); return; }
    var tries = [];
    if (DATA.address) tries.push(DATA.address);
    var cityLine = [DATA.city, DATA.region, DATA.country].filter(Boolean).join(', ');
    if (cityLine) tries.push(cityLine);
    if (DATA.pincode) tries.push([DATA.pincode, DATA.country].filter(Boolean).join(', '));
    if (DATA.country) tries.push(DATA.country);

    (function next(i){
      if (i >= tries.length) { return; } // leave India overview
      geocode(tries[i]).then(function(hit){
        if (hit) placeAt(hit.lat, hit.lng, i === 0 ? 15 : 12);
        else next(i + 1);
      });
    })(0);
  }
  boot();

  window.__recenter = function(){ if (target) map.setView(target, 15); };
  window.addEventListener('message', function(e){ if (e && e.data === 'recenter') window.__recenter(); });
})();
</script>
</body>
</html>`;
}
