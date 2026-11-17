// Cơ sở dữ liệu SQLite (node:sqlite có sẵn trong Node 22, không cần thư viện ngoài).
// File nằm ở DB_PATH (trên VPS: volume Docker /data). Bảng trống được nạp từ file CSV mẫu trong data/.
//   homes        căn nhà (căn hộ, nhà đất; bán hoặc cho thuê)        ← data/homes.csv
//   buildings    toà chung cư: tiện ích nội khu, phí dịch vụ         ← data/buildings.csv
//   pois_manual  tiện ích nhập tay, hoặc sửa / ẩn điểm OpenStreetMap  ← data/pois_manual.csv
// Bảng `listings` (mặt bằng kinh doanh, chủ đề cũ) không còn được dùng; để nguyên, không xoá.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POI_KINDS, SCHOOL_LEVELS } from './poi-kinds.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DB_PATH = process.env.DB_PATH || here('./data/local.db');

// ---------- Giá trị cho các cột chọn ----------
export const TYPES = { can_ho: 'Căn hộ', studio: 'Căn hộ studio', duplex: 'Căn hộ duplex', penthouse: 'Penthouse', nha_pho: 'Nhà phố', lien_ke: 'Nhà liền kề', biet_thu: 'Biệt thự' };
export const APARTMENT_TYPES = ['can_ho', 'studio', 'duplex', 'penthouse'];
export const DEALS = { ban: 'Bán', thue: 'Cho thuê' };
export const DIRECTIONS = { dong: 'Đông', tay: 'Tây', nam: 'Nam', bac: 'Bắc', dong_nam: 'Đông Nam', dong_bac: 'Đông Bắc', tay_nam: 'Tây Nam', tay_bac: 'Tây Bắc' };
export const LEGAL = { so_hong: 'Đã có sổ hồng', cho_so: 'Đang chờ sổ', hdmb: 'Hợp đồng mua bán' };
export const FURNISHED = { tho: 'Bàn giao thô', co_ban: 'Nội thất cơ bản', day_du: 'Đủ nội thất' };
export const PARKING = { ham: 'Hầm để xe trong toà', truoc_nha: 'Đỗ trước nhà', gan: 'Bãi đỗ gần', khong: 'Không có chỗ đỗ ô tô' };
export const BUILDING_AMENITIES = { be_boi: 'Bể bơi', gym: 'Phòng gym', san_choi: 'Sân chơi trẻ em', vuon: 'Vườn nội khu', mam_non: 'Lớp mầm non trong toà', tien_loi: 'Cửa hàng tiện lợi dưới toà' };

const STATUS = { type: 'enum', label: 'Trạng thái', values: ['active', 'hidden'], def: 'active' };
const UPDATED = { type: 'text', label: 'Cập nhật', pattern: /^\d{4}-\d{2}-\d{2}$/ };
const CODE = { type: 'text', label: 'Mã', required: true, pattern: /^[A-Z0-9.-]{2,20}$/ };
const LAT = { type: 'num', label: 'Vĩ độ', min: 20.9, max: 21.1 };
const LNG = { type: 'num', label: 'Kinh độ', min: 105.8, max: 106.05 };

// Mô tả từng cột: kiểu, giới hạn, nhãn tiếng Việt (dùng cho kiểm tra dữ liệu, CSV và trang quản trị).
export const FIELDS = {
  code: CODE,
  name: { type: 'text', label: 'Tên', required: true, max: 120 },
  zone: { type: 'text', label: 'Phân khu', required: true, max: 60 },
  type: { type: 'enum', label: 'Loại nhà', required: true, values: Object.keys(TYPES) },
  deal: { type: 'enum', label: 'Hình thức', required: true, values: Object.keys(DEALS) },
  building: { type: 'text', label: 'Mã toà (căn hộ)', max: 20, pattern: /^[A-Z0-9.-]{2,20}$/ },
  lat: { ...LAT, label: 'Vĩ độ (trống thì lấy theo toà)' },
  lng: { ...LNG, label: 'Kinh độ (trống thì lấy theo toà)' },
  area_m2: { type: 'num', label: 'Diện tích (m²)', required: true, min: 10, max: 2000 },
  bedrooms: { type: 'int', label: 'Phòng ngủ', required: true, min: 0, max: 10 },
  bathrooms: { type: 'int', label: 'Phòng tắm', min: 0, max: 10, def: 1 },
  floor: { type: 'int', label: 'Tầng của căn (căn hộ)', min: 0, max: 80 },
  floors: { type: 'int', label: 'Số tầng (nhà đất)', min: 1, max: 10 },
  direction: { type: 'enum', label: 'Hướng', values: Object.keys(DIRECTIONS) },
  price_billion: { type: 'num', label: 'Giá bán (tỷ)', min: 0.1, max: 1000 },
  rent_million: { type: 'num', label: 'Giá thuê (triệu/tháng)', min: 1, max: 1000 },
  legal: { type: 'enum', label: 'Pháp lý (căn bán)', values: Object.keys(LEGAL) },
  furnished: { type: 'enum', label: 'Nội thất', values: Object.keys(FURNISHED), def: 'co_ban' },
  mgmt_fee: { type: 'num', label: 'Phí dịch vụ (nghìn đ/m²/tháng, trống thì lấy theo toà)', min: 0, max: 200 },
  car_parking: { type: 'enum', label: 'Chỗ đỗ ô tô', values: Object.keys(PARKING), def: 'gan' },
  elevator: { type: 'bool', label: 'Có thang máy', def: 0 },
  yard_m2: { type: 'num', label: 'Sân vườn (m²)', min: 0, max: 2000, def: 0 },
  image: { type: 'text', label: 'Ảnh', max: 60, pattern: /^[A-Za-z0-9-]+$/, def: 'apartment-living' },
  status: STATUS,
  updated: UPDATED,
  note: { type: 'text', label: 'Ghi chú', max: 300, def: '' }
};

export const BUILDING_FIELDS = {
  code: CODE,
  name: { type: 'text', label: 'Tên toà', required: true, max: 80 },
  zone: { type: 'text', label: 'Dự án / phân khu', required: true, max: 60 },
  lat: { ...LAT, required: true },
  lng: { ...LNG, required: true },
  handover_year: { type: 'int', label: 'Năm bàn giao', min: 1990, max: 2100 },
  amenities: { type: 'list', label: 'Tiện ích nội khu', values: Object.keys(BUILDING_AMENITIES), optional: true },
  mgmt_fee: { type: 'num', label: 'Phí dịch vụ (nghìn đ/m²/tháng)', min: 0, max: 200 },
  status: STATUS,
  note: { type: 'text', label: 'Ghi chú', max: 300, def: '' }
};

// Một dòng tiện ích nhập tay. Có osm_id: sửa hoặc ẩn (hidden = 1) điểm OpenStreetMap đó. Không có: thêm điểm mới.
export const POI_FIELDS = {
  code: CODE,
  osm_id: { type: 'text', label: 'Mã điểm OSM (để sửa / ẩn)', max: 24, pattern: /^[nwr]\d{1,15}$/ },
  kind: { type: 'enum', label: 'Loại tiện ích', required: true, values: Object.keys(POI_KINDS) },
  level: { type: 'enum', label: 'Cấp học (trường phổ thông)', values: Object.keys(SCHOOL_LEVELS), def: '' },
  name: { type: 'text', label: 'Tên', max: 120, def: '' },
  lat: { ...LAT, required: true },
  lng: { ...LNG, required: true },
  verified: { type: 'bool', label: 'Đã kiểm chứng tại chỗ', def: 0 },
  hidden: { type: 'bool', label: 'Ẩn điểm OSM này', def: 0 },
  status: STATUS,
  note: { type: 'text', label: 'Ghi chú', max: 300, def: '' }
};

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');

export class ValidationError extends Error {
  constructor(errors) { super('Dữ liệu không hợp lệ'); this.errors = errors; this.status = 400; }
}

// Kiểm tra và chuẩn hoá một dòng theo bộ mô tả cột; trả về đối tượng sạch hoặc ném ValidationError { cột: lỗi }.
function cleanRow(fields, input) {
  const out = {};
  const errors = {};
  for (const [k, f] of Object.entries(fields)) {
    let v = input[k];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (f.required) { errors[k] = 'Bắt buộc'; continue; }
      if (k === 'updated') { out[k] = new Date().toISOString().slice(0, 10); continue; }
      out[k] = f.def ?? null;
      continue;
    }
    if (f.type === 'num' || f.type === 'int') {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || (f.type === 'int' && !Number.isInteger(n))) { errors[k] = 'Phải là số' + (f.type === 'int' ? ' nguyên' : ''); continue; }
      if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { errors[k] = `Trong khoảng ${f.min}–${f.max}`; continue; }
      out[k] = n;
    } else if (f.type === 'bool') {
      out[k] = ['1', 'true', 'có', 'co', 'yes', 'x'].includes(String(v).toLowerCase()) ? 1 : 0;
    } else if (f.type === 'enum') {
      if (!f.values.includes(v)) { errors[k] = 'Một trong: ' + f.values.filter(Boolean).join(', '); continue; }
      out[k] = v;
    } else if (f.type === 'list') {
      const items = (Array.isArray(v) ? v : String(v).split(/[;,|]/)).map((s) => String(s).trim()).filter(Boolean);
      const bad = items.filter((s) => !f.values.includes(s));
      if (bad.length || (!items.length && !f.optional)) { errors[k] = 'Chọn trong: ' + f.values.join(', '); continue; }
      out[k] = [...new Set(items)].join(';');
    } else {
      const s = String(v);
      if (f.max && s.length > f.max) { errors[k] = `Tối đa ${f.max} ký tự`; continue; }
      if (f.pattern && !f.pattern.test(s)) { errors[k] = 'Sai định dạng'; continue; }
      out[k] = s;
    }
  }
  if (typeof out.code === 'string') out.code = out.code.toUpperCase();
  return { out, errors };
}

const SQL_TYPE = { num: 'REAL', int: 'INTEGER', bool: 'INTEGER', text: 'TEXT', enum: 'TEXT', list: 'TEXT' };

// Một bảng có khoá `code`, kiểm tra theo `fields`, nhập / xuất CSV, nạp mẫu khi trống.
function makeTable(name, fields, { seed, check } = {}) {
  const columns = Object.keys(fields);
  db.exec(`CREATE TABLE IF NOT EXISTS ${name} (id INTEGER PRIMARY KEY, ${columns.map((c) => `${c} ${SQL_TYPE[fields[c].type]}${c === 'code' ? ' NOT NULL UNIQUE' : ''}`).join(', ')})`);
  const have = new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name));
  for (const c of columns) if (!have.has(c)) db.exec(`ALTER TABLE ${name} ADD COLUMN ${c} ${SQL_TYPE[fields[c].type]}`);

  const st = {
    all: db.prepare(`SELECT * FROM ${name} ORDER BY code`),
    active: db.prepare(`SELECT * FROM ${name} WHERE status = 'active' ORDER BY code`),
    byCode: db.prepare(`SELECT * FROM ${name} WHERE code = ?`),
    insert: db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map((c) => ':' + c).join(',')})`),
    update: db.prepare(`UPDATE ${name} SET ${columns.filter((c) => c !== 'code').map((c) => `${c} = :${c}`).join(', ')} WHERE code = :code`),
    remove: db.prepare(`DELETE FROM ${name} WHERE code = ?`),
    count: db.prepare(`SELECT COUNT(*) AS n FROM ${name}`)
  };
  let version = 0; // tăng mỗi lần ghi, để nơi khác biết cần tính lại bộ đệm

  const t = {
    name, fields, columns,
    get version() { return version; },
    clean(input) {
      const { out, errors } = cleanRow(fields, input);
      if (check) check(out, errors);
      if (Object.keys(errors).length) throw new ValidationError(errors);
      return out;
    },
    listAll: () => st.all.all(),
    listActive: () => st.active.all(),
    get: (code) => st.byCode.get(String(code || '').toUpperCase()) || null,
    upsert(input) {
      const row = t.clean(input);
      if (t.get(row.code)) st.update.run(row); else st.insert.run(row);
      version++;
      return t.get(row.code);
    },
    remove(code) {
      const ok = st.remove.run(String(code).toUpperCase()).changes > 0;
      if (ok) version++;
      return ok;
    },
    toCsv: (rows = st.all.all()) => toCsv(columns, rows),
    // Nhập nhiều dòng trong một giao dịch: lỗi ở bất kỳ dòng nào thì không ghi gì cả.
    importRows(records, { replace = false } = {}) {
      const cleaned = [];
      const errors = [];
      records.forEach((r, i) => {
        try { cleaned.push(t.clean(r)); } catch (e) { errors.push({ line: i + 2, code: r.code || '', errors: e.errors || { _: e.message } }); }
      });
      const codes = cleaned.map((r) => r.code);
      const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
      if (dup.length) errors.push({ line: 0, code: dup[0], errors: { code: 'Mã bị trùng trong file' } });
      if (errors.length) return { ok: false, errors };
      db.exec('BEGIN');
      try {
        if (replace) db.exec(`DELETE FROM ${name}`);
        let inserted = 0, updated = 0;
        for (const row of cleaned) {
          if (t.get(row.code)) { st.update.run(row); updated++; } else { st.insert.run(row); inserted++; }
        }
        db.exec('COMMIT');
        version++;
        return { ok: true, inserted, updated, total: st.count.get().n };
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    seedIfEmpty() {
      if (!seed || st.count.get().n > 0) return;
      const r = t.importRows(parseCsv(readFileSync(here('./data/' + seed), 'utf8')));
      console.log(r.ok ? `Đã nạp ${r.inserted} dòng mẫu vào ${name} từ data/${seed}` : `Lỗi nạp mẫu ${name}: ` + JSON.stringify(r.errors));
    }
  };
  return t;
}

export const buildings = makeTable('buildings', BUILDING_FIELDS, { seed: 'buildings.csv' });

export const homes = makeTable('homes', FIELDS, {
  seed: 'homes.csv',
  check(row, errors) {
    if (row.building) {
      const b = buildings.get(row.building);
      if (!b) errors.building = 'Không có toà ' + row.building;
      else {
        if (row.lat == null) row.lat = b.lat;
        if (row.lng == null) row.lng = b.lng;
        if (row.mgmt_fee == null) row.mgmt_fee = b.mgmt_fee;
      }
    }
    if (row.lat == null && !errors.lat) errors.lat = 'Bắt buộc khi không có mã toà';
    if (row.lng == null && !errors.lng) errors.lng = 'Bắt buộc khi không có mã toà';
    if (row.deal === 'ban' && row.price_billion == null) errors.price_billion = 'Căn bán cần giá bán';
    if (row.deal === 'thue' && row.rent_million == null) errors.rent_million = 'Căn cho thuê cần giá thuê';
    if (row.deal === 'ban' && !row.legal) errors.legal = 'Căn bán cần ghi pháp lý';
    if (APARTMENT_TYPES.includes(row.type) && row.floor == null) errors.floor = 'Căn hộ cần ghi tầng';
    if (!APARTMENT_TYPES.includes(row.type) && row.floors == null) errors.floors = 'Nhà đất cần ghi số tầng';
  }
});

export const poisManual = makeTable('pois_manual', POI_FIELDS, {
  seed: 'pois_manual.csv',
  check(row, errors) {
    if (row.kind !== 'school') row.level = '';
    if (row.hidden && !row.osm_id) errors.hidden = 'Chỉ ẩn được điểm OSM (cần mã điểm OSM)';
    if (!row.hidden && !row.name) errors.name = 'Bắt buộc với điểm không ẩn';
  }
});

buildings.seedIfEmpty();
homes.seedIfEmpty();
poisManual.seedIfEmpty();

// Tên ngắn dùng ở các module khác (căn nhà là dữ liệu chính).
export const listAll = homes.listAll;
export const listActive = homes.listActive;
export const getByCode = homes.get;

// ---------- CSV (RFC 4180 đơn giản: dấu phẩy, ngoặc kép, xuống dòng trong ngoặc) ----------
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function toCsv(columns, rows) {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}
