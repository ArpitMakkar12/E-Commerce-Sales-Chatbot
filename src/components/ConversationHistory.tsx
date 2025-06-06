import React from 'react';
import { MessageSquare, Trash2, Clock } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onLoadConversation: (conversation: Conversation) => void;
  onDeleteConversation: (id: string) => void;
}

export function ConversationHistory({
  conversations,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation
}: ConversationHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
  };

  const getPreviewText = (messages: Message[]) => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 'New conversation';
    
    const firstUserMessage = userMessages[0].content;
    return firstUserMessage.length > 50 
      ? firstUserMessage.substring(0, 50) + '...'
      : firstUserMessage;
  };

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No conversations yet</p>
        <p className="text-gray-400 text-xs">Start chatting to see your history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`relative group p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
            currentConversationId === conversation.id
              ? 'bg-blue-50 border-blue-200'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <div onClick={() => onLoadConversation(conversation)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">
                  {conversation.messages.length} messages
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conversation.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all duration-200"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
              {getPreviewText(conversation.messages)}
            </p>
            
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{formatDate(conversation.updatedAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}