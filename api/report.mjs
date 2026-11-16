// Phục vụ trang Trợ lý kiểu "báo cáo": đọc câu mô tả tự do, ước lượng lưu lượng, dựng báo cáo một mặt bằng.
import { listActive, getByCode, MODELS, TYPES } from './db.mjs';
import { assess, parseCriteria, fmtDist, OSM_DATE, PLACE } from './engine.mjs';

const RADIUS = 500;
const money = (n) => Math.round(n).toLocaleString('vi-VN');

// ---------- Đọc một câu mô tả tự do thành 5 tiêu chí (không cần mô hình ngôn ngữ) ----------
const MODEL_WORDS = [
  [/trà sữa|tra sua|trà chanh|trà trái cây/, 'Trà sữa'],
  [/nhà hàng|quán ăn|nha hang|cơm|bún|phở|lẩu|nướng|bistro/, 'Nhà hàng'],
  [/tạp hoá|tạp hóa|tap hoa|thực phẩm sạch|đồ khô/, 'Tạp hoá'],
  [/tiện lợi|tien loi|minimart|mini mart|siêu thị mini/, 'Cửa hàng tiện lợi'],
  [/cà phê|ca phe|cafe|café|coffee|\bcf\b/, 'Quán cà phê']
];
const DISTRICTS = ['ocean park', 'gia lâm', 'long biên', 'cầu giấy', 'hoàn kiếm', 'đống đa', 'ba đình', 'hai bà trưng', 'thanh xuân', 'tây hồ', 'hoàng mai', 'nam từ liêm', 'bắc từ liêm', 'hà đông', 'trâu quỳ', 'đa tốn', 'kiêu kỵ', 'quận \\d+', 'thủ đức', 'bình thạnh', 'phú nhuận'];
export const ASK = {
  model: { q: 'Anh/chị định mở mô hình kinh doanh nào?', options: ['Quán cà phê', 'Trà sữa', 'Nhà hàng', 'Tạp hoá', 'Cửa hàng tiện lợi'] },
  budget: { q: 'Ngân sách thuê mỗi tháng khoảng bao nhiêu?', options: ['Dưới 30 triệu', '30–60 triệu', '60–100 triệu', 'Trên 100 triệu'] }
};

function amountPhrase(t, unitRe) {
  const num = '(\\d+(?:[.,]\\d+)?)';
  const re = new RegExp('((?:dưới|tối đa|không quá|khoảng|tầm|chừng|trên|từ|ít nhất|tối thiểu)\\s*)?' + num + '\\s*(?:(?:-|–|—|đến|tới|~)\\s*' + num + '\\s*)?' + unitRe, 'i');
  const m = t.match(re);
  if (!m) return '';
  return [(m[1] || '').trim(), m[3] ? m[2] + '–' + m[3] : m[2]].filter(Boolean).join(' ');
}
const titleCase = (s) => s.replace(/(^|\s)(\p{L})/gu, (a, sp, c) => sp + c.toUpperCase());

// prev: tiêu chí đã có (khi người dùng trả lời câu hỏi bổ sung). Trả về tiêu chí dạng chữ + mục còn thiếu.
export function parseFree(text, prev = {}) {
  const low = String(text || '').slice(0, 500).toLowerCase();
  const out = { model: '', area: '', budget: '', size: '', needs: '' };
  for (const [re, label] of MODEL_WORDS) if (re.test(low)) { out.model = label; break; }
  const b = amountPhrase(low, '(?:triệu|trieu|tr\\b|củ)');
  if (b) out.budget = b + ' triệu';
  const s = amountPhrase(low, '(?:m2|m²|mét vuông|met vuong|m vuông)');
  if (s) out.size = s + ' m²';
  const zones = [...new Set(listActive().map((l) => l.zone))];
  const zone = zones.find((z) => low.includes(z.toLowerCase()));
  let dist = null;
  for (const d of DISTRICTS) { const m = low.match(new RegExp(d)); if (m) { dist = m[0]; break; } }
  out.area = zone ? zone + ', Vinhomes Ocean Park 1' : dist ? titleCase(dist) : '';
  const needs = [];
  if (/ô tô|oto|xe hơi/.test(low)) needs.push('Cần chỗ đỗ ô tô');
  if (/xe máy|xe may|dừng xe|đỗ xe máy/.test(low)) needs.push('Đỗ xe máy được');
  if (/phân cách/.test(low)) needs.push('Tránh dải phân cách cứng');
  if (/văn phòng/.test(low)) needs.push('Gần khu văn phòng');
  if (/trường|sinh viên|học sinh/.test(low)) needs.push('Gần trường học');
  if (/bếp/.test(low)) needs.push('Cần bếp');
  out.needs = needs.join(', ');

  // Câu trả lời cho câu hỏi bổ sung: chỉ điền vào ô còn trống, giữ những gì đã có.
  const merged = {};
  for (const k of Object.keys(out)) merged[k] = String(prev[k] || '').slice(0, 120) || out[k];
  const missing = ['model', 'budget'].filter((k) => !merged[k]);
  return { criteria: merged, missing, ask: missing.length ? { key: missing[0], ...ASK[missing[0]] } : null };
}

// ---------- Lưu lượng theo giờ: ƯỚC LƯỢNG từ loại tiện ích xung quanh, không phải số đo ----------
const SLOTS = ['6–9h', '9–11h', '11–14h', '14–17h', '17–20h', '20–22h'];
const BASE = {
  cafe: [9, 6, 6, 5, 6, 4], tra_sua: [2, 3, 5, 8, 9, 7], nha_hang: [2, 2, 9, 3, 9, 5],
  tap_hoa: [6, 4, 4, 4, 8, 5], tien_loi: [5, 4, 5, 4, 8, 7]
};
export function traffic(f, model) {
  const v = [...(BASE[model] || BASE.cafe)];
  const add = (w, n) => w.forEach((x, i) => { v[i] += x * Math.min(n, 6) * 0.35; });
  add([3, 0, 1, 2, 3, 3], f.apartments);
  add([3, 0, 1, 3, 0, 0], f.schools);
  add([1, 2, 2, 2, 1, 0], f.universities);
  add([2, 0, 0, 0, 2, 0], f.busStops);
  if (f.mall && f.mall.d < 800) add([0, 1, 2, 1, 3, 3], 3);
  const max = Math.max(...v);
  const bars = v.map((x, i) => ({ label: SLOTS[i], v: Math.round((x / max) * 100) }));
  const order = bars.map((b, i) => [b.v, i]).sort((a, b) => b[0] - a[0]);
  const when = ['buổi sáng sớm', 'giữa buổi sáng', 'giờ trưa', 'buổi chiều', 'chiều tối', 'buổi tối'];
  return { bars, peak: order[0][1], text: 'Đông nhất ' + when[order[0][1]] + ', nhịp thứ hai vào ' + when[order[1][1]] + '.' };
}

// ---------- Báo cáo một mặt bằng ----------
const KIND_LABEL = { cafe: 'Cà phê, trà', restaurant: 'Nhà hàng', fast_food: 'Đồ ăn nhanh', convenience: 'Cửa hàng tiện lợi', supermarket: 'Siêu thị', apartments: 'Chung cư', school: 'Trường học', university: 'Đại học', mall: 'Vincom', bus_stop: 'Xe buýt', park: 'Công viên' };
const ROOM_PHOTOS = {
  villa: ['living-room-clean', 'exterior-garden-clean', 'apartment-living'],
  shophouse: ['apartment-living', 'nightSide', 'apartment-bedroom'],
  townhouse: ['living-room-clean', 'patio-front-clean', 'apartment-bedroom-2'],
  podium: ['apartment-living', 'top', 'kitchen-clean'],
  kiosk: ['apartment-tour', 'side', 'kitchen-clean']
};

export function report(code, raw = {}) {
  const l = getByCode(code);
  if (!l || l.status !== 'active') return null;
  const parsed = parseCriteria(raw);
  const suited = String(l.suited || 'cafe').split(';');
  const model = raw.model ? parsed.model : suited[0];
  const crit = { ...parsed, model, modelLabel: MODELS[model] };
  const r = assess(l, crit);
  const f = r.facts;

  const competitors = f.competitors.slice(0, 8).map((p) => ({
    name: p.name || 'Chưa có tên trên bản đồ', kind: KIND_LABEL[p.kind] || p.kind,
    d: Math.round(p.d), dText: fmtDist(p.d), lat: p.lat, lng: p.lng, source: 'OpenStreetMap'
  }));
  const labels = [];
  const pushLabel = (p, kind) => { if (p && p.d <= 1200) labels.push({ text: KIND_LABEL[kind] + ' · ' + fmtDist(p.d), lat: p.lat, lng: p.lng, kind, d: Math.round(p.d) }); };
  pushLabel(f.apartment, 'apartments');
  pushLabel(f.school, 'school');
  pushLabel(f.mall, 'mall');
  pushLabel(f.bus, 'bus_stop');

  const same = listActive().filter((x) => x.type === l.type);
  const ppm = same.map((x) => x.rent_million / x.area_m2).sort((a, b) => a - b);
  const medPpm = ppm.length ? ppm[Math.floor(ppm.length / 2)] : l.rent_million / l.area_m2;
  const median = Math.round(medPpm * l.area_m2 * 10) / 10;
  const diff = Math.round(((l.rent_million - median) / median) * 100);

  const access = [];
  if (l.sidewalk_m != null) access.push({ label: 'Vỉa hè trước cửa', value: String(l.sidewalk_m).replace('.', ',') + ' m' });
  access.push({ label: 'Bãi ô tô gần nhất', value: fmtDist(l.car_parking_m), warn: l.car_parking_m > 300 });
  access.push({ label: 'Chỗ để xe máy', value: 'Khoảng ' + l.moto_slots + ' xe', warn: l.moto_slots < 8 });
  access.push({ label: 'Đường một chiều', value: l.two_way ? 'Không' : 'Có', warn: !l.two_way });
  access.push({ label: 'Dải phân cách cứng', value: l.divider ? (l.uturn_m ? 'Quay đầu ' + fmtDist(l.uturn_m) : 'Có') : 'Không có', warn: !!l.divider });

  const lower1 = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);
  const want = [raw.model && 'mở ' + String(raw.model).toLowerCase(), raw.budget && 'ngân sách ' + lower1(raw.budget), raw.size && 'diện tích ' + lower1(raw.size)].filter(Boolean).join(', ');
  const message = 'Chào anh/chị, em đang tìm mặt bằng ' + (want || 'kinh doanh') + ' ở ' + PLACE + '. Mặt bằng ' + l.name + ' (mã ' + l.code + ') còn trống không ạ? Em muốn hẹn xem trực tiếp và hỏi thêm về điều khoản hợp đồng ' + l.min_term_years + ' năm.';
  const pics = ROOM_PHOTOS[l.type] || ROOM_PHOTOS.shophouse;

  return {
    code: l.code, name: l.name, short: l.name.split(',')[0] + ', ' + l.zone, zone: l.zone, type: l.type, typeLabel: TYPES[l.type],
    lat: l.lat, lng: l.lng, floors: l.floors, area: l.area_m2, rent: l.rent_million, score: r.score, parts: r.parts,
    rentText: money(l.rent_million) + ' triệu/tháng',
    model, modelLabel: MODELS[model],
    strengths: r.pros.length ? r.pros : ['Chưa có điểm mạnh nổi bật theo dữ liệu hiện có.'],
    risks: r.cons.length ? r.cons : ['Chưa ghi nhận rủi ro lớn theo dữ liệu; vẫn cần khảo sát thực địa.'],
    mainRisk: r.cons[0] || null,
    competitors, compCount: f.competitors.length, compRadius: RADIUS,
    compNote: f.competitors.length === 0 ? 'Chưa ghi nhận cơ sở cùng ngành trong 500 m trên OpenStreetMap. Dữ liệu có thể thiếu quán nhỏ, nên kiểm tra thực địa.'
      : f.competitors.length >= 3 ? 'Mật độ cùng ngành cao, cần khác biệt rõ về sản phẩm, giá hoặc không gian.' : 'Có ít cơ sở cùng ngành, vẫn còn chỗ cho mô hình mới.',
    customers: { apartments: f.apartments, schools: f.schools, universities: f.universities, busStops: f.busStops },
    labels,
    traffic: traffic(f, model),
    rentCompare: { mine: l.rent_million, median, diff, n: same.length, typeLabel: TYPES[l.type].toLowerCase() },
    access,
    photos: [{ label: 'Mặt tiền', src: '/images/' + l.image + '.webp' }, ...['Bên trong', 'Lối vào', 'Tầng trên'].map((label, i) => ({ label, src: '/images/' + pics[i] + '.webp' }))],
    message,
    osm: { date: OSM_DATE },
    simulated: true
  };
}
