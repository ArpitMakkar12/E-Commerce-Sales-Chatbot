import { MessageSquare, Trash2, Clock } from 'lucide-react';
import type { ConversationSummary } from '../types';

interface ConversationHistoryProps {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

// "Today, 10:42", "Yesterday", "3 days ago", or a date. Compares calendar days, not 24h blocks.
function formatDate(iso: string) {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

export function ConversationHistory({ conversations, currentConversationId, onSelect, onDelete }: ConversationHistoryProps) {
  if (conversations.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">No conversations yet</p>
        <p className="text-xs text-gray-400">Start chatting to see your history</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {conversations.map((conversation) => {
        const isCurrent = currentConversationId === conversation.id;
        return (
          <li
            key={conversation.id}
            className={`relative group rounded-lg border transition-all duration-200 ${
              isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <button type="button" onClick={() => onSelect(conversation.id)} className="w-full p-3 pr-10 text-left">
              <p className="mb-1 text-sm font-medium text-gray-900 line-clamp-2">{conversation.title}</p>
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{conversation.messageCount} messages</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(conversation.updatedAt)}</span>
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this conversation?')) onDelete(conversation.id);
              }}
              aria-label={`Delete conversation: ${conversation.title}`}
              className="absolute top-2 right-2 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}