// MongoDB store: users and conversations saved in MongoDB Atlas,
// so they survive restarts and redeploys.
import { MongoClient } from 'mongodb';
import { DuplicateEmailError } from './memoryStore.js';

export async function createMongoStore(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();

  const db = client.db(dbName);
  const users = db.collection('users');
  const conversations = db.collection('conversations');

  // Indexes: emails must be unique, and a user's chats are listed newest first.
  await users.createIndex({ email: 1 }, { unique: true });
  await conversations.createIndex({ userId: 1, updatedAt: -1 });

  return {
    kind: 'mongodb',

    async ping() {
      await db.command({ ping: 1 });
      return true;
    },

    async close() {
      await client.close();
    },

    users: {
      findByEmail: (email) => users.findOne({ email }),

      findById: (id) => users.findOne({ _id: id }),

      async create(user) {
        try {
          await users.insertOne(user);
        } catch (error) {
          if (error.code === 11000) throw new DuplicateEmailError(); // unique index hit
          throw error;
        }
      },

      async insertIfMissing(user) {
        const { _id, email, ...rest } = user;
        await users.updateOne({ email }, { $setOnInsert: { _id, ...rest } }, { upsert: true });
      },
    },

    conversations: {
      listForUser: (userId, limit = 50) =>
        conversations
          .find({ userId }, { projection: { messages: 0, context: 0 } })
          .sort({ updatedAt: -1 })
          .limit(limit)
          .toArray(),

      getForUser: (id, userId) => conversations.findOne({ _id: id, userId }),

      async create(conversation) {
        await conversations.insertOne(conversation);
      },

      async appendMessages(id, userId, newMessages, context, updatedAt) {
        await conversations.updateOne(
          { _id: id, userId },
          {
            $push: { messages: { $each: newMessages } },
            $inc: { messageCount: newMessages.length },
            $set: { context, updatedAt },
          },
        );
      },

      async deleteForUser(id, userId) {
        const result = await conversations.deleteOne({ _id: id, userId });
        return result.deletedCount === 1;
      },
    },
  };
}