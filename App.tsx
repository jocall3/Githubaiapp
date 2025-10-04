import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { FileExplorer } from './components/FileExplorer';
import { EditorCanvas } from './components/EditorCanvas';
import { fetchAllRepos, fetchRepoTree, getFileContent, commitFile, getRepoBranches, createBranch, createPullRequest, getBranch } from './services/githubService';
import { editFileWithAI, bulkEditFileWithAI } from './services/geminiService';
import { GithubRepo, UnifiedFileTree, SelectedFile, Alert, Branch, FileNode, DirNode } from './types';
import { Spinner } from './components/Spinner';
import { AlertPopup } from './components/AlertPopup';
import { BulkAiEditModal } from './components/BulkAiEditModal';

const getAllFilePaths = (nodes: (DirNode | FileNode)[]): string[] => {
    let paths: string[] = [];
    for (const node of nodes) {
        if (node.type === 'file') {
            paths.push(node.path);
        } else if (node.type === 'dir') {
            paths = paths.concat(getAllFilePaths(node.children));
        }
    }
    return paths;
};


export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<UnifiedFileTree>({});
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [alert, setAlert] = useState<Alert | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);

  const [bulkEditRepo, setBulkEditRepo] = useState<string | null>(null);

  const handleTokenSubmit = useCallback(async (submittedToken: string) => {
    if (!submittedToken) return;
    setToken(submittedToken);
    setIsLoading(true);
    setLoadingMessage('Fetching repositories...');
    try {
      const repos: GithubRepo[] = await fetchAllRepos(submittedToken);
      const newFileTree: UnifiedFileTree = {};
      
      const repoPromises = repos.map(async (repo) => {
        setLoadingMessage(`Processing ${repo.owner.login}/${repo.name}...`);
        try {
          // Store the full repo object for later use
          newFileTree[repo.full_name] = { repo, tree: [] };
          const tree = await fetchRepoTree(submittedToken, repo.owner.login, repo.name, repo.default_branch);
          newFileTree[repo.full_name].tree = tree;
        } catch (error) {
          console.error(`Failed to fetch tree for ${repo.full_name}`, error);
        }
      });

      await Promise.all(repoPromises);
      setFileTree(newFileTree);
      showAlert('success', 'Successfully loaded all repositories.');
    } catch (error) {
      console.error(error);
      setToken(null);
      showAlert('error', `Login failed. ${error instanceof Error ? error.message : 'Please check your token and permissions.'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);
  
  const handleFileSelect = useCallback(async (repoFullName: string, path: string, branch?: string) => {
    if (!token) return;
    setIsLoading(true);
    setLoadingMessage(`Loading ${path}...`);
    try {
      const [owner, repoName] = repoFullName.split('/');
      const repoData = fileTree[repoFullName]?.repo;
      if (!repoData) throw new Error("Repository data not found");

      if (selectedFile?.repoFullName !== repoFullName) {
        setLoadingMessage('Fetching branches...');
        const repoBranches = await getRepoBranches(token, owner, repoName);
        setBranches(repoBranches);
      }
      
      const effectiveBranch = branch || (repoFullName === selectedFile?.repoFullName ? currentBranch : repoData.default_branch) || repoData.default_branch;
      setCurrentBranch(effectiveBranch!);

      setLoadingMessage(`Loading ${path} from branch ${effectiveBranch}...`);
      const file = await getFileContent(token, owner, repoName, path, effectiveBranch);
      setSelectedFile({
        repoFullName,
        path: file.path,
        content: file.content,
        sha: file.sha,
        defaultBranch: repoData.default_branch,
      });
    } catch (error) {
      console.error(error);
      showAlert('error', `Failed to load file: ${path}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, fileTree, selectedFile, currentBranch]);

  const handleAiEdit = useCallback(async (currentCode: string, instruction: string): Promise<string> => {
    setIsLoading(true);
    setLoadingMessage('AI is editing the code...');
    try {
      const newCode = await editFileWithAI(currentCode, instruction);
      showAlert('success', 'AI edit complete.');
      return newCode;
    } catch (error) {
        console.error("AI Edit Error:", error);
        const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'An unknown AI error occurred.');
        showAlert('error', `AI Error: ${errorMessage}`);
        return currentCode;
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  const handleCommit = useCallback(async (commitMessage: string, content: string) => {
    if (!token || !selectedFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage('Committing changes...');
    try {
      const [owner, repoName] = selectedFile.repoFullName.split('/');
      
      await commitFile({
        token,
        owner,
        repo: repoName,
        branch: currentBranch,
        path: selectedFile.path,
        content,
        message: commitMessage,
        sha: selectedFile.sha,
      });

      const updatedFile = await getFileContent(token, owner, repoName, selectedFile.path, currentBranch);
      setSelectedFile(prev => prev ? { ...prev, content: updatedFile.content, sha: updatedFile.sha } : null);
      showAlert('success', 'Commit successful!');
    } catch (error) {
      console.error(error);
      showAlert('error', `Failed to commit changes: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, selectedFile, currentBranch]);

  const handleBranchChange = useCallback((newBranch: string) => {
    if (selectedFile) {
        handleFileSelect(selectedFile.repoFullName, selectedFile.path, newBranch);
    }
  }, [selectedFile, handleFileSelect]);

  const handleCreateBranch = useCallback(async (newBranchName: string) => {
    if (!token || !selectedFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage(`Creating branch ${newBranchName}...`);
    try {
        const [owner, repoName] = selectedFile.repoFullName.split('/');
        const baseBranch = branches.find(b => b.name === currentBranch);
        if (!baseBranch) throw new Error("Base branch not found");

        await createBranch(token, owner, repoName, newBranchName, baseBranch.commit.sha);
        
        const newBranches = await getRepoBranches(token, owner, repoName);
        setBranches(newBranches);
        setCurrentBranch(newBranchName);
        showAlert('success', `Branch '${newBranchName}' created successfully.`);

    } catch(error) {
        console.error(error);
        showAlert('error', `Failed to create branch: ${(error as Error).message}`);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [token, selectedFile, currentBranch, branches]);

  const handleCreatePullRequest = useCallback(async (title: string, body: string) => {
    if (!token || !selectedFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage('Creating pull request...');
    try {
      const [owner, repoName] = selectedFile.repoFullName.split('/');
      
      const pr = await createPullRequest({
        token,
        owner,
        repo: repoName,
        title,
        body,
        head: currentBranch,
        base: selectedFile.defaultBranch,
      });

      showAlert('success', `Successfully created Pull Request #${pr.number}!`);
      window.open(pr.html_url, '_blank');

    } catch (error) {
      console.error(error);
      showAlert('error', `Failed to create pull request: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, selectedFile, currentBranch]);

  const handleStartBulkEdit = useCallback((repoFullName: string) => {
    setBulkEditRepo(repoFullName);
  }, []);

  const handleBulkEditSubmit = useCallback(async (instruction: string, newBranchName: string) => {
    if (!token || !bulkEditRepo) return;
    
    setIsLoading(true);
    const [owner, repo] = bulkEditRepo.split('/');
    const repoData = fileTree[bulkEditRepo]?.repo;
    if (!repoData) {
        showAlert('error', 'Could not find repository data.');
        setIsLoading(false);
        return;
    }
    
    try {
        setLoadingMessage(`Fetching base branch info...`);
        const defaultBranchInfo = await getBranch(token, owner, repo, repoData.default_branch);

        setLoadingMessage(`Creating new branch: ${newBranchName}...`);
        await createBranch(token, owner, repo, newBranchName, defaultBranchInfo.commit.sha);

        const filePaths = getAllFilePaths(fileTree[bulkEditRepo].tree);
        const totalFiles = filePaths.length;

        for (let i = 0; i < totalFiles; i++) {
            const path = filePaths[i];
            
            try {
                setLoadingMessage(`[${i + 1}/${totalFiles}] Fetching ${path}...`);
                const fileContent = await getFileContent(token, owner, repo, path, repoData.default_branch);

                setLoadingMessage(`[${i + 1}/${totalFiles}] AI editing ${path}...`);
                const newContent = await bulkEditFileWithAI(fileContent.content, instruction, path);
                
                if (newContent.trim() === fileContent.content.trim()) {
                    setLoadingMessage(`[${i + 1}/${totalFiles}] No changes for ${path}, skipping commit.`);
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                    continue;
                }
                
                setLoadingMessage(`[${i + 1}/${totalFiles}] Committing changes to ${path}...`);
                await commitFile({
                    token,
                    owner,
                    repo,
                    branch: newBranchName,
                    path: fileContent.path,
                    content: newContent,
                    message: `[AI] Bulk edit: ${path}`,
                    sha: fileContent.sha,
                });
            } catch (fileError) {
                 console.error(`Failed to process file ${path}:`, fileError);
                 showAlert('error', `Skipping file ${path}: ${(fileError as Error).message}`);
            }
        }

        showAlert('success', `Bulk edit complete! All changes are on branch '${newBranchName}'.`);

    } catch (error) {
        console.error(error);
        showAlert('error', `Bulk edit failed: ${(error as Error).message}`);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [token, bulkEditRepo, fileTree]);
  
  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
  };

  if (!token) {
    return <AuthModal onSubmit={handleTokenSubmit} isLoading={isLoading} />;
  }

  return (
    <div className="flex flex-col h-screen font-sans">
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50">
          <Spinner />
          <p className="mt-4 text-lg text-gray-300">{loadingMessage}</p>
        </div>
      )}
      <AlertPopup alert={alert} onClose={() => setAlert(null)} />
      
      {bulkEditRepo && (
        <BulkAiEditModal 
            repoFullName={bulkEditRepo}
            onClose={() => setBulkEditRepo(null)}
            onSubmit={handleBulkEditSubmit}
            isLoading={isLoading}
        />
      )}

      <div className="flex flex-grow min-h-0">
        <div className="w-1/4 bg-gray-900 border-r border-gray-700 overflow-y-auto">
          <FileExplorer 
            fileTree={fileTree} 
            onFileSelect={handleFileSelect} 
            onStartBulkEdit={handleStartBulkEdit}
            selectedFilePath={selectedFile?.path} 
            selectedRepo={selectedFile?.repoFullName}
          />
        </div>
        <div className="w-3/4 flex flex-col">
          <EditorCanvas
            selectedFile={selectedFile}
            onCommit={handleCommit}
            onAiEdit={handleAiEdit}
            isLoading={isLoading}
            branches={branches}
            currentBranch={currentBranch}
            onBranchChange={handleBranchChange}
            onCreateBranch={handleCreateBranch}
            onCreatePullRequest={handleCreatePullRequest}
          />
        </div>
      </div>
    </div>
  );
}
