import React, { useState } from 'react';
import { UnifiedFileTree, DirNode, FileNode, GithubRepo } from '../types';
import { FolderIcon, FolderOpenIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { BotIcon } from './icons/BotIcon';

interface FileExplorerProps {
  fileTree: UnifiedFileTree;
  onFileSelect: (repoFullName: string, path: string) => void;
  onStartBulkEdit: (repoFullName: string) => void;
  selectedFilePath?: string | null;
  selectedRepo?: string | null;
}

interface TreeNodeProps {
    node: DirNode | FileNode;
    repoFullName: string;
    onFileSelect: (repoFullName: string, path: string) => void;
    selectedFilePath?: string | null;
    selectedRepo?: string | null;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, repoFullName, onFileSelect, selectedFilePath, selectedRepo }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (node.type === 'dir') {
        return (
            <div>
                <div 
                    className="flex items-center p-1.5 cursor-pointer hover:bg-gray-700 rounded-md"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <FolderOpenIcon className="w-5 h-5 mr-2 text-indigo-400" /> : <FolderIcon className="w-5 h-5 mr-2 text-indigo-400" />}
                    <span>{node.name}</span>
                </div>
                {isOpen && (
                    <div className="pl-4 border-l border-gray-700 ml-2">
                        {node.children.map(child => (
                            <TreeNode 
                                key={child.path} 
                                node={child} 
                                repoFullName={repoFullName} 
                                onFileSelect={onFileSelect} 
                                selectedFilePath={selectedFilePath}
                                selectedRepo={selectedRepo} 
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const isSelected = selectedRepo === repoFullName && selectedFilePath === node.path;
    return (
        <div
            className={`flex items-center p-1.5 cursor-pointer hover:bg-gray-700 rounded-md ${isSelected ? 'bg-indigo-900 bg-opacity-50' : ''}`}
            onClick={() => onFileSelect(repoFullName, node.path)}
        >
            <FileIcon className="w-5 h-5 mr-2 text-gray-400" />
            <span className={isSelected ? 'text-white' : 'text-gray-300'}>{node.name}</span>
        </div>
    );
};

const RepoNode: React.FC<{
    repo: GithubRepo;
    tree: (DirNode | FileNode)[];
    onFileSelect: (repoFullName: string, path: string) => void;
    onStartBulkEdit: (repoFullName: string) => void;
    selectedFilePath?: string | null;
    selectedRepo?: string | null;
}> = ({ repo, tree, onFileSelect, onStartBulkEdit, selectedFilePath, selectedRepo }) => {
    const isRepoSelected = repo.full_name === selectedRepo;
    const [isOpen, setIsOpen] = useState(isRepoSelected);

    React.useEffect(() => {
        setIsOpen(isRepoSelected);
    }, [isRepoSelected]);

    const handleBulkEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartBulkEdit(repo.full_name);
    }

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between p-2 hover:bg-gray-700 rounded-md group">
                <h3 
                    className="text-lg font-semibold cursor-pointer flex items-center flex-grow"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <FolderOpenIcon className="w-5 h-5 mr-2" /> : <FolderIcon className="w-5 h-5 mr-2" />}
                    {repo.full_name}
                </h3>
                 <button 
                    onClick={handleBulkEditClick} 
                    className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Bulk Edit with AI"
                >
                    <BotIcon className="w-5 h-5" />
                </button>
            </div>
            {isOpen && (
                <div className="pl-4 border-l border-gray-700 ml-2">
                    {tree.map(node => (
                        <TreeNode 
                            key={node.path} 
                            node={node} 
                            repoFullName={repo.full_name} 
                            onFileSelect={onFileSelect} 
                            selectedFilePath={selectedFilePath}
                            selectedRepo={selectedRepo} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ fileTree, onFileSelect, onStartBulkEdit, selectedFilePath, selectedRepo }) => {
  return (
    <div className="p-4 text-gray-300">
      <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Repositories</h2>
      {Object.keys(fileTree).sort().map(repoFullName => (
        <RepoNode 
            key={repoFullName} 
            repo={fileTree[repoFullName].repo}
            tree={fileTree[repoFullName].tree}
            onFileSelect={onFileSelect}
            onStartBulkEdit={onStartBulkEdit}
            selectedFilePath={selectedFilePath}
            selectedRepo={selectedRepo}
        />
      ))}
    </div>
  );
};
