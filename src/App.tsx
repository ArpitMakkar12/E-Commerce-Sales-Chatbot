import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ChatInterface } from './components/ChatInterface';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {authMode === 'login' ? (
          <Login onSwitchToRegister={() => setAuthMode('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  return <ChatInterface />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;