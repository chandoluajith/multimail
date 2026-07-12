/**
 * functions/types.ts
 *
 * Shared type definitions used by Cloudflare Pages Functions.
 * This file is a self-contained copy of the types that the backend needs.
 *
 * WHY: Wrangler's Pages bundler cannot resolve imports outside the
 * `functions/` directory (e.g. `../../src/types`). By co-locating
 * these types inside `functions/`, bundling succeeds in production.
 *
 * KEEP IN SYNC with src/types.ts for any domain type changes.
 */

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
  id: string;
  name: string;
  icon: string;
  color: string;
  isCustom?: boolean;
  defaultCooldownValue?: number;
  defaultCooldownUnit?: CooldownUnit;
  autoStartCooldown?: boolean;
  autoResetStatus?: boolean;
  allowOverride?: boolean;
}

export interface EmailService {
  id: string;
  emailId: string;
  serviceId: string;
  status: StatusType;
  remainingRequests?: number;
  maximumRequests?: number;
  lastUsed?: string;
  lastLimitReached?: string;
  estimatedResetTime?: string;
  estimatedResetDuration?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageHistory {
  id: string;
  emailServiceId: string;
  emailNickname: string;
  emailAddress: string;
  serviceName: string;
  event: 'Started Session' | 'Reached Limit' | 'Reset Completed' | 'Status Changed' | 'Manual Edit';
  timestamp: string;
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
  defaultCooldownDuration: number;
  defaultStatus: StatusType;
}
