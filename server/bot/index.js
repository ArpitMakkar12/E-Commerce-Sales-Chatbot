// The chatbot's front door: understand the message, build a rules-based answer,
// and (if a Groq key is set) let the LLM polish it using only real products.
import { parseMessage } from './nlu.js';
import { buildRulesReply, describeParse } from './reply.js';
import { isLlmEnabled, llmReply } from './llm.js';

// Simple, predictable replies (greetings, help, paging) don't need the LLM.
const LLM_INTENTS = new Set(['search', 'refine', 'details', 'compare', 'unknown']);

export async function generateReply({ message, context = {}, history = [] }) {
  const parsed = parseMessage(message, context);
  const rules = buildRulesReply(parsed, context);
  const rulesResult = { text: rules.text, productIds: rules.productIds, context: rules.context, source: 'rules' };

  if (!isLlmEnabled() || !LLM_INTENTS.has(parsed.intent)) return rulesResult;

  try {
    const llm = await llmReply({ message, history, candidates: rules.candidates, hint: describeParse(parsed) });
    return {
      text: llm.text,
      productIds: llm.productIds,
      // Follow-ups ("show more", "cheaper") keep working from the rules' understanding.
      context: { ...rules.context, lastShownIds: llm.productIds },
      source: 'llm',
    };
  } catch (error) {
    console.warn(`[bot] LLM unavailable, using rules reply: ${error.message}`);
    return rulesResult;
  }
}