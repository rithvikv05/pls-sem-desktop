import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useStore } from './store';
import TitleBar from './components/TitleBar';
import ContextMenu from './components/ContextMenu';
import SettingsModal from './components/SettingsModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import GetStarted from './pages/GetStarted';
import Dashboard from './pages/Dashboard';
import ModelEditor from './pages/ModelEditor';
import ArchiveView from './pages/ArchiveView';
import DatasetView from './pages/DatasetView';

import { api } from './utils/api';

function App() {
  const { tabs, activeTabId, settings, theme } = useStore();

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Two-way workspace synchronization with disk (using existing backend API)
  useEffect(() => {
    let isMounted = true;

    const syncWorkspaces = async () => {
      const state = useStore.getState();
      const allWorkspaces = [...state.workspaces, ...state.archivedWorkspaces];
      const targets = allWorkspaces.filter(w => !!w.path);
      if (targets.length === 0) return;

      await Promise.all(
        targets.map(async (ws) => {
          try {
            const res = await api.openWorkspace(ws.path);
            if (!isMounted) return;
            // Existing backend returns 'Not a valid workspace' when the folder or workspace.json was deleted
            if (res?.error === 'Not a valid workspace') {
              console.log(`Pruning workspace missing on disk: ${ws.name} (${ws.path})`);
              state.deleteWorkspace(ws.id);
            }
          } catch {
            // If backend is offline or unreachable, do not prune
          }
        })
      );
    };

    // Check on startup
    syncWorkspaces();

    // Check when window regains focus (user deleted folder in Finder/Terminal and clicked back to app)
    const handleFocus = () => {
      syncWorkspaces();
    };
    window.addEventListener('focus', handleFocus);

    // Periodic safety check every 5 seconds
    const interval = setInterval(syncWorkspaces, 5000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Apply theme & font preference to document
  useEffect(() => {
    let resolvedTheme: 'light' | 'dark' = theme;
    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = prefersDark ? 'dark' : 'light';
    } else if (settings.theme === 'dark' || settings.theme === 'light') {
      resolvedTheme = settings.theme;
    }
    document.documentElement.dataset.theme = resolvedTheme;
  }, [theme, settings.theme]);

  useEffect(() => {
    const fontMap: Record<string, string> = {
      'Inter': "'Inter', sans-serif",
      'Roboto': "'Roboto', sans-serif",
      'JetBrains Mono': "'JetBrains Mono', monospace",
      'System': "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    };
    if (settings.fontFamily && fontMap[settings.fontFamily]) {
      document.body.style.fontFamily = fontMap[settings.fontFamily];
    }
  }, [settings.fontFamily]);

  const renderContent = () => {
    if (!activeTab || activeTab.type === 'get-started') {
      return <GetStarted />;
    }
    if (activeTab.type === 'workspace') {
      return <Dashboard key={activeTab.id} />;
    }
    if (activeTab.type === 'model') {
      return <ModelEditor key={activeTab.id} />;
    }
    if (activeTab.type === 'dataset') {
      return <DatasetView key={activeTab.id} />;
    }
    if (activeTab.type === 'archive') {
      return <ArchiveView key={activeTab.id} />;
    }
    return <GetStarted />;
  };

  useEffect(() => {
    // Prevent Backspace key from triggering browser back navigation outside editable inputs
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        const isEditable = !!(target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true'
        ));
        if (!isEditable) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <BrowserRouter>
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TitleBar />
        <ContextMenu />
        <SettingsModal />
        <ConfirmDeleteModal />
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
