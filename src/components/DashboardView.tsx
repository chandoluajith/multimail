import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CountdownTimer } from './CountdownTimer';
import { ServiceIcon } from './ServiceIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 Search, 
 Sparkles, 
 Clock, 
 AlertTriangle, 
 Play, 
 Square, 
 RefreshCw, 
 Info,
 Calendar,
 X,
 Layers,
 Mail,
 BarChart3,
 ChevronDown,
 ArrowUpDown,
 Sun,
 Moon,
 Database
} from 'lucide-react';
import { StatusType, ProviderType } from '../types';
import { useTheme } from '../context/ThemeContext';

type DashboardSort = 'alphabetical' | 'most-used' | 'least-used' | 'recently-used' | 'recently-added';

const sortOptions: Array<{ value: DashboardSort; label: string }> = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'most-used', label: 'Most Used' },
  { value: 'least-used', label: 'Least Used' },
  { value: 'recently-used', label: 'Recently Used' },
  { value: 'recently-added', label: 'Recently Added' },
];

export const DashboardView: React.FC = () => {
 const { 
 emails, 
 services, 
 emailServices, 
 history,
 serverNow,
 startSession, 
 endSession, 
 reachLimit, 
 resetTimer, 
 updateStatus,
 dbStatus,
 settings,
 updateSettings
 } = useApp();
 const { resolvedTheme } = useTheme();

 const [searchQuery, setSearchQuery] = useState('');
 const [selectedProvider, setSelectedProvider] = useState<ProviderType | 'All'>('All');
 const [selectedStatus, setSelectedStatus] = useState<StatusType | 'All'>('All');
 const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('All');
 const [sortBy, setSortBy] = useState<DashboardSort>('alphabetical');
 
 // Selected Email & Service for the Quick Actions Modal
 const [activeControl, setActiveControl] = useState<{ emailId: string; serviceId: string } | null>(null);
 const [customCooldown, setCustomCooldown] = useState('180'); // default 3 hours in minutes
 const [customRemaining, setCustomRemaining] = useState('');
 const [customMax, setCustomMax] = useState('');
 const [customNotes, setCustomNotes] = useState('');

 // Override Date & Time picker state
 const [useOverride, setUseOverride] = useState(false);
 const [overrideDate, setOverrideDate] = useState(''); // YYYY-MM-DD
 const [overrideHour, setOverrideHour] = useState('12');
 const [overrideMinute, setOverrideMinute] = useState('00');
 const [overrideAmPm, setOverrideAmPm] = useState<'AM' | 'PM'>('AM');

 // Compute the override ISO string from date/time picker state
 const computedOverrideISO = useMemo(() => {
 if (!useOverride || !overrideDate) return undefined;
 let hour24 = parseInt(overrideHour, 10);
 const min = parseInt(overrideMinute, 10);
 if (overrideAmPm === 'AM' && hour24 === 12) hour24 = 0;
 if (overrideAmPm === 'PM' && hour24 !== 12) hour24 += 12;
 const d = new Date(`${overrideDate}T${String(hour24).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
 return isNaN(d.getTime()) ? undefined : d.toISOString();
 }, [useOverride, overrideDate, overrideHour, overrideMinute, overrideAmPm]);

 // Filter emails based on query and filters
 const filteredEmails = useMemo(() => {
  const relationEmailById = new Map(emailServices.map((es) => [es.id, es.emailId]));
  const usageCountByEmail = new Map<string, number>();
  const lastUsedByEmail = new Map<string, number>();

  history.forEach((item) => {
    const emailId = relationEmailById.get(item.emailServiceId);
    if (!emailId) return;
    usageCountByEmail.set(emailId, (usageCountByEmail.get(emailId) ?? 0) + 1);
    const timestamp = new Date(item.timestamp).getTime();
    if (!Number.isNaN(timestamp)) {
      lastUsedByEmail.set(emailId, Math.max(lastUsedByEmail.get(emailId) ?? 0, timestamp));
    }
  });

  emailServices.forEach((relation) => {
    if (!relation.lastUsed) return;
    const timestamp = new Date(relation.lastUsed).getTime();
    if (!Number.isNaN(timestamp)) {
      lastUsedByEmail.set(relation.emailId, Math.max(lastUsedByEmail.get(relation.emailId) ?? 0, timestamp));
    }
  });

  const toTime = (value?: string) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const alphabetical = (a: typeof emails[number], b: typeof emails[number]) =>
    (a.nickname || a.email).localeCompare(b.nickname || b.email, undefined, { sensitivity: 'base', numeric: true }) ||
    a.email.localeCompare(b.email, undefined, { sensitivity: 'base', numeric: true });

  return emails.filter(email => {
    const matchesSearch = 
    email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.nickname.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'All' || email.provider === selectedProvider;
    
    // Check if any of the email's service relations match service & status filters
    const emailRelations = emailServices.filter(es => es.emailId === email.id);
    
    const matchesServiceAndStatus = emailRelations.some(es => {
    const matchesSrv = selectedServiceFilter === 'All' || es.serviceId === selectedServiceFilter;
    const matchesStat = selectedStatus === 'All' || es.status === selectedStatus;
    return matchesSrv && matchesStat;
    });

    // If a service or status filter is active, only show emails that have at least one matching relation
    const needsRelationFilter = selectedServiceFilter !== 'All' || selectedStatus !== 'All';
    
    return matchesSearch && matchesProvider && (!needsRelationFilter || matchesServiceAndStatus);
  }).sort((a, b) => {
    if (sortBy === 'most-used') {
      return (usageCountByEmail.get(b.id) ?? 0) - (usageCountByEmail.get(a.id) ?? 0) || alphabetical(a, b);
    }
    if (sortBy === 'least-used') {
      return (usageCountByEmail.get(a.id) ?? 0) - (usageCountByEmail.get(b.id) ?? 0) || alphabetical(a, b);
    }
    if (sortBy === 'recently-used') {
      return (lastUsedByEmail.get(b.id) ?? 0) - (lastUsedByEmail.get(a.id) ?? 0) || alphabetical(a, b);
    }
    if (sortBy === 'recently-added') {
      return toTime(b.createdAt) - toTime(a.createdAt) || alphabetical(a, b);
    }
    return alphabetical(a, b);
  });
 }, [emails, emailServices, history, searchQuery, selectedProvider, selectedServiceFilter, selectedStatus, sortBy]);

  // Status counters – computed AFTER filters so KPI cards reflect current view
  const totalEmails = emails.length;

  // Derive filter-aware relation counts from filteredEmails
  const filteredRelations = useMemo(() => {
    // Collect all relations that belong to filtered emails AND match service/status filters
    return emailServices.filter(es => {
      const emailVisible = filteredEmails.some(e => e.id === es.emailId);
      const matchesSrv = selectedServiceFilter === 'All' || es.serviceId === selectedServiceFilter;
      const matchesStat = selectedStatus === 'All' || es.status === selectedStatus;
      return emailVisible && matchesSrv && matchesStat;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailServices, selectedServiceFilter, selectedStatus, filteredEmails]);

  const availableRelations = filteredRelations.filter(es => es.status === 'Available').length;
  const coolingRelations   = filteredRelations.filter(es => es.status === 'Cooling Down' || es.status === 'Resetting Soon').length;
  const limitedRelations   = filteredRelations.filter(es => es.status === 'Limit Reached').length;
  const filteredTotalAccounts = filteredEmails.length;

 const getStatusColor = (status: StatusType) => {
 switch (status) {
 case 'Available': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
 case 'Cooling Down': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
 case 'Limit Reached': return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
 case 'Resetting Soon': return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
 default: return 'theme-bg-surface-alt theme-border-subtle theme-text-secondary';
 }
 };

 const getStatusGlow = (status: StatusType) => {
 switch (status) {
 case 'Available': return 'shadow-emerald-500/5';
 case 'Cooling Down': return 'shadow-amber-500/5';
 case 'Limit Reached': return 'shadow-rose-500/5';
 case 'Resetting Soon': return 'shadow-sky-500/5';
 default: return '';
 }
 };

 // --- Filter Chip Helpers ---
 const chipBase = 'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer select-none whitespace-nowrap transition-all duration-200';

 const chipSelectedStyle: Record<string, string> = {
 blue: 'bg-blue-500/15 border-blue-400/40 text-blue-300 chip-glow-blue',
 emerald: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 chip-glow-emerald',
 amber: 'bg-amber-500/15 border-amber-400/40 text-amber-300 chip-glow-amber',
 rose: 'bg-rose-500/15 border-rose-400/40 text-rose-300 chip-glow-rose',
 sky: 'bg-sky-500/15 border-sky-400/40 text-sky-300 chip-glow-sky',
 violet: 'bg-violet-500/15 border-violet-400/40 text-violet-300 chip-glow-violet',
 slate: 'theme-bg-surface-alt theme-border-subtle theme-text-secondary chip-glow-blue',
 };

 const chipUnselected = 'theme-bg-surface-alt theme-border-subtle theme-text-secondary hover:theme-bg-surface-alt theme-text-secondary hover:theme-border-subtle';

 const statusDotColor: Record<string, string> = {
 'Available': 'bg-emerald-400',
 'Cooling Down': 'bg-amber-400',
 'Limit Reached': 'bg-rose-400',
 'Resetting Soon': 'bg-sky-400',
 'Unknown': 'theme-bg-tertiary',
 };

 const statusAccent: Record<string, string> = {
 'Available': 'emerald',
 'Cooling Down': 'amber',
 'Limit Reached': 'rose',
 'Resetting Soon': 'sky',
 'Unknown': 'slate',
 };

 const providerList: ProviderType[] = ['Gmail', 'Outlook', 'Proton', 'Yahoo', 'Custom'];
 const statusList: StatusType[] = ['Available', 'Cooling Down', 'Limit Reached', 'Resetting Soon', 'Unknown'];

 const formatResetDate = (value: string) => {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return null;
 return new Intl.DateTimeFormat('en-US', {
 month: 'short',
 day: '2-digit',
 year: 'numeric',
 hour: 'numeric',
 minute: '2-digit',
 hour12: true,
 }).format(date);
 };

 const handleOpenControl = (emailId: string, serviceId: string) => {
 const relation = emailServices.find(es => es.emailId === emailId && es.serviceId === serviceId);
 if (relation) {
 setCustomRemaining(String(relation.remainingRequests || ''));
 setCustomMax(String(relation.maximumRequests || ''));
 setCustomNotes(relation.notes || '');

 // If there's an existing estimated reset time, pre-populate the override picker
 // but keep Duration mode active so "Trigger Cooldown" restarts from now.
 setUseOverride(false);
 if (relation.estimatedResetTime) {
 const resetDate = new Date(relation.estimatedResetTime);
 if (!isNaN(resetDate.getTime())) {
 const y = resetDate.getFullYear();
 const m = String(resetDate.getMonth() + 1).padStart(2, '0');
 const d = String(resetDate.getDate()).padStart(2, '0');
 setOverrideDate(`${y}-${m}-${d}`);
 let h = resetDate.getHours();
 const min = resetDate.getMinutes();
 const ampm = h >= 12 ? 'PM' : 'AM';
 h = h % 12 || 12;
 setOverrideHour(String(h));
 setOverrideMinute(String(min).padStart(2, '0'));
 setOverrideAmPm(ampm as 'AM' | 'PM');
 }
 }
 }

 // Auto-populate cooldown from the service's default policy
 const svc = services.find(s => s.id === serviceId);
 if (svc?.defaultCooldownValue && svc?.defaultCooldownUnit) {
 let minutes = svc.defaultCooldownValue;
 switch (svc.defaultCooldownUnit) {
 case 'hours': minutes *= 60; break;
 case 'days': minutes *= 60 * 24; break;
 case 'weeks': minutes *= 60 * 24 * 7; break;
 }
 setCustomCooldown(String(minutes));
 } else {
 setCustomCooldown('180');
 }

 // Initialize override date to a sensible default when not pre-populated
 if (!relation?.estimatedResetTime) {
 const now = new Date();
 const y = now.getFullYear();
 const mo = String(now.getMonth() + 1).padStart(2, '0');
 const da = String(now.getDate()).padStart(2, '0');
 setOverrideDate(`${y}-${mo}-${da}`);
 let h = now.getHours();
 const ampm = h >= 12 ? 'PM' : 'AM';
 h = h % 12 || 12;
 setOverrideHour(String(h));
 setOverrideMinute(String(now.getMinutes()).padStart(2, '0'));
 setOverrideAmPm(ampm as 'AM' | 'PM');
 }

 setActiveControl({ emailId, serviceId });
 };

 const handleApplyControlUpdates = () => {
 if (!activeControl) return;
 const { emailId, serviceId } = activeControl;
 
 const rem = customRemaining === '' ? undefined : Number(customRemaining);
 const max = customMax === '' ? undefined : Number(customMax);
 const rel = emailServices.find(es => es.emailId === emailId && es.serviceId === serviceId);
 
 if (rel) {
 // If override is active, pass the exact ISO time
 const overrideISO = useOverride && computedOverrideISO ? computedOverrideISO : undefined;
 updateStatus(
 emailId,
 serviceId,
 rel.status,
 useOverride ? undefined : (customCooldown ? Number(customCooldown) : undefined),
 rem,
 max,
 customNotes,
 overrideISO
 );
 }
 setActiveControl(null);
 };

 // Get active relation details
 const activeRelation = activeControl 
 ? emailServices.find(es => es.emailId === activeControl.emailId && es.serviceId === activeControl.serviceId)
 : null;
 const activeEmailObj = activeControl ? emails.find(e => e.id === activeControl.emailId) : null;
 const activeServiceObj = activeControl ? services.find(s => s.id === activeControl.serviceId) : null;

 return (
 <div className="space-y-8 pb-12">
 {/* Page Header */}
 <div className="flex flex-row items-start justify-between gap-3">
 <div>
 <h2 className="text-2xl font-bold font-heading theme-text-primary tracking-tight">System Dashboard</h2>
 <p className="text-sm theme-text-secondary">Monitor active accounts, session cooldowns, and API limits.</p>
 </div>

 {/* Right: Live badge + Theme toggle */}
 <div className="flex items-center gap-2 flex-shrink-0 mt-1">
 {/* DB Status pill — left of Last Sync */}
 {(() => {
  const isConnected = dbStatus === 'connected';
  const isError = dbStatus === 'error';
  const isChecking = dbStatus === 'checking';
  return (
   <div
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs"
    title={isConnected ? 'Database connected' : isError ? 'Database connection error' : 'Connecting…'}
    style={{
     background: 'var(--bg-surface-alt)',
     borderColor: isError ? 'rgba(239,68,68,0.3)' : isConnected ? 'rgba(16,185,129,0.3)' : 'var(--border-primary)',
     boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    }}
   >
    <span
     className="flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border text-[11px]"
     style={{
      color: isError ? '#f87171' : isConnected ? '#34d399' : 'var(--text-secondary)',
      background: isError ? 'rgba(239,68,68,0.1)' : isConnected ? 'rgba(16,185,129,0.1)' : 'var(--bg-surface)',
      borderColor: isError ? 'rgba(239,68,68,0.2)' : isConnected ? 'rgba(16,185,129,0.2)' : 'var(--border-primary)',
     }}
    >
     <Database size={11} />
     {isChecking && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
     {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
     {isError && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
     <span className="hidden sm:inline">
      {isConnected ? 'DB' : isError ? 'DB Err' : 'DB…'}
     </span>
    </span>
   </div>
  );
 })()}

 {/* Last Sync: Live pill */}
 <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs"
 style={{
 background: 'var(--bg-surface-alt)',
 borderColor: 'var(--border-primary)',
 boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
 }}>
 <span className="hidden sm:inline font-medium" style={{ color: 'var(--text-secondary)' }}>Last Sync:</span>
 <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
 Live
 </span>
 </div>

 {/* Theme toggle */}
 <button
 onClick={() => updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
 title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
 style={{
 background: 'var(--bg-surface-alt)',
 borderColor: 'var(--border-primary)',
 color: 'var(--text-secondary)',
 boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
 }}
 >
 {resolvedTheme === 'dark'
 ? <Sun size={14} className="text-amber-400" />
 : <Moon size={14} className="text-indigo-500" />
 }
 <span className="hidden sm:inline">{settings.theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
 </button>
 </div>
 </div>


 {/* KPI Cards Grid */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="p-5 rounded-2xl theme-bg-surface-alt border theme-border-subtle theme-shadow-lg flex items-center justify-between gap-4">
 <div className="space-y-1">
 <span className="text-xs theme-text-muted font-semibold uppercase tracking-wider">Available Services</span>
 <h3 className="text-3xl font-bold font-heading text-emerald-400">{availableRelations}</h3>
 <p className="text-[10px] theme-text-secondary font-medium">Across all providers</p>
 </div>
 <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 theme-shadow-md shadow-emerald-500/5">
 <Sparkles size={22} />
 </div>
 </div>

 <div className="p-5 rounded-2xl theme-bg-surface-alt border theme-border-subtle theme-shadow-lg flex items-center justify-between gap-4">
 <div className="space-y-1">
 <span className="text-xs theme-text-muted font-semibold uppercase tracking-wider">In Cooldown</span>
 <h3 className="text-3xl font-bold font-heading text-amber-400">{coolingRelations}</h3>
 <p className="text-[10px] theme-text-secondary font-medium">Auto-resets pending</p>
 </div>
 <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 theme-shadow-md shadow-amber-500/5">
 <Clock size={22} />
 </div>
 </div>

 <div className="p-5 rounded-2xl theme-bg-surface-alt border theme-border-subtle theme-shadow-lg flex items-center justify-between gap-4">
 <div className="space-y-1">
 <span className="text-xs theme-text-muted font-semibold uppercase tracking-wider">Quota Blocked</span>
 <h3 className="text-3xl font-bold font-heading text-rose-400">{limitedRelations}</h3>
 <p className="text-[10px] theme-text-secondary font-medium">Limits hit today</p>
 </div>
 <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 theme-shadow-md shadow-rose-500/5">
 <AlertTriangle size={22} />
 </div>
 </div>

  <div className="p-5 rounded-2xl theme-bg-surface-alt border theme-border-subtle theme-shadow-lg flex items-center justify-between gap-4">
  <div className="space-y-1">
  <span className="text-xs theme-text-muted font-semibold uppercase tracking-wider">Total Accounts</span>
  <h3 className="text-3xl font-bold font-heading theme-text-primary">{filteredTotalAccounts}</h3>
  <p className="text-[10px] theme-text-secondary font-medium">
    {filteredTotalAccounts === totalEmails ? 'Active email pools' : `of ${totalEmails} total`}
  </p>
  </div>
  <div className="p-3.5 rounded-xl theme-bg-surface-alt border theme-border-subtle theme-text-secondary">
  <Calendar size={22} />
  </div>
  </div>
 </div>

 {/* Search Bar */}
 <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
 <input
 type="text"
 placeholder="Search by email nickname or address..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full theme-bg-surface-alt border theme-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-body"
 />
 </div>
 <label className="relative flex items-center gap-2 theme-bg-surface-alt border theme-border-subtle rounded-xl px-3 py-2 self-start lg:self-auto min-w-[220px]">
 <Mail size={14} className="theme-text-muted" />
 <span className="text-xs theme-text-muted font-semibold uppercase">Provider:</span>
 <select
 value={selectedProvider}
 onChange={(e) => setSelectedProvider(e.target.value as ProviderType | 'All')}
 className="flex-1 appearance-none bg-transparent pr-6 text-sm theme-text-secondary font-semibold focus:outline-none cursor-pointer"
 >
 <option value="All" className="theme-bg-primary theme-text-secondary">All Providers</option>
 {providerList.map(provider => (
 <option key={provider} value={provider} className="theme-bg-primary theme-text-secondary">
 {provider}
 </option>
 ))}
 </select>
 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary pointer-events-none" />
 </label>
 </div>

 {/* Horizontal Scrollable Filter Chips */}
 <div className="space-y-2.5 p-4 rounded-2xl theme-bg-surface-alt border theme-border-subtle">

 {/* ── Service Filter Chips ── */}
 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
 <motion.button
 whileTap={{ scale: 0.93 }}
 onClick={() => setSelectedServiceFilter('All')}
 className={`${chipBase} ${selectedServiceFilter === 'All' ? chipSelectedStyle.blue : chipUnselected}`}
 >
 <Layers size={13} />
 <span>All Services</span>
 </motion.button>
 {services.map(s => (
 <motion.button
 key={s.id}
 whileTap={{ scale: 0.93 }}
 onClick={() => setSelectedServiceFilter(s.id)}
 className={`${chipBase} ${selectedServiceFilter === s.id ? chipSelectedStyle.blue : chipUnselected}`}
 >
 <ServiceIcon name={s.icon} size={13} />
 <span>{s.name}</span>
 </motion.button>
 ))}
 </div>

 {/* Subtle divider */}
 <div className="border-t theme-border-subtle" />

 {/* ── Status Filter Chips ── */}
 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
 <motion.button
 whileTap={{ scale: 0.93 }}
 onClick={() => setSelectedStatus('All')}
 className={`${chipBase} ${selectedStatus === 'All' ? chipSelectedStyle.blue : chipUnselected}`}
 >
 <BarChart3 size={13} />
 <span>All Status</span>
 </motion.button>
 {statusList.map(status => (
 <motion.button
 key={status}
 whileTap={{ scale: 0.93 }}
 onClick={() => setSelectedStatus(status)}
 className={`${chipBase} ${selectedStatus === status ? chipSelectedStyle[statusAccent[status]] : chipUnselected}`}
 >
 <span className={`w-2 h-2 rounded-full ${statusDotColor[status]}`} />
 <span>{status}</span>
 </motion.button>
 ))}
 </div>

 {/* ── Sort Filter Chips ── */}
 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
 {sortOptions.map((option) => (
 <motion.button
 key={option.value}
 whileTap={{ scale: 0.93 }}
 onClick={() => setSortBy(option.value)}
 className={`${chipBase} ${sortBy === option.value ? chipSelectedStyle.violet : chipUnselected}`}
 >
 {option.value === 'alphabetical' && <ArrowUpDown size={13} />}
 <span>{option.label}</span>
 </motion.button>
 ))}
 </div>
 </div>

 {/* Main Accounts & Status Grid */}
 {filteredEmails.length === 0 ? (
 <div className="p-12 text-center rounded-2xl theme-bg-surface-alt border theme-border-subtle flex flex-col items-center justify-center gap-3">
 <Info size={36} className="theme-text-muted" />
 <h4 className="theme-text-secondary font-semibold font-heading">No matching accounts found</h4>
 <p className="text-xs theme-text-muted max-w-sm">Try resetting your search query, selecting different filter chips, or creating a new email account.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {filteredEmails.map((email) => {
 // Get relations for this email
 const emailRelations = emailServices.filter(es => es.emailId === email.id);
 
 // Filter relations based on filters
 const activeRelations = emailRelations.filter(es => {
 const matchesSrv = selectedServiceFilter === 'All' || es.serviceId === selectedServiceFilter;
 const matchesStat = selectedStatus === 'All' || es.status === selectedStatus;
 return matchesSrv && matchesStat;
 });

 return (
 <motion.div
 key={email.id}
 layout
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -15 }}
 transition={{ duration: 0.2 }}
 className="rounded-2xl theme-bg-surface-alt border theme-border-subtle theme-shadow-lg overflow-hidden flex flex-col hover:theme-border transition-all duration-300"
 >
 {/* Account details top header */}
 <div className="p-5 border-b theme-border theme-bg-surface-alt flex items-start justify-between gap-4">
 <div className="space-y-0.5">
 <h4 className="font-heading font-bold theme-text-primary tracking-tight flex items-center gap-1.5">
 {email.nickname}
 </h4>
 <p className="text-xs theme-text-secondary font-mono font-medium truncate max-w-[200px] sm:max-w-[250px]">{email.email}</p>
 </div>
 <span className="text-[10px] font-bold px-2 py-1 rounded-md theme-bg-secondary border theme-border theme-text-secondary">
 {email.provider}
 </span>
 </div>

 {/* Services status list */}
 <div className="p-5 flex-1 space-y-3.5">
 <div className="text-[10px] theme-text-muted font-semibold uppercase tracking-wider">Active Services</div>
 
 {activeRelations.length === 0 ? (
 <div className="text-xs theme-text-muted py-4 text-center">No matching services configured</div>
 ) : (
 <div className="space-y-2.5">
 {activeRelations.map((es) => {
 const service = services.find(s => s.id === es.serviceId);
 if (!service) return null;
 const resetDateText = es.estimatedResetTime ? formatResetDate(es.estimatedResetTime) : null;
 const showResetDate = resetDateText && (es.status === 'Cooling Down' || es.status === 'Limit Reached' || es.status === 'Resetting Soon');

 return (
 <div
 key={es.id}
 onClick={() => handleOpenControl(email.id, service.id)}
 className={`p-3 rounded-xl border flex items-center justify-between gap-4 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer theme-shadow-sm hover:shadow ${getStatusColor(es.status)} ${getStatusGlow(es.status)}`}
 >
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="p-1.5 rounded-lg theme-bg-surface-alt text-current flex items-center justify-center">
 <ServiceIcon name={service.icon} size={15} />
 </div>
 <div className="min-w-0">
 <h5 className="text-xs font-bold font-heading truncate theme-text-primary">{service.name}</h5>
 {es.remainingRequests !== undefined && es.maximumRequests !== undefined && (
 <p className="text-[9px] theme-text-secondary font-semibold font-mono mt-0.5">
 Reqs: {es.remainingRequests}/{es.maximumRequests}
 </p>
 )}
 </div>
 </div>

 {showResetDate && (
 <div className="flex-1 min-w-[8rem] text-center px-1">
 <p className="text-[10px] font-semibold theme-text-secondary leading-snug whitespace-normal">
 Resets on {resetDateText}
 </p>
 </div>
 )}
 
 {/* Right status badge/timer */}
 <div className="text-right flex-shrink-0 flex items-center gap-2">
 {es.status === 'Cooling Down' || es.status === 'Limit Reached' || es.status === 'Resetting Soon' ? (
 <div className="flex flex-col items-end">
 <span className="text-[10px] font-bold flex items-center gap-1">
 <Clock size={10} className="animate-spin-slow" />
 {es.status === 'Cooling Down' ? 'Cooldown' : es.status === 'Resetting Soon' ? 'Resetting Soon' : 'Limited'}
 </span>
 {es.estimatedResetTime && (
 <CountdownTimer
 targetTime={es.estimatedResetTime}
 serverNow={serverNow}
 className="text-[9px] font-mono font-bold opacity-80"
 />
 )}
 </div>
 ) : (
 <span className="text-[10px] font-bold">{es.status}</span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 )}

 {/* QUICK CONTROL POP-OVER MODAL */}
 <AnimatePresence>
 {activeControl && activeRelation && activeEmailObj && activeServiceObj && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 theme-bg-overlay backdrop-blur-sm">
 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 className="w-full max-w-lg rounded-2xl theme-bg-secondary border theme-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
 >
 {/* Header */}
 <div className="p-6 border-b theme-border flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
 <ServiceIcon name={activeServiceObj.icon} size={20} />
 </div>
 <div>
 <h3 className="font-heading font-bold theme-text-primary text-base">
 {activeServiceObj.name} Control Panel
 </h3>
 <p className="text-xs theme-text-secondary font-medium">
 Account: {activeEmailObj.nickname} ({activeEmailObj.email})
 </p>
 </div>
 </div>
 <button
 onClick={() => setActiveControl(null)}
 className="p-1.5 rounded-lg theme-text-muted theme-text-secondary theme-bg-hover transition cursor-pointer"
 >
 <X size={18} />
 </button>
 </div>

 {/* Body */}
 <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm theme-text-secondary">
 {/* Active Status Banner */}
 <div className={`p-4 rounded-xl border flex items-center justify-between ${getStatusColor(activeRelation.status)}`}>
 <div className="space-y-0.5">
 <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Current Status</span>
 <h4 className="font-heading font-bold text-base theme-text-primary">{activeRelation.status}</h4>
 </div>
 {activeRelation.estimatedResetTime && (
 <div className="text-right">
 <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">Remaining Cooldown</span>
 <CountdownTimer
 targetTime={activeRelation.estimatedResetTime}
 serverNow={serverNow}
 className="text-base font-mono font-bold theme-text-primary"
 showLabels
 />
 </div>
 )}
 </div>

 {/* Quick Action Buttons */}
 <div className="space-y-2.5">
 <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Quick Actions</h4>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => {
 const cooldownMinutes = Number(customCooldown);
 if (useOverride && computedOverrideISO) {
 // Use exact date/time override
 updateStatus(
 activeEmailObj.id,
 activeServiceObj.id,
 'Limit Reached',
 undefined,
 0,
 undefined,
 'Reached quota limit. Manual reset time set.',
 computedOverrideISO
 );
 } else if (Number.isFinite(cooldownMinutes) && cooldownMinutes > 0) {
 updateStatus(
 activeEmailObj.id,
 activeServiceObj.id,
 'Limit Reached',
 cooldownMinutes,
 0,
 undefined,
 customNotes || `Reached quota limit. Cooldown timer set for ${cooldownMinutes} minutes.`
 );
 } else {
 // Use service default policy
 reachLimit(activeEmailObj.id, activeServiceObj.id, undefined, 'Reached quota limit during execution.');
 }
 setActiveControl(null);
 }}
 className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
 >
 <AlertTriangle size={14} />
 Trigger Cooldown
 </button>

 <button
 onClick={() => {
 resetTimer(activeEmailObj.id, activeServiceObj.id);
 setActiveControl(null);
 }}
 className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 transition cursor-pointer"
 >
 <RefreshCw size={14} />
 Reset Timer
 </button>
 </div>
 </div>

 {/* Cooldown Settings Configuration */}
 <div className="space-y-4 pt-4 border-t theme-border">
 <div className="flex justify-between items-center">
 <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Configure Parameters</h4>
 </div>

 <div className="space-y-3.5">
 {/* Cooldown Mode Toggle */}
 <div className="space-y-2">
 <label className="text-xs theme-text-secondary font-medium">Cooldown End Time</label>
 <div className="flex rounded-xl overflow-hidden border theme-border theme-bg-primary">
 <button
 onClick={() => setUseOverride(false)}
 className={`flex-1 py-2 text-xs font-bold transition cursor-pointer ${
 !useOverride
 ? 'bg-blue-600 text-white theme-shadow-lg shadow-blue-500/20'
 : 'theme-text-secondary theme-text-secondary theme-bg-hover'
 }`}
 >
 <Clock size={12} className="inline mr-1.5 -mt-0.5" />
 Duration
 </button>
 <button
 onClick={() => setUseOverride(true)}
 className={`flex-1 py-2 text-xs font-bold transition cursor-pointer ${
 useOverride
 ? 'bg-violet-600 text-white theme-shadow-lg shadow-violet-500/20'
 : 'theme-text-secondary theme-text-secondary theme-bg-hover'
 }`}
 >
 <Calendar size={12} className="inline mr-1.5 -mt-0.5" />
 Exact Date & Time
 </button>
 </div>
 </div>

 {!useOverride ? (
 /* Duration Mode */
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium">
 Cooldown Duration (Minutes)
 {activeServiceObj?.defaultCooldownValue && activeServiceObj?.defaultCooldownUnit && (
 <span className="ml-2 text-blue-400/80 font-normal">
 — {activeServiceObj.name}: {activeServiceObj.defaultCooldownValue} {activeServiceObj.defaultCooldownUnit}
 </span>
 )}
 </label>
 <div className="flex gap-2">
 <input
 type="number"
 value={customCooldown}
 onChange={(e) => setCustomCooldown(e.target.value)}
 className="flex-1 theme-bg-primary border theme-border rounded-xl px-4 py-2 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500"
 />
 <button onClick={() => setCustomCooldown('60')} className="px-3 theme-bg-tertiary hover:theme-bg-hover text-xs rounded-xl font-semibold theme-text-secondary cursor-pointer">1h</button>
 <button onClick={() => setCustomCooldown('180')} className="px-3 theme-bg-tertiary hover:theme-bg-hover text-xs rounded-xl font-semibold theme-text-secondary cursor-pointer">3h</button>
 <button onClick={() => setCustomCooldown('720')} className="px-3 theme-bg-tertiary hover:theme-bg-hover text-xs rounded-xl font-semibold theme-text-secondary cursor-pointer">12h</button>
 </div>
 </div>
 ) : (
 /* Exact Date & Time Override Mode */
 <div className="space-y-3">
 {/* Date Picker */}
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium flex items-center gap-1.5">
 <Calendar size={12} className="text-violet-400" />
 Date
 </label>
 <input
 type="date"
 value={overrideDate}
 onChange={(e) => setOverrideDate(e.target.value)}
 className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2.5 text-sm theme-text-primary focus:outline-none focus:border-violet-500 cursor-pointer [color-scheme:dark]"
 />
 </div>

 {/* Time Picker */}
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium flex items-center gap-1.5">
 <Clock size={12} className="text-violet-400" />
 Time
 </label>
 <div className="flex items-center gap-2">
 {/* Hour */}
 <select
 value={overrideHour}
 onChange={(e) => setOverrideHour(e.target.value)}
 className="flex-1 theme-bg-primary border theme-border rounded-xl px-3 py-2.5 text-sm theme-text-primary focus:outline-none focus:border-violet-500 cursor-pointer appearance-none text-center [color-scheme:dark]"
 >
 {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
 <option key={h} value={String(h)}>{String(h).padStart(2, '0')}</option>
 ))}
 </select>
 <span className="text-lg font-bold theme-text-muted">:</span>
 {/* Minute */}
 <select
 value={overrideMinute}
 onChange={(e) => setOverrideMinute(e.target.value)}
 className="flex-1 theme-bg-primary border theme-border rounded-xl px-3 py-2.5 text-sm theme-text-primary focus:outline-none focus:border-violet-500 cursor-pointer appearance-none text-center [color-scheme:dark]"
 >
 {Array.from({ length: 60 }, (_, i) => i).map(m => (
 <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>
 ))}
 </select>
 {/* AM/PM */}
 <div className="flex rounded-xl overflow-hidden border theme-border theme-bg-primary">
 <button
 onClick={() => setOverrideAmPm('AM')}
 className={`px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
 overrideAmPm === 'AM'
 ? 'bg-violet-600 text-white'
 : 'theme-text-secondary theme-text-secondary'
 }`}
 >
 AM
 </button>
 <button
 onClick={() => setOverrideAmPm('PM')}
 className={`px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
 overrideAmPm === 'PM'
 ? 'bg-violet-600 text-white'
 : 'theme-text-secondary theme-text-secondary'
 }`}
 >
 PM
 </button>
 </div>
 </div>
 </div>

 {/* Quick Set Buttons */}
 <div className="flex gap-2 flex-wrap">
 {[
 { label: '+1h', hours: 1 },
 { label: '+3h', hours: 3 },
 { label: '+6h', hours: 6 },
 { label: '+12h', hours: 12 },
 { label: '+1d', hours: 24 },
 { label: '+7d', hours: 168 },
 ].map(preset => (
 <button
 key={preset.label}
 onClick={() => {
 const future = new Date(Date.now() + preset.hours * 60 * 60 * 1000);
 const y = future.getFullYear();
 const mo = String(future.getMonth() + 1).padStart(2, '0');
 const da = String(future.getDate()).padStart(2, '0');
 setOverrideDate(`${y}-${mo}-${da}`);
 let h = future.getHours();
 const ampm = h >= 12 ? 'PM' : 'AM';
 h = h % 12 || 12;
 setOverrideHour(String(h));
 setOverrideMinute(String(future.getMinutes()).padStart(2, '0'));
 setOverrideAmPm(ampm as 'AM' | 'PM');
 }}
 className="px-3 py-1.5 theme-bg-tertiary hover:bg-violet-600/20 hover:border-violet-500/30 border theme-border-secondary text-xs rounded-lg font-semibold theme-text-secondary hover:text-violet-300 transition cursor-pointer"
 >
 {preset.label}
 </button>
 ))}
 </div>

 {/* Preview */}
 {computedOverrideISO && (
 <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
 <p className="text-xs text-violet-300 font-medium">
 ⏰ Cooldown will end at:{' '}
 <span className="font-bold text-violet-200">
 {new Date(computedOverrideISO).toLocaleString('en-US', {
 weekday: 'short',
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 hour: 'numeric',
 minute: '2-digit',
 hour12: true,
 })}
 </span>
 </p>
 {new Date(computedOverrideISO).getTime() <= Date.now() && (
 <p className="text-xs text-rose-400 mt-1">⚠ This time is in the past. The account will reset immediately.</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* Quota inputs */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium">Remaining Requests</label>
 <input
 type="number"
 value={customRemaining}
 onChange={(e) => setCustomRemaining(e.target.value)}
 placeholder="e.g. 50"
 className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium">Maximum Quota</label>
 <input
 type="number"
 value={customMax}
 onChange={(e) => setCustomMax(e.target.value)}
 placeholder="e.g. 100"
 className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500"
 />
 </div>
 </div>

 {/* Status Notes */}
 <div className="space-y-1.5">
 <label className="text-xs theme-text-secondary font-medium">Status / Cooldown Notes</label>
 <textarea
 value={customNotes}
 onChange={(e) => setCustomNotes(e.target.value)}
 placeholder="Describe status reason (e.g. switching accounts, model upgrade limit, etc.)"
 rows={2}
 className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500 font-body resize-none"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 border-t theme-border theme-bg-surface-alt flex justify-end gap-3">
 <button
 onClick={() => setActiveControl(null)}
 className="px-5 py-2.5 theme-bg-tertiary hover:theme-bg-hover text-xs font-semibold theme-text-secondary rounded-xl cursor-pointer"
 >
 Cancel
 </button>
 <button
 onClick={handleApplyControlUpdates}
 className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl theme-shadow-lg shadow-blue-500/20 cursor-pointer"
 >
 Apply Settings
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </div>
 );
};
