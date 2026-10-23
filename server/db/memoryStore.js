// In-memory store: same methods as the MongoDB store, but data lives in Maps
// and disappears when the server restarts. Used when MONGODB_URI is empty.

export class DuplicateEmailError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.code = 'DUPLICATE_EMAIL';
  }
}

export function createMemoryStore() {
  const users = new Map(); // id -> user
  const conversations = new Map(); // id -> conversation

  // Hand out copies so callers can't change stored data by accident,
  // just like a real database returns fresh objects.
  const copy = (value) => (value ? structuredClone(value) : null);

  return {
    kind: 'memory',

    async ping() {
      return true;
    },

    async close() {},

    users: {
      async findByEmail(email) {
        for (const user of users.values()) {
          if (user.email === email) return copy(user);
        }
        return null;
      },

      async findById(id) {
        return copy(users.get(id));
      },

      async create(user) {
        if (await this.findByEmail(user.email)) throw new DuplicateEmailError();
        users.set(user._id, copy(user));
      },

      async insertIfMissing(user) {
        if (!(await this.findByEmail(user.email))) users.set(user._id, copy(user));
      },
    },

    conversations: {
      async listForUser(userId, limit = 50) {
        return [...conversations.values()]
          .filter((c) => c.userId === userId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, limit)
          .map(({ messages, context, ...summary }) => copy(summary));
      },

      async getForUser(id, userId) {
        const conversation = conversations.get(id);
        return conversation && conversation.userId === userId ? copy(conversation) : null;
      },

      async create(conversation) {
        conversations.set(conversation._id, copy(conversation));
      },

      async appendMessages(id, userId, newMessages, context, updatedAt) {
        const conversation = conversations.get(id);
        if (!conversation || conversation.userId !== userId) return;
        conversation.messages.push(...copy(newMessages));
        conversation.messageCount += newMessages.length;
        conversation.context = copy(context);
        conversation.updatedAt = updatedAt;
      },

      async deleteForUser(id, userId) {
        const conversation = conversations.get(id);
        if (!conversation || conversation.userId !== userId) return false;
        return conversations.delete(id);
      },
    },
  };
}