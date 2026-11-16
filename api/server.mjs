// Máy chủ API của estateSmartAI. Chạy: node server.mjs (Node 22, không cần thư viện ngoài).
//   GET  /api/health  → trạng thái, có khoá API hay chưa
//   POST /api/chat    → trả lời câu hỏi tự do, truyền dần từng đoạn chữ (text/event-stream)
import { createServer } from 'node:http';
import { streamChat, llmConfig, LlmError } from './llm.mjs';
import { systemPrompt } from './prompt.mjs';
import { acquire, usage } from './limits.mjs';

const PORT = Number(process.env.PORT || 8787);
const MAX_MESSAGE = 500; // ký tự mỗi câu hỏi
const MAX_HISTORY = 6; // số lượt hội thoại trước gửi kèm
const MAX_HISTORY_CHARS = 4000; // tổng ký tự lịch sử gửi kèm
const MAX_BODY = 16 * 1024;

function clientIp(req) {
  // Caddy thay X-Forwarded-For bằng IP thật của người dùng (không tin giá trị do trình duyệt tự gửi).
  const xff = req.headers['x-forwarded-for'];
  return (typeof xff === 'string' && xff.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
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
  let turns = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: cleanText(m.content, m.role === 'user' ? MAX_MESSAGE : 1500) }))
    .filter((m) => m.content);
  // Giữ các lượt gần nhất trong giới hạn tổng ký tự, để lịch sử dài không đốt token.
  let total = 0;
  turns = turns.reverse().filter((m) => (total += m.content.length) <= MAX_HISTORY_CHARS).reverse();
  return { message, messages: [{ role: 'system', content: systemPrompt(criteria) }, ...turns, { role: 'user', content: message }] };
}

async function handleChat(req, res) {
  const ip = clientIp(req);
  if (!String(req.headers['content-type'] || '').includes('application/json')) return sendJson(res, 415, { error: 'Chỉ nhận JSON' });

  let built;
  try { built = buildMessages(await readJson(req)); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  const { message, messages } = built;

  if (!llmConfig.apiKey) return sendJson(res, 503, { error: 'Trợ lý AI chưa được bật trên máy chủ.' });

  const slot = acquire(ip, message);
  if (!slot.ok) return sendJson(res, slot.status, { error: slot.error }, { 'retry-after': String(slot.retryAfter) });

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
      send({ error: 'Trợ lý đang bận, anh/chị thử lại sau ít phút.' });
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
