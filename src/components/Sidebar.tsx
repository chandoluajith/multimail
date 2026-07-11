import React from 'react';
import { useApp } from '../context/AppContext';
import { 
 LayoutDashboard, 
 Mail, 
 Cpu, 
 History, 
 BarChart3, 
 Settings, 
 Shield,
 ShieldCheck,
 AlertTriangle,
 Clock,
} from 'lucide-react';

interface SidebarProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
 const { emailServices } = useApp();


 // Compute status counts
 const availableCount = emailServices.filter(es => es.status === 'Available').length;
 const cooldownCount = emailServices.filter(es => es.status === 'Cooling Down').length;
 const limitCount = emailServices.filter(es => es.status === 'Limit Reached').length;

 const tabs = [
 { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
 { id: 'accounts', name: 'Email Accounts', icon: Mail },
 { id: 'services', name: 'AI Services', icon: Cpu },
 { id: 'history', name: 'Usage History', icon: History },
 { id: 'stats', name: 'Statistics', icon: BarChart3 },
 { id: 'security', name: 'Security & Audit', icon: Shield },
 { id: 'settings', name: 'Settings', icon: Settings },
 ];

 return (
 <aside
 className="hidden md:flex flex-col w-64 border-r h-screen sticky top-0 backdrop-blur-md"
 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
 >
 {/* Brand Header */}
 <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
 <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white theme-shadow-lg shadow-blue-500/20">
 <Mail size={20} />
 <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 animate-pulse" style={{ borderColor: 'var(--bg-primary)' }} />
 </div>
 <div>
 <h1 className="font-heading font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
 MailsTracker
 </h1>
 <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Session & Quota Manager</p>
 </div>
 </div>

 {/* Navigation Links */}
 <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
 isActive
 ? 'bg-blue-600/15 border border-blue-500/30 text-blue-500 font-semibold'
 : 'border border-transparent hover:bg-blue-500/5'
 }`}
 style={!isActive ? { color: 'var(--text-tertiary)' } : undefined}
 >
 <Icon size={18} className={isActive ? 'text-blue-500' : ''} style={!isActive ? { color: 'var(--text-tertiary)' } : undefined} />
 <span>{tab.name}</span>
 {tab.id === 'dashboard' && cooldownCount > 0 && (
 <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-500 font-bold">
 {cooldownCount}
 </span>
 )}
 </button>
 );
 })}
 </nav>


 {/* Connection Monitor Panel */}
 <div
 className="p-4 m-4 rounded-2xl backdrop-blur-sm space-y-3"
 style={{ 
 background: 'var(--bg-surface-alt)', 
 border: '1px solid var(--border-subtle)' 
 }}
 >
 <div
 className="flex items-center justify-between text-xs font-semibold pb-2"
 style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
 >
 <span>Global Monitor</span>
 <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
 Live
 </span>
 </div>
 
 <div className="space-y-2">
 <div className="flex items-center justify-between text-xs">
 <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
 <ShieldCheck size={12} className="text-emerald-500" />
 Available
 </span>
 <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{availableCount}</span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
 <Clock size={12} className="text-amber-500" />
 Cooldown
 </span>
 <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{cooldownCount}</span>
 </div>

 <div className="flex items-center justify-between text-xs">
 <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
 <AlertTriangle size={12} className="text-rose-500" />
 Limited
 </span>
 <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{limitCount}</span>
 </div>
 </div>
 </div>
 </aside>
 );
};
