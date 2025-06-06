import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { products } from './data/products.js';
import { users } from './data/users.js';
import { conversations } from './data/conversations.js';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      firstName,
      lastName,
      createdAt: new Date().toISOString()
    };
    
    users.push(user);
    
    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Product Routes
app.get('/api/products', (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, limit = 20, offset = 0 } = req.query;
    
    let filteredProducts = [...products];
    
    // Filter by category
    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Filter by search term
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filter by price range
    if (minPrice) {
      filteredProducts = filteredProducts.filter(p => p.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filteredProducts = filteredProducts.filter(p => p.price <= parseFloat(maxPrice));
    }
    
    // Pagination
    const total = filteredProducts.length;
    const paginatedProducts = filteredProducts.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      products: paginatedProducts,
      total,
      hasMore: parseInt(offset) + parseInt(limit) < total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Chatbot Routes
app.post('/api/chat', authenticateToken, (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.userId;
    
    // Find or create conversation
    let conversation = conversations.find(c => c.id === conversationId && c.userId === userId);
    if (!conversation) {
      conversation = {
        id: conversationId || uuidv4(),
        userId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      conversations.push(conversation);
    }
    
    // Add user message
    const userMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(userMessage);
    
    // Generate bot response based on message content
    const botResponse = generateBotResponse(message);
    const botMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: botResponse.text,
      products: botResponse.products || [],
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(botMessage);
    
    conversation.updatedAt = new Date().toISOString();
    
    res.json({
      conversationId: conversation.id,
      message: botMessage
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/conversations', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const userConversations = conversations
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    res.json(userConversations);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/conversations/:id', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationIndex = conversations.findIndex(
      c => c.id === req.params.id && c.userId === userId
    );
    
    if (conversationIndex === -1) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversations.splice(conversationIndex, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Bot response generation
function generateBotResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Greetings
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return {
      text: "Hello! Welcome to our store! I'm here to help you find the perfect products. You can ask me about electronics, books, clothing, home & garden items, or sports equipment. What are you looking for today?"
    };
  }
  
  // Product search
  if (lowerMessage.includes('laptop') || lowerMessage.includes('computer')) {
    const laptopProducts = products.filter(p => 
      p.name.toLowerCase().includes('laptop') || 
      p.name.toLowerCase().includes('computer')
    ).slice(0, 3);
    
    return {
      text: "I found some great laptops for you! Here are our top recommendations:",
      products: laptopProducts
    };
  }
  
  if (lowerMessage.includes('phone') || lowerMessage.includes('smartphone')) {
    const phoneProducts = products.filter(p => 
      p.name.toLowerCase().includes('phone') || 
      p.name.toLowerCase().includes('smartphone')
    ).slice(0, 3);
    
    return {
      text: "Here are some excellent smartphones I'd recommend:",
      products: phoneProducts
    };
  }
  
  if (lowerMessage.includes('book')) {
    const bookProducts = products.filter(p => p.category === 'Books').slice(0, 3);
    return {
      text: "Great choice! Here are some popular books:",
      products: bookProducts
    };
  }
  
  if (lowerMessage.includes('clothing') || lowerMessage.includes('shirt') || lowerMessage.includes('jeans')) {
    const clothingProducts = products.filter(p => p.category === 'Clothing').slice(0, 3);
    return {
      text: "Here are some fashionable clothing items:",
      products: clothingProducts
    };
  }
  
  // Price queries
  if (lowerMessage.includes('cheap') || lowerMessage.includes('affordable') || lowerMessage.includes('budget')) {
    const affordableProducts = products
      .filter(p => p.price < 100)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
    
    return {
      text: "Here are some great budget-friendly options:",
      products: affordableProducts
    };
  }
  
  if (lowerMessage.includes('expensive') || lowerMessage.includes('premium') || lowerMessage.includes('luxury')) {
    const premiumProducts = products
      .filter(p => p.price > 500)
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    
    return {
      text: "Here are our premium products:",
      products: premiumProducts
    };
  }
  
  // Help and general queries
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
    return {
      text: "I can help you with:\n• Finding products by category (electronics, books, clothing, etc.)\n• Searching for specific items\n• Getting price comparisons\n• Product recommendations\n• Answering questions about features\n\nJust tell me what you're looking for!"
    };
  }
  
  // Default response with popular products
  const popularProducts = products
    .filter(p => p.rating >= 4.5)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);
  
  return {
    text: "I'd be happy to help you find what you're looking for! Here are some of our most popular products. You can also try asking about specific categories like electronics, books, clothing, or tell me your budget range.",
    products: popularProducts
  };
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});