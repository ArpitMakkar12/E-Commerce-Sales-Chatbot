import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, RotateCcw, MessageSquare, User as UserIcon, ShoppingBag, LogOut, History, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI } from '../services/api';
import type { ChatMessage, ConversationSummary } from '../types';
import { ProductCard } from './ProductCard';
import { ConversationHistory } from './ConversationHistory';
import { TypingIndicator } from './TypingIndicator';

// Quick-start ideas shown under a fresh conversation.
const SUGGESTIONS = [
  'Laptops under $1500',
  'Best rated books',
  'Running shoes',
  'Gift ideas under $50',
  'Compare iPhone 15 Pro vs Galaxy S24',
];

function makeWelcome(firstName?: string, again = false): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    role: 'assistant',
    content: again
      ? "Fresh start! 👋 What would you like to explore?"
      : `Hi ${firstName ?? 'there'}! 👋 I'm your shopping assistant. I can find products, stick to your budget, compare items and show details. What are you looking for today?`,
    timestamp: new Date().toISOString(),
  };
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function ChatInterface() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeWelcome(user?.firstName)]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocusInput = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await chatAPI.getConversations());
      setHistoryError('');
    } catch (error) {
      setHistoryError(errorText(error, 'Could not load your conversations.'));
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  // Put the cursor back in the box after the bot answers (the input is disabled while it types).
  useEffect(() => {
    if (!isTyping && refocusInput.current) {
      refocusInput.current = false;
      inputRef.current?.focus();
    }
  }, [isTyping]);

  const sendMessage = async (text: string) => {
    const message = text.trim();
    if (!message || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: message, timestamp: new Date().toISOString() },
    ]);
    setInput('');
    setIsTyping(true);
    refocusInput.current = true;

    try {
      const response = await chatAPI.sendMessage(message, conversationId ?? undefined);
      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, response.message]);
      loadConversations();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorText(error, 'Sorry, something went wrong. Please try again.'),
          timestamp: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startNewConversation = () => {
    setMessages([makeWelcome(user?.firstName, true)]);
    setConversationId(null);
  };

  const openConversation = async (id: string) => {
    try {
      const conversation = await chatAPI.getConversation(id);
      setMessages(conversation.messages);
      setConversationId(conversation.id);
      if (window.innerWidth < 1024) setShowHistory(false);
    } catch (error) {
      setHistoryError(errorText(error, 'Could not open that conversation.'));
      loadConversations();
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await chatAPI.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewConversation();
    } catch (error) {
      setHistoryError(errorText(error, 'Could not delete that conversation.'));
    }
  };

  const iconButton = 'p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-lg">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 py-3 sm:py-4">
            <div className="flex items-center min-w-0 space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-gradient-to-r from-blue-600 to-purple-600">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 truncate sm:text-xl">E-Commerce Assistant</h1>
                <p className="hidden text-sm text-gray-600 sm:block">AI-Powered Shopping Experience</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-3">
              <button
                onClick={() => setShowHistory((open) => !open)}
                className={`${iconButton} ${showHistory ? 'bg-gray-100 text-gray-900' : ''}`}
                title="Conversation history"
                aria-label="Conversation history"
                aria-pressed={showHistory}
              >
                <History className="w-5 h-5" />
              </button>
              <button onClick={startNewConversation} className={iconButton} title="New conversation" aria-label="New conversation">
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="items-center hidden pl-2 space-x-2 md:flex">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-300 rounded-full">
                  <UserIcon className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-600 transition-all duration-200 rounded-lg hover:text-red-600 hover:bg-red-50"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-2 py-4 mx-auto max-w-7xl sm:px-6 lg:px-8 sm:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 sm:gap-6">
          {/* Conversation history */}
          {showHistory && (
            <aside className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Conversations</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 lg:hidden"
                    aria-label="Close history"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {historyError && <p className="mb-3 text-xs text-red-600">{historyError}</p>}
                <ConversationHistory
                  conversations={conversations}
                  currentConversationId={conversationId}
                  onSelect={openConversation}
                  onDelete={deleteConversation}
                />
              </div>
            </aside>
          )}

          {/* Chat */}
          <main className={showHistory ? 'lg:col-span-3' : 'lg:col-span-4'}>
            {/* Fills the screen below the header, so the message box is always visible */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-7.5rem)] min-h-[460px]">
              <div className="flex-1 min-h-0 p-3 space-y-4 overflow-y-auto sm:p-6" aria-live="polite">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const hasProducts = !!message.products?.length;
                  return (
                    <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`${hasProducts ? 'w-full max-w-4xl' : 'max-w-[85%] sm:max-w-2xl'} px-4 py-3 ${
                          isUser
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-br-md'
                            : message.error
                              ? 'bg-red-50 text-red-800 border border-red-200 rounded-2xl rounded-bl-md'
                              : 'bg-gray-50 text-gray-900 rounded-2xl rounded-bl-md'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {!isUser && (
                            <div className="h-6 w-6 shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mt-0.5">
                              <MessageSquare className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed break-words whitespace-pre-line">{message.content}</p>
                            <p className={`text-xs mt-1 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>

                        {hasProducts && (
                          <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2 xl:grid-cols-3">
                            {message.products!.map((product) => (
                              <ProductCard key={product.id} product={product} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions + input */}
              <div className="p-3 space-y-3 border-t border-gray-200 sm:p-4">
                {messages.length === 1 && !isTyping && (
                  <div className="flex gap-2 pb-1 overflow-x-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendMessage(suggestion)}
                        className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex space-x-2 sm:space-x-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about products, prices, or recommendations..."
                    maxLength={500}
                    aria-label="Message"
                    className="flex-1 min-w-0 px-4 py-3 transition-all duration-200 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    aria-label="Send message"
                    className="flex items-center px-4 py-3 space-x-2 text-white transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl sm:px-6 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}