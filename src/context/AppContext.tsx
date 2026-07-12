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
  addEmail: (email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => void;
  deleteEmail: (id: string) => void;
  updateEmail: (id: string, email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => void;
  addService: (name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => void;
  deleteService: (id: string) => void;
  updateService: (id: string, name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => void;
  updateStatus: (
    emailId: string,
    serviceId: string,
    status: StatusType,
    cooldownMinutes?: number,
    remainingRequests?: number,
    maximumRequests?: number,
    notes?: string,
    overrideResetTime?: string
  ) => void;
  startSession: (emailId: string, serviceId: string) => void;
  endSession: (emailId: string, serviceId: string, notes?: string) => void;
  reachLimit: (emailId: string, serviceId: string, cooldownMinutes?: number, notes?: string) => void;
  resetTimer: (emailId: string, serviceId: string) => void;
  loadMockData: () => Promise<void>;
  clearDatabase: () => Promise<void>;
  clearHistory: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
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

  const addEmail = (email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => {
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

    // Persist to D1
    api.createEmail(newEmail).catch(console.error);
    if (newRelations.length > 0) api.saveEmailServices(newRelations).catch(console.error);
  };

  const deleteEmail = (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setEmailServices((prev) => prev.filter((es) => es.emailId !== id));
    api.deleteEmail(id).catch(console.error);
  };

  const updateEmail = (id: string, email: string, nickname: string, provider: ProviderType, serviceIds?: string[]) => {
    const now = new Date().toISOString();
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, email, nickname, provider, updatedAt: now } : e)));
    api.updateEmail(id, { email, nickname, provider, updatedAt: now }).catch(console.error);

    if (serviceIds != null) {
      setEmailServices((prev) => {
        const others = prev.filter((es) => es.emailId !== id);
        const desired = serviceIds.map((sid) => {
          const existing = prev.find((es) => es.emailId === id && es.serviceId === sid);
          if (existing) return { ...existing, updatedAt: now };
          return { id: `${id}_${sid}`, emailId: id, serviceId: sid, status: settings.defaultStatus, createdAt: now, updatedAt: now };
        });

        // Compute orphans to remove
        const currentSids = prev.filter((es) => es.emailId === id).map((es) => es.serviceId);
        const orphanSids = currentSids.filter((sid) => !serviceIds.includes(sid));
        if (orphanSids.length > 0) api.deleteOrphanEmailServices(id, orphanSids).catch(console.error);

        api.saveEmailServices(desired).catch(console.error);
        return [...others, ...desired];
      });
    }
  };

  const addService = (name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => {
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

    api.createService(newService).catch(console.error);
    if (newRelations.length > 0) api.saveEmailServices(newRelations).catch(console.error);
  };

  const deleteService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    setEmailServices((prev) => prev.filter((es) => es.serviceId !== id));
    api.deleteService(id).catch(console.error);
  };

  const updateService = (id: string, name: string, icon: string, color: string, cooldownPolicy?: { defaultCooldownValue?: number; defaultCooldownUnit?: CooldownUnit; autoStartCooldown?: boolean; autoResetStatus?: boolean; allowOverride?: boolean }) => {
    setServices((prev) => prev.map((s) => s.id === id ? {
      ...s, name, icon, color,
      ...(cooldownPolicy ? cooldownPolicy : {}),
    } : s));

    api.updateService(id, { name, icon, color, ...cooldownPolicy }).catch(console.error);

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

      setEmailServices((prev) => {
        const updated = prev.map((es) => {
          if (es.serviceId !== id) return es;
          if (es.status !== 'Cooling Down' && es.status !== 'Limit Reached') return es;
          if (!es.estimatedResetTime) return es;

          const resetTime = new Date(es.estimatedResetTime).getTime();
          const originalDuration = es.estimatedResetDuration || (settings.defaultCooldownDuration * 60 * 60 * 1000);
          const startTime = resetTime - originalDuration;
          const newResetTime = new Date(startTime + newDurationMs);
          const now = new Date();

          if (newResetTime <= now) {
            const res: EmailService = { ...es, status: 'Available', remainingRequests: es.maximumRequests, estimatedResetTime: undefined, estimatedResetDuration: undefined, updatedAt: now.toISOString() };
            api.updateEmailService(res).catch(console.error);
            return res;
          }
          const res: EmailService = { ...es, estimatedResetTime: newResetTime.toISOString(), estimatedResetDuration: newDurationMs, updatedAt: now.toISOString() };
          api.updateEmailService(res).catch(console.error);
          return res;
        });
        return updated;
      });
    }
  };

  const updateStatus = (
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

    setEmailServices((prev) => prev.map((es) => {
      if (es.emailId === emailId && es.serviceId === serviceId) {
        const originalStatus = es.status;
        if (originalStatus !== status) {
          const historyRecord: UsageHistory = {
            id: `hist_${Math.random().toString(36).substring(2, 11)}`,
            emailServiceId: es.id,
            emailNickname: nickname, emailAddress: emailAddr, serviceName: servName,
            event: status === 'Limit Reached' ? 'Reached Limit' : 'Status Changed',
            timestamp: now.toISOString(),
            notes: notes || `Manual status update: ${originalStatus} ➔ ${status}${cooldownMinutes ? ` (${cooldownMinutes}m cooldown)` : ''}`,
          };
          setHistory((h) => [historyRecord, ...h]);
          api.createHistory(historyRecord).catch(console.error);
          if (status === 'Limit Reached') playSound('limit');
        }
        const updated: EmailService = {
          ...es, status,
          remainingRequests: remainingRequests !== undefined ? remainingRequests : es.remainingRequests,
          maximumRequests: maximumRequests !== undefined ? maximumRequests : es.maximumRequests,
          estimatedResetTime, estimatedResetDuration,
          lastLimitReached: status === 'Limit Reached' || status === 'Cooling Down' ? now.toISOString() : es.lastLimitReached,
          notes: notes || es.notes,
          updatedAt: now.toISOString(),
        };
        api.updateEmailService(updated).catch(console.error);
        return updated;
      }
      return es;
    }));
  };

  const startSession = (emailId: string, serviceId: string) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);
    const nickname = emailObj?.nickname ?? 'Account';
    const emailAddr = emailObj?.email ?? 'unknown';
    const servName = serviceObj?.name ?? 'Service';

    setEmailServices((prev) => prev.map((es) => {
      if (es.emailId === emailId && es.serviceId === serviceId) {
        const newRemaining = es.remainingRequests !== undefined && es.remainingRequests > 0
          ? es.remainingRequests - 1 : es.remainingRequests;
        const historyRecord: UsageHistory = {
          id: `hist_${Math.random().toString(36).substring(2, 11)}`,
          emailServiceId: es.id,
          emailNickname: nickname, emailAddress: emailAddr, serviceName: servName,
          event: 'Started Session',
          timestamp: now.toISOString(),
          notes: `Started usage session. ${newRemaining !== undefined ? `Remaining: ${newRemaining}` : ''}`,
        };
        setHistory((h) => [historyRecord, ...h]);
        api.createHistory(historyRecord).catch(console.error);

        const updated: EmailService = { ...es, lastUsed: now.toISOString(), remainingRequests: newRemaining, updatedAt: now.toISOString() };
        api.updateEmailService(updated).catch(console.error);
        return updated;
      }
      return es;
    }));
  };

  const endSession = (emailId: string, serviceId: string, notes?: string) => {
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
    api.createHistory(historyRecord).catch(console.error);
  };

  const reachLimit = (emailId: string, serviceId: string, cooldownMinutes?: number, notes?: string) => {
    const minutes = cooldownMinutes || getServiceCooldownMinutes(serviceId);
    updateStatus(emailId, serviceId, 'Limit Reached', minutes, 0, undefined, notes || `Usage limit exceeded. Cooldown timer set for ${minutes} minutes.`);
  };

  const resetTimer = (emailId: string, serviceId: string) => {
    const now = new Date();
    const emailObj = emails.find((e) => e.id === emailId);
    const serviceObj = services.find((s) => s.id === serviceId);

    setEmailServices((prev) => prev.map((es) => {
      if (es.emailId === emailId && es.serviceId === serviceId) {
        const wasLimited = es.status === 'Limit Reached' || es.status === 'Cooling Down';
        if (wasLimited) {
          const historyRecord: UsageHistory = {
            id: `hist_${Math.random().toString(36).substring(2, 11)}`,
            emailServiceId: es.id,
            emailNickname: emailObj?.nickname ?? 'Account',
            emailAddress: emailObj?.email ?? 'unknown',
            serviceName: serviceObj?.name ?? 'Service',
            event: 'Reset Completed',
            timestamp: now.toISOString(),
            notes: 'Timer manually reset. Status changed to Available.',
          };
          setHistory((h) => [historyRecord, ...h]);
          api.createHistory(historyRecord).catch(console.error);
        }
        const updated: EmailService = {
          ...es, status: 'Available' as StatusType,
          remainingRequests: es.maximumRequests,
          estimatedResetTime: undefined,
          estimatedResetDuration: undefined,
          updatedAt: now.toISOString(),
        };
        api.updateEmailService(updated).catch(console.error);
        return updated;
      }
      return es;
    }));
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

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const merged: AppSettings = {
      ...settings,
      ...newSettings,
      notifications: { ...settings.notifications, ...(newSettings.notifications || {}) },
    };
    setSettings(merged);
    api.saveSettings(merged)
      .then(() => refreshFromServer())
      .catch((error) => console.error('Failed to save settings', error));
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
