'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  Download,
  RotateCcw,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  FileCheck2,
  FileWarning,
  Layers,
  ArrowRight,
  Info,
  Loader2,
  Copy,
  Check,
  Eye,
  Activity,
  History,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export interface BackupItem {
  id: string;
  filename: string;
  type: 'FULL' | 'INCREMENTAL' | 'SAFETY_SNAPSHOT';
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CORRUPTED';
  scope: string[];
  recordCount: number;
  fileCount: number;
  sizeBytes: number;
  checksumSha256: string;
  storageLocation: string;
  notes?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: { fullName: string; email: string } | null;
}

export interface RestorationItem {
  id: string;
  backupId: string;
  type: 'FULL' | 'SELECTIVE';
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  targetScope: string[];
  preRestoreSnapshotId?: string | null;
  recordsRestored: number;
  filesRestored: number;
  performedBy: { fullName: string };
  createdAt: string;
  completedAt?: string | null;
  report?: unknown;
}

export interface IntegrityIssue {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  entity: string;
  entityId?: string;
  description: string;
  detectedAt: string;
  recommendation: string;
  lastGoodBackupId?: string | null;
}

export interface IntegrityScanData {
  id: string;
  status: 'COMPLETED' | 'ISSUES_FOUND' | 'FAILED';
  issuesCount: number;
  issues: IntegrityIssue[];
  recordsScanned: number;
  filesScanned: number;
  durationMs: number;
  createdAt: string;
  scannedBy?: { fullName: string } | null;
}

export interface BackupDashboardStats {
  totalBackups: number;
  totalStorageBytes: number;
  totalStorageFormatted: string;
  totalRecords: number;
  lastSuccessfulAt: string | null;
  lastSuccessfulType: string | null;
  nextScheduledAt: string;
  systemHealth: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'FAILED';
  latestIntegrityIssuesCount: number;
}

interface AdminBackupsProps {
  initialBackups: BackupItem[];
  initialStats: BackupDashboardStats;
  initialScan?: IntegrityScanData | null;
}

export function AdminBackups({
  initialBackups,
  initialStats,
  initialScan,
}: AdminBackupsProps) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const can = useCan();

  const canCreate = can('backup.create') || can('*');
  const canRestore = can('backup.restore') || can('*');
  const canDownload = can('backup.download') || can('*');

  const [backups, setBackups] = useState<BackupItem[]>(initialBackups);
  const [stats, setStats] = useState<BackupDashboardStats>(initialStats);
  const [latestScan, setLatestScan] = useState<IntegrityScanData | null>(initialScan ?? null);
  const [restorations, setRestorations] = useState<RestorationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'backups' | 'integrity' | 'history'>('backups');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Creation form state
  const [backupType, setBackupType] = useState<'FULL' | 'INCREMENTAL'>('FULL');
  const [backupNotes, setBackupNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Restore wizard state
  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [restoring, setRestoring] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restorePreview, setRestorePreview] = useState<unknown | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreNotes, setRestoreNotes] = useState('');

  // Scanning state
  const [scanning, setScanning] = useState(false);

  // Refresh data from API
  const refreshData = async () => {
    try {
      const res = await fetch('/api/admin/backups');
      const json = await res.json();
      if (json.data) {
        setBackups(json.data.backups);
        setStats(json.data.stats);
      }
    } catch {
      // silent refresh fail
    }
  };

  // Copy hash helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    toast('SHA-256 checksum copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(null), 2500);
  };

  // Trigger on-demand backup
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: backupType,
          notes: backupNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Backup failed');

      toast(`Backup ${json.data.filename} created successfully!`, 'success');
      setCreateModalOpen(false);
      setBackupNotes('');
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create backup', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Trigger integrity verification on a specific backup
  const handleVerifyBackup = async (backupId: string) => {
    toast('Verifying SHA-256 integrity checksum...', 'info');
    try {
      const res = await fetch(`/api/admin/backups/${backupId}/verify`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Verification failed');

      if (json.data.valid) {
        toast(`Integrity verified! Checksum matches: ${json.data.checksumSha256.slice(0, 16)}...`, 'success');
      } else {
        toast(`Integrity check failed: ${json.data.error}`, 'error');
      }
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Verification failed', 'error');
    }
  };

  // Trigger full data loss and integrity scan
  const handleRunIntegrityScan = async () => {
    setScanning(true);
    toast('Scanning database & storage for data loss or corrupted records...', 'info');

    try {
      const res = await fetch('/api/admin/backups/integrity', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Scan failed');

      setLatestScan(json.data);
      if (json.data.criticalCount > 0) {
        toast(`Scan complete: ${json.data.criticalCount} critical data integrity issues found!`, 'error');
      } else if (json.data.issuesCount > 0) {
        toast(`Scan complete: ${json.data.issuesCount} warnings detected.`, 'info');
      } else {
        toast('Data integrity scan complete: 0 issues found. All records healthy!', 'success');
      }
      setActiveTab('integrity');
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to run integrity scan', 'error');
    } finally {
      setScanning(false);
    }
  };

  // Prepare restoration preview
  const handleOpenRestoreWizard = async (backup: BackupItem) => {
    setSelectedBackup(backup);
    setRestoreStep(1);
    setConfirmText('');
    setRestoreNotes('');
    setRestoreModalOpen(true);
    setPreviewLoading(true);

    try {
      const res = await fetch(`/api/admin/backups/${backup.id}/restore-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to load restore preview');
      setRestorePreview(json.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate preview', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Execute safe restoration
  const handleExecuteRestore = async () => {
    if (!selectedBackup) return;
    if (confirmText !== 'RESTORE') {
      toast('Please type RESTORE to confirm.', 'error');
      return;
    }

    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmText: 'RESTORE',
          notes: restoreNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Restoration failed');

      toast(`Data restored successfully! ${json.data.recordsRestored} records recovered.`, 'success');
      setRestoreModalOpen(false);
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restoration failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Filtered backups list
  const filteredBackups = backups.filter((b) => {
    if (filterType === 'ALL') return true;
    return b.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header & Quick Actions ───────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {t('backupsTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            {t('backupSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunIntegrityScan}
            disabled={scanning}
            className="rounded-xl border-slate-200"
          >
            {scanning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            ) : (
              <Activity className="mr-2 h-4 w-4 text-emerald-600" />
            )}
            <span>Scan Data Integrity</span>
          </Button>

          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Create Backup Now</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Critical Alerts Banner (if any) ───────────────────── */}
      {latestScan && latestScan.issuesCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-bold text-amber-900">
                Data Integrity Scan Detected {latestScan.issuesCount} Issue
                {latestScan.issuesCount > 1 ? 's' : ''}
              </h4>
              <p className="mt-0.5 text-sm text-amber-800">
                Found {latestScan.issues.filter((i) => i.severity === 'CRITICAL').length} critical
                anomalies and {latestScan.issues.filter((i) => i.severity === 'WARNING').length}{' '}
                warnings across records & files.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('integrity')}
              className="rounded-xl border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Inspect Issues
            </Button>
          </div>
        </div>
      )}

      {/* ── KPI Cards: 4 Key Metrics ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* System Health */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              System Backup Health
            </CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  stats.systemHealth === 'HEALTHY'
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                }
              >
                {stats.systemHealth}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {stats.lastSuccessfulAt
                ? `Last: ${new Date(stats.lastSuccessfulAt).toLocaleDateString()} (${stats.lastSuccessfulType})`
                : 'No backups recorded yet'}
            </p>
          </CardContent>
        </Card>

        {/* Total Storage Consumed */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Storage Consumed
            </CardTitle>
            <HardDrive className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {stats.totalStorageFormatted}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Across {stats.totalBackups} versioned archive{stats.totalBackups === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        {/* Total Records Backed Up */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Archived Records
            </CardTitle>
            <Layers className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {stats.totalRecords.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-slate-500">Users, listings, orders & chats</p>
          </CardContent>
        </Card>

        {/* Next Scheduled Backup */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Next Scheduled
            </CardTitle>
            <Clock className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-slate-800 truncate">
              {new Date(stats.nextScheduledAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Auto daily cron (RPO: 24h, RTO: &lt;15m)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabbed Content ───────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as never)} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="backups" className="rounded-lg text-xs font-semibold">
              <Database className="mr-1.5 h-3.5 w-3.5" />
              <span>Backup Archives ({backups.length})</span>
            </TabsTrigger>
            <TabsTrigger value="integrity" className="rounded-lg text-xs font-semibold">
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              <span>
                Integrity Monitor{' '}
                {latestScan && latestScan.issuesCount > 0 && `(${latestScan.issuesCount})`}
              </span>
            </TabsTrigger>
          </TabsList>

          {activeTab === 'backups' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Filter:</span>
              <select
                aria-label="Filter backups by type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="FULL">Full Backups</option>
                <option value="INCREMENTAL">Incremental</option>
                <option value="SAFETY_SNAPSHOT">Safety Snapshots</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Tab 1: Backup Archives ──────────────────────────── */}
        <TabsContent value="backups" className="space-y-4">
          {filteredBackups.length === 0 ? (
            <Card className="rounded-2xl border-dashed p-10 text-center">
              <Database className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-800">No Backups Found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your first automated backup to protect all customer and marketplace data.
              </p>
              {canCreate && (
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-4 rounded-xl bg-primary text-xs font-semibold"
                >
                  Create Backup Now
                </Button>
              )}
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Archive Details</th>
                      <th className="px-4 py-3.5 font-bold">Type & Status</th>
                      <th className="px-4 py-3.5 font-bold">Records & Size</th>
                      <th className="px-4 py-3.5 font-bold">SHA-256 Checksum</th>
                      <th className="px-4 py-3.5 font-bold">Created Date</th>
                      <th className="px-4 py-3.5 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBackups.map((b) => (
                      <tr key={b.id} className="transition-colors hover:bg-slate-50/60">
                        {/* Filename & Notes */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{b.filename}</div>
                          {b.notes && (
                            <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                              {b.notes}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {b.scope.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {s}
                              </span>
                            ))}
                            {b.scope.length > 3 && (
                              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                +{b.scope.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Type & Status */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge
                              variant="outline"
                              className={
                                b.type === 'FULL'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : b.type === 'SAFETY_SNAPSHOT'
                                  ? 'border-purple-200 bg-purple-50 text-purple-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }
                            >
                              {b.type}
                            </Badge>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                b.status === 'SUCCESS'
                                  ? 'text-emerald-700'
                                  : b.status === 'IN_PROGRESS'
                                  ? 'text-blue-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {b.status === 'SUCCESS' && <CheckCircle2 className="h-3 w-3" />}
                              {b.status === 'IN_PROGRESS' && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {b.status === 'CORRUPTED' && <FileWarning className="h-3 w-3" />}
                              {b.status}
                            </span>
                          </div>
                        </td>

                        {/* Records & Size */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {b.recordCount.toLocaleString()} records
                          </div>
                          <div className="text-xs text-slate-500">
                            {(b.sizeBytes / 1024).toFixed(1)} KB • {b.fileCount} files
                          </div>
                        </td>

                        {/* Checksum */}
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[120px] text-slate-600">
                              {b.checksumSha256.slice(0, 12)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(b.checksumSha256, b.id)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Copy SHA-256 hash"
                            >
                              {copiedHash === b.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Created Date & User */}
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          <div>{new Date(b.createdAt).toLocaleDateString()}</div>
                          <div className="text-slate-400">
                            {new Date(b.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {b.createdBy && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              by {b.createdBy.fullName}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Verify button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVerifyBackup(b.id)}
                              title="Verify SHA-256 integrity"
                              className="h-8 px-2 text-xs"
                            >
                              <FileCheck2 className="h-4 w-4 text-emerald-600" />
                              <span className="hidden lg:inline ml-1">Verify</span>
                            </Button>

                            {/* Restore button */}
                            {canRestore && b.status === 'SUCCESS' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRestoreWizard(b)}
                                title="Safely restore from this backup"
                                className="h-8 px-2 text-xs font-semibold text-slate-700 border-slate-200"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-blue-600 mr-1" />
                                <span>Restore</span>
                              </Button>
                            )}

                            {/* Download button */}
                            {canDownload && (
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                title="Download encrypted archive"
                                className="h-8 w-8 p-0"
                              >
                                <a
                                  href={`/api/admin/backups/${b.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="h-4 w-4 text-slate-600" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Integrity & Data Loss Monitor ─────────────── */}
        <TabsContent value="integrity" className="space-y-4">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Data Loss & Corruption Scanner
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Scans live database tables for orphan relationships, negative amounts, missing
                  media files, and compares volume drops against baseline backups.
                </CardDescription>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleRunIntegrityScan}
                disabled={scanning}
                className="rounded-xl border-slate-200"
              >
                {scanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4 text-emerald-600" />
                )}
                <span>Scan Now</span>
              </Button>
            </CardHeader>

            <CardContent>
              {!latestScan || latestScan.issues.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50/60 p-8 text-center border border-emerald-100">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h4 className="mt-3 text-base font-bold text-emerald-950">
                    System Data is 100% Intact & Healthy
                  </h4>
                  <p className="mt-1 text-xs text-emerald-800">
                    Zero orphan customer records, zero broken foreign keys, and zero missing media
                    files detected.
                  </p>
                  {latestScan && (
                    <p className="mt-2 text-[11px] text-emerald-700/80">
                      Last scanned: {new Date(latestScan.createdAt).toLocaleString()} (
                      {latestScan.recordsScanned} records verified in {latestScan.durationMs}ms)
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>
                      Detected Issues ({latestScan.issuesCount}): {latestScan.issues.filter((i) => i.severity === 'CRITICAL').length} Critical,{' '}
                      {latestScan.issues.filter((i) => i.severity === 'WARNING').length} Warnings
                    </span>
                    <span>Scanned at: {new Date(latestScan.createdAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {latestScan.issues.map((issue) => (
                      <div key={issue.id} className="p-4 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                issue.severity === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : issue.severity === 'WARNING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }
                            >
                              {issue.severity}
                            </Badge>
                            <span className="text-xs font-bold text-slate-800">{issue.entity}</span>
                            <span className="text-xs font-mono text-slate-400">{issue.category}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{issue.description}</p>
                          <p className="text-xs text-emerald-700 font-normal">
                            <strong>Recommended Action:</strong> {issue.recommendation}
                          </p>
                        </div>

                        {issue.lastGoodBackupId && (
                          <div className="shrink-0 pt-2 sm:pt-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const target = backups.find((b) => b.id === issue.lastGoodBackupId);
                                if (target) handleOpenRestoreWizard(target);
                              }}
                              className="text-xs border-slate-200 rounded-lg"
                            >
                              <RotateCcw className="h-3 w-3 mr-1 text-primary" />
                              <span>Recover from Backup</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal 1: Create Backup Now ────────────────────────── */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Database className="h-6 w-6" />
              <DialogTitle className="text-xl font-bold">Create New Backup</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Captures customer accounts, listings, orders, messages, and configuration into an
              AES-256 encrypted, tamper-evident archive.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBackup} className="mt-3 space-y-4">
            {/* Backup Type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Backup Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBackupType('FULL')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    backupType === 'FULL'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-900">Full Backup</div>
                  <div className="text-[11px] text-slate-500">
                    Complete snapshot of all tables & media manifests
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('INCREMENTAL')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    backupType === 'INCREMENTAL'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-900">Incremental</div>
                  <div className="text-[11px] text-slate-500">
                    Only records modified since last successful backup
                  </div>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="backup-notes" className="text-xs font-bold text-slate-700">
                Administrative Notes (Optional)
              </Label>
              <Input
                id="backup-notes"
                placeholder="e.g. Pre-deployment snapshot or routine weekly backup"
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="min-w-[140px] rounded-xl bg-primary font-bold text-white shadow-sm"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Backing Up...
                  </>
                ) : (
                  'Start Backup'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal 2: Multi-Step Safe Restoration Wizard ───────── */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <RotateCcw className="h-6 w-6" />
              <DialogTitle className="text-xl font-bold">Safe Data Restoration Wizard</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Review and safely recover records from archive{' '}
              <span className="font-mono font-semibold text-slate-700">
                {selectedBackup?.filename}
              </span>
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Verifying SHA-256 integrity and generating diff preview...
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500">
                <span className={restoreStep === 1 ? 'text-primary' : 'text-slate-400'}>
                  1. Preview Impact
                </span>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className={restoreStep === 2 ? 'text-primary' : 'text-slate-400'}>
                  2. Safety Guarantee
                </span>
                <ArrowRight className="h-3 w-3 text-slate-300" />
                <span className={restoreStep === 3 ? 'text-primary' : 'text-slate-400'}>
                  3. Confirmation
                </span>
              </div>

              {/* Step 1: Diff Table */}
              {restoreStep === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The system verified this backup&apos;s SHA-256 hash. Here is the comparative diff
                    against current live database tables:
                  </p>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="p-2.5">Entity</th>
                          <th className="p-2.5 text-center">In Backup</th>
                          <th className="p-2.5 text-center">In Live</th>
                          <th className="p-2.5 text-center text-emerald-700">To Insert</th>
                          <th className="p-2.5 text-center text-blue-700">To Update</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(
                          (restorePreview as { summary?: Array<{ entity: string; inBackupCount: number; inLiveCount: number; toInsertCount: number; toUpdateCount: number }> })
                            ?.summary || []
                        ).map((s) => (
                          <tr key={s.entity}>
                            <td className="p-2.5 font-semibold text-slate-800">{s.entity}</td>
                            <td className="p-2.5 text-center font-mono">{s.inBackupCount}</td>
                            <td className="p-2.5 text-center font-mono">{s.inLiveCount}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                              +{s.toInsertCount}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-blue-700">
                              ~{s.toUpdateCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={() => setRestoreStep(2)}
                      className="rounded-xl bg-primary text-xs font-semibold"
                    >
                      Next: Safety Snapshot &gt;
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Safety Snapshot Guarantee */}
              {restoreStep === 2 && (
                <div className="space-y-3.5">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
                      <div className="text-xs text-emerald-900 leading-relaxed">
                        <strong className="block text-sm font-bold text-emerald-950">
                          Automatic Pre-Restoration Recovery Point
                        </strong>
                        Zenova will automatically create an immutable snapshot of your live database
                        immediately before executing this restore. If needed, you can revert
                        instantly with zero permanent data loss.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="restore-notes" className="text-xs font-semibold text-slate-700">
                      Reason for restoration (Audit log requirement)
                    </Label>
                    <Input
                      id="restore-notes"
                      placeholder="e.g. Recovering customer records after accidental deletion"
                      value={restoreNotes}
                      onChange={(e) => setRestoreNotes(e.target.value)}
                      className="rounded-xl border-slate-200"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRestoreStep(1)}
                      className="rounded-xl"
                    >
                      &lt; Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setRestoreStep(3)}
                      className="rounded-xl bg-primary text-xs font-semibold"
                    >
                      Next: Confirm &gt;
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Explicit Confirmation */}
              {restoreStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                      <div className="text-xs text-rose-900 leading-relaxed">
                        <strong className="block text-sm font-bold text-rose-950">
                          Final Administrator Confirmation Required
                        </strong>
                        To proceed, please type <code className="font-bold text-rose-800">RESTORE</code>{' '}
                        in the box below. This will apply the backup changes to production data.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-restore" className="text-xs font-bold text-slate-700">
                      Type RESTORE to confirm:
                    </Label>
                    <Input
                      id="confirm-restore"
                      placeholder="RESTORE"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="rounded-xl border-slate-200 font-mono uppercase"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoring}
                      onClick={() => setRestoreStep(2)}
                      className="rounded-xl"
                    >
                      &lt; Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={confirmText !== 'RESTORE' || restoring}
                      onClick={handleExecuteRestore}
                      className="min-w-[140px] rounded-xl bg-rose-600 font-bold text-white hover:bg-rose-700"
                    >
                      {restoring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        'Confirm & Restore'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
