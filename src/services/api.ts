// Every call to the backend goes through request(), which adds the login token,
// turns server errors into readable messages, and signals when a session expires.
import type { Conversation, ConversationSummary, ChatMessage, Product, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'token';

// AuthContext listens for this event and signs the user out.
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// localStorage can throw (private mode, blocked storage), so guard every access.
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(data?.error ?? `Request failed (${response.status}). Please try again.`, response.status);
  }
  if (!isJson) throw new ApiError('Unexpected response from the server.', response.status);
  return data as T;
}

interface AuthResponse {
  token: string;
  user: User;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (email: string, password: string, firstName: string, lastName: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, firstName, lastName } }),
  me: () => request<{ user: User }>('/auth/me'),
};

export const productsAPI = {
  getProducts: (params: Record<string, string | number> = {}) => {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ products: Product[]; total: number; hasMore: boolean }>(`/products?${query}`);
  },
  getProduct: (id: string) => request<Product>(`/products/${encodeURIComponent(id)}`),
};

export const chatAPI = {
  sendMessage: (message: string, conversationId?: string) =>
    request<{ conversationId: string; message: ChatMessage }>('/chat', {
      method: 'POST',
      body: { message, conversationId },
    }),
  getConversations: () => request<ConversationSummary[]>('/conversations'),
  getConversation: (id: string) => request<Conversation>(`/conversations/${encodeURIComponent(id)}`),
  deleteConversation: (id: string) =>
    request<{ success: boolean }>(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};