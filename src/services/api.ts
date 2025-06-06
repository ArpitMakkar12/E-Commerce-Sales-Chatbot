const API_BASE_URL = 'http://localhost:3001/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
}

async function handleResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const authAPI = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  async register(email: string, password: string, firstName: string, lastName: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName })
    });
    return handleResponse(response);
  }
};

export const productsAPI = {
  async getProducts(params: any = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/products?${queryString}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async getProduct(id: string) {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

export const chatAPI = {
  async sendMessage(message: string, conversationId?: string) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, conversationId })
    });
    return handleResponse(response);
  },

  async getConversations() {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async deleteConversation(id: string) {
    const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};