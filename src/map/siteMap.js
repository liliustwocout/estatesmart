// Bản đồ thật cho trang Trợ lý: MapLibre GL + nền OpenFreeMap (miễn phí, không cần khoá).
// Được nạp động (import()) để trang mở nhanh; component chỉ gọi update() với dữ liệu mới.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const HOME = { center: [105.9475, 20.9935], zoom: 14.2 }; // Vinhomes Ocean Park 1
const EMPTY = { type: 'FeatureCollection', features: [] };

// Đa giác gần đúng của đường tròn bán kính r mét quanh (lng, lat).
function circle(lng, lat, r, n = 64) {
  const pts = [];
  const dLat = r / 111320;
  const dLng = r / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} };
}

export function createSiteMap(container, { onPick } = {}) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = new maplibregl.Map({
    container, style: STYLE, ...HOME, minZoom: 11, maxZoom: 18,
    attributionControl: false, dragRotate: false, pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();
  // Ghi nguồn bản đồ (bắt buộc theo giấy phép OpenStreetMap), đặt góc dưới trái để không bị thẻ mặt bằng che.
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

  let ready = false;
  let pending = null;
  let markers = [];
  let lastKey = '';

  map.on('load', () => {
    map.addSource('ring', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'ring-fill', type: 'fill', source: 'ring', paint: { 'fill-color': '#A3562B', 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'ring-line', type: 'line', source: 'ring', paint: { 'line-color': '#A3562B', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } });
    map.addSource('comp', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'comp', type: 'circle', source: 'comp', paint: { 'circle-radius': 5, 'circle-color': '#FBF8F2', 'circle-stroke-color': '#6B625A', 'circle-stroke-width': 2 } });
    ready = true;
    if (pending) { const p = pending; pending = null; update(p); }
  });

  function update({ pins = [], sel = 0, competitors = [] } = {}) {
    if (!ready) { pending = { pins, sel, competitors }; return; }
    map.getSource('comp').setData({ type: 'FeatureCollection', features: competitors.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name || '' } })) });
    const s = pins[sel];
    map.getSource('ring').setData(s ? { type: 'FeatureCollection', features: [circle(s.lng, s.lat, 500)] } : EMPTY);

    const key = pins.map((p) => p.code).join(',');
    if (key !== lastKey) {
      markers.forEach((m) => m.remove());
      markers = pins.map((p, i) => {
        // MapLibre đặt transform lên phần tử ngoài; nút bên trong giữ hiệu ứng bật lên của .pin.
        const wrap = document.createElement('div');
        wrap.className = 'map-pin-wrap';
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'pin map-pin';
        el.textContent = String(p.rank);
        el.setAttribute('aria-label', `Mặt bằng ${p.rank}: ${p.name}`);
        el.style.animationDelay = i * 110 + 'ms';
        el.addEventListener('click', (e) => { e.stopPropagation(); onPick && onPick(i); });
        wrap.appendChild(el);
        return new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
      });
      lastKey = key;
      if (pins.length) {
        const b = new maplibregl.LngLatBounds();
        pins.forEach((p) => b.extend([p.lng, p.lat]));
        map.fitBounds(b, { padding: { top: 90, bottom: 170, left: 60, right: 60 }, maxZoom: 15.5, duration: reduce ? 0 : 900 });
      } else {
        map.easeTo({ ...HOME, duration: reduce ? 0 : 600 });
      }
    }
    markers.forEach((m, i) => {
      const wrap = m.getElement();
      const el = wrap.firstChild;
      el.classList.toggle('is-on', i === sel);
      el.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
      wrap.style.zIndex = i === sel ? '2' : '1';
    });
  }

  function focus(i, pins) {
    const p = pins[i];
    if (p) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: reduce ? 0 : 600 });
  }

  return { update, focus, resize: () => map.resize(), destroy: () => { markers.forEach((m) => m.remove()); map.remove(); } };
}
