// Trang quản trị: đăng nhập bằng mật khẩu (ADMIN_PASSWORD), phiên lưu trong bộ nhớ, cookie HttpOnly.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { listAll, upsert, remove, getByCode, parseCsv, toCsv, importRows, FIELDS, TYPES, MODELS, ValidationError } from './db.mjs';

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_MS = 8 * 3600 * 1000;
const COOKIE = 'es_admin';
const sessions = new Map(); // token → hết hạn (ms)
const fails = new Map(); // ip → [mốc thời gian đăng nhập sai]
let globalFails = [];

export const adminEnabled = () => PASSWORD.length >= 12;
const sha = (s) => createHash('sha256').update(String(s)).digest();

function cookieToken(req) {
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{20,})'));
  return m ? m[1] : null;
}
export function isAdmin(req) {
  const t = cookieToken(req);
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function setCookie(req, res, token, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('set-cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure}`);
}

setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
  for (const [ip, list] of fails) { const l = list.filter((x) => now - x < 15 * 60000); if (l.length) fails.set(ip, l); else fails.delete(ip); }
  globalFails = globalFails.filter((x) => now - x < 3600000);
}, 60000).unref();

// Trả về [status, body] hoặc gửi trực tiếp (export CSV). ctx: { req, res, ip, path, method, body() }
export async function handleAdmin(ctx) {
  const { req, res, ip, method } = ctx;
  const path = ctx.path.replace(/^\/api\/admin/, '') || '/';
  if (!adminEnabled()) return [503, { error: 'Trang quản trị chưa được bật (thiếu ADMIN_PASSWORD trên máy chủ).' }];

  if (method === 'POST' && path === '/login') {
    const now = Date.now();
    const mine = (fails.get(ip) || []).filter((x) => now - x < 15 * 60000);
    globalFails = globalFails.filter((x) => now - x < 3600000);
    if (mine.length >= 5 || globalFails.length >= 50) {
      res.setHeader('retry-after', '900');
      return [429, { error: 'Sai mật khẩu quá nhiều lần, thử lại sau 15 phút.' }];
    }
    const { password } = await ctx.body();
    if (typeof password !== 'string' || !timingSafeEqual(sha(password), sha(PASSWORD))) {
      mine.push(now); fails.set(ip, mine); globalFails.push(now);
      await new Promise((r) => setTimeout(r, 400)); // làm chậm dò mật khẩu
      console.warn(new Date().toISOString(), 'đăng nhập quản trị sai từ', ip);
      return [401, { error: 'Mật khẩu không đúng.' }];
    }
    if (sessions.size >= 50) sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, now + SESSION_MS);
    setCookie(req, res, token, SESSION_MS / 1000);
    console.log(new Date().toISOString(), 'đăng nhập quản trị từ', ip);
    return [200, { ok: true }];
  }

  if (method === 'POST' && path === '/logout') {
    const t = cookieToken(req);
    if (t) sessions.delete(t);
    setCookie(req, res, '', 0);
    return [200, { ok: true }];
  }

  if (!isAdmin(req)) return [401, { error: 'Cần đăng nhập.' }];

  if (method === 'GET' && path === '/me') return [200, { ok: true }];

  if (method === 'GET' && path === '/listings') {
    const fields = Object.entries(FIELDS).map(([k, f]) => ({ key: k, label: f.label, type: f.type, required: !!f.required, values: f.values || null, min: f.min, max: f.max }));
    return [200, { listings: listAll(), fields, types: TYPES, models: MODELS }];
  }

  const m = path.match(/^\/listings\/([A-Za-z0-9-]{2,20})$/);
  if (m && method === 'PUT') {
    const code = m[1].toUpperCase();
    const body = await ctx.body();
    const isNew = !getByCode(code);
    if (isNew && body.create !== true) return [404, { error: 'Không tìm thấy mặt bằng ' + code }];
    if (!isNew && body.create === true) return [409, { error: 'Mã ' + code + ' đã tồn tại.' }];
    try {
      const row = upsert({ ...body.listing, code });
      console.log(new Date().toISOString(), isNew ? 'thêm' : 'sửa', 'mặt bằng', code);
      return [200, { listing: row }];
    } catch (e) {
      if (e instanceof ValidationError) return [400, { error: e.message, errors: e.errors }];
      throw e;
    }
  }
  if (m && method === 'DELETE') {
    const ok = remove(m[1]);
    if (ok) console.log(new Date().toISOString(), 'xoá mặt bằng', m[1].toUpperCase());
    return ok ? [200, { ok: true }] : [404, { error: 'Không tìm thấy' }];
  }

  if (method === 'POST' && path === '/import') {
    const { csv, replace } = await ctx.body();
    if (typeof csv !== 'string' || !csv.trim()) return [400, { error: 'Thiếu nội dung CSV' }];
    const rows = parseCsv(csv);
    if (!rows.length) return [400, { error: 'File không có dòng dữ liệu nào' }];
    if (rows.length > 5000) return [400, { error: 'Tối đa 5000 dòng mỗi lần nhập' }];
    const r = importRows(rows, { replace: replace === true });
    if (r.ok) console.log(new Date().toISOString(), `nhập CSV: thêm ${r.inserted}, sửa ${r.updated}${replace ? ' (thay toàn bộ)' : ''}`);
    return [r.ok ? 200 : 400, r.ok ? r : { error: 'File có lỗi, chưa ghi dòng nào.', rows: r.errors.slice(0, 50) }];
  }

  if (method === 'GET' && path === '/export') {
    const csv = toCsv(listAll());
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mat-bang-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store'
    });
    res.end(csv);
    return null;
  }

  return [404, { error: 'Không tìm thấy' }];
}
