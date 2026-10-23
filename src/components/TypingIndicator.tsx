import { MessageSquare } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-xs px-4 py-3 text-gray-900 bg-gray-50 rounded-2xl rounded-bl-md">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
            <MessageSquare className="w-3 h-3 text-white" />
          </div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}