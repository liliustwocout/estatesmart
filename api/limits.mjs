// Giới hạn sử dụng để chống spam và kiểm soát chi phí gọi mô hình.
// Lưu trong bộ nhớ của tiến trình: khởi động lại container thì bộ đếm về 0 (chấp nhận được với một máy chủ).
import { createHash } from 'node:crypto';

const num = (name, def) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
};

export const limits = {
  minIntervalMs: num('RATE_MIN_INTERVAL_MS', 3000), // khoảng cách tối thiểu giữa 2 câu hỏi của cùng IP
  windowMax: num('RATE_LIMIT_MAX', 15), // số câu hỏi tối đa của một IP…
  windowMs: num('RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000), // …trong cửa sổ 10 phút
  ipDailyMax: num('IP_DAILY_LIMIT', 60), // số câu hỏi tối đa của một IP mỗi ngày
  duplicateMs: num('DUPLICATE_WINDOW_MS', 2 * 60 * 1000), // chặn gửi lại đúng câu hỏi cũ trong 2 phút
  perIpConcurrent: num('MAX_CONCURRENT_PER_IP', 1), // số câu trả lời đang chạy cùng lúc của một IP
  globalConcurrent: num('MAX_CONCURRENT', 10), // số câu trả lời đang chạy cùng lúc trên toàn máy chủ
  dailyMax: num('DAILY_LIMIT', 1000), // tổng số lần gọi mô hình mỗi ngày
  dailyTokens: num('DAILY_TOKEN_LIMIT', 2000000) // tổng token (vào + ra) mỗi ngày
};

const ips = new Map(); // ip → { hits: [ms], last: ms, active: n, day: 'yyyy-mm-dd', dayCount: n, recent: Map<hash, ms> }
const global = { active: 0, day: '', count: 0, tokens: 0 };

// Ngày theo giờ Việt Nam (UTC+7) để bộ đếm về 0 lúc nửa đêm Hà Nội.
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const secondsToMidnightVN = () => {
  const now = Date.now() + 7 * 3600 * 1000;
  return Math.ceil((86400000 - (now % 86400000)) / 1000);
};
const hashOf = (s) => createHash('sha256').update(s.toLowerCase().replace(/\s+/g, ' ').trim()).digest('base64url').slice(0, 16);

function rollDay() {
  const d = today();
  if (global.day !== d) { global.day = d; global.count = 0; global.tokens = 0; }
  return d;
}

const deny = (status, error, retryAfter) => ({ ok: false, status, error, retryAfter: Math.max(1, Math.ceil(retryAfter)) });

// Bước tiếp nhận nhu cầu (/api/intake) có bộ đếm theo IP riêng, nhẹ hơn: câu ngắn, gửi liên tiếp,
// trả lời trùng ("không", "ok") là bình thường. Trần chung trong ngày vẫn dùng chung với /api/chat.
export const intakeLimits = {
  minIntervalMs: num('INTAKE_MIN_INTERVAL_MS', 800),
  windowMax: num('INTAKE_LIMIT_MAX', 40),
  ipDailyMax: num('INTAKE_IP_DAILY_LIMIT', 150),
  allowDuplicate: true
};

// Kiểm tra trước khi gọi mô hình. Nếu được phép, ghi nhận lượt gọi và trả về hàm release(tokens) phải gọi khi xong.
// opts.bucket tách bộ đếm theo IP (ví dụ 'intake'); các giới hạn trong opts ghi đè giá trị mặc định.
export function acquire(ip, message, opts = {}) {
  const lim = { ...limits, ...opts };
  const key = opts.bucket ? ip + '|' + opts.bucket : ip;
  const now = Date.now();
  const d = rollDay();
  let s = ips.get(key);
  if (!s) { s = { hits: [], last: 0, active: 0, day: d, dayCount: 0, recent: new Map() }; ips.set(key, s); }
  if (s.day !== d) { s.day = d; s.dayCount = 0; }
  s.hits = s.hits.filter((t) => now - t < lim.windowMs);
  for (const [h, t] of s.recent) if (now - t >= lim.duplicateMs) s.recent.delete(h);

  if (s.active >= lim.perIpConcurrent) return deny(429, 'Mình đang trả lời câu trước. Bạn đợi một chút nhé.', 3);
  if (now - s.last < lim.minIntervalMs) return deny(429, 'Bạn gửi hơi nhanh. Đợi vài giây rồi hỏi tiếp nhé.', (lim.minIntervalMs - (now - s.last)) / 1000);
  if (s.hits.length >= lim.windowMax) return deny(429, 'Bạn đã gửi nhiều câu hỏi. Thử lại sau nhé.', (lim.windowMs - (now - s.hits[0])) / 1000);
  if (s.dayCount >= lim.ipDailyMax) return deny(429, 'Bạn đã hết lượt hỏi hôm nay. Mai quay lại nhé.', secondsToMidnightVN());
  const h = hashOf(message);
  if (!lim.allowDuplicate && s.recent.has(h)) return deny(429, 'Bạn vừa gửi câu này. Xem câu trả lời ở trên nhé.', (lim.duplicateMs - (now - s.recent.get(h))) / 1000);
  if (global.active >= limits.globalConcurrent) return deny(503, 'Mình đang bận. Bạn thử lại sau vài giây nhé.', 5);
  if (global.count >= limits.dailyMax || global.tokens >= limits.dailyTokens) return deny(503, 'Hôm nay mình đã hết lượt trả lời. Bạn quay lại ngày mai nhé.', secondsToMidnightVN());

  s.hits.push(now);
  s.last = now;
  s.dayCount++;
  s.recent.set(h, now);
  s.active++;
  global.active++;
  global.count++;

  let released = false;
  return {
    ok: true,
    release(tokens = 0) {
      if (released) return;
      released = true;
      s.active = Math.max(0, s.active - 1);
      global.active = Math.max(0, global.active - 1);
      rollDay();
      global.tokens += tokens;
    }
  };
}

export function usage() {
  rollDay();
  return { day: global.day, requests: global.count, tokens: global.tokens, active: global.active, ips: ips.size };
}

// Dọn IP không còn hoạt động để bộ nhớ không phình ra.
setInterval(() => {
  const now = Date.now();
  const d = today();
  for (const [ip, s] of ips) {
    const idle = now - s.last > Math.max(limits.windowMs, limits.duplicateMs);
    if (s.active === 0 && idle && (s.day !== d || s.dayCount === 0)) ips.delete(ip);
  }
}, 5 * 60 * 1000).unref();
