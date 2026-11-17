// Bộ chấm điểm sống: 5 bước tương ứng 5 AI Agent trên giao diện (đặc tả: docs/PHUONG_PHAP_CHAM_DIEM.md).
//   1 Hiểu gia đình → parseCriteria        2 Sàng lọc căn → screen
//   3 Học hành và sức khoẻ, 4 Sinh hoạt và đi lại → ecosystem
//   5 Chấm điểm sống và khuyến nghị → assess / recommend
// Tính hoàn toàn bằng code từ dữ liệu (không dùng mô hình ngôn ngữ) để kết quả nhất quán, kiểm chứng được.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homes, buildings, poisManual, TYPES, APARTMENT_TYPES, DEALS, LEGAL, BUILDING_AMENITIES, DIRECTIONS as DIR, FURNISHED as FURN, PARKING as PARK } from './db.mjs';
import { POI_KINDS } from './poi-kinds.mjs';

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));
const OSM = read('./data/pois.json');
export const LANDMARKS = read('./data/landmarks.json').landmarks;
export const OSM_DATE = OSM.fetched;
export const PLACE = 'Vinhomes Ocean Park 1, Gia Lâm';

export function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDist = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => String(r1(n)).replace('.', ',');
const money = (n) => Math.round(n).toLocaleString('vi-VN');

// ---------- Thời gian (mục 1) ----------
// Phút đi bộ chỉ dùng bên trong để chấm điểm; mọi chữ hiển thị cho người dùng ghi khoảng cách (m, km).
export const walkMin = (d) => Math.max(1, Math.ceil((d * 1.3) / 80)); // 80 m/phút, hệ số vòng vèo 1,3
export const driveMin = (d) => Math.max(5, Math.ceil((d * 1.4) / 400 / 5) * 5); // 24 km/h giờ cao điểm, làm tròn 5 phút

// ---------- Tiện ích: OSM + nhập tay ----------
export const SOURCE_LABEL = {
  osm: 'OpenStreetMap', osm_edited: 'OpenStreetMap, đã sửa tay', manual: 'Nhập tay', manual_verified: 'Nhập tay, đã kiểm chứng',
  building: 'Tiện ích nội khu (dữ liệu toà nhà)'
};
let poiCache = { v: -1, list: [] };
export function allPois() {
  if (poiCache.v === poisManual.version) return poiCache.list;
  const manual = poisManual.listActive();
  const byOsm = new Map(manual.filter((m) => m.osm_id).map((m) => [m.osm_id, m]));
  const list = [];
  for (const p of OSM.pois) {
    const m = byOsm.get(p.id);
    if (m) {
      if (!m.hidden) list.push({ id: p.id, kind: m.kind, level: m.level || '', name: m.name || p.name, lat: m.lat, lng: m.lng, source: m.verified ? 'manual_verified' : 'osm_edited' });
      continue;
    }
    // OSM có ga đường sắt đô thị quy hoạch, chưa vận hành: chỉ tính ga do quản trị viên nhập và kiểm chứng.
    if (p.kind === 'metro') continue;
    list.push({ ...p, level: p.level || '', source: 'osm' });
  }
  for (const m of manual) {
    if (m.osm_id || m.hidden) continue;
    if (m.kind === 'metro' && !m.verified) continue;
    list.push({ id: m.code, kind: m.kind, level: m.level || '', name: m.name, lat: m.lat, lng: m.lng, source: m.verified ? 'manual_verified' : 'manual' });
  }
  poiCache = { v: poisManual.version, list };
  return list;
}

// ---------- Loại tiện ích và ngưỡng (mục 2) ----------
const isSchool = (lv) => (p) => p.kind === 'school' && (p.level === lv || p.level === 'lc');
const unknownSchool = (p) => p.kind === 'school' && !p.level;
export const GROUPS = { giao_duc: 'Giáo dục', mua_sam: 'Mua sắm hằng ngày', y_te: 'Y tế', xanh: 'Xanh và vui chơi', the_thao: 'Thể thao', di_lai: 'Đi lại' };
export const ITEMS = [
  { key: 'mam_non', group: 'giao_duc', label: 'Trường mầm non', good: 5, far: 15, match: (p) => p.kind === 'kindergarten', partial: unknownSchool, inBuilding: ['mam_non'] },
  { key: 'tieu_hoc', group: 'giao_duc', label: 'Trường tiểu học', good: 7, far: 20, match: isSchool('th'), partial: unknownSchool },
  { key: 'thcs', group: 'giao_duc', label: 'Trường THCS', good: 10, far: 25, match: isSchool('thcs'), partial: unknownSchool },
  { key: 'thpt', group: 'giao_duc', label: 'Trường THPT', good: 15, far: 35, match: isSchool('thpt'), partial: unknownSchool },
  { key: 'cho', group: 'mua_sam', label: 'Chợ', good: 5, far: 15, match: (p) => p.kind === 'market' },
  { key: 'sieu_thi', group: 'mua_sam', label: 'Siêu thị', good: 7, far: 20, match: (p) => p.kind === 'supermarket' },
  { key: 'tien_loi', group: 'mua_sam', label: 'Cửa hàng tiện lợi', good: 3, far: 10, match: (p) => p.kind === 'convenience', inBuilding: ['tien_loi'] },
  { key: 'tttm', group: 'mua_sam', label: 'Trung tâm thương mại', good: 10, far: 30, match: (p) => p.kind === 'mall' },
  { key: 'nha_thuoc', group: 'y_te', label: 'Nhà thuốc', good: 3, far: 10, match: (p) => p.kind === 'pharmacy' },
  { key: 'phong_kham', group: 'y_te', label: 'Phòng khám, trạm y tế', good: 7, far: 20, match: (p) => p.kind === 'clinic' },
  { key: 'benh_vien', group: 'y_te', label: 'Bệnh viện', good: 2, far: 8, km: true, match: (p) => p.kind === 'hospital' },
  { key: 'cong_vien', group: 'xanh', label: 'Công viên, hồ', good: 3, far: 12, match: (p) => p.kind === 'park', inBuilding: ['vuon'] },
  { key: 'san_choi', group: 'xanh', label: 'Sân chơi trẻ em', good: 3, far: 10, match: (p) => p.kind === 'playground', inBuilding: ['san_choi'] },
  { key: 'the_thao', group: 'the_thao', label: 'Bể bơi, gym, sân thể thao', good: 7, far: 20, match: (p) => p.kind === 'sports', inBuilding: ['be_boi', 'gym'] },
  { key: 'xe_buyt', group: 'di_lai', label: 'Điểm xe buýt', good: 3, far: 10, match: (p) => p.kind === 'bus_stop' },
  { key: 'metro', group: 'di_lai', label: 'Ga metro', good: 10, far: 25, match: (p) => p.kind === 'metro' }
];
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

// Loại tiện ích không có điểm nào trong toàn bộ dữ liệu thì không tính vào điểm (tránh trừ đều mọi căn vì dữ liệu thiếu).
let availCache = { v: '', set: new Set() };
function available() {
  const v = poisManual.version + ':' + buildings.version;
  if (availCache.v === v) return availCache.set;
  const pois = allPois();
  const amen = new Set(buildings.listActive().flatMap((b) => String(b.amenities || '').split(';')));
  const set = new Set(ITEMS.filter((it) => pois.some((p) => it.match(p)) || (it.inBuilding || []).some((a) => amen.has(a))).map((i) => i.key));
  availCache = { v, set };
  return set;
}
export const missingItems = () => ITEMS.filter((i) => !available().has(i.key));

// ---------- Điểm một loại tiện ích (mục 3) ----------
const nearScore = (v, good, far) => (v <= good ? 100 : v >= far ? 0 : (100 * (far - v)) / (far - good));

function itemFor(it, home, near, bAmen) {
  const cands = [];
  for (const p of near) {
    const exact = it.match(p);
    if (!exact && !(it.partial && it.partial(p))) continue;
    const v = it.km ? p.d / 1000 : p.t;
    cands.push({ p, v, factor: exact ? 1 : 0.7, partial: !exact });
  }
  for (const a of it.inBuilding || []) {
    if (!bAmen.has(a)) continue;
    cands.push({ p: { id: 'bld:' + a, name: BUILDING_AMENITIES[a], lat: home.lat, lng: home.lng, d: 0, t: 1, source: 'building' }, v: it.km ? 0 : 1, factor: 1, partial: false, inside: true });
  }
  if (!cands.length) return { key: it.key, group: it.group, label: it.label, score: 0, nearest: null, count: 0 };
  for (const c of cands) c.s = nearScore(c.v, it.good, it.far) * c.factor;
  cands.sort((a, b) => b.s - a.s || a.v - b.v);
  const best = cands[0];
  const count = cands.filter((c) => c.v < it.far).length;
  const score = best.s > 0 ? Math.min(100, best.s + 8 * Math.min(2, count - 1)) : 0;
  const p = best.p;
  return {
    key: it.key, group: it.group, label: it.label, score: Math.round(score), count,
    nearest: {
      name: p.name || (POI_KINDS[p.kind] || it.label) + ' (chưa có tên trên bản đồ)', named: !!p.name, t: p.t, d: Math.round(p.d),
      text: best.inside ? 'trong toà' : fmtDist(p.d),
      partial: best.partial, inside: !!best.inside, source: p.source, sourceLabel: SOURCE_LABEL[p.source] || p.source, lat: p.lat, lng: p.lng
    }
  };
}

// Hệ sinh thái quanh một căn: điểm từng loại tiện ích (Agent 3 và 4).
export function ecosystem(home) {
  const near = allPois().map((p) => { const d = distance(home, p); return { ...p, d, t: walkMin(d) }; }).filter((p) => p.d <= 9000).sort((a, b) => a.d - b.d);
  const b = home.building ? buildings.get(home.building) : null;
  const bAmen = new Set(b && b.status === 'active' ? String(b.amenities || '').split(';').filter(Boolean) : []);
  const ok = available();
  const items = {};
  for (const it of ITEMS) if (ok.has(it.key)) items[it.key] = itemFor(it, home, near, bAmen);
  return { items, near, building: b, inside: [...bAmen] };
}

// ---------- Agent 1: hiểu gia đình ----------
const WORD_NUM = { 'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5 };
const lowerOf = (raw) => (k) => String(raw[k] || '').slice(0, 200).toLowerCase();

function parseBudget(text) {
  let s = String(text || '').toLowerCase().replace(/(\d)[.](\d{3})\b/g, '$1$2');
  // "2 tỷ 5" → 2,5 tỷ; "3 tỷ 250" → 3,25 tỷ
  s = s.replace(/(\d+)\s*(?:tỷ|ty)\s*(\d{1,3})\b(?!\s*(?:triệu|trieu|tr))/g, (m, a, b) => `${Number(a) + Number(b) / 10 ** b.length} tỷ`);
  const unit = /tỷ|\bty\b/.test(s) ? 'ty' : /triệu|trieu|\btr\b|củ/.test(s) ? 'tr' : null;
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '.')));
  if (!nums.length) return null;
  const [a, b] = nums;
  let lo, hi;
  if (/dưới|tối đa|không quá|<|max/.test(s)) [lo, hi] = [0, a];
  else if (/trên|ít nhất|>|tối thiểu/.test(s) && nums.length === 1) [lo, hi] = [a, Infinity];
  else if (nums.length >= 2) [lo, hi] = [Math.min(a, b), Math.max(a, b)];
  else if (/khoảng|tầm|chừng|~/.test(s)) [lo, hi] = [a * 0.9, a * 1.1];
  else [lo, hi] = [0, a];
  return { unit, lo, hi, first: a };
}

function parseFamily(f) {
  if (!f.trim()) return null;
  const out = { kids: 0, ages: [], unknownAges: false, grandparents: false, adults: 2, noKids: false };
  if (/một mình|độc thân|ở một mình/.test(f)) out.adults = 1;
  if (/chưa có con|chưa con|không có con|chưa có em bé|chỉ hai vợ chồng|hai vợ chồng thôi|độc thân|một mình/.test(f)) out.noKids = true;
  // \b của JavaScript không hiểu chữ có dấu, nên dùng (?![\p{L}]) để chặn cuối từ.
  let count = 0;
  for (const m of f.matchAll(/(\d+|một|hai|ba|bốn|năm)\s*(?:đứa\s*|bé\s*)?(?:con|cháu nhỏ|bé|cháu)(?![\p{L}])/gu)) count += Number(m[1]) || WORD_NUM[m[1]] || 0;
  if (!count && /(?<![\p{L}])(có con|con nhỏ|con trai|con gái|em bé|bé|cháu|con)(?![\p{L}])/u.test(f)) count = 1;
  // "dưới 6 tuổi" là nhỏ hơn 6: lấy tuổi đại diện nhỏ hơn mốc.
  for (const m of f.matchAll(/(dưới\s*)?(\d{1,2})\s*tuổi/g)) { const a = Number(m[2]); if (a <= 18) out.ages.push(m[1] ? Math.max(0, a - 2) : a); }
  for (const m of f.matchAll(/(\d{1,2})\s*tháng/g)) if (Number(m[1]) <= 24) out.ages.push(0);
  const stage = [[/sơ sinh|em bé|mẫu giáo|mầm non|nhà trẻ/, 3], [/tiểu học|cấp 1|cấp một|lớp [1-5]\b/, 8], [/cấp 2|cấp hai|thcs|lớp [6-9]\b/, 12], [/cấp 3|cấp ba|thpt|lớp 1[0-2]\b/, 16]];
  if (out.ages.length < Math.max(1, count)) for (const [re, age] of stage) if (re.test(f)) out.ages.push(age);
  out.grandparents = /ông bà|bố mẹ già|bố mẹ (?:tôi|vợ|chồng|em|anh|chị)|người già|cao tuổi|lớn tuổi|ở cùng bố mẹ|(?<![\p{L}])cụ(?![\p{L}])/u.test(f);
  out.kids = out.noKids ? 0 : Math.max(count, out.ages.length);
  if (out.noKids) out.ages = [];
  // Không nói gì về con: chỉ coi là "chưa có con" khi câu chỉ nói về người lớn; còn lại là chưa rõ (kids = null).
  if (!out.noKids && out.kids === 0 && !/vợ chồng|hai người|2 người|người lớn/.test(f)) out.kids = null;
  if (out.kids === null && !out.grandparents) return null;
  out.unknownAges = (out.kids || 0) > out.ages.length;
  return out;
}

const PRIORITY_WORDS = [
  ['giao_duc', /trường|học|giáo dục/], ['mua_sam', /chợ|siêu thị|mua sắm|tiện lợi/], ['y_te', /bệnh viện|y tế|khám|nhà thuốc|thuốc/],
  ['xanh', /công viên|cây xanh|vui chơi|sân chơi|hồ|thiên nhiên/], ['the_thao', /gym|bể bơi|thể thao|tập/], ['di_lai', /xe buýt|đi làm|metro|giao thông|đi lại/]
];
const COMPONENT_OF = { giao_duc: 'giao_duc', mua_sam: 'hang_ngay', y_te: 'hang_ngay', xanh: 'xanh', the_thao: 'xanh', di_lai: 'di_lai' };

export function parseCriteria(raw = {}) {
  const t = lowerOf(raw);
  const all = ['home', 'budget', 'family', 'area', 'priorities'].map(t).join(' . ');
  let budget = parseBudget(t('budget'));
  let deal = /thuê|thue/.test(t('home') + ' ' + t('budget')) ? 'thue' : /\bmua\b/.test(t('home') + ' ' + t('budget')) ? 'mua' : null;
  if (budget && !budget.unit) budget.unit = deal === 'thue' ? 'tr' : deal === 'mua' ? (budget.first >= 100 ? 'tr' : 'ty') : null;
  if (budget && !budget.unit) budget = null; // chưa biết mua hay thuê thì chưa hiểu được con số; trợ lý sẽ hỏi lại
  if (budget) {
    if (!deal) deal = budget.unit === 'ty' ? 'mua' : budget.hi !== Infinity && budget.hi < 200 ? 'thue' : 'mua';
    // Người mua ghi giá bằng triệu (vd 4500 triệu) → đổi sang tỷ.
    if (deal === 'mua' && budget.unit === 'tr') { budget.lo /= 1000; budget.hi /= 1000; budget.unit = 'ty'; }
  }
  const h = t('home');
  const group = /chung cư|căn hộ|can ho|studio|duplex|penthouse|toà|tòa/.test(h) ? 'chung_cu' : /nhà đất|nhà phố|liền kề|biệt thự|nhà riêng|nhà mặt đất|shophouse/.test(h) ? 'nha_dat' : null;

  const family = parseFamily(t('family') + ' ' + h);
  const bedM = all.match(/(\d)\s*(?:phòng ngủ|pn\b)/);
  let bedrooms = bedM ? Number(bedM[1]) : /studio/.test(h) ? 1 : null;
  if (bedrooms == null && family) {
    bedrooms = family.kids == null ? (family.grandparents ? 2 : null) : family.kids === 0 ? (family.grandparents ? 2 : 1) : Math.min(4, 1 + family.kids + (family.grandparents ? 1 : 0));
  }
  const sizeM = all.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|mét vuông)/);
  const size = sizeM ? [Number(sizeM[1].replace(',', '.')) * 0.8, Number(sizeM[1].replace(',', '.')) * 1.2] : null;

  // Nơi làm việc: chỉ tìm điểm mốc trong đoạn có chữ "làm", "công ty"… để "muốn ở Ocean Park" không bị hiểu là chỗ làm.
  const workText = [...all.matchAll(/(?:đi làm|làm việc|làm ở|làm tại|làm bên|\blàm\b|công ty|văn phòng|cơ quan)[^.;]{0,60}/g)].map((m) => m[0]).join(' | ');
  const work = [];
  for (const lm of LANDMARKS) if (lm.alias.some((a) => workText.includes(a)) && work.length < 2) work.push(lm);

  const areaText = t('area');
  const zones = [...new Set(homes.listActive().map((l) => l.zone))];
  const zone = zones.find((z) => areaText.includes(z.toLowerCase())) || null;
  const inArea = !areaText || /ocean|gia lâm|gia lam|vinhomes|đa tốn|kiêu kỵ|trâu quỳ|sapphire|masteri|zenpark|pavilion|zurich|beverly/.test(areaText) || !!zone
    || (work.length > 0 && !LANDMARKS.some((lm) => !work.includes(lm) && lm.alias.some((a) => areaText.includes(a))));

  const pt = t('priorities');
  const priorities = PRIORITY_WORDS.map(([g, re]) => [g, pt.search(re)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([g]) => g).slice(0, 2);
  const car = /ô tô|oto|xe hơi/.test(all);

  return { raw: Object.fromEntries(['home', 'budget', 'family', 'area', 'priorities'].map((k) => [k, String(raw[k] || '').slice(0, 120)])), deal, group, budget, family, bedrooms, size, work, zone, inArea, priorities, car };
}

// Mô tả ngắn gia đình, dùng trong câu chữ.
export function familyLabel(crit) {
  const f = crit.family;
  if (!f) return 'gia đình';
  const parts = [];
  if (f.kids == null) parts.push('gia đình');
  else if (f.kids === 0) parts.push(f.adults === 1 ? 'người ở một mình' : 'vợ chồng chưa có con');
  else if (f.ages.length && f.ages.every((a) => a < 6)) parts.push(f.kids > 1 ? `gia đình có ${f.kids} con nhỏ` : 'gia đình có con nhỏ');
  else if (f.ages.length && f.ages.every((a) => a >= 6)) parts.push(f.kids > 1 ? `gia đình có ${f.kids} con đang đi học` : 'gia đình có con đang đi học');
  else parts.push(f.kids > 1 ? `gia đình có ${f.kids} con` : 'gia đình có con');
  if (f.grandparents) parts.push('ông bà ở cùng');
  return parts.join(', ');
}

// ---------- Trọng số (mục 4 và 6.2) ----------
export function weightsFor(crit) {
  const f = crit.family;
  const iw = { mam_non: 1, tieu_hoc: 1, thcs: 1, thpt: 1, cho: 3, sieu_thi: 3, tien_loi: 2, tttm: 1, nha_thuoc: 2, phong_kham: 2, benh_vien: 1, cong_vien: 2, san_choi: 1, the_thao: 1, xe_buyt: 2, metro: 1, di_lam: crit.work.length ? 2 : 0 };
  if (f && f.ages.length && !f.unknownAges) {
    const g = { mam_non: 0, tieu_hoc: 0, thcs: 0, thpt: 0 };
    for (const a of f.ages) {
      if (a < 6) { g.mam_non += 3; g.tieu_hoc += 1; } else if (a <= 10) { g.tieu_hoc += 3; g.thcs += 1; } else if (a <= 14) { g.thcs += 3; g.thpt += 1; } else if (a <= 18) g.thpt += 3;
    }
    if (Object.values(g).some((x) => x > 0)) Object.assign(iw, g);
  }
  const young = f && f.ages.some((a) => a < 11);
  if (f && f.grandparents) { iw.cho = 4; iw.benh_vien = 3; }
  if (f && f.ages.some((a) => a < 6)) iw.phong_kham = 3;
  if (young) iw.san_choi = 3;

  const cw = { budget: 20, fit: 15, giao_duc: 20, hang_ngay: 20, xanh: 10, di_lai: 15 };
  if (f && f.kids === 0) cw.giao_duc *= 0.25;
  if (young) cw.xanh *= 1.5;
  if (f && f.grandparents) { cw.hang_ngay *= 1.3; cw.xanh *= 1.3; }
  if (crit.work.some((w) => w.key !== 'gia_lam')) cw.di_lai *= 1.5;
  for (const c of new Set(crit.priorities.map((g) => COMPONENT_OF[g]))) cw[c] *= 1.5;
  const sum = Object.values(cw).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(cw)) cw[k] = (cw[k] * 100) / sum;
  return { items: iw, components: cw };
}

const groupScore = (items, keys, iw) => {
  let s = 0, w = 0;
  for (const k of keys) if (items[k] && iw[k] > 0) { s += items[k].score * iw[k]; w += iw[k]; }
  return w ? s / w : null;
};

// ---------- Giá ----------
export const priceOf = (l) => (l.deal === 'ban' ? l.price_billion : l.rent_million);
export const priceText = (l) => (l.deal === 'ban' ? `${num(l.price_billion)} tỷ` : `${num(l.rent_million)} triệu/tháng`);
const overPct = (l, crit) => (crit.budget && crit.budget.hi !== Infinity ? ((priceOf(l) - crit.budget.hi) / crit.budget.hi) * 100 : 0);
const OVER_LIMIT = { ban: 10, thue: 20 };

// ---------- Agent 5: chấm một căn ----------
export function assess(l, crit, w = weightsFor(crit)) {
  const eco = ecosystem(l);
  const it = eco.items;
  const iw = w.items;
  const parts = {};

  // Ngân sách (6.3)
  if (crit.budget) {
    const over = overPct(l, crit);
    parts.budget = over > 0 ? clamp(100 - over * (l.deal === 'ban' ? 8 : 4)) : priceOf(l) < crit.budget.lo ? 90 : 100;
  } else parts.budget = 70;

  // Căn phù hợp (6.4)
  let fit = 100;
  const short = crit.bedrooms ? crit.bedrooms - l.bedrooms : 0;
  if (short === 1) fit -= 40; else if (short >= 2) fit -= 70;
  if (crit.bedrooms && l.bedrooms >= crit.bedrooms + 2) fit -= 10;
  if (crit.size) {
    const [lo, hi] = crit.size;
    const d = l.area_m2 < lo ? (lo - l.area_m2) / lo : l.area_m2 > hi ? (l.area_m2 - hi) / hi : 0;
    fit -= Math.min(60, d * 250);
  }
  if (l.deal === 'ban' && l.legal === 'cho_so') fit -= 10;
  if (l.deal === 'ban' && l.legal === 'hdmb') fit -= 15;
  const stairs = !APARTMENT_TYPES.includes(l.type) && !l.elevator && (l.floors || 1) >= 3;
  if (crit.family && crit.family.grandparents && stairs) fit -= 30;
  if (crit.car && l.car_parking === 'khong') fit -= 20;
  parts.fit = clamp(Math.round(fit));

  // Nhóm tiện ích (mục 4, 6.1)
  const g = {};
  for (const grp of Object.keys(GROUPS)) g[grp] = groupScore(it, ITEMS.filter((x) => x.group === grp).map((x) => x.key), iw);
  let commute = null;
  if (crit.work.length) {
    const mins = crit.work.map((lm) => ({ lm, T: driveMin(distance(l, lm)) }));
    const s = mins.reduce((a, m) => a + (m.T <= 20 ? 100 : m.T >= 60 ? 0 : (100 * (60 - m.T)) / 40), 0) / mins.length;
    commute = { score: Math.round(s), trips: mins.map((m) => ({ to: m.lm.name, minutes: m.T, km: num(distance(l, m.lm) / 1000), lat: m.lm.lat, lng: m.lm.lng })) };
  }
  const diLaiParts = [[g.di_lai, (iw.xe_buyt * (it.xe_buyt ? 1 : 0)) + (iw.metro * (it.metro ? 1 : 0))], [commute && commute.score, iw.di_lam]].filter(([v, wt]) => v != null && wt > 0);
  const avg = (pairs) => { const W = pairs.reduce((a, [, x]) => a + x, 0); return W ? pairs.reduce((a, [v, x]) => a + v * x, 0) / W : 50; };
  parts.giao_duc = Math.round(g.giao_duc ?? 50);
  parts.hang_ngay = Math.round(avg([[g.mua_sam, 3], [g.y_te, 2]].filter(([v]) => v != null)));
  parts.xanh = Math.round(avg([[g.xanh, 2], [g.the_thao, 1]].filter(([v]) => v != null)));
  parts.di_lai = Math.round(avg(diLaiParts));

  const cw = w.components;
  const score = Math.round(Object.keys(cw).reduce((a, k) => a + cw[k] * parts[k], 0) / 100);
  const groups = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v == null ? null : Math.round(v)]));
  const r = { listing: l, score, parts, groups, items: it, commute, eco, weights: w, stairs };
  r.pros = pros(r, crit);
  r.cons = cons(r, crit);
  return r;
}

// ---------- Ưu điểm và điều cần kiểm chứng (mục 8) ----------
function pros(r, crit) {
  const l = r.listing, it = r.items, iw = r.weights.items, cw = r.weights.components;
  const out = [];
  const add = (prio, text) => out.push([prio, text]);
  if (crit.budget && overPct(l, crit) <= 0) add(cw.budget, `Giá ${priceText(l)} nằm trong ngân sách.`);
  for (const k of ['mam_non', 'tieu_hoc', 'thcs', 'thpt']) {
    const x = it[k];
    if (x && x.score >= 80 && iw[k] >= 3 && x.nearest && !x.nearest.partial && x.nearest.named) add(cw.giao_duc * iw[k] / 3, x.nearest.inside ? `Có ${x.nearest.name.toLowerCase()}.` : `${x.nearest.name} cách khoảng ${x.nearest.text}.`);
  }
  const shops = ['cho', 'sieu_thi', 'tien_loi'].reduce((n, k) => n + (it[k] ? r.eco.near.filter((p) => ITEM[k].match(p) && p.t <= 10).length : 0), 0);
  if (shops >= 3) add(cw.hang_ngay * 0.9, `Có ${shops} chỗ đi chợ, siêu thị, cửa hàng tiện lợi trong khoảng 600 m.`);
  else if (it.sieu_thi && it.sieu_thi.score >= 80 && it.sieu_thi.nearest.named) add(cw.hang_ngay * 0.8, `${it.sieu_thi.nearest.name} cách khoảng ${it.sieu_thi.nearest.text}.`);
  if (it.cong_vien && it.cong_vien.nearest && it.cong_vien.nearest.t <= 3 && !it.cong_vien.nearest.inside) add(cw.xanh, `Công viên ngay cạnh nhà, cách khoảng ${it.cong_vien.nearest.text}.`);
  if (r.eco.inside.length) add(cw.xanh * 0.8, `Toà có ${r.eco.inside.map((a) => BUILDING_AMENITIES[a].toLowerCase()).join(', ')}.`);
  if (it.benh_vien && it.benh_vien.score >= 80 && it.benh_vien.nearest.named && crit.family && crit.family.grandparents) add(cw.hang_ngay, `${it.benh_vien.nearest.name} cách khoảng ${it.benh_vien.nearest.text}.`);
  if (r.commute) for (const t of r.commute.trips) if (t.minutes <= 25) add(cw.di_lai, `Chỗ làm ở ${t.to} cách khoảng ${t.km} km.`);
  if (it.xe_buyt && it.xe_buyt.nearest && it.xe_buyt.nearest.t <= 3) add(cw.di_lai * 0.6, `Điểm xe buýt cách khoảng ${it.xe_buyt.nearest.text}.`);
  return out.sort((a, b) => b[0] - a[0]).map(([, s]) => s).slice(0, 3);
}

function cons(r, crit) {
  const l = r.listing, it = r.items, f = crit.family;
  const out = [];
  const over = overPct(l, crit);
  if (over > 0) out.push(`Giá ${priceText(l)}, vượt ngân sách khoảng ${Math.round(over)}%.`);
  if (crit.bedrooms && l.bedrooms < crit.bedrooms) out.push(`Có ${l.bedrooms} phòng ngủ, ít hơn nhu cầu ${crit.bedrooms} phòng.`);
  if (l.deal === 'ban' && l.legal !== 'so_hong') out.push(`Pháp lý: ${LEGAL[l.legal].toLowerCase()}; kiểm tra tiến độ cấp sổ với chủ đầu tư hoặc người bán.`);
  if (f && f.grandparents && r.stairs) out.push(`Nhà ${l.floors} tầng không có thang máy, bất tiện cho ông bà.`);
  if (crit.car && l.car_parking === 'khong') out.push('Không có chỗ đỗ ô tô.');
  const schoolAge = f && f.ages.some((a) => a >= 3 && a <= 14);
  const schoolNear = ['mam_non', 'tieu_hoc', 'thcs'].some((k) => it[k] && it[k].nearest && !it[k].nearest.inside && it[k].nearest.t <= 15);
  if ((schoolAge || (f && f.unknownAges)) && schoolNear) out.push('Trường gần nhất chưa chắc đúng tuyến; hỏi phường nơi căn nhà thuộc về để biết địa bàn tuyển sinh.');
  if (it.cho && (!it.cho.nearest || it.cho.nearest.t > 15)) out.push('Chưa ghi nhận chợ trong khoảng 1 km theo dữ liệu hiện có; nên đi một vòng quanh khu.');
  if (r.commute) for (const t of r.commute.trips) if (t.minutes > 40) out.push(`Chỗ làm ở ${t.to} cách khoảng ${t.km} km; thử đi đúng giờ cao điểm trước khi quyết.`);
  return out.slice(0, 3);
}

// ---------- Agent 2: sàng lọc (mục 7) ----------
const TYPE_GROUP = (type) => (APARTMENT_TYPES.includes(type) ? 'chung_cu' : 'nha_dat');
function screen(crit, all) {
  const notes = [];
  const dealKey = crit.deal === 'mua' ? 'ban' : crit.deal;
  let pool = dealKey ? all.filter((l) => l.deal === dealKey) : all;
  if (crit.zone) { const z = pool.filter((l) => l.zone === crit.zone); if (z.length >= 3) pool = z; }
  const run = ({ bed = true, extra = 0, group = true }) => pool.filter((l) => {
    if (group && crit.group && TYPE_GROUP(l.type) !== crit.group) return false;
    if (bed && crit.bedrooms && crit.bedrooms - l.bedrooms >= 2) return false;
    if (crit.budget && overPct(l, crit) > OVER_LIMIT[l.deal] + extra) return false;
    return true;
  });
  let fits = run({});
  const strict = fits.length;
  if (fits.length < 3 && crit.bedrooms) { fits = run({ bed: false }); notes.push('Có ít căn đủ phòng ngủ nên mình xem thêm căn ít phòng hơn.'); }
  if (fits.length < 3 && crit.budget) { fits = run({ bed: false, extra: 10 }); notes.push('Có ít căn đúng tầm giá nên mình nới thêm 10% khi tìm.'); }
  if (fits.length < 3 && crit.group) { fits = run({ bed: false, extra: 10, group: false }); notes.push(`Có ít ${crit.group === 'chung_cu' ? 'căn hộ' : 'nhà đất'} khớp nên mình xem thêm ${crit.group === 'chung_cu' ? 'nhà đất' : 'căn hộ'}.`); }
  if (fits.length < 3) { fits = pool; notes.push('Có ít căn khớp nên mình xem cả những căn còn lại.'); }
  return { fits, strict, notes };
}

export function recommend(raw) {
  const crit = parseCriteria(raw);
  const all = homes.listActive();
  const w = weightsFor(crit);
  const { fits, strict, notes } = screen(crit, all);
  const ranked = fits.map((l) => assess(l, crit, w)).sort((a, b) => b.score - a.score || priceOf(a.listing) - priceOf(b.listing) || a.listing.code.localeCompare(b.listing.code));
  const top = ranked.slice(0, 3);
  if (!crit.inArea) notes.unshift('Hiện hệ thống mới có dữ liệu nhà ở Vinhomes Ocean Park 1, nên kết quả dưới đây thuộc khu vực này.');
  const miss = missingItems().map((i) => i.label.toLowerCase());
  if (miss.length) notes.push(`Dữ liệu chưa có ${miss.join(', ')} trong khu, nên điểm chưa tính các loại này.`);

  // Tiện ích gần nhất của ba căn (vẽ trên bản đồ).
  const seen = new Set();
  const amenities = [];
  for (const r of top) for (const x of Object.values(r.items)) {
    const n = x.nearest;
    if (!n || n.inside || seen.has(x.key + n.lat + n.lng)) continue;
    seen.add(x.key + n.lat + n.lng);
    amenities.push({ key: x.key, group: x.group, label: x.label, name: n.name, lat: n.lat, lng: n.lng });
  }

  return {
    criteria: { ...crit, work: crit.work.map((x) => x.name), familyLabel: familyLabel(crit) },
    weights: roundWeights(w.components),
    stats: { total: all.length, screened: fits.length, fit: strict },
    notes,
    results: top.map((r, i) => card(r, i + 1)),
    amenities,
    osm: { date: OSM_DATE, source: 'OpenStreetMap (ODbL)' }
  };
}

export const COMPONENT_LABEL = { budget: 'Ngân sách', fit: 'Căn phù hợp', giao_duc: 'Giáo dục', hang_ngay: 'Mua sắm và y tế', xanh: 'Xanh, vui chơi, thể thao', di_lai: 'Đi lại' };
export const roundWeights = (cw) => Object.fromEntries(Object.entries(cw).map(([k, v]) => [k, Math.round(v)]));

// Dựng lại thẻ kết quả cho một danh sách mã cố định (mở link chia sẻ), giữ đúng thứ tự đã lưu.
export function cardsFor(codes, raw = {}) {
  const crit = parseCriteria(raw);
  const w = weightsFor(crit);
  return codes.map(homes.get).filter((l) => l && l.status === 'active').map((l, i) => card(assess(l, crit, w), i + 1));
}

// Ba tiện ích nổi bật nhất của căn theo trọng số gia đình (chip trên thẻ kết quả).
export function chips(r) {
  const iw = r.weights.items;
  return Object.values(r.items).filter((x) => x.nearest && iw[x.key] > 0 && !x.nearest.partial)
    .sort((a, b) => iw[b.key] * b.score - iw[a.key] * a.score).slice(0, 3)
    .map((x) => ({ key: x.key, label: x.label, text: x.nearest.text }));
}

const MASSING = { biet_thu: 0, lien_ke: 1, nha_pho: 1, can_ho: 2, studio: 2, duplex: 2, penthouse: 2 };
function card(r, rank) {
  const l = r.listing;
  return {
    code: l.code, rank, score: r.score, name: l.name, type: l.type, typeLabel: TYPES[l.type], deal: l.deal, dealLabel: DEALS[l.deal],
    meta: `${l.zone}, ${l.area_m2} m², ${l.bedrooms} phòng ngủ`, size: `${l.area_m2} m²`, bedrooms: l.bedrooms,
    price: priceText(l), priceValue: priceOf(l),
    lat: l.lat, lng: l.lng, src: `/images/${l.image}.webp`, alt: `${TYPES[l.type]}: ${l.name}`,
    massing: APARTMENT_TYPES.includes(l.type) ? `Tầng ${l.floor}, ${TYPES[l.type].toLowerCase()}` : `${l.floors} tầng, ${TYPES[l.type].toLowerCase()}${l.yard_m2 ? ', có sân' : ''}`,
    massingIdx: MASSING[l.type] ?? 2,
    parts: r.parts, groups: r.groups, chips: chips(r), pros: r.pros, cons: r.cons
  };
}

// ---------- "Một ngày của gia đình" (mục 9) ----------
export function dayPlan(r, crit) {
  const it = r.items, f = crit.family;
  const out = [];
  const stop = (time, task, x) => { if (x && x.nearest) out.push({ time, task, place: x.nearest.name, text: x.nearest.text, minutes: x.nearest.t, lat: x.nearest.lat, lng: x.nearest.lng, key: x.key }); };
  if (f && f.ages.length) {
    const a = Math.min(...f.ages.filter((x) => x >= 2), 99);
    const k = a < 6 ? 'mam_non' : a <= 10 ? 'tieu_hoc' : a <= 14 ? 'thcs' : a <= 18 ? 'thpt' : null;
    if (k) stop('7:00', 'Đưa con đi học', it[k]);
  }
  if (r.commute) for (const t of r.commute.trips) out.push({ time: '7:30', task: `Đi làm ${t.to}`, place: t.to, text: `cách khoảng ${t.km} km`, minutes: t.minutes, lat: t.lat, lng: t.lng, key: 'di_lam' });
  else stop('7:30', 'Ra điểm xe buýt', it.xe_buyt);
  if (f && f.grandparents) stop('9:00', 'Ông bà đi chợ', it.cho && it.cho.nearest ? it.cho : it.sieu_thi);
  stop('17:30', 'Ghé siêu thị', it.sieu_thi && it.sieu_thi.nearest && it.sieu_thi.nearest.t <= 15 ? it.sieu_thi : it.tien_loi);
  if (f && f.ages.some((a) => a < 11)) stop('18:30', 'Cho con ra sân chơi', it.san_choi && it.san_choi.nearest ? it.san_choi : it.cong_vien);
  else stop('18:30', 'Đi dạo công viên', it.cong_vien);
  stop('20:00', 'Mua thuốc', it.nha_thuoc);
  return out;
}

// ---------- Hồ sơ chi tiết cho trang hồ sơ (/mat-bang/, sau này /nha/) ----------
const ROOM_IMG = { living: 'living-room-clean', kitchen: 'kitchen-clean', bed1: 'apartment-bedroom', bed2: 'apartment-bedroom-2', yard: 'exterior-garden-clean', balcony: 'apartment-living' };
function roomsOf(l) {
  const rooms = [];
  const apt = APARTMENT_TYPES.includes(l.type);
  const living = Math.round(l.area_m2 * (apt ? 0.32 : 0.22));
  rooms.push({ name: 'Phòng khách và bếp', size: `khoảng ${living} m²`, use: 'Sinh hoạt chung, ăn uống', src: `/images/${ROOM_IMG.living}.webp` });
  for (let i = 1; i <= Math.min(l.bedrooms, 5); i++) {
    const m2 = Math.round(l.area_m2 * (apt ? (i === 1 ? 0.18 : 0.13) : 0.1));
    rooms.push({ name: i === 1 ? 'Phòng ngủ chính' : `Phòng ngủ ${i}`, size: `khoảng ${m2} m²`, use: i === 1 ? 'Bố mẹ, có phòng tắm riêng' : 'Phòng cho con hoặc ông bà', src: `/images/${i === 1 ? ROOM_IMG.bed1 : ROOM_IMG.bed2}.webp` });
  }
  if (l.yard_m2 > 0) rooms.push({ name: 'Sân vườn', size: `${l.yard_m2} m²`, use: 'Chỗ cho trẻ chơi, trồng cây', src: `/images/${ROOM_IMG.yard}.webp` });
  else if (apt) rooms.push({ name: 'Ban công', size: 'khoảng 4 m²', use: 'Phơi đồ, trồng cây nhỏ', src: `/images/${ROOM_IMG.balcony}.webp` });
  return rooms.map((x) => ({ ...x, note: 'Diện tích từng phòng là ước lượng theo tổng diện tích, cần đối chiếu khi xem nhà.' }));
}

function medianPrice(l) {
  const same = homes.listActive().filter((x) => x.deal === l.deal && TYPE_GROUP(x.type) === TYPE_GROUP(l.type));
  const v = same.map((x) => priceOf(x) / x.area_m2).sort((a, b) => a - b);
  return { perM2: v.length ? v[Math.floor(v.length / 2)] : priceOf(l) / l.area_m2, n: same.length };
}
export function priceCompare(l) {
  const { perM2, n } = medianPrice(l);
  const median = r1(perM2 * l.area_m2);
  const mine = priceOf(l);
  return { mine, median, diff: Math.round(((mine - median) / median) * 100), n, unit: l.deal === 'ban' ? 'tỷ' : 'triệu/tháng', typeLabel: TYPE_GROUP(l.type) === 'chung_cu' ? 'căn hộ' : 'nhà đất' };
}

export function ecoGroups(r) {
  return Object.entries(GROUPS).map(([g, label]) => ({
    key: g, label, score: r.groups[g],
    items: ITEMS.filter((x) => x.group === g && r.items[x.key]).map((x) => {
      const y = r.items[x.key];
      return { key: x.key, label: x.label, score: y.score, count: y.count, weight: r.weights.items[x.key], nearest: y.nearest };
    })
  })).filter((g) => g.items.length);
}

export function profile(code, raw = {}) {
  const l = homes.get(code);
  if (!l || l.status !== 'active') return null;
  const crit = parseCriteria(raw);
  const r = assess(l, crit);
  const it = r.items;
  const pc = priceCompare(l);
  const fam = familyLabel(crit);
  const apt = APARTMENT_TYPES.includes(l.type);
  const near10 = Object.values(it).filter((x) => x.nearest && (x.nearest.inside || (x.nearest.t && x.nearest.t <= 10)));
  const unitPrice = l.deal === 'ban' ? `${num((l.price_billion * 1000) / l.area_m2)} triệu/m²` : `${money((l.rent_million * 1000) / l.area_m2)} nghìn/m²`;
  const best = Object.values(r.groups).filter((v) => v != null);

  return {
    code: l.code, tab: l.zone, name: l.name, model: fam.toUpperCase(), modelLower: fam,
    place: PLACE, facts: `${l.area_m2} m², ${l.bedrooms} phòng ngủ, ${apt ? 'tầng ' + l.floor : l.floors + ' tầng'}`, updated: l.updated.split('-').reverse().join('/'), score: r.score,
    deal: l.deal, dealLabel: DEALS[l.deal], typeLabel: TYPES[l.type], priceText: priceText(l),
    hero: `/images/${l.image}.webp`, heroPos: '50% 50%', heroAlt: `${TYPES[l.type]}: ${l.name}`, contactImg: '/images/nightSide.webp',
    specs: [
      { label: l.deal === 'ban' ? 'Giá bán' : 'Giá thuê', value: priceText(l).replace('/tháng', ''), note: l.deal === 'ban' ? 'chưa gồm phí sang tên' : 'mỗi tháng' },
      { label: 'Đơn giá', value: unitPrice, note: Math.abs(pc.diff) < 5 ? 'Ngang mức chung trong hệ thống' : pc.diff > 0 ? `Cao hơn mức chung ${pc.diff}%` : `Thấp hơn mức chung ${-pc.diff}%` },
      { label: 'Diện tích', value: `${l.area_m2} m²`, note: `${l.bedrooms} phòng ngủ, ${l.bathrooms} phòng tắm${l.yard_m2 ? `, sân ${l.yard_m2} m²` : ''}` },
      { label: apt ? 'Tầng, hướng' : 'Số tầng, hướng', value: apt ? `Tầng ${l.floor}` : `${l.floors} tầng`, note: l.direction ? `hướng ${(DIR[l.direction] || '').toLowerCase()}` : '' },
      { label: l.deal === 'ban' ? 'Pháp lý' : 'Nội thất', value: l.deal === 'ban' ? LEGAL[l.legal] : FURN[l.furnished], note: l.mgmt_fee ? `phí dịch vụ ${num(l.mgmt_fee)} nghìn/m²/tháng` : '' }
    ],
    rooms: roomsOf(l),
    locationHeadline: near10.length
      ? `${near10.length} loại tiện ích trong khoảng 10 phút đi bộ.`
      : 'Chưa ghi nhận tiện ích trong khoảng 10 phút đi bộ.',
    access: [
      { label: 'Điểm xe buýt gần nhất', value: it.xe_buyt && it.xe_buyt.nearest ? it.xe_buyt.nearest.text : 'Chưa ghi nhận', ref: '2' },
      ...(r.commute ? r.commute.trips.map((t) => ({ label: `Đi làm ${t.to}`, value: `cách khoảng ${t.km} km`, ref: '3' })) : []),
      { label: 'Chỗ đỗ ô tô', value: PARK[l.car_parking] || 'Chưa rõ', ref: '1' },
      { label: 'Thang máy', value: apt || l.elevator ? 'Có' : 'Không có', ref: '1' }
    ].slice(0, 4),
    amenities: chips(r).map((c) => ({ label: c.label, value: c.text, ref: '2' })),
    eco: ecoGroups(r),
    day: dayPlan(r, crit),
    weights: roundWeights(r.weights.components), parts: r.parts,
    // Các trường dưới đây giữ tên cũ cho trang hồ sơ hiện tại; đổi khi làm lại trang (giai đoạn 5).
    compCount: String(near10.length).padStart(2, '0'),
    gap: best.length ? `Nhóm mạnh nhất: ${GROUPS[Object.keys(r.groups).find((k) => r.groups[k] === Math.max(...best))].toLowerCase()}. Nhóm yếu nhất: ${GROUPS[Object.keys(r.groups).find((k) => r.groups[k] === Math.min(...best))].toLowerCase()}.` : '',
    segTitle: 'Điểm từng nhóm tiện ích (0–100)',
    segments: ecoGroups(r).map((g) => ({ label: g.label, count: g.score, pct: (g.score ?? 0) + '%', note: g.items.map((x) => x.nearest ? `${x.label}: ${x.nearest.text}` : `${x.label}: chưa ghi nhận`).join('; ') })),
    verdict: `Điểm sống ${r.score}/100 cho ${fam}. ` + (r.pros[0] ? r.pros[0] + ' ' : '') + 'Khoảng cách là ước lượng theo đường chim bay; dữ liệu căn là mô phỏng, cần đi xem nhà trước khi quyết định.',
    pros: r.pros.length ? r.pros : ['Chưa có điểm mạnh nổi bật theo dữ liệu hiện có.'],
    cons: r.cons.length ? r.cons : ['Chưa ghi nhận điều cần lưu ý lớn theo dữ liệu; vẫn nên đi xem nhà.'],
    lat: l.lat, lng: l.lng, simulated: true
  };
}

// ---------- Dữ kiện đưa vào lời dặn của trợ lý chat ----------
export function promptListings(codes, raw) {
  const crit = parseCriteria(raw);
  const w = weightsFor(crit);
  let list = (Array.isArray(codes) ? codes : []).slice(0, 3).map(homes.get).filter((l) => l && l.status === 'active');
  if (!list.length) list = recommend(raw).results.map((r) => homes.get(r.code));
  const wt = roundWeights(w.components);
  const head = `Trọng số điểm sống cho ${familyLabel(crit)}: ${Object.entries(wt).map(([k, v]) => `${COMPONENT_LABEL[k].toLowerCase()} ${v}%`).join(', ')}.`;
  return head + '\n' + list.map((l, i) => {
    const r = assess(l, crit, w);
    const apt = APARTMENT_TYPES.includes(l.type);
    const eco = ecoGroups(r).map((g) => `${g.label} ${g.score ?? 'chưa có'} điểm (${g.items.map((x) => x.nearest ? `${x.label.toLowerCase()}: ${x.nearest.name}, ${x.nearest.text}` : `${x.label.toLowerCase()}: chưa ghi nhận`).join('; ')})`).join('\n    ');
    return [
      `${l.code} (hạng ${i + 1}, điểm sống ${r.score}/100): ${l.name}, ${PLACE}, Hà Nội`,
      `  ${DEALS[l.deal]} ${TYPES[l.type].toLowerCase()}, giá ${priceText(l)}, ${l.area_m2} m², ${l.bedrooms} phòng ngủ, ${l.bathrooms} phòng tắm, ${apt ? `tầng ${l.floor}` : `${l.floors} tầng${l.elevator ? ', có thang máy' : ''}`}${l.yard_m2 ? `, sân ${l.yard_m2} m²` : ''}.`,
      `  ${l.deal === 'ban' ? `Pháp lý: ${LEGAL[l.legal]}. ` : ''}Nội thất: ${FURN[l.furnished] || 'chưa rõ'}. Chỗ đỗ ô tô: ${PARK[l.car_parking] || 'chưa rõ'}.${l.mgmt_fee ? ` Phí dịch vụ ${num(l.mgmt_fee)} nghìn/m²/tháng.` : ''}${r.eco.inside.length ? ` Tiện ích trong toà: ${r.eco.inside.map((a) => BUILDING_AMENITIES[a].toLowerCase()).join(', ')}.` : ''}`,
      `  Tiện ích quanh nhà (khoảng cách theo đường chim bay; OpenStreetMap, có thể thiếu):\n    ${eco}`,
      r.commute ? `  Đi làm: ${r.commute.trips.map((t) => `${t.to} cách khoảng ${t.km} km`).join('; ')} (đo tới trung tâm quận).` : '',
      `  Điểm thành phần: ${Object.entries(r.parts).map(([k, v]) => `${COMPONENT_LABEL[k].toLowerCase()} ${v}`).join(', ')}.`,
      `  Ưu điểm: ${r.pros.join(' ') || 'chưa có.'} Cần kiểm chứng: ${r.cons.join(' ') || 'chưa ghi nhận.'}${l.note ? ` Ghi chú của người đăng: ${l.note}.` : ''}`
    ].filter(Boolean).join('\n');
  }).join('\n');
}
