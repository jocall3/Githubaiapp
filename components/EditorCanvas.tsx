import React, { useState, useEffect } from 'react';
import { SelectedFile, Branch } from '../types';
import { Spinner } from './Spinner';
import { AiChatModal } from './AiChatModal';
import { CommitModal } from './CommitModal';
import { SparklesIcon } from './icons/SparklesIcon';

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
  const [editedContent, setEditedContent] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');

  useEffect(() => {
    if (selectedFile) {
        const defaultPrTitle = `Update ${selectedFile.path}`;
        setPrTitle(defaultPrTitle);
        setEditedContent(selectedFile.content);
    }
  }, [selectedFile]);
  
  const hasChanges = selectedFile ? editedContent !== selectedFile.content : false;

  const handleAiSubmit = async (instruction: string) => {
    if (!instruction.trim()) return;
    const newCode = await onAiEdit(editedContent, instruction);
    setEditedContent(newCode);
  };

  const handleCommitSubmit = async (commitMessage: string) => {
    if (!commitMessage.trim() || !selectedFile) return;
    await onCommit(commitMessage, editedContent);
    setIsCommitModalOpen(false); // Close modal on success
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
  
  const defaultCommitMessage = `Update ${selectedFile.path}`;

  return (
    <div className="flex flex-col h-full bg-gray-850 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-900 flex-wrap gap-2">
        <div>
          <h3 className="text-md font-semibold text-gray-200">{selectedFile.path}</h3>
          <p className="text-xs text-gray-400">{selectedFile.repoFullName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch Controls */}
          <div className="flex items-center gap-2">
            <select
              id="branch-select"
              value={currentBranch || ''}
              onChange={(e) => onBranchChange(e.target.value)}
              disabled={isLoading}
              className="bg-gray-800 p-2 rounded-md text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            {!isCreatingBranch ? (
              <button onClick={() => setIsCreatingBranch(true)} className="text-sm text-cyan-400 hover:underline px-3 py-1.5" disabled={isLoading}>New Branch</button>
            ) : (
               <div className="flex gap-2 items-center">
                 <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="new-branch-name"
                    className="bg-gray-800 p-2 rounded-md text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button onClick={handleCreateBranchClick} disabled={isLoading || !newBranchName.trim()} className="text-sm bg-cyan-600 text-white font-semibold py-1 px-2 rounded hover:bg-cyan-700 disabled:bg-gray-500">Create</button>
                  <button onClick={() => setIsCreatingBranch(false)} className="text-sm bg-gray-600 text-white font-semibold py-1 px-2 rounded hover:bg-gray-700">X</button>
               </div>
            )}
          </div>
          
          {/* Commit Button */}
          <button
            onClick={() => setIsCommitModalOpen(true)}
            disabled={isLoading || !hasChanges}
            className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Commit Changes
          </button>

          {/* PR Button */}
          {currentBranch && currentBranch !== selectedFile.defaultBranch && (
             <button 
                onClick={() => setIsCreatingPR(!isCreatingPR)} 
                className="bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-cyan-700 disabled:bg-gray-500"
                disabled={isLoading}
            >
                {isCreatingPR ? 'Cancel PR' : 'Create Pull Request'}
            </button>
          )}
        </div>
      </div>
      
      {/* Create PR Form (inline) */}
      {isCreatingPR && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
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
                <button onClick={handleCreatePrClick} disabled={isLoading || !prTitle.trim()} className="text-sm bg-cyan-600 text-white font-semibold py-1 px-2 rounded hover:bg-cyan-700 disabled:bg-gray-500 flex items-center justify-center">
                    {isLoading ? <Spinner className="h-4 w-4" /> : 'Submit Pull Request'}
                </button>
            </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-grow p-4">
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full h-full border border-gray-700 rounded-md bg-gray-950 text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          spellCheck="false"
        />
      </div>

      {/* AI Edit FAB */}
      <button
        onClick={() => setIsAiModalOpen(true)}
        className="absolute bottom-6 right-6 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-4 focus:ring-offset-gray-850 focus:ring-indigo-500 transition-transform hover:scale-110"
        aria-label="Edit with AI"
      >
        <SparklesIcon className="h-6 w-6" />
      </button>

      {/* Modals */}
      {isAiModalOpen && (
        <AiChatModal
          onClose={() => setIsAiModalOpen(false)}
          onSubmit={handleAiSubmit}
          isLoading={isLoading}
        />
      )}
      {isCommitModalOpen && (
        <CommitModal
          onClose={() => setIsCommitModalOpen(false)}
          onCommit={handleCommitSubmit}
          isLoading={isLoading}
          defaultMessage={defaultCommitMessage}
        />
      )}
    </div>
  );
};
