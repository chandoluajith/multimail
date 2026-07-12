import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { DashboardView } from './components/DashboardView';
import { AccountsView } from './components/AccountsView';
import { ServicesView } from './components/ServicesView';
import { HistoryView } from './components/HistoryView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { SecurityView } from './components/SecurityView';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isLoading, syncError } = useApp();
  const { user, isAuthLoading } = useAuth();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'accounts':  return <AccountsView />;
      case 'services':  return <ServicesView />;
      case 'history':   return <HistoryView />;
      case 'stats':     return <StatsView />;
      case 'security':  return <SecurityView />;
      case 'settings':  return <SettingsView />;
      default:          return <DashboardView />;
    }
  };


  // Resolve auth first
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading your data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {syncError && (
          <div className="absolute top-3 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300 shadow-lg backdrop-blur">
            Database sync failed: {syncError}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-24 md:pb-6">
          {renderActiveView()}
        </div>
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </main>
    </div>
  );
}
