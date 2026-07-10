import React from 'react';
import { useApp } from '../context/AppContext';
import { 
 BarChart3, 
 Mail, 
 Cpu, 
 History, 
 TrendingUp,
 PieChart,
 ShieldAlert
} from 'lucide-react';
import { ProviderType } from '../types';

export const StatsView: React.FC = () => {
 const { emails, services, emailServices, history } = useApp();

 // 1. Core Summary Stats
 const totalEmails = emails.length;
 const totalServices = services.length;
 
 
 // 2. Email Provider Distribution
 const providerCounts = emails.reduce((acc, email) => {
 acc[email.provider] = (acc[email.provider] || 0) + 1;
 return acc;
 }, {} as Record<ProviderType, number>);

 const providerColors: Record<ProviderType, string> = {
 Gmail: 'bg-red-500',
 Outlook: 'bg-blue-500',
 Proton: 'bg-indigo-500',
 Yahoo: 'bg-purple-500',
 Custom: 'theme-bg-tertiary'
 };

 // 3. Service Status Breakdown
 const serviceStats = services.map(service => {
 const serviceRelations = emailServices.filter(es => es.serviceId === service.id);
 const total = serviceRelations.length;
 const available = serviceRelations.filter(es => es.status === 'Available').length;
 const cooling = serviceRelations.filter(es => es.status === 'Cooling Down').length;
 const limited = serviceRelations.filter(es => es.status === 'Limit Reached').length;
 
 return {
 ...service,
 total,
 available,
 cooling,
 limited,
 availabilityRate: total > 0 ? Math.round((available / total) * 100) : 0
 };
 });

 // 4. History Activity Summaries
 const totalEvents = history.length;
 const sessionsStarted = history.filter(h => h.event === 'Started Session').length;
 const limitsReached = history.filter(h => h.event === 'Reached Limit').length;
 const resetsCompleted = history.filter(h => h.event === 'Reset Completed').length;

 return (
 <div className="space-y-8 pb-12">
 {/* Page Header */}
 <div>
 <h2 className="text-2xl font-bold font-heading theme-text-primary tracking-tight">Analytics & Stats</h2>
 <p className="text-sm theme-text-muted">Deep-dive insights into service limits, provider breakdown, and active sessions.</p>
 </div>

 {/* Grid of Key Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 
 {/* Total Emails Card */}
 <div className="theme-bg-surface-alt theme-border border rounded-2xl p-6 flex items-center justify-between theme-shadow-md backdrop-blur-md theme-transition">
 <div className="space-y-2">
 <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Active Emails</p>
 <h3 className="text-3xl font-extrabold theme-text-primary tracking-tight">{totalEmails}</h3>
 <p className="text-[10px] theme-text-secondary font-medium">Registered pools</p>
 </div>
 <div className="p-3 bg-blue-600/10 text-blue-400 rounded-2xl">
 <Mail size={24} />
 </div>
 </div>

 {/* Total Services Card */}
 <div className="theme-bg-surface-alt theme-border border rounded-2xl p-6 flex items-center justify-between theme-shadow-md backdrop-blur-md theme-transition">
 <div className="space-y-2">
 <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">AI Services</p>
 <h3 className="text-3xl font-extrabold theme-text-primary tracking-tight">{totalServices}</h3>
 <p className="text-[10px] theme-text-secondary font-medium">Tracked endpoint APIs</p>
 </div>
 <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-2xl">
 <Cpu size={24} />
 </div>
 </div>

 {/* Sessions Started */}
 <div className="theme-bg-surface-alt theme-border border rounded-2xl p-6 flex items-center justify-between theme-shadow-md backdrop-blur-md theme-transition">
 <div className="space-y-2">
 <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Total Sessions</p>
 <h3 className="text-3xl font-extrabold theme-text-primary tracking-tight">{sessionsStarted}</h3>
 <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
 <TrendingUp size={12} /> Live tracking log
 </p>
 </div>
 <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-2xl">
 <History size={24} />
 </div>
 </div>

 {/* Limit Warnings */}
 <div className="theme-bg-surface-alt theme-border border rounded-2xl p-6 flex items-center justify-between theme-shadow-md backdrop-blur-md theme-transition">
 <div className="space-y-2">
 <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">Limits Reached</p>
 <h3 className="text-3xl font-extrabold theme-text-primary tracking-tight">{limitsReached}</h3>
 <p className="text-[10px] text-rose-400 font-semibold">Total quota exhaustion events</p>
 </div>
 <div className="p-3 bg-rose-600/10 text-rose-400 rounded-2xl">
 <ShieldAlert size={24} />
 </div>
 </div>

 </div>

 {/* Main Section */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* Left Column: Services Status & Availability rate */}
 <div className="lg:col-span-2 space-y-8">
 <div className="theme-bg-surface-alt theme-border border backdrop-blur-md rounded-2xl p-6 theme-transition">
 <h3 className="font-semibold theme-text-primary border-b theme-border-subtle pb-3 mb-6 flex items-center gap-2">
 <Cpu size={18} className="text-blue-400" />
 Service Account Health & Availability
 </h3>
 
 <div className="space-y-6">
 {serviceStats.map(srv => (
 <div key={srv.id} className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="font-semibold theme-text-secondary">{srv.name}</span>
 <span className="text-xs font-bold theme-text-muted">
 {srv.available} of {srv.total} Available ({srv.availabilityRate}%)
 </span>
 </div>

 {/* Multi-segmented Progress Bar */}
 <div className="h-3 w-full theme-bg-inset rounded-full overflow-hidden flex">
 {srv.total > 0 ? (
 <>
 <div 
 style={{ width: `${(srv.available / srv.total) * 100}%` }}
 className="bg-emerald-500 h-full transition-all duration-500"
 />
 <div 
 style={{ width: `${(srv.cooling / srv.total) * 100}%` }}
 className="bg-amber-500 h-full transition-all duration-500"
 />
 <div 
 style={{ width: `${(srv.limited / srv.total) * 100}%` }}
 className="bg-rose-500 h-full transition-all duration-500"
 />
 </>
 ) : (
 <div className="w-full theme-bg-secondary h-full" />
 )}
 </div>

 {/* Legend / Sub-counts */}
 <div className="flex items-center gap-4 text-[10px] theme-text-muted font-semibold pt-0.5">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {srv.available} Available</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {srv.cooling} Cooling</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> {srv.limited} Limited</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Right Column: Provider Breakdown & Event Stats */}
 <div className="space-y-8">
 
 {/* Provider Breakdown */}
 <div className="theme-bg-surface-alt theme-border border backdrop-blur-md rounded-2xl p-6 theme-transition">
 <h3 className="font-semibold theme-text-primary border-b theme-border-subtle pb-3 mb-4 flex items-center gap-2">
 <PieChart size={18} className="text-blue-400" />
 Provider Breakdown
 </h3>

 {totalEmails > 0 ? (
 <div className="space-y-4 pt-2">
 {/* Horizontal segment stack bar */}
 <div className="h-4 w-full theme-bg-inset rounded-full overflow-hidden flex">
 {Object.entries(providerCounts).map(([provider, count]) => {
 const widthPct = (count / totalEmails) * 100;
 return (
 <div
 key={provider}
 style={{ width: `${widthPct}%` }}
 className={`${providerColors[provider as ProviderType] || 'theme-bg-tertiary'} h-full`}
 title={`${provider}: ${count}`}
 />
 );
 })}
 </div>

 {/* Legend list */}
 <div className="space-y-2.5 pt-2">
 {Object.entries(providerCounts).map(([provider, count]) => {
 const pct = Math.round((count / totalEmails) * 100);
 return (
 <div key={provider} className="flex items-center justify-between text-xs">
 <div className="flex items-center gap-2">
 <span className={`w-2.5 h-2.5 rounded-full ${providerColors[provider as ProviderType] || 'theme-bg-tertiary'}`} />
 <span className="font-medium theme-text-secondary">{provider}</span>
 </div>
 <span className="font-bold theme-text-primary">{count} ({pct}%)</span>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="py-6 text-center text-xs theme-text-muted font-semibold">
 No email accounts registered.
 </div>
 )}
 </div>

 {/* Event Breakdown */}
 <div className="theme-bg-surface-alt theme-border border backdrop-blur-md rounded-2xl p-6 theme-transition">
 <h3 className="font-semibold theme-text-primary border-b theme-border-subtle pb-3 mb-4 flex items-center gap-2">
 <BarChart3 size={18} className="text-blue-400" />
 Event Breakdown
 </h3>

 <div className="space-y-4 pt-2">
 {/* Sessions bar */}
 <div className="space-y-1">
 <div className="flex justify-between text-xs font-semibold">
 <span className="theme-text-secondary">Sessions Started</span>
 <span className="theme-text-primary">{sessionsStarted}</span>
 </div>
 <div className="h-2 w-full theme-bg-inset rounded-full overflow-hidden">
 <div 
 style={{ width: `${totalEvents > 0 ? (sessionsStarted / totalEvents) * 100 : 0}%` }}
 className="bg-indigo-500 h-full rounded-full"
 />
 </div>
 </div>

 {/* Limits bar */}
 <div className="space-y-1">
 <div className="flex justify-between text-xs font-semibold">
 <span className="theme-text-secondary">Limits Reached</span>
 <span className="theme-text-primary">{limitsReached}</span>
 </div>
 <div className="h-2 w-full theme-bg-inset rounded-full overflow-hidden">
 <div 
 style={{ width: `${totalEvents > 0 ? (limitsReached / totalEvents) * 100 : 0}%` }}
 className="bg-rose-500 h-full rounded-full"
 />
 </div>
 </div>

 {/* Resets bar */}
 <div className="space-y-1">
 <div className="flex justify-between text-xs font-semibold">
 <span className="theme-text-secondary">Resets Completed</span>
 <span className="theme-text-primary">{resetsCompleted}</span>
 </div>
 <div className="h-2 w-full theme-bg-inset rounded-full overflow-hidden">
 <div 
 style={{ width: `${totalEvents > 0 ? (resetsCompleted / totalEvents) * 100 : 0}%` }}
 className="bg-emerald-500 h-full rounded-full"
 />
 </div>
 </div>
 </div>
 </div>

 </div>
 </div>
 </div>
 );
};
