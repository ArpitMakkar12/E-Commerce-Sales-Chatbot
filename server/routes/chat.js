// /api/chat and /api/conversations: all need a signed-in user.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { generateReply } from '../bot/index.js';
import { getProductById } from '../bot/search.js';

const MAX_MESSAGE_LENGTH = 500;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: "You're sending messages very quickly. Please wait a moment." },
});

// Messages store only product ids; turn them back into full products for the UI.
function toClientMessage({ productIds = [], ...message }) {
  return { ...message, products: productIds.map(getProductById).filter(Boolean) };
}

function toSummary(conversation) {
  const { _id, title, messageCount, createdAt, updatedAt } = conversation;
  return { id: _id, title, messageCount, createdAt, updatedAt };
}

function makeTitle(text) {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export function createChatRouter(store, requireAuth) {
  const router = Router();

  router.post('/chat', requireAuth, chatLimiter, async (req, res) => {
    const text = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!text) return res.status(400).json({ error: 'Please type a message.' });
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` });
    }

    const userId = req.user._id;
    const requestedId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : null;
    // If the id is unknown (deleted, or another user's), just start a fresh conversation.
    const conversation = requestedId ? await store.conversations.getForUser(requestedId, userId) : null;

    const userMessage = { id: randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const reply = await generateReply({
      message: text,
      context: conversation?.context ?? {},
      history: conversation?.messages.slice(-6) ?? [],
    });
    const botMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: reply.text,
      productIds: reply.productIds,
      source: reply.source,
      timestamp: new Date().toISOString(),
    };

    let conversationId;
    if (conversation) {
      conversationId = conversation._id;
      await store.conversations.appendMessages(
        conversationId, userId, [userMessage, botMessage], reply.context, botMessage.timestamp,
      );
    } else {
      conversationId = randomUUID();
      await store.conversations.create({
        _id: conversationId,
        userId,
        title: makeTitle(text),
        messages: [userMessage, botMessage],
        messageCount: 2,
        context: reply.context,
        createdAt: userMessage.timestamp,
        updatedAt: botMessage.timestamp,
      });
    }

    res.json({ conversationId, message: toClientMessage(botMessage) });
  });

  router.get('/conversations', requireAuth, async (req, res) => {
    const conversations = await store.conversations.listForUser(req.user._id);
    res.json(conversations.map(toSummary));
  });

  router.get('/conversations/:id', requireAuth, async (req, res) => {
    const conversation = await store.conversations.getForUser(req.params.id, req.user._id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ ...toSummary(conversation), messages: conversation.messages.map(toClientMessage) });
  });

  router.delete('/conversations/:id', requireAuth, async (req, res) => {
    const deleted = await store.conversations.deleteForUser(req.params.id, req.user._id);
    if (!deleted) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true });
  });

  return router;
}