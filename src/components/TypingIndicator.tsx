import React from 'react';
import { MessageSquare } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-50 text-gray-900 rounded-2xl rounded-bl-md px-4 py-3 max-w-xs">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-white" />
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