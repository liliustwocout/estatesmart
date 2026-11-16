// Máy chủ API của estateSmartAI. Chạy: node server.mjs (Node 22, không cần thư viện ngoài).
//   GET  /api/health  → trạng thái, có khoá API hay chưa
//   POST /api/chat    → trả lời câu hỏi tự do, truyền dần từng đoạn chữ (text/event-stream)
import { createServer } from 'node:http';
import { streamChat, llmConfig, LlmError } from './llm.mjs';
import { systemPrompt } from './prompt.mjs';

const PORT = Number(process.env.PORT || 8787);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 20); // số câu hỏi tối đa mỗi IP…
const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000); // …trong 10 phút
const DAILY_MAX = Number(process.env.DAILY_LIMIT || 1000); // trần số lần gọi mô hình mỗi ngày (kiểm soát chi phí)
const MAX_MESSAGE = 500;
const MAX_HISTORY = 10;
const MAX_BODY = 32 * 1024;

const hits = new Map(); // ip → [mốc thời gian]
let day = new Date().toISOString().slice(0, 10);
let dayCount = 0;

function clientIp(req) {
  // Caddy đặt X-Forwarded-For; lấy địa chỉ đầu tiên.
  const xff = req.headers['x-forwarded-for'];
  return (typeof xff === 'string' && xff.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

function allow(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return false; }
  list.push(now);
  hits.set(ip, list);
  return true;
}

// Dọn bộ đếm IP cũ để bộ nhớ không phình ra.
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(ip);
}, 60 * 1000).unref();

function underDailyCap() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_MAX) return false;
  dayCount++;
  return true;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new LlmError('Yêu cầu quá lớn', 413);
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new LlmError('JSON không hợp lệ', 400); }
}

function cleanText(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function buildMessages(body) {
  const message = cleanText(body.message, MAX_MESSAGE);
  if (!message) throw new LlmError('Thiếu câu hỏi', 400);
  const criteria = typeof body.criteria === 'object' && body.criteria ? body.criteria : {};
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  const turns = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: cleanText(m.content, m.role === 'user' ? MAX_MESSAGE : 2000) }))
    .filter((m) => m.content);
  return [{ role: 'system', content: systemPrompt(criteria) }, ...turns, { role: 'user', content: message }];
}

async function handleChat(req, res) {
  const ip = clientIp(req);
  if (!allow(ip)) return sendJson(res, 429, { error: 'Anh/chị hỏi hơi nhanh, vui lòng thử lại sau ít phút.' });

  let messages;
  try { messages = buildMessages(await readJson(req)); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }

  if (!llmConfig.apiKey) return sendJson(res, 503, { error: 'Trợ lý AI chưa được bật trên máy chủ.' });
  if (!underDailyCap()) return sendJson(res, 503, { error: 'Trợ lý đã đạt giới hạn sử dụng trong ngày, vui lòng quay lại sau.' });

  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no'
  });
  const send = (obj) => res.write('data: ' + JSON.stringify(obj) + '\n\n');

  const started = Date.now();
  let chars = 0;
  try {
    for await (const delta of streamChat(messages, { signal: abort.signal })) {
      chars += delta.length;
      send({ delta });
    }
    send({ done: true });
  } catch (e) {
    if (!abort.signal.aborted) {
      console.error(new Date().toISOString(), 'chat lỗi:', e.message);
      send({ error: 'Trợ lý đang bận, anh/chị thử lại sau ít phút.' });
    }
  } finally {
    // Chỉ ghi độ dài và thời gian, không ghi nội dung câu hỏi.
    console.log(new Date().toISOString(), `chat ${chars} ký tự trong ${Date.now() - started} ms`);
    res.end();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, llm: !!llmConfig.apiKey, model: llmConfig.model });
    }
    if (url.pathname === '/api/chat') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Chỉ nhận POST' });
      return await handleChat(req, res);
    }
    sendJson(res, 404, { error: 'Không tìm thấy' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Lỗi máy chủ' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`estateSmartAI API chạy ở cổng ${PORT}, mô hình ${llmConfig.model} tại ${llmConfig.baseUrl}, khoá API: ${llmConfig.apiKey ? 'có' : 'chưa có'}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
