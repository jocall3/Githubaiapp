import React, { useState, useEffect, useRef } from 'react';
import { UnifiedFileTree, DirNode, FileNode, GithubRepo } from '../types';
import { FolderIcon, FolderOpenIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { getAllFilePaths } from '../App';

interface FileExplorerProps {
  fileTree: UnifiedFileTree;
  onFileSelect: (repoFullName: string, path: string) => void;
  onStartExpansion: () => void;
  selectedFilePath?: string | null;
  selectedRepo?: string | null;
  selectedFiles: Set<string>;
  onFileSelection: (fileKey: string, isSelected: boolean) => void;
  onDirectorySelection: (nodes: (DirNode | FileNode)[], repoFullName: string, shouldSelect: boolean) => void;
}

interface TreeNodeProps {
    node: DirNode | FileNode;
    repoFullName: string;
    onFileClick: (repoFullName: string, path: string) => void;
    selectedFilePath?: string | null;
    selectedRepo?: string | null;
    selectedFiles: Set<string>;
    onFileSelection: (fileKey: string, isSelected: boolean) => void;
    onDirectorySelection: (nodes: (DirNode | FileNode)[], repoFullName: string, shouldSelect: boolean) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, repoFullName, onFileClick, selectedFilePath, selectedRepo, selectedFiles, onFileSelection, onDirectorySelection }) => {
    const [isOpen, setIsOpen] = useState(false);
    const checkboxRef = useRef<HTMLInputElement>(null);
    const isDir = node.type === 'dir';

    useEffect(() => {
        if (isDir && checkboxRef.current) {
            const descendantFiles = getAllFilePaths(node.children).map(p => `${repoFullName}::${p}`);
            if (descendantFiles.length === 0) {
                checkboxRef.current.indeterminate = false;
                checkboxRef.current.checked = false;
                return;
            }
            const selectedCount = descendantFiles.filter(key => selectedFiles.has(key)).length;
            
            if (selectedCount > 0 && selectedCount < descendantFiles.length) {
                checkboxRef.current.indeterminate = true;
            } else {
                checkboxRef.current.indeterminate = false;
                checkboxRef.current.checked = selectedCount === descendantFiles.length;
            }
        }
    }, [selectedFiles, node, isDir, repoFullName]);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDir) {
            onDirectorySelection(node.children, repoFullName, e.target.checked);
        } else {
            const fileKey = `${repoFullName}::${node.path}`;
            onFileSelection(fileKey, e.target.checked);
        }
    };

    if (isDir) {
        return (
            <div>
                <div className="flex items-center p-1.5 hover:bg-gray-700 rounded-md group">
                    <input type="checkbox" ref={checkboxRef} onChange={handleCheckboxChange} className="mr-2 h-4 w-4 rounded bg-gray-800 border-gray-600 text-purple-500 focus:ring-purple-600" />
                    <div 
                        className="flex items-center cursor-pointer flex-grow"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <FolderOpenIcon className="w-5 h-5 mr-2 text-indigo-400" /> : <FolderIcon className="w-5 h-5 mr-2 text-indigo-400" />}
                        <span>{node.name}</span>
                    </div>
                </div>
                {isOpen && (
                    <div className="pl-6 border-l border-gray-700 ml-4">
                        {node.children.map(child => (
                            <TreeNode 
                                key={child.path} 
                                node={child} 
                                repoFullName={repoFullName} 
                                onFileClick={onFileClick} 
                                selectedFilePath={selectedFilePath}
                                selectedRepo={selectedRepo}
                                selectedFiles={selectedFiles}
                                onFileSelection={onFileSelection}
                                onDirectorySelection={onDirectorySelection}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const isSelectedForEditing = selectedFiles.has(`${repoFullName}::${node.path}`);
    const isActiveFile = selectedRepo === repoFullName && selectedFilePath === node.path;
    return (
        <div
            className={`flex items-center p-1.5 group rounded-md ${isActiveFile ? 'bg-indigo-900 bg-opacity-50' : 'hover:bg-gray-700'}`}
        >
            <input type="checkbox" checked={isSelectedForEditing} onChange={handleCheckboxChange} className="mr-2 h-4 w-4 rounded bg-gray-800 border-gray-600 text-purple-500 focus:ring-purple-600" />
            <div className="flex items-center cursor-pointer flex-grow" onClick={() => onFileClick(repoFullName, node.path)}>
                <FileIcon className="w-5 h-5 mr-2 text-gray-400" />
                <span className={isActiveFile ? 'text-white' : 'text-gray-300'}>{node.name}</span>
            </div>
        </div>
    );
};

const RepoNode: React.FC<{
    repo: GithubRepo;
    tree: (DirNode | FileNode)[];
    onFileClick: (repoFullName: string, path: string) => void;
    selectedFilePath?: string | null;
    selectedRepo?: string | null;
    selectedFiles: Set<string>;
    onFileSelection: (fileKey: string, isSelected: boolean) => void;
    onDirectorySelection: (nodes: (DirNode | FileNode)[], repoFullName: string, shouldSelect: boolean) => void;
}> = (props) => {
    const { repo, tree, onFileClick, selectedFilePath, selectedRepo, selectedFiles, onFileSelection, onDirectorySelection } = props;
    const isRepoSelected = repo.full_name === selectedRepo;
    const [isOpen, setIsOpen] = useState(isRepoSelected);

    useEffect(() => {
        if(isRepoSelected && !isOpen) {
            setIsOpen(true);
        }
    }, [isRepoSelected, isOpen]);

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
            </div>
            {isOpen && (
                <div className="pl-4 border-l border-gray-700 ml-2">
                    {tree.map(node => (
                        <TreeNode 
                            key={node.path} 
                            node={node} 
                            repoFullName={repo.full_name} 
                            onFileClick={onFileClick} 
                            selectedFilePath={selectedFilePath}
                            selectedRepo={selectedRepo}
                            selectedFiles={selectedFiles}
                            onFileSelection={onFileSelection}
                            onDirectorySelection={onDirectorySelection} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
    fileTree, 
    onFileSelect, 
    onStartExpansion, 
    selectedFilePath, 
    selectedRepo,
    selectedFiles,
    onFileSelection,
    onDirectorySelection
}) => {
  return (
    <div className="p-4 text-gray-300">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h2 className="text-xl font-bold">Repositories</h2>
      </div>

      {selectedFiles.size > 0 && (
        <div className="mb-4 sticky top-0 bg-gray-900 py-2 z-10">
            <button
                onClick={onStartExpansion}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 transition-colors"
            >
                <SparklesIcon className="w-5 h-5" />
                AI Expand Project...
            </button>
        </div>
      )}

      {Object.keys(fileTree).sort().map(repoFullName => (
        <RepoNode 
            key={repoFullName} 
            repo={fileTree[repoFullName].repo}
            tree={fileTree[repoFullName].tree}
            onFileClick={onFileSelect}
            selectedFilePath={selectedFilePath}
            selectedRepo={selectedRepo}
            selectedFiles={selectedFiles}
            onFileSelection={onFileSelection}
            onDirectorySelection={onDirectorySelection}
        />
      ))}
    </div>
  );
};
