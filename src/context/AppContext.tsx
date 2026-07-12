import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Email, Service, EmailService, UsageHistory, AppSettings, StatusType, ProviderType, CooldownUnit } from '../types';
import { DEFAULT_SERVICES, DEFAULT_SETTINGS, MOCK_EMAILS, MOCK_EMAIL_SERVICES, MOCK_HISTORY } from '../mockData';
import { api } from '../services/api';

type DbStatus = 'checking' | 'connected' | 'error';

interface AppContextType {
  emails: Email[];
  services: Service[];
  emailServices: EmailService[];
  history: UsageHistory[];
  settings: AppSettings;
  isLoading: boolean;
  dbStatus: DbStatus;
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
  const [emails, setEmails] = useState<Email[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [emailServices, setEmailServices] = useState<EmailService[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');

  const refreshFromServer = useCallback(async () => {
    const data = await api.getAllData();
    setEmails(data.emails);
    setServices(data.services.length > 0 ? data.services : DEFAULT_SERVICES);
    setEmailServices(data.emailServices);
    setHistory(data.history);
    setSettings(data.settings);
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

  const triggerNotification = useCallback((title: string, body: string, soundType: 'complete' | 'limit' = 'complete') => {
    if (typeof window === 'undefined') return;
    playSound(soundType);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }, [playSound]);

  // ── Request notification permission ──────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') Notification.requestPermission();
    }
  }, []);

  // ── Load initial data from D1 API ─────────────────────────────────────────
  // NOTE: We intentionally do NOT cache sensitive data (email addresses) in
  // localStorage. Doing so would bypass AES-256-GCM encryption on the server
  // and expose plaintext addresses to any script running on the page.
  // The server is the single source of truth.
  useEffect(() => {
    const load = async () => {
      try {
        await refreshFromServer();
        setDbStatus('connected');
      } catch (err) {
        // Surface the error to the UI — do NOT silently fall back to stale or
        // mock data, as that could show one user another's placeholder records.
        console.error('[AppContext] Failed to load data from API:', err);
        setDbStatus('error');
      } finally {
        setIsLoading(false);
        setMounted(true);
      }
    };
    load();
  }, [refreshFromServer]);

  // ── Refs for background timer ─────────────────────────────────────────────
  const emailsRef = useRef(emails);
  const servicesRef = useRef(services);
  const emailServicesRef = useRef(emailServices);
  const settingsRef = useRef(settings);

  useEffect(() => { emailsRef.current = emails; }, [emails]);
  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { emailServicesRef.current = emailServices; }, [emailServices]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Background cooldown timer ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (!mounted) return;
      const now = new Date();
      let hasChanges = false;

      const updatedList = emailServicesRef.current.map((es) => {
        if (es.estimatedResetTime && (es.status === 'Cooling Down' || es.status === 'Limit Reached')) {
          if (now >= new Date(es.estimatedResetTime)) {
            hasChanges = true;
            const emailObj = emailsRef.current.find((e) => e.id === es.emailId);
            const serviceObj = servicesRef.current.find((s) => s.id === es.serviceId);
            const nickname = emailObj?.nickname ?? 'Account';
            const emailAddr = emailObj?.email ?? 'unknown';
            const servName = serviceObj?.name ?? 'Service';

            const newHistory: UsageHistory = {
              id: `hist_auto_${Math.random().toString(36).substring(2, 11)}`,
              emailServiceId: es.id,
              emailNickname: nickname,
              emailAddress: emailAddr,
              serviceName: servName,
              event: 'Reset Completed',
              timestamp: now.toISOString(),
              notes: 'Cooldown period expired. Automatically reset.',
            };
            setHistory((prev) => [newHistory, ...prev]);
            api.createHistory(newHistory).catch(console.error);

            if (settingsRef.current.notifications.cooldownFinished) {
              triggerNotification(`⚡ ${servName} Ready!`, `Account ${nickname} (${emailAddr}) cooldown finished.`, 'complete');
            }

            const updated: EmailService = {
              ...es,
              status: 'Available' as StatusType,
              remainingRequests: es.maximumRequests,
              estimatedResetTime: undefined,
              estimatedResetDuration: undefined,
              updatedAt: now.toISOString(),
            };
            api.updateEmailService(updated).catch(console.error);
            return updated;
          }
        }
        return es;
      });

      if (hasChanges) setEmailServices(updatedList);
    }, 1000);

    return () => clearInterval(timer);
  }, [mounted, triggerNotification]);

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
      console.error('Failed to add email', error);
      await refreshFromServer();
    }
  };

  const deleteEmail = async (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setEmailServices((prev) => prev.filter((es) => es.emailId !== id));
    try {
      await api.deleteEmail(id);
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to delete email', error);
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
        console.error('Failed to update email', error);
        await refreshFromServer();
      }
      return;
    }

    try {
      await api.updateEmail(id, { email, nickname, provider, updatedAt: now });
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to update email', error);
      await refreshFromServer();
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
      console.error('Failed to add service', error);
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
      console.error('Failed to delete service', error);
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
      console.error('Failed to update service', error);
      await refreshFromServer();
      return;
    }

    // Propagate cooldown changes to active cooldowns
    if (cooldownPolicy?.defaultCooldownValue && cooldownPolicy?.defaultCooldownUnit) {
      const newMinutes = (() => {
        const v = cooldownPolicy.defaultCooldownValue!;
        switch (cooldownPolicy.defaultCooldownUnit!) {
          case 'minutes': return v;
          case 'hours':   return v * 60;
          case 'days':    return v * 60 * 24;
          case 'weeks':   return v * 60 * 24 * 7;
          default:        return v * 60;
        }
      })();
      const newDurationMs = newMinutes * 60 * 1000;

      const updatedRelations = emailServices.map((es) => {
        if (es.serviceId !== id) return es;
        if (es.status !== 'Cooling Down' && es.status !== 'Limit Reached') return es;
        if (!es.estimatedResetTime) return es;

        const resetTime = new Date(es.estimatedResetTime).getTime();
        const originalDuration = es.estimatedResetDuration || (settings.defaultCooldownDuration * 60 * 60 * 1000);
        const startTime = resetTime - originalDuration;
        const newResetTime = new Date(startTime + newDurationMs);
        const now = new Date();

        if (newResetTime <= now) {
          return { ...es, status: 'Available' as StatusType, remainingRequests: es.maximumRequests, estimatedResetTime: undefined, estimatedResetDuration: undefined, updatedAt: now.toISOString() };
        }
        return { ...es, estimatedResetTime: newResetTime.toISOString(), estimatedResetDuration: newDurationMs, updatedAt: now.toISOString() };
      });
      setEmailServices(updatedRelations);

      try {
        await Promise.all(updatedRelations.filter((es) => es.serviceId === id && (es.status === 'Available' || es.status === 'Cooling Down' || es.status === 'Limit Reached')).map((es) => api.updateEmailService(es)));
        await refreshFromServer();
      } catch (error) {
        console.error('Failed to propagate service cooldown changes', error);
        await refreshFromServer();
      }
    }

    await refreshFromServer();
  };

  const updateStatus = async (
    emailId: string, serviceId: string, status: StatusType,
    cooldownMinutes?: number, remainingRequests?: number, maximumRequests?: number,
    notes?: string, overrideResetTime?: string
  ) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);
    const nickname = emailObj?.nickname ?? 'Account';
    const emailAddr = emailObj?.email ?? 'unknown';
    const servName = serviceObj?.name ?? 'Service';

    let estimatedResetTime: string | undefined;
    let estimatedResetDuration: number | undefined;

    if ((status === 'Cooling Down' || status === 'Limit Reached') && overrideResetTime) {
      estimatedResetTime = overrideResetTime;
      estimatedResetDuration = new Date(overrideResetTime).getTime() - now.getTime();
    } else if ((status === 'Cooling Down' || status === 'Limit Reached') && cooldownMinutes && cooldownMinutes > 0) {
      estimatedResetTime = new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString();
      estimatedResetDuration = cooldownMinutes * 60 * 1000;
    }

    const current = emailServices.find((es) => es.emailId === emailId && es.serviceId === serviceId);
    if (!current) return;

    const updated: EmailService = {
      ...current, status,
      remainingRequests: remainingRequests !== undefined ? remainingRequests : current.remainingRequests,
      maximumRequests: maximumRequests !== undefined ? maximumRequests : current.maximumRequests,
      estimatedResetTime, estimatedResetDuration,
      lastLimitReached: status === 'Limit Reached' || status === 'Cooling Down' ? now.toISOString() : current.lastLimitReached,
      notes: notes || current.notes,
      updatedAt: now.toISOString(),
    };

    const historyRecord = current.status !== status ? {
      id: `hist_${Math.random().toString(36).substring(2, 11)}`,
      emailServiceId: current.id,
      emailNickname: nickname,
      emailAddress: emailAddr,
      serviceName: servName,
      event: status === 'Limit Reached' ? 'Reached Limit' : 'Status Changed',
      timestamp: now.toISOString(),
      notes: notes || `Manual status update: ${current.status} ➔ ${status}${cooldownMinutes ? ` (${cooldownMinutes}m cooldown)` : ''}`,
    } as UsageHistory : null;

    setEmailServices((prev) => prev.map((es) => (es.emailId === emailId && es.serviceId === serviceId ? updated : es)));

    try {
      if (historyRecord) {
        setHistory((h) => [historyRecord, ...h]);
        await api.createHistory(historyRecord);
        if (status === 'Limit Reached') playSound('limit');
      }
      await api.updateEmailService(updated);
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to update status', error);
      await refreshFromServer();
    }
  };

  const startSession = async (emailId: string, serviceId: string) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);
    const nickname = emailObj?.nickname ?? 'Account';
    const emailAddr = emailObj?.email ?? 'unknown';
    const servName = serviceObj?.name ?? 'Service';

    const current = emailServices.find((es) => es.emailId === emailId && es.serviceId === serviceId);
    if (!current) return;

    const newRemaining = current.remainingRequests !== undefined && current.remainingRequests > 0
      ? current.remainingRequests - 1 : current.remainingRequests;
    const updated: EmailService = { ...current, lastUsed: now.toISOString(), remainingRequests: newRemaining, updatedAt: now.toISOString() };
    const historyRecord: UsageHistory = {
      id: `hist_${Math.random().toString(36).substring(2, 11)}`,
      emailServiceId: current.id,
      emailNickname: nickname,
      emailAddress: emailAddr,
      serviceName: servName,
      event: 'Started Session',
      timestamp: now.toISOString(),
      notes: `Started usage session. ${newRemaining !== undefined ? `Remaining: ${newRemaining}` : ''}`,
    };

    setEmailServices((prev) => prev.map((es) => (es.emailId === emailId && es.serviceId === serviceId ? updated : es)));
    setHistory((h) => [historyRecord, ...h]);

    try {
      await api.createHistory(historyRecord);
      await api.updateEmailService(updated);
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to start session', error);
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
      console.error('Failed to end session', error);
      await refreshFromServer();
    }
  };

  const reachLimit = async (emailId: string, serviceId: string, cooldownMinutes?: number, notes?: string) => {
    const minutes = cooldownMinutes || getServiceCooldownMinutes(serviceId);
    await updateStatus(emailId, serviceId, 'Limit Reached', minutes, 0, undefined, notes || `Usage limit exceeded. Cooldown timer set for ${minutes} minutes.`);
  };

  const resetTimer = async (emailId: string, serviceId: string) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);

    const current = emailServices.find((es) => es.emailId === emailId && es.serviceId === serviceId);
    if (!current) return;

    const updated: EmailService = {
      ...current, status: 'Available' as StatusType,
      remainingRequests: current.maximumRequests,
      estimatedResetTime: undefined,
      estimatedResetDuration: undefined,
      updatedAt: now.toISOString(),
    };
    const wasLimited = current.status === 'Limit Reached' || current.status === 'Cooling Down';
    const historyRecord = wasLimited ? {
      id: `hist_${Math.random().toString(36).substring(2, 11)}`,
      emailServiceId: current.id,
      emailNickname: emailObj?.nickname ?? 'Account',
      emailAddress: emailObj?.email ?? 'unknown',
      serviceName: serviceObj?.name ?? 'Service',
      event: 'Reset Completed',
      timestamp: now.toISOString(),
      notes: 'Timer manually reset. Status changed to Available.',
    } as UsageHistory : null;

    setEmailServices((prev) => prev.map((es) => (es.emailId === emailId && es.serviceId === serviceId ? updated : es)));
    if (historyRecord) setHistory((h) => [historyRecord, ...h]);

    try {
      if (historyRecord) await api.createHistory(historyRecord);
      await api.updateEmailService(updated);
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to reset timer', error);
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
      console.error('Failed to load mock data', error);
      throw error;
    }
  };

  const clearDatabase = async () => {
    try {
      await api.clearDatabase();
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to clear database', error);
      throw error;
    }
  };

  const clearHistory = async () => {
    try {
      await api.clearHistory();
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to clear history', error);
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
    try {
      await api.saveSettings(merged);
      await refreshFromServer();
    } catch (error) {
      console.error('Failed to save settings', error);
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
      console.error('Error importing data', e);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      emails, services, emailServices, history, settings, isLoading, dbStatus,
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
