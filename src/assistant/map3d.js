// Bản đồ 3D cho báo cáo mặt bằng: MapLibre nghiêng, khối nhà thật từ OpenStreetMap (qua OpenFreeMap),
// khối mặt bằng đề xuất (màu nhấn), khối đối thủ (màu cam đất), nhãn khoảng cách và đường nối.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const HOME = { center: [105.9475, 20.9935], zoom: 14.6, pitch: 50, bearing: -18 };
const C = { mine: '#A3562B', comp: '#D98F3E', bldg: '#E9E1D3', ground: '#F1ECE3', water: '#C9D6D3', park: '#DCE3CF' };
const EMPTY = { type: 'FeatureCollection', features: [] };

// Hình vuông quanh điểm (lng, lat), cạnh `side` mét.
function square(lng, lat, side, props) {
  const dy = side / 2 / 111320;
  const dx = side / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]] } };
}

function pill(text, cls) {
  const el = document.createElement('div');
  el.className = 'm3-pill ' + cls;
  el.textContent = text;
  return el;
}

export function createMap3D(container) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = new maplibregl.Map({ container, style: STYLE, ...HOME, maxPitch: 70, attributionControl: false, dragRotate: true });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  let ready = false;
  let pending = null;
  let markers = { mine: [], comp: [], cust: [] };
  let show = { mine: true, comp: true, cust: true, links: true };

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
    map.addSource('links', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'links', type: 'line', source: 'links', paint: { 'line-color': '#1F1C19', 'line-width': 2, 'line-dasharray': [0.6, 1.6], 'line-opacity': 0.75 } });
    map.addSource('ring', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'ring', type: 'line', source: 'ring', paint: { 'line-color': C.mine, 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.7 } });
    map.addSource('blocks', { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'blocks', type: 'fill-extrusion', source: 'blocks',
      paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96 }
    });
    ready = true;
    if (pending) { const p = pending; pending = null; update(p); }
  });

  function circle(lng, lat, r) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI;
      pts.push([lng + (r / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (r / 111320) * Math.sin(a)]);
    }
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } };
  }

  function clearMarkers() {
    Object.values(markers).flat().forEach((m) => m.remove());
    markers = { mine: [], comp: [], cust: [] };
  }

  function applyVisibility() {
    if (!ready) return;
    map.setLayoutProperty('links', 'visibility', show.links ? 'visible' : 'none');
    for (const [k, list] of Object.entries(markers)) list.forEach((m) => { m.getElement().style.display = show[k] ? '' : 'none'; });
    const src = map.getSource('blocks');
    if (src && src._lastData) {
      src.setData({ type: 'FeatureCollection', features: src._lastData.features.filter((f) => (f.properties.kind === 'mine' ? show.mine : show.comp)) });
    }
  }

  // r: báo cáo từ /api/report
  function update(r) {
    if (!ready) { pending = r; return; }
    clearMarkers();
    if (!r) {
      map.getSource('blocks').setData(EMPTY);
      map.getSource('links').setData(EMPTY);
      map.getSource('ring').setData(EMPTY);
      map.easeTo({ ...HOME, duration: reduce ? 0 : 900 });
      return;
    }
    const side = Math.max(16, Math.min(28, Math.sqrt(r.area / Math.max(1, r.floors)) * 1.3));
    const features = [square(r.lng, r.lat, side, { kind: 'mine', color: C.mine, h: Math.max(8, r.floors * 4 + 4) })];
    r.competitors.forEach((c) => features.push(square(c.lng, c.lat, 12, { kind: 'comp', color: C.comp, h: 9 })));
    const data = { type: 'FeatureCollection', features };
    const src = map.getSource('blocks');
    src._lastData = data;
    src.setData(data);
    const targets = [...r.competitors.slice(0, 5), ...r.labels];
    map.getSource('links').setData({ type: 'FeatureCollection', features: targets.map((t) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[r.lng, r.lat], [t.lng, t.lat]] } })) });
    map.getSource('ring').setData({ type: 'FeatureCollection', features: [circle(r.lng, r.lat, r.compRadius || 500)] });

    markers.mine.push(new maplibregl.Marker({ element: pill(r.short.split(',')[0] + ' · ' + r.score + ' điểm', 'mine'), anchor: 'bottom', offset: [0, -14] }).setLngLat([r.lng, r.lat]).addTo(map));
    r.competitors.slice(0, 5).forEach((c) => markers.comp.push(new maplibregl.Marker({ element: pill(c.kind.split(',')[0] + ' · ' + c.dText, 'comp'), anchor: 'bottom', offset: [0, -8] }).setLngLat([c.lng, c.lat]).addTo(map)));
    r.labels.forEach((t) => markers.cust.push(new maplibregl.Marker({ element: pill(t.text, 'cust'), anchor: 'bottom', offset: [0, -4] }).setLngLat([t.lng, t.lat]).addTo(map)));
    applyVisibility();

    const pts = [[r.lng, r.lat], ...targets.filter((t) => t.d <= 800).map((t) => [t.lng, t.lat])];
    const b = new maplibregl.LngLatBounds();
    pts.forEach((p) => b.extend(p));
    const cam = map.cameraForBounds(b, { padding: { top: 90, bottom: 230, left: 80, right: 80 }, maxZoom: 17.2 });
    map.easeTo({ center: cam ? cam.center : [r.lng, r.lat], zoom: Math.max(16.1, cam ? cam.zoom : 16.6), pitch: 60, bearing: -18, duration: reduce ? 0 : 1100 });
  }

  return {
    update,
    toggle(key, on) { show[key] = on; applyVisibility(); },
    resize: () => map.resize(),
    destroy: () => { clearMarkers(); map.remove(); }
  };
}
