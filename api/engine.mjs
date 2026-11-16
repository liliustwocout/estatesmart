// Bộ thẩm định: 5 bước tương ứng 5 AI Agent trên giao diện.
//   1 Phân tích nhu cầu → parseCriteria   2 Sàng lọc → screen   3 Đánh giá vị trí → location
//   4 Phân tích cạnh tranh → competition  5 Chấm điểm & khuyến nghị → assess / recommend
// Tính hoàn toàn bằng code từ dữ liệu (không dùng mô hình ngôn ngữ) để kết quả nhất quán, kiểm chứng được.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listActive, getByCode, MODELS, TYPES } from './db.mjs';

const OSM = JSON.parse(readFileSync(fileURLToPath(new URL('./data/pois.json', import.meta.url)), 'utf8'));
export const POIS = OSM.pois;
export const OSM_DATE = OSM.fetched;
export const PLACE = 'Vinhomes Ocean Park 1, Gia Lâm';
const RADIUS = 500;

// Đối thủ cùng ngành theo mô hình kinh doanh (nhóm điểm OSM).
const COMP_KINDS = { cafe: ['cafe'], tra_sua: ['cafe'], nha_hang: ['restaurant', 'fast_food'], tap_hoa: ['convenience', 'supermarket'], tien_loi: ['convenience'] };

export function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const money = (n) => Math.round(n).toLocaleString('vi-VN');

// ---------- Agent 1: phân tích nhu cầu ----------
function range(text, unit) {
  const t = String(text || '').toLowerCase().replace(/(\d)[.,](\d{3})\b/g, '$1$2');
  const nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.')));
  if (!nums.length) return null;
  const [a, b] = nums;
  if (/dưới|tối đa|không quá|<|max/.test(t)) return [0, a];
  if (/trên|từ|ít nhất|>|tối thiểu/.test(t) && nums.length === 1) return [a, Infinity];
  if (nums.length >= 2) return [Math.min(a, b), Math.max(a, b)];
  if (/khoảng|tầm|chừng|~/.test(t) || unit === 'm2') return [a * 0.8, a * 1.2];
  return [0, a];
}

export function parseCriteria(raw = {}) {
  const s = (k) => String(raw[k] || '').slice(0, 200);
  const m = s('model').toLowerCase();
  const model = /trà sữa|tra sua|trà/.test(m) ? 'tra_sua' : /nhà hàng|quán ăn|nha hang|ăn uống|bún|phở|lẩu/.test(m) ? 'nha_hang'
    : /tạp hoá|tạp hóa|tap hoa|thực phẩm/.test(m) ? 'tap_hoa' : /tiện lợi|tien loi|minimart|mart/.test(m) ? 'tien_loi' : 'cafe';
  const area = s('area');
  const zones = [...new Set(listActive().map((l) => l.zone))];
  const zone = zones.find((z) => area.toLowerCase().includes(z.toLowerCase())) || null;
  const inArea = !area || /ocean|gia lâm|gia lam|vinhomes|đa tốn|kiêu kỵ|trâu quỳ/i.test(area) || !!zone;
  const n = s('needs').toLowerCase();
  return {
    model, modelLabel: MODELS[model],
    area, zone, inArea,
    budget: range(s('budget'), 'tr'),
    size: range(s('size'), 'm2'),
    needs: {
      car: /ô tô|oto|đỗ xe|đậu xe|bãi xe/.test(n),
      noDivider: /phân cách/.test(n),
      office: /văn phòng/.test(n),
      school: /trường|sinh viên|học sinh/.test(n),
      kitchen: /bếp/.test(n),
      moto: /xe máy|xe may/.test(n)
    }
  };
}

// ---------- Agent 3 & 4: vị trí và cạnh tranh (dữ liệu OpenStreetMap) ----------
export function surroundings(l, model = 'cafe') {
  const near = POIS.map((p) => ({ ...p, d: distance(l, p) })).filter((p) => p.d <= 1500).sort((a, b) => a.d - b.d);
  const within = (kind, r = RADIUS) => near.filter((p) => p.kind === kind && p.d <= r);
  const nearest = (kind) => near.find((p) => p.kind === kind) || null;
  const compKinds = COMP_KINDS[model] || COMP_KINDS.cafe;
  const competitors = near.filter((p) => compKinds.includes(p.kind) && p.d <= RADIUS);
  return {
    apartments: within('apartments').length,
    schools: within('school').length,
    universities: within('university', 1000).length,
    parks: within('park').length,
    busStops: within('bus_stop').length,
    health: within('health').length,
    food: within('cafe').length,
    dining: within('restaurant').length + within('fast_food').length,
    retail: within('convenience').length + within('supermarket').length,
    mall: nearest('mall'), school: nearest('school'), university: nearest('university'), bus: nearest('bus_stop'), apartment: nearest('apartments'), park: nearest('park'),
    competitors
  };
}

function locationScore(f, model, needs) {
  let s = 30 + Math.min(f.apartments, 8) * 5 + Math.min(f.schools, 4) * 3 + Math.min(f.busStops, 6) * 1.5 + Math.min(f.parks, 5);
  if (f.mall && f.mall.d < 800) s += model === 'nha_hang' ? 12 : 8;
  if (model === 'tra_sua' || model === 'cafe' || needs.school) s += Math.min(f.universities, 2) * 6;
  if (model === 'tien_loi' || model === 'tap_hoa') s += Math.min(f.apartments, 8) * 2;
  return clamp(Math.round(s));
}

// ---------- Agent 5: chấm điểm một mặt bằng ----------
export function assess(l, crit) {
  const f = surroundings(l, crit.model);
  const parts = {};
  const pros = [], cons = [];

  if (crit.budget) {
    const [lo, hi] = crit.budget;
    if (l.rent_million > hi) {
      const over = ((l.rent_million - hi) / hi) * 100;
      parts.budget = clamp(100 - over * 4);
      cons.push(`Giá thuê ${money(l.rent_million)} triệu, vượt ngân sách khoảng ${Math.round(over)}%.`);
    } else {
      parts.budget = l.rent_million < lo ? 90 : 100;
      pros.push(`Giá thuê ${money(l.rent_million)} triệu/tháng nằm trong ngân sách.`);
    }
  } else parts.budget = 70;

  if (crit.size) {
    const [lo, hi] = crit.size;
    const d = l.area_m2 < lo ? (lo - l.area_m2) / lo : l.area_m2 > hi && hi !== Infinity ? (l.area_m2 - hi) / hi : 0;
    parts.size = clamp(100 - d * 250);
    if (d > 0.15) cons.push(`Diện tích ${l.area_m2} m² lệch so với nhu cầu.`);
  } else parts.size = 70;

  parts.location = locationScore(f, crit.model, crit.needs);
  if (f.apartments >= 3) pros.push(`${f.apartments} toà chung cư trong bán kính 500 m, nguồn khách cư dân dồi dào.`);
  if (f.mall && f.mall.d < 800) pros.push(`Cách Vincom Mega Mall ${fmtDist(f.mall.d)}.`);
  if (f.schools >= 2 && (crit.model === 'tra_sua' || crit.model === 'cafe')) pros.push(`${f.schools} trường học trong 500 m.`);
  if (parts.location < 50) cons.push('Ít chung cư, trường học quanh mặt bằng, lượng khách tự nhiên có thể thấp.');

  const c = f.competitors.length;
  parts.competition = clamp(100 - c * 15, 40, 100);
  if (c === 0) pros.push('Chưa ghi nhận cơ sở cùng ngành trong 500 m (theo OpenStreetMap).');
  if (c >= 3) cons.push(`${c} cơ sở cùng ngành trong 500 m, cạnh tranh trực tiếp.`);

  let a = 70;
  if (l.divider) { a -= crit.needs.noDivider ? 40 : 15; cons.push('Có dải phân cách cứng, khách chiều ngược phải quay đầu.'); }
  if (l.two_way) a += 5;
  const carW = crit.needs.car ? 2 : 1;
  if (l.car_parking_m <= 150) { a += 15 * carW; if (crit.needs.car || l.car_parking_m <= 100) pros.push(`Bãi đỗ ô tô cách ${fmtDist(l.car_parking_m)}.`); }
  else if (l.car_parking_m <= 300) a += 5 * carW;
  else { a -= 10 * carW; if (crit.needs.car) cons.push(`Bãi đỗ ô tô xa (${fmtDist(l.car_parking_m)}).`); }
  const suited = String(l.suited || '').split(';');
  if (suited.includes(crit.model)) a += 10; else { a -= 20; cons.push(`Mặt bằng không phù hợp lắm với mô hình ${crit.modelLabel.toLowerCase()}.`); }
  if (crit.model === 'nha_hang' || crit.model === 'cafe' || crit.needs.kitchen) {
    if (l.kitchen) a += 5; else { a -= crit.model === 'nha_hang' ? 15 : 5; cons.push('Chưa có bếp, cần chi phí cải tạo.'); }
  }
  if (l.yard_m2 >= 30 && crit.model === 'cafe') { a += 5; pros.push(`Có sân ${l.yard_m2} m² để bố trí chỗ ngồi ngoài trời.`); }
  if (crit.needs.moto) {
    if (l.moto_slots >= 15) { a += 8; pros.push(`Để được khoảng ${l.moto_slots} xe máy trước cửa.`); }
    else if (l.moto_slots < 8) { a -= 10; cons.push(`Chỗ để xe máy hạn chế (khoảng ${l.moto_slots} xe).`); }
  }
  parts.access = clamp(a);

  const score = Math.round(parts.budget * 0.25 + parts.size * 0.2 + parts.location * 0.2 + parts.competition * 0.15 + parts.access * 0.2);
  return { listing: l, score, parts, facts: f, pros: pros.slice(0, 3), cons: cons.slice(0, 3) };
}

// ---------- Agent 2 + 5: sàng lọc và đề xuất Top 3 ----------
export function recommend(raw) {
  const crit = parseCriteria(raw);
  const all = listActive();
  const inZone = crit.zone ? all.filter((l) => l.zone === crit.zone) : all;
  const pool = inZone.length >= 3 ? inZone : all;
  const fits = pool.filter((l) => {
    if (crit.budget && l.rent_million > crit.budget[1] * 1.25) return false;
    if (crit.size && (l.area_m2 < crit.size[0] * 0.7 || (crit.size[1] !== Infinity && l.area_m2 > crit.size[1] * 1.5))) return false;
    return true;
  });
  const screened = fits.length >= 3 ? fits : pool;
  const ranked = screened.map((l) => assess(l, crit)).sort((a, b) => b.score - a.score || a.listing.rent_million - b.listing.rent_million);
  const top = ranked.slice(0, 3);

  const seen = new Set();
  const competitors = [];
  for (const r of top) for (const p of r.facts.competitors) if (!seen.has(p.id)) { seen.add(p.id); competitors.push({ lat: p.lat, lng: p.lng, name: p.name }); }

  const notes = [];
  if (!crit.inArea) notes.push('Hiện hệ thống mới có dữ liệu mặt bằng ở Vinhomes Ocean Park 1, nên kết quả dưới đây thuộc khu vực này.');
  if (fits.length < 3) notes.push('Ít mặt bằng khớp hoàn toàn ngân sách và diện tích, tôi nới điều kiện để vẫn có ba lựa chọn gần nhất.');

  return {
    criteria: crit,
    stats: { total: all.length, screened: screened.length, fit: fits.length, competitorKinds: COMP_KINDS[crit.model] },
    notes,
    results: top.map((r, i) => card(r, i + 1)),
    competitors,
    osm: { date: OSM_DATE, source: 'OpenStreetMap (ODbL)' }
  };
}

const MASSING = { villa: 0, townhouse: 1, shophouse: 2, podium: 2, kiosk: 1 };
function card(r, rank) {
  const l = r.listing;
  return {
    code: l.code, rank, score: r.score, name: l.name, type: l.type,
    meta: `Ocean Park 1, ${l.area_m2} m²`, size: `${l.area_m2} m²`, price: `${money(l.rent_million)} triệu/tháng`,
    lat: l.lat, lng: l.lng, src: `/images/${l.image}.webp`, alt: `${TYPES[l.type]} ${l.name}`,
    massing: `${l.floors} tầng, ${TYPES[l.type].toLowerCase()}${l.yard_m2 ? ', có sân' : ''}`, massingIdx: MASSING[l.type] ?? 2,
    parts: r.parts, competitors: r.facts.competitors.length, pros: r.pros, cons: r.cons
  };
}

// ---------- Hồ sơ chi tiết cho trang /mat-bang/ ----------
const ROOM_TEMPLATES = {
  villa: [['Sảnh chính', 0.35, 'living-room-clean'], ['Khu bếp', 0.12, 'kitchen-clean'], ['Phòng tầng 2', 0.15, 'apartment-living'], ['Sân vườn', 'yard', 'exterior-garden-clean']],
  shophouse: [['Sảnh tầng trệt', 0.4, 'apartment-living'], ['Khu bếp', 0.14, 'kitchen-clean'], ['Tầng 2', 0.3, 'apartment-bedroom'], ['Kho và khu phụ', 0.08, 'apartment-bedroom-2']],
  townhouse: [['Không gian chính', 0.45, 'living-room-clean'], ['Quầy pha chế', 0.15, 'kitchen-clean'], ['Phòng phụ', 0.1, 'apartment-bedroom-2'], ['Sân trước', 'yard', 'patio-front-clean']],
  podium: [['Gian bán hàng', 0.7, 'apartment-living'], ['Quầy thu ngân', 0.15, 'kitchen-clean'], ['Kho', 0.15, 'apartment-bedroom-2']],
  kiosk: [['Gian bán hàng', 0.8, 'apartment-tour'], ['Kho nhỏ', 0.2, 'apartment-bedroom-2']]
};
const USE = {
  cafe: (m2) => `Khu phục vụ, khoảng ${Math.max(6, Math.round(m2 / 2.2))} chỗ`,
  tra_sua: (m2) => `Quầy bán và ${Math.max(4, Math.round(m2 / 2.5))} chỗ ngồi`,
  nha_hang: (m2) => `Khu phục vụ, khoảng ${Math.max(8, Math.round(m2 / 1.8))} chỗ`,
  tap_hoa: () => 'Kệ hàng và lối đi',
  tien_loi: () => 'Kệ hàng, tủ mát và quầy thu ngân'
};

function medianPpm(type) {
  const v = listActive().filter((l) => l.type === type).map((l) => (l.rent_million * 1e6) / l.area_m2).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

// raw: tiêu chí người dùng (nếu có) để điểm khớp với kết quả ở trang Trợ lý.
export function profile(code, raw = {}) {
  const l = getByCode(code);
  if (!l || l.status !== 'active') return null;
  const suited = String(l.suited || 'cafe').split(';');
  const parsed = parseCriteria(raw);
  const model = raw.model ? parsed.model : suited[0];
  const crit = { ...parsed, model, modelLabel: MODELS[model] };
  const r = assess(l, crit);
  const f = r.facts;
  const ppm = (l.rent_million * 1e6) / l.area_m2;
  const med = medianPpm(l.type);
  const diff = med ? Math.round(((ppm - med) / med) * 100) : 0;
  const ppmNote = Math.abs(diff) < 5 ? 'Hợp lý so với khu vực⁴' : diff > 0 ? `Cao hơn khu vực ${diff}%⁴` : `Thấp hơn khu vực ${-diff}%⁴`;

  const tpl = ROOM_TEMPLATES[l.type] || ROOM_TEMPLATES.shophouse;
  const rooms = tpl.filter(([, share]) => share !== 'yard' || l.yard_m2 > 0).map(([name, share, img], i) => {
    const m2 = share === 'yard' ? l.yard_m2 : Math.round(l.area_m2 * share);
    const use = i === 0 ? USE[model](m2) : share === 'yard' ? `Khu ngồi ngoài trời, khoảng ${Math.round(m2 / 2.5)} chỗ` : /bếp|pha chế|quầy/i.test(name) ? (l.kitchen ? 'Đã có cấp thoát nước' : 'Cần lắp đặt cấp thoát nước, hút mùi') : 'Kho, phòng nhân viên';
    return { name, size: `${m2} m²`, use, note: 'Phân chia công năng là gợi ý theo diện tích, cần đối chiếu khi khảo sát.', src: `/images/${img}.webp` };
  });

  const amenities = [];
  if (f.apartment) amenities.push({ label: 'Toà chung cư', value: f.apartments ? `${f.apartments} toà trong 500 m` : `gần nhất ${fmtDist(f.apartment.d)}`, ref: '2' });
  if (f.school) amenities.push({ label: 'Trường học gần nhất', value: fmtDist(f.school.d), ref: '2' });
  if (f.mall) amenities.push({ label: 'Vincom Mega Mall', value: fmtDist(f.mall.d), ref: '2' });
  if (f.bus) amenities.push({ label: 'Điểm dừng xe buýt', value: fmtDist(f.bus.d), ref: '2' });
  if (amenities.length < 4 && f.park) amenities.push({ label: 'Công viên, khu thể thao', value: fmtDist(f.park.d), ref: '2' });

  const c = f.competitors.length;
  const totalNear = f.food + f.dining + f.retail;
  const pct = (n) => (totalNear ? Math.round((n / totalNear) * 100) : 0) + '%';
  const verdict = `Điểm phù hợp ${r.score}/100 cho mô hình ${MODELS[model].toLowerCase()}. ` +
    (r.parts.location >= 60 ? 'Vị trí có nguồn khách cư dân tốt. ' : 'Nguồn khách tự nhiên quanh mặt bằng chưa nhiều. ') +
    (c >= 3 ? 'Cạnh tranh cùng ngành đáng kể trong 500 m. ' : 'Mật độ đối thủ cùng ngành ghi nhận được còn thấp. ') +
    'Số liệu mặt bằng là dữ liệu mô phỏng; cần khảo sát thực địa trước khi quyết định.';

  return {
    code: l.code, tab: l.zone, name: l.name, model: MODELS[model].toUpperCase(), modelLower: MODELS[model].toLowerCase(),
    place: PLACE, facts: `${l.area_m2} m², ${l.floors} tầng`, updated: l.updated.split('-').reverse().join('/'), score: r.score,
    hero: `/images/${l.image}.webp`, heroPos: '50% 50%', heroAlt: `${TYPES[l.type]}: ${l.name}`, contactImg: '/images/nightSide.webp',
    specs: [
      { label: 'Giá thuê', value: `${money(l.rent_million)} triệu`, note: 'mỗi tháng, chưa VAT' },
      { label: 'Đơn giá/m²', value: `${money(Math.round(ppm / 1000) * 1000)} đ`, note: ppmNote },
      { label: 'Diện tích', value: `${l.area_m2} m²`, note: `${l.floors} tầng${l.yard_m2 ? `, sân ${l.yard_m2} m²` : ''}` },
      { label: 'Mặt tiền', value: `${l.frontage_m} m`, note: `đường ${l.road_m} m${l.two_way ? ', hai chiều' : ', một chiều'}` },
      { label: 'Đặt cọc', value: `${l.deposit_months} tháng`, note: `hợp đồng tối thiểu ${l.min_term_years} năm` }
    ],
    rooms,
    locationHeadline: l.divider ? 'Có dải phân cách cứng trước cửa, cần kiểm tra lối quay đầu.' : l.car_parking_m <= 150 ? 'Lối tiếp cận thuận lợi, gần bãi đỗ ô tô.' : 'Không có dải phân cách cứng, bãi đỗ ô tô hơi xa.',
    access: [
      { label: 'Dải phân cách cứng', value: l.divider ? 'Có' : 'Không có', ref: '1' },
      { label: 'Chiều lưu thông', value: l.two_way ? 'Hai chiều' : 'Một chiều', ref: '1' },
      { label: 'Bãi đỗ ô tô gần nhất', value: fmtDist(l.car_parking_m), ref: '1' },
      { label: 'Chỗ để xe máy tại chỗ', value: `Khoảng ${l.moto_slots} xe`, ref: '1' }
    ],
    amenities: amenities.slice(0, 4),
    compCount: String(c).padStart(2, '0'),
    gap: c === 0 ? 'Chưa ghi nhận cơ sở cùng ngành trong 500 m trên OpenStreetMap; nên kiểm tra thực địa vì dữ liệu có thể thiếu.'
      : c >= 3 ? 'Mật độ cùng ngành cao, cần khác biệt rõ về sản phẩm hoặc không gian.' : 'Có ít cơ sở cùng ngành, vẫn còn chỗ cho mô hình mới.',
    segTitle: 'Cơ sở ăn uống, bán lẻ trong 500 m',
    segments: [
      { label: 'Cà phê, trà', count: f.food, pct: pct(f.food), note: 'Theo OpenStreetMap.' },
      { label: 'Nhà hàng, đồ ăn nhanh', count: f.dining, pct: pct(f.dining), note: 'Theo OpenStreetMap.' },
      { label: 'Cửa hàng tiện lợi, siêu thị', count: f.retail, pct: pct(f.retail), note: 'Theo OpenStreetMap.' }
    ],
    verdict,
    pros: r.pros.length ? r.pros : ['Chưa có điểm mạnh nổi bật theo dữ liệu hiện có.'],
    cons: r.cons.length ? r.cons : ['Chưa ghi nhận rủi ro lớn theo dữ liệu; vẫn cần khảo sát thực địa.'],
    lat: l.lat, lng: l.lng, simulated: true
  };
}

// ---------- Dữ kiện đưa vào lời dặn của trợ lý chat ----------
export function promptListings(codes, raw) {
  const crit = parseCriteria(raw);
  let list = (Array.isArray(codes) ? codes : []).slice(0, 3).map(getByCode).filter((l) => l && l.status === 'active');
  if (!list.length) list = recommend(raw).results.map((r) => getByCode(r.code));
  return list.map((l, i) => {
    const r = assess(l, crit);
    const f = r.facts;
    return [
      `${l.code} (hạng ${i + 1}, ${r.score}/100 điểm cho ${crit.modelLabel.toLowerCase()}): ${l.name}, ${PLACE}, Hà Nội`,
      `  Loại: ${TYPES[l.type]}, ${l.area_m2} m², ${l.floors} tầng${l.yard_m2 ? `, sân ${l.yard_m2} m²` : ''}, ${l.kitchen ? 'đã có bếp' : 'chưa có bếp'}. Phù hợp: ${l.suited.split(';').map((m) => MODELS[m]).join(', ')}.`,
      `  Giá thuê: ${money(l.rent_million)} triệu/tháng (${money(Math.round((l.rent_million * 1e3) / l.area_m2) * 1000)} đ/m²), đặt cọc ${l.deposit_months} tháng, hợp đồng tối thiểu ${l.min_term_years} năm.`,
      `  Tiếp cận: mặt tiền ${l.frontage_m} m, đường ${l.road_m} m ${l.two_way ? 'hai chiều' : 'một chiều'}, ${l.divider ? 'có' : 'không có'} dải phân cách cứng, bãi đỗ ô tô cách ${fmtDist(l.car_parking_m)}, để được khoảng ${l.moto_slots} xe máy.`,
      `  Xung quanh (OpenStreetMap, có thể thiếu): ${f.apartments} toà chung cư và ${f.schools} trường trong 500 m${f.mall ? `, Vincom Mega Mall cách ${fmtDist(f.mall.d)}` : ''}${f.bus ? `, xe buýt cách ${fmtDist(f.bus.d)}` : ''}.`,
      `  Cạnh tranh: ${f.competitors.length} cơ sở cùng ngành trong 500 m theo OpenStreetMap (dữ liệu có thể thiếu quán nhỏ).`,
      `  Điểm thành phần: ngân sách ${r.parts.budget}, diện tích ${r.parts.size}, vị trí ${r.parts.location}, cạnh tranh ${r.parts.competition}, tiếp cận ${r.parts.access}.`,
      `  Ưu điểm: ${r.pros.join(' ') || 'chưa có.'} Rủi ro: ${r.cons.join(' ') || 'chưa ghi nhận.'}${l.note ? ` Ghi chú của người đăng: ${l.note}.` : ''}`
    ].join('\n');
  }).join('\n');
}
