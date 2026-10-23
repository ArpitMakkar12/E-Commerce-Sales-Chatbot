# E-Commerce Sales Chatbot

A shopping assistant chat app built with React, TypeScript, Node.js/Express and MongoDB. Customers sign in, ask for products in plain English ("laptops under $1500", "best rated books", "compare iPhone 15 Pro vs Galaxy S24") and get answers with product cards. Conversations are saved and can be reopened later.

## Features

- **Sign up / sign in** with JWT tokens (7-day expiry) and bcrypt-hashed passwords. Expired sessions return you to the login screen with a notice.
- **Chatbot that understands shopping questions** (no AI key needed):
  - product types and synonyms ("headphones" finds earbuds and headsets, "phone" finds the iPhone and Galaxy)
  - categories: Electronics, Books, Clothing, Home & Garden, Sports & Outdoors
  - budgets: "under $50", "between $100 and $300", "around $80", "over 1k"
  - sorting: "cheapest", "priciest", "best rated", "most popular"
  - ratings and stock: "rated 4.5 stars", "in stock"
  - product details: "tell me about the MacBook Pro", "how much is the iPhone 15 Pro?"
  - comparisons: "compare MacBook vs Dell XPS"
  - follow-ups that remember the previous answer: "show more", "cheaper", "more expensive", "under $30", "only wireless ones", "what about jeans?"
  - gift ideas: "gift for my dad under $50"
- **Optional LLM mode**: with a free Groq API key, an LLM writes friendlier answers. It can only choose from products our own search found, so it can't invent products or prices. If the LLM fails or is slow, the rule-based answer is used.
- **Product cards** with rating, price, stock status, expandable features, save (heart) and add-to-cart feedback. Cards work on touch screens and show a category tile if a photo fails to load.
- **Conversation history**: list, reopen and delete past chats.
- **100 products** across 5 categories, with a few out of stock to show stock handling.
- **Responsive** layout for phones, tablets and desktops.

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Lucide icons |
| Backend | Node.js 22, Express 5, JSON Web Tokens, bcryptjs, express-rate-limit |
| Database | MongoDB (Atlas free tier); falls back to an in-memory store when no database is set |
| Optional LLM | Groq API (OpenAI-compatible), default model `openai/gpt-oss-20b` |
| Hosting | Render (one web service serves both the API and the built frontend) |

## Run it locally

You need Node.js 22.

```bash
git clone https://github.com/ArpitMakkar12/E-Commerce-Sales-Chatbot.git
cd E-Commerce-Sales-Chatbot
npm install
cp .env.example .env      # on Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173 and sign in with the demo account:

- Email: `demo@example.com`
- Password: `ShopDemo#2026`

`npm run dev` starts the React app (port 5173) and the API (port 3001) together. With `MONGODB_URI` left empty, users and chats are kept in memory and reset when the server restarts. Paste your Atlas connection string into `.env` to keep them.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the chatbot tests |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Runs the server; it also serves `dist/` if it exists |
| `npm run lint` / `npm run typecheck` | Code checks |

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | In production | Long random string used to sign login tokens |
| `MONGODB_URI` | Recommended | MongoDB Atlas connection string. Empty = in-memory store |
| `MONGODB_DB` | No | Database name (default `shopbot`) |
| `GROQ_API_KEY` | No | Turns on LLM mode |
| `GROQ_MODEL` | No | Groq model id (default `openai/gpt-oss-20b`) |
| `PORT` | No | Server port (default 3001; Render sets this itself) |
| `NODE_ENV` | No | `production` on the server |

## Deploy to Render (free)

1. **MongoDB Atlas**: create a free cluster, add a database user, allow network access from `0.0.0.0/0` (Render's free tier has no fixed IP), and copy the `mongodb+srv://...` connection string with your password filled in.
2. **Groq (optional)**: create an API key at https://console.groq.com/keys.
3. **Render**: New → Blueprint → pick this repository. Render reads `render.yaml`, creates the web service, generates `JWT_SECRET`, and asks you for `MONGODB_URI` and `GROQ_API_KEY` (leave the Groq one empty to use rules only).
4. Wait for the deploy, then open `https://<your-service>.onrender.com/api/health`. It should show `"database": "mongodb"`.

Without the Blueprint, create a Web Service with build command `npm ci --include=dev && npm run build`, start command `npm start`, health check path `/api/health`, and the environment variables above.

Free Render services sleep after 15 minutes without traffic; the first visit after that takes about a minute to wake up.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | – | Server, database and LLM status |
| POST | `/api/auth/register` | – | Create an account → `{ token, user }` |
| POST | `/api/auth/login` | – | Sign in → `{ token, user }` |
| GET | `/api/auth/me` | ✓ | Current user (checks the token) |
| GET | `/api/products` | – | Query: `category`, `search`, `minPrice`, `maxPrice`, `limit`, `offset` |
| GET | `/api/products/categories` | – | Categories with item counts and price ranges |
| GET | `/api/products/:id` | – | One product |
| POST | `/api/chat` | ✓ | Body: `{ message, conversationId? }` → `{ conversationId, message }` |
| GET | `/api/conversations` | ✓ | Your conversations (summaries, newest first) |
| GET | `/api/conversations/:id` | ✓ | One conversation with all messages |
| DELETE | `/api/conversations/:id` | ✓ | Delete a conversation |

Auth = send `Authorization: Bearer <token>`. Login/register are limited to 30 attempts per 15 minutes and chat to 30 messages per minute per IP.

## Project structure

```
server/
  index.js              Express app: API routes + serves the built frontend
  config.js             Reads environment variables
  db/                   Storage: MongoDB store, in-memory store, demo user setup
  middleware/auth.js    Creates and checks login tokens
  routes/               auth, products, chat + conversations
  bot/
    text.js             Word cleanup, plurals, synonyms
    search.js           Product search and ranking
    nlu.js              Understands a message (intent, category, budget, follow-ups)
    reply.js            Builds the rule-based answer
    llm.js              Optional Groq LLM layer
    index.js            Ties it together, falls back to rules if the LLM fails
    bot.test.js         Tests (npm test)
  data/products.js      The 100-product catalog
src/
  services/api.ts       All calls to the backend
  contexts/AuthContext.tsx  Login state and session checks
  components/           Chat screen, product card, history, login, register
  types.ts              Shared TypeScript types
public/favicon.svg      Browser tab icon
render.yaml             Render deployment settings
```

## Known limits

- The catalog is a fixed list in `server/data/products.js`; product photos are shared Pexels placeholder images.
- "Add to cart" shows a confirmation only; there is no checkout.
- Saved (heart) items are remembered per browser, not per account.

## License

MIT