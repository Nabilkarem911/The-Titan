import { useState } from 'react';
import { Camera, Copy, Save, Send } from 'lucide-react';
import { toast } from 'sonner';

export function ScreenshotViewer() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const capture = async () => {
    setLoading(true);
    try {
      const res = await (window as any).titan.takeScreenshot();
      if (res?.success) {
        setScreenshot(res.image);
        toast.success('Screenshot captured');
      } else {
        toast.error(res?.error || 'Failed to capture screenshot');
      }
    } catch {
      toast.error('Failed to capture screenshot');
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    if (!screenshot) return;
    const blob = new Blob([Uint8Array.from(atob(screenshot), c => c.charCodeAt(0))], { type: 'image/png' });
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 glass">
        <Camera size={16} className="text-accent" />
        <span className="font-semibold text-sm">Screenshot</span>
        <div className="flex-1" />
        {screenshot && (
          <>
            <button onClick={copyToClipboard} className="p-1.5 rounded hover:bg-bg-tertiary transition-colors" title="Copy">
              <Copy size={14} className="text-text-muted" />
            </button>
            <button className="p-1.5 rounded hover:bg-bg-tertiary transition-colors" title="Send to Titan">
              <Send size={14} className="text-text-muted" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Capturing screen...</p>
          </div>
        ) : screenshot ? (
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Screenshot"
            className="max-w-full max-h-full rounded-lg shadow-2xl border border-border"
          />
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-bg-tertiary flex items-center justify-center">
              <Camera size={40} className="text-text-muted" />
            </div>
            <button
              onClick={capture}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Camera size={18} />
              Capture Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
