'use client';

import { useState, useRef, useEffect, MouseEvent } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Check,
  X,
  RotateCcw as RefreshIcon,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  CheckCircle2,
  Loader2,
  User,
  Calendar,
  Globe,
  FileText,
  Eye,
  Sliders,
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

  // Initialize data when request opens
  useEffect(() => {
    if (request) {
      setVerifiedName(request.extractedFullName || request.user.fullName || '');
      setVerifiedIdNum(request.extractedIdNumber || '');
      setVerifiedCountry(request.extractedCountry || 'Rwanda');
      setHasConfirmedVisualReview(false);
      setDecisionMode('view');
      setRejectionReason('');
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [request]);

  if (!request) return null;

  const docSrc = `/api/admin/verifications/${request.id}/document`;
  const idValidation = verifiedIdNum ? validateRwandanIdNumber(verifiedIdNum) : null;

  // Zoom / Pan handlers
  function handleZoomIn() {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  }
  function handleZoomOut() {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }
  function handleResetView() {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }
  function handleRotateCw() {
    setRotation((prev) => (prev + 90) % 360);
  }
  function handleRotateCcw() {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }

  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  async function handleRerunOcr() {
    setOcrRefreshing(true);
    try {
      const res = await fetch(`/api/admin/verifications/${request!.id}/ocr`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to re-run OCR');

      if (data.data?.ocr) {
        const ocr = data.data.ocr;
        if (ocr.fullName) setVerifiedName(ocr.fullName);
        if (ocr.idNumber) setVerifiedIdNum(ocr.idNumber);
        if (ocr.country) setVerifiedCountry(ocr.country);
        toast('OCR re-scanned successfully', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'OCR scan failed', 'error');
    } finally {
      setOcrRefreshing(false);
    }
  }

  async function handleDecision(decision: 'approve' | 'reject' | 'resubmit') {
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
      const payload: Record<string, any> = {
        decision,
        reason: rejectionReason.trim() || undefined,
      };

      if (decision === 'approve') {
        payload.verifiedFullName = verifiedName.trim();
        payload.verifiedIdNumber = verifiedIdNum.trim();
        payload.verifiedCountry = verifiedCountry.trim();
      }

      const res = await fetch(`/api/admin/verifications/${request!.id}`, {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b border-border bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Identity Verification & Document Inspection
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Visually inspect the original document and compare with extracted identity records.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT: Document Inspection Canvas (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-950 flex flex-col relative select-none overflow-hidden min-h-[380px] lg:min-h-[550px]">
            {/* Toolbar */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur rounded-lg p-1.5 border border-slate-800 pointer-events-auto shadow-lg">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-0.5" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800"
                  onClick={handleRotateCcw}
                  title="Rotate Left"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800"
                  onClick={handleRotateCw}
                  title="Rotate Right"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-0.5" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800"
                  onClick={handleResetView}
                  title="Reset View"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 ${
                    contrastHigh ? 'text-amber-400 bg-slate-800' : 'text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => setContrastHigh(!contrastHigh)}
                  title="Toggle High Contrast"
                >
                  <Sliders className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <a
                  href={docSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs text-slate-200 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Full Size
                </a>
              </div>
            </div>

            {/* Interactive Image Viewport */}
            <div
              className={`flex-1 flex items-center justify-center p-6 ${
                zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={docSrc}
                alt="National ID Document"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  filter: contrastHigh ? 'contrast(160%) brightness(110%)' : 'none',
                }}
                className="max-h-[82vh] max-w-full object-contain rounded shadow-2xl origin-center"
              />
            </div>

            {/* Bottom Status bar */}
            <div className="p-2.5 px-4 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between z-10">
              <span>Zoom: {Math.round(zoom * 100)}% · Angle: {rotation}°</span>
              <span className="text-[11px] text-slate-500">
                Drag to pan when zoomed · Review all details before approving
              </span>
            </div>
          </div>

          {/* RIGHT: Extracted Information & Admin Comparison (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col border-l border-border bg-card overflow-y-auto max-h-[85vh]">
            <div className="p-5 space-y-5">
              {/* Registered Profile Header */}
              <div className="rounded-xl border border-border p-3.5 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Registered Customer Account
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    ID: {request.user.id.slice(0, 12)}...
                  </Badge>
                </div>
                <div className="text-sm font-bold text-foreground">{request.user.fullName}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Email: {request.user.email || 'None provided'}</div>
                  <div>Phone: {request.user.phone || 'None provided'}</div>
                  <div>Location: {request.user.location || 'Rwanda'}</div>
                </div>
              </div>

              {/* Automated Extraction OCR Card */}
              <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Extracted Information (OCR)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={handleRerunOcr}
                    disabled={ocrRefreshing}
                  >
                    {ocrRefreshing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <RefreshIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    Re-run OCR
                  </Button>
                </div>

                {/* Confidence Badge */}
                <div className="flex items-center gap-2">
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
                    {Math.round((request.ocrConfidence ?? 0.8) * 100)}% Extraction Confidence
                  </Badge>
                  {request.needsManualReview && (
                    <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Manual Review Flagged
                    </Badge>
                  )}
                </div>

                {/* Comparison Fields: Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="vName" className="font-semibold text-slate-700">
                      Cardholder Full Name
                    </Label>
                    {verifiedName.toLowerCase() === request.user.fullName.toLowerCase() ? (
                      <span className="text-emerald-600 text-[11px] flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Matches Account
                      </span>
                    ) : (
                      <span className="text-amber-600 text-[11px] flex items-center gap-0.5">
                        <Info className="h-3 w-3" /> Name diff vs account
                      </span>
                    )}
                  </div>
                  <Input
                    id="vName"
                    value={verifiedName}
                    onChange={(e) => setVerifiedName(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="Full name as printed on card"
                  />
                </div>

                {/* Comparison Fields: National ID Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="vId" className="font-semibold text-slate-700">
                      National Identification Number
                    </Label>
                    {idValidation?.valid && (
                      <span className="text-emerald-600 text-[11px] flex items-center gap-0.5 font-medium">
                        <Check className="h-3 w-3" /> Valid Rwandan 16-Digit NID
                      </span>
                    )}
                  </div>
                  <Input
                    id="vId"
                    value={verifiedIdNum}
                    onChange={(e) => setVerifiedIdNum(e.target.value.replace(/\s+/g, ''))}
                    className="h-9 text-xs font-mono font-bold tracking-wider"
                    placeholder="1 1995 8 0012345 0 24"
                    maxLength={16}
                  />
                  {idValidation && (
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 pt-0.5">
                      {idValidation.valid ? (
                        <>
                          <span>Birth Year: {idValidation.birthYear}</span>
                          <span>·</span>
                          <span>Category: {idValidation.isCitizen ? 'Citizen' : 'Foreigner/Refugee'}</span>
                          <span>·</span>
                          <span>Gender: {idValidation.genderIndicator}</span>
                        </>
                      ) : (
                        <span className="text-amber-600">{idValidation.reason}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Comparison Fields: Country */}
                <div className="space-y-1">
                  <Label htmlFor="vCountry" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> Issuing Country
                  </Label>
                  <Input
                    id="vCountry"
                    value={verifiedCountry}
                    onChange={(e) => setVerifiedCountry(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="Rwanda"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Recognized from &quot;Republic of Rwanda&quot; / &quot;Repubulika y&apos;u Rwanda&quot;
                  </p>
                </div>
              </div>

              {/* Legal Review Confirmation Checkbox */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-relaxed text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasConfirmedVisualReview}
                    onChange={(e) => setHasConfirmedVisualReview(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>
                    <strong>Administrator Visual Review Confirmation:</strong> I have personally reviewed
                    the uploaded ID photo, confirmed it is genuine and unmanipulated, and verified that
                    the full name and 16-digit ID number accurately correspond with the customer.
                  </span>
                </label>
              </div>

              {/* Conditional Reason Drawer for Reject or Resubmit */}
              {decisionMode !== 'view' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">
                      {decisionMode === 'resubmit' ? 'Reason for Re-upload Request' : 'Rejection Reason'}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs p-1 text-slate-500"
                      onClick={() => setDecisionMode('view')}
                    >
                      Cancel
                    </Button>
                  </div>

                  {decisionMode === 'resubmit' && (
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {[
                        'Image is blurry / unreadable',
                        'Corners cut off / uncropped card required',
                        'Glare or flash obscuring text',
                        'Expired identification card',
                        'Back of card also required',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRejectionReason(preset)}
                          className="text-[10px] px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}

                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide clear instructions for the customer..."
                    rows={2}
                    className="text-xs bg-white"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {decisionMode === 'view' ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
                      disabled={!hasConfirmedVisualReview || submitting}
                      onClick={() => handleDecision('approve')}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve & Verify Customer ID
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                        onClick={() => setDecisionMode('resubmit')}
                        disabled={submitting}
                      >
                        <RefreshIcon className="h-3.5 w-3.5 mr-1.5" />
                        Request Re-upload
                      </Button>

                      <Button
                        variant="outline"
                        className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs"
                        onClick={() => setDecisionMode('reject')}
                        disabled={submitting}
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Reject Submission
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className={`w-full font-semibold ${
                      decisionMode === 'resubmit'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                    disabled={!rejectionReason.trim() || submitting}
                    onClick={() => handleDecision(decisionMode)}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : decisionMode === 'resubmit' ? (
                      <RefreshIcon className="h-4 w-4 mr-2" />
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
