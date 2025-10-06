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
  
  const [openFiles, setOpenFiles] = useState<SelectedFile[]>([]);
  const [activeFileKey, setActiveFileKey] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [alert, setAlert] = useState<Alert | null>(null);
  
  const [branchesByRepo, setBranchesByRepo] = useState<Record<string, Branch[]>>({});
  const [currentBranchByRepo, setCurrentBranchByRepo] = useState<Record<string, string>>({});

  const [bulkEditRepo, setBulkEditRepo] = useState<string | null>(null);
  
  const activeFile = openFiles.find(f => (f.repoFullName + '::' + f.path) === activeFileKey);
  const currentBranch = activeFile ? currentBranchByRepo[activeFile.repoFullName] : null;
  const branches = activeFile ? branchesByRepo[activeFile.repoFullName] || [] : [];

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
  
  const handleOpenFile = useCallback(async (repoFullName: string, path: string, branch?: string) => {
    const fileKey = `${repoFullName}::${path}`;
    if (openFiles.some(f => f.repoFullName + '::' + f.path === fileKey)) {
      setActiveFileKey(fileKey);
      return;
    }

    if (!token) return;
    setIsLoading(true);
    setLoadingMessage(`Loading ${path}...`);
    try {
      const [owner, repoName] = repoFullName.split('/');
      const repoData = fileTree[repoFullName]?.repo;
      if (!repoData) throw new Error("Repository data not found");

      if (!branchesByRepo[repoFullName]) {
          setLoadingMessage('Fetching branches...');
          const repoBranches = await getRepoBranches(token, owner, repoName);
          setBranchesByRepo(prev => ({ ...prev, [repoFullName]: repoBranches }));
      }
      
      const effectiveBranch = branch || currentBranchByRepo[repoFullName] || repoData.default_branch;
      setCurrentBranchByRepo(prev => ({ ...prev, [repoFullName]: effectiveBranch }));

      setLoadingMessage(`Loading ${path} from branch ${effectiveBranch}...`);
      const file = await getFileContent(token, owner, repoName, path, effectiveBranch);
      
      const newFile: SelectedFile = {
        repoFullName,
        path: file.path,
        content: file.content,
        editedContent: file.content,
        sha: file.sha,
        defaultBranch: repoData.default_branch,
      };
      
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileKey(fileKey);

    } catch (error) {
      console.error(error);
      showAlert('error', `Failed to load file: ${path}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, fileTree, openFiles, branchesByRepo, currentBranchByRepo]);

  const handleCloseFile = useCallback((keyToClose: string) => {
    const index = openFiles.findIndex(f => (f.repoFullName + '::' + f.path) === keyToClose);
    if (index === -1) return;

    const newOpenFiles = openFiles.filter(f => (f.repoFullName + '::' + f.path) !== keyToClose);
    setOpenFiles(newOpenFiles);

    if (activeFileKey === keyToClose) {
        if (newOpenFiles.length === 0) {
            setActiveFileKey(null);
        } else {
            const newActiveIndex = Math.max(0, index - 1);
            const newActiveFile = newOpenFiles[newActiveIndex];
            setActiveFileKey(newActiveFile.repoFullName + '::' + newActiveFile.path);
        }
    }
  }, [openFiles, activeFileKey]);

  const handleSetActiveFile = useCallback((key: string) => {
    setActiveFileKey(key);
  }, []);

  const handleFileContentChange = useCallback((key: string, newContent: string) => {
    setOpenFiles(prevFiles => prevFiles.map(file => 
      (file.repoFullName + '::' + file.path) === key ? { ...file, editedContent: newContent } : file
    ));
  }, []);

  const handleAiEdit = useCallback(async (currentCode: string, instruction: string, onChunk: (chunk: string) => void): Promise<void> => {
    setIsLoading(true);
    setLoadingMessage('AI is editing the code...');
    try {
      await editFileWithAI(currentCode, instruction, onChunk);
      showAlert('success', 'AI edit complete.');
    } catch (error) {
        console.error("AI Edit Error:", error);
        const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'An unknown AI error occurred.');
        showAlert('error', `AI Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  const handleCommit = useCallback(async (commitMessage: string) => {
    if (!token || !activeFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage('Committing changes...');
    try {
      const [owner, repoName] = activeFile.repoFullName.split('/');
      
      await commitFile({
        token,
        owner,
        repo: repoName,
        branch: currentBranch,
        path: activeFile.path,
        content: activeFile.editedContent,
        message: commitMessage,
        sha: activeFile.sha,
      });

      const updatedFile = await getFileContent(token, owner, repoName, activeFile.path, currentBranch);
      
      setOpenFiles(prev => prev.map(f => 
        (f.repoFullName + '::' + f.path) === activeFileKey 
        ? { ...f, content: updatedFile.content, editedContent: updatedFile.content, sha: updatedFile.sha } 
        : f
      ));
      
      showAlert('success', 'Commit successful!');
    } catch (error) {
      console.error(error);
      showAlert('error', `Failed to commit changes: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, activeFile, currentBranch, activeFileKey]);

  const handleBranchChange = useCallback((newBranch: string) => {
    if (activeFile) {
        // Reload all open files from that repo on the new branch
        const repoToUpdate = activeFile.repoFullName;
        setCurrentBranchByRepo(prev => ({...prev, [repoToUpdate]: newBranch}));
        
        const filesToReload = openFiles.filter(f => f.repoFullName === repoToUpdate);
        // We close them first, then re-open. A bit blunt, but effective.
        const otherFiles = openFiles.filter(f => f.repoFullName !== repoToUpdate);
        setOpenFiles(otherFiles);
        setActiveFileKey(otherFiles[0] ? (otherFiles[0].repoFullName + '::' + otherFiles[0].path) : null);

        filesToReload.forEach(file => {
            handleOpenFile(file.repoFullName, file.path, newBranch);
        });
    }
  }, [activeFile, openFiles, handleOpenFile]);

  const handleCreateBranch = useCallback(async (newBranchName: string) => {
    if (!token || !activeFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage(`Creating branch ${newBranchName}...`);
    try {
        const [owner, repoName] = activeFile.repoFullName.split('/');
        const baseBranch = branches.find(b => b.name === currentBranch);
        if (!baseBranch) throw new Error("Base branch not found");

        await createBranch(token, owner, repoName, newBranchName, baseBranch.commit.sha);
        
        const newBranches = await getRepoBranches(token, owner, repoName);
        setBranchesByRepo(prev => ({...prev, [activeFile.repoFullName]: newBranches}));
        setCurrentBranchByRepo(prev => ({...prev, [activeFile.repoFullName]: newBranchName}));
        showAlert('success', `Branch '${newBranchName}' created successfully.`);

    } catch(error) {
        console.error(error);
        showAlert('error', `Failed to create branch: ${(error as Error).message}`);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [token, activeFile, currentBranch, branches]);

  const handleCreatePullRequest = useCallback(async (title: string, body: string) => {
    if (!token || !activeFile || !currentBranch) return;
    setIsLoading(true);
    setLoadingMessage('Creating pull request...');
    try {
      const [owner, repoName] = activeFile.repoFullName.split('/');
      
      const pr = await createPullRequest({
        token,
        owner,
        repo: repoName,
        title,
        body,
        head: currentBranch,
        base: activeFile.defaultBranch,
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
  }, [token, activeFile, currentBranch]);

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
                let newContent = '';
                await bulkEditFileWithAI(fileContent.content, instruction, path, (chunk) => {
                    newContent += chunk;
                });
                
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
                    // Note: We need to fetch the sha for the file on the *new* branch if it exists,
                    // but since we process one by one, we can use the original sha for the first commit of each file.
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
            onFileSelect={handleOpenFile} 
            onStartBulkEdit={handleStartBulkEdit}
            selectedFilePath={activeFile?.path} 
            selectedRepo={activeFile?.repoFullName}
          />
        </div>
        <div className="w-3/4 flex flex-col">
          <EditorCanvas
            openFiles={openFiles}
            activeFile={activeFile}
            onCommit={handleCommit}
            onAiEdit={handleAiEdit}
            onFileContentChange={handleFileContentChange}
            onCloseFile={handleCloseFile}
            onSetActiveFile={handleSetActiveFile}
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
