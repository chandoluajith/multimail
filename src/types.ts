export type ProviderType = 'Gmail' | 'Outlook' | 'Proton' | 'Yahoo' | 'Custom';

export type StatusType = 'Available' | 'Cooling Down' | 'Limit Reached' | 'Resetting Soon' | 'Unknown';

export interface Email {
  id: string;
  email: string;
  nickname: string;
  provider: ProviderType;
  createdAt: string;
  updatedAt: string;
}

export type CooldownUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export interface Service {
  id: string; // e.g., 'gemini', 'claude', or a random ID for custom ones
  name: string;
  icon: string; // Lucide icon name (e.g., 'Sparkles', 'Cpu', 'Terminal')
  color: string; // hex code or tailwind color class
  isCustom?: boolean;
  // Cooldown Policy
  defaultCooldownValue?: number;        // e.g. 4
  defaultCooldownUnit?: CooldownUnit;   // e.g. 'hours'
  autoStartCooldown?: boolean;          // auto-start cooldown when "Limit Reached"
  autoResetStatus?: boolean;            // auto-reset to "Available" when cooldown expires
  allowOverride?: boolean;              // allow per-account overrides
}

export interface EmailService {
  id: string; // emailId_serviceId
  emailId: string;
  serviceId: string;
  status: StatusType;
  remainingRequests?: number;
  maximumRequests?: number;
  lastUsed?: string; // ISO string
  lastLimitReached?: string; // ISO string
  estimatedResetTime?: string; // ISO string when it resets
  estimatedResetDuration?: number; // duration in ms
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageHistory {
  id: string;
  emailServiceId: string;
  emailNickname: string; // cached for easy rendering
  emailAddress: string;  // cached
  serviceName: string;   // cached
  event: 'Started Session' | 'Reached Limit' | 'Reset Completed' | 'Status Changed' | 'Manual Edit';
  timestamp: string; // ISO string
  notes?: string;
}

export interface NotificationSetting {
  resetCompleted: boolean;
  resetTenMinutes: boolean;
  cooldownFinished: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  notifications: NotificationSetting;
  timeFormat: '12h' | '24h';
  defaultCooldownDuration: number; // in hours
  defaultStatus: StatusType;
}

export interface DashboardStats {
  totalEmails: number;
  totalServices: number;
  available: number;
  coolingDown: number;
  limitReached: number;
  unknown: number;
  resetsToday: number;
  upcomingResets: number;
}

export interface SecurityEvent {
  id: string;
  timestamp: number; // unix seconds
  event_type: string;
  severity: 'info' | 'warn' | 'critical';
  ip: string;
  method: string | null;
  path: string | null;
  status: number | null;
  details: Record<string, any> | null;
}

export interface SecuritySummary {
  total: number;
  critical: number;
  warnings: number;
}

export interface SecurityEventsResponse {
  events: SecurityEvent[];
  summary: SecuritySummary;
}

export interface AnomalyReport {
  ip: string;
  windowMinutes: number;
  isSuspicious: boolean;
  reason: string | null;
  eventCounts: Record<string, number>;
  firstSeen: number | null;
  lastSeen: number | null;
}

