// Bản đồ tiện ích quanh căn nhà: MapLibre nghiêng, khối nhà thật từ OpenStreetMap (qua OpenFreeMap),
// căn đang xem (màu nhấn), vòng 300 m / 600 m / 1 km, nhãn tiện ích gần nhất theo nhóm và đường nối.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const HOME = { center: [105.9475, 20.9935], zoom: 14.6, pitch: 50, bearing: -18 };
const C = { mine: '#A3562B', bldg: '#E9E1D3', ground: '#F1ECE3', water: '#C9D6D3', park: '#DCE3CF', ring: '#1F1C19' };
// Màu từng nhóm tiện ích (khớp .m3-pill.g-* và .lg.g-* trong assistant.css). Thể thao vẽ chung với công viên.
export const GROUP_COLOR = { giao_duc: '#3E6A8A', mua_sam: '#B07A2A', y_te: '#A63E26', xanh: '#4F6B2F', di_lai: '#5B5148' };
const legendGroup = (g) => (g === 'the_thao' ? 'xanh' : g);
// Vòng khoảng cách quanh nhà (đường chim bay). Trang không hiện số phút đi bộ, chỉ hiện mét và km.
const RINGS = [{ label: '300 m', r: 300 }, { label: '600 m', r: 600 }, { label: '1 km', r: 1000 }];
const EMPTY = { type: 'FeatureCollection', features: [] };

// Hình vuông quanh điểm (lng, lat), cạnh `side` mét.
function square(lng, lat, side, props) {
  const dy = side / 2 / 111320;
  const dx = side / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]] } };
}
const offset = (lng, lat, north) => [lng, lat + north / 111320];

let pillN = 0;
function pill(text, cls) {
  const el = document.createElement('div');
  el.className = 'm3-pill-wrap';
  const inner = document.createElement('span');
  inner.className = 'm3-pill ' + cls;
  inner.style.animationDelay = 500 + (pillN++ % 12) * 70 + 'ms';
  inner.textContent = text;
  el.appendChild(inner);
  return el;
}

export function createMap3D(container) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = new maplibregl.Map({ container, style: STYLE, ...HOME, maxPitch: 70, attributionControl: false, dragRotate: true });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  let ready = false;
  let pending = null;
  let markers = [];
  let show = { rings: true, giao_duc: true, mua_sam: true, y_te: true, xanh: true, di_lai: true };
  let drawRaf = 0;
  let last = null; // { r, targets }
  let dead = false; // đã huỷ bản đồ: bỏ qua mọi lệnh vẽ còn sót

  map.on('load', () => {
    const style = map.getStyle();
    const vec = Object.keys(style.sources).find((k) => style.sources[k].type === 'vector');
    // Chỉnh nền sang tông ấm của trang.
    for (const layer of style.layers) {
      try {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', C.ground);
        else if (layer.type === 'fill' && /water/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', C.water);
        else if (layer.type === 'fill' && /park|grass|wood|landcover/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', C.park);
        else if (layer['source-layer'] === 'building') map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch (e) { /* lớp không hỗ trợ thuộc tính: bỏ qua */ }
    }
    if (vec) {
      map.addLayer({
        id: 'b3d', type: 'fill-extrusion', source: vec, 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-extrusion-color': C.bldg,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92
        }
      });
    }
    map.addSource('rings', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'rings', type: 'line', source: 'rings', paint: { 'line-color': C.ring, 'line-width': ['get', 'w'], 'line-dasharray': [2, 2], 'line-opacity': ['get', 'o'] } });
    map.addSource('links', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'links', type: 'line', source: 'links', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [0.6, 1.6], 'line-opacity': 0.8 } });
    map.addSource('blocks', { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'blocks', type: 'fill-extrusion', source: 'blocks',
      paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96 }
    });
    ready = true;
    if (pending) { const p = pending; pending = null; update(p); }
  });

  function circle(lng, lat, r, props) {
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * 2 * Math.PI;
      pts.push([lng + (r / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (r / 111320) * Math.sin(a)]);
    }
    return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts } };
  }

  function clearMarkers() {
    pillN = 0;
    markers.forEach((m) => m.marker.remove());
    markers = [];
  }

  const visible = (t) => show[legendGroup(t.group)] !== false;

  // Vẽ dần: vòng đi bộ nở ra, đường nối kéo dài từ căn nhà ra từng tiện ích, khối căn nhà mọc lên.
  function draw(p) {
    if (!last || dead || !ready || !map.getStyle()) return;
    const { r, targets, block } = last;
    const e = 1 - Math.pow(1 - p, 3);
    const g = 1 - Math.pow(1 - Math.min(1, p * 1.6), 3);
    map.getSource('rings').setData({ type: 'FeatureCollection', features: show.rings ? RINGS.map((x, i) => circle(r.lng, r.lat, Math.max(1, x.r * e), { w: i === 2 ? 1.2 : 1.6, o: 0.75 - i * 0.15 })) : [] });
    const shown = targets.filter(visible);
    map.getSource('links').setData({ type: 'FeatureCollection', features: shown.map((t, i) => {
      const q = Math.min(1, Math.max(0, e * 1.3 - i * 0.04));
      return { type: 'Feature', properties: { color: GROUP_COLOR[legendGroup(t.group)] || C.ring }, geometry: { type: 'LineString', coordinates: [[r.lng, r.lat], [r.lng + (t.lng - r.lng) * q, r.lat + (t.lat - r.lat) * q]] } };
    }) });
    map.getSource('blocks').setData(block ? { type: 'FeatureCollection', features: [{ ...block, properties: { ...block.properties, h: Math.max(0.5, block.properties.h * g) } }] } : EMPTY);
  }

  function animate() {
    cancelAnimationFrame(drawRaf);
    if (reduce) { draw(1); return; }
    draw(0);
    let t0 = 0;
    const DELAY = 380, DUR = 1100;
    const tick = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0 - DELAY) / DUR));
      draw(p);
      if (p < 1) drawRaf = requestAnimationFrame(tick);
    };
    drawRaf = requestAnimationFrame(tick);
  }

  function applyVisibility() {
    if (!ready) return;
    for (const m of markers) m.marker.getElement().style.display = m.key === 'mine' || show[m.key] !== false ? '' : 'none';
    draw(1);
  }

  // r: báo cáo từ /api/report
  function update(r) {
    if (dead) return;
    if (!ready) { pending = r; return; }
    cancelAnimationFrame(drawRaf);
    clearMarkers();
    if (!r) {
      last = null;
      ['blocks', 'links', 'rings'].forEach((s) => map.getSource(s).setData(EMPTY));
      map.easeTo({ ...HOME, duration: reduce ? 0 : 900 });
      return;
    }
    // Nhà đất: khối màu nhấn cao theo số tầng. Căn hộ: toà đã có khối thật từ OSM, chỉ cắm nhãn.
    const block = r.apt ? null : square(r.lng, r.lat, Math.max(12, Math.min(24, Math.sqrt(r.area / Math.max(1, r.floors)) * 1.3)), { color: C.mine, h: Math.max(8, r.floors * 3.6 + 2) });
    // Mỗi nhóm lấy tối đa 2 tiện ích gần nhất có trong 1,5 km, để bản đồ không rối.
    const per = {};
    const targets = (r.nearest || []).filter((x) => !x.inside && x.d <= 1500 && x.lat != null).filter((x) => {
      const g = legendGroup(x.group);
      per[g] = (per[g] || 0) + 1;
      return per[g] <= 2;
    });
    last = { r, targets, block };

    markers.push({ key: 'mine', marker: new maplibregl.Marker({ element: pill((r.apt ? 'Căn ' + r.code : r.short.split(',')[0]) + ' · ' + r.score + ' điểm', 'mine'), anchor: 'bottom', offset: [0, r.apt ? -4 : -14] }).setLngLat([r.lng, r.lat]).addTo(map) });
    for (const t of targets) {
      const g = legendGroup(t.group);
      markers.push({ key: g, marker: new maplibregl.Marker({ element: pill(`${t.label} · ${t.text}`, 'g-' + g), anchor: 'bottom', offset: [0, -4] }).setLngLat([t.lng, t.lat]).addTo(map) });
    }
    for (const x of RINGS) markers.push({ key: 'rings', marker: new maplibregl.Marker({ element: pill(x.label, 'ring'), anchor: 'center' }).setLngLat(offset(r.lng, r.lat, x.r)).addTo(map) });
    applyVisibility();
    animate();

    const b = new maplibregl.LngLatBounds();
    [[r.lng, r.lat], offset(r.lng, r.lat, RINGS[1].r), offset(r.lng, r.lat, -RINGS[1].r), ...targets.filter((t) => t.d <= 900).map((t) => [t.lng, t.lat])].forEach((p) => b.extend(p));
    const cam = map.cameraForBounds(b, { padding: { top: 90, bottom: 230, left: 80, right: 80 }, maxZoom: 17 });
    map.easeTo({ center: cam ? cam.center : [r.lng, r.lat], zoom: Math.max(15.2, cam ? cam.zoom : 16), pitch: 52, bearing: -18, duration: reduce ? 0 : 1100 });
  }

  return {
    update,
    toggle(key, on) { show[key] = on; if (!dead) applyVisibility(); },
    resize: () => map.resize(),
    destroy: () => { if (dead) return; dead = true; cancelAnimationFrame(drawRaf); clearMarkers(); try { map.remove(); } catch (e) { /* đã gỡ */ } }
  };
}
