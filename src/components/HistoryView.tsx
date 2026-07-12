import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 Search, 
 Trash2, 
 Play, 
 AlertTriangle, 
 CheckCircle, 
 Edit2, 
 RefreshCw,
 Info,
 Clock
} from 'lucide-react';

export const HistoryView: React.FC = () => {
 const { history, clearHistory } = useApp();
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedEvent, setSelectedEvent] = useState<string>('All');

 // Filter history based on search query and event filter
 const filteredHistory = history.filter(item => {
 const matchesSearch = 
 item.emailNickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
 item.emailAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
 item.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
 
 const matchesEvent = selectedEvent === 'All' || item.event === selectedEvent;

 return matchesSearch && matchesEvent;
 });

 const getEventIcon = (event: string) => {
 switch (event) {
 case 'Started Session':
 return <Play size={14} className="text-emerald-400" />;
 case 'Reached Limit':
 return <AlertTriangle size={14} className="text-rose-400" />;
 case 'Reset Completed':
 return <CheckCircle size={14} className="text-blue-400" />;
 case 'Status Changed':
 case 'Manual Edit':
 return <Edit2 size={14} className="text-amber-400" />;
 default:
 return <RefreshCw size={14} style={{ color: 'var(--text-muted)' }} />;
 }
 };

 const getEventBg = (event: string) => {
 switch (event) {
 case 'Started Session': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
 case 'Reached Limit': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
 case 'Reset Completed': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
 default: return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
 }
 };

 const formatTimestamp = (isoString: string) => {
 const date = new Date(isoString);
 return date.toLocaleString(undefined, {
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit'
 });
 };

 const handleClearLogs = async () => {
 if (window.confirm('Are you sure you want to delete all history logs? This action cannot be undone.')) {
 try {
 await clearHistory();
 } catch (error) {
 console.error('Failed to clear history', error);
 }
 }
 };

 return (
 <div className="space-y-8 pb-12">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold font-heading tracking-tight" style={{ color: 'var(--text-primary)' }}>Usage History</h2>
 <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Review chronologically tracked session events, status adjustments, and limit triggers.</p>
 </div>
 
 {history.length > 0 && (
 <button
 onClick={handleClearLogs}
 className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition cursor-pointer self-start sm:self-auto"
 >
 <Trash2 size={14} />
 Wipe Logs
 </button>
 )}
 </div>

 {/* Search & Filter Bar */}
 <div
 className="p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between theme-transition"
 style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
 >
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-muted)' }} />
 <input
 type="text"
 placeholder="Search logs by email, nickname, service or notes..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-body"
 style={{
 background: 'var(--bg-input)',
 border: '1px solid var(--border-primary)',
 color: 'var(--text-primary)',
 }}
 />
 </div>
 <div
 className="flex items-center gap-2 rounded-xl px-3 py-1.5 self-start sm:self-auto"
 style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}
 >
 <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Event:</span>
 <select
 value={selectedEvent}
 onChange={(e) => setSelectedEvent(e.target.value)}
 className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
 style={{ color: 'var(--text-secondary)' }}
 >
 <option value="All">All Events</option>
 <option value="Started Session">Started Session</option>
 <option value="Reached Limit">Reached Limit</option>
 <option value="Reset Completed">Reset Completed</option>
 <option value="Status Changed">Status Changed</option>
 <option value="Manual Edit">Manual Edit</option>
 </select>
 </div>
 </div>

 {/* Log Feed */}
 {filteredHistory.length === 0 ? (
 <div
 className="p-12 text-center rounded-2xl flex flex-col items-center justify-center gap-3"
 style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
 >
 <Info size={36} style={{ color: 'var(--text-muted)' }} />
 <h4 className="font-semibold font-heading" style={{ color: 'var(--text-secondary)' }}>No logs registered</h4>
 <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>No historical log entries match the filters, or the database is currently empty.</p>
 </div>
 ) : (
 <div
 className="rounded-2xl p-6 relative theme-transition"
 style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
 >
 
 {/* Vertical timeline connector */}
 <div className="absolute left-9 top-8 bottom-8 w-px hidden sm:block" style={{ background: 'var(--border-primary)' }} />

 <div className="space-y-6">
 <AnimatePresence initial={false}>
 {filteredHistory.map((item) => (
 <motion.div
 key={item.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.15 }}
 className="relative flex flex-col sm:flex-row items-start gap-4 sm:pl-8 text-sm group"
 >
 {/* Event indicator badge */}
 <div className={`sm:absolute sm:left-1 flex items-center justify-center w-6 h-6 rounded-full border theme-shadow-md shrink-0 transition z-10 ${getEventBg(item.event)}`}>
 {getEventIcon(item.event)}
 </div>

 <div
 className="flex-1 w-full rounded-xl p-4 transition-all duration-200 theme-transition"
 style={{
 background: 'var(--bg-surface)',
 border: '1px solid var(--border-primary)',
 }}
 >
 <div
 className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 mb-2"
 style={{ borderBottom: '1px solid var(--border-subtle)' }}
 >
 <div className="flex items-center gap-2.5">
 <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.emailNickname}</span>
 <span className="text-xs hidden md:inline" style={{ color: 'var(--text-muted)' }}>|</span>
 <span className="text-xs truncate max-w-[150px] md:max-w-xs" style={{ color: 'var(--text-muted)' }}>{item.emailAddress}</span>
 </div>
 
 <div className="flex items-center gap-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
 <span
 className="px-2 py-0.5 rounded text-blue-400 text-[10px]"
 style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-primary)' }}
 >
 {item.serviceName}
 </span>
 <span className="flex items-center gap-1">
 <Clock size={12} />
 {formatTimestamp(item.timestamp)}
 </span>
 </div>
 </div>

 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getEventBg(item.event)}`}>
 {item.event}
 </span>
 </div>
 {item.notes && (
 <p
 className="text-xs font-medium mt-2 p-2.5 rounded-lg leading-relaxed font-body"
 style={{
 color: 'var(--text-tertiary)',
 background: 'var(--bg-inset)',
 border: '1px solid var(--border-subtle)',
 }}
 >
 {item.notes}
 </p>
 )}
 </div>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 </div>
 )}
 </div>
 );
};
