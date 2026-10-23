// All settings come from environment variables, so the same code runs on
// your laptop (values from a .env file) and on Render (values from the dashboard).
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

function readJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production. Add it in your hosting dashboard.');
  }
  console.warn('[config] JWT_SECRET is not set; using an insecure development secret.');
  return 'dev-only-insecure-secret';
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,

  jwtSecret: readJwtSecret(),
  jwtExpiresIn: '7d',

  // Empty MONGODB_URI = in-memory store (fine for local dev, data resets on restart).
  mongoUri: process.env.MONGODB_URI || '',
  mongoDbName: process.env.MONGODB_DB || 'shopbot',

  // Only needed if the frontend is hosted on a different domain than the API.
  corsOrigin: process.env.CORS_ORIGIN || '',

  // Optional LLM layer. Without GROQ_API_KEY the rule-based bot answers everything.
  llm: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    timeoutMs: 15000,
  },
};