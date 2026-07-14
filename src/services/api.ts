import { Email, Service, EmailService, UsageHistory, AppSettings, SecurityEventsResponse, AnomalyReport } from '../types';

const API_BASE = '/api';

// All fetches include credentials so the session cookie is sent
const f = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: 'include', ...init });

async function expectOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;

  try {
    const data = await res.json() as { error?: string; fields?: Array<{ field: string; message: string }> };
    if (data.fields?.length) {
      throw new Error(`${data.error ?? fallbackMessage}: ${data.fields.map((f) => `${f.field} ${f.message}`).join(', ')}`);
    }
    throw new Error(data.error ?? fallbackMessage);
  } catch (error) {
    if (error instanceof Error && error.message !== fallbackMessage) throw error;
    throw new Error(fallbackMessage);
  }
}

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
    history: UsageHistory[]; settings: AppSettings; serverNow: string;
  }> {
    const res = await f(`${API_BASE}/data`);
    await expectOk(res, 'Failed to fetch data');
    return res.json();
  },

  // ── Emails ───────────────────────────────────────────────────────────────
  async createEmail(email: Email): Promise<void> {
    const res = await f(`${API_BASE}/emails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });
    await expectOk(res, 'Failed to create email');
  },
  async updateEmail(id: string, email: Partial<Email>): Promise<void> {
    const res = await f(`${API_BASE}/emails/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });
    await expectOk(res, 'Failed to update email');
  },
  async deleteEmail(id: string): Promise<void> {
    const res = await f(`${API_BASE}/emails/${id}`, { method: 'DELETE' });
    await expectOk(res, 'Failed to delete email');
  },

  // ── Services ─────────────────────────────────────────────────────────────
  async createService(service: Service): Promise<void> {
    const res = await f(`${API_BASE}/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service) });
    await expectOk(res, 'Failed to create service');
  },
  async updateService(id: string, service: Partial<Service>): Promise<void> {
    const res = await f(`${API_BASE}/services/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service) });
    await expectOk(res, 'Failed to update service');
  },
  async deleteService(id: string): Promise<void> {
    const res = await f(`${API_BASE}/services/${id}`, { method: 'DELETE' });
    await expectOk(res, 'Failed to delete service');
  },

  // ── Email-Services ────────────────────────────────────────────────────────
  async saveEmailServices(relations: EmailService[]): Promise<void> {
    const res = await f(`${API_BASE}/email-services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relations }) });
    await expectOk(res, 'Failed to save email service relations');
  },
  async updateEmailService(es: EmailService): Promise<void> {
    const res = await f(`${API_BASE}/email-services`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(es) });
    await expectOk(res, 'Failed to update email service');
  },
  async deleteOrphanEmailServices(emailId: string, serviceIds: string[]): Promise<void> {
    const res = await f(`${API_BASE}/email-services?emailId=${encodeURIComponent(emailId)}&serviceIds=${encodeURIComponent(serviceIds.join(','))}`, { method: 'DELETE' });
    await expectOk(res, 'Failed to delete orphan relations');
  },

  // ── History ───────────────────────────────────────────────────────────────
  async createHistory(history: UsageHistory): Promise<void> {
    const res = await f(`${API_BASE}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(history) });
    await expectOk(res, 'Failed to create history');
  },
  async clearHistory(): Promise<void> {
    const res = await f(`${API_BASE}/history`, { method: 'DELETE' });
    await expectOk(res, 'Failed to clear history');
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  async saveSettings(settings: AppSettings): Promise<void> {
    const res = await f(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    await expectOk(res, 'Failed to save settings');
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  async loadMockData(payload: { emails: Email[]; services: Service[]; emailServices: EmailService[]; history: UsageHistory[]; settings: AppSettings }): Promise<void> {
    const res = await f(`${API_BASE}/actions/load-mock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await expectOk(res, 'Failed to load mock data');
  },
  async clearDatabase(): Promise<void> {
    const res = await f(`${API_BASE}/actions/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await expectOk(res, 'Failed to clear database');
  },
  async syncExpiredCooldowns(): Promise<void> {
    const res = await f(`${API_BASE}/actions/sync-expired`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await expectOk(res, 'Failed to sync expired cooldowns');
  },
  async updateStatus(payload: {
    emailId: string;
    serviceId: string;
    status: EmailService['status'];
    cooldownMinutes?: number;
    remainingRequests?: number;
    maximumRequests?: number;
    notes?: string;
    overrideResetTime?: string;
  }): Promise<void> {
    const res = await f(`${API_BASE}/actions/update-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await expectOk(res, 'Failed to update status');
  },
  async startSession(emailId: string, serviceId: string): Promise<void> {
    const res = await f(`${API_BASE}/actions/start-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailId, serviceId }) });
    await expectOk(res, 'Failed to start session');
  },
  async resetTimer(emailId: string, serviceId: string): Promise<void> {
    const res = await f(`${API_BASE}/actions/reset-timer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailId, serviceId }) });
    await expectOk(res, 'Failed to reset timer');
  },

  // ── Audit & Security ──────────────────────────────────────────────────────
  async getSecurityEvents(limit?: number, since?: number): Promise<SecurityEventsResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', String(limit));
    if (since !== undefined) params.append('since', String(since));
    const res = await f(`${API_BASE}/audit/events?${params.toString()}`);
    await expectOk(res, 'Failed to fetch security events');
    return res.json();
  },
  async getAnomalyReport(windowMinutes?: number): Promise<AnomalyReport> {
    const params = new URLSearchParams();
    if (windowMinutes !== undefined) params.append('window', String(windowMinutes));
    const res = await f(`${API_BASE}/audit/anomalies?${params.toString()}`);
    await expectOk(res, 'Failed to fetch anomaly report');
    return res.json();
  },
};
