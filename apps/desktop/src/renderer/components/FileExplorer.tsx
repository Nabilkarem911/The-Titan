import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modified: Date | null;
}

export function FileExplorer() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Load home directory on mount
    (window as any).titan?.getHomeDir().then((dir: string) => {
      if (dir) loadDir(dir);
    });
  }, []);

  const loadDir = async (path: string) => {
    setLoading(true);
    setSelectedFile(null);
    setShowPreview(false);
    try {
      const res = await (window as any).titan.listDir(path);
      if (res?.success) {
        setItems(res.items.sort((a: FileItem, b: FileItem) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        }));
        setCurrentPath(path);
      } else {
        toast.error(res?.error || 'Failed to list directory');
      }
    } catch (err) {
      toast.error('Failed to load directory');
    }
    setLoading(false);
  };

  const openFile = async (item: FileItem) => {
    if (item.isDirectory) {
      loadDir(item.path);
    } else {
      try {
        const res = await (window as any).titan.readFile(item.path);
        if (res?.success) {
          setSelectedFile(item.path);
          setFileContent(res.content);
          setShowPreview(true);
        } else {
          toast.error(res?.error || 'Failed to read file');
        }
      } catch {
        toast.error('Failed to read file');
      }
    }
  };

  const goUp = () => {
    if (!currentPath) return;
    const sep = currentPath.includes('\\') ? '\\' : '/';
    const parts = currentPath.split(sep);
    parts.pop();
    const parent = parts.join(sep) || (currentPath.includes('\\') ? '\\' : '/');
    loadDir(parent);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full bg-bg-primary">
      {/* File list */}
      <div className={`flex flex-col ${showPreview ? 'flex-1' : 'flex-1'} border-r border-border`}>
        {/* Toolbar */}
        <div className="h-12 border-b border-border flex items-center px-3 gap-2 glass">
          <button onClick={goUp} className="p-1.5 rounded hover:bg-bg-tertiary transition-colors">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => loadDir(currentPath)} className="p-1.5 rounded hover:bg-bg-tertiary transition-colors">
            <RefreshCw size={14} />
          </button>
          <div className="flex-1 bg-bg-tertiary rounded-lg px-3 py-1.5 text-xs text-text-secondary truncate">
            {currentPath}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg shimmer" />
              ))}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.path}
                onClick={() => openFile(item)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-tertiary transition-colors ${
                  selectedFile === item.path ? 'bg-accent/10' : ''
                }`}
              >
                {item.isDirectory ? (
                  <Folder size={16} className="text-warning" />
                ) : (
                  <File size={16} className="text-text-muted" />
                )}
                <span className="flex-1 text-sm truncate">{item.name}</span>
                {!item.isDirectory && (
                  <span className="text-xs text-text-muted">{formatSize(item.size)}</span>
                )}
              </div>
            ))
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Folder size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Empty directory</p>
            </div>
          )}
        </div>
      </div>

      {/* File preview */}
      {showPreview && (
        <div className="w-1/2 flex flex-col">
          <div className="h-12 border-b border-border flex items-center px-4 gap-2 glass">
            <File size={14} className="text-text-muted" />
            <span className="text-sm truncate flex-1">{selectedFile?.split(/[\\/]/).pop()}</span>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Close
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs mono text-text-secondary bg-bg-secondary">
            {fileContent}
          </pre>
        </div>
      )}
    </div>
  );
}
