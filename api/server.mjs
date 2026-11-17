// Máy chủ API của estateSmartAI. Chạy: node server.mjs (Node 22, không cần thư viện ngoài).
//   GET  /api/health      → trạng thái
//   POST /api/recommend   → 5 Agent chấm điểm sống, trả Top 3 căn nhà + tiện ích quanh đó
//   POST /api/profiles    → hồ sơ chi tiết của các căn (trang /mat-bang/, sau này /nha/)
//   POST /api/parse       → đọc câu mô tả tự do thành tiêu chí, báo mục còn thiếu (có khoá mô hình thì dùng AI, xem intake.mjs)
//   POST /api/report      → báo cáo một căn cho trang Trợ lý (hệ sinh thái tiện ích, một ngày của gia đình…)
//   POST /api/chat        → trợ lý AI trả lời câu hỏi tự do, truyền dần từng đoạn chữ (text/event-stream)
//   /api/admin/*          → trang quản trị (xem admin.mjs)
import { createServer } from 'node:http';
import { streamChat, llmConfig } from './llm.mjs';
import { systemPrompt } from './prompt.mjs';
import { acquire, usage } from './limits.mjs';
import { parseSmart } from './intake.mjs';
import { recommend, profile, cardsFor } from './engine.mjs';
import { createLead, LeadError, createShare, getShare, telegramEnabled } from './leads.mjs';
import { report } from './report.mjs';
import { handleAdmin, adminEnabled } from './admin.mjs';
import { listActive } from './db.mjs';
import { KEYS } from './report.mjs';

const PORT = Number(process.env.PORT || 8787);
const MAX_MESSAGE = 500; // ký tự mỗi câu hỏi
const MAX_HISTORY = 6; // số lượt hội thoại trước gửi kèm
const MAX_HISTORY_CHARS = 4000; // tổng ký tự lịch sử gửi kèm
const MAX_BODY = 16 * 1024;
const MAX_ADMIN_BODY = 1024 * 1024; // nhập CSV

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function clientIp(req) {
  // Caddy thay X-Forwarded-For bằng IP thật của người dùng (không tin giá trị do trình duyệt tự gửi).
  const xff = req.headers['x-forwarded-for'];
  return (typeof xff === 'string' && xff.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req, max = MAX_BODY) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Chỉ nhận JSON');
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > max) throw new HttpError(413, 'Yêu cầu quá lớn');
    chunks.push(c);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
}

const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const cleanCriteria = (c) => {
  const o = c && typeof c === 'object' ? c : {};
  return Object.fromEntries(KEYS.map((k) => [k, cleanText(o[k], 120)]));
};
const cleanCodes = (v) => (Array.isArray(v) ? v : []).filter((c) => typeof c === 'string' && /^[A-Za-z0-9.-]{2,20}$/.test(c)).slice(0, 3).map((c) => c.toUpperCase());

// Giới hạn nhẹ cho các API tính toán (không tốn token): 30 lần mỗi phút mỗi IP.
const light = new Map();
function lightAllow(ip) {
  const now = Date.now();
  const l = (light.get(ip) || []).filter((t) => now - t < 60000);
  if (l.length >= 30) { light.set(ip, l); return false; }
  l.push(now);
  light.set(ip, l);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of light) if (!l.some((t) => now - t < 60000)) light.delete(ip); }, 60000).unref();

function buildMessages(body) {
  const message = cleanText(body.message, MAX_MESSAGE);
  if (!message) throw new HttpError(400, 'Thiếu câu hỏi');
  const criteria = cleanCriteria(body.criteria);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  let turns = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: cleanText(m.content, m.role === 'user' ? MAX_MESSAGE : 1500) }))
    .filter((m) => m.content);
  // Giữ các lượt gần nhất trong giới hạn tổng ký tự, để lịch sử dài không đốt token.
  let total = 0;
  turns = turns.reverse().filter((m) => (total += m.content.length) <= MAX_HISTORY_CHARS).reverse();
  return { message, messages: [{ role: 'system', content: systemPrompt(criteria, cleanCodes(body.codes)) }, ...turns, { role: 'user', content: message }] };
}

async function handleChat(req, res, ip) {
  const { message, messages } = buildMessages(await readJson(req));
  if (!llmConfig.apiKey) return sendJson(res, 503, { error: 'Trợ lý AI chưa được bật trên máy chủ.' });

  const slot = acquire(ip, message);
  if (!slot.ok) return sendJson(res, slot.status, { error: slot.error }, { 'retry-after': String(slot.retryAfter) });

  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  const send = (obj) => res.write('data: ' + JSON.stringify(obj) + '\n\n');

  const started = Date.now();
  let chars = 0;
  let tokens = 0;
  try {
    for await (const delta of streamChat(messages, { signal: abort.signal, onUsage: (t) => { tokens = t; } })) {
      chars += delta.length;
      send({ delta });
    }
    send({ done: true });
  } catch (e) {
    if (!abort.signal.aborted) {
      console.error(new Date().toISOString(), 'chat lỗi:', e.message);
      send({ error: 'Mình đang bận. Bạn thử lại sau ít phút nhé.' });
    }
  } finally {
    // Nhà cung cấp không trả số token (hoặc bị ngắt giữa chừng) thì ước lượng: khoảng 3 ký tự tiếng Việt một token.
    if (!tokens) tokens = Math.ceil((messages.reduce((n, m) => n + m.content.length, 0) + chars) / 3);
    slot.release(tokens);
    // Chỉ ghi độ dài, token và thời gian, không ghi nội dung câu hỏi.
    const u = usage();
    console.log(new Date().toISOString(), `chat ${chars} ký tự, ${tokens} token, ${Date.now() - started} ms; hôm nay ${u.requests} lượt, ${u.tokens} token`);
    res.end();
  }
}

async function route(req, res, url, ip) {
  const p = url.pathname;
  const m = req.method;

  if (m === 'GET' && p === '/api/health') {
    return sendJson(res, 200, { ok: true, llm: !!llmConfig.apiKey, admin: adminEnabled(), telegram: telegramEnabled(), homes: listActive().length });
  }

  // Mở link chia sẻ: dựng lại đúng ba căn và tiêu chí đã lưu.
  const sm = p.match(/^\/api\/share\/([A-Za-z0-9]{6,20})$/);
  if (m === 'GET' && sm) {
    if (!lightAllow(ip)) return sendJson(res, 429, { error: 'Bạn thao tác hơi nhanh. Thử lại sau vài giây nhé.' }, { 'retry-after': '10' });
    const sh = getShare(sm[1]);
    if (!sh) return sendJson(res, 404, { error: 'Link đã hết hạn hoặc không tồn tại.' });
    const results = cardsFor(sh.codes, sh.criteria);
    // Link tạo trước khi đổi sang chủ đề nhà ở (mã mặt bằng cũ) không còn căn nào để hiện.
    if (!results.length) return sendJson(res, 410, { error: 'Link này thuộc phiên bản cũ hoặc các căn đã được gỡ, không còn hiệu lực.' });
    return sendJson(res, 200, { ...sh, results });
  }

  if (p.startsWith('/api/admin/')) {
    const r = await handleAdmin({ req, res, ip, method: m, path: p, body: () => readJson(req, MAX_ADMIN_BODY) });
    if (r) sendJson(res, r[0], r[1]);
    return;
  }

  if (m !== 'POST') return sendJson(res, p.match(/^\/api\/(chat|recommend|profiles|parse|report|leads|share)$/) ? 405 : 404, { error: 'Không tìm thấy' });

  if (p === '/api/chat') return handleChat(req, res, ip);

  // Yêu cầu xem nhà / tin nhắn gửi chủ nhà (có thông tin cá nhân, không ghi vào log).
  if (p === '/api/leads') {
    const body = await readJson(req);
    try { return sendJson(res, 200, await createLead(body, ip)); }
    catch (e) { if (e instanceof LeadError) return sendJson(res, e.status, { error: e.errors._ || e.message, errors: e.errors }); throw e; }
  }

  if (p === '/api/share') {
    if (!lightAllow(ip)) return sendJson(res, 429, { error: 'Bạn thao tác hơi nhanh. Thử lại sau vài giây nhé.' }, { 'retry-after': '10' });
    const body = await readJson(req);
    const codes = cleanCodes(body.codes);
    if (!codes.length) throw new HttpError(400, 'Thiếu mã căn');
    return sendJson(res, 200, { id: createShare(cleanCriteria(body.criteria), codes) });
  }

  if (p === '/api/parse' || p === '/api/report') {
    if (!lightAllow(ip)) return sendJson(res, 429, { error: 'Bạn thao tác hơi nhanh. Thử lại sau vài giây nhé.' }, { 'retry-after': '10' });
    const body = await readJson(req);
    if (p === '/api/parse') return sendJson(res, 200, await parseSmart(cleanText(body.text, 500), cleanCriteria(body.prev), ip, body.step));
    const code = cleanCodes([body.code])[0];
    if (!code) throw new HttpError(400, 'Thiếu mã căn');
    const r = report(code, cleanCriteria(body.criteria));
    return r ? sendJson(res, 200, r) : sendJson(res, 404, { error: 'Không tìm thấy căn nhà' });
  }

  if (p === '/api/recommend' || p === '/api/profiles') {
    if (!lightAllow(ip)) return sendJson(res, 429, { error: 'Bạn thao tác hơi nhanh. Thử lại sau vài giây nhé.' }, { 'retry-after': '10' });
    const body = await readJson(req);
    const criteria = cleanCriteria(body.criteria);
    if (p === '/api/recommend') return sendJson(res, 200, recommend(criteria));
    const codes = cleanCodes(body.codes);
    if (!codes.length) throw new HttpError(400, 'Thiếu mã căn');
    return sendJson(res, 200, { profiles: codes.map((c) => profile(c, criteria)).filter(Boolean) });
  }

  sendJson(res, 404, { error: 'Không tìm thấy' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    await route(req, res, url, clientIp(req));
  } catch (e) {
    if (e instanceof HttpError) { if (!res.headersSent) sendJson(res, e.status, { error: e.message }); else res.end(); return; }
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Lỗi máy chủ' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`estateSmartAI API chạy ở cổng ${PORT}; ${listActive().length} căn nhà; mô hình ${llmConfig.model} (${llmConfig.apiKey ? 'có khoá' : 'chưa có khoá'}); quản trị: ${adminEnabled() ? 'bật' : 'tắt'}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
