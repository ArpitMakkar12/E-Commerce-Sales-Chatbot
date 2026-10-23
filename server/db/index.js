// Picks the storage backend and makes sure the demo account exists.
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { createMemoryStore } from './memoryStore.js';
import { createMongoStore } from './mongoStore.js';

export const DEMO_USER = {
  email: 'demo@example.com',
  password: 'password',
  firstName: 'Demo',
  lastName: 'User',
};

export async function connectDatabase() {
  let store;
  if (config.mongoUri) {
    store = await createMongoStore(config.mongoUri, config.mongoDbName);
    console.log(`[db] Connected to MongoDB (database "${config.mongoDbName}")`);
  } else {
    store = createMemoryStore();
    console.warn('[db] MONGODB_URI not set: using the in-memory store. Data resets on restart.');
  }

  await store.users.insertIfMissing({
    _id: 'demo-user-1',
    email: DEMO_USER.email,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10),
    firstName: DEMO_USER.firstName,
    lastName: DEMO_USER.lastName,
    createdAt: new Date().toISOString(),
  });

  return store;
}