/**
 * DeepSeek API 客户端封装
 * 用 Node 18+ 内置 fetch，不引入新依赖。
 */

async function chatCompletion({ apiKey, baseUrl, model, messages, temperature, maxTokens, timeoutMs }) {
  if (!apiKey) throw new Error("DeepSeek API key 未配置");
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
        model: model || "deepseek-chat",
        messages,
        temperature: (temperature == null ? 0.8 : temperature),
        max_tokens: maxTokens || 500,
        stream: false
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
      latency
    };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { chatCompletion };