// Phục vụ trang Trợ lý kiểu "báo cáo": đọc câu mô tả tự do, dựng báo cáo một căn nhà (hệ sinh thái tiện ích, một ngày của gia đình).
import { homes, TYPES, DEALS, APARTMENT_TYPES, PARKING, BUILDING_AMENITIES, DIRECTIONS, LEGAL, FURNISHED } from './db.mjs';
import { assess, parseCriteria, familyLabel, ecoGroups, dayPlan, chips, priceCompare, priceText, roundWeights, COMPONENT_LABEL, LANDMARKS, OSM_DATE, PLACE } from './engine.mjs';

// ---------- Đọc một câu mô tả tự do thành 5 tiêu chí (không cần mô hình ngôn ngữ) ----------
export const KEYS = ['home', 'budget', 'family', 'area', 'priorities'];
export const REQUIRED = ['home', 'budget', 'family'];

const BUDGET_OPTIONS = {
  mua: ['Dưới 3 tỷ', '3–5 tỷ', '5–8 tỷ', 'Trên 8 tỷ'],
  thue: ['Dưới 10 triệu', '10–20 triệu', '20–40 triệu', 'Trên 40 triệu']
};
// Câu hỏi bổ sung cho tiêu chí còn thiếu; gợi ý ngân sách đổi theo mua hay thuê.
export function askFor(key, criteria = {}) {
  if (key === 'home') return { key, q: 'Bạn muốn mua hay thuê? Căn hộ hay nhà đất?', options: ['Mua căn hộ', 'Thuê căn hộ', 'Mua nhà đất', 'Thuê nhà đất'] };
  if (key === 'budget') {
    const deal = parseCriteria({ home: criteria.home }).deal;
    return { key, q: deal === 'thue' ? 'Tiền thuê mỗi tháng khoảng bao nhiêu?' : deal === 'mua' ? 'Ngân sách mua khoảng bao nhiêu?' : 'Ngân sách khoảng bao nhiêu (giá mua hoặc tiền thuê mỗi tháng)?', options: BUDGET_OPTIONS[deal] || [...BUDGET_OPTIONS.mua.slice(0, 2), ...BUDGET_OPTIONS.thue.slice(0, 2)] };
  }
  if (key === 'family') return { key, q: 'Nhà bạn có mấy người? Các bé mấy tuổi, có ông bà ở cùng không?', options: ['Vợ chồng chưa có con', 'Có con dưới 6 tuổi', 'Có con đang đi học', 'Có ông bà ở cùng'] };
  if (key === 'area') return { key, q: 'Bạn muốn ở khu nào và đi làm ở đâu?', options: ['Ocean Park 1', 'Làm ở Long Biên', 'Làm ở Cầu Giấy', 'Làm gần nhà'] };
  return { key, q: 'Bạn cần tiện ích nào nhất?', options: ['Trường gần', 'Chợ, siêu thị', 'Công viên', 'Bệnh viện', 'Xe buýt'] };
}
function amountPhrase(t) {
  const num = '(\\d+(?:[.,]\\d+)?)';
  const re = new RegExp('((?:dưới|tối đa|không quá|khoảng|tầm|chừng|trên|từ|ít nhất|tối thiểu)\\s*)?' + num + '\\s*(?:(?:-|–|—|đến|tới|~)\\s*' + num + '\\s*)?(tỷ|ty\\b|triệu|trieu|tr\\b|củ)(\\s*\\d{1,3}\\b(?!\\s*(?:m2|m²|tuổi)))?', 'i');
  const m = t.match(re);
  if (!m) return '';
  const unit = /^t[yỷ]/.test(m[4]) ? 'tỷ' : 'triệu';
  const value = (m[3] ? m[2] + '–' + m[3] : m[2]) + (m[5] && unit === 'tỷ' ? ' tỷ' + m[5] : '');
  return [(m[1] || '').trim(), value, m[5] && unit === 'tỷ' ? '' : unit].filter(Boolean).join(' ');
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// prev: tiêu chí đã có (khi người dùng trả lời câu hỏi bổ sung). Trả về tiêu chí dạng chữ + mục còn thiếu.
export function parseFree(text, prev = {}) {
  const low = String(text || '').slice(0, 500).toLowerCase();
  const out = Object.fromEntries(KEYS.map((k) => [k, '']));

  const deal = /thuê|thue/.test(low) ? 'Thuê' : /\bmua\b/.test(low) ? 'Mua' : '';
  const kind = /chung cư|căn hộ|can ho|studio|duplex|penthouse/.test(low) ? 'căn hộ' : /nhà đất|nhà phố|liền kề|biệt thự|nhà riêng/.test(low) ? 'nhà đất' : '';
  out.home = cap([deal, kind].filter(Boolean).join(' '));
  const b = amountPhrase(low);
  if (b) out.budget = cap(b);

  const fam = [];
  if (/chưa có con|chưa con|hai vợ chồng|vợ chồng trẻ|độc thân|một mình/.test(low)) fam.push(low.match(/chưa có con|chưa con|hai vợ chồng|vợ chồng trẻ|độc thân|một mình/)[0]);
  const kids = low.match(/(?:\d+|một|hai|ba)\s*(?:đứa\s*|bé\s*)?(?:con|bé)[^,.;]{0,30}/);
  if (kids) fam.push(kids[0].trim());
  else { const k2 = low.match(/(?:có con|con nhỏ|em bé|bé)[^,.;]{0,30}/); if (k2) fam.push(k2[0].trim()); }
  const ages = low.match(/\d{1,2}\s*tuổi/g);
  if (ages && !fam.some((f) => /tuổi/.test(f))) fam.push(ages.join(' và '));
  if (/ông bà|bố mẹ già|người già|cao tuổi|ở cùng bố mẹ/.test(low)) fam.push('ông bà ở cùng');
  out.family = cap(fam.join(', '));

  const areaParts = [];
  const zones = [...new Set(homes.listActive().map((l) => l.zone))];
  const zone = zones.find((z) => low.includes(z.toLowerCase()));
  if (zone) areaParts.push(zone);
  else if (/ocean park|vinhomes/.test(low)) areaParts.push('Ocean Park 1');
  const work = low.match(/(?:đi làm|làm việc|làm ở|làm tại|\blàm\b|công ty|văn phòng|cơ quan)[^,.;]{0,40}/);
  // Lấy lại đoạn từ câu gốc để giữ chữ hoa của tên địa danh (chữ thường có cùng độ dài với chữ gốc).
  const orig = String(text || '').slice(0, 500);
  if (work && LANDMARKS.some((lm) => lm.alias.some((a) => work[0].includes(a)))) areaParts.push((orig.length === low.length ? orig.slice(work.index, work.index + work[0].length) : work[0]).trim());
  out.area = cap(areaParts.join(', '));

  const pri = [];
  if (/trường|học/.test(low) && !/đi học/.test(low)) pri.push('Trường gần');
  if (/chợ|siêu thị/.test(low)) pri.push('Chợ, siêu thị');
  if (/công viên|sân chơi|cây xanh/.test(low)) pri.push('Công viên');
  if (/bệnh viện|y tế/.test(low)) pri.push('Bệnh viện');
  if (/xe buýt|metro/.test(low)) pri.push('Xe buýt');
  if (/ô tô|xe hơi/.test(low)) pri.push('Có chỗ đỗ ô tô');
  out.priorities = pri.join(', ');

  // Câu trả lời cho câu hỏi bổ sung: chỉ điền vào ô còn trống, giữ những gì đã có.
  const merged = {};
  for (const k of KEYS) merged[k] = String(prev[k] || '').slice(0, 120) || out[k];
  const missing = missingOf(merged);
  return { criteria: merged, missing, ask: missing.length ? askFor(missing[0], merged) : null };
}

// Tiêu chí bắt buộc còn thiếu. "home" coi như đủ khi đoán được mua hay thuê (kể cả từ đơn vị ngân sách).
export function missingOf(c) {
  const crit = parseCriteria(c);
  return REQUIRED.filter((k) => {
    if (k === 'home') return !c.home && !crit.deal;
    if (k === 'budget') return !c.budget || (!crit.budget && !!crit.deal);
    return !c[k];
  });
}

// ---------- Báo cáo một căn ----------
const PHOTOS = {
  apt: ['living-room-clean', 'apartment-bedroom', 'kitchen-clean'],
  house: ['living-room-clean', 'exterior-garden-clean', 'apartment-bedroom-2']
};

export function report(code, raw = {}) {
  const l = homes.get(code);
  if (!l || l.status !== 'active') return null;
  const crit = parseCriteria(raw);
  const r = assess(l, crit);
  const apt = APARTMENT_TYPES.includes(l.type);
  const groups = ecoGroups(r);
  const day = dayPlan(r, crit);
  const pc = priceCompare(l);

  // Tiện ích gần nhất theo từng loại (bảng và bản đồ).
  const nearest = groups.flatMap((g) => g.items.filter((x) => x.nearest).map((x) => ({
    key: x.key, group: g.key, label: x.label, name: x.nearest.name, text: x.nearest.text, minutes: x.nearest.t, d: x.nearest.d,
    inside: x.nearest.inside, partial: x.nearest.partial, source: x.nearest.sourceLabel, lat: x.nearest.lat, lng: x.nearest.lng, weight: x.weight
  }))).sort((a, b) => b.weight - a.weight || a.d - b.d);

  const lower1 = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);
  const message = `Chào anh/chị, gia đình em (${familyLabel(crit)}) đang tìm ${l.deal === 'ban' ? 'mua' : 'thuê'} ${TYPES[l.type].toLowerCase()} ở ${PLACE}`
    + (raw.budget ? `, ngân sách ${lower1(raw.budget)}` : '') + `. ${l.name} (mã ${l.code}) còn ${l.deal === 'ban' ? 'bán' : 'cho thuê'} không ạ? Em muốn hẹn đi xem nhà`
    + (l.deal === 'ban' ? ' và hỏi thêm về pháp lý.' : ' và hỏi thêm về hợp đồng thuê.');
  const pics = PHOTOS[apt ? 'apt' : 'house'];

  return {
    code: l.code, name: l.name, short: l.name.split(',')[0] + ', ' + l.zone, zone: l.zone, type: l.type, typeLabel: TYPES[l.type], deal: l.deal, dealLabel: DEALS[l.deal],
    lat: l.lat, lng: l.lng, apt, floor: l.floor, floors: apt ? 1 : l.floors, area: l.area_m2, bedrooms: l.bedrooms, score: r.score, parts: r.parts, groups: r.groups,
    priceText: priceText(l),
    family: familyLabel(crit), weights: roundWeights(r.weights.components), componentLabels: COMPONENT_LABEL,
    // Nhận định (ưu điểm, điều cần kiểm chứng) chỉ hiện ở trang hồ sơ, xem profile() trong engine.mjs.
    eco: groups, nearest, day, chips: chips(r),
    inside: r.eco.inside.map((a) => ({ key: a, label: BUILDING_AMENITIES[a] })),
    commute: r.commute ? r.commute.trips : [],
    priceCompare: pc,
    // Thông số căn, để giao diện vẽ thành biểu tượng (không phải câu chữ).
    home: {
      area: l.area_m2, bedrooms: l.bedrooms, bathrooms: l.bathrooms, floor: l.floor, floors: l.floors, apt,
      direction: l.direction, directionLabel: DIRECTIONS[l.direction] || null,
      legal: l.deal === 'ban' ? l.legal : null, legalLabel: l.deal === 'ban' ? LEGAL[l.legal] : null,
      furnished: l.furnished, furnishedLabel: FURNISHED[l.furnished] || null,
      parking: l.car_parking, parkingLabel: PARKING[l.car_parking] || null,
      elevator: apt || !!l.elevator, yard: l.yard_m2 || 0, mgmtFee: l.mgmt_fee
    },
    bus: r.items.xe_buyt && r.items.xe_buyt.nearest ? { d: r.items.xe_buyt.nearest.d, text: r.items.xe_buyt.nearest.text, name: r.items.xe_buyt.nearest.name } : null,
    photos: [{ label: apt ? 'Phòng khách' : 'Mặt tiền', src: '/images/' + l.image + '.webp' }, ...['Bên trong', apt ? 'Phòng ngủ' : 'Sân vườn', 'Bếp'].map((label, i) => ({ label, src: '/images/' + pics[i] + '.webp' }))],
    message,
    osm: { date: OSM_DATE },
    simulated: true
  };
}
