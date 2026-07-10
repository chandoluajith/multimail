import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
 Settings, 
 Bell, 
 Moon, 
 Sun, 
 Laptop, 
 Database, 
 Download, 
 Upload, 
 Trash2, 
 RefreshCw, 
 Check, 
 AlertCircle
} from 'lucide-react';
import { StatusType } from '../types';

export const SettingsView: React.FC = () => {
 const { 
 settings, 
 updateSettings, 
 loadMockData, 
 clearDatabase, 
 exportData, 
 importData 
 } = useApp();

 const [importJson, setImportJson] = useState('');
 const [importError, setImportError] = useState<string | null>(null);
 const [importSuccess, setImportSuccess] = useState(false);
 const [exportSuccess, setExportSuccess] = useState(false);
 const [dbCleared, setDbCleared] = useState(false);
 const [mockLoaded, setMockLoaded] = useState(false);

 const handleExport = () => {
 try {
 const dataStr = exportData();
 const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
 
 const exportFileDefaultName = `mailstracker-backup-${new Date().toISOString().split('T')[0]}.json`;
 
 const linkElement = document.createElement('a');
 linkElement.setAttribute('href', dataUri);
 linkElement.setAttribute('download', exportFileDefaultName);
 linkElement.click();
 
 setExportSuccess(true);
 setTimeout(() => setExportSuccess(false), 3000);
 } catch (e) {
 console.error(e);
 }
 };

 const handleImport = () => {
 setImportError(null);
 setImportSuccess(false);
 if (!importJson.trim()) {
 setImportError('Please paste some JSON backup data first.');
 return;
 }

 try {
 // Basic syntax validation
 JSON.parse(importJson);
 const success = importData(importJson);
 if (success) {
 setImportSuccess(true);
 setImportJson('');
 setTimeout(() => setImportSuccess(false), 3000);
 } else {
 setImportError('Invalid schema. The backup file format is not supported.');
 }
 } catch {
 setImportError('Invalid JSON format. Please check for syntax errors.');
 }
 };

 const handleClearDb = () => {
 if (window.confirm('Are you sure you want to clear all data? This will delete all emails, services, and history.')) {
 clearDatabase();
 setDbCleared(true);
 setTimeout(() => setDbCleared(false), 3000);
 }
 };

 const handleLoadMock = () => {
 if (window.confirm('This will append mock email accounts, services, and usage history. Continue?')) {
 loadMockData();
 setMockLoaded(true);
 setTimeout(() => setMockLoaded(false), 3000);
 }
 };

 return (
 <div className="space-y-8 pb-12">
 {/* Page Header */}
 <div>
 <h2 className="text-2xl font-bold font-heading theme-text-primary tracking-tight">System Settings</h2>
 <p className="text-sm theme-text-secondary">Configure application behavior, notification preferences, and data backups.</p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* Left column: Preferences & Notification settings */}
 <div className="lg:col-span-2 space-y-8">
 
 {/* Visual Preferences Card */}
 <div className="theme-bg-surface-alt border theme-border-subtle backdrop-blur-md rounded-2xl p-6">
 <div className="flex items-center gap-3 border-b theme-border-subtle pb-4 mb-6">
 <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400">
 <Settings size={20} />
 </div>
 <div>
 <h3 className="font-semibold theme-text-primary">General Preferences</h3>
 <p className="text-xs theme-text-muted">Theme, time formats, and default limits</p>
 </div>
 </div>

 <div className="space-y-6">
 {/* Theme Settings */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Theme Mode</label>
 <p className="text-xs theme-text-muted">Choose your visual appearance preference</p>
 </div>
 <div className="flex theme-bg-primary p-1 rounded-xl border theme-border">
 <button
 onClick={() => updateSettings({ theme: 'dark' })}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
 settings.theme === 'dark' 
 ? 'bg-blue-600 text-white' 
 : 'theme-text-secondary theme-text-primary'
 }`}
 >
 <Moon size={14} />
 Dark
 </button>
 <button
 onClick={() => updateSettings({ theme: 'light' })}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
 settings.theme === 'light' 
 ? 'bg-blue-600 text-white' 
 : 'theme-text-secondary theme-text-primary'
 }`}
 >
 <Sun size={14} />
 Light
 </button>
 <button
 onClick={() => updateSettings({ theme: 'system' })}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
 settings.theme === 'system' 
 ? 'bg-blue-600 text-white' 
 : 'theme-text-secondary theme-text-primary'
 }`}
 >
 <Laptop size={14} />
 System
 </button>
 </div>
 </div>

 {/* Time Format */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t theme-border-subtle">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Time Format</label>
 <p className="text-xs theme-text-muted">Display style for active countdowns and timestamps</p>
 </div>
 <div className="flex theme-bg-primary p-1 rounded-xl border theme-border">
 <button
 onClick={() => updateSettings({ timeFormat: '12h' })}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
 settings.timeFormat === '12h' 
 ? 'bg-blue-600 text-white' 
 : 'theme-text-secondary theme-text-primary'
 }`}
 >
 12-Hour
 </button>
 <button
 onClick={() => updateSettings({ timeFormat: '24h' })}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
 settings.timeFormat === '24h' 
 ? 'bg-blue-600 text-white' 
 : 'theme-text-secondary theme-text-primary'
 }`}
 >
 24-Hour
 </button>
 </div>
 </div>

 {/* Default Cooldown Duration */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t theme-border-subtle">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Default Cooldown Duration</label>
 <p className="text-xs theme-text-muted">Initial hours assigned when a service hits its limit</p>
 </div>
 <div className="flex items-center gap-2">
 <input
 type="number"
 min="1"
 max="168"
 value={settings.defaultCooldownDuration}
 onChange={(e) => updateSettings({ defaultCooldownDuration: Math.max(1, Number(e.target.value)) })}
 className="w-20 px-3 py-1.5 theme-bg-primary border theme-border rounded-xl theme-text-primary text-center font-bold text-sm focus:outline-none focus:border-blue-500 transition"
 />
 <span className="text-xs theme-text-muted font-semibold">Hours</span>
 </div>
 </div>

 {/* Default Status */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t theme-border-subtle">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Default Status</label>
 <p className="text-xs theme-text-muted">Status given to new account-service pairings</p>
 </div>
 <select
 value={settings.defaultStatus}
 onChange={(e) => updateSettings({ defaultStatus: e.target.value as StatusType })}
 className="px-3 py-2 theme-bg-primary border theme-border rounded-xl theme-text-primary text-sm font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer min-w-[140px]"
 >
 <option value="Available">Available</option>
 <option value="Cooling Down">Cooling Down</option>
 <option value="Limit Reached">Limit Reached</option>
 <option value="Unknown">Unknown</option>
 </select>
 </div>

 </div>
 </div>

 {/* Notifications Card */}
 <div className="theme-bg-surface-alt border theme-border-subtle backdrop-blur-md rounded-2xl p-6">
 <div className="flex items-center gap-3 border-b theme-border-subtle pb-4 mb-6">
 <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400">
 <Bell size={20} />
 </div>
 <div>
 <h3 className="font-semibold theme-text-primary">Alerts & Notifications</h3>
 <p className="text-xs theme-text-muted">Browser alerts and system audio triggers</p>
 </div>
 </div>

 <div className="space-y-4">
 
 {/* Notification Permission Request Banner */}
 {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
 <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
 <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
 <div className="space-y-1">
 <p className="text-xs font-semibold text-amber-300">Browser Notifications are Blocked</p>
 <p className="text-[11px] text-amber-500/80 leading-relaxed">
 Enable system notifications to receive alerts when service cooldown periods end.
 </p>
 <button
 onClick={() => Notification.requestPermission()}
 className="mt-2 text-[10px] font-bold theme-text-primary bg-amber-500/30 hover:bg-amber-500/40 px-3 py-1 rounded-lg border border-amber-500/30 transition cursor-pointer"
 >
 Request Permission
 </button>
 </div>
 </div>
 )}

 {/* Notification Toggles */}
 <div className="space-y-4 pt-2">
 <div className="flex items-center justify-between">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Cooldown Finished</label>
 <p className="text-xs theme-text-muted">Notify instantly when cooldown timer hits zero</p>
 </div>
 <input
 type="checkbox"
 checked={settings.notifications.cooldownFinished}
 onChange={(e) => updateSettings({
 notifications: { ...settings.notifications, cooldownFinished: e.target.checked }
 })}
 className="w-4 h-4 rounded theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
 />
 </div>

 <div className="flex items-center justify-between pt-4 border-t theme-border-subtle">
 <div>
 <label className="text-sm font-medium theme-text-secondary">Reset Completed</label>
 <p className="text-xs theme-text-muted">Notify when daily API limit duration resets</p>
 </div>
 <input
 type="checkbox"
 checked={settings.notifications.resetCompleted}
 onChange={(e) => updateSettings({
 notifications: { ...settings.notifications, resetCompleted: e.target.checked }
 })}
 className="w-4 h-4 rounded theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
 />
 </div>

 <div className="flex items-center justify-between pt-4 border-t theme-border-subtle">
 <div>
 <label className="text-sm font-medium theme-text-secondary">10-Minute Warning</label>
 <p className="text-xs theme-text-muted">Receive a nudge 10 minutes prior to a service timer reset</p>
 </div>
 <input
 type="checkbox"
 checked={settings.notifications.resetTenMinutes}
 onChange={(e) => updateSettings({
 notifications: { ...settings.notifications, resetTenMinutes: e.target.checked }
 })}
 className="w-4 h-4 rounded theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
 />
 </div>
 </div>

 </div>
 </div>
 </div>

 {/* Right column: Data Administration */}
 <div className="space-y-8">
 
 {/* Backup & Restore Panel */}
 <div className="theme-bg-surface-alt border theme-border-subtle backdrop-blur-md rounded-2xl p-6 space-y-6">
 <div className="flex items-center gap-3 border-b theme-border-subtle pb-4">
 <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-400">
 <Database size={20} />
 </div>
 <div>
 <h3 className="font-semibold theme-text-primary">Data Administration</h3>
 <p className="text-xs theme-text-muted">Export, import or wipe data pools</p>
 </div>
 </div>

 {/* Actions list */}
 <div className="space-y-4">
 {/* Backup */}
 <div>
 <button
 onClick={handleExport}
 className="w-full flex items-center justify-center gap-2 py-2.5 px-4 theme-bg-primary border theme-border theme-bg-hover theme-text-primary font-semibold text-xs rounded-xl transition cursor-pointer"
 >
 <Download size={14} className="text-emerald-400" />
 Backup Current Database (.json)
 </button>
 {exportSuccess && (
 <p className="text-emerald-400 text-[10px] text-center font-bold mt-1.5 flex items-center justify-center gap-1">
 <Check size={10} /> Backup downloaded successfully!
 </p>
 )}
 </div>

 {/* Import Textarea */}
 <div className="space-y-2 pt-2 border-t theme-border-subtle">
 <label className="text-xs font-semibold theme-text-secondary">Import backup from text</label>
 <textarea
 value={importJson}
 onChange={(e) => setImportJson(e.target.value)}
 placeholder="Paste JSON backup string here..."
 className="w-full h-24 p-3 theme-bg-primary border theme-border rounded-xl theme-text-primary text-[11px] font-mono focus:outline-none focus:border-blue-500 transition placeholder:theme-text-muted resize-none"
 />
 
 {importError && (
 <p className="text-rose-400 text-[10px] font-bold flex items-center gap-1.5">
 <AlertCircle size={10} /> {importError}
 </p>
 )}
 {importSuccess && (
 <p className="text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
 <Check size={10} /> Backup imported successfully!
 </p>
 )}

 <button
 onClick={handleImport}
 className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 theme-text-primary font-bold text-xs rounded-xl transition cursor-pointer"
 >
 <Upload size={14} />
 Restore Backup
 </button>
 </div>

 {/* Maintenance Tools */}
 <div className="space-y-3 pt-4 border-t theme-border-subtle">
 <label className="text-xs font-semibold theme-text-secondary">Database Tools</label>
 
 <button
 onClick={handleLoadMock}
 className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 text-amber-400 font-bold text-xs rounded-xl transition cursor-pointer"
 >
 <RefreshCw size={14} />
 Load Mock Dataset
 </button>
 {mockLoaded && (
 <p className="text-amber-400 text-[10px] text-center font-semibold mt-1">
 Mock data appended successfully!
 </p>
 )}

 <button
 onClick={handleClearDb}
 className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-rose-600/10 border border-rose-500/30 hover:bg-rose-500/15 text-rose-400 font-bold text-xs rounded-xl transition cursor-pointer"
 >
 <Trash2 size={14} />
 Clear Entire Database
 </button>
 {dbCleared && (
 <p className="text-rose-400 text-[10px] text-center font-semibold mt-1">
 Database cleared!
 </p>
 )}
 </div>

 </div>
 </div>
 
 </div>
 </div>
 </div>
 );
};
