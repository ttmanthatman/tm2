/**
 * DeepSeek API 客户端封装
 * 用 Node 18+ 内置 fetch，不引入新依赖。
 *
 * v0.5.3:
 * - 返回 usage.prompt_cache_hit_tokens / prompt_cache_miss_tokens (DeepSeek 自动缓存)
 * - 显式 stream: false (确保走缓存路径)
 * - 若传入 model 为 deepseek-reasoner, 强制回退到 deepseek-chat 防止产生思考 token
 */

function sanitizeModel(requestedModel) {
  const m = (requestedModel || "").toLowerCase();
  if (m === "deepseek-reasoner" || m.includes("reasoner") || m.includes("-r1")) {
    console.warn("[DeepSeek] 拒绝使用 reasoning 模型 (" + requestedModel + "), 回退到 deepseek-chat");
    return { model: "deepseek-chat", warning: "reasoner_blocked" };
  }
  return { model: requestedModel || "deepseek-chat", warning: null };
}

async function chatCompletion({ apiKey, baseUrl, model, messages, temperature, maxTokens, timeoutMs }) {
  if (!apiKey) throw new Error("DeepSeek API key 未配置");

  const safe = sanitizeModel(model);

  const url = (baseUrl || "https://api.deepseek.com") + "/v1/chat/completions";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 60000);
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: safe.model,
        messages,
        temperature: (temperature == null ? 0.8 : temperature),
        max_tokens: maxTokens || 500,
        stream: false  /* 明确关闭 streaming, 走缓存路径 */
      }),
      signal: ctrl.signal
    });
    const latency = Date.now() - start;
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error("DeepSeek HTTP " + resp.status + ": " + text.substring(0, 300));
    }
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error("DeepSeek 返回非 JSON: " + text.substring(0, 200)); }
    const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    const usage = data.usage || {};
    return {
      content,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cacheHitTokens: usage.prompt_cache_hit_tokens || 0,
      cacheMissTokens: usage.prompt_cache_miss_tokens || 0,
      latency,
      modelUsed: safe.model,
      modelWarning: safe.warning
    };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { chatCompletion, sanitizeModel };