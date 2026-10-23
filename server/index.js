// Entry point: connects the database, mounts the API routes, and in production
// also serves the built React app from /dist so everything runs as one service.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDatabase } from './db/index.js';
import { createRequireAuth } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createProductsRouter } from './routes/products.js';
import { createChatRouter } from './routes/chat.js';
import { isLlmEnabled } from './bot/llm.js';

const store = await connectDatabase();
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // Render sits behind one proxy; needed for correct client IPs.
if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin.split(',') }));
app.use(express.json({ limit: '10kb' }));

const requireAuth = createRequireAuth(store);

app.get('/api/health', async (req, res) => {
  try {
    await store.ping();
    res.json({ status: 'ok', database: store.kind, llm: isLlmEnabled() ? config.llm.model : 'off' });
  } catch {
    res.status(503).json({ status: 'error', database: store.kind });
  }
});
app.use('/api/auth', createAuthRouter(store, requireAuth));
app.use('/api/products', createProductsRouter());
app.use('/api', createChatRouter(store, requireAuth));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the frontend build (exists after `npm run build`).
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(distDir)) {
  app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(distDir));
  // Any other GET (e.g. a page refresh) gets the React app.
  app.get('/{*path}', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Last stop for errors: always answer with JSON, never leak stack traces.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const server = app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  console.log(`[server] Chatbot mode: ${isLlmEnabled() ? `rules + LLM (${config.llm.model})` : 'rules only'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  });
}