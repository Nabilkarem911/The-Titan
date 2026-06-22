import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './stores/app-store.js';
import { LoginScreen } from './components/LoginScreen.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusBar } from './components/StatusBar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { FileExplorer } from './components/FileExplorer.js';
import { Terminal } from './components/Terminal.js';
import { ScreenshotViewer } from './components/ScreenshotViewer.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { DeviceManager } from './components/DeviceManager.js';
import { Toaster } from 'sonner';

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const setSystemInfo = useAppStore((s) => s.setSystemInfo);

  useEffect(() => {
    (window as any).titan?.getSystemInfo().then((res: any) => {
      if (res?.success) setSystemInfo(res.data);
    });
    (window as any).titan?.onNavigate((page: string) => {
      useAppStore.getState().setPage(page as any);
    });

    // Poll real WebSocket connection status every 3 seconds
    const pollConnection = setInterval(() => {
      (window as any).titan?.getConnectionStatus().then((res: any) => {
        const realConnected = res?.connected ?? false;
        const storeConnected = useAppStore.getState().connected;
        if (realConnected !== storeConnected) {
          useAppStore.getState().setConnected(realConnected);
        }
      });
    }, 3000);

    // Listen for auth-failed event from main process (WS closed with 4401)
    (window as any).titan?.onAuthFailed?.(() => {
      useAppStore.getState().setConnected(false);
      useAppStore.getState().setLoggedIn(false);
    });

    return () => clearInterval(pollConnection);
  }, [setSystemInfo]);

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen />
        <Toaster position="bottom-right" theme="dark" toastOptions={{ style: { background: '#1c2333', border: '1px solid #2a3447', color: '#e2e8f0' } }} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-bg-primary text-text-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {currentPage === 'chat' && <ChatPanel />}
              {currentPage === 'files' && <FileExplorer />}
              {currentPage === 'terminal' && <Terminal />}
              {currentPage === 'screenshot' && <ScreenshotViewer />}
              {currentPage === 'settings' && <SettingsPanel />}
              {currentPage === 'devices' && <DeviceManager />}
            </motion.div>
          </AnimatePresence>
        </div>
        <StatusBar />
      </div>
      <Toaster position="bottom-right" theme="dark" toastOptions={{ style: { background: '#1c2333', border: '1px solid #2a3447', color: '#e2e8f0' } }} />
    </div>
  );
}
