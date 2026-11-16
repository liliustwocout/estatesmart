// Tải điểm quan tâm (quán, trường, chung cư, công viên…) quanh Vinhomes Ocean Park 1 từ OpenStreetMap.
// Chạy lại khi muốn cập nhật: node api/scripts/fetch-osm.mjs  → ghi api/data/pois.json
// Dữ liệu © OpenStreetMap contributors, giấy phép ODbL.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BBOX = '20.978,105.926,21.011,105.970'; // nam, tây, bắc, đông (Ocean Park 1 và vùng đệm ~700 m)
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const query = `[out:json][timeout:90];(
  nwr["amenity"~"^(cafe|restaurant|fast_food|bar|pub|ice_cream|food_court|school|kindergarten|university|college|hospital|clinic|bank|pharmacy|marketplace|parking)$"](${BBOX});
  nwr["shop"~"^(convenience|supermarket|mall|bakery|beverages|department_store|tea)$"](${BBOX});
  nwr["leisure"~"^(park|sports_centre|fitness_centre)$"](${BBOX});
  nwr["building"="apartments"](${BBOX});
  nwr["highway"="bus_stop"](${BBOX});
);out center tags;`;

// Gom thẻ OSM về các nhóm mà bộ chấm điểm dùng.
function kindOf(t) {
  const a = t.amenity, s = t.shop;
  if (a === 'cafe' || s === 'tea' || s === 'beverages') return 'cafe';
  if (a === 'restaurant' || a === 'food_court') return 'restaurant';
  if (a === 'fast_food' || a === 'ice_cream' || s === 'bakery') return 'fast_food';
  if (a === 'bar' || a === 'pub') return 'bar';
  if (s === 'convenience') return 'convenience';
  if (s === 'supermarket' || s === 'department_store' || a === 'marketplace') return 'supermarket';
  if (s === 'mall') return 'mall';
  if (a === 'school' || a === 'kindergarten') return 'school';
  if (a === 'university' || a === 'college') return 'university';
  if (a === 'hospital' || a === 'clinic' || a === 'pharmacy') return 'health';
  if (a === 'bank') return 'bank';
  if (a === 'parking') return 'parking';
  if (t.leisure) return 'park';
  if (t.building === 'apartments') return 'apartments';
  if (t.highway === 'bus_stop') return 'bus_stop';
  return null;
}

let json, lastErr;
for (const url of MIRRORS) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'user-agent': 'estatesmart-osm-snapshot/0.1', 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
    if (!res.ok) throw new Error(url + ' trả ' + res.status);
    json = await res.json();
    console.log('Lấy từ', url);
    break;
  } catch (e) { lastErr = e; console.warn('Lỗi:', e.message); }
}
if (!json) throw lastErr;

const seen = new Set();
const pois = [];
for (const e of json.elements) {
  const t = e.tags || {};
  const kind = kindOf(t);
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (!kind || lat == null) continue;
  const id = e.type[0] + e.id;
  if (seen.has(id)) continue;
  seen.add(id);
  pois.push({ id, kind, name: t['name:vi'] || t.name || '', lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
}
pois.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

const out = fileURLToPath(new URL('../data/pois.json', import.meta.url));
writeFileSync(out, JSON.stringify({ source: 'OpenStreetMap (ODbL)', bbox: BBOX, fetched: new Date().toISOString().slice(0, 10), pois }, null, 0) + '\n');
const counts = pois.reduce((m, p) => ((m[p.kind] = (m[p.kind] || 0) + 1), m), {});
console.log(pois.length, 'điểm', counts, '→', out);
