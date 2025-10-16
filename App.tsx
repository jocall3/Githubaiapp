

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { FileExplorer } from './components/FileExplorer';
import { EditorCanvas } from './components/EditorCanvas';
import { createOrUpdateFile, fetchAllRepos, fetchRepoTree, getFileContent, getRepoBranches, createBranch, createPullRequest } from './services/githubService';
import { editFileWithAI, getExpansionBlueprint, generateFileForBlueprint } from './services/geminiService';
import { GithubRepo, UnifiedFileTree, SelectedFile, Alert, Branch, FileNode, DirNode, ExpansionJob } from './types';
import { Spinner } from './components/Spinner';
import { AlertPopup } from './components/AlertPopup';
import { ExpansionModal } from './components/ExpansionModal';
import { ExpansionProgress } from './components/ExpansionProgress';
import * as path from 'path-browserify';

export const getAllFilePaths = (nodes: (DirNode | FileNode)[]): string[] => {
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

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const [isExpansionModalOpen, setExpansionModalOpen] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionJobs, setExpansionJobs] = useState<ExpansionJob[]>([]);
  
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
  
  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
  };
    
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
      
      await createOrUpdateFile({
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
      // FIX: Safely access error message to prevent crashes if a non-Error is thrown.
      const message = error instanceof Error ? error.message : String(error);
      showAlert('error', `Failed to commit changes: ${message}`);
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
        // FIX: Safely access error message to prevent crashes if a non-Error is thrown.
        const message = error instanceof Error ? error.message : String(error);
        showAlert('error', `Failed to create branch: ${message}`);
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
      // FIX: Safely access error message to prevent crashes if a non-Error is thrown.
      // This resolves the user-reported issue, as the original error message was likely misleading.
      const message = error instanceof Error ? error.message : String(error);
      showAlert('error', `Failed to create pull request: ${message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [token, activeFile, currentBranch]);

 const handleFileSelection = useCallback((fileKey: string, isSelected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(fileKey);
      } else {
        newSet.delete(fileKey);
      }
      return newSet;
    });
  }, []);

  const handleDirectorySelection = useCallback((nodes: (DirNode | FileNode)[], repoFullName: string, shouldSelect: boolean) => {
    const allPaths = getAllFilePaths(nodes);
    setSelectedFiles(prev => {
        const newSet = new Set(prev);
        for (const path of allPaths) {
            const key = `${repoFullName}::${path}`;
            if (shouldSelect) {
                newSet.add(key);
            } else {
                newSet.delete(key);
            }
        }
        return newSet;
    });
  }, []);

  const handleExpansionSubmit = useCallback(async (goal: string, filesPerSeed: number) => {
    if (!token || selectedFiles.size === 0) return;

    setExpansionModalOpen(false);
    setIsExpanding(true);
    setExpansionJobs([]);

    const seedFileKeys = Array.from(selectedFiles);
    setSelectedFiles(new Set());

    try {
      // Step 1: Get blueprints for all seed files
      const blueprintPromises = seedFileKeys.map(async (seedKey) => {
          const [repoFullName, seedFilePath] = seedKey.split('::');
          const [owner, repo] = repoFullName.split('/');
          const repoData = fileTree[repoFullName]?.repo;
          if (!repoData) throw new Error(`Repo data not found for ${repoFullName}`);
          const branch = currentBranchByRepo[repoFullName] || repoData.default_branch;
          
          const file = await getFileContent(token, owner, repo, seedFilePath, branch);
          const blueprintItems = await getExpansionBlueprint(goal, filesPerSeed, seedFilePath, file.content);
          
          return blueprintItems.map(item => {
              const seedDir = path.dirname(seedFilePath);
              const newFilePath = path.join(seedDir, item.filePath);
              const id = `${repoFullName}::${newFilePath}`;

              const job: ExpansionJob = {
                  id,
                  repoFullName,
                  seedFilePath,
                  newFilePath,
                  description: item.description,
                  status: 'queued',
                  generatedContent: `// ${item.description}`,
                  error: null,
              };
              return job;
          });
      });

      const jobArrays = await Promise.all(blueprintPromises);
      const initialJobs = jobArrays.flat();
      
      if (initialJobs.length === 0) {
        showAlert('error', 'The AI architect failed to create an expansion plan. Please try a more specific goal or select different seed files.');
        setIsExpanding(false);
        return;
      }

      setExpansionJobs(initialJobs);

      // Step 2: Process the jobs queue
      const processJob = async (job: ExpansionJob) => {
          setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'generating' } : j));
          
          if (!token) return;
          const { repoFullName, seedFilePath, newFilePath } = job;

          // FIX: Add type guard for repoFullName to prevent runtime error on '.split'.
          // This addresses the "Property 'split' does not exist on type 'unknown'" error by ensuring
          // the variable is a string before attempting to call string methods on it.
          if (typeof repoFullName !== 'string') {
            setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: 'Invalid repository name in job.' } : j));
            return;
          }

          const [owner, repo] = repoFullName.split('/');
          const repoData = fileTree[repoFullName]?.repo;
          if (!repoData) {
              setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: 'Repo data not found' } : j));
              return;
          }

          try {
              const branch = currentBranchByRepo[repoFullName] || repoData.default_branch;
              const seedFile = await getFileContent(token, owner, repo, seedFilePath, branch);

              let newContent = '';
              const handleChunk = (chunk: string) => {
                  newContent += chunk;
                  setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, generatedContent: newContent } : j));
              };

              await generateFileForBlueprint(goal, seedFilePath, seedFile.content, { filePath: newFilePath, description: job.description }, handleChunk);

              if (newContent.trim() === '') {
                  throw new Error("AI returned empty content.");
              }

              setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'committing' } : j));
              
              await createOrUpdateFile({
                  token, owner, repo, branch, path: newFilePath, content: newContent,
                  message: `[AI] Create ${path.basename(newFilePath)} based on ${path.basename(seedFilePath)}`,
              });
              
              setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'success' } : j));

          } catch (err) {
              const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
              setExpansionJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: errorMessage } : j));
          }
      };
      
      const CONCURRENCY_LIMIT = 5;
      const taskQueue = [...initialJobs];
      const worker = async () => {
          while(taskQueue.length > 0) {
              const job = taskQueue.shift();
              if (job) await processJob(job);
          }
      };
      await Promise.all(Array(CONCURRENCY_LIMIT).fill(null).map(worker));

      showAlert('success', 'AI project expansion completed.');
      // Refresh file tree for repos that were modified
      const modifiedRepos = new Set(initialJobs.map(j => j.repoFullName));
      modifiedRepos.forEach(async (repoFullName) => {
        if (!token) return;
        const [owner, name] = repoFullName.split('/');
        const repoData = fileTree[repoFullName]?.repo;
        if (repoData) {
          const branch = currentBranchByRepo[repoFullName] || repoData.default_branch;
          const tree = await fetchRepoTree(token, owner, name, branch);
          setFileTree(prev => ({...prev, [repoFullName]: {...prev[repoFullName], tree}}));
        }
      });
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred during expansion planning.';
      showAlert('error', `Expansion Failed: ${errorMessage}`);
      setIsExpanding(false);
    }
  }, [token, selectedFiles, fileTree, currentBranchByRepo]);


  return (
    <div className="flex h-screen font-sans">
      {!token ? (
        <AuthModal onSubmit={handleTokenSubmit} isLoading={isLoading} />
      ) : (
        <>
          <aside className="w-1/4 max-w-sm min-w-[300px] bg-gray-900 overflow-y-auto border-r border-gray-700 h-full">
            <FileExplorer 
              fileTree={fileTree} 
              onFileSelect={handleOpenFile}
              onStartExpansion={() => setExpansionModalOpen(true)}
              selectedRepo={activeFile?.repoFullName}
              selectedFilePath={activeFile?.path}
              selectedFiles={selectedFiles}
              onFileSelection={handleFileSelection}
              onDirectorySelection={handleDirectorySelection}
            />
          </aside>
          <main className="flex-grow h-full">
            <EditorCanvas 
              openFiles={openFiles}
              activeFile={activeFile || null}
              onCommit={handleCommit}
              onAiEdit={handleAiEdit}
              onFileContentChange={handleFileContentChange}
              onCloseFile={handleCloseFile}
              onSetActiveFile={handleSetActiveFile}
              isLoading={isLoading && !isExpanding}
              branches={branches}
              currentBranch={currentBranch}
              onBranchChange={handleBranchChange}
              onCreateBranch={handleCreateBranch}
              onCreatePullRequest={handleCreatePullRequest}
            />
          </main>
        </>
      )}

      {isLoading && !isExpanding && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-4 animate-fade-in-down">
          <style>{`
            @keyframes fade-in-down {
              0% {
                opacity: 0;
                transform: translate(-50%, -20px);
              }
              100% {
                opacity: 1;
                transform: translate(-50%, 0);
              }
            }
            .animate-fade-in-down {
              animation: fade-in-down 0.5s ease-out forwards;
            }
          `}</style>
          <Spinner />
          <p>{loadingMessage}</p>
        </div>
      )}

      {alert && <AlertPopup alert={alert} onClose={() => setAlert(null)} />}

      {isExpansionModalOpen && (
        <ExpansionModal
          fileCount={selectedFiles.size}
          onClose={() => setExpansionModalOpen(false)}
          onSubmit={handleExpansionSubmit}
        />
      )}

      {isExpanding && (
          <ExpansionProgress
              jobs={expansionJobs}
              onClose={() => setIsExpanding(false)}
              isComplete={!expansionJobs.some(j => j.status === 'queued' || j.status === 'generating' || j.status === 'committing')}
          />
      )}
    </div>
  );
}
