import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 Plus, 
 Search, 
 X, 
 Edit2, 
 Trash2, 
 Info, 
 Sparkles, 
 Cpu, 
 Code2, 
 Compass, 
 MousePointerClick, 
 Wind, 
 Layers, 
 MessageSquareText, 
 Binary, 
 Terminal, 
 Brain, 
 Zap, 
 Shield, 
 Key,
 Check
} from 'lucide-react';
import { Service, CooldownUnit } from '../types';
import { ServiceIcon } from './ServiceIcon';

const PRESET_ICONS = [
 { name: 'Sparkles', icon: Sparkles },
 { name: 'Cpu', icon: Cpu },
 { name: 'Code2', icon: Code2 },
 { name: 'Compass', icon: Compass },
 { name: 'MousePointerClick', icon: MousePointerClick },
 { name: 'Wind', icon: Wind },
 { name: 'Layers', icon: Layers },
 { name: 'MessageSquareText', icon: MessageSquareText },
 { name: 'Binary', icon: Binary },
 { name: 'Terminal', icon: Terminal },
 { name: 'Brain', icon: Brain },
 { name: 'Zap', icon: Zap },
 { name: 'Shield', icon: Shield },
 { name: 'Key', icon: Key },
];

const PRESET_COLORS = [
 { name: 'Emerald', value: '#10B981' },
 { name: 'Amber', value: '#F59E0B' },
 { name: 'Indigo', value: '#6366F1' },
 { name: 'Pink', value: '#EC4899' },
 { name: 'Blue', value: '#3B82F6' },
 { name: 'Cyan', value: '#06B6D4' },
 { name: 'Violet', value: '#8B5CF6' },
 { name: 'Teal', value: '#14B8A6' },
 { name: 'Red', value: '#EF4444' },
 { name: 'Rose', value: '#F43F5E' },
];

export const ServicesView: React.FC = () => {
 const { services, emailServices, addService, updateService, deleteService } = useApp();

 const [searchQuery, setSearchQuery] = useState('');
 
 // Modal states
 const [isOpen, setIsOpen] = useState(false);
 const [editingService, setEditingService] = useState<Service | null>(null);
 const [serviceName, setServiceName] = useState('');
 const [selectedIcon, setSelectedIcon] = useState('Cpu');
 const [selectedColor, setSelectedColor] = useState('#6366F1');
 const [customColor, setCustomColor] = useState('#6366F1');
 const [useCustomColor, setUseCustomColor] = useState(false);

 // Cooldown policy state
 const [cooldownValue, setCooldownValue] = useState<number>(3);
 const [cooldownUnit, setCooldownUnit] = useState<CooldownUnit>('hours');
 const [autoStartCooldown, setAutoStartCooldown] = useState(true);
 const [autoResetStatus, setAutoResetStatus] = useState(true);
 const [allowOverride, setAllowOverride] = useState(true);
 
 const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

 const handleOpenAdd = () => {
 setEditingService(null);
 setServiceName('');
 setSelectedIcon('Cpu');
 setSelectedColor('#6366F1');
 setUseCustomColor(false);
 setCooldownValue(3);
 setCooldownUnit('hours');
 setAutoStartCooldown(true);
 setAutoResetStatus(true);
 setAllowOverride(true);
 setIsOpen(true);
 };

 const handleOpenEdit = (service: Service) => {
 setEditingService(service);
 setServiceName(service.name);
 setSelectedIcon(service.icon);
 
 const isPreset = PRESET_COLORS.some(c => c.value.toLowerCase() === service.color.toLowerCase());
 if (isPreset) {
 setSelectedColor(service.color);
 setUseCustomColor(false);
 } else {
 setCustomColor(service.color);
 setUseCustomColor(true);
 }
 
 setIsOpen(true);

 // Load cooldown policy
 setCooldownValue(service.defaultCooldownValue ?? 3);
 setCooldownUnit(service.defaultCooldownUnit ?? 'hours');
 setAutoStartCooldown(service.autoStartCooldown ?? true);
 setAutoResetStatus(service.autoResetStatus ?? true);
 setAllowOverride(service.allowOverride ?? true);
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!serviceName) return;

 const finalColor = useCustomColor ? customColor : selectedColor;
 const policy = {
 defaultCooldownValue: cooldownValue,
 defaultCooldownUnit: cooldownUnit,
 autoStartCooldown,
 autoResetStatus,
 allowOverride,
 };

 if (editingService) {
 updateService(editingService.id, serviceName, selectedIcon, finalColor, policy);
 } else {
 addService(serviceName, selectedIcon, finalColor, policy);
 }
 setIsOpen(false);
 };

 const handleDelete = (id: string) => {
 deleteService(id);
 setDeleteConfirmId(null);
 };

 // Filter services
 const filteredServices = services.filter(service => 
 service.name.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <div className="space-y-8 pb-12">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold font-heading theme-text-primary tracking-tight">AI Services</h2>
 <p className="text-sm theme-text-secondary">Configure developer environments and API resource mappings.</p>
 </div>
 <button
 onClick={handleOpenAdd}
 className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white theme-shadow-lg shadow-blue-500/20 transition-all duration-200 cursor-pointer self-start sm:self-auto"
 >
 <Plus size={16} />
 Add Service
 </button>
 </div>

 {/* Filters & Search */}
 <div className="p-4 rounded-2xl theme-bg-surface-alt border theme-border-subtle flex gap-4 items-center justify-between">
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
 <input
 type="text"
 placeholder="Search services by name..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full theme-bg-surface-alt border theme-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm theme-text-primary placeholder:theme-text-secondary dark:placeholder:theme-text-secondary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-body"
 />
 </div>
 </div>

 {/* Grid */}
 {filteredServices.length === 0 ? (
 <div className="p-12 text-center rounded-2xl theme-bg-surface-alt border theme-border-subtle flex flex-col items-center justify-center gap-3">
 <Info size={36} className="theme-text-muted" />
 <h4 className="theme-text-secondary font-semibold font-heading">No services found</h4>
 <p className="text-xs theme-text-muted max-w-sm">No AI services match your search query. Add a new service to start tracking your quotas.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredServices.map((service) => {
 const serviceRelations = emailServices.filter(es => es.serviceId === service.id);
 const total = serviceRelations.length;
 const available = serviceRelations.filter(es => es.status === 'Available').length;
 const cooling = serviceRelations.filter(es => es.status === 'Cooling Down').length;
 const limited = serviceRelations.filter(es => es.status === 'Limit Reached').length;

 return (
 <motion.div
 key={service.id}
 layout
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 className="theme-bg-surface-alt border theme-border-subtle rounded-2xl p-6 flex flex-col justify-between hover:theme-border-secondary hover:theme-bg-surface-alt transition-all duration-300 group theme-shadow-md"
 >
 <div>
 {/* Service Header Info */}
 <div className="flex items-start justify-between gap-4 mb-5">
 <div className="flex items-center gap-3.5">
 <div 
 style={{ backgroundColor: `${service.color}15`, color: service.color, borderColor: `${service.color}25` }}
 className="p-3.5 rounded-xl border flex items-center justify-center shrink-0"
 >
 <ServiceIcon name={service.icon} size={22} />
 </div>
 <div>
 <h3 className="font-bold theme-text-primary group-hover:text-white transition">{service.name}</h3>
 <span className="text-[10px] theme-text-muted font-semibold theme-bg-surface-alt px-2 py-0.5 rounded border theme-border">
 {service.isCustom ? 'Custom' : 'Standard'}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
 <button
 onClick={() => handleOpenEdit(service)}
 className="p-1.5 rounded-lg theme-text-secondary hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/10 transition cursor-pointer"
 title="Edit service details"
 >
 <Edit2 size={13} />
 </button>
 {service.isCustom && (
 <button
 onClick={() => setDeleteConfirmId(service.id)}
 className="p-1.5 rounded-lg theme-text-secondary hover:text-rose-450 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 transition cursor-pointer"
 title="Delete service"
 >
 <Trash2 size={13} />
 </button>
 )}
 </div>
 </div>

 {/* Quotas & pools info */}
 <div className="space-y-3 theme-bg-surface-alt p-4 rounded-xl border theme-border mb-4">
 <div className="flex justify-between items-center text-xs font-semibold">
 <span className="theme-text-muted">Credential Pools</span>
 <span className="theme-text-secondary">{total} Accounts</span>
 </div>

 {total > 0 ? (
 <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
 <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-1.5">
 <p className="text-emerald-400 text-xs">{available}</p>
 <p className="theme-text-muted text-[8px] uppercase tracking-wider mt-0.5">Available</p>
 </div>
 <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-1.5">
 <p className="text-amber-400 text-xs">{cooling}</p>
 <p className="theme-text-muted text-[8px] uppercase tracking-wider mt-0.5">Cooling</p>
 </div>
 <div className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-1.5">
 <p className="text-rose-400 text-xs">{limited}</p>
 <p className="theme-text-muted text-[8px] uppercase tracking-wider mt-0.5">Limited</p>
 </div>
 </div>
 ) : (
 <div className="text-[10px] theme-text-muted font-semibold py-2 text-center">
 No email accounts mapping configured
 </div>
 )}
 </div>

 {/* Cooldown Policy Badge */}
 {service.defaultCooldownValue && service.defaultCooldownUnit && (
 <div className="flex items-center gap-2 theme-bg-surface-alt p-3 rounded-xl border theme-border">
 <div className="flex items-center gap-1.5 text-[10px] font-bold theme-text-secondary">
 <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 <span>Cooldown:</span>
 <span className="theme-text-primary">{service.defaultCooldownValue} {service.defaultCooldownUnit}</span>
 </div>
 <div className="flex items-center gap-1.5 ml-auto">
 {service.autoStartCooldown && (
 <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Auto-Start</span>
 )}
 {service.autoResetStatus && (
 <span className="text-[8px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">Auto-Reset</span>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Delete Confirm Overlay */}
 <AnimatePresence>
 {deleteConfirmId === service.id && (
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="absolute inset-0 theme-bg-overlay backdrop-blur-sm rounded-2xl p-6 flex flex-col justify-center items-center text-center z-10"
 >
 <Info className="text-rose-400 mb-2" size={28} />
 <h4 className="font-bold theme-text-primary text-sm">Delete Service?</h4>
 <p className="text-xs theme-text-secondary mt-1 max-w-[220px] mb-4">
 Wipe &quot;{service.name}&quot;? This removes all active limits/credentials for this service.
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => setDeleteConfirmId(null)}
 className="px-3.5 py-1.5 theme-bg-secondary border theme-border theme-bg-hover rounded-lg text-[10px] font-bold theme-text-secondary transition cursor-pointer"
 >
 Cancel
 </button>
 <button
 onClick={() => handleDelete(service.id)}
 className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-550 rounded-lg text-[10px] font-bold text-white transition cursor-pointer"
 >
 Delete
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
 })}
 </div>
 )}

 {/* Add/Edit Modal */}
 <AnimatePresence>
 {isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 {/* Backdrop */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setIsOpen(false)}
 className="absolute inset-0 theme-bg-overlay backdrop-blur-sm"
 />

 {/* Modal Body */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 className="relative w-full max-w-lg theme-bg-secondary border theme-border rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
 >
 <div className="flex justify-between items-center border-b theme-border pb-3 mb-5">
 <h3 className="text-lg font-bold theme-text-primary">
 {editingService ? 'Edit AI Service' : 'Add Custom AI Service'}
 </h3>
 <button
 onClick={() => setIsOpen(false)}
 className="p-1.5 rounded-lg theme-text-muted theme-text-primary theme-bg-hover transition cursor-pointer"
 >
 <X size={18} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 {/* Service Name */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold theme-text-secondary uppercase tracking-wider">Service Name</label>
 <input
 type="text"
 required
 placeholder="e.g. DeepSeek-R1, Gemini 2.0"
 value={serviceName}
 onChange={(e) => setServiceName(e.target.value)}
 className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2.5 text-sm theme-text-primary focus:outline-none focus:border-blue-500 transition font-body"
 />
 </div>

 {/* Icon Picker */}
 <div className="space-y-1.5">
 <label className="text-xs font-bold theme-text-secondary uppercase tracking-wider">Service Icon</label>
 <div className="grid grid-cols-7 gap-2 theme-bg-primary p-3 rounded-xl border theme-border">
 {PRESET_ICONS.map((item) => {
 const IconComponent = item.icon;
 return (
 <button
 key={item.name}
 type="button"
 onClick={() => setSelectedIcon(item.name)}
 className={`p-2.5 rounded-lg flex items-center justify-center transition border cursor-pointer ${
 selectedIcon === item.name 
 ? 'bg-blue-600 border-blue-500 text-white theme-shadow-md' 
 : 'theme-bg-secondary theme-border theme-text-secondary theme-text-primary hover:theme-border-secondary'
 }`}
 title={item.name}
 >
 <IconComponent size={16} />
 </button>
 );
 })}
 </div>
 </div>

 {/* Color Picker */}
 <div className="space-y-1.5">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold theme-text-secondary uppercase tracking-wider">Service Color Theme</label>
 <button
 type="button"
 onClick={() => setUseCustomColor(!useCustomColor)}
 className="text-[10px] font-bold text-blue-400 hover:underline"
 >
 {useCustomColor ? 'Use presets' : 'Use custom hex'}
 </button>
 </div>

 {!useCustomColor ? (
 <div className="flex flex-wrap gap-2.5 theme-bg-primary p-3 rounded-xl border theme-border">
 {PRESET_COLORS.map((col) => (
 <button
 key={col.value}
 type="button"
 onClick={() => setSelectedColor(col.value)}
 style={{ backgroundColor: col.value }}
 className={`w-7 h-7 rounded-full transition flex items-center justify-center shrink-0 border-2 cursor-pointer ${
 selectedColor.toLowerCase() === col.value.toLowerCase()
 ? 'border-white scale-110 theme-shadow-lg shadow-white/10'
 : 'theme-border scale-100 hover:scale-105'
 }`}
 title={col.name}
 >
 {selectedColor.toLowerCase() === col.value.toLowerCase() && (
 <Check size={12} className="theme-text-secondary font-bold bg-white rounded-full p-0.5" />
 )}
 </button>
 ))}
 </div>
 ) : (
 <div className="flex items-center gap-3 theme-bg-primary p-3 rounded-xl border theme-border">
 <input
 type="color"
 value={customColor}
 onChange={(e) => setCustomColor(e.target.value)}
 className="w-10 h-10 bg-transparent rounded cursor-pointer border-0"
 />
 <input
 type="text"
 value={customColor}
 onChange={(e) => setCustomColor(e.target.value)}
 placeholder="#HEXCODE"
 className="theme-bg-secondary border theme-border rounded-lg px-3 py-1.5 text-xs theme-text-primary font-mono focus:outline-none focus:border-blue-500 transition"
 />
 <div 
 style={{ backgroundColor: customColor }}
 className="w-6 h-6 rounded-full border theme-border shrink-0" 
 />
 </div>
 )}
 </div>

 {/* ── COOLDOWN POLICY SECTION ── */}
 <div className="space-y-3 border-t theme-border pt-5">
 <div className="flex items-center gap-2 mb-1">
 <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 <label className="text-xs font-bold theme-text-secondary uppercase tracking-wider">Default Cooldown Policy</label>
 </div>
 <p className="text-[11px] theme-text-muted -mt-1">Defines the default cooldown/reset duration when accounts hit their limit on this service.</p>

 {/* Duration Row */}
 <div className="flex items-center gap-3 theme-bg-primary p-3 rounded-xl border theme-border">
 <div className="flex-1">
 <label className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block mb-1">Duration</label>
 <input
 type="number"
 min={1}
 max={999}
 value={cooldownValue}
 onChange={(e) => setCooldownValue(Math.max(1, parseInt(e.target.value) || 1))}
 className="w-full theme-bg-secondary border theme-border-secondary rounded-lg px-3 py-2 text-sm theme-text-primary font-mono focus:outline-none focus:border-blue-500 transition"
 />
 </div>
 <div className="flex-1">
 <label className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block mb-1">Unit</label>
 <select
 value={cooldownUnit}
 onChange={(e) => setCooldownUnit(e.target.value as CooldownUnit)}
 className="w-full theme-bg-secondary border theme-border-secondary rounded-lg px-3 py-2 text-sm theme-text-primary focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer"
 >
 <option value="minutes">Minutes</option>
 <option value="hours">Hours</option>
 <option value="days">Days</option>
 <option value="weeks">Weeks</option>
 </select>
 </div>
 </div>

 {/* Preview badge */}
 <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
 <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 <span className="text-[11px] text-blue-300">
 Default cooldown: <strong className="text-blue-200">{cooldownValue} {cooldownUnit}</strong>
 {cooldownUnit === 'minutes' && ` (${cooldownValue}m)`}
 {cooldownUnit === 'hours' && ` (${cooldownValue * 60}m)`}
 {cooldownUnit === 'days' && ` (${cooldownValue * 24}h)`}
 {cooldownUnit === 'weeks' && ` (${cooldownValue * 7}d)`}
 </span>
 </div>

 {/* Toggle Switches */}
 <div className="space-y-2">
 {/* Auto Start Cooldown */}
 <label className="flex items-center justify-between theme-bg-primary border theme-border rounded-xl px-4 py-3 cursor-pointer group hover:theme-border-secondary transition">
 <div className="flex-1">
 <span className="text-xs font-bold theme-text-primary block">Auto-Start Cooldown</span>
 <span className="text-[10px] theme-text-muted">Automatically start cooldown when account is marked as &quot;Limit Reached&quot;</span>
 </div>
 <div className="relative ml-3">
 <input
 type="checkbox"
 checked={autoStartCooldown}
 onChange={(e) => setAutoStartCooldown(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-9 h-5 theme-bg-tertiary dark:theme-bg-tertiary rounded-full peer-checked:bg-emerald-500 transition-colors duration-200"></div>
 <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
 </div>
 </label>

 {/* Auto Reset Status */}
 <label className="flex items-center justify-between theme-bg-primary border theme-border rounded-xl px-4 py-3 cursor-pointer group hover:theme-border-secondary transition">
 <div className="flex-1">
 <span className="text-xs font-bold theme-text-primary block">Auto-Reset Status</span>
 <span className="text-[10px] theme-text-muted">Automatically set status back to &quot;Available&quot; when the countdown expires</span>
 </div>
 <div className="relative ml-3">
 <input
 type="checkbox"
 checked={autoResetStatus}
 onChange={(e) => setAutoResetStatus(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-9 h-5 theme-bg-tertiary dark:theme-bg-tertiary rounded-full peer-checked:bg-emerald-500 transition-colors duration-200"></div>
 <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
 </div>
 </label>

 {/* Allow Override */}
 <label className="flex items-center justify-between theme-bg-primary border theme-border rounded-xl px-4 py-3 cursor-pointer group hover:theme-border-secondary transition">
 <div className="flex-1">
 <span className="text-xs font-bold theme-text-primary block">Allow Per-Account Override</span>
 <span className="text-[10px] theme-text-muted">Enable individual accounts to define custom cooldown durations for this service</span>
 </div>
 <div className="relative ml-3">
 <input
 type="checkbox"
 checked={allowOverride}
 onChange={(e) => setAllowOverride(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-9 h-5 theme-bg-tertiary dark:theme-bg-tertiary rounded-full peer-checked:bg-emerald-500 transition-colors duration-200"></div>
 <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform duration-200"></div>
 </div>
 </label>
 </div>
 </div>

 {/* Form Actions */}
 <div className="flex justify-end gap-2 pt-3 border-t theme-border">
 <button
 type="button"
 onClick={() => setIsOpen(false)}
 className="px-4 py-2 theme-bg-secondary theme-bg-hover border theme-border rounded-xl text-xs font-bold theme-text-secondary transition cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white theme-shadow-lg shadow-blue-500/20 transition cursor-pointer"
 >
 {editingService ? 'Save Changes' : 'Create Service'}
 </button>
 </div>
 </form>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </div>
 );
};
