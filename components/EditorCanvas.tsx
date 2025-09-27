import React, { useState, useEffect } from 'react';
import { SelectedFile, Branch } from '../types';
import { Spinner } from './Spinner';

interface EditorCanvasProps {
  selectedFile: SelectedFile | null;
  onCommit: (commitMessage: string, content: string) => Promise<void>;
  onAiEdit: (currentCode: string, instruction: string) => Promise<string>;
  isLoading: boolean;
  branches: Branch[];
  currentBranch: string | null;
  onBranchChange: (newBranch: string) => void;
  onCreateBranch: (newBranchName: string) => Promise<void>;
  onCreatePullRequest: (title: string, body: string) => Promise<void>;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  selectedFile,
  onCommit,
  onAiEdit,
  isLoading,
  branches,
  currentBranch,
  onBranchChange,
  onCreateBranch,
  onCreatePullRequest,
}) => {
  const [aiInstruction, setAiInstruction] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    if (selectedFile) {
        const defaultCommitMsg = `Update ${selectedFile.path}`;
        setCommitMessage(defaultCommitMsg);
        setPrTitle(defaultCommitMsg);
        setEditedContent(selectedFile.content);
    }
  }, [selectedFile]);
  
  const hasChanges = selectedFile ? editedContent !== selectedFile.content : false;

  const handleAiEditClick = async () => {
    if (!aiInstruction.trim()) return;
    const newCode = await onAiEdit(editedContent, aiInstruction);
    setEditedContent(newCode);
  };

  const handleCommitClick = async () => {
    if (!commitMessage.trim() || !selectedFile) return;
    await onCommit(commitMessage, editedContent);
  };

  const handleCreateBranchClick = async () => {
    if (!newBranchName.trim()) return;
    await onCreateBranch(newBranchName);
    setNewBranchName('');
    setIsCreatingBranch(false);
  };
  
  const handleCreatePrClick = async () => {
    if (!prTitle.trim()) return;
    await onCreatePullRequest(prTitle, prBody);
    setIsCreatingPR(false); // Hide form on success
    setPrBody(''); // Clear body
  };

  if (!selectedFile) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-850 text-gray-500">
        <p>Select a file from the explorer to begin editing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-grow h-full">
      {/* Editor Panel */}
      <div className="w-2/3 flex flex-col bg-gray-850 p-4">
        <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-200">{selectedFile.path}</h3>
            <p className="text-sm text-gray-400">{selectedFile.repoFullName}</p>
        </div>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="flex-grow w-full border border-gray-700 rounded-md bg-gray-950 text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          spellCheck="false"
        />
      </div>

      {/* Control Panel */}
      <div className="w-1/3 flex flex-col bg-gray-900 p-6 border-l border-gray-700 overflow-y-auto">
        {/* AI Edit Section */}
        <div className="flex-grow min-h-0">
          <h3 className="text-xl font-bold mb-4 text-indigo-400">AI Assistant</h3>
          <p className="text-gray-400 mb-2 text-sm">Describe the changes you want to make:</p>
          <textarea
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder="e.g., 'Refactor this function to use async/await'"
            className="w-full h-32 bg-gray-800 p-3 rounded-md mb-4 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <button
            onClick={handleAiEditClick}
            disabled={isLoading || !aiInstruction.trim()}
            className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? <Spinner /> : 'Edit with AI'}
          </button>
        </div>
        
        <div className="border-t border-gray-700 pt-6 space-y-6">
            {/* Branch Management Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-cyan-400">Source Control</h3>
              <label htmlFor="branch-select" className="block text-sm font-medium text-gray-400 mb-2">Current Branch:</label>
              <select
                id="branch-select"
                value={currentBranch || ''}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={isLoading}
                className="w-full bg-gray-800 p-3 rounded-md mb-2 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>

              {!isCreatingBranch ? (
                <button onClick={() => setIsCreatingBranch(true)} className="text-sm text-cyan-400 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed" disabled={isLoading}>Create new branch</button>
              ) : (
                <div className="mt-2 p-3 bg-gray-800 rounded-md border border-gray-700">
                    <input
                        type="text"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        placeholder="new-branch-name"
                        className="w-full bg-gray-900 p-2 rounded-md mb-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleCreateBranchClick} disabled={isLoading || !newBranchName.trim()} className="flex-1 text-sm bg-cyan-600 text-white font-semibold py-1 px-2 rounded hover:bg-cyan-700 disabled:bg-gray-500">Create</button>
                        <button onClick={() => setIsCreatingBranch(false)} className="flex-1 text-sm bg-gray-600 text-white font-semibold py-1 px-2 rounded hover:bg-gray-700">Cancel</button>
                    </div>
                </div>
              )}

              {/* Pull Request Section */}
              {currentBranch && currentBranch !== selectedFile.defaultBranch && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    {!isCreatingPR ? (
                        <button 
                            onClick={() => setIsCreatingPR(true)} 
                            className="w-full text-sm bg-cyan-600 text-white font-semibold py-2 px-4 rounded hover:bg-cyan-700 disabled:bg-gray-500"
                            disabled={isLoading}
                        >
                            Create Pull Request
                        </button>
                    ) : (
                        <div className="p-3 bg-gray-800 rounded-md border border-gray-700">
                            <h4 className="font-semibold mb-2 text-gray-200">New Pull Request</h4>
                             <p className="text-xs text-gray-400 mb-2">
                                From <code className="bg-gray-700 p-1 rounded-sm text-xs">{currentBranch}</code> into <code className="bg-gray-700 p-1 rounded-sm text-xs">{selectedFile.defaultBranch}</code>
                            </p>
                            <input
                                type="text"
                                value={prTitle}
                                onChange={(e) => setPrTitle(e.target.value)}
                                placeholder="Pull request title"
                                className="w-full bg-gray-900 p-2 rounded-md mb-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <textarea
                                value={prBody}
                                onChange={(e) => setPrBody(e.target.value)}
                                placeholder="Describe your changes..."
                                className="w-full h-24 bg-gray-900 p-2 rounded-md mb-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleCreatePrClick} disabled={isLoading || !prTitle.trim()} className="flex-1 text-sm bg-cyan-600 text-white font-semibold py-1 px-2 rounded hover:bg-cyan-700 disabled:bg-gray-500 flex items-center justify-center">
                                    {isLoading ? <Spinner className="h-4 w-4" /> : 'Submit'}
                                </button>
                                <button onClick={() => setIsCreatingPR(false)} className="flex-1 text-sm bg-gray-600 text-white font-semibold py-1 px-2 rounded hover:bg-gray-700">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
              )}

            </div>

            {/* Commit Section */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-green-400">Commit Changes</h3>
              <p className={`text-sm mb-2 ${hasChanges ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {hasChanges ? 'You have unsaved changes.' : 'No changes to commit.'}
                </p>
              <p className="text-gray-400 mb-2 text-sm">Commit message:</p>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full bg-gray-800 p-3 rounded-md mb-4 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleCommitClick}
                disabled={isLoading || !hasChanges || !commitMessage.trim()}
                className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoading ? <Spinner /> : 'Commit to GitHub'}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};