// Yêu cầu xem nhà / liên hệ chủ nhà: lưu vào SQLite, báo cho nhóm qua Telegram, quản lý ở trang quản trị.
// Có thông tin cá nhân (họ tên, số điện thoại): chỉ nhận khi người dùng đồng ý, không ghi vào log.
import { createHash, randomBytes } from 'node:crypto';
import { db, getByCode } from './db.mjs';

db.exec(`CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  created TEXT NOT NULL,
  code TEXT, listing TEXT,
  name TEXT NOT NULL, phone TEXT NOT NULL, role TEXT, visit_date TEXT,
  message TEXT, source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', note TEXT DEFAULT '',
  ip_hash TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY, created TEXT NOT NULL, criteria TEXT NOT NULL, codes TEXT NOT NULL
)`);

export const LEAD_STATUS = { new: 'Mới', called: 'Đã gọi', scheduled: 'Đã hẹn xem nhà', closed: 'Đã đóng' };
const ROLES = ['Người mua', 'Người thuê', 'Người thân của người mua, thuê', 'Môi giới', 'Khác'];

export class LeadError extends Error {
  constructor(errors, status = 400) { super('Thông tin chưa hợp lệ'); this.errors = errors; this.status = status; }
}

// 0901 234 567, 0901.234.567, +84 901 234 567, 84901234567 → 0901234567
export function normPhone(v) {
  let d = String(v || '').replace(/[\s.\-()]/g, '');
  if (d.startsWith('+84')) d = '0' + d.slice(3);
  else if (/^84\d{9}$/.test(d)) d = '0' + d.slice(2);
  return d;
}
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const ipHash = (ip) => createHash('sha256').update('es-lead:' + ip).digest('hex').slice(0, 16);

// ---------- Chống spam: mỗi IP 5 yêu cầu / giờ, toàn hệ thống 200 / ngày ----------
const byIp = new Map();
let day = '', dayCount = 0;
function allow(ip) {
  const now = Date.now();
  const l = (byIp.get(ip) || []).filter((t) => now - t < 3600000);
  if (l.length >= 5) return false;
  const d = today();
  if (d !== day) { day = d; dayCount = 0; }
  if (dayCount >= 200) return false;
  l.push(now); byIp.set(ip, l); dayCount++;
  return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of byIp) if (!l.some((t) => now - t < 3600000)) byIp.delete(ip); }, 600000).unref();

const insert = db.prepare('INSERT INTO leads (created, code, listing, name, phone, role, visit_date, message, source, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)');
const recentDup = db.prepare("SELECT id FROM leads WHERE phone = ? AND IFNULL(code,'') = ? AND created > ?");

export async function createLead(body, ip) {
  // Ô bẫy ẩn: bot điền vào thì giả vờ thành công, không lưu.
  if (body.website) return { ok: true };
  const e = {};
  const name = String(body.name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) e.name = 'Nhập họ và tên (2–80 ký tự).';
  const phone = normPhone(body.phone);
  if (!/^0\d{9}$/.test(phone)) e.phone = 'Số điện thoại cần đủ 10 chữ số, ví dụ 0901 234 567.';
  const role = ROLES.includes(body.role) ? body.role : 'Khác';
  const date = String(body.date || '');
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today())) e.date = 'Chọn một ngày từ hôm nay trở đi.';
  const message = String(body.message || '').slice(0, 1000).trim();
  if (body.consent !== true) e.consent = 'Cần đồng ý để nhóm estateSmartAI liên hệ lại.';
  const code = body.code ? String(body.code).toUpperCase().slice(0, 20) : '';
  const listing = code ? getByCode(code) : null;
  if (code && !listing) e.code = 'Không tìm thấy căn nhà.';
  if (Object.keys(e).length) throw new LeadError(e);
  if (!allow(ip)) throw new LeadError({ _: 'Anh/chị đã gửi nhiều yêu cầu, vui lòng thử lại sau.' }, 429);

  const source = body.source === 'owner_msg' ? 'owner_msg' : 'visit_form';
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  if (recentDup.get(phone, code, since)) return { ok: true, duplicate: true };
  const r = insert.run(nowIso(), code || null, listing ? listing.name : null, name, phone, role, date || null, message || null, source, ipHash(ip));
  const lead = { id: Number(r.lastInsertRowid), code, listing: listing ? listing.name : '', name, phone, role, date, message, source };
  console.log(new Date().toISOString(), 'yêu cầu mới #' + lead.id, code || '(không mã)', source);
  notifyTelegram(lead).catch((err) => console.error('Telegram lỗi:', err.message));
  return { ok: true, id: lead.id };
}

// ---------- Telegram ----------
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const telegramEnabled = () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
async function notifyTelegram(l) {
  if (!telegramEnabled()) return;
  const site = process.env.SITE_URL || 'https://estatesmart.site';
  const lines = [
    `<b>${l.source === 'owner_msg' ? 'Tin nhắn gửi chủ nhà' : 'Yêu cầu xem nhà'} #${l.id}</b>`,
    l.code ? `Căn: <b>${esc(l.code)}</b> · ${esc(l.listing)}` : null,
    `Khách: ${esc(l.name)} (${esc(l.role)})`,
    `Điện thoại: <code>${esc(l.phone)}</code>`,
    l.date ? `Ngày muốn xem: ${esc(l.date.split('-').reverse().join('/'))}` : null,
    l.message ? `Lời nhắn: ${esc(l.message.slice(0, 600))}` : null,
    `Quản lý: ${site}/quan-tri/`
  ].filter(Boolean);
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
}

// ---------- Quản trị ----------
export const listLeads = () => db.prepare('SELECT id, created, code, listing, name, phone, role, visit_date, message, source, status, note FROM leads ORDER BY id DESC LIMIT 2000').all();
export const countNewLeads = () => db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'").get().n;
export function updateLead(id, body) {
  const cur = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!cur) return null;
  const status = LEAD_STATUS[body.status] ? body.status : cur.status;
  const note = body.note !== undefined ? String(body.note).slice(0, 1000) : cur.note;
  db.prepare('UPDATE leads SET status = ?, note = ? WHERE id = ?').run(status, note, id);
  return db.prepare('SELECT id, created, code, listing, name, phone, role, visit_date, message, source, status, note FROM leads WHERE id = ?').get(id);
}
export const deleteLead = (id) => db.prepare('DELETE FROM leads WHERE id = ?').run(id).changes > 0;
export function leadsCsv() {
  const cols = ['id', 'created', 'code', 'listing', 'name', 'phone', 'role', 'visit_date', 'message', 'source', 'status', 'note'];
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.join(','), ...listLeads().map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n';
}

// ---------- Chia sẻ kết quả bằng link ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const shareId = () => Array.from(randomBytes(10), (b) => ALPHA[b % ALPHA.length]).join('');
export function createShare(criteria, codes) {
  const id = shareId();
  db.prepare('INSERT INTO shares (id, created, criteria, codes) VALUES (?,?,?,?)').run(id, nowIso(), JSON.stringify(criteria), JSON.stringify(codes));
  return id;
}
export function getShare(id) {
  if (!/^[A-Za-z0-9]{6,20}$/.test(String(id))) return null;
  const r = db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
  if (!r) return null;
  // Link hết hạn sau 90 ngày.
  if (Date.now() - Date.parse(r.created) > 90 * 86400000) return null;
  return { id: r.id, created: r.created, criteria: JSON.parse(r.criteria), codes: JSON.parse(r.codes) };
}
