// Cơ sở dữ liệu SQLite (node:sqlite có sẵn trong Node 22, không cần thư viện ngoài).
// File nằm ở DB_PATH (trên VPS: volume Docker /data). Lần chạy đầu, bảng trống sẽ được nạp từ data/listings.csv.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DB_PATH = process.env.DB_PATH || here('./data/local.db');

// Mô tả từng cột: kiểu, giới hạn, nhãn tiếng Việt (dùng cho kiểm tra dữ liệu, CSV và trang quản trị).
export const TYPES = { villa: 'Biệt thự', shophouse: 'Shophouse', townhouse: 'Nhà phố', podium: 'Khối đế chung cư', kiosk: 'Ki-ốt' };
export const MODELS = { cafe: 'Quán cà phê', tra_sua: 'Trà sữa', nha_hang: 'Nhà hàng', tap_hoa: 'Tạp hoá', tien_loi: 'Cửa hàng tiện lợi' };
export const FIELDS = {
  code: { type: 'text', label: 'Mã', required: true, pattern: /^[A-Z0-9-]{2,20}$/ },
  name: { type: 'text', label: 'Tên', required: true, max: 120 },
  zone: { type: 'text', label: 'Phân khu', required: true, max: 60 },
  type: { type: 'enum', label: 'Loại', required: true, values: Object.keys(TYPES) },
  lat: { type: 'num', label: 'Vĩ độ', required: true, min: 20.9, max: 21.1 },
  lng: { type: 'num', label: 'Kinh độ', required: true, min: 105.8, max: 106.05 },
  area_m2: { type: 'num', label: 'Diện tích (m²)', required: true, min: 5, max: 5000 },
  floors: { type: 'int', label: 'Số tầng', min: 1, max: 10, def: 1 },
  frontage_m: { type: 'num', label: 'Mặt tiền (m)', min: 0, max: 100, def: 0 },
  road_m: { type: 'num', label: 'Lòng đường (m)', min: 0, max: 100, def: 0 },
  rent_million: { type: 'num', label: 'Giá thuê (triệu/tháng)', required: true, min: 1, max: 2000 },
  deposit_months: { type: 'int', label: 'Đặt cọc (tháng)', min: 0, max: 24, def: 3 },
  min_term_years: { type: 'int', label: 'Hợp đồng tối thiểu (năm)', min: 0, max: 20, def: 2 },
  divider: { type: 'bool', label: 'Có dải phân cách cứng', def: 0 },
  two_way: { type: 'bool', label: 'Đường hai chiều', def: 1 },
  car_parking_m: { type: 'int', label: 'Bãi đỗ ô tô gần nhất (m)', min: 0, max: 5000, def: 300 },
  moto_slots: { type: 'int', label: 'Chỗ để xe máy', min: 0, max: 500, def: 0 },
  yard_m2: { type: 'num', label: 'Sân (m²)', min: 0, max: 2000, def: 0 },
  kitchen: { type: 'bool', label: 'Đã có bếp', def: 0 },
  suited: { type: 'list', label: 'Mô hình phù hợp', values: Object.keys(MODELS), def: 'cafe' },
  image: { type: 'text', label: 'Ảnh', max: 60, pattern: /^[A-Za-z0-9-]+$/, def: 'landscape-house-clean' },
  status: { type: 'enum', label: 'Trạng thái', values: ['active', 'hidden'], def: 'active' },
  updated: { type: 'text', label: 'Cập nhật', pattern: /^\d{4}-\d{2}-\d{2}$/ },
  note: { type: 'text', label: 'Ghi chú', max: 300, def: '' }
};
export const COLUMNS = Object.keys(FIELDS);

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
db.exec(`CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, zone TEXT NOT NULL, type TEXT NOT NULL,
  lat REAL NOT NULL, lng REAL NOT NULL, area_m2 REAL NOT NULL, floors INTEGER, frontage_m REAL, road_m REAL,
  rent_million REAL NOT NULL, deposit_months INTEGER, min_term_years INTEGER, divider INTEGER, two_way INTEGER,
  car_parking_m INTEGER, moto_slots INTEGER, yard_m2 REAL, kitchen INTEGER, suited TEXT, image TEXT,
  status TEXT NOT NULL DEFAULT 'active', updated TEXT, note TEXT
)`);

export class ValidationError extends Error {
  constructor(errors) { super('Dữ liệu không hợp lệ'); this.errors = errors; this.status = 400; }
}

// Kiểm tra và chuẩn hoá một mặt bằng; trả về đối tượng sạch hoặc ném ValidationError { cột: lỗi }.
export function clean(input) {
  const out = {};
  const errors = {};
  for (const [k, f] of Object.entries(FIELDS)) {
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
      if (!f.values.includes(v)) { errors[k] = 'Một trong: ' + f.values.join(', '); continue; }
      out[k] = v;
    } else if (f.type === 'list') {
      const items = (Array.isArray(v) ? v : String(v).split(/[;,|]/)).map((s) => String(s).trim()).filter(Boolean);
      const bad = items.filter((s) => !f.values.includes(s));
      if (!items.length || bad.length) { errors[k] = 'Chọn trong: ' + f.values.join(', '); continue; }
      out[k] = [...new Set(items)].join(';');
    } else {
      const s = String(v);
      if (f.max && s.length > f.max) { errors[k] = `Tối đa ${f.max} ký tự`; continue; }
      if (f.pattern && !f.pattern.test(s)) { errors[k] = 'Sai định dạng'; continue; }
      out[k] = s;
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

const insertSql = `INSERT INTO listings (${COLUMNS.join(',')}) VALUES (${COLUMNS.map((c) => ':' + c).join(',')})`;
const updateSql = `UPDATE listings SET ${COLUMNS.filter((c) => c !== 'code').map((c) => `${c} = :${c}`).join(', ')} WHERE code = :code`;
const stmts = {
  all: db.prepare('SELECT * FROM listings ORDER BY code'),
  active: db.prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY code"),
  byCode: db.prepare('SELECT * FROM listings WHERE code = ?'),
  insert: db.prepare(insertSql),
  update: db.prepare(updateSql),
  remove: db.prepare('DELETE FROM listings WHERE code = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM listings')
};

export const listAll = () => stmts.all.all();
export const listActive = () => stmts.active.all();
export const getByCode = (code) => stmts.byCode.get(String(code || '').toUpperCase()) || null;

export function upsert(input) {
  const row = clean(input);
  if (getByCode(row.code)) stmts.update.run(row); else stmts.insert.run(row);
  return getByCode(row.code);
}
export function remove(code) {
  return stmts.remove.run(String(code).toUpperCase()).changes > 0;
}

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

export function toCsv(rows) {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

// Nhập nhiều dòng trong một giao dịch: lỗi ở bất kỳ dòng nào thì không ghi gì cả.
export function importRows(records, { replace = false } = {}) {
  const cleaned = [];
  const errors = [];
  records.forEach((r, i) => {
    try { cleaned.push(clean(r)); } catch (e) { errors.push({ line: i + 2, code: r.code || '', errors: e.errors || { _: e.message } }); }
  });
  const codes = cleaned.map((r) => r.code);
  const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dup.length) errors.push({ line: 0, code: dup[0], errors: { code: 'Mã bị trùng trong file' } });
  if (errors.length) return { ok: false, errors };
  db.exec('BEGIN');
  try {
    if (replace) db.exec('DELETE FROM listings');
    let inserted = 0, updated = 0;
    for (const row of cleaned) {
      if (getByCode(row.code)) { stmts.update.run(row); updated++; } else { stmts.insert.run(row); inserted++; }
    }
    db.exec('COMMIT');
    return { ok: true, inserted, updated, total: stmts.count.get().n };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Lần chạy đầu: nạp dữ liệu mẫu.
if (stmts.count.get().n === 0) {
  const r = importRows(parseCsv(readFileSync(here('./data/listings.csv'), 'utf8')));
  console.log(r.ok ? `Đã nạp ${r.inserted} mặt bằng mẫu từ data/listings.csv` : 'Lỗi nạp dữ liệu mẫu: ' + JSON.stringify(r.errors));
}
