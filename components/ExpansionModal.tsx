import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface ExpansionModalProps {
  fileCount: number;
  onClose: () => void;
  onSubmit: (goal: string, filesPerSeed: number) => Promise<void>;
}

export const ExpansionModal: React.FC<ExpansionModalProps> = ({ fileCount, onClose, onSubmit }) => {
  const [goal, setGoal] =useState('');
  const [filesPerSeed, setFilesPerSeed] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isLoading) return;
    setIsLoading(true);
    await onSubmit(goal, filesPerSeed);
    // The modal will be closed by the parent component, which will set `isExpansionModalOpen` to false.
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-purple-400 mb-2">AI Project Expansion</h2>
        <p className="text-gray-400 mb-4">{fileCount} seed file{fileCount > 1 ? 's' : ''} selected.</p>
        
        <div className="bg-gray-900 border border-gray-700 text-gray-300 p-3 rounded-md mb-6 text-sm">
            <p><strong>This AI will act as an architect and a programmer.</strong></p>
            <ul className="list-disc list-inside mt-2">
                <li>It will analyze your goal and seed file(s) to create a blueprint of new files.</li>
                <li>It will then write and <strong className="text-yellow-300">automatically commit</strong> each new file to the <strong className="text-yellow-300">current branch</strong>.</li>
                <li>This process is autonomous. Review commits carefully after completion.</li>
            </ul>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="goal" className="block text-sm font-medium text-gray-300 mb-2">
              High-Level Goal
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., 'Based on this API service, build out the corresponding data models, validation schemas, and a basic React component to display the data.'"
              className="w-full h-32 bg-gray-900 p-3 rounded-md text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label htmlFor="filesPerSeed" className="block text-sm font-medium text-gray-300 mb-2">
              New Files to Create per Seed File
            </label>
            <input
              id="filesPerSeed"
              type="number"
              min="1"
              max="10"
              value={filesPerSeed}
              onChange={(e) => setFilesPerSeed(parseInt(e.target.value, 10))}
              className="w-24 bg-gray-900 p-2 rounded-md text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex justify-end gap-4 mt-6">
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
              disabled={isLoading || !goal.trim()}
              className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? <Spinner /> : 'Begin Expansion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
