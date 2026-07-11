import { Email, Service, EmailService, UsageHistory, AppSettings, SecurityEventsResponse, AnomalyReport } from '../types';

const API_BASE = '/api';

// All fetches include credentials so the session cookie is sent
const f = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: 'include', ...init });

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  async getMe(): Promise<{ userId: string; email: string; name: string; avatar: string } | null> {
    const res  = await f(`${API_BASE}/auth/me`);
    const data = (await res.json()) as { user: any };
    return data.user ?? null;
  },


  loginUrl(): string { return `${API_BASE}/auth/login`; },
  async logout(): Promise<void> {
    await f(`${API_BASE}/auth/logout`, { method: 'POST' });
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  async getAllData(): Promise<{
    emails: Email[]; services: Service[]; emailServices: EmailService[];
    history: UsageHistory[]; settings: AppSettings;
  }> {
    const res = await f(`${API_BASE}/data`);
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
  },

  // ── Emails ───────────────────────────────────────────────────────────────
  async createEmail(email: Email): Promise<void> {
    const res = await f(`${API_BASE}/emails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });
    if (!res.ok) throw new Error('Failed to create email');
  },
  async updateEmail(id: string, email: Partial<Email>): Promise<void> {
    const res = await f(`${API_BASE}/emails/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });
    if (!res.ok) throw new Error('Failed to update email');
  },
  async deleteEmail(id: string): Promise<void> {
    const res = await f(`${API_BASE}/emails/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete email');
  },

  // ── Services ─────────────────────────────────────────────────────────────
  async createService(service: Service): Promise<void> {
    const res = await f(`${API_BASE}/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service) });
    if (!res.ok) throw new Error('Failed to create service');
  },
  async updateService(id: string, service: Partial<Service>): Promise<void> {
    const res = await f(`${API_BASE}/services/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service) });
    if (!res.ok) throw new Error('Failed to update service');
  },
  async deleteService(id: string): Promise<void> {
    const res = await f(`${API_BASE}/services/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete service');
  },

  // ── Email-Services ────────────────────────────────────────────────────────
  async saveEmailServices(relations: EmailService[]): Promise<void> {
    const res = await f(`${API_BASE}/email-services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relations }) });
    if (!res.ok) throw new Error('Failed to save email service relations');
  },
  async updateEmailService(es: EmailService): Promise<void> {
    const res = await f(`${API_BASE}/email-services`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(es) });
    if (!res.ok) throw new Error('Failed to update email service');
  },
  async deleteOrphanEmailServices(emailId: string, serviceIds: string[]): Promise<void> {
    const res = await f(`${API_BASE}/email-services?emailId=${encodeURIComponent(emailId)}&serviceIds=${encodeURIComponent(serviceIds.join(','))}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete orphan relations');
  },

  // ── History ───────────────────────────────────────────────────────────────
  async createHistory(history: UsageHistory): Promise<void> {
    const res = await f(`${API_BASE}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(history) });
    if (!res.ok) throw new Error('Failed to create history');
  },
  async clearHistory(): Promise<void> {
    const res = await f(`${API_BASE}/history`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear history');
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async saveSettings(settings: AppSettings): Promise<void> {
    const res = await f(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    if (!res.ok) throw new Error('Failed to save settings');
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  async loadMockData(payload: { emails: Email[]; services: Service[]; emailServices: EmailService[]; history: UsageHistory[]; settings: AppSettings }): Promise<void> {
    const res = await f(`${API_BASE}/actions/load-mock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to load mock data');
  },
  async clearDatabase(): Promise<void> {
    const res = await f(`${API_BASE}/actions/clear`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear database');
  },

  // ── Audit & Security ──────────────────────────────────────────────────────
  async getSecurityEvents(limit?: number, since?: number): Promise<SecurityEventsResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', String(limit));
    if (since !== undefined) params.append('since', String(since));
    const res = await f(`${API_BASE}/audit/events?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch security events');
    return res.json();
  },
  async getAnomalyReport(windowMinutes?: number): Promise<AnomalyReport> {
    const params = new URLSearchParams();
    if (windowMinutes !== undefined) params.append('window', String(windowMinutes));
    const res = await f(`${API_BASE}/audit/anomalies?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch anomaly report');
    return res.json();
  },
};

