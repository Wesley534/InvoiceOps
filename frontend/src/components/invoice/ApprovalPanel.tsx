import React, { useState } from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';
import type { HumanOutcome, Report } from '../../lib/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Alert';
import { OutcomeBadge } from '../ui/StatusBadges';

interface ApprovalPanelProps {
  report: Report;
  isApprover: boolean;
  busy?: boolean;
  error?: string | null;
  onDecide: (outcome: 'approved' | 'rejected', reason?: string) => Promise<void>;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({
  report,
  isApprover,
  busy,
  error,
  onDecide,
}) => {
  const [intent, setIntent] = useState<'approved' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const decided = report.human_outcome && report.human_outcome !== 'pending';
  const decision = report.decision;
  const blockOverride = intent === 'approved' && decision === 'BLOCK';

  const reset = () => {
    setIntent(null);
    setReason('');
    setNotes('');
    setErrorText(null);
  };

  const confirm = async () => {
    setErrorText(null);
    if (blockOverride && !reason.trim()) {
      setErrorText('Overriding a BLOCK requires a written reason (policy escalation).');
      return;
    }
    try {
      await onDecide(intent as 'approved' | 'rejected', reason.trim() || undefined);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'The decision could not be recorded.');
    }
  };

  // Finalized — nothing left to do.
  if (decided) {
    return (
      <Card className="bg-mint/50 border-brand/20">
        <div className="flex items-center gap-3">
          <OutcomeBadge outcome={report.human_outcome ?? null} size="md" />
          <p className="text-xs text-zinc-600">
            Final outcome recorded for this report. The invoice is closed and can no longer be changed.
          </p>
        </div>
      </Card>
    );
  }

  // Reviewer (non-approver) sees a read-only notice.
  if (!isApprover) {
    return (
      <Card className="bg-zinc-50/70 border-zinc-200">
        <p className="text-xs text-zinc-600 leading-relaxed">
          You are signed in as a <strong className="text-zinc-800">reviewer</strong>. Final approval, rejection
          and BLOCK overrides are reserved for the <strong className="text-zinc-800">approver</strong> role.
          You can still correct extracted fields above, or hand this report to an approver.
        </p>
      </Card>
    );
  }

  return (
    <Card
      header={{
        icon: <ShieldAlert className="w-4 h-4" />,
        title: 'Approver decision',
        subtitle: report.decision === 'BLOCK' ? 'Hard stop — override needs a written reason' : 'The final call on this report',
      }}
    >
      <div className="space-y-4">
        {report.decision === 'BLOCK' && (
          <Alert tone="error" title="BLOCK recommendation">
            This invoice failed a critical check. Approving it is treated as an override and will be logged with
            the reason you provide.
          </Alert>
        )}
        {report.decision !== 'BLOCK' && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            The system is advisory: its recommendation never authorizes payment. A qualified approver makes the
            final decision.
          </p>
        )}

        {(error || errorText) && (
          <Alert tone="error" onDismiss={() => setErrorText(null)}>
            {errorText ?? error}
          </Alert>
        )}

        {!intent && (
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Button
              variant={report.decision === 'BLOCK' ? 'dangerGhost' : 'primary'}
              onClick={() => setIntent('approved')}
              disabled={busy}
            >
              <Check className="w-4 h-4" />
              {report.decision === 'BLOCK' ? 'Override block — approve' : 'Approve'}
            </Button>
            <Button variant="secondary" onClick={() => setIntent('rejected')} disabled={busy}>
              <X className="w-4 h-4" />
              Reject
            </Button>
          </div>
        )}

        {intent && (
          <div className="space-y-3 rounded-xl bg-zinc-50 border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ink">
                {intent === 'approved'
                  ? report.decision === 'BLOCK'
                    ? 'Confirm BLOCK override'
                    : 'Confirm approval'
                  : 'Confirm rejection'}
              </p>
              <Button size="xs" variant="ghost" onClick={reset} disabled={busy}>
                Back
              </Button>
            </div>

            {blockOverride && (
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required — why is this override justified?"
                error={errorText ? 'Required' : null}
                disabled={busy}
              />
            )}

            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note for the audit log…"
              rows={3}
              disabled={busy}
            />

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant={intent === 'approved' ? (report.decision === 'BLOCK' ? 'danger' : 'primary') : 'secondary'}
                onClick={confirm}
                loading={busy}
              >
                {intent === 'approved' ? 'Approve' : 'Reject'}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Recorded append-only with your identity — it cannot be edited or deleted.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
