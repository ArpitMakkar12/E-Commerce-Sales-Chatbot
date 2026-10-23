import React, { useState } from 'react';
import { LogIn, Mail, Lock, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('ShopDemo#2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, notice } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-gray-600">Sign in to your account to continue shopping</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="relative block w-full py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all duration-200 border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative block w-full py-3 pl-10 pr-3 text-gray-900 placeholder-gray-500 transition-all duration-200 border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>
          </div>

          {notice && !error && (
            <div className="px-4 py-3 border rounded-lg bg-amber-50 border-amber-200 text-amber-800">
              {notice}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-red-700 border border-red-200 rounded-lg bg-red-50">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white transition-all duration-200 border border-transparent rounded-lg group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-b-2 border-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign in
                </>
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-500"
              >
                Sign up
              </button>
            </p>
          </div>

          <div className="p-4 mt-6 rounded-lg bg-blue-50">
            <p className="mb-2 text-sm font-medium text-blue-700">Demo Account:</p>
            <p className="text-xs text-blue-600">
              Email: demo@example.com<br />
              Password: ShopDemo#2026
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}