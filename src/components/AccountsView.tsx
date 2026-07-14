import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Mail,
  Info,
  AlertCircle,
  BarChart3,
  Check,
  Zap,
  ArrowUpDown,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { ProviderType, Email, StatusType } from '../types';
import { ServiceIcon } from './ServiceIcon';

type AccountSort = 'alphabetical' | 'most-used' | 'least-used' | 'recently-used' | 'recently-added';
type AccountStatusFilter = StatusType | 'All';

const providerList: ProviderType[] = ['Gmail', 'Outlook', 'Proton', 'Yahoo', 'Custom'];
const statusList: StatusType[] = ['Available', 'Cooling Down', 'Limit Reached', 'Resetting Soon', 'Unknown'];
const sortOptions: Array<{ value: AccountSort; label: string }> = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'most-used', label: 'Most Used' },
  { value: 'least-used', label: 'Least Used' },
  { value: 'recently-used', label: 'Recently Used' },
  { value: 'recently-added', label: 'Recently Added' },
];

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

const chipUnselected = 'theme-bg-surface-alt theme-border-subtle theme-text-secondary hover:theme-border-subtle';

const statusDotColor: Record<StatusType, string> = {
  'Available': 'bg-emerald-400',
  'Cooling Down': 'bg-amber-400',
  'Limit Reached': 'bg-rose-400',
  'Resetting Soon': 'bg-sky-400',
  'Unknown': 'theme-bg-tertiary',
};

const statusAccent: Record<StatusType, string> = {
  'Available': 'emerald',
  'Cooling Down': 'amber',
  'Limit Reached': 'rose',
  'Resetting Soon': 'sky',
  'Unknown': 'slate',
};

export const AccountsView: React.FC = () => {
  const { emails, emailServices, services, history, addEmail, updateEmail, deleteEmail } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<AccountStatusFilter>('All');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<AccountSort>('alphabetical');

  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<Email | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [nickname, setNickname] = useState('');
  const [provider, setProvider] = useState<ProviderType>('Gmail');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingEmail(null);
    setEmailAddress('');
    setNickname('');
    setProvider('Gmail');
    setFormError(null);
    // Default: nothing selected
    setSelectedServiceIds([]);
    setIsOpen(true);
  };

  const handleOpenEdit = (email: Email) => {
    setEditingEmail(email);
    setEmailAddress(email.email);
    setNickname(email.nickname);
    setProvider(email.provider);
    setFormError(null);
    // Pre-select services this account already uses
    const currentIds = emailServices
      .filter((es) => es.emailId === email.id)
      .map((es) => es.serviceId);
    setSelectedServiceIds(currentIds);
    setIsOpen(true);
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSelectAll = () => {
    setSelectedServiceIds(services.map((s) => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedServiceIds([]);
  };

  const getDuplicateEmailError = (value: string): string | null => {
    if (!value.includes('@')) return null;
    const normalizedEmail = value.trim().toLowerCase();
    const duplicate = emails.find((email) =>
      email.id !== editingEmail?.id &&
      email.email.trim().toLowerCase() === normalizedEmail
    );
    return duplicate ? 'This email already exists.' : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!emailAddress || !nickname) return;

    const duplicateError = getDuplicateEmailError(emailAddress);
    if (duplicateError) {
      setFormError(duplicateError);
      return;
    }

    try {
      if (editingEmail) {
        await updateEmail(editingEmail.id, emailAddress, nickname, provider, selectedServiceIds);
      } else {
        await addEmail(emailAddress, nickname, provider, selectedServiceIds);
      }
      setIsOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save email account.');
    }
  };

  const handleDelete = (id: string) => {
    deleteEmail(id);
    setDeleteConfirmId(null);
  };

  const sortedEmails = useMemo(() => {
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

    const alphabetical = (a: Email, b: Email) =>
      (a.nickname || a.email).localeCompare(b.nickname || b.email, undefined, { sensitivity: 'base', numeric: true }) ||
      a.email.localeCompare(b.email, undefined, { sensitivity: 'base', numeric: true });

    return emails
      .filter((email) => {
        const matchesSearch =
          email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.nickname.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProvider = selectedProvider === 'All' || email.provider === selectedProvider;
        const matchesService =
          selectedServiceFilter === 'All' ||
          emailServices.some((relation) => relation.emailId === email.id && relation.serviceId === selectedServiceFilter);
        const matchesStatus =
          selectedStatus === 'All' ||
          emailServices.some((relation) => relation.emailId === email.id && relation.status === selectedStatus);
        return matchesSearch && matchesProvider && matchesService && matchesStatus;
      })
      .sort((a, b) => {
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

  const getProviderBg = (prov: ProviderType) => {
    switch (prov) {
      case 'Gmail':   return 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-400';
      case 'Outlook': return 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-400';
      case 'Proton':  return 'from-purple-500/10 to-violet-500/10 border-purple-500/20 text-purple-400';
      case 'Yahoo':   return 'from-fuchsia-500/10 to-pink-500/10 border-fuchsia-500/20 text-fuchsia-400';
      default:        return 'theme-bg-surface-alt theme-border-subtle theme-text-secondary';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading theme-text-primary tracking-tight">Email Accounts</h2>
          <p className="text-sm theme-text-secondary">Manage your rotating email accounts and credential pools.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white theme-shadow-lg shadow-blue-500/20 transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3 p-4 rounded-2xl theme-bg-surface-alt border theme-border-subtle">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full theme-bg-surface-alt border theme-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm theme-text-primary placeholder:theme-text-muted focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-body"
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
              {providerList.map((providerName) => (
                <option key={providerName} value={providerName} className="theme-bg-primary theme-text-secondary">
                  {providerName}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-secondary pointer-events-none" />
          </label>
        </div>

        <div className="border-t theme-border-subtle" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => setSelectedServiceFilter('All')}
            className={`${chipBase} ${selectedServiceFilter === 'All' ? chipSelectedStyle.blue : chipUnselected}`}
          >
            <Layers size={13} />
            <span>All Services</span>
          </motion.button>
          {services.map((service) => (
            <motion.button
              key={service.id}
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => setSelectedServiceFilter(service.id)}
              className={`${chipBase} ${selectedServiceFilter === service.id ? chipSelectedStyle.blue : chipUnselected}`}
            >
              <ServiceIcon name={service.icon} size={13} />
              <span>{service.name}</span>
            </motion.button>
          ))}
        </div>

        <div className="border-t theme-border-subtle" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => setSelectedStatus('All')}
            className={`${chipBase} ${selectedStatus === 'All' ? chipSelectedStyle.blue : chipUnselected}`}
          >
            <BarChart3 size={13} />
            <span>All Status</span>
          </motion.button>
          {statusList.map((status) => (
            <motion.button
              key={status}
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => setSelectedStatus(status)}
              className={`${chipBase} ${selectedStatus === status ? chipSelectedStyle[statusAccent[status]] : chipUnselected}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusDotColor[status]}`} />
              <span>{status}</span>
            </motion.button>
          ))}
        </div>

        <div className="border-t theme-border-subtle" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar chip-scroll pb-0.5">
          {sortOptions.map((option) => (
            <motion.button
              key={option.value}
              type="button"
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

      {/* Grid */}
      {sortedEmails.length === 0 ? (
        <div className="p-12 text-center rounded-2xl theme-bg-surface-alt border theme-border-subtle flex flex-col items-center justify-center gap-3">
          <Info size={36} className="theme-text-muted" />
          <h4 className="theme-text-secondary font-semibold font-heading">No accounts found</h4>
          <p className="text-xs theme-text-muted max-w-sm">No email accounts match the filter criteria. Add a new account to expand the credentials pool.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedEmails.map((email) => {
            const accountRelations = emailServices.filter((es) => es.emailId === email.id);
            const coolingDown = accountRelations.filter((es) => es.status === 'Cooling Down' || es.status === 'Resetting Soon').length;
            const limited    = accountRelations.filter((es) => es.status === 'Limit Reached').length;
            const available  = accountRelations.filter((es) => es.status === 'Available').length;

            return (
              <motion.div
                key={email.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-2xl border bg-gradient-to-br ${getProviderBg(email.provider)} theme-bg-surface-alt theme-shadow-lg overflow-hidden flex flex-col hover:theme-border-secondary transition-all duration-300`}
              >
                {/* Header */}
                <div className="p-5 border-b theme-border-subtle flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full theme-bg-primary border theme-border theme-text-secondary">
                      {email.provider}
                    </span>
                    <h3 className="font-heading font-bold theme-text-primary text-base">{email.nickname}</h3>
                    <p className="text-xs theme-text-secondary font-mono font-medium truncate max-w-[200px]">{email.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(email)}
                      className="p-2 rounded-lg theme-bg-surface-alt border theme-border hover:theme-border-secondary theme-bg-hover theme-text-secondary transition cursor-pointer"
                      title="Edit Account"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(email.id)}
                      className="p-2 rounded-lg theme-bg-surface-alt border theme-border hover:border-rose-500/30 hover:bg-rose-500/10 theme-text-secondary hover:text-rose-400 transition cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="text-[10px] theme-text-muted font-semibold uppercase tracking-wider">Service Stats</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl theme-bg-surface-alt border theme-border text-center">
                      <div className="text-xs font-bold text-emerald-400">{available}</div>
                      <div className="text-[9px] theme-text-muted font-medium mt-0.5">Ready</div>
                    </div>
                    <div className="p-3 rounded-xl theme-bg-surface-alt border theme-border text-center">
                      <div className="text-xs font-bold text-amber-400">{coolingDown}</div>
                      <div className="text-[9px] theme-text-muted font-medium mt-0.5">Cooling</div>
                    </div>
                    <div className="p-3 rounded-xl theme-bg-surface-alt border theme-border text-center">
                      <div className="text-xs font-bold text-rose-400">{limited}</div>
                      <div className="text-[9px] theme-text-muted font-medium mt-0.5">Blocked</div>
                    </div>
                  </div>

                  {/* Connected services */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] theme-text-muted font-semibold uppercase tracking-wider">Configured APIs</div>
                    {accountRelations.length === 0 ? (
                      <p className="text-[10px] theme-text-muted italic">No services linked — edit to add some.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {services.map((s) => {
                          const rel = accountRelations.find((r) => r.serviceId === s.id);
                          if (!rel) return null;
                          let colorClass = 'theme-bg-surface-alt theme-text-secondary theme-border';
                          if (rel.status === 'Available')     colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                          if (rel.status === 'Cooling Down')  colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                          if (rel.status === 'Resetting Soon') colorClass = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                          if (rel.status === 'Limit Reached') colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                          return (
                            <span key={s.id} className={`text-[9px] font-bold px-2 py-0.5 rounded border ${colorClass}`}>
                              {s.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 theme-bg-overlay backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl theme-bg-secondary border theme-border shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle size={24} />
                <h3 className="font-heading font-bold text-lg theme-text-primary">Delete Account?</h3>
              </div>
              <p className="text-sm theme-text-secondary leading-relaxed">
                Are you sure you want to delete this email account? This action will permanently remove it and all associated service credentials from the tracking pool.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl theme-bg-tertiary hover:theme-bg-hover text-xs font-semibold theme-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white theme-shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 theme-bg-overlay backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl theme-bg-secondary border theme-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b theme-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                    <Mail size={20} />
                  </div>
                  <h3 className="font-heading font-bold theme-text-primary text-base">
                    {editingEmail ? 'Edit Email Account' : 'Add Email Account'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg theme-text-muted hover:theme-text-secondary theme-bg-hover transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form (scrollable body) */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 space-y-5 text-sm theme-text-secondary overflow-y-auto flex-1">
                  {/* Nickname */}
                  <div className="space-y-1.5">
                    <label className="text-xs theme-text-secondary font-semibold uppercase tracking-wider">Account Nickname</label>
                    <input
                      type="text"
                      required
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. Personal Gmail, OpenAI Agent"
                      className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2.5 text-sm theme-text-primary placeholder:theme-text-muted focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
                    />
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs theme-text-secondary font-semibold uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      required
                      value={emailAddress}
                      onChange={(e) => {
                        const nextEmail = e.target.value;
                        setEmailAddress(nextEmail);
                        setFormError(getDuplicateEmailError(nextEmail));
                      }}
                      placeholder="username@domain.com"
                      className={`w-full theme-bg-primary border rounded-xl px-4 py-2.5 text-sm theme-text-primary placeholder:theme-text-muted focus:outline-none focus:ring-1 transition ${
                        formError
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                          : 'theme-border focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                    />
                    {formError && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                        <AlertCircle size={13} />
                        {formError}
                      </p>
                    )}
                  </div>

                  {/* Provider */}
                  <div className="space-y-1.5">
                    <label className="text-xs theme-text-secondary font-semibold uppercase tracking-wider">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as ProviderType)}
                      className="w-full theme-bg-primary border theme-border rounded-xl px-4 py-2.5 text-sm theme-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition cursor-pointer"
                    >
                      <option value="Gmail">Gmail</option>
                      <option value="Outlook">Outlook</option>
                      <option value="Proton">Proton</option>
                      <option value="Yahoo">Yahoo</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  {/* Service Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-blue-400" />
                        <label className="text-xs theme-text-secondary font-semibold uppercase tracking-wider">
                          Linked AI Services
                        </label>
                      </div>
                      <span className="text-[10px] theme-text-muted">
                        {selectedServiceIds.length}/{services.length} selected
                      </span>
                    </div>

                    {/* Select All checkbox */}
                    {services.length > 0 && (
                      <button
                        type="button"
                        onClick={selectedServiceIds.length === services.length ? handleDeselectAll : handleSelectAll}
                        className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          selectedServiceIds.length === services.length
                            ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                            : 'theme-bg-surface-alt theme-border theme-text-secondary hover:theme-border-secondary'
                        }`}
                      >
                        <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all ${
                          selectedServiceIds.length === services.length
                            ? 'bg-blue-600 border-blue-600'
                            : selectedServiceIds.length > 0
                              ? 'bg-blue-600/40 border-blue-500'
                              : 'theme-bg-primary theme-border'
                        }`}>
                          {selectedServiceIds.length === services.length && (
                            <Check size={11} className="text-white" strokeWidth={3} />
                          )}
                          {selectedServiceIds.length > 0 && selectedServiceIds.length < services.length && (
                            <span className="w-2 h-0.5 bg-white rounded-full block" />
                          )}
                        </div>
                        <span className="text-xs font-bold">
                          {selectedServiceIds.length === services.length ? 'Deselect All' : 'Select All'}
                        </span>
                      </button>
                    )}

                    {services.length === 0 ? (
                      <div className="p-4 rounded-xl theme-bg-surface-alt border theme-border-subtle text-center">
                        <p className="text-xs theme-text-muted">
                          No AI services configured yet.{' '}
                          <span className="theme-text-secondary font-semibold">Go to AI Services to add some.</span>
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {services.map((service) => {
                          const isSelected = selectedServiceIds.includes(service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => toggleService(service.id)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                                  : 'theme-bg-surface-alt theme-border theme-text-secondary hover:theme-border-secondary'
                              }`}
                            >
                              <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'theme-bg-primary theme-border'
                              }`}>
                                {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                              <ServiceIcon name={service.icon} size={14} className="shrink-0 opacity-80" />
                              <span className="text-xs font-semibold truncate">{service.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t theme-border theme-bg-surface-alt flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-5 py-2.5 theme-bg-tertiary hover:theme-bg-hover text-xs font-semibold theme-text-secondary rounded-xl cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl theme-shadow-lg shadow-blue-500/20 transition cursor-pointer"
                  >
                    {editingEmail ? 'Save Changes' : 'Add Account'}
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
