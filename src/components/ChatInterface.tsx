import React, { useState, useEffect, useRef } from 'react';
import { Send, RotateCcw, MessageSquare, User, ShoppingBag, LogOut, History, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI } from '../services/api';
import { ProductCard } from './ProductCard';
import { ConversationHistory } from './ConversationHistory';
import { TypingIndicator } from './TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: any[];
  timestamp: string;
}

interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { user, logout } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${user?.firstName}! 👋 Welcome to our store! I'm your personal shopping assistant. I can help you find products, compare prices, and answer questions about our inventory. What are you looking for today?`,
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await chatAPI.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await chatAPI.sendMessage(inputMessage, conversationId || undefined);
      
      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      setMessages(prev => [...prev, response.message]);
      loadConversations(); // Refresh conversation history
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: `Hi again! 👋 I'm ready to help you find more amazing products. What would you like to explore?`,
      timestamp: new Date().toISOString()
    }]);
    setConversationId(null);
  };

  const loadConversation = (conversation: Conversation) => {
    setMessages(conversation.messages);
    setConversationId(conversation.id);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string) => {
    try {
      await chatAPI.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        handleResetConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">E-Commerce Assistant</h1>
                <p className="text-sm text-gray-600">AI-Powered Shopping Experience</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                title="Conversation History"
              >
                <History className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleResetConversation}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                title="New Conversation"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Conversation History Sidebar */}
          {showHistory && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Conversations</h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ConversationHistory
                  conversations={conversations}
                  currentConversationId={conversationId}
                  onLoadConversation={loadConversation}
                  onDeleteConversation={deleteConversation}
                />
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className={`${showHistory ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Chat Messages */}
              <div className="h-[600px] overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-3xl ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-br-md'
                          : 'bg-gray-50 text-gray-900 rounded-2xl rounded-bl-md'
                      } px-4 py-3`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <div className="h-6 w-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mt-0.5">
                            <MessageSquare className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed whitespace-pre-line">
                            {message.content}
                          </p>
                          <p className={`text-xs mt-1 opacity-70 ${
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Product Cards */}
                      {message.products && message.products.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {message.products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex space-x-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask me about products, prices, or recommendations..."
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl px-6 py-3 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}