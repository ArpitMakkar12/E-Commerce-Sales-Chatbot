// Optional LLM layer (Groq, OpenAI-compatible API). It only rewrites the answer
// and picks products from a list we give it, so it can't invent products or prices.
// Any problem (no key, timeout, bad output) -> the caller falls back to the rules reply.
import { config } from '../config.js';

export function isLlmEnabled() {
  return Boolean(config.llm.apiKey);
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    productIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'productIds'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the friendly shopping assistant of an online store.
Rules:
- Recommend ONLY products from the CANDIDATES list, using their exact id. Never mention, invent or suggest any product that is not in CANDIDATES, and never invent prices, ratings, stock or features.
- Return 1 to 3 productIds, best match first. If no candidate fits perfectly, still return the closest ones and say briefly how they differ (for example, over budget).
- Prices are in US dollars. Apply only the budget and limits listed under "What our search engine understood"; earlier messages' budgets no longer apply unless listed there.
- You only know this catalog. For orders, shipping, returns or payments, say you can't help with that here.
- Reply in plain text (no markdown, no tables), under 90 words, warm and specific: say briefly why each pick fits.
Answer as JSON: {"reply": "...", "productIds": ["..."]}`;

function candidateLine(p) {
  return `${p.id} | ${p.name} | ${p.category} | $${p.price} | ${p.rating}★ (${p.reviews} reviews) | ${p.inStock ? 'in stock' : 'OUT OF STOCK'} | ${p.features.join(', ')}`;
}

function historyText(history) {
  return history
    .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content.slice(0, 300)}`)
    .join('\n');
}

export async function llmReply({ message, history, candidates, hint }) {
  const { apiKey, model, baseUrl, timeoutMs } = config.llm;
  const isGptOss = model.includes('gpt-oss');

  const userPrompt = [
    history.length ? `Conversation so far:\n${historyText(history)}` : '',
    `Customer: ${message}`,
    `What our search engine understood: ${hint}`,
    `CANDIDATES (id | name | category | price | rating | stock | features):\n${candidates.map(candidateLine).join('\n') || '(none)'}`,
  ].filter(Boolean).join('\n\n');

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_completion_tokens: 1024,
    // gpt-oss models support strict JSON schemas; others get plain JSON mode.
    response_format: isGptOss
      ? { type: 'json_schema', json_schema: { name: 'shop_reply', strict: true, schema: REPLY_SCHEMA } }
      : { type: 'json_object' },
    ...(isGptOss ? { reasoning_effort: 'low' } : {}),
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`LLM request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '');
  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  if (!reply) throw new Error('LLM returned an empty reply');

  // Keep only ids that really are in the candidate list.
  const allowed = new Set(candidates.map((p) => p.id));
  const productIds = [...new Set((Array.isArray(parsed.productIds) ? parsed.productIds : []).map(String))]
    .filter((id) => allowed.has(id))
    .slice(0, 3);

  return { text: reply.slice(0, 1200), productIds };
}