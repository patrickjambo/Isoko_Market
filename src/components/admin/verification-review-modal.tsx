'use client';

import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  CheckCircle2,
  Loader2,
  User,
  Globe,
  FileText,
  Contrast,
  ChevronDown,
  ChevronUp,
  Edit3,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { validateRwandanIdNumber } from '@/lib/verification/id-validator';

export interface VerificationReviewItem {
  id: string;
  userId: string;
  idDocumentUrl: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  extractedFullName?: string | null;
  extractedIdNumber?: string | null;
  extractedCountry?: string | null;
  ocrConfidence?: number | null;
  ocrRawText?: string | null;
  needsManualReview?: boolean;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    createdAt?: string;
  };
}

interface VerificationReviewModalProps {
  request: VerificationReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecisionSuccess?: () => void;
}

export function VerificationReviewModal({
  request,
  open,
  onOpenChange,
  onDecisionSuccess,
}: VerificationReviewModalProps) {
  const t = useTranslations('admin');
  const { toast } = useToast();

  // Document viewer transform state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [contrastHigh, setContrastHigh] = useState(false);
  const [imageCollapsed, setImageCollapsed] = useState(false);

  // Touch pinch-zoom tracking
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  // Form fields for reviewed data
  const [verifiedName, setVerifiedName] = useState('');
  const [verifiedIdNum, setVerifiedIdNum] = useState('');
  const [verifiedCountry, setVerifiedCountry] = useState('Rwanda');
  const [hasConfirmedVisualReview, setHasConfirmedVisualReview] = useState(false);

  // Decision state
  const [decisionMode, setDecisionMode] = useState<'view' | 'reject' | 'resubmit'>('view');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ocrRefreshing, setOcrRefreshing] = useState(false);

  // ── Zoom / Pan helpers — MUST be before early return (Rules of Hooks) ──
  const handleZoomIn = useCallback(() => setZoom((p) => Math.min(p + 0.25, 4)), []);
  const handleZoomOut = useCallback(() => setZoom((p) => Math.max(p - 0.25, 0.5)), []);
  const handleResetView = useCallback(() => { setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); }, []);
  const handleRotateCw = useCallback(() => setRotation((p) => (p + 90) % 360), []);
  const handleRotateCcw = useCallback(() => setRotation((p) => (p - 90 + 360) % 360), []);

  // ── Initialize data when request opens ────────────────────────────────
  useEffect(() => {
    if (request) {
      // Auto-populate extracted OCR data into the form inputs immediately.
      // Fallback to the user's registered name so the admin never has to retype
      // the full name from scratch — they only need to verify or correct any typo.
      setVerifiedName(request.extractedFullName || request.user.fullName || '');
      setVerifiedIdNum(request.extractedIdNumber ?? '');
      setVerifiedCountry(request.extractedCountry || 'Rwanda');
      setHasConfirmedVisualReview(false);
      setDecisionMode('view');
      setRejectionReason('');
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageCollapsed(true); // Collapsed by default on mobile so form/buttons are visible
    }
  }, [request]);

  // ── Auto-trigger OCR if ID number is missing when modal opens ──────────
  const hasTriedAutoOcr = useRef(false);
  useEffect(() => {
    if (
      open &&
      request &&
      !request.extractedIdNumber &&
      !hasTriedAutoOcr.current &&
      !ocrRefreshing
    ) {
      hasTriedAutoOcr.current = true;
      handleRerunOcr();
    }
    if (!open) {
      hasTriedAutoOcr.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  if (!request) return null;

  const docSrc = `/api/admin/verifications/${request.id}/document`;
  const idValidation = verifiedIdNum ? validateRwandanIdNumber(verifiedIdNum) : null;

  // Show banner only if neither OCR nor manual entry has populated the ID number
  const ocrIsPending = !request.extractedFullName && !request.extractedIdNumber && !verifiedIdNum;
  const ocrHasNoApiKey = ocrIsPending && !verifiedIdNum;

  // ── Mouse drag (desktop) ───────────────────────────────────────────────
  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }
  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (isDragging && zoom > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }
  function handleMouseUp() { setIsDragging(false); }

  // ── Touch events (mobile pan + pinch-zoom) ─────────────────────────────
  function getTouchDist(t1: React.Touch, t2: React.Touch) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 2 && t0 && t1) {
      lastTouchDist.current = getTouchDist(t0, t1);
    } else if (e.touches.length === 1 && t0 && zoom > 1) {
      lastTouchPos.current = { x: t0.clientX - position.x, y: t0.clientY - position.y };
      setIsDragging(true);
    }
  }
  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    e.preventDefault();
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 2 && t0 && t1 && lastTouchDist.current !== null) {
      const dist = getTouchDist(t0, t1);
      const delta = dist / lastTouchDist.current;
      setZoom((p) => Math.min(Math.max(p * delta, 0.5), 4));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && t0 && isDragging && lastTouchPos.current && zoom > 1) {
      setPosition({
        x: t0.clientX - lastTouchPos.current.x,
        y: t0.clientY - lastTouchPos.current.y,
      });
    }
  }
  function handleTouchEnd() {
    setIsDragging(false);
    lastTouchDist.current = null;
    lastTouchPos.current = null;
  }

  // ── Re-run OCR ─────────────────────────────────────────────────────────
  async function handleRerunOcr() {
    if (!request) return;
    setOcrRefreshing(true);
    try {
      const res = await fetch(`/api/admin/verifications/${request.id}/ocr`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to re-run OCR');

      if (data.data?.ocr) {
        const ocr = data.data.ocr;
        if (ocr.fullName) {
          setVerifiedName(ocr.fullName);
        } else if (!verifiedName && request.user?.fullName) {
          setVerifiedName(request.user.fullName);
        }
        if (ocr.idNumber) {
          setVerifiedIdNum(ocr.idNumber);
        }
        if (ocr.country) {
          setVerifiedCountry(ocr.country);
        }
        toast(
          ocr.idNumber
            ? 'ID details auto-extracted successfully'
            : ocr.needsManualReview
              ? 'OCR scanned — review and adjust fields if needed'
              : 'OCR extracted successfully',
          'success'
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'OCR scan failed', 'error');
    } finally {
      setOcrRefreshing(false);
    }
  }

  // ── Admin Decision ─────────────────────────────────────────────────────
  async function handleDecision(decision: 'approve' | 'reject' | 'resubmit') {
    if (!request) return;
    if (decision === 'approve' && !hasConfirmedVisualReview) {
      toast('Please confirm visual verification before approving.', 'error');
      return;
    }
    if ((decision === 'reject' || decision === 'resubmit') && !rejectionReason.trim()) {
      toast('A reason must be provided.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        decision,
        reason: rejectionReason.trim() || undefined,
      };
      if (decision === 'approve') {
        payload.verifiedFullName = verifiedName.trim();
        payload.verifiedIdNumber = verifiedIdNum.trim();
        payload.verifiedCountry = verifiedCountry.trim();
      }

      const res = await fetch(`/api/admin/verifications/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Action failed');

      toast(
        decision === 'approve'
          ? 'Identity verification approved successfully'
          : decision === 'resubmit'
            ? 'Requested customer re-upload'
            : 'Verification rejected',
        'success'
      );

      onOpenChange(false);
      onDecisionSuccess?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Mobile: full-screen sheet from bottom (flex-col), image collapsed by default.
        Desktop: wide side-by-side dialog (max-w-6xl).
      */}
      <DialogContent className="w-full max-w-6xl max-h-[95dvh] h-[100dvh] sm:h-auto overflow-hidden flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="flex-shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-slate-50/60 flex flex-row items-center gap-2 sm:gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm sm:text-base font-bold leading-tight truncate">
              Identity Verification
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground">
              Inspect the document and verify the extracted information.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* ── Body: stacked on mobile, side-by-side on lg ── */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

          {/* ══ LEFT: Document Viewer ══════════════════════════════════════ */}
          <div className={`flex-shrink-0 bg-slate-950 flex flex-col relative select-none overflow-hidden ${imageCollapsed ? '' : 'lg:flex-1 max-h-[40vh] lg:max-h-none'}`}>

            {/* Mobile collapse toggle */}
            <button
              type="button"
              onClick={() => setImageCollapsed((v) => !v)}
              className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-xs text-slate-300 bg-slate-900 border-b border-slate-800 active:bg-slate-800"
            >
              <span className="font-medium">{imageCollapsed ? '📄 Show ID Document' : '▲ Hide Document'}</span>
              {imageCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            {!imageCollapsed && (
              <>
                {/* Toolbar */}
                <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
                  {/* Controls group */}
                  <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-sm rounded-lg p-1 border border-slate-800 pointer-events-auto shadow-lg">
                    <ToolBtn onClick={handleZoomIn} title="Zoom In"><ZoomIn className="h-4 w-4" /></ToolBtn>
                    <ToolBtn onClick={handleZoomOut} title="Zoom Out"><ZoomOut className="h-4 w-4" /></ToolBtn>
                    <div className="h-4 w-px bg-slate-700 mx-0.5" />
                    <ToolBtn onClick={handleRotateCcw} title="Rotate Left"><RotateCcw className="h-4 w-4" /></ToolBtn>
                    <ToolBtn onClick={handleRotateCw} title="Rotate Right"><RotateCw className="h-4 w-4" /></ToolBtn>
                    <div className="h-4 w-px bg-slate-700 mx-0.5" />
                    <ToolBtn onClick={handleResetView} title="Reset View"><Maximize2 className="h-4 w-4" /></ToolBtn>
                    <ToolBtn
                      onClick={() => setContrastHigh((v) => !v)}
                      title="Toggle High Contrast"
                      active={contrastHigh}
                    >
                      <Contrast className="h-4 w-4" />
                    </ToolBtn>
                  </div>

                  {/* Full Size link */}
                  <div className="pointer-events-auto">
                    <a
                      href={docSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-xs text-slate-200 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Full Size</span>
                    </a>
                  </div>
                </div>

                {/* Image viewport — supports mouse drag + touch pinch/pan */}
                <div
                  className={`flex-1 flex items-center justify-center p-3 lg:p-6 min-h-[180px] lg:min-h-[480px] touch-none ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                    }`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={docSrc}
                    alt="National ID Document"
                    draggable={false}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                      transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                      filter: contrastHigh ? 'contrast(165%) brightness(110%)' : 'none',
                    }}
                    className="max-h-[35vh] lg:max-h-[72vh] max-w-full object-contain rounded shadow-2xl origin-center"
                  />
                </div>

                {/* Status bar */}
                <div className="flex-shrink-0 px-4 py-2 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Zoom: {Math.round(zoom * 100)}% · Angle: {rotation}°</span>
                  <span className="hidden sm:inline text-slate-500 text-[11px]">
                    Pinch/drag to explore · review all details before approving
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ══ RIGHT: Extracted Info & Decision ══════════════════════════ */}
          <div className="flex-1 lg:w-[400px] xl:w-[440px] lg:flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto min-h-0">
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">

              {/* ── Registered Account Card ── */}
              <div className="rounded-xl border border-border p-3 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Registered Account
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {request.user.id.slice(0, 10)}…
                  </Badge>
                </div>
                <div className="text-sm font-bold text-foreground">{request.user.fullName}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Email: {request.user.email || 'None provided'}</div>
                  <div>Phone: {request.user.phone || 'None provided'}</div>
                  <div>Location: {request.user.location || 'Rwanda'}</div>
                </div>
              </div>

              {/* ── OCR Section ── */}
              <div className="rounded-xl border border-border p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Extracted Info (OCR)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2.5 gap-1.5 flex-shrink-0"
                    onClick={handleRerunOcr}
                    disabled={ocrRefreshing}
                  >
                    {ocrRefreshing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Re-run OCR
                  </Button>
                </div>

                {/* ── OCR Pending / No-Key Banner ── */}
                {ocrHasNoApiKey && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                      {ocrRefreshing ? (
                        <>
                          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                          Extracting ID information…
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          OCR Not Yet Extracted
                        </>
                      )}
                    </div>
                    {!ocrRefreshing && (
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Click <strong>Re-run OCR</strong> above to extract the information now,
                        or type the name and ID number manually from the document.
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <Edit3 className="h-3 w-3" />
                      Fields below are editable — type directly from the card image.
                    </div>
                  </div>
                )}

                {/* Confidence badge (only if OCR ran) */}
                {!ocrIsPending && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        (request.ocrConfidence ?? 0) >= 0.75
                          ? 'success'
                          : (request.ocrConfidence ?? 0) >= 0.5
                            ? 'outline'
                            : 'destructive'
                      }
                      className="text-[11px]"
                    >
                      {Math.round((request.ocrConfidence ?? 0) * 100)}% Confidence
                    </Badge>
                    {request.needsManualReview && (
                      <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Review Flagged
                      </Badge>
                    )}
                  </div>
                )}

                {/* ── Cardholder Full Name ── */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="vName" className="font-semibold text-slate-700">
                      Cardholder Full Name
                    </Label>
                    {verifiedName && (
                      verifiedName.toLowerCase() === request.user.fullName.toLowerCase() ? (
                        <span className="text-emerald-600 text-[11px] flex items-center gap-0.5">
                          <Check className="h-3 w-3" /> Matches Account
                        </span>
                      ) : (
                        <span className="text-amber-600 text-[11px] flex items-center gap-0.5">
                          <Info className="h-3 w-3" /> Differs from account
                        </span>
                      )
                    )}
                  </div>
                  <Input
                    id="vName"
                    value={verifiedName}
                    onChange={(e) => setVerifiedName(e.target.value)}
                    className="h-9 text-sm"
                    placeholder={ocrRefreshing ? 'Scanning ID card in realtime...' : 'Full name as printed on card'}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {verifiedName ? 'Auto-filled — edit if there is any typo' : 'Edit if OCR is incorrect'}
                  </p>
                </div>

                {/* ── National ID Number ── */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="vId" className="font-semibold text-slate-700">
                      National ID Number
                    </Label>
                    {idValidation?.valid && (
                      <span className="text-emerald-600 text-[11px] flex items-center gap-0.5 font-medium">
                        <Check className="h-3 w-3" /> Valid 16-Digit NID
                      </span>
                    )}
                  </div>
                  <Input
                    id="vId"
                    value={verifiedIdNum}
                    onChange={(e) => setVerifiedIdNum(e.target.value.replace(/\s+/g, ''))}
                    className="h-9 text-sm font-mono font-bold tracking-wider"
                    placeholder={ocrRefreshing ? 'Extracting 16-digit ID in realtime...' : 'e.g. 1199980083076077'}
                    maxLength={16}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {idValidation && (
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
                      {idValidation.valid ? (
                        <>
                          <span>Birth Year: {idValidation.birthYear}</span>
                          <span>·</span>
                          <span>{idValidation.isCitizen ? 'Citizen' : 'Foreigner/Refugee'}</span>
                          <span>·</span>
                          <span>Gender: {idValidation.genderIndicator}</span>
                        </>
                      ) : (
                        <span className="text-amber-600">{idValidation.reason}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Issuing Country ── */}
                <div className="space-y-1">
                  <Label htmlFor="vCountry" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> Issuing Country
                  </Label>
                  <Input
                    id="vCountry"
                    value={verifiedCountry}
                    onChange={(e) => setVerifiedCountry(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Rwanda"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Recognized from &quot;Republic of Rwanda&quot; / &quot;Repubulika y&apos;u Rwanda&quot;
                  </p>
                </div>
              </div>

              {/* ── Visual Review Confirmation ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer text-xs leading-relaxed text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasConfirmedVisualReview}
                    onChange={(e) => setHasConfirmedVisualReview(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary flex-shrink-0"
                  />
                  <span>
                    <strong>Administrator Visual Review Confirmation:</strong> I have personally
                    reviewed the uploaded ID photo, confirmed it is genuine and unmanipulated, and
                    verified that the full name and 16-digit ID number accurately correspond with
                    the customer.
                  </span>
                </label>
              </div>

              {/* ── Conditional Reason Drawer ── */}
              {decisionMode !== 'view' && (
                <div
                  className={`rounded-xl border p-3 sm:p-3.5 space-y-2.5 ${
                    decisionMode === 'resubmit'
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-rose-200 bg-rose-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        decisionMode === 'resubmit' ? 'text-amber-900' : 'text-rose-900'
                      }`}
                    >
                      {decisionMode === 'resubmit' ? 'Reason for Re-upload Request' : 'Reason for Rejection'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs p-1 text-slate-500 hover:text-slate-800"
                      onClick={() => setDecisionMode('view')}
                    >
                      Cancel
                    </Button>
                  </div>

                  {/* Suggestion Chips: Admin taps to auto-fill, or types custom message below */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-slate-600 block">
                      Quick suggestions (tap to fill, or type custom feedback below):
                    </span>
                    <div className="flex flex-wrap gap-1.5 pb-0.5">
                      {(decisionMode === 'resubmit'
                        ? [
                            'Image is blurry / unreadable',
                            'Corners cut off / uncropped card required',
                            'Glare or flash obscuring text',
                            'Back of ID card also required',
                            'Please upload a clearer, brighter photo',
                          ]
                        : [
                            'Name does not match account name',
                            'Document is not a valid National ID or Passport',
                            'Expired identification document',
                            'Suspected altered or edited document',
                            'Photocopy / screen photo not accepted (upload original card)',
                            'ID already registered to another account',
                          ]
                      ).map((preset) => {
                        const isSelected = rejectionReason === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRejectionReason(preset)}
                            className={`text-[10px] sm:text-[11px] px-2.5 py-1 rounded-md border transition-all text-left ${
                              isSelected
                                ? decisionMode === 'resubmit'
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-semibold'
                                  : 'bg-rose-600 text-white border-rose-600 shadow-sm font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={
                      decisionMode === 'resubmit'
                        ? 'Select a suggestion above or type instructions for re-upload...'
                        : 'Select a suggestion above or type reason for rejection...'
                    }
                    rows={2}
                    className="text-xs bg-white border-slate-300 focus:border-primary"
                  />
                </div>
              )}

              {/* ── Action Buttons (sticky bottom on mobile) ── */}
              <div className="space-y-2 pb-4 pt-2 sticky bottom-0 bg-card border-t border-border lg:border-t-0 -mx-3 sm:-mx-4 px-3 sm:px-4 lg:mx-0 lg:px-0 lg:static lg:bg-transparent">
                {decisionMode === 'view' ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white gap-2 font-semibold h-10 sm:h-11 text-sm"
                      disabled={!hasConfirmedVisualReview || submitting}
                      onClick={() => handleDecision('approve')}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve & Verify
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="text-amber-700 border-amber-300 hover:bg-amber-50 active:bg-amber-100 h-9 sm:h-10 text-xs sm:text-sm"
                        onClick={() => setDecisionMode('resubmit')}
                        disabled={submitting}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Re-upload
                      </Button>

                      <Button
                        variant="outline"
                        className="text-rose-700 border-rose-300 hover:bg-rose-50 active:bg-rose-100 h-9 sm:h-10 text-xs sm:text-sm"
                        onClick={() => setDecisionMode('reject')}
                        disabled={submitting}
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className={`w-full font-semibold h-10 sm:h-11 text-sm ${decisionMode === 'resubmit'
                        ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white'
                      }`}
                    disabled={!rejectionReason.trim() || submitting}
                    onClick={() => handleDecision(decisionMode)}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : decisionMode === 'resubmit' ? (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Confirm {decisionMode === 'resubmit' ? 'Re-upload Request' : 'Rejection'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Small icon button for the document toolbar ──────────────────────────
function ToolBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${active
          ? 'text-amber-400 bg-slate-800'
          : 'text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700'
        }`}
    >
      {children}
    </button>
  );
}
