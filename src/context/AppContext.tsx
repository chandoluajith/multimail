import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Email, Service, EmailService, UsageHistory, AppSettings, StatusType, ProviderType, CooldownUnit } from '../types';
import { DEFAULT_SERVICES, DEFAULT_SETTINGS, MOCK_EMAILS, MOCK_EMAIL_SERVICES, MOCK_HISTORY } from '../mockData';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

type DbStatus = 'checking' | 'connected' | 'error';
type AppData = Awaited<ReturnType<typeof api.getAllData>>;

interface AppContextType {
  emails: Email[];
  services: Service[];
  emailServices: EmailService[];
  history: UsageHistory[];
  settings: AppSettings;
  isLoading: boolean;
  dbStatus: DbStatus;
  syncError: string | null;
  serverNow?: string;
  addEmail: (email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => Promise<void>;
  deleteEmail: (id: string) => Promise<void>;
  updateEmail: (id: string, email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => Promise<void>;
  addService: (name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  updateService: (id: string, name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => Promise<void>;
  updateStatus: (
    emailId: string,
    serviceId: string,
    status: StatusType,
    cooldownMinutes?: number,
    remainingRequests?: number,
    maximumRequests?: number,
    notes?: string,
    overrideResetTime?: string
  ) => Promise<void>;
  startSession: (emailId: string, serviceId: string) => Promise<void>;
  endSession: (emailId: string, serviceId: string, notes?: string) => Promise<void>;
  reachLimit: (emailId: string, serviceId: string, cooldownMinutes?: number, notes?: string) => Promise<void>;
  resetTimer: (emailId: string, serviceId: string) => Promise<void>;
  loadMockData: () => Promise<void>;
  clearDatabase: () => Promise<void>;
  clearHistory: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  exportData: () => string;
  importData: (jsonData: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthLoading } = useAuth();
  const { setTheme } = useTheme();
  const [emails, setEmails] = useState<Email[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [emailServices, setEmailServices] = useState<EmailService[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<string | undefined>(undefined);

  const applyServerData = useCallback((data: AppData) => {
    const serverSettings = data.settings ?? DEFAULT_SETTINGS;
    setEmails(data.emails);
    setServices(data.services.length > 0 ? data.services : DEFAULT_SERVICES);
    setEmailServices(data.emailServices);
    setHistory(data.history);
    setSettings(serverSettings);
    setServerNow(data.serverNow);
    setTheme(serverSettings.theme);
  }, [setTheme]);

  const resetClientData = useCallback(() => {
    setEmails([]);
    setServices([]);
    setEmailServices([]);
    setHistory([]);
    setSettings(DEFAULT_SETTINGS);
    setServerNow(undefined);
    setTheme(DEFAULT_SETTINGS.theme);
    setSyncError(null);
  }, [setTheme]);

  const refreshFromServer = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getAllData();
      applyServerData(data);
      setDbStatus('connected');
      setSyncError(null);
    } catch (error) {
      setDbStatus('error');
      setSyncError(error instanceof Error ? error.message : 'Database sync failed');
      throw error;
    }
  }, [applyServerData, user]);

  const reportSyncFailure = useCallback((fallbackMessage: string, error: unknown) => {
    console.error(fallbackMessage, error);
    setDbStatus('error');
    setSyncError(error instanceof Error ? error.message : fallbackMessage);
  }, []);

  // ── Sound effects ─────────────────────────────────────────────────────────
  const playSound = useCallback((type: 'complete' | 'limit') => {
    if (typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      if (type === 'complete') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  }, []);

  // ── Request notification permission ──────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') Notification.requestPermission();
    }
  }, []);

  // ── Load initial data from D1 API ─────────────────────────────────────────
  // NOTE: We intentionally do NOT cache sensitive data (email addresses) in
  // local browser storage. Doing so would bypass AES-256-GCM encryption on the
  // server and expose plaintext addresses to any script running on the page.
  // The D1 database is the single source of truth.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isAuthLoading) return;

      if (!user) {
        resetClientData();
        setDbStatus('checking');
        setIsLoading(false);
        setMounted(false);
        return;
      }

      setIsLoading(true);
      setMounted(false);
      setDbStatus('checking');
      setSyncError(null);

      try {
        const data = await api.getAllData();
        if (cancelled) return;
        applyServerData(data);
        setDbStatus('connected');
      } catch (err) {
        if (cancelled) return;
        // Surface the error to the UI — do NOT silently fall back to stale or
        // mock data, as that could show one user another's placeholder records.
        console.error('[AppContext] Failed to load data from API:', err);
        setDbStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Database sync failed');
      } finally {
        if (cancelled) return;
        setIsLoading(false);
        setMounted(Boolean(user));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [applyServerData, isAuthLoading, resetClientData, user]);

  // ── Server-truth cooldown refreshes ───────────────────────────────────────
  // The database remains authoritative. These browser events only decide when
  // to re-fetch canonical state after inactivity, reconnection, or tab focus.
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const refresh = () => {
      refreshFromServer().catch((error) => reportSyncFailure('Database sync failed', error));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [mounted, refreshFromServer, reportSyncFailure]);

  useEffect(() => {
    if (!mounted) return;
    const nextReset = emailServices
      .filter((es) => es.estimatedResetTime && (es.status === 'Cooling Down' || es.status === 'Limit Reached'))
      .map((es) => Date.parse(es.estimatedResetTime!))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    if (!nextReset) return;

    const delay = Math.max(1000, nextReset - Date.now() + 1000);
    const timer = window.setTimeout(() => {
      refreshFromServer().catch((error) => reportSyncFailure('Database sync failed', error));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [emailServices, mounted, refreshFromServer, reportSyncFailure]);

  // ── Helper ────────────────────────────────────────────────────────────────
  const getServiceCooldownMinutes = (serviceId: string): number => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc?.defaultCooldownValue || !svc?.defaultCooldownUnit) return settings.defaultCooldownDuration * 60;
    const v = svc.defaultCooldownValue;
    switch (svc.defaultCooldownUnit) {
      case 'minutes': return v;
      case 'hours':   return v * 60;
      case 'days':    return v * 60 * 24;
      case 'weeks':   return v * 60 * 24 * 7;
      default:        return v * 60;
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const addEmail = async (email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => {
    const now = new Date().toISOString();
    const newEmail: Email = {
      id: `email_${Math.random().toString(36).substring(2, 11)}`,
      email, nickname, provider, createdAt: now, updatedAt: now,
    };
    const targetServices = serviceIds != null ? services.filter((s) => serviceIds.includes(s.id)) : services;
    const newRelations: EmailService[] = targetServices.map((s) => ({
      id: `${newEmail.id}_${s.id}`,
      emailId: newEmail.id,
      serviceId: s.id,
      status: settings.defaultStatus,
      createdAt: now,
      updatedAt: now,
    }));

    // Optimistic UI update
    setEmails((prev) => [...prev, newEmail]);
    setEmailServices((prev) => [...prev, ...newRelations]);

    try {
      await api.createEmail(newEmail);
      if (newRelations.length > 0) await api.saveEmailServices(newRelations);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to add email', error);
      await refreshFromServer();
      throw error;
    }
  };

  const deleteEmail = async (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setEmailServices((prev) => prev.filter((es) => es.emailId !== id));
    try {
      await api.deleteEmail(id);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to delete email', error);
      await refreshFromServer();
    }
  };

  const updateEmail = async (id: string, email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => {
    const now = new Date().toISOString();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, email, nickname, provider, updatedAt: now } : e)));

    if (serviceIds != null) {
      const currentRelations = emailServices.filter((es) => es.emailId === id);
      const desired = serviceIds.map((sid) => {
        const existing = currentRelations.find((es) => es.serviceId === sid);
        if (existing) return { ...existing, updatedAt: now };
        return { id: `${id}_${sid}`, emailId: id, serviceId: sid, status: settings.defaultStatus, createdAt: now, updatedAt: now };
      });
      const orphanSids = currentRelations.map((es) => es.serviceId).filter((sid) => !serviceIds.includes(sid));
      setEmailServices((prev) => [...prev.filter((es) => es.emailId !== id), ...desired]);

      try {
        await api.updateEmail(id, { email, nickname, provider, updatedAt: now });
        if (orphanSids.length > 0) await api.deleteOrphanEmailServices(id, orphanSids);
        await api.saveEmailServices(desired);
        await refreshFromServer();
      } catch (error) {
        reportSyncFailure('Failed to update email', error);
        await refreshFromServer();
        throw error;
      }
      return;
    }

    try {
      await api.updateEmail(id, { email, nickname, provider, updatedAt: now });
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to update email', error);
      await refreshFromServer();
      throw error;
    }
  };

  const addService = async (name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => {
    const now = new Date().toISOString();
    const newService: Service = {
      id: `srv_${Math.random().toString(36).substring(2, 11)}`,
      name, icon, color,
      isCustom: true,
      defaultCooldownValue: cooldownPolicy?.defaultCooldownValue ?? 3,
      defaultCooldownUnit: cooldownPolicy?.defaultCooldownUnit ?? 'hours',
      autoStartCooldown: cooldownPolicy?.autoStartCooldown ?? true,
      autoResetStatus: cooldownPolicy?.autoResetStatus ?? true,
      allowOverride: cooldownPolicy?.allowOverride ?? true,
    };
    const newRelations: EmailService[] = emails.map((e) => ({
      id: `${e.id}_${newService.id}`,
      emailId: e.id,
      serviceId: newService.id,
      status: settings.defaultStatus,
      createdAt: now,
      updatedAt: now,
    }));

    setServices((prev) => [...prev, newService]);
    setEmailServices((prev) => [...prev, ...newRelations]);

    try {
      await api.createService(newService);
      if (newRelations.length > 0) await api.saveEmailServices(newRelations);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to add service', error);
      await refreshFromServer();
    }
  };

  const deleteService = async (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    setEmailServices((prev) => prev.filter((es) => es.serviceId !== id));
    try {
      await api.deleteService(id);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to delete service', error);
      await refreshFromServer();
    }
  };

  const updateService = async (id: string, name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => {
    setServices((prev) => prev.map((s) => s.id === id ? {
      ...s, name, icon, color,
      ...(cooldownPolicy ? cooldownPolicy : {}),
    } : s));

    try {
      await api.updateService(id, { name, icon, color, ...cooldownPolicy });
    } catch (error) {
      reportSyncFailure('Failed to update service', error);
      await refreshFromServer();
      return;
    }

    await refreshFromServer();
  };

  const updateStatus = async (
    emailId: string, serviceId: string, status: StatusType,
    cooldownMinutes?: number, remainingRequests?: number, maximumRequests?: number,
    notes?: string, overrideResetTime?: string
  ) => {
    try {
      await api.updateStatus({ emailId, serviceId, status, cooldownMinutes, remainingRequests, maximumRequests, notes, overrideResetTime });
      if (status === 'Limit Reached') playSound('limit');
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to update status', error);
      await refreshFromServer();
    }
  };

  const startSession = async (emailId: string, serviceId: string) => {
    try {
      await api.startSession(emailId, serviceId);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to start session', error);
      await refreshFromServer();
    }
  };

  const endSession = async (emailId: string, serviceId: string, notes?: string) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);
    const historyRecord: UsageHistory = {
      id: `hist_${Math.random().toString(36).substring(2, 11)}`,
      emailServiceId: `${emailId}_${serviceId}`,
      emailNickname: emailObj?.nickname ?? 'Account',
      emailAddress: emailObj?.email ?? 'unknown',
      serviceName: serviceObj?.name ?? 'Service',
      event: 'Manual Edit',
      timestamp: now.toISOString(),
      notes: notes || 'Session completed.',
    };
    setHistory((h) => [historyRecord, ...h]);
    try {
      await api.createHistory(historyRecord);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to end session', error);
      await refreshFromServer();
    }
  };

  const reachLimit = async (emailId: string, serviceId: string, cooldownMinutes?: number, notes?: string) => {
    const minutes = cooldownMinutes || getServiceCooldownMinutes(serviceId);
    await updateStatus(emailId, serviceId, 'Limit Reached', minutes, 0, undefined, notes || `Usage limit exceeded. Cooldown timer set for ${minutes} minutes.`);
  };

  const resetTimer = async (emailId: string, serviceId: string) => {
    try {
      await api.resetTimer(emailId, serviceId);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to reset timer', error);
      await refreshFromServer();
    }
  };

  const loadMockData = async () => {
    try {
      await api.loadMockData({
        emails: MOCK_EMAILS,
        services: DEFAULT_SERVICES,
        emailServices: MOCK_EMAIL_SERVICES,
        history: MOCK_HISTORY,
        settings: DEFAULT_SETTINGS,
      });
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to load mock data', error);
      throw error;
    }
  };

  const clearDatabase = async () => {
    try {
      await api.clearDatabase();
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to clear database', error);
      throw error;
    }
  };

  const clearHistory = async () => {
    try {
      await api.clearHistory();
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to clear history', error);
      throw error;
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const merged: AppSettings = {
      ...settings,
      ...newSettings,
      notifications: { ...settings.notifications, ...(newSettings.notifications || {}) },
    };
    setSettings(merged);
    setTheme(merged.theme);
    try {
      await api.saveSettings(merged);
      await refreshFromServer();
    } catch (error) {
      reportSyncFailure('Failed to save settings', error);
      await refreshFromServer();
    }
  };

  const exportData = () => JSON.stringify({ emails, services, emailServices, history, settings, version: '1.0.0' }, null, 2);

  const importData = async (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      const payload = {
        emails: Array.isArray(data.emails) ? data.emails : [],
        services: Array.isArray(data.services) ? data.services : [],
        emailServices: Array.isArray(data.emailServices) ? data.emailServices : [],
        history: Array.isArray(data.history) ? data.history : [],
        settings: data.settings ?? DEFAULT_SETTINGS,
      };

      await api.loadMockData(payload);
      await refreshFromServer();
      return true;
    } catch (e) {
      reportSyncFailure('Error importing data', e);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      emails, services, emailServices, history, settings, isLoading, dbStatus, syncError, serverNow,
      addEmail, deleteEmail, updateEmail,
      addService, deleteService, updateService,
      updateStatus, startSession, endSession, reachLimit, resetTimer,
      loadMockData, clearDatabase, clearHistory,
      updateSettings, exportData, importData,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
