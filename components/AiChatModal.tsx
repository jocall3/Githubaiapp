import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface AiChatModalProps {
  onClose: () => void;
  onSubmit: (instruction: string) => Promise<void>;
  isLoading: boolean;
}

export const AiChatModal: React.FC<AiChatModalProps> = ({ onClose, onSubmit, isLoading }) => {
  const [instruction, setInstruction] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isLoading) return;
    await onSubmit(instruction);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-indigo-400 mb-4">AI Assistant</h2>
        <form onSubmit={handleSubmit}>
          <p className="text-gray-400 mb-2 text-sm">Describe the changes you want to make to the code:</p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., 'Refactor this function to use async/await'"
            className="w-full h-40 bg-gray-900 p-3 rounded-md mb-4 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !instruction.trim()}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? <Spinner /> : 'Generate Edit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
