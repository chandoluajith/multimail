import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  Mail, 
  Cpu, 
  History, 
  Settings,
} from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const { resolvedTheme } = useTheme();

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', name: 'Accounts', icon: Mail },
    { id: 'services', name: 'Services', icon: Cpu },
    { id: 'history', name: 'History', icon: History },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg flex justify-around items-center px-2 py-2.5 pb-safe"
      style={{ 
        background: resolvedTheme === 'dark' ? 'rgba(2, 6, 23, 0.9)' : 'rgba(255, 255, 255, 0.92)', 
        borderTop: '1px solid var(--border-primary)' 
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              isActive 
                ? 'text-blue-500 font-semibold' 
                : ''
            }`}
            style={!isActive ? { color: 'var(--text-muted)' } : undefined}
          >
            <Icon size={20} className={isActive ? 'text-blue-500' : ''} style={!isActive ? { color: 'var(--text-muted)' } : undefined} />
            <span className="text-[10px] tracking-wide font-medium">{tab.name}</span>
          </button>
        );
      })}
    </nav>
  );
};
