import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface BulkAiEditModalProps {
  repoFullName: string;
  onClose: () => void;
  onSubmit: (instruction: string, newBranchName: string) => Promise<void>;
  isLoading: boolean;
}

export const BulkAiEditModal: React.FC<BulkAiEditModalProps> = ({ repoFullName, onClose, onSubmit, isLoading }) => {
  const [instruction, setInstruction] = useState('');
  const [newBranchName, setNewBranchName] = useState(`ai-bulk-edit/${Date.now()}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || !newBranchName.trim() || isLoading) return;
    await onSubmit(instruction, newBranchName);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-950 bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-amber-400 mb-2">Bulk AI Edit Repository</h2>
        <p className="text-gray-400 mb-4">{repoFullName}</p>
        
        <div className="bg-red-900 border border-red-700 text-red-200 p-3 rounded-md mb-6 text-sm">
            <p><strong>Warning:</strong> This is an experimental and potentially destructive action. It will:</p>
            <ul className="list-disc list-inside mt-2">
                <li>Create a new branch in your repository.</li>
                <li>Iterate through <strong>every file</strong> and apply AI edits based on your instruction.</li>
                <li>This may take a very long time and consume significant API resources.</li>
            </ul>
             <p className="mt-2">It is highly recommended to review all changes carefully before merging.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="instruction" className="block text-sm font-medium text-gray-300 mb-2">
              High-Level Instruction
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., 'Refactor the entire repository to use TypeScript and add comprehensive JSDoc comments to all functions.'"
              className="w-full h-32 bg-gray-900 p-3 rounded-md text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              autoFocus
            />
          </div>
          <div className="mb-6">
             <label htmlFor="branchName" className="block text-sm font-medium text-gray-300 mb-2">
                New Branch Name
             </label>
             <input
              id="branchName"
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full bg-gray-900 p-3 rounded-md text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

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
              disabled={isLoading || !instruction.trim() || !newBranchName.trim()}
              className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-md hover:bg-amber-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[120px]"
            >
              {isLoading ? <Spinner /> : 'Start Bulk Edit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
