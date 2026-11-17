// Tải tiện ích quanh Vinhomes Ocean Park 1 từ OpenStreetMap cho bộ chấm điểm sống (docs/PHUONG_PHAP_CHAM_DIEM.md mục 2).
// Chạy lại khi muốn cập nhật: cd api && npm run osm  → ghi api/data/pois.json, rồi commit file mới.
// Dữ liệu © OpenStreetMap contributors, giấy phép ODbL.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schoolLevel } from '../poi-kinds.mjs';

const BBOX = '20.978,105.926,21.011,105.970'; // nam, tây, bắc, đông (Ocean Park 1 và vùng đệm ~700 m)
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const query = `[out:json][timeout:120];(
  nwr["amenity"~"^(kindergarten|school|university|college|marketplace|pharmacy|clinic|doctors|hospital|cafe|restaurant|fast_food|food_court)$"](${BBOX});
  nwr["shop"~"^(convenience|supermarket|mall|department_store|chemist)$"](${BBOX});
  nwr["leisure"~"^(park|garden|playground|sports_centre|fitness_centre|pitch|swimming_pool)$"](${BBOX});
  nwr["natural"="water"]["name"](${BBOX});
  nwr["building"="apartments"](${BBOX});
  nwr["highway"="bus_stop"](${BBOX});
  nwr["railway"~"^(station|halt)$"](${BBOX});
);out center tags;`;

// Gom thẻ OSM về các loại mà bộ chấm điểm dùng.
function kindOf(t) {
  const a = t.amenity, s = t.shop, l = t.leisure;
  if (a === 'kindergarten') return 'kindergarten';
  if (a === 'school') return schoolLevel(t['name:vi'] || t.name) === 'mn' ? 'kindergarten' : 'school';
  if (a === 'university' || a === 'college') return 'university';
  if (a === 'marketplace') return 'market';
  if (s === 'supermarket' || s === 'department_store') return 'supermarket';
  if (s === 'convenience') return 'convenience';
  if (s === 'mall') return 'mall';
  if (a === 'pharmacy' || s === 'chemist') return 'pharmacy';
  if (a === 'clinic' || a === 'doctors') return 'clinic';
  if (a === 'hospital') return 'hospital';
  if (l === 'playground') return 'playground';
  if (l === 'park' || l === 'garden' || t.natural === 'water') return 'park';
  if (l) return 'sports';
  if (t.highway === 'bus_stop') return 'bus_stop';
  if (t.railway && (t.station === 'subway' || t.station === 'light_rail' || t.subway === 'yes' || t.light_rail === 'yes')) return 'metro';
  if (a === 'cafe' || a === 'restaurant' || a === 'fast_food' || a === 'food_court') return 'food';
  if (t.building === 'apartments') return 'apartments';
  return null;
}

let json, lastErr;
for (const url of MIRRORS) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'user-agent': 'estatesmart-osm-snapshot/0.2', 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
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
  const name = t['name:vi'] || t.name || '';
  const p = { id, kind, name, lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  if (kind === 'school') p.level = schoolLevel(name);
  pois.push(p);
}
pois.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

const out = fileURLToPath(new URL('../data/pois.json', import.meta.url));
writeFileSync(out, JSON.stringify({ source: 'OpenStreetMap (ODbL)', bbox: BBOX, fetched: new Date().toISOString().slice(0, 10), pois }, null, 0) + '\n');
const counts = pois.reduce((m, p) => ((m[p.kind] = (m[p.kind] || 0) + 1), m), {});
console.log(pois.length, 'điểm', counts, '→', out);
