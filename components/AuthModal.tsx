import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface AuthModalProps {
  onSubmit: (token: string) => void;
  isLoading: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSubmit, isLoading }) => {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(token);
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-850 p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold text-center text-gray-100 mb-2">GitHub AI Code Editor</h2>
        <p className="text-center text-gray-400 mb-6">Enter your Personal Access Token to begin.</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ghp_..."
              required
            />
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Your token is used only for API requests and is not stored. A classic token with the full <code className="bg-gray-700 p-1 rounded-sm text-xs">repo</code> scope is required.
          </p>
          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-850 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? <Spinner /> : 'Load Repositories'}
          </button>
        </form>
      </div>
    </div>
  );
};
