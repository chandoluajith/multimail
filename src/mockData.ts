import { Email, Service, EmailService, UsageHistory, AppSettings } from './types';

// Helper to get relative ISO times
const getFutureTime = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();
const getPastTime = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

export const DEFAULT_SERVICES: Service[] = [
  { id: 'gemini', name: 'Gemini', icon: 'Sparkles', color: '#10B981', defaultCooldownValue: 1, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'claude', name: 'Claude', icon: 'Cpu', color: '#F59E0B', defaultCooldownValue: 3, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'codex', name: 'Codex', icon: 'Code2', color: '#6366F1', defaultCooldownValue: 24, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'antigravity', name: 'Antigravity', icon: 'Compass', color: '#EC4899', defaultCooldownValue: 4, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'cursor', name: 'Cursor', icon: 'MousePointerClick', color: '#3B82F6', defaultCooldownValue: 2, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'windsurf', name: 'Windsurf', icon: 'Wind', color: '#06B6D4', defaultCooldownValue: 12, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'openai', name: 'OpenAI', icon: 'Layers', color: '#8B5CF6', defaultCooldownValue: 4, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'chatgpt', name: 'ChatGPT', icon: 'MessageSquareText', color: '#14B8A6', defaultCooldownValue: 3, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
  { id: 'deepseek', name: 'DeepSeek', icon: 'Binary', color: '#EF4444', defaultCooldownValue: 1, defaultCooldownUnit: 'hours', autoStartCooldown: true, autoResetStatus: true, allowOverride: true },
];

export const MOCK_EMAILS: Email[] = [
  {
    id: 'email_1',
    email: 'ajith.personal@gmail.com',
    nickname: 'Ajith Personal',
    provider: 'Gmail',
    createdAt: getPastTime(10080), // 7 days ago
    updatedAt: getPastTime(10080),
  },
  {
    id: 'email_2',
    email: 'ajith.work@outlook.com',
    nickname: 'Ajith Work',
    provider: 'Outlook',
    createdAt: getPastTime(5760), // 4 days ago
    updatedAt: getPastTime(5760),
  },
  {
    id: 'email_3',
    email: 'ai.agent@proton.me',
    nickname: 'Pro Agent',
    provider: 'Proton',
    createdAt: getPastTime(1440), // 1 day ago
    updatedAt: getPastTime(1440),
  },
];

export const MOCK_EMAIL_SERVICES: EmailService[] = [
  // Email 1 Services
  {
    id: 'email_1_gemini',
    emailId: 'email_1',
    serviceId: 'gemini',
    status: 'Available',
    remainingRequests: 100,
    maximumRequests: 100,
    lastUsed: getPastTime(40),
    createdAt: getPastTime(10080),
    updatedAt: getPastTime(40),
  },
  {
    id: 'email_1_claude',
    emailId: 'email_1',
    serviceId: 'claude',
    status: 'Cooling Down',
    remainingRequests: 0,
    maximumRequests: 50,
    lastUsed: getPastTime(75),
    lastLimitReached: getPastTime(75),
    estimatedResetTime: getFutureTime(135), // 2h 15m from now
    estimatedResetDuration: 3 * 60 * 60 * 1000, // 3 hours total
    createdAt: getPastTime(10080),
    updatedAt: getPastTime(75),
    notes: 'Hit Claude 3.5 Sonnet quota limit during a long debugging session.',
  },
  {
    id: 'email_1_codex',
    emailId: 'email_1',
    serviceId: 'codex',
    status: 'Limit Reached',
    remainingRequests: 0,
    maximumRequests: 200,
    lastUsed: getPastTime(300),
    lastLimitReached: getPastTime(300),
    estimatedResetTime: getFutureTime(480), // 8 hours from now
    estimatedResetDuration: 24 * 60 * 60 * 1000, // 24 hours total
    createdAt: getPastTime(10080),
    updatedAt: getPastTime(300),
  },
  {
    id: 'email_1_antigravity',
    emailId: 'email_1',
    serviceId: 'antigravity',
    status: 'Available',
    remainingRequests: 25,
    maximumRequests: 25,
    lastUsed: getPastTime(120),
    createdAt: getPastTime(10080),
    updatedAt: getPastTime(120),
  },

  // Email 2 Services
  {
    id: 'email_2_gemini',
    emailId: 'email_2',
    serviceId: 'gemini',
    status: 'Cooling Down',
    remainingRequests: 2,
    maximumRequests: 100,
    lastUsed: getPastTime(15),
    lastLimitReached: getPastTime(15),
    estimatedResetTime: getFutureTime(45), // 45m from now
    estimatedResetDuration: 1 * 60 * 60 * 1000, // 1 hour total
    createdAt: getPastTime(5760),
    updatedAt: getPastTime(15),
  },
  {
    id: 'email_2_cursor',
    emailId: 'email_2',
    serviceId: 'cursor',
    status: 'Available',
    remainingRequests: 500,
    maximumRequests: 500,
    lastUsed: getPastTime(180),
    createdAt: getPastTime(5760),
    updatedAt: getPastTime(180),
  },
  {
    id: 'email_2_openai',
    emailId: 'email_2',
    serviceId: 'openai',
    status: 'Available',
    remainingRequests: 80,
    maximumRequests: 100,
    lastUsed: getPastTime(60),
    createdAt: getPastTime(5760),
    updatedAt: getPastTime(60),
  },

  // Email 3 Services
  {
    id: 'email_3_windsurf',
    emailId: 'email_3',
    serviceId: 'windsurf',
    status: 'Limit Reached',
    remainingRequests: 0,
    maximumRequests: 150,
    lastUsed: getPastTime(180),
    lastLimitReached: getPastTime(180),
    estimatedResetTime: getFutureTime(720), // 12 hours from now
    estimatedResetDuration: 15 * 60 * 60 * 1000,
    createdAt: getPastTime(1440),
    updatedAt: getPastTime(180),
    notes: 'Reached standard Cascade model limits.',
  },
  {
    id: 'email_3_claude',
    emailId: 'email_3',
    serviceId: 'claude',
    status: 'Available',
    remainingRequests: 50,
    maximumRequests: 50,
    lastUsed: getPastTime(10),
    createdAt: getPastTime(1440),
    updatedAt: getPastTime(10),
  },
  {
    id: 'email_3_chatgpt',
    emailId: 'email_3',
    serviceId: 'chatgpt',
    status: 'Available',
    remainingRequests: 40,
    maximumRequests: 40,
    createdAt: getPastTime(1440),
    updatedAt: getPastTime(1440),
  },
  {
    id: 'email_3_deepseek',
    emailId: 'email_3',
    serviceId: 'deepseek',
    status: 'Cooling Down',
    remainingRequests: 0,
    maximumRequests: 10,
    lastUsed: getPastTime(50),
    lastLimitReached: getPastTime(50),
    estimatedResetTime: getFutureTime(10), // 10 minutes from now
    estimatedResetDuration: 60 * 60 * 1000,
    createdAt: getPastTime(1440),
    updatedAt: getPastTime(50),
  },
];

export const MOCK_HISTORY: UsageHistory[] = [
  {
    id: 'hist_1',
    emailServiceId: 'email_1_claude',
    emailNickname: 'Ajith Personal',
    emailAddress: 'ajith.personal@gmail.com',
    serviceName: 'Claude',
    event: 'Started Session',
    timestamp: getPastTime(120),
    notes: 'Began working on new Next.js UI integration.',
  },
  {
    id: 'hist_2',
    emailServiceId: 'email_1_claude',
    emailNickname: 'Ajith Personal',
    emailAddress: 'ajith.personal@gmail.com',
    serviceName: 'Claude',
    event: 'Reached Limit',
    timestamp: getPastTime(75),
    notes: 'Triggered 3h cooldown. Switching to Gemini.',
  },
  {
    id: 'hist_3',
    emailServiceId: 'email_1_gemini',
    emailNickname: 'Ajith Personal',
    emailAddress: 'ajith.personal@gmail.com',
    serviceName: 'Gemini',
    event: 'Started Session',
    timestamp: getPastTime(70),
    notes: 'Testing Sonnet prompts in Gemini 1.5 Pro.',
  },
  {
    id: 'hist_4',
    emailServiceId: 'email_2_gemini',
    emailNickname: 'Ajith Work',
    emailAddress: 'ajith.work@outlook.com',
    serviceName: 'Gemini',
    event: 'Reached Limit',
    timestamp: getPastTime(15),
    notes: 'Gemini rate limit reached on work key.',
  },
  {
    id: 'hist_5',
    emailServiceId: 'email_3_claude',
    emailNickname: 'Pro Agent',
    emailAddress: 'ai.agent@proton.me',
    serviceName: 'Claude',
    event: 'Started Session',
    timestamp: getPastTime(10),
    notes: 'Running automated agent task.',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: {
    resetCompleted: true,
    resetTenMinutes: true,
    cooldownFinished: true,
  },
  timeFormat: '12h',
  defaultCooldownDuration: 3, // 3 hours
  defaultStatus: 'Unknown',
};
