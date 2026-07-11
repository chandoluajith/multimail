import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { SecurityEvent, AnomalyReport } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  Activity,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Globe,
  Terminal,
  Database,
  Lock,
  User,
  ExternalLink
} from 'lucide-react';

export const SecurityView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, warnings: 0 });
  const [anomaly, setAnomaly] = useState<AnomalyReport | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'info' | 'warn' | 'critical'>('All');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('All');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  
  // Tuning Params
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [limit, setLimit] = useState<number>(50);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch security data
  const fetchData = useCallback(async (showRefreshingIndicator = false) => {
    if (showRefreshingIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const [eventsRes, anomalyRes] = await Promise.all([
        api.getSecurityEvents(limit),
        api.getAnomalyReport(windowMinutes)
      ]);
      
      setEvents(eventsRes.events || []);
      setSummary(eventsRes.summary || { total: 0, critical: 0, warnings: 0 });
      setAnomaly(anomalyRes || null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to fetch security audit data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, windowMinutes]);

  // Initial and window/limit dependency load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh hook
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Clean event type name for display
  const formatEventType = (type: string) => {
    return type
      .replace(/^auth_/, 'Auth: ')
      .replace(/^rate_limit_/, 'Rate Limit: ')
      .replace(/^bot_/, 'Bot: ')
      .replace(/^origin_/, 'Origin: ')
      .replace(/^idor_/, 'IDOR: ')
      .replace(/^validation_/, 'Validation: ')
      .replace(/^api_error_/, 'API: ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get severity style classes
  const getSeverityBadge = (severity: 'info' | 'warn' | 'critical') => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 border-rose-500/25 text-rose-500 font-bold';
      case 'warn':
        return 'bg-amber-500/10 border-amber-500/25 text-amber-500 font-semibold';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-500/25 text-blue-500';
    }
  };

  // List of all unique event types in current dataset
  const uniqueEventTypes = Array.from(new Set(events.map(e => e.event_type)));

  // Filter logic
  const filteredEvents = events.filter(e => {
    const matchesSearch = 
      e.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.ip && e.ip.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.path && e.path.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.method && e.method.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.details && JSON.stringify(e.details).toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSeverity = severityFilter === 'All' || e.severity === severityFilter;
    const matchesType = eventTypeFilter === 'All' || e.event_type === eventTypeFilter;

    return matchesSearch && matchesSeverity && matchesType;
  });

  const formatTimestamp = (unixSeconds: number) => {
    const date = new Date(unixSeconds * 1000);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-8 px-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Security & Audit Logs
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Real-time isolation-enforced access logs and automated heuristic threat monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              autoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                : 'bg-transparent border-transparent hover:bg-blue-500/5'
            }`}
            style={!autoRefresh ? { color: 'var(--text-secondary)' } : undefined}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            Auto-refresh (15s)
          </button>

          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-white shadow-lg bg-blue-600 hover:bg-blue-500 shadow-blue-500/10 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
          <ShieldAlert className="shrink-0" size={18} />
          <div>
            <h4 className="font-semibold text-sm">Security Feed Error</h4>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Threat & Diagnostic Panels */}
      {!isLoading && anomaly && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Anomaly Gauge */}
          <div
            className={`lg:col-span-2 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm border transition-all duration-300`}
            style={{
              background: 'var(--bg-surface-alt)',
              borderColor: anomaly.isSuspicious ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-subtle)',
            }}
          >
            {/* Visual background gradient for warnings */}
            {anomaly.isSuspicious && (
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                    anomaly.isSuspicious
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  }`}
                >
                  {anomaly.isSuspicious ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider uppercase opacity-60">Client Connection Diagnostics</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 px-2 py-0.5 rounded-full bg-blue-500/10">
                      <Globe size={10} /> {anomaly.ip}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-heading mt-1" style={{ color: 'var(--text-primary)' }}>
                    {anomaly.isSuspicious ? 'Suspicious Behaviour Flagged' : 'Connection Posture Secured'}
                  </h3>
                  <p className="text-xs max-w-xl mt-1" style={{ color: 'var(--text-muted)' }}>
                    {anomaly.isSuspicious
                      ? `Threat Heuristics flagged this IP: ${anomaly.reason}. Please inspect requests below immediately.`
                      : 'No unusual patterns, repeated login lockouts, or rate-limiting events detected from your client IP.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Diagnostic stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Security Scope</p>
                <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>Client IP Only</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Scan Window</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <select
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                    className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-blue-500 underline decoration-dotted"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={360}>6 Hours</option>
                    <option value={1440}>24 Hours</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Earliest Event</p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {anomaly.firstSeen ? new Date(anomaly.firstSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Latest Event</p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {anomaly.lastSeen ? new Date(anomaly.lastSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Mini Severity Counter Card */}
          <div
            className="rounded-2xl p-6 flex flex-col justify-between backdrop-blur-sm relative overflow-hidden"
            style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Active Scan Indicators</span>
              <Activity size={16} className="text-blue-500" />
            </div>

            <div className="space-y-3 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Critical Events</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${summary.critical > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-500/10 opacity-50'}`}>
                  {summary.critical}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Warnings</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${summary.warnings > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 opacity-50'}`}>
                  {summary.warnings}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Feed Logged</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500">
                  {summary.total}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              Isolation Policy: You can only read your own logs.
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Indicators Grid: Counts of Event Types */}
      {!isLoading && anomaly && Object.keys(anomaly.eventCounts).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Heuristic Trigger Frequencies
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(anomaly.eventCounts).map(([type, count]) => {
              const isAbuse = ['rate_limit_ip', 'rate_limit_user', 'auth_lockout', 'bot_blocked', 'idor_attempt'].includes(type);
              return (
                <div
                  key={type}
                  className="p-3 rounded-xl border flex flex-col justify-between theme-transition"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: isAbuse && count > 2 ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-primary)'
                  }}
                >
                  <span className="text-[10px] font-bold line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                    {formatEventType(type)}
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hits</span>
                    <span className={`text-base font-black ${isAbuse && count > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div
        className="p-4 rounded-2xl flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between theme-transition"
        style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search logs by IP, method, status, payload details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-body"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Severity selector */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}
          >
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <option value="All">All Severities</option>
              <option value="info">Info</option>
              <option value="warn">Warnings</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Event Type selector */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}
          >
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Type:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer max-w-[160px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <option value="All">All Event Types</option>
              {uniqueEventTypes.map(type => (
                <option key={type} value={type}>{formatEventType(type)}</option>
              ))}
            </select>
          </div>

          {/* Log Limit selector */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}
          >
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <option value={10}>10 logs</option>
              <option value={25}>25 logs</option>
              <option value={50}>50 logs</option>
              <option value={100}>100 logs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div
          className="p-12 text-center rounded-2xl flex flex-col items-center justify-center gap-4"
          style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Scanning security vault logs…</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div
          className="p-12 text-center rounded-2xl flex flex-col items-center justify-center gap-3"
          style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
        >
          <Info size={36} style={{ color: 'var(--text-muted)' }} />
          <h4 className="font-semibold font-heading" style={{ color: 'var(--text-secondary)' }}>No security incidents logged</h4>
          <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
            No logged items found matching the selected query parameters or filters.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden border theme-transition"
          style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-bold uppercase border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  <th className="py-4 px-6">Event Type</th>
                  <th className="py-4 px-6">Severity</th>
                  <th className="py-4 px-6">Client IP</th>
                  <th className="py-4 px-6">Endpoint</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => {
                  const isExpanded = expandedEventId === e.id;
                  const hasDetails = e.details && Object.keys(e.details).length > 0;
                  
                  return (
                    <React.Fragment key={e.id}>
                      <tr
                        className={`text-xs hover:bg-blue-500/5 transition cursor-pointer ${isExpanded ? 'bg-blue-500/5' : ''}`}
                        style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        onClick={() => hasDetails && setExpandedEventId(isExpanded ? null : e.id)}
                      >
                        <td className="py-4 px-6 font-semibold flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            e.severity === 'critical' ? 'bg-rose-500 animate-ping' : e.severity === 'warn' ? 'bg-amber-500' : 'bg-blue-400'
                          }`} />
                          {formatEventType(e.event_type)}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] tracking-wide uppercase ${getSeverityBadge(e.severity)}`}>
                            {e.severity}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-[11px] opacity-75">{e.ip}</span>
                        </td>
                        <td className="py-4 px-6">
                          {e.method ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[9px] px-1 py-0.5 rounded bg-slate-500/10 text-slate-400">
                                {e.method}
                              </span>
                              <span className="font-mono text-[11px] max-w-[150px] truncate" title={e.path || ''}>
                                {e.path}
                              </span>
                              {e.status && (
                                <span className={`font-semibold text-[10px] ${e.status >= 500 ? 'text-rose-500' : e.status >= 400 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                  ({e.status})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="py-4 px-6" style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                            {formatTimestamp(e.timestamp)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {hasDetails ? (
                            <button className="text-blue-500 hover:text-blue-400 font-bold transition flex items-center gap-1 ml-auto">
                              {isExpanded ? 'Collapse' : 'Expand'}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          ) : (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No details</span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={6} className="bg-slate-500/5 p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase pb-2 border-b border-dashed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                <span className="flex items-center gap-1.5">
                                  <Terminal size={12} /> Event Diagnostic Payload
                                </span>
                                <span className="font-mono">{e.id}</span>
                              </div>
                              <pre className="p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-w-full text-slate-300" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)' }}>
                                {JSON.stringify(e.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Footer Info */}
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
            <div>
              Showing {filteredEvents.length} of {events.length} fetched security logs
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <span className="flex items-center gap-1"><Database size={12} /> D1 Audit Table</span>
              <span>•</span>
              <span className="flex items-center gap-1"><User size={12} /> JWT Isolated Session</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
