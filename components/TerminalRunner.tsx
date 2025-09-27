import React, { useState, useEffect, useRef } from 'react';
import { GithubRepo } from '../types';
import { WebContainer } from '@web-std/webcontainer';
import { Spinner } from './Spinner';

// Make external libraries available from window object
declare const JSZip: any;
declare const Terminal: any;

interface TerminalRunnerProps {
  repo: GithubRepo;
  token: string;
  onClose: () => void;
}

type Status = 'idle' | 'booting' | 'mounting' | 'installing' | 'building' | 'running-dev' | 'ready';
const STATUS_MESSAGES: Record<Status, string> = {
    idle: 'Initializing...',
    booting: 'Booting WebContainer...',
    mounting: 'Downloading and mounting project files...',
    installing: 'Running npm install...',
    building: 'Running npm run build...',
    'running-dev': 'Starting development server...',
    ready: 'Ready for commands.'
};

export const TerminalRunner: React.FC<TerminalRunnerProps> = ({ repo, token, onClose }) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview'>('terminal');
  const [status, setStatus] = useState<Status>('idle');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const webContainerRef = useRef<WebContainer | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);

  useEffect(() => {
    // Initialize XTerm.js
    if (terminalRef.current && !xtermRef.current) {
        const term = new Terminal({
            convertEol: true,
            theme: {
                background: '#0b0f1a',
                foreground: '#d1d5db',
                cursor: '#d1d5db',
            }
        });
        term.open(terminalRef.current);
        xtermRef.current = term;
    }

    const initialize = async () => {
        const term = xtermRef.current;
        if (!term) return;

        try {
            // Boot WebContainer
            setStatus('booting');
            term.writeln(STATUS_MESSAGES.booting);
            const wc = await WebContainer.boot();
            webContainerRef.current = wc;

            wc.on('error', (err) => {
                term.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
            });

            wc.on('server-ready', (port, url) => {
                setPreviewUrl(url);
                term.writeln(`\x1b[32mServer is ready at ${url}\x1b[0m`);
                setActiveTab('preview');
            });
            
            // Download and mount files
            setStatus('mounting');
            term.writeln(STATUS_MESSAGES.mounting);
            const zipBlob = await fetch(`https://api.github.com/repos/${repo.full_name}/zipball/${repo.default_branch}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => res.blob());

            const zip = await JSZip.loadAsync(zipBlob);
            const rootFolderName = Object.keys(zip.files)[0];

            // FIX: Add a type for JSZip file objects to resolve TypeScript errors on `file.dir` and `file.async`.
            // When using an untyped library like JSZip loaded via script tag,
            // object properties are inferred as `unknown`, causing errors.
            interface JSZipFile {
                dir: boolean;
                async(type: 'uint8array'): Promise<Uint8Array>;
            }

            const filePromises = Object.entries(zip.files).map(async ([relativePath, file]) => {
                const typedFile = file as JSZipFile;
                if (typedFile.dir) return;
                const content = await typedFile.async('uint8array');
                const path = `./${relativePath.substring(rootFolderName.length)}`;
                await wc.fs.mkdir(path.substring(0, path.lastIndexOf('/')), { recursive: true });
                await wc.fs.writeFile(path, content);
            });
            await Promise.all(filePromises);

            term.writeln('\x1b[32mProject mounted successfully.\x1b[0m');
            setStatus('ready');

        } catch (error) {
            term.writeln(`\x1b[31mInitialization failed: ${(error as Error).message}\x1b[0m`);
        }
    };

    initialize();

    return () => {
      // Cleanup logic if needed, though WebContainers are session-based
    };
  }, [repo.full_name, repo.default_branch, token]);

  const runCommand = async (command: string, args: string[], newStatus: Status) => {
    const wc = webContainerRef.current;
    const term = xtermRef.current;
    if (!wc || !term) return;

    setStatus(newStatus);
    term.writeln(`\x1b[33m\n$ ${command} ${args.join(' ')}\x1b[0m`);
    
    const process = await wc.spawn(command, args);
    process.output.pipeTo(new WritableStream({
      write(data) {
        term.write(data);
      }
    }));

    const exitCode = await process.exit;
    term.writeln(`\x1b[33mProcess exited with code ${exitCode}\x1b[0m`);
    setStatus('ready');
  };

  const isBusy = status !== 'ready';

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header and Controls */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center gap-4">
            <div className="flex border border-gray-600 rounded-md">
                <button onClick={() => setActiveTab('terminal')} className={`px-3 py-1 text-sm ${activeTab === 'terminal' ? 'bg-gray-700' : 'bg-gray-800'} rounded-l-md`}>TERMINAL</button>
                <button onClick={() => setActiveTab('preview')} className={`px-3 py-1 text-sm ${activeTab === 'preview' ? 'bg-gray-700' : 'bg-gray-800'} rounded-r-md`}>PREVIEW</button>
            </div>
            <div className="flex items-center gap-2">
                <button disabled={isBusy} onClick={() => runCommand('npm', ['install'], 'installing')} className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 px-3 py-1 rounded">npm install</button>
                <button disabled={isBusy} onClick={() => runCommand('npm', ['run', 'build'], 'building')} className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 px-3 py-1 rounded">npm run build</button>
                <button disabled={isBusy} onClick={() => runCommand('npm', ['run', 'dev'], 'running-dev')} className="text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-500 px-3 py-1 rounded">npm run dev</button>
            </div>
             {isBusy && (
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <Spinner className="h-4 w-4" />
                    <span>{STATUS_MESSAGES[status]}</span>
                </div>
            )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
      </div>

      {/* Content */}
      <div className="flex-grow min-h-0">
        <div className={`${activeTab === 'terminal' ? 'h-full' : 'hidden'}`} ref={terminalRef}></div>
        {activeTab === 'preview' && (
          <div className="h-full bg-white">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full border-none" title="App Preview"></iframe>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">
                <p>Run 'npm run dev' to see a preview.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};