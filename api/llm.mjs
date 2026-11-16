// Lớp trung gian gọi mô hình ngôn ngữ theo chuẩn API của OpenAI (DeepSeek, OpenAI, OpenRouter… đều dùng được).
// Đổi nhà cung cấp chỉ cần đổi biến môi trường LLM_BASE_URL, LLM_MODEL, LLM_API_KEY.

export const llmConfig = {
  baseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  model: process.env.LLM_MODEL || 'deepseek-chat',
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  maxTokens: Number(process.env.LLM_MAX_TOKENS || 500),
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 60000)
};

export class LlmError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Trả về từng đoạn chữ (delta) mô hình sinh ra, theo thứ tự.
// onUsage(totalTokens) được gọi nếu nhà cung cấp trả số token đã dùng ở cuối luồng.
export async function* streamChat(messages, { signal, onUsage } = {}) {
  if (!llmConfig.apiKey) throw new LlmError('Chưa cấu hình khoá API cho mô hình ngôn ngữ', 503);

  const timeout = AbortSignal.timeout(llmConfig.timeoutMs);
  const res = await fetch(llmConfig.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + llmConfig.apiKey },
    body: JSON.stringify({
      model: llmConfig.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.5,
      max_tokens: llmConfig.maxTokens
    }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new LlmError(`Nhà cung cấp trả lỗi ${res.status}: ${detail.slice(0, 200)}`, res.status === 429 ? 429 : 502);
  }

  // Đọc luồng Server-Sent Events: mỗi sự kiện là một dòng "data: {...}", kết thúc bằng "data: [DONE]".
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      let json;
      try { json = JSON.parse(data); } catch { continue; }
      if (json.usage && onUsage) onUsage(Number(json.usage.total_tokens) || 0);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
